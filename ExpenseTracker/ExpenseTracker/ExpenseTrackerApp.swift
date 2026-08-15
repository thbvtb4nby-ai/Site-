import SwiftUI
import SwiftData

@main
struct ExpenseTrackerApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
        }
        .modelContainer(for: [
            Account.self,
            Transaction.self,
            Category.self,
            Budget.self,
            Goal.self,
            RecurringTransaction.self,
            Tag.self
        ])
    }
}

final class AppState: ObservableObject {
    @Published var hasCompletedOnboarding: Bool = UserDefaults.standard.bool(forKey: "onboarded")
    @Published var isLocked: Bool = false
    @Published var selectedTab: AppTab = .dashboard
}

enum AppTab: Hashable { case dashboard, transactions, budgets, reports, settings }
