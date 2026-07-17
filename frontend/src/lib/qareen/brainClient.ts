import type { BrainConversationTurn } from './types';
import type { QareenPageContext } from './pageContext';

export interface SseEvent {
  type: 'line' | 'done' | 'error' | string;
  data: Record<string, unknown>;
}

export interface BrainRequestBody {
  message: string;
  history: BrainConversationTurn[];
  interrupted?: boolean;
  current_pathname?: string;
  page_context?: QareenPageContext;
}

function parseSseBlock(block: string): SseEvent | null {
  let type = 'message';
  let dataLine = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event: ')) type = line.slice(7).trim();
    else if (line.startsWith('data: ')) dataLine += line.slice(6);
  }
  if (!dataLine) return null;
  try {
    return { type, data: JSON.parse(dataLine) };
  } catch {
    return null;
  }
}

/**
 * Reads the backend's SSE stream via fetch (not EventSource — we need a
 * POST body for the conversation history). Yields one event per `line`
 * the backend flushes, then a final `done` event.
 */
export async function* streamBrainResponse(request: BrainRequestBody): AsyncGenerator<SseEvent> {
  // /api/backend/* is the Next.js proxy prefix; the backend's own routes
  // are additionally mounted under /api — see api.ts's API_BASE comment.
  const res = await fetch('/api/backend/api/qareen/brain/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Qareen brain stream failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex !== -1) {
      const rawBlock = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      const event = parseSseBlock(rawBlock);
      if (event) yield event;
      separatorIndex = buffer.indexOf('\n\n');
    }
  }
}
