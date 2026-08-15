import SwiftUI
import SwiftData

struct TransactionsListView: View {
    @Query(sort: \Transaction.date, order: .reverse) private var transactions: [Transaction]
    @State private var vm = TransactionsViewModel()
    @State private var showingAdd = false

    var body: some View {
        NavigationStack {
            List {
                if transactions.isEmpty {
                    ContentUnavailableView("Aucune transaction", systemImage: "list.bullet.rectangle")
                } else {
                    ForEach(transactions) { tx in
                        NavigationLink(value: tx) { TransactionRow(transaction: tx) }
                    }
                }
            }
            .navigationTitle("Transactions")
            .searchable(text: $vm.searchText)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showingAdd = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showingAdd) { AddTransactionView() }
            .navigationDestination(for: Transaction.self) { TransactionDetailView(transaction: $0) }
        }
    }
}

struct TransactionRow: View {
    let transaction: Transaction
    var body: some View {
        HStack {
            Image(systemName: transaction.category?.iconName ?? "circle")
            VStack(alignment: .leading) {
                Text(transaction.merchant.isEmpty ? (transaction.category?.name ?? "Transaction") : transaction.merchant)
                Text(Formatters.shortDate.string(from: transaction.date))
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Text(CurrencyService.format(transaction.amount, code: transaction.currencyCode))
                .foregroundStyle(transaction.kind == .expense ? .red : .green)
        }
    }
}
