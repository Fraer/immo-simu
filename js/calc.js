// Pure profitability model. No DOM here, so it can be tested with node.

export const REGIMES = {
  "micro-foncier": { label: "Micro-foncier (abattement 30 %)", meuble: false, plafond: 15000 },
  "reel-foncier": { label: "Réel foncier", meuble: false },
  "micro-bic": { label: "LMNP micro-BIC (abattement 50 %)", meuble: true, plafond: 77700 },
  "lmnp-reel": { label: "LMNP réel (amortissements)", meuble: true },
};

// Amortization periods used for LMNP réel (simplified, furniture ignored).
const PART_BATI = 0.85;
const DUREE_AMORT_BATI = 30;
const DUREE_AMORT_TRAVAUX = 15;

export function regimeParDefaut(bien, mode) {
  return bien.locations[mode].meuble ? "lmnp-reel" : "reel-foncier";
}

export function scenarioParDefaut(bien, mode = bien.defauts.mode) {
  const loc = bien.locations[mode];
  return {
    ...bien.defauts,
    mode,
    loyer: loc.loyer ?? 0,
    loyerParChambre: loc.loyerParChambre ?? 0,
    chambres: loc.chambres ?? 0,
    vacancePct: loc.vacancePct,
    regime: regimeParDefaut(bien, mode),
    risques: [],
  };
}

export function mensualite(capital, tauxAnnuelPct, dureeAns) {
  const n = dureeAns * 12;
  if (capital <= 0 || n <= 0) return 0;
  const r = tauxAnnuelPct / 100 / 12;
  if (r === 0) return capital / n;
  return (capital * r) / (1 - Math.pow(1 + r, -n));
}

// Interest paid during the first 12 months.
export function interetsAnnee1(capital, tauxAnnuelPct, dureeAns) {
  const m = mensualite(capital, tauxAnnuelPct, dureeAns);
  const r = tauxAnnuelPct / 100 / 12;
  let restant = capital;
  let interets = 0;
  for (let i = 0; i < Math.min(12, dureeAns * 12); i++) {
    const it = restant * r;
    interets += it;
    restant -= m - it;
  }
  return interets;
}

function effetsRisques(bien, ids) {
  const total = { loyerPct: 0, vacancePts: 0, provisionAn: 0, taxeFonciereAjout: 0, travauxPct: 0 };
  for (const r of bien.risques ?? []) {
    if (!ids.includes(r.id)) continue;
    for (const [k, v] of Object.entries(r.effets)) total[k] = (total[k] ?? 0) + v;
  }
  return total;
}

export function calculer(bien, s) {
  const eff = effetsRisques(bien, s.risques ?? []);

  // Acquisition
  const notaire = (s.prix * s.notairePct) / 100;
  const travaux = s.travaux * (1 + eff.travauxPct / 100);
  const coutTotal = s.prix + notaire + travaux;

  // Rent
  const loyerMensuelBase = s.mode === "coloc" ? s.loyerParChambre * s.chambres : s.loyer;
  const loyerMensuel = loyerMensuelBase * (1 + eff.loyerPct / 100);
  const loyersTheoriques = loyerMensuel * 12;
  const vacancePct = Math.min(100, Math.max(0, s.vacancePct + eff.vacancePts));
  const loyersEncaisses = loyersTheoriques * (1 - vacancePct / 100);

  // Owner charges
  const taxeFonciere = s.taxeFonciere + eff.taxeFonciereAjout;
  const gestion = (loyersEncaisses * s.gestionPct) / 100;
  const entretien = (loyersEncaisses * s.entretienPct) / 100;
  const charges = {
    copro: s.chargesCopro,
    taxeFonciere,
    assurancePNO: s.assurancePNO,
    gestion,
    entretien,
    provisionRisques: eff.provisionAn,
  };
  const totalCharges = Object.values(charges).reduce((a, b) => a + b, 0);
  const revenuNet = loyersEncaisses - totalCharges;

  // Financing
  const emprunt = Math.max(0, coutTotal - s.apport);
  const mens = mensualite(emprunt, s.taux, s.duree);
  const assuranceEmprunteur = (emprunt * s.assuranceEmprunteurPct) / 100;
  const annuites = mens * 12 + assuranceEmprunteur;
  const interets = interetsAnnee1(emprunt, s.taux, s.duree);

  // Tax (year 1, steady state; renovation works are not deducted, see README)
  const regime = REGIMES[s.regime];
  let baseImposable;
  switch (s.regime) {
    case "micro-foncier":
      baseImposable = loyersEncaisses * 0.7;
      break;
    case "micro-bic":
      baseImposable = loyersEncaisses * 0.5;
      break;
    case "reel-foncier":
      baseImposable = revenuNet - interets - assuranceEmprunteur;
      break;
    case "lmnp-reel": {
      const amort =
        ((s.prix + notaire) * PART_BATI) / DUREE_AMORT_BATI + travaux / DUREE_AMORT_TRAVAUX;
      baseImposable = revenuNet - interets - assuranceEmprunteur - amort;
      break;
    }
    default:
      baseImposable = 0;
  }
  baseImposable = Math.max(0, baseImposable);
  const impot = (baseImposable * (s.tmi + s.prelevementsSociauxPct)) / 100;

  const alertes = [];
  if (regime?.plafond && loyersEncaisses > regime.plafond)
    alertes.push(`${regime.label} : loyers au-dessus du plafond de ${regime.plafond} €, régime non applicable.`);
  if (regime && regime.meuble !== bien.locations[s.mode].meuble)
    alertes.push(`${regime.label} ne correspond pas au type de location choisi.`);

  const pct = (x) => (coutTotal > 0 ? (x / coutTotal) * 100 : 0);

  return {
    notaire,
    travaux,
    coutTotal,
    loyerMensuel,
    loyersTheoriques,
    vacancePct,
    loyersEncaisses,
    charges,
    totalCharges,
    revenuNet,
    emprunt,
    mensualite: mens,
    assuranceEmprunteur,
    annuites,
    interets,
    baseImposable,
    impot,
    rendementBrut: pct(loyersTheoriques),
    rendementNet: pct(revenuNet),
    rendementNetNet: pct(revenuNet - impot),
    cashFlowAvantImpot: (revenuNet - annuites) / 12,
    cashFlowApresImpot: (revenuNet - annuites - impot) / 12,
    plusValueLatente: (bien.valeurRenovee ?? 0) - coutTotal,
    alertes,
  };
}
