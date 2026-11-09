# Codex Adapter Usage

The adapter exposes a single `CodexAdapter` (a `CodexClient` instance). Core and
TUI interact with it only through this surface.

```ts
import { CodexClient, type DicodeEvent } from "@dicode/codex-adapter";

const client = new CodexClient();

client.onEvent((event: DicodeEvent) => {
  // Consume unified events; never touch raw JSON-RPC here.
  if (event.type === "agent.message.delta") {
    const delta = (event.payload as { delta?: string }).delta;
    if (delta) process.stdout.write(delta);
  }
});

client.onStatusChange((status) => console.log("status:", status));

await client.start();

const thread = await client.createThread({ cwd: process.cwd() });
const turn = await client.startTurn(thread.id, {
  text: "Summarize the project structure.",
});

console.log("turn", turn.id, turn.status);

// Steering and interruption are available while the turn is active.
await client.steerTurn(thread.id, { text: "Also note the test layout." });
await client.interruptTurn(thread.id);

// Approvals are surfaced as events and answered through the approval manager.
client.approvalManager.onApproval(async (request) => {
  await client.approvalManager.respond(String(request.id), { kind: "approve" });
});

await client.stop();
```

`approvalManager.respond` never auto-approves by default; the example above
explicitly chooses to approve. Production code should present the request to
the user before responding.
