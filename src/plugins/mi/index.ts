import { Peripheral } from '@abandonware/noble';
import parse, { MiSensorData } from './parser.js';
import MiAccessory from './accessory.js';
import AirThingsPlatform from '@platform';
import { PlatformAccessory } from 'homebridge';

const MiThermometer: PluginProfile<MiSensorData> = {
  keepCached: true,
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
      keepCached: true,
      displayName: localName || 'Mi Thermometer',
    };
  },
  newAccessory: (platform: AirThingsPlatform, accessory: PlatformAccessory) => new MiAccessory(platform, accessory),
};

export { MiSensorData };
export default MiThermometer;
