import Foundation

enum ImportExportService {
    static func exportCSV(transactions: [Transaction]) -> URL? {
        // TODO: write CSV to temporary directory.
        nil
    }

    static func importCSV(url: URL) throws -> [Transaction] {
        // TODO: parse CSV and return transactions.
        []
    }
}
