import { EventEmitter } from "events";

const globalForBus = globalThis as unknown as {
  _eventBus?: EventEmitter;
};

const bus = globalForBus._eventBus ?? (globalForBus._eventBus = new EventEmitter());
bus.setMaxListeners(200);

const noop = () => Promise.resolve(null);

export const redis = {
  get: noop,
  set: noop,
  del: noop,
  publish: (channel: string, message: string) => {
    bus.emit("message", channel, message);
    return Promise.resolve(1);
  },
  subscribe: (...channels: string[]) => Promise.resolve(),
  on: (event: string, callback: (...args: any[]) => void) => {
    bus.on(event, callback);
    return redis;
  },
  duplicate: () => {
    return {
      subscribe: (...channels: string[]) => Promise.resolve(),
      on: (event: string, callback: (...args: any[]) => void) => {
        bus.on(event, callback);
      },
      disconnect: () => {
        // cleanup if needed
      }
    };
  },
  connect: noop,
  disconnect: noop,
  quit: noop,
};


