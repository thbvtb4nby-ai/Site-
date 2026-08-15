import SwiftUI

struct ReportsView: View {
    var body: some View {
        NavigationStack {
            List {
                Section("Vues") {
                    NavigationLink("Par catégorie") { Text("TODO — camembert") }
                    NavigationLink("Tendance mensuelle") { Text("TODO — barres") }
                    NavigationLink("Cash-flow") { Text("TODO — courbe") }
                    NavigationLink("Comparaison année/année") { Text("TODO") }
                }
                Section("Export") {
                    Button("Exporter en CSV") { _ = ImportExportService.exportCSV(transactions: []) }
                    Button("Exporter en PDF") { /* TODO */ }
                }
            }
            .navigationTitle("Rapports")
        }
    }
}
