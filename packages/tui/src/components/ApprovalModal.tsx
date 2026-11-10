import { useRef, useState } from "react";
import { Box, Text } from "ink";
import wrapAnsi from "wrap-ansi";
import type { ApprovalDecision, ApprovalInfo } from "@dicode/core";
import { useTerminalInput } from "../app/useTerminalInput.js";
import { COLORS } from "../theme/colors.js";
import { cleanInput, editComposer } from "../utils/composer.js";
import { approvalTitle } from "../utils/format.js";
import { Picker } from "./CommandPalette.js";

interface Question {
  id: string;
  header: string;
  question: string;
  isOther?: boolean;
  isSecret?: boolean;
  options?: Array<{ label: string; description?: string }> | null;
}

interface ApprovalParams {
  command?: string;
  cwd?: string;
  reason?: string;
  grantRoot?: string;
  questions?: Question[];
  message?: string;
  permissions?: unknown;
  additionalPermissions?: unknown;
  networkApprovalContext?: unknown;
  availableDecisions?: unknown[];
  itemId?: string;
}

export function ApprovalModal({ approval, rows, columns, files, onDecision }: {
  approval: ApprovalInfo;
  rows: number;
  columns: number;
  files?: string[];
  onDecision: (decision: ApprovalDecision) => Promise<void>;
}) {
  const params = (approval.metadata.params ?? {}) as ApprovalParams;
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState(0);
  const [entry, setEntry] = useState("");
  const [other, setOther] = useState(false);
  const [detailOffset, setDetailOffset] = useState(0);
  const answers = useRef<Record<string, { answers: string[] }>>(Object.create(null));
  const responding = useRef(false);
  const questions = approval.type === "toolInput" ? params.questions ?? [] : [];
  const question = questions[questionIndex];
  const options = question?.options ?? [];
  const canApprove = ["command", "fileChange", "permissions"].includes(approval.type) &&
    (!params.availableDecisions?.length || params.availableDecisions.includes("accept"));
  const decisionRows = canApprove
    ? [{ id: "deny", label: "Deny", hint: "D" }, { id: "approve", label: "Allow once", hint: "A" }]
    : [{ id: "deny", label: "Dismiss request", hint: "D" }];
  const questionRows = options.map(({ label, description }, index) => ({ id: String(index), label, detail: description }));
  if (question?.isOther) questionRows.push({ id: "other", label: "Enter another answer", detail: undefined });
  const items = question ? questionRows : decisionRows;
  const freeText = Boolean(question && (items.length === 0 || other));
  const details = [
    params.command,
    params.message,
    params.reason,
    params.cwd && `Directory · ${params.cwd}`,
    params.grantRoot && `Write access · ${params.grantRoot}`,
    files?.length && `Files · ${files.join(", ")}`,
    ...[params.permissions, params.additionalPermissions, params.networkApprovalContext]
      .filter(Boolean).map((detail) => JSON.stringify(detail)),
  ].filter((detail): detail is string => typeof detail === "string" && detail.length > 0);
  const detailLines = wrapAnsi(details.map(cleanInput).join("\n"), Math.max(1, columns - 4), { hard: true }).split("\n");
  const detailRows = Math.max(1, Math.floor(rows / 3));
  const maxDetailOffset = Math.max(0, detailLines.length - detailRows);
  const offset = Math.min(maxDetailOffset, detailOffset);

  async function reply(decision: ApprovalDecision) {
    if (responding.current) return;
    responding.current = true;
    try {
      await onDecision(decision);
    } finally {
      responding.current = false;
    }
  }

  function answer(value: string) {
    if (!question || !value.trim()) return;
    answers.current[question.id] = { answers: [value.trim()] };
    if (questionIndex === questions.length - 1) {
      void reply({ kind: "custom", result: { answers: answers.current } });
      return;
    }
    setQuestionIndex(questionIndex + 1);
    setSelected(0);
    setEntry("");
    setOther(false);
  }

  useTerminalInput((input, key, pasted) => {
    if (responding.current || key.ctrl || pasted && !freeText) return;
    if (!question && (key.pageDown || key.pageUp)) {
      setDetailOffset(Math.max(0, Math.min(maxDetailOffset, offset + (key.pageDown ? detailRows : -detailRows))));
      return;
    }
    if (freeText) {
      if (key.return) answer(entry);
      else if (key.escape && other) { setOther(false); setEntry(""); }
      else if (key.escape) void reply({ kind: "deny" });
      else setEntry((value) => editComposer(value, value.length, { input, key }).value.replace(/\n/gu, " "));
      return;
    }
    if (key.upArrow) setSelected((index) => Math.max(0, index - 1));
    if (key.downArrow) setSelected((index) => Math.min(items.length - 1, index + 1));
    if (question) {
      if (key.escape) void reply({ kind: "deny" });
      if (key.return && questionRows[selected]?.id === "other") setOther(true);
      else if (key.return && options[selected]) answer(options[selected].label);
      return;
    }
    if (key.escape || input.toLowerCase() === "d" || key.return && selected === 0) void reply({ kind: "deny" });
    if (canApprove && (input.toLowerCase() === "a" || key.return && selected === 1)) void reply({ kind: "approve" });
  });

  return (
    <Box flexDirection="column" paddingX={1} borderStyle="single" borderColor={COLORS.warning}>
      <Text bold color={COLORS.warning}>{question ? `Question ${questionIndex + 1} of ${questions.length}` : "Approval required"}</Text>
      <Text color={COLORS.text} wrap="truncate-end">{cleanInput(question?.question ?? approvalTitle(approval))}</Text>
      {!question && details.length > 0 && detailLines.slice(offset, offset + detailRows).map((detail, index) => (
        <Text key={index} wrap="truncate-end" color={COLORS.secondaryText}>{detail || " "}</Text>
      ))}
      {!question && maxDetailOffset > 0 && <Text color={COLORS.dim}>PgUp / PgDn · Details {offset + 1}/{detailLines.length}</Text>}
      {freeText ? (
        <>
          <Text wrap="truncate-end" color={COLORS.text}>› {question?.isSecret ? "•".repeat(entry.length) : entry}▏</Text>
          <Text wrap="truncate-end" color={COLORS.dim}>Enter answer · {other ? "Esc back" : "Esc dismiss"}</Text>
        </>
      ) : (
        <Picker title={question?.header ?? "Choose a response"} items={items} selectedIndex={selected}
          rows={Math.max(1, Math.min(7, rows - 7))} empty="No choices" inline />
      )}
    </Box>
  );
}
