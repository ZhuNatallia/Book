export interface StreamingRecognizer<Result> {
  listen: (callback: (result: Result) => void, config: Record<string, unknown>) => Promise<void>;
  stopListening: () => Promise<void>;
  isListening: () => boolean;
}

export interface LocalListenHandle {
  stop: () => Promise<void>;
  started: Promise<boolean>;
}

const pending = new WeakMap<object, Promise<unknown>>();
const owner = new WeakMap<object, object>();

// speech-commands only marks itself as streaming after the phone hands over the
// microphone, and stopListening() throws before that. A stop that lands in this
// window used to be lost, so the model kept the mic for the rest of the session:
// speech recognition could not hear «дальше», and step dictation heard nothing.
// A second listen() in the same window opens another stream that is never closed,
// so sessions on one recognizer run strictly one after another, and a late stop
// only closes the stream its own session opened.
export function listenLocal<Result>(
  recognizer: StreamingRecognizer<Result>,
  callback: (result: Result) => void,
  config: Record<string, unknown>,
): LocalListenHandle {
  const session = {};
  let released = false;
  const halt = async () => {
    if (!recognizer.isListening()) return;
    await recognizer.stopListening().catch(() => undefined);
  };
  const haltOwn = async () => {
    if (owner.get(recognizer) !== session) return;
    owner.delete(recognizer);
    await halt();
  };
  const previous = pending.get(recognizer) ?? Promise.resolve();
  const started = (async () => {
    await previous.catch(() => undefined);
    if (released) return false;
    // A stream nobody owns any more is left over from a lost stop.
    await halt();
    await recognizer.listen(callback, config);
    owner.set(recognizer, session);
    if (!released) return true;
    await haltOwn();
    return false;
  })();
  pending.set(recognizer, started.catch(() => undefined));
  return {
    started,
    stop: async () => {
      released = true;
      await started.catch(() => undefined);
      await haltOwn();
    },
  };
}
