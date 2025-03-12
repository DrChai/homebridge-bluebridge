import { Peripheral } from '@abandonware/noble';
import { parseWave2Rawdata, parseSerial } from './parser.js';
import Wave2Accessory from './accessory.js';
import Platform from '@platform';
import { PlatformAccessory } from 'homebridge';
import AirthingsTypes from './customCharacteristics.js';

type AirthingsConfig = {
  displayRadonSTA?: boolean;
  displayRadonLTA?: boolean;
};
const AirthingsWave2: PluginProfile<WAVE2> = {
  autoRemove: true,
  readOn: 'connecting',
  name: 'airthings-wave2',
  uuid: 'b42e4dccade711e489d3123b93f75cba',
  parse: parseWave2Rawdata,
  validate: (peripheral: Peripheral): boolean => {
    const { advertisement: { manufacturerData } = {} } = peripheral;
    const sn = manufacturerData && parseSerial(manufacturerData);
    return !!sn;
  },

  context: (peripheral: Peripheral): AccessoryContext => {
    const { advertisement: { manufacturerData, localName } = {}, id, address } = peripheral || {};
    return {
      sn: (manufacturerData && parseSerial(manufacturerData)) || undefined,
      pluginName: 'airthings-wave2',
      address,
      id,
      displayName: localName || 'Airthings Wave2',
    };
  },
  newAccessory: (platform: Platform, accessory: PlatformAccessory) => new Wave2Accessory(platform, accessory),
  customServiceAndCharacteristics: (homebridge, config) => {
    const { displayRadonSTA, displayRadonLTA } = config as AirthingsConfig;
    return new AirthingsTypes(homebridge, displayRadonSTA, displayRadonLTA);
  },
};

export default AirthingsWave2;
