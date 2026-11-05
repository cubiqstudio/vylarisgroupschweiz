import type { AssigneeOption, MeetingOption, ResolutionOption } from "@/lib/verein/tasks-data";

/** Aufgabe in einfacher, serialisierbarer Form für die Client-Komponenten. */
export type TaskView = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  /** JJJJ-MM-TT oder leer */
  dueInput: string;
  dueText: string;
  overdue: boolean;
  assignee: string;
  assigneeName: string;
  meetingId: string;
  meetingTitle: string;
  resolutionId: string;
  resolutionLabel: string;
  commentCount: number;
  doneText: string;
  createdByName: string;
  lastReminderText: string;
};

export type TaskOptions = {
  assignees: AssigneeOption[];
  meetings: Array<Pick<MeetingOption, "id" | "title"> & { dateText: string }>;
  resolutions: ResolutionOption[];
};

export type TaskComment = { id: string; body: string; authorName: string; createdAt: string };
