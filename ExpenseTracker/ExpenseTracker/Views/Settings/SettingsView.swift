import SwiftUI

struct SettingsView: View {
    @AppStorage("useBiometrics") private var useBiometrics: Bool = false
    @AppStorage("defaultCurrency") private var defaultCurrency: String = "EUR"
    @AppStorage("iCloudSync") private var iCloudSync: Bool = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Général") {
                    Picker("Devise par défaut", selection: $defaultCurrency) {
                        ForEach(CurrencyService.supported, id: \.self) { Text($0).tag($0) }
                    }
                    Toggle("Face ID / Touch ID", isOn: $useBiometrics)
                    Toggle("Synchronisation iCloud", isOn: $iCloudSync)
                }
                Section("Données") {
                    NavigationLink("Comptes") { AccountsView() }
                    NavigationLink("Catégories") { CategoriesView() }
                    NavigationLink("Récurrents") { RecurringView() }
                    NavigationLink("Objectifs") { GoalsView() }
                }
                Section("Import / Export") {
                    Button("Importer CSV") { /* TODO */ }
                    Button("Exporter CSV") { /* TODO */ }
                }
                Section("Notifications") {
                    Button("Autoriser les notifications") {
                        Task { _ = await NotificationService.requestAuthorization() }
                    }
                }
                Section("À propos") {
                    LabeledContent("Version", value: "0.1.0")
                }
            }
            .navigationTitle("Réglages")
        }
    }
}
