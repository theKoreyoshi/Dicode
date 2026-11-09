export interface CoreCapabilities {
  sessionCreate: boolean;
  sessionResume: boolean;
  sessionList: boolean;
  sessionFork: boolean;
  sessionArchive: boolean;
  sessionDelete: boolean;
  taskStart: boolean;
  taskSteer: boolean;
  taskInterrupt: boolean;
  modelList: boolean;
  approval: boolean;
  mcp: boolean;
  skills: boolean;
}
