import { REGIMES, calculer, regimeParDefaut, scenarioParDefaut } from "./calc.js";
import { cascade, sensibilitePrix, tornado } from "./charts.js";
import { GLOSSAIRE } from "./glossaire.js";
import { VERSION } from "./version.js";

const BIEN_PAR_DEFAUT = "le-cannet-gr876";
const ACQUEREUR_PAR_DEFAUT = "sci-flv";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const num = (d) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtPct = (x, d = 2) => `${num(d).format(x)} %`;
const kEur = (x) => `${num(0).format(x / 1000)} k€`;

let bien;
let acquereur = null;
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
let nInfos = 0;

// "i" button opening a short explanation (native popover: click, keyboard, Esc and outside click close it).
function info(cle) {
  const g = GLOSSAIRE[cle];
  if (!g) return null;
  const id = `info-${++nInfos}`;
  const bulle = el("div", { id, popover: "auto", class: "info-bulle", role: "tooltip" }, el("strong", {}, g.titre), el("p", {}, g.texte));
  const bouton = el("button", { type: "button", class: "info", popovertarget: id, "aria-label": `Explication : ${g.titre}` }, "i");
  bulle.addEventListener("toggle", (e) => {
    if (e.newState !== "open") return;
    const b = bouton.getBoundingClientRect();
    const larg = bulle.offsetWidth;
    const gauche = Math.min(Math.max(8, b.left + b.width / 2 - larg / 2), innerWidth - larg - 8);
    const bas = b.bottom + 6 + bulle.offsetHeight > innerHeight;
    bulle.style.left = `${gauche}px`;
    bulle.style.top = `${bas ? Math.max(8, b.top - 6 - bulle.offsetHeight) : b.bottom + 6}px`;
  });
  return el("span", { class: "info-ancre" }, bouton, bulle);
}

// Label text followed by its "i" button when the glossary explains it.
const etiquette = (texte, cle) => el("span", { class: "etiquette" }, texte, info(cle));

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
    el("div", { class: "ligne" }, el("label", { for: id }, etiquette(c.label, c.k)), el("span", { class: "saisie" }, nombre, el("span", { class: "unite" }, c.unite))),
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
      el("label", { for: "regime" }, etiquette("Régime", "regime")),
      el(
        "select",
        { id: "regime", onchange: (e) => { s.regime = e.target.value; rendreControles(); rafraichir(); } },
        Object.entries(REGIMES)
          .filter(([, r]) => r.meuble === null || r.meuble === meuble)
          .map(([k, r]) => el("option", { value: k, selected: k === s.regime }, r.label)),
      ),
    ),
    el(
      "div",
      { class: "ligne" },
      el("label", { for: "tmi" }, etiquette("Tranche marginale d'imposition", "tmi")),
      el(
        "select",
        { id: "tmi", onchange: (e) => { s.tmi = Number(e.target.value); rafraichir(); } },
        [0, 11, 30, 41, 45].map((t) => el("option", { value: t, selected: t === s.tmi }, `${t} %`)),
      ),
    ),
    rendreChamp({ k: "prelevementsSociauxPct", label: "Prélèvements sociaux", min: 0, max: 20, pas: 0.1, unite: "%" }),
    ...(s.regime === "sci-ir"
      ? [
          el("div", { class: "ligne" }, el("span", {}, "Associés"), el("span", { class: "fixe" }, `${s.associes} (parts égales)`)),
          rendreChamp({ k: "autresRevenusFonciers", label: "Autres revenus fonciers nets de la SCI", min: 0, max: 30000, pas: 100, unite: "€/an" }),
        ]
      : []),
    el(
      "details",
      { class: "repli" },
      el("summary", {}, "Hypothèses et limites du calcul"),
      s.regime === "sci-ir"
        ? el("p", { class: "note" }, `${acquereur?.note ?? ""} Un déficit foncier du nouveau bien s'impute d'abord sur ces revenus (économie d'impôt). L'imputation sur le revenu global (10 700 €) n'est pas modélisée. Micro-foncier exclu : il ne s'applique pas aux associés qui ne détiennent que des parts de SCI.`)
        : null,
      el("p", { class: "note" }, "Année type, hors déficit foncier ou report : les travaux ne sont pas déduits en réel foncier, ils sont amortis sur 15 ans en LMNP réel."),
    ),
  );
  return fs;
}

