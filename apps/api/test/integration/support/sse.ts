import type { AssistantStreamEvent } from '@toolshop/shared';
import type { Test } from 'supertest';

/** Sends a request whose response is text/event-stream and returns the parsed events. */
export async function sse(
  request: Test,
): Promise<{ status: number; events: AssistantStreamEvent[]; body: unknown }> {
  const response = await request.buffer(true).parse((res, callback) => {
    let data = '';
    res.setEncoding('utf8');
    res.on('data', (chunk: string) => (data += chunk));
    res.on('end', () => callback(null, data));
  });
  const raw = String(response.body ?? '');
  if (!String(response.headers['content-type'] ?? '').includes('text/event-stream')) {
    return { status: response.status, events: [], body: raw ? (JSON.parse(raw) as unknown) : null };
  }
  const events = raw
    .split('\n\n')
    .map((chunk) => chunk.split('\n').find((line) => line.startsWith('data: ')))
    .filter((line): line is string => Boolean(line))
    .map((line) => JSON.parse(line.slice(6)) as AssistantStreamEvent);
  return { status: response.status, events, body: null };
}
