import type Anthropic from '@anthropic-ai/sdk';
import { toEnglishDigits } from '@toolshop/shared';
import type { LlmClient, LlmRequest } from './llm-client';

type Block = Anthropic.Beta.BetaContentBlock;

function lastUserContent(request: LlmRequest): Anthropic.Beta.BetaMessageParam['content'] {
  const last = [...request.messages].reverse().find((m) => m.role === 'user');
  return last?.content ?? '';
}

function textOf(content: Anthropic.Beta.BetaMessageParam['content']): string {
  if (typeof content === 'string') return content;
  return content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join(' ')
    .trim();
}

/**
 * Deterministic stand-in for Claude, used when no API key is configured (development,
 * CI, demos). It follows the real protocol – tool_use → tool_result → final text – so
 * the whole agent pipeline, persistence and streaming are exercised without network.
 */
export class MockLlmClient implements LlmClient {
  readonly provider = 'mock' as const;

  async stream(
    request: LlmRequest,
    onText?: (delta: string) => void,
  ): Promise<Anthropic.Beta.BetaMessage> {
    const tools = new Set((request.tools ?? []).map((tool) => ('name' in tool ? tool.name : '')));
    const content = lastUserContent(request);
    const toolResults =
      typeof content === 'string' ? [] : content.filter((b) => b.type === 'tool_result');
    let blocks: Block[];

    if (request.output_config?.format) {
      blocks = [this.text(JSON.stringify(this.structured(request)))];
    } else if (toolResults.length === 0 && tools.size > 0) {
      const question = textOf(content);
      const orderNumber = /سفارش\D*(\d{5,9})/.exec(toEnglishDigits(question))?.[1];
      blocks =
        orderNumber && tools.has('get_order_status')
          ? [this.toolUse('get_order_status', { order_number: Number(orderNumber) })]
          : tools.has('search_products')
            ? [this.toolUse('search_products', { query: question.slice(0, 120), limit: 3 })]
            : [this.text(`پاسخ آزمایشی: ${question}`)];
    } else if (toolResults.length > 0) {
      const result = toolResults[0];
      const raw =
        result && result.type === 'tool_result' && typeof result.content === 'string'
          ? result.content
          : '{}';
      const data = JSON.parse(raw) as {
        products?: { slug: string; title: string }[];
        status?: string;
        message?: string;
      };
      if (data.products && data.products.length > 0 && tools.has('show_products')) {
        const alreadyShown = /"shown"/.test(raw);
        blocks = alreadyShown
          ? [
              this.text(
                `این محصولات را پیشنهاد می‌کنم:\n${data.products.map((p) => `• ${p.title}`).join('\n')}`,
              ),
            ]
          : [
              this.toolUse('show_products', {
                slugs: data.products.map((p) => p.slug).slice(0, 3),
              }),
            ];
      } else {
        blocks = [
          this.text(
            data.message ?? data.status ?? 'متأسفانه موردی پیدا نکردم. لطفاً دقیق‌تر بنویسید.',
          ),
        ];
      }
    } else {
      blocks = [this.text('پاسخ آزمایشی دستیار.')];
    }

    for (const block of blocks) if (block.type === 'text') onText?.(block.text);
    const inputChars =
      JSON.stringify(request.messages).length + JSON.stringify(request.system ?? '').length;
    return {
      id: `msg_mock_${Date.now().toString(36)}`,
      type: 'message',
      role: 'assistant',
      model: request.model,
      content: blocks,
      stop_reason: blocks.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: Math.ceil(inputChars / 4),
        output_tokens: Math.ceil(JSON.stringify(blocks).length / 4),
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    } as unknown as Anthropic.Beta.BetaMessage;
  }

  /** Plausible JSON for structured-output requests, keyed by the schema's properties. */
  private structured(request: LlmRequest): Record<string, unknown> {
    const format = request.output_config?.format as
      { schema?: { properties?: Record<string, unknown> } } | undefined;
    const keys = Object.keys(format?.schema?.properties ?? {});
    const prompt = textOf(lastUserContent(request));
    const sample: Record<string, unknown> = {
      answer: 'بر اساس مشخصات فنی ثبت‌شده، این کالا برای این کاربرد مناسب است. (پاسخ آزمایشی)',
      reply: 'سلام، درخواست شما بررسی شد و در اولین فرصت پیگیری می‌شود. (پیش‌نویس آزمایشی)',
      confidence: 0.6,
      needs_human: true,
      notes: 'پاسخ آزمایشی – کلید API تنظیم نشده است.',
      summary: prompt.slice(0, 120),
      sentiment: /فوری|عصبانی|شکایت|کسر شد/.test(prompt) ? 'negative' : 'neutral',
      priority: /کسر شد|پرداخت/.test(prompt) ? 'high' : 'normal',
      category: /پرداخت/.test(prompt) ? 'payment' : 'other',
      short_description: 'توضیح کوتاه آزمایشی محصول.',
      description: '<p>توضیحات آزمایشی محصول بر اساس مشخصات فنی.</p>',
      seo_title: 'عنوان سئو آزمایشی',
      seo_description: 'توضیح متا آزمایشی برای موتورهای جستجو.',
      tags: ['ابزار', 'آزمایشی'],
    };
    return Object.fromEntries(keys.map((key) => [key, sample[key] ?? '']));
  }

  private text(text: string): Block {
    return { type: 'text', text, citations: null } as Block;
  }

  private toolUse(name: string, input: Record<string, unknown>): Block {
    return {
      type: 'tool_use',
      id: `toolu_mock_${Math.random().toString(36).slice(2, 10)}`,
      name,
      input,
    } as Block;
  }
}
