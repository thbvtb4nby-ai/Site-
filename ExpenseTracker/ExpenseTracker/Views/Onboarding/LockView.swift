import SwiftUI

struct LockView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "faceid").font(.system(size: 60))
            Text("Application verrouillée")
            Button("Déverrouiller") {
                Task {
                    if await BiometricsService.authenticate() {
                        await MainActor.run { appState.isLocked = false }
                    }
                }
            }
            .buttonStyle(.borderedProminent)
        }
    }
}
