import Foundation
import SwiftData

@Model
final class RecurringTransaction {
    var id: UUID
    var name: String
    var amount: Decimal
    var kind: TransactionKind
    var frequency: RecurrenceFrequency
    var nextOccurrence: Date
    var account: Account?
    var category: Category?
    var isActive: Bool

    init(name: String, amount: Decimal, kind: TransactionKind = .expense,
         frequency: RecurrenceFrequency = .monthly, nextOccurrence: Date = .now,
         account: Account? = nil, category: Category? = nil) {
        self.id = UUID()
        self.name = name
        self.amount = amount
        self.kind = kind
        self.frequency = frequency
        self.nextOccurrence = nextOccurrence
        self.account = account
        self.category = category
        self.isActive = true
    }
}

enum RecurrenceFrequency: String, Codable, CaseIterable {
    case daily, weekly, biweekly, monthly, quarterly, yearly
}
