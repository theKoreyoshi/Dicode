import type { JsonRpcClient } from "../transport/jsonrpc-client.js";
import type { InitializeResponse } from "./capability-manager.js";

export interface ClientInfo {
  name: string;
  version: string;
}

export interface InitializeParams {
  clientInfo: ClientInfo;
  capabilities: {
    experimentalApi: boolean;
  };
}

/**
 * Performs the App Server handshake in the verified order:
 * `initialize` request -> response -> `initialized` notification.
 */
export async function initializeClient(
  rpc: JsonRpcClient,
  clientInfo: ClientInfo,
): Promise<InitializeResponse> {
  const params: InitializeParams = {
    clientInfo,
    capabilities: { experimentalApi: true },
  };
  const response = (await rpc.request("initialize", params)) as InitializeResponse;
  rpc.notify("initialized");
  return response;
}
