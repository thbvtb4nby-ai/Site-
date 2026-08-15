import Foundation
import SwiftData

@Model
final class Budget {
    var id: UUID
    var name: String
    var amount: Decimal
    var period: BudgetPeriod
    var startDate: Date
    var category: Category?
    var rolloverUnused: Bool

    init(name: String, amount: Decimal, period: BudgetPeriod = .monthly,
         startDate: Date = .now, category: Category? = nil, rolloverUnused: Bool = false) {
        self.id = UUID()
        self.name = name
        self.amount = amount
        self.period = period
        self.startDate = startDate
        self.category = category
        self.rolloverUnused = rolloverUnused
    }
}

enum BudgetPeriod: String, Codable, CaseIterable {
    case weekly, monthly, quarterly, yearly
}
