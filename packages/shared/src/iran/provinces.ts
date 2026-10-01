export interface Province {
  code: string;
  name: string;
}

export const IRAN_PROVINCES: readonly Province[] = [
  { code: 'tehran', name: 'تهران' },
  { code: 'alborz', name: 'البرز' },
  { code: 'isfahan', name: 'اصفهان' },
  { code: 'fars', name: 'فارس' },
  { code: 'khorasan-razavi', name: 'خراسان رضوی' },
  { code: 'east-azerbaijan', name: 'آذربایجان شرقی' },
  { code: 'west-azerbaijan', name: 'آذربایجان غربی' },
  { code: 'ardabil', name: 'اردبیل' },
  { code: 'bushehr', name: 'بوشهر' },
  { code: 'chaharmahal-bakhtiari', name: 'چهارمحال و بختیاری' },
  { code: 'south-khorasan', name: 'خراسان جنوبی' },
  { code: 'north-khorasan', name: 'خراسان شمالی' },
  { code: 'khuzestan', name: 'خوزستان' },
  { code: 'zanjan', name: 'زنجان' },
  { code: 'semnan', name: 'سمنان' },
  { code: 'sistan-baluchestan', name: 'سیستان و بلوچستان' },
  { code: 'qazvin', name: 'قزوین' },
  { code: 'qom', name: 'قم' },
  { code: 'kurdistan', name: 'کردستان' },
  { code: 'kerman', name: 'کرمان' },
  { code: 'kermanshah', name: 'کرمانشاه' },
  { code: 'kohgiluyeh-boyer-ahmad', name: 'کهگیلویه و بویراحمد' },
  { code: 'golestan', name: 'گلستان' },
  { code: 'gilan', name: 'گیلان' },
  { code: 'lorestan', name: 'لرستان' },
  { code: 'mazandaran', name: 'مازندران' },
  { code: 'markazi', name: 'مرکزی' },
  { code: 'hormozgan', name: 'هرمزگان' },
  { code: 'hamadan', name: 'همدان' },
  { code: 'yazd', name: 'یزد' },
  { code: 'ilam', name: 'ایلام' },
];

export const IRAN_PROVINCE_NAMES: readonly string[] = IRAN_PROVINCES.map((p) => p.name);
