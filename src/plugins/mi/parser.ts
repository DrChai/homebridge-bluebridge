const EventTypes = {
  temperature: 4100,
  humidity: 4102,
  battery: 4106,
  temperatureAndHumidity: 4109,
};
export type ThermoData = {
  humidity: number;
  temperature: number;
};
export type BatteryInfo = {
  battery: number;
};
export type MiSensorData = (ThermoData | BatteryInfo);

const getEventOffset = (buffer: Buffer): number | null => {
  const frameControl = buffer.readUInt16LE(0);
  if (!(frameControl & (1 << 6))) {
    // hasEvent
    return null;
  }
  let idx = 5;
  if (frameControl & (1 << 4)) {
    // hasMacAddr
    idx = 11;
  }
  if (frameControl & (1 << 5)) {
    // hasCapabilities
    idx += 1;
  }
  return idx;
};

const parser = (buffer: Buffer): MiSensorData => {
  const eventOffset = getEventOffset(buffer);
  if (!eventOffset) {
    throw new Error(`No event: ${buffer.toString('hex')}`);
  }
  const eventType = buffer.readUInt16LE(eventOffset);

  switch (eventType) {
    case EventTypes.battery: {
      return {
        battery: buffer.readUInt8(eventOffset + 3),
      };
    }
    case EventTypes.temperatureAndHumidity: {
      const temperature = buffer.readInt16LE(eventOffset + 3) / 10;
      const humidity = buffer.readUInt16LE(eventOffset + 5) / 10;
      return { temperature, humidity };
    }
    default: {
      throw new Error(`Unknown event type: ${eventType}. ${buffer.toString('hex')}`);
    }
  }
};

export default parser;
