import { REGIMES, calculer, regimeParDefaut, scenarioParDefaut } from "./calc.js";

const BIEN_PAR_DEFAUT = "le-cannet-gr876";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const num = (d) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtPct = (x, d = 2) => `${num(d).format(x)} %`;
const kEur = (x) => `${num(0).format(x / 1000)} k€`;

let bien;
let s;

// ---------- Control definitions (ranges derive from the property's own figures) ----------

function champs(b, sc) {
  const d = b.defauts;
  const loc = b.locations[sc.mode];
  const arr = (x, pas) => Math.round(x / pas) * pas;
  const travMax = Math.max(...(b.travauxFourchette ?? [d.travaux])) * 2;

  const location =
    sc.mode === "coloc"
      ? [
          { k: "loyerParChambre", label: "Loyer par chambre (CC)", min: 300, max: 1000, pas: 10, unite: "€/mois" },
          { k: "chambres", label: "Nombre de chambres louées", min: 1, max: loc.chambresMax ?? loc.chambres, pas: 1, unite: "" },
        ]
      : [
          {
            k: "loyer",
            label: "Loyer mensuel",
            min: arr(loc.loyer * 0.6, 10),
            max: arr(loc.loyer * 1.4, 10),
            pas: 10,
            unite: "€/mois",
            aide: () => `${num(1).format(sc.loyer / b.surface)} €/m²`,
          },
        ];

  return [
    {
      titre: "Acquisition",
      champs: [
        {
          k: "prix",
          label: "Prix d'achat",
          min: arr(b.prixAffiche * 0.75, 1000),
          max: arr(b.prixAffiche * 1.25, 1000),
          pas: 1000,
          unite: "€",
          reperes: [b.estimation?.bas, b.estimation?.central, b.estimation?.haut, b.negociation?.plafond, b.prixAffiche],
          aide: () => {
            const ecart = (sc.prix / b.prixAffiche - 1) * 100;
            const e = b.estimation;
            return `${ecart >= 0 ? "+" : ""}${num(1).format(ecart)} % vs affiché (${kEur(b.prixAffiche)}) · ${num(0).format(sc.prix / b.surface)} €/m²` +
              (e ? ` · estimation ${kEur(e.bas)} à ${kEur(e.haut)}, centrale ${kEur(e.central)}` : "");
          },
        },
        { k: "notairePct", label: "Frais de notaire", min: 2, max: 10, pas: 0.1, unite: "%" },
        {
          k: "travaux",
          label: "Travaux",
          min: 0,
          max: travMax,
          pas: 1000,
          unite: "€",
          aide: () => `${num(0).format(sc.travaux / b.surface)} €/m²` +
            (b.travauxFourchette ? ` · fourchette étude ${kEur(b.travauxFourchette[0])} à ${kEur(b.travauxFourchette[1])}` : ""),
        },
      ],
    },
    {
      titre: "Location",
      mode: true,
      champs: [...location, { k: "vacancePct", label: "Vacance locative", min: 0, max: 25, pas: 1, unite: "%" }],
      note: loc.note,
    },
    {
      titre: "Charges propriétaire (par an)",
      champs: [
        { k: "chargesCopro", label: "Charges de copropriété", min: 0, max: arr(Math.max(d.chargesCopro * 3, 3000), 100), pas: 50, unite: "€" },
        { k: "taxeFonciere", label: "Taxe foncière", min: 0, max: arr(Math.max(d.taxeFonciere * 4, 2500), 100), pas: 10, unite: "€" },
        { k: "assurancePNO", label: "Assurance PNO", min: 0, max: 800, pas: 10, unite: "€" },
        { k: "entretienPct", label: "Entretien courant", min: 0, max: 10, pas: 0.5, unite: "% loyers" },
        { k: "gestionPct", label: "Gestion locative", min: 0, max: 10, pas: 0.5, unite: "% loyers" },
      ],
    },
    {
      titre: "Financement",
      champs: [
        { k: "apport", label: "Apport", min: 0, max: 300000, pas: 5000, unite: "€" },
        { k: "taux", label: "Taux du crédit", min: 0, max: 7, pas: 0.05, unite: "%" },
        { k: "duree", label: "Durée", min: 5, max: 30, pas: 1, unite: "ans" },
        { k: "assuranceEmprunteurPct", label: "Assurance emprunteur", min: 0, max: 0.8, pas: 0.01, unite: "%/an" },
      ],
    },
  ];
}

