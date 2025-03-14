import { PlatformAccessory, Service } from 'homebridge';
import type Platform from '@platform';
import BLEAccessory from '../accessory.js';
import { ThermoData, BatteryInfo } from './parser.js';

type AccesoryData = ThermoData & BatteryInfo & { lastUpdateAt: number };
export default class MiAccessory extends BLEAccessory<AccesoryData> {
  private TempSvc: Service;
  private HumiditySvc: Service;
  private BatterySvc: Service;

  constructor(platform: Platform, accessory: PlatformAccessory) {
    // set accessory information
    super(platform, accessory);
    this.TempSvc = this.accessory.getService(this.platform.Service.TemperatureSensor) || this.accessory.addService(this.platform.Service.TemperatureSensor);
    this.HumiditySvc = this.accessory.getService(this.platform.Service.HumiditySensor) || this.accessory.addService(this.platform.Service.HumiditySensor);
    this.BatterySvc = this.accessory.getService(this.platform.Service.Battery) || this.accessory.addService(this.platform.Service.Battery);

    this.TempSvc.setCharacteristic(this.platform.Characteristic.Name, 'Mi Temperature');
    this.HumiditySvc.setCharacteristic(this.platform.Characteristic.Name, 'Mi Humidity');
    this.BatterySvc.setCharacteristic(this.platform.Characteristic.Name, 'Mi Battery');

    this.TempSvc.getCharacteristic(this.platform.Characteristic.CurrentTemperature).onGet(this.getAttr('temperature') || 0);
    this.HumiditySvc.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity).onGet(this.getAttr('humidity') || 0);
    this.BatterySvc.getCharacteristic(this.platform.Characteristic.BatteryLevel).onGet(this.getAttr('battery') || 0);

    setInterval(() => {
      const data = this.platform.scanner.lastData.get(this.context.id) as AccesoryData;
      const { temperature, humidity, battery, lastUpdateAt } = data;
      if (data) {
        if (battery && this.lastData?.battery !== battery) {
          this.BatterySvc.updateCharacteristic(this.platform.Characteristic.BatteryLevel, battery);
        }
        if (temperature && humidity) {
          this.TempSvc.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, temperature);
          this.HumiditySvc.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, humidity);
        }
        const isActive = Date.now() / 1000 - lastUpdateAt / 1000 < 2 * 3600;
        this.TempSvc.updateCharacteristic(this.platform.Characteristic.StatusActive, isActive);
        this.HumiditySvc.updateCharacteristic(this.platform.Characteristic.StatusActive, isActive);
      }
      this.platform.log.debug('Refreshing MiAccessory:', data);
      this.lastData = data;
    }, this.platform.config.refreshTime * 1000);
  }
}
