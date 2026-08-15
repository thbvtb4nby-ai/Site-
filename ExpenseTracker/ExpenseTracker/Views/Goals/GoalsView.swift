import SwiftUI
import SwiftData

struct GoalsView: View {
    @Query private var goals: [Goal]

    var body: some View {
        List {
            if goals.isEmpty {
                ContentUnavailableView("Aucun objectif", systemImage: "target")
            } else {
                ForEach(goals) { g in
                    VStack(alignment: .leading) {
                        Text(g.name).font(.headline)
                        ProgressView(value: Double(truncating: (g.currentAmount / max(g.targetAmount, 1)) as NSDecimalNumber))
                        Text("\(CurrencyService.format(g.currentAmount, code: "EUR")) / \(CurrencyService.format(g.targetAmount, code: "EUR"))")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle("Objectifs")
    }
}
