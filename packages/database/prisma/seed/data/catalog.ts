/**
 * Demo catalog. Brand names are fictional placeholders – replace them with real brands
 * (and real product photos) before launch.
 */

export type SeedAttributeType = 'text' | 'number' | 'boolean' | 'select' | 'multiselect';

export interface SeedAttribute {
  code: string;
  name: string;
  type: SeedAttributeType;
  unit?: string;
  groupName: string;
  isFilterable?: boolean;
  options?: { value: string; label: string }[];
}

export const ATTRIBUTES: SeedAttribute[] = [
  {
    code: 'power_source',
    name: 'منبع تغذیه',
    type: 'select',
    groupName: 'مشخصات کلی',
    isFilterable: true,
    options: [
      { value: 'corded', label: 'برقی (سیمی)' },
      { value: 'cordless', label: 'شارژی' },
      { value: 'pneumatic', label: 'بادی' },
    ],
  },
  {
    code: 'power_w',
    name: 'توان ورودی',
    type: 'number',
    unit: 'وات',
    groupName: 'موتور و عملکرد',
    isFilterable: true,
  },
  {
    code: 'voltage_v',
    name: 'ولتاژ',
    type: 'number',
    unit: 'ولت',
    groupName: 'موتور و عملکرد',
    isFilterable: true,
  },
  {
    code: 'motor_type',
    name: 'نوع موتور',
    type: 'select',
    groupName: 'موتور و عملکرد',
    isFilterable: true,
    options: [
      { value: 'brushed', label: 'ذغالی' },
      { value: 'brushless', label: 'براشلس (بدون ذغال)' },
    ],
  },
  {
    code: 'no_load_speed_rpm',
    name: 'سرعت بدون بار',
    type: 'number',
    unit: 'دور در دقیقه',
    groupName: 'موتور و عملکرد',
  },
  { code: 'variable_speed', name: 'کنترل دور', type: 'boolean', groupName: 'امکانات' },
  { code: 'has_reverse', name: 'چپ‌گرد و راست‌گرد', type: 'boolean', groupName: 'امکانات' },
  { code: 'weight_kg', name: 'وزن', type: 'number', unit: 'کیلوگرم', groupName: 'ابعاد و وزن' },
  {
    code: 'cable_length_m',
    name: 'طول کابل',
    type: 'number',
    unit: 'متر',
    groupName: 'ابعاد و وزن',
  },
  {
    code: 'battery_capacity_ah',
    name: 'ظرفیت باتری',
    type: 'number',
    unit: 'آمپرساعت',
    groupName: 'باتری',
    isFilterable: true,
  },
  { code: 'battery_count', name: 'تعداد باتری', type: 'number', unit: 'عدد', groupName: 'باتری' },
  {
    code: 'torque_nm',
    name: 'حداکثر گشتاور',
    type: 'number',
    unit: 'نیوتن‌متر',
    groupName: 'موتور و عملکرد',
  },
  {
    code: 'chuck_size_mm',
    name: 'قطر سه‌نظام',
    type: 'number',
    unit: 'میلی‌متر',
    groupName: 'سه‌نظام',
    isFilterable: true,
  },
  {
    code: 'chuck_type',
    name: 'نوع گیره / سه‌نظام',
    type: 'select',
    groupName: 'سه‌نظام',
    isFilterable: true,
    options: [
      { value: 'keyed', label: 'آچاری' },
      { value: 'keyless', label: 'اتومات' },
      { value: 'sds_plus', label: 'SDS-Plus' },
      { value: 'sds_max', label: 'SDS-Max' },
      { value: 'hex', label: 'شش‌گوش ۱/۴ اینچ' },
      { value: 'straight', label: 'دنباله استوانه‌ای' },
    ],
  },
  {
    code: 'impact_energy_j',
    name: 'قدرت ضربه',
    type: 'number',
    unit: 'ژول',
    groupName: 'موتور و عملکرد',
  },
  {
    code: 'max_drill_concrete_mm',
    name: 'حداکثر سوراخکاری در بتن',
    type: 'number',
    unit: 'میلی‌متر',
    groupName: 'ظرفیت کاری',
  },
  {
    code: 'disc_diameter_mm',
    name: 'قطر صفحه',
    type: 'multiselect',
    unit: 'میلی‌متر',
    groupName: 'ظرفیت کاری',
    isFilterable: true,
    options: [
      { value: '115', label: '۱۱۵' },
      { value: '125', label: '۱۲۵' },
      { value: '180', label: '۱۸۰' },
      { value: '230', label: '۲۳۰' },
    ],
  },
  {
    code: 'cutting_depth_mm',
    name: 'حداکثر عمق برش',
    type: 'number',
    unit: 'میلی‌متر',
    groupName: 'ظرفیت کاری',
  },
  {
    code: 'blade_diameter_mm',
    name: 'قطر تیغه',
    type: 'number',
    unit: 'میلی‌متر',
    groupName: 'ظرفیت کاری',
    isFilterable: true,
  },
  {
    code: 'teeth_count',
    name: 'تعداد دندانه',
    type: 'number',
    unit: 'عدد',
    groupName: 'مشخصات فنی',
  },
  {
    code: 'bit_diameter_mm',
    name: 'قطر مته',
    type: 'number',
    unit: 'میلی‌متر',
    groupName: 'مشخصات فنی',
    isFilterable: true,
  },
  {
    code: 'working_length_mm',
    name: 'طول کاری',
    type: 'number',
    unit: 'میلی‌متر',
    groupName: 'مشخصات فنی',
  },
  {
    code: 'disc_thickness_mm',
    name: 'ضخامت صفحه',
    type: 'number',
    unit: 'میلی‌متر',
    groupName: 'مشخصات فنی',
  },
  {
    code: 'application_material',
    name: 'مناسب برای',
    type: 'multiselect',
    groupName: 'کاربرد',
    isFilterable: true,
    options: [
      { value: 'concrete', label: 'بتن' },
      { value: 'metal', label: 'فلز' },
      { value: 'wood', label: 'چوب' },
      { value: 'tile', label: 'کاشی و سرامیک' },
      { value: 'stone', label: 'سنگ' },
    ],
  },
  {
    code: 'material',
    name: 'جنس',
    type: 'select',
    groupName: 'مشخصات فنی',
    isFilterable: true,
    options: [
      { value: 'cr_v', label: 'کروم وانادیوم' },
      { value: 's2', label: 'فولاد S2' },
      { value: 'carbon_steel', label: 'فولاد کربنی' },
      { value: 'hss', label: 'فولاد تندبر (HSS)' },
      { value: 'tungsten_carbide', label: 'الماسه (کاربید تنگستن)' },
    ],
  },
  {
    code: 'pieces_count',
    name: 'تعداد قطعات',
    type: 'number',
    unit: 'عدد',
    groupName: 'مشخصات کلی',
  },
  { code: 'size_range', name: 'محدوده سایز', type: 'text', groupName: 'مشخصات فنی' },
  {
    code: 'tip_type',
    name: 'نوع نوک',
    type: 'multiselect',
    groupName: 'مشخصات فنی',
    isFilterable: true,
    options: [
      { value: 'flat', label: 'دوسو' },
      { value: 'phillips', label: 'چهارسو' },
      { value: 'torx', label: 'ستاره‌ای' },
      { value: 'hex', label: 'آلن' },
    ],
  },
  { code: 'length_inch', name: 'طول', type: 'number', unit: 'اینچ', groupName: 'ابعاد و وزن' },
  {
    code: 'insulated',
    name: 'عایق برق (۱۰۰۰ ولت)',
    type: 'boolean',
    groupName: 'ایمنی',
    isFilterable: true,
  },
];

