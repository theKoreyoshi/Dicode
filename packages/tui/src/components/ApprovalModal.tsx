import { Box, Text } from "ink";
import type { ApprovalInfo } from "@dicode/core";
import { COLORS } from "../theme/colors.js";
import { approvalTitle } from "../utils/format.js";

export function ApprovalModal({ approval }: { approval: ApprovalInfo }) {
  const metadata = approval.metadata as { params?: { command?: string; reason?: string } };
  const command = metadata.params?.command;
  const reason = metadata.params?.reason;
  return (
    <Box borderStyle="double" borderColor={COLORS.warning} flexDirection="column" paddingX={1}>
      <Text bold color={COLORS.warning}>APPROVAL REQUIRED</Text>
      <Text color={COLORS.text}>{approvalTitle(approval)}</Text>
      {command && (
        <Box>
          <Text color={COLORS.secondaryText}>Command: </Text>
          <Text color={COLORS.text}>{command}</Text>
        </Box>
      )}
      {reason && <Text color={COLORS.secondaryText}>{reason}</Text>}
      <Text> </Text>
      <Text color={COLORS.success}>[A] Approve</Text>
      <Text color={COLORS.error}>[D] Deny</Text>
      <Text color={COLORS.dim}>Select an action to continue.</Text>
    </Box>
  );
}
