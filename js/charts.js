// Small hand-made SVG charts (no library). Each function redraws into its container.
import { calculer } from "./calc.js";

const NS = "http://www.w3.org/2000/svg";
const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signe = (x) => (x > 0 ? "+" : "") + eur.format(x);
const compact = (x) => {
  const a = Math.abs(x);
  const t = a >= 1000 ? `${pct.format(a / 1000)} k` : `${Math.round(a)}`;
  return (x < 0 ? "−" : "") + t;
};

function s(tag, attrs = {}, texte) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (texte !== undefined) n.textContent = texte;
  return n;
}

function niceTicks(min, max, n = 4) {
  const span = max - min || 1;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= step0);
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

// ---------- Shared tooltip ----------

let tip;
function tooltip() {
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "viz-tip";
    tip.setAttribute("role", "status");
    document.body.append(tip);
  }
  return tip;
}
function montrerTip(evt, lignes) {
  const t = tooltip();
  t.replaceChildren(
    ...lignes.map(([v, l]) => {
      const p = document.createElement("div");
      const b = document.createElement("strong");
      b.textContent = v;
      p.append(b, document.createTextNode(` ${l}`));
      return p;
    }),
  );
  t.style.display = "block";
  const x = Math.min(evt.clientX + 14, window.innerWidth - t.offsetWidth - 8);
  const y = evt.clientY - t.offsetHeight - 12;
  t.style.left = `${x + window.scrollX}px`;
  t.style.top = `${(y < 8 ? evt.clientY + 18 : y) + window.scrollY}px`;
}
function cacherTip() {
  if (tip) tip.style.display = "none";
}

function survol(cible, lignes) {
  cible.addEventListener("pointermove", (e) => montrerTip(e, lignes()));
  cible.addEventListener("pointerleave", cacherTip);
}

// ---------- 1. Sensitivity to purchase price (one small line chart per measure) ----------

export function sensibilitePrix(conteneur, bien, sc, { min, max }) {
  const n = 41;
  const pts = Array.from({ length: n }, (_, i) => {
    const prix = min + ((max - min) * i) / (n - 1);
    const r = calculer(bien, { ...sc, prix });
    return { prix, cf: r.cashFlowApresImpot, net: r.rendementNet };
  });
  const actuel = calculer(bien, sc);

  const figs = [document.createElement("figure"), document.createElement("figure")];
  conteneur.replaceChildren(...figs);
  ligne(figs[0], bien, pts, sc.prix, {
      titre: "Rendement net selon le prix d'achat",
      val: (p) => p.net,
      courant: actuel.rendementNet,
      fmt: (v) => `${pct.format(v)} %`,
      fmtAxe: (v) => `${pct.format(v)} %`,
      zero: false,
    });
  ligne(figs[1], bien, pts, sc.prix, {
      titre: "Cash-flow mensuel selon le prix d'achat",
      val: (p) => p.cf,
      courant: actuel.cashFlowApresImpot,
      fmt: signe,
      fmtAxe: compact,
      zero: true,
    });
}