export interface SeedCategory {
  slug: string;
  name: string;
  description?: string;
  imageUrl?: string;
  attributes?: (string | { code: string; isRequired?: boolean; isFilterable?: boolean })[];
  children?: SeedCategory[];
}

export const CATEGORIES: SeedCategory[] = [
  {
    slug: 'power-tools',
    name: 'ابزار برقی',
    description: 'دریل، بتن‌کن، فرز، اره برقی و لوازم جانبی ابزارهای برقی و شارژی',
    imageUrl: '/placeholders/drill.svg',
    attributes: [
      { code: 'power_source', isRequired: true },
      'power_w',
      'voltage_v',
      'motor_type',
      { code: 'no_load_speed_rpm', isFilterable: false },
      { code: 'variable_speed', isFilterable: false },
      { code: 'weight_kg', isFilterable: false },
    ],
    children: [
      {
        slug: 'drills',
        name: 'دریل',
        imageUrl: '/placeholders/drill.svg',
        attributes: [
          'chuck_size_mm',
          'chuck_type',
          { code: 'torque_nm', isFilterable: false },
          { code: 'has_reverse', isFilterable: false },
        ],
        children: [
          {
            slug: 'cordless-drills',
            name: 'دریل شارژی',
            description: 'دریل پیچ‌گوشتی‌های شارژی ۱۲، ۱۸ و ۲۰ ولت برای مصارف خانگی و صنعتی',
            imageUrl: '/placeholders/drill.svg',
            attributes: ['battery_capacity_ah', { code: 'battery_count', isFilterable: false }],
          },
          {
            slug: 'impact-drills',
            name: 'دریل چکشی',
            imageUrl: '/placeholders/drill.svg',
            attributes: [
              { code: 'max_drill_concrete_mm', isFilterable: false },
              { code: 'cable_length_m', isFilterable: false },
            ],
          },
        ],
      },
      {
        slug: 'rotary-hammers',
        name: 'بتن‌کن',
        description: 'بتن‌کن‌های SDS-Plus و SDS-Max برای سوراخکاری و تخریب بتن',
        imageUrl: '/placeholders/rotary-hammer.svg',
        attributes: [
          { code: 'impact_energy_j', isFilterable: false },
          'chuck_type',
          { code: 'max_drill_concrete_mm', isFilterable: false },
        ],
      },
      {
        slug: 'grinders',
        name: 'فرز',
        imageUrl: '/placeholders/grinder.svg',
        attributes: ['disc_diameter_mm'],
        children: [
          { slug: 'angle-grinders', name: 'مینی فرز', imageUrl: '/placeholders/grinder.svg' },
          { slug: 'large-grinders', name: 'فرز آهنگری', imageUrl: '/placeholders/grinder.svg' },
        ],
      },
      {
        slug: 'power-saws',
        name: 'اره برقی',
        imageUrl: '/placeholders/saw.svg',
        attributes: [{ code: 'cutting_depth_mm', isFilterable: false }],
        children: [
          { slug: 'jigsaws', name: 'اره عمودبر', imageUrl: '/placeholders/saw.svg' },
          {
            slug: 'circular-saws',
            name: 'اره گرد',
            imageUrl: '/placeholders/saw.svg',
            attributes: ['blade_diameter_mm'],
          },
        ],
      },
      {
        slug: 'batteries-chargers',
        name: 'باتری و شارژر',
        imageUrl: '/placeholders/battery.svg',
        attributes: ['battery_capacity_ah'],
      },
    ],
  },
  {
    slug: 'hand-tools',
    name: 'ابزار دستی',
    description: 'آچار، پیچ‌گوشتی، انبردست و ست‌های ابزار دستی حرفه‌ای',
    imageUrl: '/placeholders/wrench.svg',
    attributes: ['material', { code: 'pieces_count', isFilterable: false }, 'insulated'],
    children: [
      {
        slug: 'wrenches',
        name: 'آچار',
        imageUrl: '/placeholders/wrench.svg',
        attributes: [{ code: 'size_range', isFilterable: false }],
      },
      {
        slug: 'screwdrivers',
        name: 'پیچ‌گوشتی',
        imageUrl: '/placeholders/screwdriver.svg',
        attributes: ['tip_type'],
      },
      {
        slug: 'pliers',
        name: 'انبردست',
        imageUrl: '/placeholders/pliers.svg',
        attributes: [{ code: 'length_inch', isFilterable: false }],
      },
    ],
  },
  {
    slug: 'consumables',
    name: 'ابزار مصرفی',
    description: 'مته، صفحه برش، تیغ اره و سایر اقلام مصرفی',
    imageUrl: '/placeholders/drill-bit.svg',
    attributes: ['application_material'],
    children: [
      {
        slug: 'drill-bits',
        name: 'مته',
        imageUrl: '/placeholders/drill-bit.svg',
        attributes: [
          'bit_diameter_mm',
          { code: 'working_length_mm', isFilterable: false },
          'chuck_type',
          'material',
          { code: 'pieces_count', isFilterable: false },
        ],
      },
      {
        slug: 'cutting-discs',
        name: 'صفحه برش',
        imageUrl: '/placeholders/disc.svg',
        attributes: ['disc_diameter_mm', { code: 'disc_thickness_mm', isFilterable: false }],
      },
      {
        slug: 'saw-blades',
        name: 'تیغ اره',
        imageUrl: '/placeholders/blade.svg',
        attributes: ['blade_diameter_mm', { code: 'teeth_count', isFilterable: false }],
      },
    ],
  },
];

