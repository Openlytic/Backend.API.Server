import { EventEmitter } from 'node:events'

// In-memory PubSub (single instance), mirroring Gain.io's subscription.js.
// Extend to Redis/RabbitMQ before scaling horizontally.
export const eventEmitter = new EventEmitter()

export const pubsub = {
  publish: (triggerName: string, payload: unknown) => eventEmitter.emit(triggerName, payload),
  subscribe: (triggerName: string) => ({
    [Symbol.asyncIterator]: () => {
      const queue: unknown[] = []
      let resolver: ((value: { value: Record<string, unknown>; done: boolean }) => void) | null = null
      eventEmitter.on(triggerName, (payload) => {
        if (resolver) {
          resolver({ value: { [triggerName]: payload }, done: false })
          resolver = null
        } else {
          queue.push(payload)
        }
      })
      return {
        next: () =>
          queue.length
            ? Promise.resolve({ value: { [triggerName]: queue.shift() }, done: false })
            : new Promise((resolve) => {
                resolver = resolve
              }),
        return: () => {
          eventEmitter.removeAllListeners(triggerName)
          return Promise.resolve({ done: true })
        }
      }
    }
  })
}
