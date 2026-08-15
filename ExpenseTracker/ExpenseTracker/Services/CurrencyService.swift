import Foundation

enum CurrencyService {
    static let supported: [String] = ["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD"]

    // TODO: fetch live FX rates and cache.
    static func convert(_ amount: Decimal, from: String, to: String) -> Decimal {
        amount
    }

    static func format(_ amount: Decimal, code: String) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = code
        return f.string(from: amount as NSDecimalNumber) ?? "\(amount) \(code)"
    }
}
