import SwiftUI

struct RootView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        Group {
            if !appState.hasCompletedOnboarding {
                OnboardingView()
            } else if appState.isLocked {
                LockView()
            } else {
                MainTabView()
            }
        }
    }
}

struct MainTabView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        TabView(selection: $appState.selectedTab) {
            DashboardView()
                .tabItem { Label("Accueil", systemImage: "house") }
                .tag(AppTab.dashboard)

            TransactionsListView()
                .tabItem { Label("Transactions", systemImage: "list.bullet") }
                .tag(AppTab.transactions)

            BudgetsView()
                .tabItem { Label("Budgets", systemImage: "chart.pie") }
                .tag(AppTab.budgets)

            ReportsView()
                .tabItem { Label("Rapports", systemImage: "chart.bar") }
                .tag(AppTab.reports)

            SettingsView()
                .tabItem { Label("Réglages", systemImage: "gearshape") }
                .tag(AppTab.settings)
        }
    }
}
