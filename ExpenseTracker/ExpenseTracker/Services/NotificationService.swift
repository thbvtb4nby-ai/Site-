import Foundation
import UserNotifications

enum NotificationService {
    static func requestAuthorization() async -> Bool {
        (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])) ?? false
    }

    static func scheduleBudgetAlert(title: String, body: String, at date: Date) {
        // TODO: schedule with UNCalendarNotificationTrigger.
    }

    static func scheduleRecurringReminder(for recurring: RecurringTransaction) {
        // TODO: schedule based on recurring.nextOccurrence.
    }
}
