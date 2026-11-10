import { describe, expect, it, vi } from "vitest";
import { CodexApprovalManager } from "@dicode/codex-adapter";

describe("Codex approval decision payloads", () => {
  it("grants only the requested permissions for this turn", async () => {
    const respond = vi.fn();
    const manager = new CodexApprovalManager(respond);
    manager.handleServerRequest(1, "item/permissions/requestApproval", {
      permissions: { fileSystem: null, network: { enabled: true } },
    });
    await manager.respond("1", { kind: "approve" });
    expect(respond).toHaveBeenCalledWith(1, { scope: "turn", permissions: { network: { enabled: true } } });
  });

  it("does not substitute a session-wide grant for one-time approval", async () => {
    const respond = vi.fn();
    const manager = new CodexApprovalManager(respond);
    manager.handleServerRequest(2, "item/commandExecution/requestApproval", {
      availableDecisions: ["acceptForSession", "cancel"],
    });
    await expect(manager.respond("2", { kind: "approve" })).rejects.toThrow(/one-time/);
    await manager.respond("2", { kind: "deny" });
    expect(respond).toHaveBeenCalledTimes(1);
    expect(respond).toHaveBeenCalledWith(2, { decision: "cancel" });
  });

  it("sends the schema-specific decline or answer for other request types", async () => {
    const respond = vi.fn();
    const manager = new CodexApprovalManager(respond);
    manager.handleServerRequest(3, "mcpServer/elicitation/request", {});
    await manager.respond("3", { kind: "deny" });
    manager.handleServerRequest(4, "item/tool/requestUserInput", {});
    const result = { answers: { strategy: { answers: ["Incremental"] } } };
    await manager.respond("4", { kind: "custom", result });
    expect(respond).toHaveBeenNthCalledWith(1, 3, { action: "decline", content: null, _meta: null });
    expect(respond).toHaveBeenNthCalledWith(2, 4, result);
  });
});
