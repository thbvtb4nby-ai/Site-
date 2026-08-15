import Foundation
import SwiftData

@Model
final class Category {
    var id: UUID
    var name: String
    var iconName: String
    var colorHex: String
    var parent: Category?
    var isIncome: Bool

    @Relationship(deleteRule: .cascade, inverse: \Category.parent)
    var children: [Category] = []

    init(name: String, iconName: String = "tag", colorHex: String = "#888888",
         isIncome: Bool = false, parent: Category? = nil) {
        self.id = UUID()
        self.name = name
        self.iconName = iconName
        self.colorHex = colorHex
        self.isIncome = isIncome
        self.parent = parent
    }
}
