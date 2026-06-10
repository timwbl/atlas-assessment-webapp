export type MobileReminderType =
  | "review"
  | "unfinished_assessment"
  | "weak_topic";

export type MobileReminder = {
  id: string;
  type: MobileReminderType;
  assessmentId?: string;
  blockId?: string;
  scheduledFor: string;
  enabled: boolean;
};

// In-app reminders use this shared shape today. A future push adapter can consume
// the same records without coupling notification permissions to learning state.
export function dueMobileReminders(
  reminders: MobileReminder[],
  now = new Date()
): MobileReminder[] {
  const timestamp = now.getTime();
  return reminders.filter((item) => item.enabled && new Date(item.scheduledFor).getTime() <= timestamp);
}
