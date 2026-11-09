import type { ApprovalInfo, TaskInfo } from "@dicode/core";

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

export function taskStatusLabel(task: TaskInfo): string {
  switch (task.status) {
    case "queued":
      return "Pending";
    case "running":
      return "Running";
    case "waiting_approval":
      return "Waiting Approval";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "interrupted":
      return "Interrupted";
  }
}

export function approvalTitle(approval: ApprovalInfo): string {
  if (approval.title) return approval.title;
  switch (approval.type) {
    case "command":
      return "Approve shell command";
    case "fileChange":
      return "Approve file changes";
    case "permissions":
      return "Approve permissions";
    case "toolInput":
      return "Tool input required";
    default:
      return "Approval required";
  }
}

export function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}