const decimales = (pas) => (String(pas).split(".")[1] ?? "").length;

// ---------- Rendering ----------

const $ = (sel) => document.querySelector(sel);

function el(tag, attrs = {}, ...enfants) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? "" : v);
  }
  for (const e of enfants.flat()) if (e !== null && e !== undefined) n.append(e);
  return n;
}

let aides = [];

function rendreControles() {
  const racine = $("#controles");
  racine.replaceChildren();
  aides = [];

  for (const g of champs(bien, s)) {
    const fs = el("fieldset", {}, el("legend", {}, g.titre));

    if (g.mode) {
      const sel = el(
        "select",
        { id: "mode", onchange: (e) => changerMode(e.target.value) },
        Object.entries(bien.locations).map(([k, l]) => el("option", { value: k, selected: k === s.mode }, l.label)),
      );
      fs.append(el("div", { class: "ligne" }, el("label", { for: "mode" }, "Type de location"), sel));
    }

    for (const c of g.champs) fs.append(rendreChamp(c));
    if (g.note) fs.append(el("p", { class: "note" }, g.note));
    racine.append(fs);
  }

  racine.append(rendreFiscalite(), rendreRisques());
}

function rendreChamp(c) {
  const id = `c-${c.k}`;
  const d = decimales(c.pas);
  const listId = c.reperes ? `${id}-reperes` : undefined;

  const range = el("input", { type: "range", id, min: c.min, max: c.max, step: c.pas, value: s[c.k], list: listId, "aria-describedby": c.aide ? `${id}-aide` : undefined });
  const nombre = el("input", { type: "number", min: c.min, step: c.pas, value: s[c.k].toFixed(d), "aria-label": c.label, inputmode: "decimal" });

  const maj = (v, source) => {
    if (!Number.isFinite(v)) return;
    s[c.k] = v;
    if (source !== range) range.value = v;
    if (source !== nombre) nombre.value = v.toFixed(d);
    rafraichir();
  };
  range.addEventListener("input", () => maj(Number(range.value), range));
  nombre.addEventListener("input", () => maj(Number(nombre.value), nombre));

  const ligne = el(
    "div",
    { class: "champ" },
    el("div", { class: "ligne" }, el("label", { for: id }, c.label), el("span", { class: "saisie" }, nombre, el("span", { class: "unite" }, c.unite))),
    range,
  );
  if (listId) ligne.append(el("datalist", { id: listId }, c.reperes.filter(Boolean).map((v) => el("option", { value: v }))));
  if (c.aide) {
    const p = el("p", { class: "aide", id: `${id}-aide` });
    aides.push(() => (p.textContent = c.aide()));
    ligne.append(p);
  }
  return ligne;
}

function rendreFiscalite() {
  const fs = el("fieldset", {}, el("legend", {}, "Fiscalité (pour le net-net)"));
  const meuble = bien.locations[s.mode].meuble;
  fs.append(
    el(
      "div",
      { class: "ligne" },
      el("label", { for: "regime" }, "Régime"),
      el(
        "select",
        { id: "regime", onchange: (e) => { s.regime = e.target.value; rafraichir(); } },
        Object.entries(REGIMES)
          .filter(([, r]) => r.meuble === meuble)
          .map(([k, r]) => el("option", { value: k, selected: k === s.regime }, r.label)),
      ),
    ),
    el(
      "div",
      { class: "ligne" },
      el("label", { for: "tmi" }, "Tranche marginale d'imposition"),
      el(
        "select",
        { id: "tmi", onchange: (e) => { s.tmi = Number(e.target.value); rafraichir(); } },
        [0, 11, 30, 41, 45].map((t) => el("option", { value: t, selected: t === s.tmi }, `${t} %`)),
      ),
    ),
    rendreChamp({ k: "prelevementsSociauxPct", label: "Prélèvements sociaux", min: 0, max: 20, pas: 0.1, unite: "%" }),
    el("p", { class: "note" }, "Année type, hors déficit foncier ou report : les travaux ne sont pas déduits en réel foncier, ils sont amortis sur 15 ans en LMNP réel."),
  );
  return fs;
}

