import Foundation
import SwiftData

@Model
final class Transaction {
    var id: UUID
    var amount: Decimal
    var kind: TransactionKind
    var date: Date
    var note: String
    var merchant: String
    var currencyCode: String
    var attachmentPath: String?
    var location: String?

    var account: Account?
    var category: Category?

    @Relationship(inverse: \Tag.transactions)
    var tags: [Tag] = []

    init(amount: Decimal, kind: TransactionKind, date: Date = .now,
         note: String = "", merchant: String = "", currencyCode: String = "EUR",
         account: Account? = nil, category: Category? = nil) {
        self.id = UUID()
        self.amount = amount
        self.kind = kind
        self.date = date
        self.note = note
        self.merchant = merchant
        self.currencyCode = currencyCode
        self.account = account
        self.category = category
    }
}

enum TransactionKind: String, Codable, CaseIterable {
    case expense, income, transfer
}

@Model
final class Tag {
    var id: UUID
    var name: String
    var transactions: [Transaction] = []

    init(name: String) {
        self.id = UUID()
        self.name = name
    }
}
