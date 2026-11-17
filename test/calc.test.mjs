import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculer, mensualite, scenarioParDefaut } from "../js/calc.js";

const bien = JSON.parse(readFileSync(new URL("../biens/le-cannet-gr876.json", import.meta.url)));

test("matches the study: 470 k€ total cost, 3.7 % gross yield empty rental", () => {
  const r = calculer(bien, scenarioParDefaut(bien, "vide"));
  assert.ok(Math.abs(r.coutTotal - 470125) < 1);
  assert.equal(r.rendementBrut.toFixed(1), "3.7");
});

test("colocation 3 x 600 €: 4.6 % gross", () => {
  const r = calculer(bien, scenarioParDefaut(bien, "coloc"));
  assert.equal(r.rendementBrut.toFixed(1), "4.6");
});

test("loan payment: 100 k€ 20 y 3 % ≈ 554.60 €", () => {
  assert.equal(mensualite(100000, 3, 20).toFixed(2), "554.60");
});

test("risk factors lower net yield", () => {
  const s = scenarioParDefaut(bien, "vide");
  const sans = calculer(bien, s);
  const avec = calculer(bien, { ...s, risques: ["bruit", "copro", "taxeFonciere"] });
  assert.ok(avec.rendementNet < sans.rendementNet);
});

test("micro-foncier above 15 k€ rents raises a warning", () => {
  const r = calculer(bien, { ...scenarioParDefaut(bien, "vide"), regime: "micro-foncier" });
  assert.equal(r.alertes.length, 1);
});

const sci = JSON.parse(readFileSync(new URL("../acquereurs/sci-flv.json", import.meta.url)));

test("SCI à l'IR is the default regime and a deficit saves tax on existing rents", () => {
  const s = scenarioParDefaut(bien, "vide", sci);
  assert.equal(s.regime, "sci-ir");
  assert.equal(s.associes, 3);
  const r = calculer(bien, s);
  assert.ok(r.deficit > 0);
  assert.ok(r.impot < 0);
  assert.ok(-r.impot <= sci.autresRevenusFonciersNets * (s.tmi + s.prelevementsSociauxPct) / 100 + 1e-6);
  assert.ok(r.rendementNetNet > r.rendementNet);
});

test("SCI à l'IR without other rental income: no saving", () => {
  const r = calculer(bien, { ...scenarioParDefaut(bien, "vide", sci), autresRevenusFonciers: 0 });
  assert.equal(r.impot, 0);
});

test("furnished rental in an SCI à l'IR raises a warning", () => {
  const r = calculer(bien, scenarioParDefaut(bien, "meuble", sci));
  assert.ok(r.alertes.some((a) => a.includes("IS")));
});
