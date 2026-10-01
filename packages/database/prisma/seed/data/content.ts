/**
 * Store identity, policies and content. Every value in brackets is a placeholder to be
 * replaced from Admin → Settings / Content once the brand is finalized.
 */

export const STORE_SETTINGS = {
  storeName: 'فروشگاه ابزار',
  tagline: 'تأمین تخصصی ابزار برقی، دستی و مصرفی',
  logoUrl: null,
  supportPhone: '021-00000000',
  supportEmail: 'support@example.com',
  address: '[آدرس فروشگاه] — تهران',
  workingHours: 'شنبه تا چهارشنبه ۹ تا ۱۸ — پنجشنبه ۹ تا ۱۳',
  socials: { instagram: null, telegram: null, eitaa: null, bale: null, aparat: null, linkedin: null },
};

export const LEGAL_SETTINGS = {
  companyName: '[نام شرکت / فروشگاه]',
  registrationNumber: null,
  nationalId: null,
  economicCode: null,
  licenses: 'محل درج اطلاعات مجوزها (اینماد، ساماندهی، پروانه کسب)',
  trustBadges: [],
};

export const COMMERCE_SETTINGS = {
  displayCurrency: 'IRT',
  taxRatePercent: 10,
  pricesIncludeTax: true,
  defaultLowStockThreshold: 2,
  showStockCountBelow: 5,
};

export const WAREHOUSES = [
  {
    code: 'MAIN',
    name: 'انبار مرکزی تهران',
    province: 'تهران',
    city: 'تهران',
    address: '[آدرس انبار مرکزی]',
    priority: 10,
    isDefault: true,
  },
  {
    code: 'ISF',
    name: 'انبار اصفهان',
    province: 'اصفهان',
    city: 'اصفهان',
    address: '[آدرس انبار اصفهان]',
    priority: 20,
    isDefault: false,
  },
];

/** Amounts in Rial. */
export const SHIPPING_METHODS = [
  {
    code: 'post_pishtaz',
    name: 'پست پیشتاز',
    description: 'ارسال به سراسر کشور؛ رایگان برای سفارش‌های بالای ۵ میلیون تومان',
    baseCost: 950_000,
    freeShippingThreshold: 50_000_000,
    estimatedDaysMin: 3,
    estimatedDaysMax: 5,
    provinces: [] as string[],
    sortOrder: 1,
  },
  {
    code: 'tipax',
    name: 'تیپاکس',
    description: 'تحویل سریع‌تر در مراکز استان‌ها',
    baseCost: 1_450_000,
    freeShippingThreshold: null,
    estimatedDaysMin: 1,
    estimatedDaysMax: 3,
    provinces: [] as string[],
    sortOrder: 2,
  },
  {
    code: 'courier_tehran',
    name: 'پیک موتوری (فقط تهران)',
    description: 'تحویل در همان روز برای سفارش‌های ثبت‌شده تا ساعت ۱۴',
    baseCost: 900_000,
    freeShippingThreshold: null,
    estimatedDaysMin: 0,
    estimatedDaysMax: 1,
    provinces: ['تهران'],
    sortOrder: 3,
  },
  {
    code: 'freight',
    name: 'باربری (پس‌کرایه)',
    description: 'مناسب کالاهای سنگین؛ هزینه حمل هنگام تحویل از گیرنده دریافت می‌شود',
    baseCost: 0,
    freeShippingThreshold: null,
    estimatedDaysMin: 2,
    estimatedDaysMax: 6,
    provinces: [] as string[],
    sortOrder: 4,
  },
];

export const COUPONS = [
  {
    code: 'WELCOME10',
    description: '۱۰٪ تخفیف اولین خرید (حداکثر ۵۰۰ هزار تومان)',
    type: 'percent' as const,
    value: 10,
    maxDiscount: 5_000_000,
    minSubtotal: 10_000_000,
    perCustomerLimit: 1,
  },
  {
    code: 'FREESHIP',
    description: 'ارسال رایگان برای سفارش‌های بالای ۲ میلیون تومان',
    type: 'free_shipping' as const,
    value: 0,
    maxDiscount: null,
    minSubtotal: 20_000_000,
    perCustomerLimit: null,
  },
  {
    code: 'TOOLS500',
    description: '۵۰۰ هزار تومان تخفیف برای خرید بالای ۵ میلیون تومان',
    type: 'fixed' as const,
    value: 5_000_000,
    maxDiscount: null,
    minSubtotal: 50_000_000,
    perCustomerLimit: 2,
  },
];

