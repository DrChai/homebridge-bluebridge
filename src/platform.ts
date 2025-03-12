import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import Scanner from './ble.js';
import { PluginsIndex, PluginName } from './plugins/index.js';
/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export default class AirThingsPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: Map<string, PlatformAccessory> = new Map();
  public readonly discoveredCacheUUIDs: string[] = [];
  public readonly scanner: Scanner;
  public readonly plugins: PluginMap;
  // This is only required when using Custom Services and Characteristics not support by HomeKit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public CustomService: Record<string, any> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public CustomCharacteristic: any;

  constructor(public readonly log: Logging, public readonly config: PlatformConfig, public readonly api: API) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;
    // this.RadonStaChar = createRadonSta(this.Characteristic);
    // this.RadonLtaChar = newRadonLta(this.Characteristic);
    this.log.debug('Finished initializing platform:', this.config.name);
    this.plugins = Object.keys(PluginsIndex)
      .filter((key): key is PluginName => this.config.plugins.includes(key as PluginName))
      .reduce((plugins, key) => {
        return { ...plugins, [key]: PluginsIndex[key] };
      }, {});
    Object.keys(this.plugins).forEach((name) => {
      if (this.plugins[name].customServiceAndCharacteristics) {
        const customPluginTypes = this.plugins[name].customServiceAndCharacteristics(api, config);
        this.CustomService[name] = customPluginTypes.Service;
        this.CustomCharacteristic = { ...this.CustomCharacteristic, ...customPluginTypes.Characteristics };
      }
    });
    this.scanner = new Scanner(
      this.plugins,
      {
        scanTime: this.config.scanTime * 1000,
        retryAfter: this.config.retryAfter * 1000,
        refreshTime: this.config.refreshTime * 1000,
      },
      this.log,
    );
    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.

    this.api.on('didFinishLaunching', async () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      await this.discoverDevices();
    });
    this.api.on('shutdown', () => this.pluginShutdown());
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.accessories.set(accessory.UUID, accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices = async () => {
    this.log.info(`Discovering Airthings devices for ${this.config.scanTime}s... `);
    const availableDevices = await this.scanner.getValidatedDevices();
    this.log.info('Found Available devices: ', availableDevices);

    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of availableDevices) {
      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.id);

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.get(uuid);

      if (existingAccessory) {
        // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. e.g.:
        // existingAccessory.context.device = device;
        // this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        this.plugins[device.pluginName].newAccessory(this, existingAccessory);
        // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, e.g.:
        // remove platform accessories when no longer present
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device);

        // create a new accessory
        const accessory = new this.api.platformAccessory(device.displayName, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device;

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        this.plugins[device.pluginName].newAccessory(this, accessory);
        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }

      // push into discoveredCacheUUIDs
      this.discoveredCacheUUIDs.push(uuid);
    }

    // you can also deal with accessories from the cache which are no longer present by removing them from Homebridge
    // for example, if your plugin logs into a cloud account to retrieve a device list, and a user has previously removed a device
    // from this cloud account, then this device will no longer be present in the device list but will still be in the Homebridge cache
    for (const [uuid, accessory] of this.accessories) {
      if (!this.discoveredCacheUUIDs.includes(uuid)) {
        this.log.info('Removing existing accessory from cache:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
    this.scanner.startRunner();
  };

  pluginShutdown() {
    // A function that is called when the plugin fails to load or Homebridge restarts
    try {
      // Stop the refresh intervals
      this.scanner?.clear();
    } catch (err) {
      // No need to show errors at this point
    }
  }
}
