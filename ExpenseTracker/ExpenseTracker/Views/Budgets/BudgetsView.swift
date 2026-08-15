import SwiftUI
import SwiftData

struct BudgetsView: View {
    @Query private var budgets: [Budget]

    var body: some View {
        NavigationStack {
            List {
                if budgets.isEmpty {
                    ContentUnavailableView("Aucun budget", systemImage: "chart.pie")
                } else {
                    ForEach(budgets) { b in
                        VStack(alignment: .leading) {
                            Text(b.name).font(.headline)
                            Text("\(CurrencyService.format(b.amount, code: "EUR")) / \(b.period.rawValue)")
                                .font(.caption).foregroundStyle(.secondary)
                            ProgressView(value: 0.3) // TODO: real progress
                        }
                    }
                }
            }
            .navigationTitle("Budgets")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { /* TODO add budget */ } label: { Image(systemName: "plus") }
                }
            }
        }
    }
}
