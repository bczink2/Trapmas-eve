/** Read a short prefix, then expose the rest of the body without holding the file. */
export async function splitPrefix(
  stream: ReadableStream<Uint8Array>,
  size: number,
): Promise<{ prefix: Uint8Array; rest: ReadableStream<Uint8Array> }> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  while (got < size) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.byteLength;
  }
  const merged = concatChunks(chunks);
  const prefix = merged.slice(0, size);
  const leftover = merged.slice(size);
  const rest = new ReadableStream<Uint8Array>({
    start(controller) {
      if (leftover.byteLength) controller.enqueue(leftover);
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return { prefix, rest };
}

export function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

/** Prefix first, then the remainder, while hashing every byte that passes through. */
export function prefixThenRest(
  prefix: Uint8Array,
  rest: ReadableStream<Uint8Array>,
  onChunk: (chunk: Uint8Array) => void,
): ReadableStream<Uint8Array> {
  let restReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let sentPrefix = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!sentPrefix) {
        sentPrefix = true;
        if (prefix.byteLength) {
          onChunk(prefix);
          controller.enqueue(prefix);
          return;
        }
      }
      restReader ??= rest.getReader();
      const { done, value } = await restReader.read();
      if (done) {
        controller.close();
        return;
      }
      onChunk(value);
      controller.enqueue(value);
    },
    cancel(reason) {
      return rest.cancel(reason);
    },
  });
}
