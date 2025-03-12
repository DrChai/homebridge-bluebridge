import MiThermometer from './mi/index.js';
import AirthingsWave2 from './airthings/index.js';
export const PluginsIndex: PluginMap = {
  'mi-thermometer': MiThermometer,
  'airthings-wave2': AirthingsWave2,
};
export { AirthingsWave2, MiThermometer };
export type PluginName = keyof typeof PluginsIndex;
