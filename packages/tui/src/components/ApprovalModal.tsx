import { useRef, useState } from "react";
import { Box, Text } from "ink";
import wrapAnsi from "wrap-ansi";
import type { ApprovalDecision, ApprovalInfo } from "@dicode/core";
import { useTerminalInput } from "../app/useTerminalInput.js";
import { COLORS } from "../theme/colors.js";
import { cleanInput, editComposer } from "../utils/composer.js";
import { approvalTitle } from "../utils/format.js";
import { Picker, type PickerItem } from "./CommandPalette.js";

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
  networkApprovalContext?: { host: string; protocol: string } | null;
  availableDecisions?: unknown[] | null;
  itemId?: string;
}

interface DecisionOption extends PickerItem {
  decision: ApprovalDecision;
}

function decisionOptions(type: string, params: ApprovalParams): DecisionOption[] {
  const choices = type === "command" ? params.availableDecisions : undefined;
  const canAllowOnce = ["command", "fileChange", "permissions"].includes(type) &&
    (!choices?.length || choices.includes("accept"));
  const canAllowForSession = type === "fileChange" || choices?.includes("acceptForSession");
  const cancelOnly = choices?.includes("cancel") && !choices.includes("decline");
  const options: DecisionOption[] = [{
    id: "deny",
    label: cancelOnly ? "Cancel request" : canAllowOnce || canAllowForSession ? "Deny" : "Dismiss request",
    hint: "D",
    decision: { kind: "deny" },
  }];
  if (canAllowOnce) {
    options.push({
      id: "approve", label: type === "permissions" ? "Allow this turn" : "Allow once",
      hint: "A", decision: { kind: "approve" },
    });
  }
  if (canAllowForSession) {
    options.push({
      id: "approve-session",
      label: params.networkApprovalContext ? "Allow this host for this session" : "Allow for this session",
      decision: { kind: "custom", result: { decision: "acceptForSession" } },
    });
  }
  return options;
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
  const decisionRows = decisionOptions(approval.type, params);
  const network = params.networkApprovalContext;
  const questionRows = options.map(({ label, description }, index) => ({ id: String(index), label, detail: description }));
  if (question?.isOther) questionRows.push({ id: "other", label: "Enter another answer", detail: undefined });
  const items = question ? questionRows : decisionRows;
  const freeText = Boolean(question && (items.length === 0 || other));
  const details = [
    network ? `Destination · ${network.protocol.toUpperCase()} ${network.host}` : params.command,
    params.message,
    params.reason,
    params.cwd && `Directory · ${params.cwd}`,
    params.grantRoot && `Write access · ${params.grantRoot}`,
    files?.length && `Files · ${files.join(", ")}`,
    ...[params.permissions, params.additionalPermissions]
      .filter(Boolean).map((detail) => JSON.stringify(detail)),
  ].filter((detail): detail is string => typeof detail === "string" && detail.length > 0);
  const framed = rows >= 10;
  const detailWidth = Math.max(1, columns - (framed ? 4 : 2));
  const detailLines = details.length
    ? wrapAnsi(details.map(cleanInput).join("\n"), detailWidth, { hard: true }).split("\n")
    : [];
  const contentRows = Math.max(2, rows - (framed ? 4 : 2));
  const detailRows = question ? 0 : Math.min(detailLines.length, Math.floor(contentRows / 3));
  const maxDetailOffset = Math.max(0, detailLines.length - detailRows);
  const offset = Math.min(maxDetailOffset, detailOffset);
  const showDetailHint = !question && maxDetailOffset > 0 && contentRows - detailRows > 2;
  const choiceRows = Math.max(1, Math.min(7, contentRows - detailRows - Number(showDetailHint) - 1));

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
    const option = key.escape ? decisionRows[0] : key.return ? decisionRows[selected] :
      decisionRows.find((entry) => entry.hint === input.toUpperCase());
    if (option) void reply(option.decision);
  });

  return (
    <Box flexDirection="column" paddingX={1} borderStyle={framed ? "single" : undefined} borderColor={COLORS.warning}>
      <Text wrap="truncate-end" bold color={COLORS.warning}>{question ? `Question ${questionIndex + 1} of ${questions.length}` : "Approval required"}</Text>
      <Text color={COLORS.text} wrap="truncate-end">
        {cleanInput(question?.question ?? (network ? "Approve network access" : approvalTitle(approval)))}
      </Text>
      {!question && details.length > 0 && detailLines.slice(offset, offset + detailRows).map((detail, index) => (
        <Text key={index} wrap="truncate-end" color={COLORS.secondaryText}>{detail || " "}</Text>
      ))}
      {showDetailHint && <Text wrap="truncate-end" color={COLORS.dim}>PgUp / PgDn · Details {offset + 1}/{detailLines.length}</Text>}
      {freeText ? (
        <>
          <Text wrap="truncate-end" color={COLORS.text}>› {question?.isSecret ? "•".repeat(entry.length) : entry}▏</Text>
          <Text wrap="truncate-end" color={COLORS.dim}>Enter answer · {other ? "Esc back" : "Esc dismiss"}</Text>
        </>
      ) : (
        <Picker title={question?.header ?? "Choose a response"} items={items} selectedIndex={selected}
          rows={choiceRows} empty="No choices" inline />
      )}
    </Box>
  );
}