function rendreRisques() {
  const fs = el("fieldset", {}, el("legend", {}, "Facteurs de risque"));
  if (!bien.risques?.length) return fs;
  for (const r of bien.risques) {
    const id = `r-${r.id}`;
    const cb = el("input", {
      type: "checkbox",
      id,
      checked: s.risques.includes(r.id),
      onchange: (e) => {
        s.risques = e.target.checked ? [...s.risques, r.id] : s.risques.filter((x) => x !== r.id);
        rafraichir();
      },
    });
    fs.append(
      el("div", { class: "risque" }, cb, el("label", { for: id }, el("strong", {}, r.label), el("span", {}, `${r.description} `), el("em", {}, decrireEffets(r.effets)))),
    );
  }
  return fs;
}

function decrireEffets(e) {
  const parts = [];
  if (e.loyerPct) parts.push(`loyer ${e.loyerPct > 0 ? "+" : ""}${e.loyerPct} %`);
  if (e.vacancePts) parts.push(`vacance +${e.vacancePts} pts`);
  if (e.provisionAn) parts.push(`provision ${eur.format(e.provisionAn)}/an`);
  if (e.taxeFonciereAjout) parts.push(`taxe foncière +${eur.format(e.taxeFonciereAjout)}`);
  if (e.travauxPct) parts.push(`travaux +${e.travauxPct} %`);
  return `(${parts.join(", ")})`;
}

function tuile(titre, valeur, sous, ton) {
  return el("div", { class: `tuile ${ton ?? ""}` }, el("div", { class: "tuile-titre" }, titre), el("div", { class: "tuile-valeur" }, valeur), el("div", { class: "tuile-sous" }, sous));
}

function table(titre, lignes) {
  return el(
    "table",
    {},
    el("caption", {}, titre),
    el(
      "tbody",
      {},
      lignes.map(([l, v, cls]) => el("tr", { class: cls ?? "" }, el("th", { scope: "row" }, l), el("td", {}, v))),
    ),
  );
}

function rendreResultats() {
  const r = calculer(bien, s);
  const cf = r.cashFlowApresImpot;
  const signe = (x) => (x > 0 ? "+" : "") + eur.format(x);

  $("#kpis").replaceChildren(
    tuile("Rendement brut", fmtPct(r.rendementBrut), `${eur.format(r.loyersTheoriques)} / an sur ${eur.format(r.coutTotal)}`),
    tuile("Rendement net", fmtPct(r.rendementNet), "après vacance et charges"),
    tuile("Rendement net-net", fmtPct(r.rendementNetNet), `après impôt (${eur.format(r.impot)}/an)`),
    tuile("Cash-flow mensuel", signe(cf), `après impôt · ${signe(r.cashFlowAvantImpot)} avant`, cf >= 0 ? "positif" : "negatif"),
  );

  $("#alertes").replaceChildren(...r.alertes.map((a) => el("p", { class: "alerte", role: "status" }, a)));

  const ch = r.charges;
  $("#details").replaceChildren(
    table("Opération", [
      ["Prix d'achat", eur.format(s.prix)],
      [`Frais de notaire (${fmtPct(s.notairePct, 1)})`, eur.format(r.notaire)],
      [`Travaux${r.travaux !== s.travaux ? " (avec dépassement)" : ""}`, eur.format(r.travaux)],
      ["Coût total", eur.format(r.coutTotal), "total"],
      ...(bien.valeurRenovee
        ? [
            ["Valeur rénovée estimée", eur.format(bien.valeurRenovee)],
            ["Écart valeur − coût", signe(r.plusValueLatente), r.plusValueLatente >= 0 ? "positif" : "negatif"],
          ]
        : []),
    ]),
    table("Compte annuel", [
      [`Loyers théoriques (${eur.format(r.loyerMensuel)}/mois)`, eur.format(r.loyersTheoriques)],
      [`Vacance (${fmtPct(r.vacancePct, 0)})`, `−${eur.format(r.loyersTheoriques - r.loyersEncaisses)}`],
      ["Loyers encaissés", eur.format(r.loyersEncaisses), "total"],
      ["Charges de copropriété", `−${eur.format(ch.copro)}`],
      ["Taxe foncière", `−${eur.format(ch.taxeFonciere)}`],
      ["Assurance PNO", `−${eur.format(ch.assurancePNO)}`],
      ["Entretien", `−${eur.format(ch.entretien)}`],
      ...(ch.gestion ? [["Gestion locative", `−${eur.format(ch.gestion)}`]] : []),
      ...(ch.provisionRisques ? [["Provision gros travaux copro", `−${eur.format(ch.provisionRisques)}`]] : []),
      ["Revenu net de charges", eur.format(r.revenuNet), "total"],
      ["Crédit (mensualités + assurance)", `−${eur.format(r.annuites)}`],
      [`Impôt + prélèvements sociaux (${REGIMES[s.regime].label})`, `−${eur.format(r.impot)}`],
      ["Cash-flow annuel", signe(cf * 12), cf >= 0 ? "total positif" : "total negatif"],
    ]),
    table("Crédit", [
      ["Montant emprunté", eur.format(r.emprunt)],
      [`Mensualité (${s.duree} ans à ${fmtPct(s.taux)})`, eur.format(r.mensualite)],
      ["Assurance emprunteur / mois", eur.format(r.assuranceEmprunteur / 12)],
      ["Intérêts année 1", eur.format(r.interets)],
      ["Base imposable année 1", eur.format(r.baseImposable)],
    ]),
  );
}

