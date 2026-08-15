import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "eurosign.circle.fill").font(.system(size: 80))
            Text("Bienvenue").font(.largeTitle.bold())
            Text("Organisez vos dépenses simplement.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Spacer()
            Button("Commencer") {
                UserDefaults.standard.set(true, forKey: "onboarded")
                appState.hasCompletedOnboarding = true
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .padding()
    }
}
