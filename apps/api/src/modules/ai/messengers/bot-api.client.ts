import type { MessengerChannel } from '@toolshop/shared';

export class BotApiError extends Error {
  constructor(
    readonly method: string,
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

interface BotApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

/** Messages longer than this are split (Telegram's limit is 4096 characters). */
const MAX_MESSAGE = 3900;

/**
 * Minimal client for the Telegram Bot API, which Bale implements with the same methods
 * (https://tapi.bale.ai/bot<token>/<method>). Only documented methods are used:
 * getMe, setWebhook, deleteWebhook, sendMessage and sendChatAction.
 */
export class BotApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly timeoutMs = 10_000,
  ) {}

  async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      // Never include the URL: it contains the bot token.
      const reason =
        error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network';
      throw new BotApiError(method, `connection failed (${reason})`, null);
    }
    const body = (await response.json().catch(() => null)) as BotApiResponse<T> | null;
    if (!response.ok || !body?.ok) {
      throw new BotApiError(
        method,
        body?.description?.slice(0, 200) ?? `HTTP ${response.status}`,
        response.status,
      );
    }
    return body.result as T;
  }

  getMe(): Promise<{ id: number; username?: string; first_name?: string }> {
    return this.call('getMe');
  }

  setWebhook(url: string, secretToken: string | null): Promise<boolean> {
    return this.call('setWebhook', {
      url,
      allowed_updates: ['message'],
      ...(secretToken ? { secret_token: secretToken } : {}),
    });
  }

  async sendText(chatId: string, text: string, replyTo?: number): Promise<void> {
    for (const [index, chunk] of splitMessage(text).entries()) {
      await this.call('sendMessage', {
        chat_id: chatId,
        text: chunk,
        ...(index === 0 && replyTo ? { reply_to_message_id: replyTo } : {}),
      });
    }
  }

  async typing(chatId: string): Promise<void> {
    await this.call('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => undefined);
  }
}

/** Splits on paragraph/line boundaries so long answers stay readable. */
export function splitMessage(text: string, max = MAX_MESSAGE): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < max / 2) cut = rest.lastIndexOf(' ', max);
    if (cut < max / 2) cut = max;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export interface MessengerPlatform {
  channel: MessengerChannel;
  /** Whether a documented two-way bot API is implemented. */
  available: boolean;
  note: string;
  /** Telegram supports the X-Telegram-Bot-Api-Secret-Token header on webhooks. */
  secretHeader: string | null;
  apiBase(): string | null;
}

export const MESSENGER_PLATFORMS: Record<MessengerChannel, MessengerPlatform> = {
  telegram: {
    channel: 'telegram',
    available: true,
    note: 'ربات را با @BotFather بسازید و توکن را وارد کنید. اگر سرور به api.telegram.org دسترسی ندارد، نشانی یک Bot API Server یا پراکسی را در TELEGRAM_API_BASE تنظیم کنید.',
    secretHeader: 'x-telegram-bot-api-secret-token',
    apiBase: () => process.env['TELEGRAM_API_BASE'] || 'https://api.telegram.org',
  },
  bale: {
    channel: 'bale',
    available: true,
    note: 'ربات را با @botfather در بله بسازید. API ربات بله با Bot API تلگرام سازگار است (tapi.bale.ai).',
    secretHeader: null,
    apiBase: () => process.env['BALE_API_BASE'] || 'https://tapi.bale.ai',
  },
  eitaa: {
    channel: 'eitaa',
    available: false,
    // TODO(eitaa): implement once Eitaa publishes an official two-way bot API (receiving
    // user messages via webhook). The public "Eitaayar" API only posts to channels.
    note: 'ایتا هنوز API رسمی و مستند برای دریافت پیام کاربران توسط ربات منتشر نکرده است؛ پس از انتشار مستندات رسمی، آداپتور آن اضافه می‌شود.',
    secretHeader: null,
    apiBase: () => null,
  },
};