function rendreRisques() {
  const fs = el("fieldset", {}, el("legend", {}, etiquette("Facteurs de risque", "risques")));
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

function tuile(titre, cle, valeur, sous, ton) {
  return el("div", { class: `tuile ${ton ?? ""}` }, el("div", { class: "tuile-titre" }, etiquette(titre, cle)), el("div", { class: "tuile-valeur" }, valeur), el("div", { class: "tuile-sous" }, sous));
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

function rendreGraphiques(r) {
  const prix = champs(bien, s)[0].champs.find((c) => c.k === "prix");
  sensibilitePrix($("#g-sensibilite"), bien, s, prix);
  cascade($("#g-cascade"), r);
  const k = (n) => `${Math.round(n / 1000)} k€`;
  tornado($("#g-tornado"), bien, s, [
    { k: "prix", label: "Prix d'achat", fmt: k },
    { k: "travaux", label: "Travaux", fmt: k },
    s.mode === "coloc"
      ? { k: "loyerParChambre", label: "Loyer / chambre", fmt: (v) => `${Math.round(v)} €` }
      : { k: "loyer", label: "Loyer", fmt: (v) => `${Math.round(v)} €` },
    { k: "taux", label: "Taux du crédit", fmt: (v) => `${num(2).format(v)} %` },
    { k: "chargesCopro", label: "Charges copro", fmt: (v) => `${Math.round(v)} €` },
    { k: "taxeFonciere", label: "Taxe foncière", fmt: (v) => `${Math.round(v)} €` },
  ]);
  for (const [sel, cle] of [["#g-sensibilite", "sensibilite"], ["#g-tornado", "tornado"], ["#g-cascade", "cascade"]])
    for (const cap of document.querySelectorAll(`${sel} figcaption`)) cap.append(info(cle));
}

function rendreResultats() {
  const r = calculer(bien, s);
  rendreGraphiques(r);
  const cf = r.cashFlowApresImpot;
  const signe = (x) => (x > 0 ? "+" : "") + eur.format(x);

  $("#kpis").replaceChildren(
    tuile("Rendement brut", "rendementBrut", fmtPct(r.rendementBrut), `${eur.format(r.loyersTheoriques)} / an sur ${eur.format(r.coutTotal)}`),
    tuile("Rendement net", "rendementNet", fmtPct(r.rendementNet), "après vacance et charges"),
    tuile("Rendement net-net", "rendementNetNet", fmtPct(r.rendementNetNet), r.impot < 0 ? `économie d'impôt ${eur.format(-r.impot)}/an (déficit foncier)` : `après impôt (${eur.format(r.impot)}/an)`),
    tuile("Cash-flow mensuel", "cashFlow", signe(cf), `après impôt · ${signe(r.cashFlowAvantImpot)} avant` + (r.associes > 1 ? ` · ${signe(cf / r.associes)} par associé` : ""), cf >= 0 ? "positif" : "negatif"),
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
      r.impot < 0
        ? [`Économie d'impôt, déficit imputé (${REGIMES[s.regime].label})`, `+${eur.format(-r.impot)}`]
        : [`Impôt + prélèvements sociaux (${REGIMES[s.regime].label})`, `−${eur.format(r.impot)}`],
      ["Cash-flow annuel", signe(cf * 12), cf >= 0 ? "total positif" : "total negatif"],
    ]),
    table("Crédit", [
      ["Montant emprunté", eur.format(r.emprunt)],
      [`Mensualité (${s.duree} ans à ${fmtPct(s.taux)})`, eur.format(r.mensualite)],
      ["Assurance emprunteur / mois", eur.format(r.assuranceEmprunteur / 12)],
      ["Intérêts année 1", eur.format(r.interets)],
      r.deficit > 0 ? ["Déficit foncier année 1", eur.format(r.deficit)] : ["Base imposable année 1", eur.format(r.baseImposable)],
    ]),
    ...(r.associes > 1
      ? [
          table(`Par associé (1/${r.associes})`, [
            ["Apport", eur.format(s.apport / r.associes)],
            ["Mensualité de crédit", eur.format((r.mensualite + r.assuranceEmprunteur / 12) / r.associes)],
            [r.impot < 0 ? "Économie d'impôt / an" : "Impôt / an", eur.format(Math.abs(r.impot) / r.associes)],
            ["Cash-flow mensuel", signe(cf / r.associes), cf >= 0 ? "total positif" : "total negatif"],
          ]),
        ]
      : []),
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
  s = scenarioParDefaut(bien, mode, acquereur);
  // Keep everything not tied to the rental type.
  for (const k of ["prix", "notairePct", "travaux", "chargesCopro", "taxeFonciere", "assurancePNO", "entretienPct", "gestionPct", "apport", "taux", "duree", "assuranceEmprunteurPct", "tmi", "prelevementsSociauxPct", "associes", "autresRevenusFonciers", "regime", "risques"]) s[k] = garde[k];
  s.regime = regimeParDefaut(bien, mode, acquereur);
  rendreControles();
  rafraichir();
}

function ecrireUrl() {
  const ref = scenarioParDefaut(bien, s.mode, acquereur);
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
  const sc = scenarioParDefaut(bien, mode, acquereur);
  for (const [k, v] of p) {
    if (k === "mode" || k === "associes") continue; // partners are fixed by the buyer's data
    if (k === "risques") sc.risques = v.split(",").filter((id) => bien.risques?.some((r) => r.id === id));
    else if (k === "regime") { if (REGIMES[v]) sc.regime = v; }
    else if (typeof sc[k] === "number" && Number.isFinite(Number(v))) sc[k] = Number(v);
  }
  return sc;
}

async function demarrer() {
  $("#version").textContent = `v${VERSION}`;
  const logo = $("#logo");
  const sansLogo = () => { logo.hidden = true; $("#logo-texte").hidden = false; };
  if (logo.complete && logo.naturalWidth === 0) sansLogo();
  else logo.addEventListener("error", sansLogo);

  const id = new URLSearchParams(location.search).get("bien") ?? BIEN_PAR_DEFAUT;
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Identifiant de bien invalide : ${id}`);
  const rep = await fetch(`biens/${id}.json`);
  if (!rep.ok) throw new Error(`Bien introuvable : biens/${id}.json`);
  bien = await rep.json();

  const idAcq = new URLSearchParams(location.search).get("acquereur") ?? ACQUEREUR_PAR_DEFAUT;
  if (idAcq !== "aucun") {
    if (!/^[a-z0-9-]+$/.test(idAcq)) throw new Error(`Identifiant d'acquéreur invalide : ${idAcq}`);
    const ra = await fetch(`acquereurs/${idAcq}.json`);
    if (!ra.ok) throw new Error(`Acquéreur introuvable : acquereurs/${idAcq}.json`);
    acquereur = await ra.json();
  }

  document.title = `Simulation · ${bien.titre}`;
  $("#titre").textContent = bien.titre;
  $("#meta").textContent = [
    bien.adresse,
    `${num(2).format(bien.surface)} m²${bien.terrasse ? ` + terrasse ${bien.terrasse} m²` : ""}`,
    bien.dpe && `DPE ${bien.dpe}`,
    `affiché ${eur.format(bien.prixAffiche)}`,
    acquereur && `acquéreur : ${acquereur.nom}`,
  ].filter(Boolean).join(" · ");
  $("#source").textContent = bien.source ?? "";

  s = lireUrl();
  rendreControles();
  rafraichir();

  let attente;
  new ResizeObserver(() => {
    clearTimeout(attente);
    attente = setTimeout(() => rendreGraphiques(calculer(bien, s)), 100);
  }).observe($("#graphiques"));

  $("#reinit").addEventListener("click", () => {
    s = scenarioParDefaut(bien, bien.defauts.mode, acquereur);
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
    setTimeout(() => (b.textContent = "Copier le lien"), 2000);
  });
}

demarrer().catch((e) => {
  $("#kpis").replaceChildren(el("p", { class: "alerte" }, e.message));
});