export interface SeedBrand {
  slug: string;
  name: string;
  englishName: string;
  country: string;
  description: string;
}

export const BRANDS: SeedBrand[] = [
  {
    slug: 'volter',
    name: 'ولتر',
    englishName: 'Volter',
    country: 'آلمان',
    description: 'برند نمونه (placeholder) ابزارهای شارژی و برقی حرفه‌ای.',
  },
  {
    slug: 'kaveh-tools',
    name: 'کاوه ابزار',
    englishName: 'Kaveh Tools',
    country: 'ایران',
    description: 'برند نمونه (placeholder) ابزار برقی اقتصادی و ابزار مصرفی.',
  },
  {
    slug: 'steelmax',
    name: 'استیل‌مکس',
    englishName: 'Steelmax',
    country: 'ژاپن',
    description: 'برند نمونه (placeholder) ابزارهای صنعتی سنگین.',
  },
  {
    slug: 'arya-pro',
    name: 'آریا پرو',
    englishName: 'Arya Pro',
    country: 'تایوان',
    description: 'برند نمونه (placeholder) ابزار دستی و برقی نیمه‌صنعتی.',
  },
  {
    slug: 'toolino',
    name: 'تولینو',
    englishName: 'Toolino',
    country: 'چین',
    description: 'برند نمونه (placeholder) ابزار دستی.',
  },
];

export type SeedSpecValue = string | number | boolean | string[];

export interface SeedVariant {
  sku: string;
  title?: string;
  options?: { name: string; value: string }[];
  /** Price in Rial. */
  price: number;
  compareAtPrice?: number;
  barcode?: string;
  /** Initial stock per warehouse code. */
  stock: Record<string, number>;
  lowStockThreshold?: number;
  weightGrams?: number;
}

export interface SeedProduct {
  slug: string;
  title: string;
  englishTitle?: string;
  category: string;
  brand: string;
  model?: string;
  status?: 'draft' | 'active' | 'archived';
  usageType?: 'home' | 'semi_industrial' | 'industrial';
  warranty?: string;
  countryOfOrigin?: string;
  manufacturer?: string;
  shortDescription: string;
  description: string;
  image: string;
  tags: string[];
  isFeatured?: boolean;
  specs: Record<string, SeedSpecValue>;
  variants: SeedVariant[];
  related?: string[];
  accessories?: string[];
}

const p = (paragraphs: string[]): string => paragraphs.map((text) => `<p>${text}</p>`).join('\n');

