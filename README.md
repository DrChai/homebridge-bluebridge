# Bluebridge

## Overview and Purpose

If you've come across this repository, you may have noticed that the Bluetooth module [noble](https://www.npmjs.com/package/@abandonware/noble) doesn’t function correctly when multiple Bluetooth plugins are integrated into the same Homebridge hub.
I built this plugin to serve as a Bluetooth gateway and allow my two bluetooth devices (Mi thermometer and Airthings sensor) to be read without interference in my Raspberry Pi with single bluetooth adapter.

## The interface of bluetooth profile:

A central Bluetooth instance will register all Bluetooth devices that implement the interface below. This allows for connection management and data parsing.

```typescript
interface PluginProfile<D> {
  name: string;
  autoRemove: boolean;
  readOn: ReadOnType;
  uuid: string;
  parse(buffer: Buffer): D;
  validate(peripheral: import('@abandonware/noble').Peripheral): boolean;
  context(peripheral: import('@abandonware/noble').Peripheral): AccessoryContext;
  newAccessory(platform: import('homebridge').DynamicPlatformPlugin, accessory: import('homebridge').PlatformAccessory): BLEAccessoryType<D>;
  customServiceAndCharacteristics?(homebridge: never, config: object): CustomTypes;
}
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
