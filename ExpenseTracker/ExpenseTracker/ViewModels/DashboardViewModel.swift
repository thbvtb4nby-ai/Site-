import Foundation
import SwiftData

@Observable
final class DashboardViewModel {
    var totalBalance: Decimal = 0
    var monthExpenses: Decimal = 0
    var monthIncome: Decimal = 0

    func reload(context: ModelContext) {
        // TODO: aggregate from SwiftData.
    }
}
