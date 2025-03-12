import { PlatformAccessory, Service } from 'homebridge';

import type AirThingsPlatform from '@platform';
import BLEAccessory from '../accessory.js';
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */

export default class Wave2Accessory extends BLEAccessory<WAVE2> {
  private RadonSvc: Service;
  private TempSvc: Service;
  private HumiditySvc: Service;
  lastData: WAVE2 | undefined = undefined;
  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */

  constructor(platform: AirThingsPlatform, accessory: PlatformAccessory) {
    // set accessory information
    super(platform, accessory);
    const { displayRadonSTA, displayRadonLTA } = this.platform.config;
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Airthings')
      .setCharacteristic(this.platform.Characteristic.Model, 'Wave 2');
    const customService = this.platform.CustomService['airthings-wave2'];
    this.RadonSvc = this.accessory.getService(customService) || this.accessory.addService(customService);
    this.TempSvc = this.accessory.getService(this.platform.Service.TemperatureSensor) || this.accessory.addService(this.platform.Service.TemperatureSensor);
    this.HumiditySvc = this.accessory.getService(this.platform.Service.HumiditySensor) || this.accessory.addService(this.platform.Service.HumiditySensor);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.RadonSvc.setCharacteristic(this.platform.Characteristic.Name, `Airthings Radon ${accessory.context.device.id}`);
    this.TempSvc.setCharacteristic(this.platform.Characteristic.Name, `Airthings Temperature ${accessory.context.device.id}`);
    this.HumiditySvc.setCharacteristic(this.platform.Characteristic.Name, `Airthings Humidity ${accessory.context.device.id}`);

    // register handlers for the On/Off Characteristic
    this.TempSvc.getCharacteristic(this.platform.Characteristic.CurrentTemperature).onGet(this.getAttr('temperature'));
    this.HumiditySvc.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity).onGet(this.getAttr('humidity'));
    this.RadonSvc.getCharacteristic(this.platform.Characteristic.AirQuality).onGet(() => {
      this.getAttr('radon_sta');
      return this.calAirQuality(this.lastData);
    });

    if (displayRadonSTA) {
      this.RadonSvc.getCharacteristic(this.platform.CustomCharacteristic.RadonSta).onGet(this.getAttr('radon_sta'));
    }
    if (displayRadonLTA) {
      this.RadonSvc.getCharacteristic(this.platform.CustomCharacteristic.RadonLta).onGet(this.getAttr('radon_lta'));
    }
    /**
     * Updating characteristics values asynchronously.
     *
     * Example showing how to update the state of a Characteristic asynchronously instead
     * of using the `on('get')` handlers.
     * Here we change update the motion sensor trigger states on and off every 10 seconds
     * the `updateCharacteristic` method.
     *
     */

    setInterval(() => {
      const data = this.platform.scanner.lastData.get(this.context.id) as WAVE2;
      const aq = this.calAirQuality(data);
      if (this.lastData?.radon_sta !== data?.radon_sta) {
        this.RadonSvc.updateCharacteristic(this.platform.Characteristic.AirQuality, aq);
      }
      if (data) {
        const { lastUpdateAt } = data;
        const { displayRadonSTA, displayRadonLTA } = this.platform.config;
        if (displayRadonSTA && this.lastData?.radon_sta !== data.radon_sta) {
          this.RadonSvc.updateCharacteristic(this.platform.CustomCharacteristic.RadonSta, data.radon_sta);
        }
        if (displayRadonLTA && this.lastData?.radon_lta !== data.radon_lta) {
          this.RadonSvc.updateCharacteristic(this.platform.CustomCharacteristic.RadonLta, data.radon_lta);
        }

        this.RadonSvc.updateCharacteristic(this.platform.Characteristic.StatusActive, Date.now() / 1000 - lastUpdateAt / 1000 < 2 * 3600);
      }
      this.TempSvc.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, data?.temperature || 0);
      this.HumiditySvc.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, data?.humidity || 0);
      this.platform.log.debug('Refreshing AirThingsPlatform:', data);
      this.lastData = data;
    }, this.platform.config.refreshTime * 1000);
  }
  calAirQuality = (lastData: WAVE2 | undefined): number => {
    const radon_sta = lastData?.radon_sta;
    let aq = this.platform.Characteristic.AirQuality.UNKNOWN;
    if (!radon_sta) {
      return aq;
    }
    if (radon_sta >= 150) {
      aq = this.platform.Characteristic.AirQuality.POOR;
    } else if (radon_sta >= 100) {
      aq = this.platform.Characteristic.AirQuality.FAIR;
    } else if (radon_sta >= 50) {
      aq = this.platform.Characteristic.AirQuality.GOOD;
    } else {
      aq = this.platform.Characteristic.AirQuality.EXCELLENT;
    }
    return aq;
  };
}
