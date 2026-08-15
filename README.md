# ExpenseTracker (iPhone)

Squelette d'une application iPhone (SwiftUI, iOS 17+) pour organiser les dépenses. Le design sera fait ultérieurement — cette étape pose seulement l'architecture et les stubs de fonctionnalités.

## Fonctionnalités prévues

- Tableau de bord (dashboard) avec solde, dépenses du mois, graphiques
- Transactions (ajout / édition / suppression / recherche / filtres)
- Comptes multiples (courant, épargne, cash, carte, crypto)
- Catégories et sous-catégories personnalisables avec icônes/couleurs
- Budgets mensuels / hebdomadaires / par catégorie
- Objectifs d'épargne (goals) avec progression
- Dépenses récurrentes (abonnements) et rappels
- Rapports & statistiques (camemberts, barres, tendances)
- Multi-devises + taux de change
- Import/export CSV, sauvegarde iCloud
- Scan de reçus (OCR VisionKit) — stub
- Authentification biométrique (Face ID / Touch ID)
- Notifications locales (rappels de budget, factures)
- Widgets iOS + Apple Watch — placeholders
- Mode sombre, localisation FR/EN
- Onboarding

## Architecture

MVVM + SwiftData pour la persistance.

```
ExpenseTracker/
├── ExpenseTrackerApp.swift        # Entrée
├── AppRouter.swift                 # Navigation racine (TabView)
├── Models/                         # @Model SwiftData
├── ViewModels/                     # ObservableObject / @Observable
├── Views/                          # Écrans par feature
│   ├── Dashboard/
│   ├── Transactions/
│   ├── Budgets/
│   ├── Accounts/
│   ├── Categories/
│   ├── Reports/
│   ├── Recurring/
│   ├── Goals/
│   ├── Settings/
│   ├── Onboarding/
│   └── Components/                 # Vues réutilisables
├── Services/                       # Persistence, Notifs, Biometrics, iCloud, OCR, FX, Import/Export
├── Utilities/                      # Extensions, Formatters
└── Resources/                      # Assets, Localizable
```

## À faire ensuite

1. Ouvrir dans Xcode 15+, créer la cible iOS via `File > New > Project` en réutilisant ces fichiers, ou générer un `.xcodeproj` avec XcodeGen (voir `project.yml`).
2. Design : palette, typographie, icônes SF Symbols, animations.
3. Implémenter les TODO dans les services.
