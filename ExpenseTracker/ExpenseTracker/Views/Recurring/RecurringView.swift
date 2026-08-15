import SwiftUI
import SwiftData

struct RecurringView: View {
    @Query private var items: [RecurringTransaction]

    var body: some View {
        List {
            if items.isEmpty {
                ContentUnavailableView("Aucun abonnement", systemImage: "repeat")
            } else {
                ForEach(items) { r in
                    VStack(alignment: .leading) {
                        Text(r.name).font(.headline)
                        Text("\(r.frequency.rawValue.capitalized) — prochain: \(Formatters.shortDate.string(from: r.nextOccurrence))")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle("Récurrents")
    }
}
