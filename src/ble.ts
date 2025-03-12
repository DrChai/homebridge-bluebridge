import { Peripheral } from '@abandonware/noble';
import { Logging } from 'homebridge';
import { assert } from 'node:console';

// Utility function to simulate sleep

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export default class {
  curState: string = 'unknown';
  isScanning: boolean = false;
  discoveredDeivces: AccessoryContext[] = [];
  discoveredPeripherals: Map<string, Peripheral> = new Map();
  lastData: Map<string, object> = new Map();
  private stopRunner: boolean = false;
  config: BleConfig;
  private curScanMode: 'init' | 'read' = 'read';
  startScanning: () => void;
  stopScanning: () => void;
  constructor(private readonly plugins: PluginMap, bleConfig: BleConfig, private readonly log: Logging) {
    // Configs
    this.config = {
      ...bleConfig,
      scanTime: bleConfig.scanTime < 10 * 1000 ? 10 * 1000 : bleConfig.scanTime,
      refreshTime: bleConfig.refreshTime < 5 * 60 * 1000 ? 5 * 60 * 1000 : bleConfig.refreshTime,
    };
    this.startScanning = () => {
      throw new Error('[BLE] Bluetooth(noble) is not available');
    };
    this.stopScanning = () => {
      throw new Error('[BLE] Bluetooth(noble) is not available');
    };

    this.initNoble()
      .then(() => this.log.info('[BLE] Bluetooth(noble) is ready!'))
      .catch((err) => {
        this.log.error('[BLE] Bluetooth(noble) is not available');
        this.log.error(err);
      });
  }

  async initNoble() {
    const noble = (await import('@abandonware/noble')).default;
    noble.on('scanStart', () => {
      this.log.debug('[BLE] starting the discover.');
    });
    noble.on('scanStop', () => {
      this.log.debug('[BLE] stopped the discover.');
    });

    noble.on('stateChange', (state: string) => {
      this.curState = state;
      if (state === 'poweredOn') {
        this.log.debug('[BLE] Adapter is powered on.');
      } else {
        this.log.error('[BLE] %s.', state);
        this.stopScanning();
      }
    });
    noble.on('discover', this.sensorStartDiscovery);
    this.startScanning = () => {
      this.isScanning = true;
      noble.startScanning([], true);
    };
    this.stopScanning = () => {
      this.isScanning = false;
      noble.stopScanning();
    };
  }

  getValidatedDevices = async (): Promise<AccessoryContext[]> => {
    if (this.curState !== 'poweredOn') {
      this.log.debug('[BLE] Adapter is not powered on. Waiting for state to change...');
      await new Promise((resolve) => {
        const checkState = () => {
          if (this.curState === 'poweredOn') {
            resolve(null);
          } else {
            this.log.info(`[BLE] bluetooth state: ${this.curState}. rechecking after ${this.config.retryAfter / 1000}s.`);
            setTimeout(checkState, this.config.retryAfter);
          }
        };
        checkState();
      });
    }
    await this.startScanningFor('init');
    if (this.discoveredDeivces.length === 0) {
      this.log.error(`[BLE] No devices found. Retrying after${this.config.retryAfter / 1000}`);
      await sleep(this.config.retryAfter);
      return this.getValidatedDevices();
    }
    return this.discoveredDeivces;
  };

  sensorStartDiscovery = (peripheral: Peripheral) => {
    const { advertisement: { serviceData } = {}, id } = peripheral;
    if (this.curScanMode === 'init') {
      Object.keys(this.plugins).forEach((name) => {
        const plugin = this.plugins[name];
        if (plugin.validate(peripheral) && !this.discoveredPeripherals.has(id)) {
          // peripheral.on('connect', (error: string) => this.log.debug(`[BLE] [${sn.toString()}] connected with: ${error}`));
          // peripheral.on('disconnect', (error: string) => this.log.debug(`[BLE] [${sn.toString()}] disconnected with: ${error}`));
          const conext = plugin.context(peripheral);
          this.discoveredPeripherals.set(conext.id, peripheral);
          this.discoveredDeivces.push(conext);
        }
      });
    } else {
      const knownDevices = this.discoveredDeivces.filter((context) => this.plugins[context.pluginName].readOn === 'advertising');
      const device = knownDevices.find((context) => peripheral.id === context.id);
      if (device) {
        const plugin = this.plugins[device.pluginName];
        const svc = serviceData?.find((svc) => svc.uuid.toLowerCase() === plugin.uuid);
        if (svc) {
          const data = plugin.parse(svc.data);
          this.log.debug(`[BLE] got ${plugin.name}[${device.id}] advertising data:`, data);
          const updateData = { ...this.lastData.get(device.id), ...data, lastUpdateAt: Date.now() };
          this.lastData.set(device.id, updateData);
        }
      }
    }
  };
  startRunner = async () => {
    // Check if the stop flag is set
    if (this.stopRunner) {
      this.log.debug('[BLE] Runner stopped.');
      return;
    }
    this.startScanningFor('read');
    for (const context of this.discoveredDeivces.filter((context) => this.plugins[context.pluginName].readOn === 'connecting')) {
      try {
        // Wait for either getData to complete or timeout after 5 seconds
        await Promise.race([
          sleep(this.config.scanTime),
          this.getData(context), // Fetch data
        ]);
      } catch (error) {
        this.log.error(`[BLE] Error getting data for ${context.id}. current timeout in ${this.config.scanTime}:`, error);
      }
    }
    this.log.debug(`[BLE] Go sleeping... next sync will be scheduled in ${this.config.refreshTime / 1000 / 60}mins. `);
    await sleep(this.config.refreshTime);

    this.startRunner();
  };

  getData = async (device: AccessoryContext): Promise<object> => {
    const peripheral = this.discoveredPeripherals.get(device.id);

    if (!peripheral) {
      this.log.error(`[BLE] Peripheral not found for device ${device.id}`);
      throw new Error(`Peripheral not found for device ${device.id}`);
    }
    const pluginProfile = this.plugins[device.pluginName];
    assert(pluginProfile.readOn === 'connecting');
    if (peripheral.state !== 'disconnected') {
      this.log.warn(`Peripheral state is "${peripheral.state}".`);
      switch (peripheral.state) {
        case 'connecting':
          // consider awaitable lock here
          //peripheral.cancelConnect();
          throw new Error('other accessories is requsted to connect already');
        case 'connected':
          return this.lastData.get(device.id)!;
        case 'error':
          this.log.error(`[BLE] Peripheral ${device.id} has an error state. Refreshing devices.`);
          this.clear();
          await this.getValidatedDevices();
          break;
      }
    }
    // consider add awaitable lock here
    await peripheral.connectAsync();
    const char = await peripheral.discoverSomeServicesAndCharacteristicsAsync([], [pluginProfile.uuid]);
    const buf = await char.characteristics[0].readAsync();
    await this.disconnect(peripheral);
    const data = pluginProfile.parse(buf);
    this.log.debug(`[BLE] got ${pluginProfile.name}[${device.id}] connected data:`, data);
    const updateData = { ...this.lastData.get(device.id), ...data, lastUpdateAt: Date.now() };
    this.lastData.set(device.id, updateData);
    return this.lastData.get(device.id)!;
  };

  disconnect = async (peripheral: Peripheral) => {
    await Promise.race([sleep(1000 * 5), peripheral.disconnectAsync()]);
  };
  // Method to stop the runner
  stop = () => {
    this.stopRunner = true;
    this.stopScanning();
    this.log.debug('[BLE] Stop flag set. Runner will stop after current iteration.');
  };
  startScanningFor = async (mode: 'init' | 'read', time?: number) => {
    this.startScanning();
    this.curScanMode = mode;
    await new Promise((resolve) => {
      setTimeout(() => {
        this.stopScanning();
        this.log.debug(`[BLE] Scan complete. after scanTime: ${this.config.scanTime / 1000}s`);
        resolve(null);
      }, time || this.config.scanTime);
    });
  };

  clear = () => {
    this.stop();
    this.discoveredDeivces = [];
    this.discoveredPeripherals.clear();
    this.lastData.clear();
  };
}
