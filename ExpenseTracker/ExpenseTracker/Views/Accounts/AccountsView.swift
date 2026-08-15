import SwiftUI
import SwiftData

struct AccountsView: View {
    @Query private var accounts: [Account]

    var body: some View {
        List {
            if accounts.isEmpty {
                ContentUnavailableView("Aucun compte", systemImage: "creditcard")
            } else {
                ForEach(accounts) { a in
                    HStack {
                        Image(systemName: a.iconName)
                        VStack(alignment: .leading) {
                            Text(a.name)
                            Text(a.kind.rawValue.capitalized).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(CurrencyService.format(a.initialBalance, code: a.currencyCode))
                    }
                }
            }
        }
        .navigationTitle("Comptes")
    }
}
