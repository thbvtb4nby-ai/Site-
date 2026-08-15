import SwiftUI
import SwiftData

struct DashboardView: View {
    @Environment(\.modelContext) private var context
    @State private var vm = DashboardViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    BalanceCard(balance: vm.totalBalance)
                    HStack {
                        SummaryTile(title: "Dépenses", amount: vm.monthExpenses, systemImage: "arrow.down")
                        SummaryTile(title: "Revenus", amount: vm.monthIncome, systemImage: "arrow.up")
                    }
                    SectionCard(title: "Budgets") { Text("TODO — progression des budgets") }
                    SectionCard(title: "Récents") { Text("TODO — dernières transactions") }
                    SectionCard(title: "Objectifs") { Text("TODO — progression des objectifs") }
                }
                .padding()
            }
            .navigationTitle("Accueil")
            .onAppear { vm.reload(context: context) }
        }
    }
}

struct BalanceCard: View {
    let balance: Decimal
    var body: some View {
        VStack(alignment: .leading) {
            Text("Solde total").font(.caption).foregroundStyle(.secondary)
            Text(CurrencyService.format(balance, code: "EUR")).font(.largeTitle.bold())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

struct SummaryTile: View {
    let title: String
    let amount: Decimal
    let systemImage: String
    var body: some View {
        VStack(alignment: .leading) {
            Label(title, systemImage: systemImage).font(.caption)
            Text(CurrencyService.format(amount, code: "EUR")).font(.headline)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }
}

struct SectionCard<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            content.frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }
}
