// Plain-French explanations shown behind the "i" buttons. Keep each one short,
// with a worked example when it helps a non-specialist.
export const GLOSSAIRE = {
  notairePct: {
    titre: "Frais de notaire",
    texte: "Surtout des taxes versées à l'État au moment de l'achat, en plus du prix. Dans l'ancien, comptez 7 à 8 %. Exemple : 339 000 € × 7,5 % ≈ 25 400 €.",
  },
  loyerParChambre: {
    titre: "Loyer par chambre (CC)",
    texte: "Ce que paie chaque colocataire par mois, charges comprises (CC). Exemple : 3 chambres à 790 € = 2 370 € par mois.",
  },
  vacancePct: {
    titre: "Vacance locative",
    texte: "Part de l'année où le logement ne rapporte rien, entre deux locataires. 10 % ≈ 5 semaines sans loyer par an.",
  },
  chargesCopro: {
    titre: "Charges de copropriété",
    texte: "Dépenses de l'immeuble payées par le propriétaire : parties communes, assurance de l'immeuble, petits travaux votés.",
  },
  taxeFonciere: {
    titre: "Taxe foncière",
    texte: "Impôt local payé chaque année par le propriétaire, jamais par le locataire.",
  },
  assurancePNO: {
    titre: "Assurance PNO",
    texte: "Assurance « propriétaire non occupant », obligatoire en copropriété. Elle couvre la SCI (dégât des eaux, responsabilité) que le logement soit loué ou vide.",
  },
  entretienPct: {
    titre: "Entretien courant",
    texte: "Budget pour les petites réparations à la charge du propriétaire (chauffe-eau, robinetterie, électroménager…), en pourcentage des loyers encaissés.",
  },
  gestionPct: {
    titre: "Gestion locative",
    texte: "Frais d'agence si on lui confie la recherche des locataires et l'encaissement des loyers. 0 % si vous gérez vous-mêmes, souvent 6 à 8 % sinon.",
  },
  apport: {
    titre: "Apport",
    texte: "Argent que la SCI met au départ. Le reste du coût total est emprunté. Exemple : coût 439 510 € et apport 65 000 € donnent un emprunt de 374 510 €.",
  },
  taux: {
    titre: "Taux du crédit",
    texte: "Intérêt annuel demandé par la banque, hors assurance. Sur 375 000 € et 25 ans, +0,5 point coûte environ 100 € de plus par mois.",
  },
  duree: {
    titre: "Durée du crédit",
    texte: "Plus le crédit est long, plus la mensualité baisse, mais plus on paie d'intérêts au total.",
  },
  assuranceEmprunteurPct: {
    titre: "Assurance emprunteur",
    texte: "Assurance exigée par la banque (décès, invalidité), en pourcentage du montant emprunté par an. Exemple : 0,30 % de 375 000 € ≈ 94 € par mois.",
  },
  regime: {
    titre: "Régime fiscal",
    texte: "Façon dont les loyers sont imposés. En SCI à l'IR, la SCI ne paie pas d'impôt elle-même : chaque associé déclare sa part du bénéfice (loyers moins charges et intérêts) avec ses propres revenus.",
  },
  tmi: {
    titre: "Tranche marginale d'imposition",
    texte: "Taux d'impôt sur le revenu appliqué à vos derniers euros gagnés. Le bénéfice locatif est taxé à ce taux, plus les prélèvements sociaux.",
  },
  prelevementsSociauxPct: {
    titre: "Prélèvements sociaux",
    texte: "CSG et CRDS : 17,2 % du bénéfice locatif, payés en plus de l'impôt sur le revenu.",
  },
  autresRevenusFonciers: {
    titre: "Autres revenus fonciers et déficit foncier",
    texte: "Bénéfice que la SCI tire déjà de son autre bien. Si le nouveau bien coûte plus qu'il ne rapporte (déficit foncier), cette perte réduit l'impôt dû sur ces autres loyers.",
  },
  risques: {
    titre: "Facteurs de risque",
    texte: "Cochez un risque pour voir ce qu'il change sur les chiffres. Chaque case dégrade une hypothèse : loyer, vacance, charges ou travaux.",
  },
  rendementBrut: {
    titre: "Rendement brut",
    texte: "Loyers d'une année pleine divisés par le coût total (prix + notaire + travaux). Exemple : 28 440 € ÷ 439 510 € = 6,47 %. Aucune dépense n'est déduite.",
  },
  rendementNet: {
    titre: "Rendement net",
    texte: "Comme le brut, mais après les mois sans locataire et les charges (copro, taxe foncière, assurance, entretien). Le crédit n'est pas compté.",
  },
  rendementNetNet: {
    titre: "Rendement net-net",
    texte: "Le net, moins l'impôt et les prélèvements sociaux. C'est ce que le bien rapporte vraiment chaque année, sans compter le crédit.",
  },
  cashFlow: {
    titre: "Cash-flow",
    texte: "Ce qui reste, ou ce qui manque, chaque mois sur le compte de la SCI : loyers encaissés − charges − mensualité du crédit − impôt. Négatif veut dire qu'il faut remettre de l'argent. Exemple : −393 € par mois, soit 131 € à verser par associé. Cet effort n'est pas perdu pour autant : une partie de la mensualité rembourse le capital, donc vous devenez propriétaires petit à petit.",
  },
  sensibilite: {
    titre: "Effet du prix d'achat",
    texte: "Montre comment le résultat change selon le prix payé. Le point est le prix choisi, la bande grise la fourchette d'estimation du marché.",
  },
  tornado: {
    titre: "Ce qui pèse le plus",
    texte: "Chaque barre montre de combien le cash-flow mensuel bouge si on change un seul paramètre de 20 %. Les barres les plus longues sont les points à négocier ou à vérifier en priorité.",
  },
  cascade: {
    titre: "Du loyer au cash-flow",
    texte: "Part des loyers d'une année et retire chaque dépense, une à une, jusqu'au cash-flow final.",
  },
};
