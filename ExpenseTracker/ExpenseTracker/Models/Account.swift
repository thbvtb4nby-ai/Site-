import Foundation
import SwiftData

@Model
final class Account {
    var id: UUID
    var name: String
    var kind: AccountKind
    var currencyCode: String
    var initialBalance: Decimal
    var iconName: String
    var colorHex: String
    var isArchived: Bool
    var createdAt: Date

    @Relationship(deleteRule: .cascade, inverse: \Transaction.account)
    var transactions: [Transaction] = []

    init(name: String, kind: AccountKind = .checking, currencyCode: String = "EUR",
         initialBalance: Decimal = 0, iconName: String = "creditcard", colorHex: String = "#4E8CFF") {
        self.id = UUID()
        self.name = name
        self.kind = kind
        self.currencyCode = currencyCode
        self.initialBalance = initialBalance
        self.iconName = iconName
        self.colorHex = colorHex
        self.isArchived = false
        self.createdAt = .now
    }
}

enum AccountKind: String, Codable, CaseIterable {
    case checking, savings, cash, card, crypto, other
}