// Draws into `fig`, which is already in the page so its width can be measured.
function ligne(fig, bien, pts, prixActuel, o) {
  fig.className = "viz";
  const W = Math.max(240, fig.clientWidth - 18);
  const H = 190;
  const m = { t: 12, r: 12, b: 26, l: 48 };
  const vals = pts.map(o.val);
  let lo = Math.min(...vals, o.courant);
  let hi = Math.max(...vals, o.courant);
  if (o.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  const yt = niceTicks(lo, hi);
  lo = Math.min(lo, yt[0]);
  hi = Math.max(hi, yt[yt.length - 1]);
  const x0 = pts[0].prix, x1 = pts[pts.length - 1].prix;
  const X = (v) => m.l + ((v - x0) / (x1 - x0)) * (W - m.l - m.r);
  const Y = (v) => m.t + (1 - (v - lo) / (hi - lo || 1)) * (H - m.t - m.b);

  const cap = document.createElement("figcaption");
  cap.textContent = o.titre;
  const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${o.titre} : ${o.fmt(o.courant)} au prix actuel` });

  const e = bien.estimation;
  if (e && e.haut > x0 && e.bas < x1) {
    const a = X(Math.max(e.bas, x0)), b = X(Math.min(e.haut, x1));
    svg.append(s("rect", { x: a, y: m.t, width: b - a, height: H - m.t - m.b, class: "viz-bande" }));
    svg.append(s("text", { x: (a + b) / 2, y: m.t + 11, class: "viz-note", "text-anchor": "middle" }, "estimation"));
  }
  for (const t of yt) {
    svg.append(s("line", { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), class: t === 0 && o.zero ? "viz-zero" : "viz-grille" }));
    svg.append(s("text", { x: m.l - 6, y: Y(t) + 4, class: "viz-axe", "text-anchor": "end" }, o.fmtAxe(t)));
  }
  for (const t of niceTicks(x0, x1, 4)) {
    svg.append(s("text", { x: X(t), y: H - 8, class: "viz-axe", "text-anchor": "middle" }, `${Math.round(t / 1000)} k€`));
  }
  const d = pts.map((p, i) => `${i ? "L" : "M"}${X(p.prix).toFixed(1)},${Y(o.val(p)).toFixed(1)}`).join("");
  svg.append(s("path", { d, class: "viz-ligne" }));

  // Current scenario marker
  const cx = X(prixActuel), cy = Y(o.courant);
  svg.append(s("line", { x1: cx, x2: cx, y1: m.t, y2: H - m.b, class: "viz-repere" }));
  svg.append(s("circle", { cx, cy, r: 5, class: "viz-point" }));
  const droite = cx > W - 90;
  svg.append(s("text", { x: cx + (droite ? -8 : 8), y: cy - 8, class: "viz-label", "text-anchor": droite ? "end" : "start" }, o.fmt(o.courant)));

  // Hover: crosshair + tooltip
  const croix = s("line", { y1: m.t, y2: H - m.b, class: "viz-croix", visibility: "hidden" });
  const pointH = s("circle", { r: 4, class: "viz-point-h", visibility: "hidden" });
  const zone = s("rect", { x: m.l, y: 0, width: W - m.l - m.r, height: H, fill: "transparent" });
  svg.append(croix, pointH, zone);
  let proche = pts[0];
  zone.addEventListener("pointermove", (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    proche = pts.reduce((a, p) => (Math.abs(X(p.prix) - px) < Math.abs(X(a.prix) - px) ? p : a));
    const x = X(proche.prix);
    croix.setAttribute("x1", x); croix.setAttribute("x2", x); croix.setAttribute("visibility", "visible");
    pointH.setAttribute("cx", x); pointH.setAttribute("cy", Y(o.val(proche))); pointH.setAttribute("visibility", "visible");
  });
  zone.addEventListener("pointerleave", () => { croix.setAttribute("visibility", "hidden"); pointH.setAttribute("visibility", "hidden"); });
  survol(zone, () => [[o.fmt(o.val(proche)), `pour un prix de ${eur.format(Math.round(proche.prix / 1000) * 1000)}`]]);

  fig.replaceChildren(cap, svg);
}

// ---------- 2. Tornado: which parameter moves cash-flow the most ----------

export function tornado(conteneur, bien, sc, parametres, variation = 0.2) {
  const base = calculer(bien, sc).cashFlowApresImpot;
  const lignes = parametres
    .map((p) => {
      const bas = calculer(bien, { ...sc, [p.k]: sc[p.k] * (1 - variation) }).cashFlowApresImpot - base;
      const haut = calculer(bien, { ...sc, [p.k]: sc[p.k] * (1 + variation) }).cashFlowApresImpot - base;
      return { ...p, bas, haut, ampleur: Math.abs(haut - bas) };
    })
    .filter((l) => l.ampleur > 0.5)
    .sort((a, b) => b.ampleur - a.ampleur);

  const W = Math.max(280, conteneur.clientWidth - 18);
  const rang = 30;
  const m = { t: 8, r: 12, b: 8, l: 118 };
  const H = m.t + m.b + rang * lignes.length;
  const lim = Math.max(1, ...lignes.flatMap((l) => [Math.abs(l.bas), Math.abs(l.haut)]));
  const large = W > 520;
  const espace = large ? 104 : 60; // room for value labels on each side
  const cx = m.l + (W - m.l - m.r) / 2;
  const demi = (W - m.l - m.r) / 2 - espace;
  const X = (v) => cx + (v / lim) * demi;

  const fig = document.createElement("figure");
  fig.className = "viz";
  const cap = document.createElement("figcaption");
  cap.textContent = `Effet sur le cash-flow mensuel d'une variation de ±${variation * 100} % de chaque paramètre`;
  const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": cap.textContent });

  lignes.forEach((l, i) => {
    const y = m.t + i * rang;
    svg.append(s("text", { x: m.l - 10, y: y + rang / 2 + 4, class: "viz-axe-fort", "text-anchor": "end" }, l.label));
    for (const [delta, sens] of [[l.bas, -1], [l.haut, 1]]) {
      if (Math.abs(delta) < 0.5) continue;
      const a = Math.min(X(0), X(delta)), w = Math.max(2, Math.abs(X(delta) - X(0)));
      const barre = s("rect", { x: a, y: y + 5, width: w, height: rang - 10, rx: 3, class: delta > 0 ? "viz-plus" : "viz-moins" });
      const v = sc[l.k] * (1 + sens * variation);
      survol(barre, () => [
        [`${signe(delta)}/mois`, `si ${l.label.toLowerCase()} ${sens < 0 ? "−" : "+"}${variation * 100} % (${l.fmt(v)})`],
        [signe(base + delta), "cash-flow mensuel obtenu"],
      ]);
      svg.append(barre);
      const tx = delta > 0 ? X(delta) + 5 : X(delta) - 5;
      svg.append(s("text", { x: tx, y: y + rang / 2 + 4, class: "viz-label", "text-anchor": delta > 0 ? "start" : "end" }, large ? `${signe(delta)} (${sens < 0 ? "−" : "+"}${variation * 100} %)` : signe(delta)));
    }
  });
  svg.append(s("line", { x1: cx, x2: cx, y1: m.t - 4, y2: H - m.b + 4, class: "viz-zero" }));

  const leg = document.createElement("p");
  leg.className = "viz-legende";
  leg.innerHTML = '<span class="pastille viz-plus"></span>améliore <span class="pastille viz-moins"></span>dégrade';
  fig.append(cap, svg, leg);
  conteneur.replaceChildren(fig);
}

// ---------- 3. Waterfall of the yearly account ----------

export function cascade(conteneur, r) {
  const ch = r.charges;
  const autres = ch.assurancePNO + ch.entretien + ch.gestion + ch.provisionRisques;
  const etapes = [
    { label: "Loyers", court: "Loyers", detail: "loyers théoriques", v: r.loyersTheoriques },
    { label: "Vacance", court: "Vac.", detail: "vacance locative", v: -(r.loyersTheoriques - r.loyersEncaisses) },
    { label: "Copro", court: "Copro", detail: "charges de copropriété", v: -ch.copro },
    { label: "Taxe f.", court: "TF", detail: "taxe foncière", v: -ch.taxeFonciere },
    { label: "Autres", court: "Autres", detail: "assurance, entretien, gestion, provisions", v: -autres },
    { label: "Crédit", court: "Crédit", detail: "mensualités et assurance emprunteur", v: -r.annuites },
    { label: "Impôt", court: "Impôt", detail: r.impot < 0 ? "économie d'impôt (déficit foncier)" : "impôt et prélèvements sociaux", v: -r.impot },
  ].filter((e) => Math.abs(e.v) >= 1);

  let cumul = 0;
  const barres = etapes.map((e) => {
    const de = cumul;
    cumul += e.v;
    return { ...e, de, a: cumul };
  });
  barres.push({ label: "Cash-flow", court: "CF", detail: "cash-flow annuel", v: cumul, de: 0, a: cumul, total: true });

  const W = Math.max(280, conteneur.clientWidth - 18);
  const H = 230;
  const m = { t: 20, r: 8, b: 26, l: 46 };
  let lo = Math.min(0, ...barres.map((b) => Math.min(b.de, b.a)));
  let hi = Math.max(0, ...barres.map((b) => Math.max(b.de, b.a)));
  // Headroom so value labels fit above and below the bars.
  const marge = (hi - lo) * 0.08;
  if (lo < 0) lo -= marge;
  hi += marge;
  const yt = niceTicks(lo, hi);
  lo = Math.min(lo, yt[0]);
  hi = Math.max(hi, yt[yt.length - 1]);
  const Y = (v) => m.t + (1 - (v - lo) / (hi - lo || 1)) * (H - m.t - m.b);
  const pas = (W - m.l - m.r) / barres.length;
  const larg = Math.min(48, pas - 6);

  const fig = document.createElement("figure");
  fig.className = "viz";
  const cap = document.createElement("figcaption");
  cap.textContent = "Du loyer au cash-flow, sur un an";
  const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${cap.textContent} : cash-flow annuel ${signe(cumul)}` });

  for (const t of yt) {
    svg.append(s("line", { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), class: t === 0 ? "viz-zero" : "viz-grille" }));
    svg.append(s("text", { x: m.l - 6, y: Y(t) + 4, class: "viz-axe", "text-anchor": "end" }, compact(t)));
  }
  barres.forEach((b, i) => {
    const x = m.l + i * pas + (pas - larg) / 2;
    const y = Y(Math.max(b.de, b.a));
    const h = Math.max(2, Math.abs(Y(b.de) - Y(b.a)));
    const cls = b.total ? "viz-total" : b.v > 0 ? "viz-plus" : "viz-moins";
    const rect = s("rect", { x, y, width: larg, height: h, rx: 3, class: cls });
    survol(rect, () => [[`${signe(b.v)}/an`, b.detail]]);
    svg.append(rect);
    if (i < barres.length - 1) {
      svg.append(s("line", { x1: x + larg, x2: x + pas, y1: Y(b.a), y2: Y(b.a), class: "viz-liaison" }));
    }
    const ly = b.v >= 0 ? y - 5 : y + h + 12;
    const txt = (b.v > 0 && !b.total ? "+" : "") + compact(b.v);
    svg.append(s("text", { x: x + larg / 2, y: ly, class: "viz-label", "text-anchor": "middle" }, txt));
    svg.append(s("text", { x: x + larg / 2, y: H - 8, class: b.total ? "viz-axe-fort" : "viz-axe", "text-anchor": "middle" }, pas < 52 ? b.court : b.label));
  });

  const leg = document.createElement("p");
  leg.className = "viz-legende";
  leg.innerHTML = '<span class="pastille viz-plus"></span>entrée <span class="pastille viz-moins"></span>sortie <span class="pastille viz-total"></span>résultat';
  fig.append(cap, svg, leg);
  conteneur.replaceChildren(fig);
}
