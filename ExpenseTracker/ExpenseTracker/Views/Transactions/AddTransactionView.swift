import SwiftUI
import SwiftData

struct AddTransactionView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Query private var accounts: [Account]
    @Query private var categories: [Category]

    @State private var amount: Decimal = 0
    @State private var kind: TransactionKind = .expense
    @State private var date: Date = .now
    @State private var merchant: String = ""
    @State private var note: String = ""
    @State private var account: Account?
    @State private var category: Category?

    var body: some View {
        NavigationStack {
            Form {
                Section("Type") {
                    Picker("Type", selection: $kind) {
                        ForEach(TransactionKind.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
                    }.pickerStyle(.segmented)
                }
                Section("Montant") {
                    TextField("0,00", value: $amount, format: .number).keyboardType(.decimalPad)
                }
                Section("Détails") {
                    TextField("Commerçant", text: $merchant)
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    TextField("Note", text: $note, axis: .vertical)
                }
                Section("Compte") {
                    Picker("Compte", selection: $account) {
                        Text("—").tag(Account?.none)
                        ForEach(accounts) { Text($0.name).tag(Optional($0)) }
                    }
                }
                Section("Catégorie") {
                    Picker("Catégorie", selection: $category) {
                        Text("—").tag(Category?.none)
                        ForEach(categories) { Text($0.name).tag(Optional($0)) }
                    }
                }
                Section {
                    Button("Scanner un reçu") {
                        // TODO: ReceiptScannerService.scan()
                    }
                }
            }
            .navigationTitle("Nouvelle transaction")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annuler") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Enregistrer") { save() } }
            }
        }
    }

    private func save() {
        let tx = Transaction(amount: amount, kind: kind, date: date, note: note,
                             merchant: merchant, account: account, category: category)
        context.insert(tx)
        dismiss()
    }
}
