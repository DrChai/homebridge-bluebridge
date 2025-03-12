type ReadOnType = 'advertising' | 'connecting';

interface BLEAccessoryType<D> {
  lastData: D | undefined;
  context: AccessoryContext;
}
interface CustomTypes {
  Service: unknown;
  Characteristics: object;
}

interface PluginProfile<D> {
  name: string;
  autoRemove: boolean;
  readOn: ReadOnType;
  uuid: string;
  parse(buffer: Buffer): D;
  validate(peripheral: import('@abandonware/noble').Peripheral): boolean;
  context(peripheral: import('@abandonware/noble').Peripheral): AccessoryContext;
  newAccessory(platform: import('homebridge').DynamicPlatformPlugin, accessory: import('homebridge').PlatformAccessory): BLEAccessoryType<D>;
  customServiceAndCharacteristics?(homebridge: unknown, config: object): CustomTypes;
}
type PluginMap = Record<string, PluginProfile<object>>;
