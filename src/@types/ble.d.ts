interface BleConfig {
  scanTime: number;
  refreshTime: number;
  retryAfter: number;
}

type BLEData = {
  plugin: string;
};

interface AccessoryContext {
  sn?: string;
  displayName: string;
  id: string;
  address: string;
  keepCached?: boolean;
  pluginName: string;
}