const html = (blocks: string[]): string => blocks.join('\n');

export const CONTENT_PAGES = [
  {
    slug: 'about',
    title: 'درباره ما',
    body: html([
      '<p>[نام فروشگاه] با هدف تأمین تخصصی ابزارآلات برقی، دستی و مصرفی برای صنعتگران، پیمانکاران و کاربران خانگی فعالیت می‌کند.</p>',
      '<h2>چرا ما؟</h2>',
      '<ul><li>ارائه کالای اصل با گارانتی معتبر</li><li>مشاوره فنی پیش از خرید</li><li>ارسال سریع به سراسر کشور</li><li>خدمات پس از فروش و تأمین قطعات</li></ul>',
      '<p>[متن معرفی کامل فروشگاه، سابقه فعالیت و تیم را اینجا وارد کنید.]</p>',
    ]),
  },
  {
    slug: 'terms',
    title: 'قوانین و مقررات',
    body: html([
      '<p>استفاده از خدمات فروشگاه به معنای پذیرش قوانین زیر است. این قوانین مطابق با قوانین تجارت الکترونیک جمهوری اسلامی ایران تنظیم شده است.</p>',
      '<h2>ثبت سفارش</h2>',
      '<p>قیمت نهایی هر سفارش پس از بررسی موجودی و قیمت روز در زمان پرداخت محاسبه می‌شود. سفارش تنها پس از پرداخت موفق قطعی است.</p>',
      '<h2>قیمت‌ها و مالیات</h2>',
      '<p>قیمت‌ها به تومان و شامل مالیات بر ارزش افزوده است.</p>',
      '<h2>حریم خصوصی</h2>',
      '<p>اطلاعات کاربران تنها برای پردازش سفارش و ارائه خدمات استفاده می‌شود و در اختیار اشخاص ثالث قرار نمی‌گیرد.</p>',
      '<p>[متن کامل قوانین را پیش از راه‌اندازی با مشاور حقوقی بازبینی کنید.]</p>',
    ]),
  },
  {
    slug: 'returns',
    title: 'شرایط مرجوعی کالا',
    body: html([
      '<p>مشتریان می‌توانند تا ۷ روز پس از تحویل، کالای خریداری‌شده را در شرایط زیر مرجوع کنند:</p>',
      '<ul><li>کالا استفاده نشده و در بسته‌بندی اصلی باشد.</li><li>تمام متعلقات، دفترچه و کارت گارانتی همراه کالا باشد.</li><li>ایراد فنی یا مغایرت کالا با سفارش، توسط کارشناسان تأیید شود.</li></ul>',
      '<h2>موارد غیرقابل مرجوع</h2>',
      '<p>اقلام مصرفی باز شده (مته، صفحه برش، تیغ اره) و کالاهایی که آسیب ناشی از استفاده نادرست دارند قابل مرجوع نیستند.</p>',
      '<h2>روند بازگشت وجه</h2>',
      '<p>پس از تأیید مرجوعی، مبلغ حداکثر ظرف ۷۲ ساعت کاری به حساب مشتری بازگردانده می‌شود.</p>',
    ]),
  },
  {
    slug: 'shipping',
    title: 'شیوه‌های ارسال',
    body: html([
      '<p>سفارش‌ها از طریق پست پیشتاز، تیپاکس، پیک موتوری (تهران) و باربری (کالاهای سنگین) ارسال می‌شوند.</p>',
      '<p>سفارش‌های پرداخت‌شده تا ساعت ۱۴ روزهای کاری، در همان روز تحویل مأمور ارسال می‌شوند.</p>',
    ]),
  },
  {
    slug: 'warranty',
    title: 'گارانتی و خدمات پس از فروش',
    body: html([
      '<p>تمام ابزارهای برقی دارای گارانتی معتبر هستند. شرایط و مدت گارانتی هر کالا در صفحه محصول ذکر شده است.</p>',
      '<p>برای ثبت درخواست تعمیر، از طریق پشتیبانی با ما در تماس باشید.</p>',
    ]),
  },
  {
    slug: 'privacy',
    title: 'حریم خصوصی',
    body: html([
      '<p>ما به حریم خصوصی شما احترام می‌گذاریم. اطلاعات شخصی شما با روش‌های امن نگهداری می‌شود و صرفاً برای پردازش سفارش، ارسال کالا و پشتیبانی استفاده می‌شود.</p>',
      '<p>اطلاعات کارت بانکی شما هرگز در فروشگاه ذخیره نمی‌شود و پرداخت از طریق درگاه امن بانکی انجام می‌شود.</p>',
    ]),
  },
];

