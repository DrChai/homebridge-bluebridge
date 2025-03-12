import { PlatformAccessory, Service } from 'homebridge';
import type AirThingsPlatform from '@platform';
import BLEAccessory from '../accessory.js';
import { ThermoData, BatteryInfo } from './parser.js';

type AccesoryData = ThermoData & BatteryInfo & { lastUpdateAt: number };
export default class MiAccessory extends BLEAccessory<AccesoryData> {
  private TempSvc: Service;
  private HumiditySvc: Service;
  private BatterySvc: Service;

  constructor(platform: AirThingsPlatform, accessory: PlatformAccessory) {
    // set accessory information
    super(platform, accessory);
    this.TempSvc = this.accessory.getService(this.platform.Service.TemperatureSensor) || this.accessory.addService(this.platform.Service.TemperatureSensor);
    this.HumiditySvc = this.accessory.getService(this.platform.Service.HumiditySensor) || this.accessory.addService(this.platform.Service.HumiditySensor);
    this.BatterySvc = this.accessory.getService(this.platform.Service.Battery) || this.accessory.addService(this.platform.Service.Battery);

    this.TempSvc.setCharacteristic(this.platform.Characteristic.Name, `Temperature ${this.context.id}`);
    this.HumiditySvc.setCharacteristic(this.platform.Characteristic.Name, `Humidity ${this.context.id}`);
    this.BatterySvc.setCharacteristic(this.platform.Characteristic.Name, `Battery ${this.context.id}`);

    this.TempSvc.getCharacteristic(this.platform.Characteristic.CurrentTemperature).onGet(this.getAttr('temperature'));
    this.HumiditySvc.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity).onGet(this.getAttr('humidity'));
    this.BatterySvc.getCharacteristic(this.platform.Characteristic.BatteryLevel).onGet(this.getAttr('battery'));

    setInterval(() => {
      const data = this.platform.scanner.lastData.get(this.context.id) as AccesoryData;
      if (data) {
        if (this.lastData?.battery !== data?.battery) {
          this.BatterySvc.updateCharacteristic(this.platform.Characteristic.BatteryLevel, data.battery);
        }
        this.TempSvc.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, data.temperature);
        this.HumiditySvc.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, data.humidity);

      }
      this.platform.log.debug('Refreshing MiAccessory:', data);
      this.lastData = data;
    }, this.platform.config.refreshTime * 1000);
  }
}
