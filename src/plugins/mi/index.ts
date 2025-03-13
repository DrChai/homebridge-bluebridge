import { Peripheral } from '@abandonware/noble';
import parse, { MiSensorData } from './parser.js';
import MiAccessory from './accessory.js';
import Platform from '@platform';
import { PlatformAccessory } from 'homebridge';

const MiThermometer: PluginProfile<MiSensorData> = {
  autoRemove: true,
  readOn: 'advertising',
  name: 'mi-thermometer',
  uuid: 'fe95',
  parse,
  validate: (peripheral: Peripheral): boolean => {
    const { advertisement: { serviceData } = {} } = peripheral;
    return !!serviceData && !!serviceData.find((data) => data.uuid.toLowerCase() === 'fe95');
  },
  context: (peripheral: Peripheral): AccessoryContext => {
    const { advertisement: { localName } = {}, id, address } = peripheral || {};
    return {
      id: id,
      pluginName: 'mi-thermometer',
      address: address,
      autoRemove: false,
      displayName: localName || 'Mi Thermometer',
    };
  },
  newAccessory: (platform: Platform, accessory: PlatformAccessory) => new MiAccessory(platform, accessory),
};

export { MiSensorData };
export default MiThermometer;
