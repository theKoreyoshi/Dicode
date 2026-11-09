import type { AdapterCapabilities } from "@dicode/codex-adapter";
import type { CoreCapabilities } from "./capability-types.js";

/**
 * Derives Dicode-level capabilities from the connected adapter. Adapter methods
 * that are absent or that the runtime does not advertise are reported as
 * unavailable rather than assumed.
 */
export class CapabilityManager {
  private capabilities: CoreCapabilities = emptyCapabilities();

  setFromAdapter(adapterCapabilities: AdapterCapabilities, adapterMethods: Set<string>): void {
    const has = (name: string) => adapterMethods.has(name);
    this.capabilities = {
      sessionCreate: has("thread/start"),
      sessionResume: has("thread/resume"),
      sessionList: has("thread/list"),
      sessionFork: has("thread/fork"),
      sessionArchive: has("thread/archive"),
      sessionDelete: has("thread/delete"),
      taskStart: has("turn/start"),
      taskSteer: has("turn/steer"),
      taskInterrupt: has("turn/interrupt"),
      modelList: has("model/list"),
      approval: adapterCapabilities.experimentalApi,
      mcp: has("mcpServer/tool/call"),
      skills: has("skills/list"),
    };
  }

  get(): CoreCapabilities {
    return { ...this.capabilities };
  }

  supports(key: keyof CoreCapabilities): boolean {
    return this.capabilities[key] === true;
  }
}

function emptyCapabilities(): CoreCapabilities {
  return {
    sessionCreate: false,
    sessionResume: false,
    sessionList: false,
    sessionFork: false,
    sessionArchive: false,
    sessionDelete: false,
    taskStart: false,
    taskSteer: false,
    taskInterrupt: false,
    modelList: false,
    approval: false,
    mcp: false,
    skills: false,
  };
}
