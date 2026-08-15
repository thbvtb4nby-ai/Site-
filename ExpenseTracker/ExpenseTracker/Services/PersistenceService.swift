import Foundation
import SwiftData

enum PersistenceService {
    // TODO: helpers for CRUD, aggregations, and previews.
    static func previewContainer() -> ModelContainer {
        let schema = Schema([Account.self, Transaction.self, Category.self,
                             Budget.self, Goal.self, RecurringTransaction.self, Tag.self])
        let config = ModelConfiguration(isStoredInMemoryOnly: true)
        return try! ModelContainer(for: schema, configurations: [config])
    }
}
