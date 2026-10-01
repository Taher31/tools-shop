const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const TEENS = [
  'ده',
  'یازده',
  'دوازده',
  'سیزده',
  'چهارده',
  'پانزده',
  'شانزده',
  'هفده',
  'هجده',
  'نوزده',
];
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUNDREDS = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'هزار میلیارد'];

function belowThousand(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (hundreds) parts.push(HUNDREDS[hundreds] ?? '');
  if (rest >= 10 && rest < 20) parts.push(TEENS[rest - 10] ?? '');
  else {
    const tens = Math.floor(rest / 10);
    const ones = rest % 10;
    if (tens) parts.push(TENS[tens] ?? '');
    if (ones) parts.push(ONES[ones] ?? '');
  }
  return parts.join(' و ');
}

/**
 * Writes an integer in Persian words, as required on official invoices
 * ("مبلغ به حروف"), e.g. 1250000 → "یک میلیون و دویست و پنجاه هزار".
 */
export function numberToPersianWords(input: number): string {
  if (!Number.isFinite(input)) return '';
  const value = Math.trunc(Math.abs(input));
  if (value === 0) return 'صفر';
  if (value >= 1e15) return String(value);
  const groups: string[] = [];
  let remaining = value;
  let scale = 0;
  while (remaining > 0) {
    const chunk = remaining % 1000;
    if (chunk) groups.unshift([belowThousand(chunk), SCALES[scale]].filter(Boolean).join(' '));
    remaining = Math.floor(remaining / 1000);
    scale += 1;
  }
  const words = groups.join(' و ');
  return input < 0 ? `منفی ${words}` : words;
}
