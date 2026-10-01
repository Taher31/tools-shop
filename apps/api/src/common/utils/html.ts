import sanitizeHtml from 'sanitize-html';

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    'ul',
    'ol',
    'li',
    'h2',
    'h3',
    'h4',
    'blockquote',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'a',
    'hr',
    'span',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'rel', 'target'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }),
  },
};

/**
 * Rich text written by staff (product descriptions, content pages) is stored as
 * sanitized HTML. Plain text input is converted to paragraphs.
 */
export function sanitizeRichText(input: string | null | undefined): string | null {
  if (!input) return null;
  const html = /<[a-z][\s\S]*>/i.test(input)
    ? input
    : input
        .split(/\n{2,}/)
        .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
        .join('\n');
  const clean = sanitizeHtml(html, OPTIONS).trim();
  return clean.length > 0 ? clean : null;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Plain text from stored rich text (for AI context, feeds and previews). */
export function stripHtml(html: string): string {
  return sanitizeHtml(
    html.replace(/<\/(p|li|h[1-6]|tr|br)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n'),
    {
      allowedTags: [],
      allowedAttributes: {},
    },
  )
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
