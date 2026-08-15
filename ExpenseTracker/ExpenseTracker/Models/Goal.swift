import Foundation
import SwiftData

@Model
final class Goal {
    var id: UUID
    var name: String
    var targetAmount: Decimal
    var currentAmount: Decimal
    var deadline: Date?
    var iconName: String
    var colorHex: String

    init(name: String, targetAmount: Decimal, currentAmount: Decimal = 0,
         deadline: Date? = nil, iconName: String = "target", colorHex: String = "#34C759") {
        self.id = UUID()
        self.name = name
        self.targetAmount = targetAmount
        self.currentAmount = currentAmount
        self.deadline = deadline
        self.iconName = iconName
        self.colorHex = colorHex
    }
}
