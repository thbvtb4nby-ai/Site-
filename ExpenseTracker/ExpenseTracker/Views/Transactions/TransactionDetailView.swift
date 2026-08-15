import SwiftUI

struct TransactionDetailView: View {
    let transaction: Transaction
    var body: some View {
        List {
            LabeledContent("Montant", value: CurrencyService.format(transaction.amount, code: transaction.currencyCode))
            LabeledContent("Type", value: transaction.kind.rawValue.capitalized)
            LabeledContent("Date", value: Formatters.shortDate.string(from: transaction.date))
            if let c = transaction.category { LabeledContent("Catégorie", value: c.name) }
            if let a = transaction.account { LabeledContent("Compte", value: a.name) }
            if !transaction.note.isEmpty { LabeledContent("Note", value: transaction.note) }
        }
        .navigationTitle(transaction.merchant.isEmpty ? "Transaction" : transaction.merchant)
    }
}
