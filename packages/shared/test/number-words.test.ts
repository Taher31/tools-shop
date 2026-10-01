import { describe, expect, it } from 'vitest';
import { numberToPersianWords } from '../src';

describe('numberToPersianWords', () => {
  it.each([
    [0, 'صفر'],
    [7, 'هفت'],
    [15, 'پانزده'],
    [40, 'چهل'],
    [105, 'یکصد و پنج'],
    [1000, 'یک هزار'],
    [2019, 'دو هزار و نوزده'],
    [1_250_000, 'یک میلیون و دویست و پنجاه هزار'],
    [3_000_000_001, 'سه میلیارد و یک'],
    [-12, 'منفی دوازده'],
  ])('%d → %s', (value, words) => {
    expect(numberToPersianWords(value)).toBe(words);
  });
});
