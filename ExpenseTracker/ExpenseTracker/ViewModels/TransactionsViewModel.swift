import Foundation
import SwiftData

@Observable
final class TransactionsViewModel {
    var searchText: String = ""
    var selectedKind: TransactionKind? = nil
    var selectedCategory: Category? = nil
    var dateRange: ClosedRange<Date>? = nil

    // TODO: filtering + sort logic.
}