// ---------- State, URL ----------

function rafraichir() {
  for (const a of aides) a();
  rendreResultats();
  ecrireUrl();
}

function changerMode(mode) {
  const garde = { ...s };
  s = scenarioParDefaut(bien, mode);
  // Keep everything not tied to the rental type.
  for (const k of ["prix", "notairePct", "travaux", "chargesCopro", "taxeFonciere", "assurancePNO", "entretienPct", "gestionPct", "apport", "taux", "duree", "assuranceEmprunteurPct", "tmi", "prelevementsSociauxPct", "risques"]) s[k] = garde[k];
  s.regime = regimeParDefaut(bien, mode);
  rendreControles();
  rafraichir();
}

function ecrireUrl() {
  const ref = scenarioParDefaut(bien, s.mode);
  const p = new URLSearchParams();
  if (s.mode !== bien.defauts.mode) p.set("mode", s.mode);
  for (const [k, v] of Object.entries(s)) {
    if (k === "mode" || k === "risques") continue;
    if (v !== ref[k]) p.set(k, v);
  }
  if (s.risques.length) p.set("risques", s.risques.join(","));
  const hash = p.toString();
  history.replaceState(null, "", hash ? `#${hash}` : location.pathname + location.search);
}

function lireUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  const mode = bien.locations[p.get("mode")] ? p.get("mode") : bien.defauts.mode;
  const sc = scenarioParDefaut(bien, mode);
  for (const [k, v] of p) {
    if (k === "mode") continue;
    if (k === "risques") sc.risques = v.split(",").filter((id) => bien.risques?.some((r) => r.id === id));
    else if (k === "regime") { if (REGIMES[v]) sc.regime = v; }
    else if (typeof sc[k] === "number" && Number.isFinite(Number(v))) sc[k] = Number(v);
  }
  return sc;
}

async function demarrer() {
  const id = new URLSearchParams(location.search).get("bien") ?? BIEN_PAR_DEFAUT;
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Identifiant de bien invalide : ${id}`);
  const rep = await fetch(`biens/${id}.json`);
  if (!rep.ok) throw new Error(`Bien introuvable : biens/${id}.json`);
  bien = await rep.json();

  document.title = `Simulation · ${bien.titre}`;
  $("#titre").textContent = bien.titre;
  $("#meta").textContent = [
    bien.adresse,
    `${num(2).format(bien.surface)} m²${bien.terrasse ? ` + terrasse ${bien.terrasse} m²` : ""}`,
    bien.dpe && `DPE ${bien.dpe}`,
    `affiché ${eur.format(bien.prixAffiche)}`,
  ].filter(Boolean).join(" · ");
  $("#source").textContent = bien.source ?? "";

  s = lireUrl();
  rendreControles();
  rafraichir();

  $("#reinit").addEventListener("click", () => {
    s = scenarioParDefaut(bien);
    rendreControles();
    rafraichir();
  });
  $("#partager").addEventListener("click", async () => {
    const b = $("#partager");
    try {
      await navigator.clipboard.writeText(location.href);
      b.textContent = "Lien copié";
    } catch {
      b.textContent = "Copiez l'adresse de la page";
    }
    setTimeout(() => (b.textContent = "Copier le lien du scénario"), 2000);
  });
}

demarrer().catch((e) => {
  $("#kpis").replaceChildren(el("p", { class: "alerte" }, e.message));
});
