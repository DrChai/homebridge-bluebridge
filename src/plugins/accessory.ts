import { PlatformAccessory } from 'homebridge';
import type Platform from '@platform';

export default class BLEAccessory<T> implements BLEAccessoryType<T> {
  lastData: T | undefined = undefined;
  context: AccessoryContext;
  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */

  constructor(protected readonly platform: Platform, protected readonly accessory: PlatformAccessory) {
    // set accessory information
    this.context = accessory.context.device;
    const infoSvc = this.accessory.getService(this.platform.Service.AccessoryInformation);
    infoSvc!.setCharacteristic(this.platform.Characteristic.Name, `${this.context.displayName}`);
    if (this.context.sn) {
      infoSvc!.setCharacteristic(this.platform.Characteristic.SerialNumber, this.context.sn);
    }
  }
  getAttr =
    <K extends keyof T>(type: K) =>
    async (): Promise<T[K] | null> => {
      if (!this.lastData) {
        try {
          this.lastData = this.platform.scanner.lastData.get(this.context.id) as T | undefined;
        } catch (err) {
          return this.lastData?.[type] || null;
        }
      }
      return this.lastData?.[type] || null;
    };
}
