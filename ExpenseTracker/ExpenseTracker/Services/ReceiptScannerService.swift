import Foundation
#if canImport(VisionKit)
import VisionKit
#endif

enum ReceiptScannerService {
    struct ScannedReceipt {
        var merchant: String?
        var total: Decimal?
        var date: Date?
        var rawText: String
    }

    // TODO: implement using VNDocumentCameraViewController + VNRecognizeTextRequest.
    static func scan() async throws -> ScannedReceipt? { nil }
}