export const FAQ_ITEMS = [
  {
    category: 'سفارش و خرید',
    question: 'چگونه سفارش ثبت کنم؟',
    answer: 'کالای موردنظر را به سبد خرید اضافه کنید، وارد حساب کاربری شوید، آدرس و روش ارسال را انتخاب و پرداخت را انجام دهید.',
  },
  {
    category: 'سفارش و خرید',
    question: 'آیا موجودی نمایش داده‌شده در سایت واقعی است؟',
    answer: 'بله. موجودی مستقیماً از سیستم انبار خوانده می‌شود و هنگام پرداخت، کالا برای شما رزرو می‌شود.',
  },
  {
    category: 'سفارش و خرید',
    question: 'تا چه زمانی برای پرداخت سفارش فرصت دارم؟',
    answer: 'کالاهای سفارش شما پس از ثبت به مدت ۲۰ دقیقه رزرو می‌شوند. در صورت عدم پرداخت در این مدت، سفارش لغو و کالا آزاد می‌شود.',
  },
  {
    category: 'ارسال',
    question: 'هزینه ارسال چقدر است؟',
    answer: 'هزینه ارسال بر اساس روش ارسال انتخابی در صفحه تسویه حساب محاسبه می‌شود. ارسال با پست پیشتاز برای سفارش‌های بالای ۵ میلیون تومان رایگان است.',
  },
  {
    category: 'ارسال',
    question: 'سفارش من چه زمانی به دستم می‌رسد؟',
    answer: 'زمان تحویل بسته به روش ارسال بین ۱ تا ۶ روز کاری است. وضعیت سفارش را می‌توانید در بخش «سفارش‌های من» پیگیری کنید.',
  },
  {
    category: 'پرداخت',
    question: 'چه روش‌هایی برای پرداخت وجود دارد؟',
    answer: 'پرداخت از طریق درگاه اینترنتی با تمام کارت‌های عضو شتاب انجام می‌شود.',
  },
  {
    category: 'پرداخت',
    question: 'اگر پول از حسابم کسر شد ولی سفارش ثبت نشد چه کنم؟',
    answer: 'در صورت عدم تأیید پرداخت، مبلغ حداکثر ظرف ۷۲ ساعت توسط بانک به حساب شما بازمی‌گردد. در غیر این صورت با پشتیبانی تماس بگیرید.',
  },
  {
    category: 'گارانتی و مرجوعی',
    question: 'کالاها گارانتی دارند؟',
    answer: 'بله، ابزارهای برقی دارای گارانتی معتبر هستند و مدت آن در صفحه هر محصول درج شده است.',
  },
  {
    category: 'گارانتی و مرجوعی',
    question: 'شرایط مرجوع کردن کالا چیست؟',
    answer: 'تا ۷ روز پس از تحویل، در صورت سالم بودن بسته‌بندی و عدم استفاده از کالا امکان مرجوعی وجود دارد. جزئیات در صفحه «شرایط مرجوعی» آمده است.',
  },
  {
    category: 'مشاوره فنی',
    question: 'تفاوت دریل چکشی و بتن‌کن چیست؟',
    answer: 'دریل چکشی با ضربه‌های سبک و سریع برای سوراخکاری آجر و بتن سبک مناسب است، اما بتن‌کن با مکانیزم پنوماتیک و گیره SDS ضربه بسیار قوی‌تری دارد و برای بتن مسلح و قلم‌کاری استفاده می‌شود.',
  },
];
