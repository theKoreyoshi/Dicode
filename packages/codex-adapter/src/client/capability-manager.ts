export interface AdapterCapabilities {
  initialized: boolean;
  experimentalApi: boolean;
  platformFamily?: string;
  platformOs?: string;
  codexHome?: string;
  userAgent?: string;
}

export interface InitializeResponse {
  codexHome?: string;
  platformFamily?: string;
  platformOs?: string;
  userAgent?: string;
}

export class CapabilityManager {
  private readonly capabilities: AdapterCapabilities = {
    initialized: false,
    experimentalApi: false,
  };

  markInitialized(): void {
    this.capabilities.initialized = true;
  }

  setInitializeResponse(response: InitializeResponse): void {
    if (typeof response.codexHome === "string") this.capabilities.codexHome = response.codexHome;
    if (typeof response.platformFamily === "string") {
      this.capabilities.platformFamily = response.platformFamily;
    }
    if (typeof response.platformOs === "string") this.capabilities.platformOs = response.platformOs;
    if (typeof response.userAgent === "string") this.capabilities.userAgent = response.userAgent;
  }

  setExperimentalApi(enabled: boolean): void {
    this.capabilities.experimentalApi = enabled;
  }

  get(): AdapterCapabilities {
    return { ...this.capabilities };
  }
}