export const PRODUCTS: SeedProduct[] = [
  {
    slug: 'volter-vcd-18-cordless-drill',
    title: 'دریل پیچ‌گوشتی شارژی ۱۸ ولت ولتر مدل VCD-18',
    englishTitle: 'Volter VCD-18 18V Cordless Drill Driver',
    category: 'cordless-drills',
    brand: 'volter',
    model: 'VCD-18',
    usageType: 'semi_industrial',
    warranty: '۱۸ ماه گارانتی شرکتی + ۵ سال خدمات پس از فروش',
    countryOfOrigin: 'چین',
    manufacturer: 'Volter GmbH (نمونه)',
    shortDescription:
      'دریل پیچ‌گوشتی شارژی ۱۸ ولت با گشتاور ۴۵ نیوتن‌متر، سه‌نظام اتومات ۱۳ میلی‌متری و دو سرعت مکانیکی؛ مناسب کارهای نصب، کابینت‌سازی و تأسیسات.',
    description: p([
      'دریل پیچ‌گوشتی شارژی VCD-18 با موتور قدرتمند و گیربکس دو سرعته، برای پیچ‌کاری و سوراخکاری در چوب، فلز و پلاستیک طراحی شده است.',
      'کلاچ ۲۱ مرحله‌ای امکان تنظیم دقیق گشتاور را فراهم می‌کند تا پیچ‌ها و قطعات ظریف آسیب نبینند. چراغ LED محل کار را در فضاهای کم‌نور روشن می‌کند.',
      'باتری‌های لیتیوم‌یون ۱۸ ولت این دستگاه با تمام ابزارهای پلتفرم ۱۸ ولت ولتر سازگار است.',
    ]),
    image: '/placeholders/drill.svg',
    tags: ['دریل شارژی', 'پیچ‌گوشتی شارژی', '18 ولت', 'لیتیوم یون'],
    isFeatured: true,
    specs: {
      power_source: 'cordless',
      voltage_v: 18,
      motor_type: 'brushed',
      no_load_speed_rpm: 1500,
      torque_nm: 45,
      chuck_size_mm: 13,
      chuck_type: 'keyless',
      battery_capacity_ah: 2,
      battery_count: 2,
      weight_kg: 1.6,
      variable_speed: true,
      has_reverse: true,
    },
    variants: [
      {
        sku: 'VLT-VCD18-K2',
        title: 'کیت کامل (۲ باتری ۲ آمپرساعت + شارژر)',
        options: [{ name: 'بسته', value: 'کیت کامل با ۲ باتری' }],
        price: 64_500_000,
        compareAtPrice: 72_000_000,
        barcode: '6260000000011',
        stock: { MAIN: 14, ISF: 5 },
        weightGrams: 3200,
      },
      {
        sku: 'VLT-VCD18-B',
        title: 'بدنه (بدون باتری و شارژر)',
        options: [{ name: 'بسته', value: 'بدنه بدون باتری' }],
        price: 38_900_000,
        barcode: '6260000000012',
        stock: { MAIN: 6 },
        weightGrams: 1600,
      },
    ],
    related: ['volter-vcd-20bl-brushless-drill', 'arya-pro-ap-cd12-cordless-drill'],
    accessories: ['volter-vb-1840-battery', 'volter-vc-18f-charger', 'kaveh-hss-drill-bit-set-19'],
  },
  {
    slug: 'volter-vcd-20bl-brushless-drill',
    title: 'دریل پیچ‌گوشتی شارژی ۲۰ ولت براشلس ولتر مدل VCD-20BL',
    englishTitle: 'Volter VCD-20BL 20V Brushless Drill Driver',
    category: 'cordless-drills',
    brand: 'volter',
    model: 'VCD-20BL',
    usageType: 'industrial',
    warranty: '۲۴ ماه گارانتی شرکتی',
    countryOfOrigin: 'چین',
    shortDescription:
      'دریل شارژی براشلس ۲۰ ولت با گشتاور ۶۵ نیوتن‌متر و دو باتری ۴ آمپرساعت؛ عمر موتور بیشتر و کارکرد طولانی‌تر برای کار مداوم.',
    description: p([
      'موتور براشلس (بدون ذغال) راندمان بالاتر، حرارت کمتر و عمر طولانی‌تری نسبت به موتورهای ذغالی دارد.',
      'دو باتری ۴ آمپرساعت امکان کار مداوم در طول یک شیفت کامل را فراهم می‌کند.',
    ]),
    image: '/placeholders/drill.svg',
    tags: ['دریل براشلس', 'دریل شارژی', '20 ولت'],
    isFeatured: true,
    specs: {
      power_source: 'cordless',
      voltage_v: 20,
      motor_type: 'brushless',
      no_load_speed_rpm: 2000,
      torque_nm: 65,
      chuck_size_mm: 13,
      chuck_type: 'keyless',
      battery_capacity_ah: 4,
      battery_count: 2,
      weight_kg: 1.8,
      variable_speed: true,
      has_reverse: true,
    },
    variants: [
      {
        sku: 'VLT-VCD20BL-K2',
        price: 98_000_000,
        compareAtPrice: 108_000_000,
        stock: { MAIN: 7, ISF: 2 },
        weightGrams: 3800,
      },
    ],
    related: ['volter-vcd-18-cordless-drill'],
    accessories: ['volter-vb-1840-battery', 'volter-vc-18f-charger'],
  },
  {
    slug: 'arya-pro-ap-cd12-cordless-drill',
    title: 'دریل پیچ‌گوشتی شارژی ۱۲ ولت آریا پرو مدل AP-CD12',
    englishTitle: 'Arya Pro AP-CD12 12V Cordless Drill',
    category: 'cordless-drills',
    brand: 'arya-pro',
    model: 'AP-CD12',
    usageType: 'home',
    warranty: '۱۲ ماه گارانتی',
    countryOfOrigin: 'چین',
    shortDescription:
      'دریل شارژی سبک و جمع‌وجور ۱۲ ولت برای کارهای خانگی، نصب قفسه و مونتاژ مبلمان.',
    description: p([
      'با وزن تنها ۱ کیلوگرم، AP-CD12 گزینه‌ای مناسب برای کارهای روزمره خانه و کارگاه‌های کوچک است.',
      'سه‌نظام اتومات ۱۰ میلی‌متری تعویض سریع مته و سرپیچ‌گوشتی را بدون آچار ممکن می‌کند.',
    ]),
    image: '/placeholders/drill.svg',
    tags: ['دریل شارژی', 'دریل خانگی', '12 ولت'],
    specs: {
      power_source: 'cordless',
      voltage_v: 12,
      motor_type: 'brushed',
      no_load_speed_rpm: 1300,
      torque_nm: 25,
      chuck_size_mm: 10,
      chuck_type: 'keyless',
      battery_capacity_ah: 1.5,
      battery_count: 1,
      weight_kg: 1,
      variable_speed: true,
      has_reverse: true,
    },
    variants: [
      {
        sku: 'ARP-CD12-K1',
        price: 24_500_000,
        compareAtPrice: 27_900_000,
        stock: { MAIN: 1 },
        lowStockThreshold: 3,
        weightGrams: 1900,
      },
    ],
    related: ['volter-vcd-18-cordless-drill'],
  },
  {
    slug: 'kaveh-kid-850-impact-drill',
    title: 'دریل چکشی ۸۵۰ وات کاوه ابزار مدل KID-850',
    englishTitle: 'Kaveh Tools KID-850 Impact Drill 850W',
    category: 'impact-drills',
    brand: 'kaveh-tools',
    model: 'KID-850',
    usageType: 'semi_industrial',
    warranty: '۱۲ ماه گارانتی',
    countryOfOrigin: 'ایران',
    shortDescription:
      'دریل چکشی برقی ۸۵۰ وات با سه‌نظام آچاری ۱۳ میلی‌متری و حالت ضربه برای سوراخکاری آجر و بتن سبک.',
    description: p([
      'KID-850 دارای دو حالت چرخشی و چکشی است و برای سوراخکاری در دیوار آجری، بلوک سیمانی و بتن سبک تا قطر ۱۶ میلی‌متر مناسب است.',
      'دسته کمکی ۳۶۰ درجه و خط‌کش عمق، کنترل و دقت کار را افزایش می‌دهد.',
    ]),
    image: '/placeholders/drill.svg',
    tags: ['دریل چکشی', 'دریل برقی', 'دریل 13'],
    specs: {
      power_source: 'corded',
      power_w: 850,
      voltage_v: 220,
      motor_type: 'brushed',
      no_load_speed_rpm: 3000,
      chuck_size_mm: 13,
      chuck_type: 'keyed',
      max_drill_concrete_mm: 16,
      weight_kg: 2.1,
      cable_length_m: 2.5,
      variable_speed: true,
      has_reverse: true,
    },
    variants: [
      { sku: 'KVT-KID850', price: 21_800_000, stock: { MAIN: 18, ISF: 6 }, weightGrams: 2600 },
    ],
    accessories: ['kaveh-hss-drill-bit-set-19'],
  },
  {
    slug: 'steelmax-srh-26-rotary-hammer',
    title: 'بتن‌کن ۸۰۰ وات ۲۶ میلی‌متری استیل‌مکس مدل SRH-26',
    englishTitle: 'Steelmax SRH-26 SDS-Plus Rotary Hammer 800W',
    category: 'rotary-hammers',
    brand: 'steelmax',
    model: 'SRH-26',
    usageType: 'industrial',
    warranty: '۱۸ ماه گارانتی شرکتی',
    countryOfOrigin: 'ژاپن',
    shortDescription:
      'بتن‌کن سه‌حالته SDS-Plus با قدرت ضربه ۲٫۸ ژول؛ مناسب سوراخکاری بتن، نصب داکت و تخریب سبک.',
    description: p([
      'SRH-26 با سه حالت دریل، دریل چکشی و قلم‌کاری، ابزاری همه‌کاره برای تأسیسات و ساختمان است.',
      'کلاچ ایمنی هنگام گیر کردن مته، چرخش ناگهانی دستگاه را متوقف می‌کند.',
      'گیره SDS-Plus تعویض سریع مته و قلم را بدون ابزار ممکن می‌سازد.',
    ]),
    image: '/placeholders/rotary-hammer.svg',
    tags: ['بتن کن', 'هیلتی', 'SDS Plus', 'چکش تخریب'],
    isFeatured: true,
    specs: {
      power_source: 'corded',
      power_w: 800,
      voltage_v: 220,
      motor_type: 'brushed',
      no_load_speed_rpm: 1100,
      impact_energy_j: 2.8,
      chuck_type: 'sds_plus',
      max_drill_concrete_mm: 26,
      weight_kg: 2.9,
      variable_speed: true,
    },
    variants: [
      {
        sku: 'STM-SRH26',
        price: 42_000_000,
        compareAtPrice: 46_500_000,
        stock: { MAIN: 9, ISF: 3 },
        weightGrams: 4100,
      },
    ],
    related: ['steelmax-srh-40max-rotary-hammer'],
    accessories: ['steelmax-sds-plus-concrete-bit'],
  },
  {
    slug: 'steelmax-srh-40max-rotary-hammer',
    title: 'بتن‌کن ۵ کیلویی ۱۵۰۰ وات SDS-Max استیل‌مکس مدل SRH-40MAX',
    englishTitle: 'Steelmax SRH-40MAX SDS-Max Rotary Hammer 1500W',
    category: 'rotary-hammers',
    brand: 'steelmax',
    model: 'SRH-40MAX',
    usageType: 'industrial',
    warranty: '۱۸ ماه گارانتی شرکتی',
    countryOfOrigin: 'ژاپن',
    shortDescription:
      'بتن‌کن سنگین SDS-Max با قدرت ضربه ۱۰ ژول برای سوراخکاری تا ۴۰ میلی‌متر و تخریب بتن مسلح.',
    description: p([
      'SRH-40MAX برای پروژه‌های عمرانی و تخریب سنگین طراحی شده و سیستم ضدلرزش آن خستگی اپراتور را کاهش می‌دهد.',
    ]),
    image: '/placeholders/rotary-hammer.svg',
    tags: ['بتن کن سنگین', 'SDS Max', 'هیلتی 5 کیلویی'],
    specs: {
      power_source: 'corded',
      power_w: 1500,
      voltage_v: 220,
      motor_type: 'brushed',
      no_load_speed_rpm: 420,
      impact_energy_j: 10,
      chuck_type: 'sds_max',
      max_drill_concrete_mm: 40,
      weight_kg: 6.2,
    },
    variants: [{ sku: 'STM-SRH40MAX', price: 118_000_000, stock: { MAIN: 0 }, weightGrams: 8500 }],
    related: ['steelmax-srh-26-rotary-hammer'],
  },
  {
    slug: 'kaveh-kag-750-angle-grinder',
    title: 'مینی فرز ۷۵۰ وات ۱۱۵ میلی‌متری کاوه ابزار مدل KAG-750',
    englishTitle: 'Kaveh Tools KAG-750 Angle Grinder 115mm',
    category: 'angle-grinders',
    brand: 'kaveh-tools',
    model: 'KAG-750',
    usageType: 'semi_industrial',
    warranty: '۱۲ ماه گارانتی',
    countryOfOrigin: 'ایران',
    shortDescription: 'مینی فرز سبک ۷۵۰ وات با صفحه ۱۱۵ میلی‌متری برای برش و سنگ‌زنی فلز و کاشی.',
    description: p([
      'KAG-750 با بدنه باریک و وزن ۱٫۸ کیلوگرم، کار با یک دست را آسان می‌کند.',
      'قفل محور برای تعویض سریع صفحه و حفاظ قابل تنظیم بدون ابزار از امکانات این دستگاه است.',
    ]),
    image: '/placeholders/grinder.svg',
    tags: ['مینی فرز', 'فرز 115', 'سنگ فرز'],
    specs: {
      power_source: 'corded',
      power_w: 750,
      voltage_v: 220,
      motor_type: 'brushed',
      no_load_speed_rpm: 11000,
      disc_diameter_mm: ['115'],
      weight_kg: 1.8,
    },
    variants: [
      { sku: 'KVT-KAG750', price: 14_900_000, stock: { MAIN: 25, ISF: 10 }, weightGrams: 2300 },
    ],
    related: ['volter-vag-1200-angle-grinder'],
    accessories: ['volter-metal-cutting-disc-pack'],
  },
  {
    slug: 'volter-vag-1200-angle-grinder',
    title: 'مینی فرز دسته‌بلند ۱۲۰۰ وات ۱۲۵ میلی‌متری ولتر مدل VAG-1200',
    englishTitle: 'Volter VAG-1200 Angle Grinder 125mm 1200W',
    category: 'angle-grinders',
    brand: 'volter',
    model: 'VAG-1200',
    usageType: 'industrial',
    warranty: '۱۸ ماه گارانتی شرکتی',
    countryOfOrigin: 'چین',
    shortDescription:
      'مینی فرز دسته‌بلند ۱۲۰۰ وات با کنترل دور و استارت نرم؛ مناسب کار مداوم در کارگاه‌های فلزکاری.',
    description: p([
      'سیستم استارت نرم از ضربه هنگام روشن شدن جلوگیری می‌کند و کنترل دور الکترونیک امکان کار روی استیل و سنگ را فراهم می‌کند.',
    ]),
    image: '/placeholders/grinder.svg',
    tags: ['مینی فرز دسته بلند', 'فرز 125', 'فرز دیمردار'],
    specs: {
      power_source: 'corded',
      power_w: 1200,
      voltage_v: 220,
      motor_type: 'brushed',
      no_load_speed_rpm: 11000,
      disc_diameter_mm: ['125'],
      weight_kg: 2.4,
      variable_speed: true,
    },
    variants: [
      {
        sku: 'VLT-VAG1200',
        price: 27_500_000,
        compareAtPrice: 31_000_000,
        stock: { MAIN: 11, ISF: 4 },
        weightGrams: 3000,
      },
    ],
    related: ['kaveh-kag-750-angle-grinder', 'steelmax-slg-2400-large-grinder'],
    accessories: ['volter-metal-cutting-disc-pack'],
  },
  {
    slug: 'steelmax-slg-2400-large-grinder',
    title: 'فرز آهنگری ۲۳۰ میلی‌متری ۲۴۰۰ وات استیل‌مکس مدل SLG-2400',
    englishTitle: 'Steelmax SLG-2400 Large Angle Grinder 230mm',
    category: 'large-grinders',
    brand: 'steelmax',
    model: 'SLG-2400',
    usageType: 'industrial',
    warranty: '۱۸ ماه گارانتی شرکتی',
    countryOfOrigin: 'ژاپن',
    shortDescription: 'فرز آهنگری سنگین ۲۴۰۰ وات برای برش پروفیل، لوله و سنگ‌زنی سطوح بزرگ.',
    description: p([
      'موتور پرقدرت با سیم‌پیچ مقاوم در برابر گردوغبار، دوام بالایی در محیط‌های صنعتی دارد.',
    ]),
    image: '/placeholders/grinder.svg',
    tags: ['فرز آهنگری', 'فرز سنگ بری', 'فرز 230'],
    specs: {
      power_source: 'corded',
      power_w: 2400,
      voltage_v: 220,
      motor_type: 'brushed',
      no_load_speed_rpm: 6600,
      disc_diameter_mm: ['230'],
      weight_kg: 5.4,
    },
    variants: [{ sku: 'STM-SLG2400', price: 49_000_000, stock: { MAIN: 5 }, weightGrams: 7000 }],
    accessories: ['volter-metal-cutting-disc-pack'],
  },
  {
    slug: 'arya-pro-ap-js650-jigsaw',
    title: 'اره عمودبر ۶۵۰ وات آریا پرو مدل AP-JS650',
    englishTitle: 'Arya Pro AP-JS650 Jigsaw 650W',
    category: 'jigsaws',
    brand: 'arya-pro',
    model: 'AP-JS650',
    usageType: 'semi_industrial',
    warranty: '۱۲ ماه گارانتی',
    countryOfOrigin: 'چین',
    shortDescription: 'اره عمودبر ۶۵۰ وات با حرکت پاندولی چهار مرحله‌ای و برش مورب تا ۴۵ درجه.',
    description: p(['کنترل دور و دمنده براده، دید خط برش را در برش‌های منحنی و دقیق حفظ می‌کند.']),
    image: '/placeholders/saw.svg',
    tags: ['اره عمودبر', 'اره چکشی', 'اره منبت'],
    specs: {
      power_source: 'corded',
      power_w: 650,
      voltage_v: 220,
      motor_type: 'brushed',
      no_load_speed_rpm: 3000,
      cutting_depth_mm: 65,
      weight_kg: 2.2,
      variable_speed: true,
    },
    variants: [{ sku: 'ARP-JS650', price: 19_800_000, stock: { MAIN: 8 }, weightGrams: 2900 }],
  },
  {
    slug: 'kaveh-kcs-185-circular-saw',
    title: 'اره گرد ۱۸۵ میلی‌متری ۱۴۰۰ وات کاوه ابزار مدل KCS-185',
    englishTitle: 'Kaveh Tools KCS-185 Circular Saw 185mm',
    category: 'circular-saws',
    brand: 'kaveh-tools',
    model: 'KCS-185',
    usageType: 'semi_industrial',
    warranty: '۱۲ ماه گارانتی',
    countryOfOrigin: 'ایران',
    shortDescription:
      'اره گرد دستی ۱۴۰۰ وات با عمق برش ۶۳ میلی‌متر و قابلیت برش زاویه‌دار تا ۴۵ درجه.',
    description: p([
      'کفی آلومینیومی محکم و خط‌کش موازی، برش‌های صاف و تکرارپذیر در ورق‌های چوبی و MDF را تضمین می‌کند.',
    ]),
    image: '/placeholders/saw.svg',
    tags: ['اره گرد', 'اره دیسکی', 'اره 185'],
    specs: {
      power_source: 'corded',
      power_w: 1400,
      voltage_v: 220,
      motor_type: 'brushed',
      no_load_speed_rpm: 5000,
      blade_diameter_mm: 185,
      cutting_depth_mm: 63,
      weight_kg: 4.1,
    },
    variants: [
      { sku: 'KVT-KCS185', price: 33_500_000, stock: { MAIN: 6, ISF: 2 }, weightGrams: 5200 },
    ],
    accessories: ['arya-pro-tct-saw-blade-185'],
  },
  {
    slug: 'volter-vb-1840-battery',
    title: 'باتری ۱۸ ولت ۴ آمپرساعت ولتر مدل VB-1840',
    englishTitle: 'Volter VB-1840 18V 4.0Ah Battery',
    category: 'batteries-chargers',
    brand: 'volter',
    model: 'VB-1840',
    usageType: 'semi_industrial',
    warranty: '۶ ماه گارانتی',
    countryOfOrigin: 'چین',
    shortDescription:
      'باتری لیتیوم‌یون ۱۸ ولت با ظرفیت ۴ آمپرساعت و نشانگر شارژ؛ سازگار با تمام ابزارهای ۱۸ ولت ولتر.',
    description: p([
      'سلول‌های باکیفیت و مدار محافظ، از باتری در برابر شارژ و دشارژ بیش از حد و حرارت محافظت می‌کند.',
    ]),
    image: '/placeholders/battery.svg',
    tags: ['باتری ابزار', 'باتری 18 ولت', 'باتری لیتیوم'],
    specs: { power_source: 'cordless', voltage_v: 18, battery_capacity_ah: 4, weight_kg: 0.6 },
    variants: [
      { sku: 'VLT-VB1840', price: 18_500_000, stock: { MAIN: 20, ISF: 6 }, weightGrams: 650 },
    ],
  },
  {
    slug: 'volter-vc-18f-charger',
    title: 'شارژر سریع ۱۸ ولت ولتر مدل VC-18F',
    englishTitle: 'Volter VC-18F 18V Fast Charger',
    category: 'batteries-chargers',
    brand: 'volter',
    model: 'VC-18F',
    usageType: 'semi_industrial',
    warranty: '۶ ماه گارانتی',
    countryOfOrigin: 'چین',
    shortDescription:
      'شارژر سریع باتری‌های ۱۸ ولت ولتر؛ شارژ کامل باتری ۴ آمپرساعت در حدود ۶۰ دقیقه.',
    description: p(['فن خنک‌کننده داخلی و نشانگر وضعیت، عمر باتری را افزایش می‌دهد.']),
    image: '/placeholders/battery.svg',
    tags: ['شارژر ابزار', 'شارژر 18 ولت'],
    specs: { power_source: 'corded', voltage_v: 18, weight_kg: 0.5 },
    variants: [{ sku: 'VLT-VC18F', price: 9_800_000, stock: { MAIN: 12 }, weightGrams: 700 }],
  },
  {
    slug: 'toolino-tws-12-combination-wrench-set',
    title: 'ست آچار تخت‌رینگی ۱۲ عددی تولینو مدل TWS-12',
    englishTitle: 'Toolino TWS-12 Combination Wrench Set',
    category: 'wrenches',
    brand: 'toolino',
    model: 'TWS-12',
    usageType: 'semi_industrial',
    warranty: 'ضمانت مادام‌العمر شکستگی',
    countryOfOrigin: 'چین',
    shortDescription:
      'ست ۱۲ عددی آچار تخت‌رینگی کروم وانادیوم در سایزهای ۸ تا ۲۲ میلی‌متر با کیف برزنتی.',
    description: p([
      'رینگ ۱۵ درجه دسترسی به مهره‌ها را در فضاهای تنگ آسان‌تر می‌کند. پوشش کروم مات از زنگ‌زدگی جلوگیری می‌کند.',
    ]),
    image: '/placeholders/wrench.svg',
    tags: ['آچار تخت رینگی', 'ست آچار', 'آچار یک سر تخت'],
    specs: { material: 'cr_v', pieces_count: 12, size_range: '۸ تا ۲۲ میلی‌متر', insulated: false },
    variants: [
      {
        sku: 'TLN-TWS12',
        price: 12_400_000,
        compareAtPrice: 13_900_000,
        stock: { MAIN: 15, ISF: 5 },
        weightGrams: 2100,
      },
    ],
    related: ['toolino-taw-adjustable-wrench'],
  },
  {
    slug: 'toolino-taw-adjustable-wrench',
    title: 'آچار فرانسه تولینو سری TAW',
    englishTitle: 'Toolino TAW Adjustable Wrench',
    category: 'wrenches',
    brand: 'toolino',
    model: 'TAW',
    usageType: 'semi_industrial',
    warranty: 'ضمانت مادام‌العمر شکستگی',
    countryOfOrigin: 'چین',
    shortDescription: 'آچار فرانسه کروم وانادیوم با فک دقیق و مدرج، در سه سایز ۸، ۱۰ و ۱۲ اینچ.',
    description: p([
      'پیچ تنظیم روان و فک بدون لقی، گرفتن مطمئن مهره را در گشتاورهای بالا ممکن می‌کند.',
    ]),
    image: '/placeholders/wrench.svg',
    tags: ['آچار فرانسه', 'آچار قابل تنظیم'],
    specs: {
      material: 'cr_v',
      pieces_count: 1,
      size_range: 'دهانه ۲۴ تا ۳۴ میلی‌متر',
      insulated: false,
    },
    variants: [
      {
        sku: 'TLN-TAW-08',
        title: '۸ اینچ',
        options: [{ name: 'سایز', value: '۸ اینچ' }],
        price: 3_200_000,
        stock: { MAIN: 20 },
        weightGrams: 250,
      },
      {
        sku: 'TLN-TAW-10',
        title: '۱۰ اینچ',
        options: [{ name: 'سایز', value: '۱۰ اینچ' }],
        price: 3_900_000,
        stock: { MAIN: 18, ISF: 6 },
        weightGrams: 360,
      },
      {
        sku: 'TLN-TAW-12',
        title: '۱۲ اینچ',
        options: [{ name: 'سایز', value: '۱۲ اینچ' }],
        price: 4_800_000,
        stock: { MAIN: 9 },
        weightGrams: 520,
      },
    ],
  },
  {
    slug: 'arya-pro-ap-sd6-insulated-screwdriver-set',
    title: 'ست پیچ‌گوشتی ۶ عددی عایق ۱۰۰۰ ولت آریا پرو مدل AP-SD6',
    englishTitle: 'Arya Pro AP-SD6 VDE Insulated Screwdriver Set',
    category: 'screwdrivers',
    brand: 'arya-pro',
    model: 'AP-SD6',
    usageType: 'industrial',
    warranty: '۱۲ ماه گارانتی',
    countryOfOrigin: 'تایوان',
    shortDescription: 'ست ۶ عددی پیچ‌گوشتی دوسو و چهارسو با عایق ۱۰۰۰ ولت مناسب برقکاران.',
    description: p([
      'تیغه فولاد S2 با نوک مغناطیسی و دسته دوجزئی ارگونومیک؛ هر قطعه به‌صورت جداگانه آزمون ولتاژ شده است.',
    ]),
    image: '/placeholders/screwdriver.svg',
    tags: ['پیچ گوشتی عایق', 'ست پیچ گوشتی', 'پیچ گوشتی برقکاری'],
    specs: { material: 's2', pieces_count: 6, tip_type: ['flat', 'phillips'], insulated: true },
    variants: [{ sku: 'ARP-SD6', price: 7_600_000, stock: { MAIN: 22 }, weightGrams: 700 }],
  },
  {
    slug: 'toolino-tcp-8-insulated-pliers',
    title: 'انبردست ۸ اینچ عایق تولینو مدل TCP-8',
    englishTitle: 'Toolino TCP-8 Insulated Combination Pliers 8"',
    category: 'pliers',
    brand: 'toolino',
    model: 'TCP-8',
    usageType: 'semi_industrial',
    warranty: '۱۲ ماه گارانتی',
    countryOfOrigin: 'چین',
    shortDescription: 'انبردست ۸ اینچ کروم وانادیوم با دسته عایق ۱۰۰۰ ولت و لبه برش سخت‌کاری‌شده.',
    description: p([
      'لبه‌های برش با القای فرکانس بالا سخت شده‌اند و سیم‌های فولادی را به‌راحتی می‌برند.',
    ]),
    image: '/placeholders/pliers.svg',
    tags: ['انبردست', 'انبردست عایق', 'دم باریک'],
    specs: { material: 'cr_v', pieces_count: 1, length_inch: 8, insulated: true },
    variants: [
      { sku: 'TLN-TCP8', price: 4_200_000, stock: { MAIN: 30, ISF: 10 }, weightGrams: 330 },
    ],
  },
  {
    slug: 'steelmax-sds-plus-concrete-bit',
    title: 'مته الماسه بتن SDS-Plus استیل‌مکس سری SB',
    englishTitle: 'Steelmax SB Series SDS-Plus Concrete Drill Bit',
    category: 'drill-bits',
    brand: 'steelmax',
    model: 'SB',
    usageType: 'industrial',
    countryOfOrigin: 'آلمان',
    shortDescription:
      'مته الماسه (کاربید تنگستن) با دنباله SDS-Plus و شیار چهارگانه برای تخلیه سریع گردوغبار بتن.',
    description: p([
      'سر الماسه چهارلبه، سوراخ‌هایی تمیز و دقیق در بتن، آجر و سنگ ایجاد می‌کند و در برخورد با میلگرد کمتر گیر می‌کند.',
      'طول کاری ۱۶۰ میلی‌متر و طول کلی ۲۱۰ میلی‌متر.',
    ]),
    image: '/placeholders/drill-bit.svg',
    tags: ['مته بتن', 'مته الماسه', 'مته SDS', 'مته هیلتی'],
    specs: {
      application_material: ['concrete', 'stone'],
      material: 'tungsten_carbide',
      chuck_type: 'sds_plus',
      working_length_mm: 160,
    },
    variants: [
      {
        sku: 'STM-SB-06',
        title: 'قطر ۶ میلی‌متر',
        options: [{ name: 'قطر', value: '۶ میلی‌متر' }],
        price: 1_450_000,
        stock: { MAIN: 60 },
      },
      {
        sku: 'STM-SB-08',
        title: 'قطر ۸ میلی‌متر',
        options: [{ name: 'قطر', value: '۸ میلی‌متر' }],
        price: 1_650_000,
        stock: { MAIN: 45 },
      },
      {
        sku: 'STM-SB-10',
        title: 'قطر ۱۰ میلی‌متر',
        options: [{ name: 'قطر', value: '۱۰ میلی‌متر' }],
        price: 1_950_000,
        stock: { MAIN: 2 },
        lowStockThreshold: 10,
      },
      {
        sku: 'STM-SB-12',
        title: 'قطر ۱۲ میلی‌متر',
        options: [{ name: 'قطر', value: '۱۲ میلی‌متر' }],
        price: 2_400_000,
        stock: { MAIN: 30 },
      },
      {
        sku: 'STM-SB-14',
        title: 'قطر ۱۴ میلی‌متر',
        options: [{ name: 'قطر', value: '۱۴ میلی‌متر' }],
        price: 2_900_000,
        stock: { MAIN: 20, ISF: 10 },
      },
    ],
    related: ['kaveh-hss-drill-bit-set-19'],
  },
  {
    slug: 'kaveh-hss-drill-bit-set-19',
    title: 'ست مته فلز HSS-G کاوه ابزار ۱۹ عددی (۱ تا ۱۰ میلی‌متر)',
    englishTitle: 'Kaveh Tools HSS-G Metal Drill Bit Set 19pcs',
    category: 'drill-bits',
    brand: 'kaveh-tools',
    model: 'HSS-19',
    usageType: 'semi_industrial',
    countryOfOrigin: 'ایران',
    shortDescription: 'ست ۱۹ عددی مته فلز تندبر سنگ‌خورده از ۱ تا ۱۰ میلی‌متر با جعبه فلزی.',
    description: p([
      'مته‌های سنگ‌خورده HSS-G با زاویه نوک ۱۳۵ درجه، بدون نیاز به سنتر در فولاد، آلومینیوم و چوب سوراخ می‌کنند.',
    ]),
    image: '/placeholders/drill-bit.svg',
    tags: ['ست مته', 'مته آهن', 'مته فلز', 'مته HSS'],
    specs: {
      application_material: ['metal', 'wood'],
      material: 'hss',
      chuck_type: 'straight',
      pieces_count: 19,
    },
    variants: [{ sku: 'KVT-HSS19', price: 6_900_000, stock: { MAIN: 25 }, weightGrams: 600 }],
  },
  {
    slug: 'volter-metal-cutting-disc-pack',
    title: 'صفحه برش آهن ولتر (بسته ۲۵ عددی)',
    englishTitle: 'Volter Metal Cutting Disc (Pack of 25)',
    category: 'cutting-discs',
    brand: 'volter',
    model: 'VCD-INOX',
    usageType: 'industrial',
    countryOfOrigin: 'آلمان',
    shortDescription:
      'صفحه برش نازک آهن و استیل با الیاف تقویتی دولایه؛ برش سریع با حرارت و پلیسه کم.',
    description: p([
      'مناسب برش پروفیل، میلگرد، لوله و ورق فلزی؛ بدون آهن و گوگرد برای برش استیل ضدزنگ.',
    ]),
    image: '/placeholders/disc.svg',
    tags: ['صفحه برش', 'صفحه سنگ', 'صفحه استیل بر'],
    specs: { application_material: ['metal'], disc_diameter_mm: ['115', '180', '230'] },
    variants: [
      {
        sku: 'VLT-CD-115',
        title: '۱۱۵×۱ میلی‌متر',
        options: [{ name: 'ابعاد', value: '۱۱۵×۱ میلی‌متر' }],
        price: 2_750_000,
        stock: { MAIN: 40, ISF: 20 },
      },
      {
        sku: 'VLT-CD-180',
        title: '۱۸۰×۱٫۶ میلی‌متر',
        options: [{ name: 'ابعاد', value: '۱۸۰×۱٫۶ میلی‌متر' }],
        price: 4_900_000,
        stock: { MAIN: 25 },
      },
      {
        sku: 'VLT-CD-230',
        title: '۲۳۰×۱٫۹ میلی‌متر',
        options: [{ name: 'ابعاد', value: '۲۳۰×۱٫۹ میلی‌متر' }],
        price: 6_600_000,
        stock: { MAIN: 18 },
      },
    ],
  },
  {
    slug: 'arya-pro-tct-saw-blade-185',
    title: 'تیغ اره گرد الماسه ۱۸۵ میلی‌متر ۴۰ دندانه آریا پرو',
    englishTitle: 'Arya Pro TCT Circular Saw Blade 185mm 40T',
    category: 'saw-blades',
    brand: 'arya-pro',
    model: 'TCT-18540',
    usageType: 'semi_industrial',
    countryOfOrigin: 'تایوان',
    shortDescription:
      'تیغ اره دایره‌ای با دندانه‌های الماسه (TCT) برای برش تمیز چوب، MDF و نئوپان.',
    description: p([
      'شیارهای کاهش صدا و حرارت روی بدنه تیغ، لرزش را کاهش داده و کیفیت برش را بالا می‌برد.',
    ]),
    image: '/placeholders/blade.svg',
    tags: ['تیغ اره', 'تیغ اره گرد', 'تیغ الماسه'],
    specs: { application_material: ['wood'], blade_diameter_mm: 185, teeth_count: 40 },
    variants: [{ sku: 'ARP-TCT18540', price: 3_300_000, stock: { MAIN: 14 }, weightGrams: 450 }],
  },
  {
    slug: 'steelmax-bench-drill-press-16',
    title: 'دریل ستونی ۱۶ میلی‌متری استیل‌مکس مدل SDP-16 (به‌زودی)',
    category: 'impact-drills',
    brand: 'steelmax',
    model: 'SDP-16',
    status: 'draft',
    usageType: 'industrial',
    shortDescription: 'نمونه محصول پیش‌نویس که هنوز در فروشگاه منتشر نشده است.',
    description: p(['این محصول در وضعیت پیش‌نویس است و فقط در پنل مدیریت دیده می‌شود.']),
    image: '/placeholders/drill.svg',
    tags: ['دریل ستونی'],
    specs: {
      power_source: 'corded',
      power_w: 550,
      voltage_v: 220,
      chuck_size_mm: 16,
      chuck_type: 'keyed',
    },
    variants: [{ sku: 'STM-SDP16', price: 75_000_000, stock: {} }],
  },
];
