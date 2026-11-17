# immo-simu

Simulateur de rentabilité locative, page statique (HTML + JS, sans build) prévue pour GitHub Pages.

- Curseurs : prix d'achat (±25 % autour du prix affiché), notaire, travaux, loyer (vide, meublé ou par chambre en colocation), vacance, charges, taxe foncière, crédit, fiscalité.
- Résultats en direct : rendement brut, net, net-net, cash-flow mensuel, détail de l'opération et du compte annuel.
- Graphiques : sensibilité du rendement net et du cash-flow au prix, effet de ±20 % sur chaque paramètre (tornado), cascade du loyer au cash-flow.
- Facteurs de risque optionnels (bruit, emplacement, travaux de copro…) définis par bien.
- Le scénario est encodé dans l'URL (`#prix=320000&mode=coloc&risques=bruit`) : copier le lien suffit pour le partager.

## Changer de bien

Les données d'un bien sont dans `biens/<id>.json`. Ajouter un fichier sur le modèle de `biens/le-cannet-gr876.json` puis ouvrir `index.html?bien=<id>`.

## Acquéreur

La fiscalité de l'acheteur est dans `acquereurs/<id>.json` (par défaut `sci-flv` : SCI FLV à l'IR, 3 associés, bien existant loué 690 € + 250 € de cave). Changer avec `?acquereur=<id>`, ou `?acquereur=aucun` pour un achat en nom propre.

En SCI à l'IR, le résultat est calculé au réel foncier puis réparti par associé. Un déficit foncier du nouveau bien s'impute sur les autres revenus fonciers de la SCI (économie d'impôt). L'imputation sur le revenu global n'est pas modélisée.

## Entête

Logo dans `assets/flv-invest-logo.svg` (provisoire, à remplacer par le fichier officiel) (affiché en 40 px de haut, texte « FLV Invest » si absent). Version de l'application (semver) dans `js/version.js`.

## Lancer en local

```bash
python3 -m http.server 8000
```

puis ouvrir http://localhost:8000 (un serveur est nécessaire car la page charge le JSON).

## Tests

```bash
node --test test/calc.test.mjs
```

## Hypothèses de calcul

- Coût total = prix + frais de notaire + travaux.
- Brut = loyers théoriques / coût total. Net = (loyers après vacance − charges propriétaire) / coût total. Net-net = net − impôt.
- Impôt en année type : micro-foncier (30 %), réel foncier (charges + intérêts année 1), LMNP micro-BIC (50 %), LMNP réel (amortissement 85 % du bâti sur 30 ans, travaux sur 15 ans). Le déficit foncier et les reports ne sont pas modélisés.
- Charges de copropriété comptées entièrement à la charge du propriétaire (hypothèse prudente).

Indicatif, pas un conseil fiscal ou financier.
