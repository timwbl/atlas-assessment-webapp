export type AriMood =
  | "idle"
  | "success"
  | "thinking"
  | "encourage"
  | "focus"
  | "comeback_sleepy";

export type AriEventType =
  | "assessment_completed"
  | "daily_quest_completed"
  | "review_item_corrected"
  | "assessment_analyzing"
  | "wrong_answer"
  | "low_confidence"
  | "many_errors_in_row"
  | "new_focus_area"
  | "wrong_confident_answer"
  | "return_after_inactivity";

export type AriReaction = {
  mood: AriMood;
  title: string;
  subtitle?: string;
  autoReturnMs?: number;
};

export type CompanionPreferences = {
  companionEnabled: boolean;
  hideInExamMode: boolean;
  reducedMotion: boolean;
};
