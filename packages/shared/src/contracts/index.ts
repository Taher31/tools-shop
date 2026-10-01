/**
 * Response contracts of the REST API (v1). The API maps database records to these
 * shapes explicitly; the web app consumes them. Amounts are integers in Rial.
 */
import type { Permission } from '../auth/permissions';
import type {
  AttributeType,
  CouponType,
  IntegrationLogLevel,
  IntegrationStatus,
  InvoiceType,
  MarketplaceSyncStatus,
  PaymentStatus,
  ProductStatus,
  QuestionStatus,
  ReviewStatus,
  StockMovementType,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  UsageType,
  UserType,
} from '../commerce/enums';
import type { Rial } from '../commerce/money';
import type { OrderStatus } from '../commerce/order-status';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/* ------------------------------------------------------------------ auth */

export interface AuthUser {
  id: string;
  type: UserType;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  nationalCode: string | null;
  roles: string[];
  permissions: Permission[];
}

export interface AuthResponse {
  user: AuthUser;
}

/* --------------------------------------------------------------- catalog */

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

export interface CategoryTreeNode extends CategorySummary {
  parentId: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  children: CategoryTreeNode[];
}

export interface BreadcrumbItem {
  name: string;
  slug: string;
}

export interface CategoryPage {
  category: CategorySummary & {
    description: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
  };
  breadcrumbs: BreadcrumbItem[];
  children: CategorySummary[];
}

export interface BrandSummary {
  id: string;
  name: string;
  englishName: string | null;
  slug: string;
  logoUrl: string | null;
}

export interface KeySpec {
  label: string;
  value: string;
}

export interface ProductCard {
  id: string;
  slug: string;
  title: string;
  brand: Pick<BrandSummary, 'name' | 'slug'> | null;
  category: Pick<CategorySummary, 'name' | 'slug'> | null;
  imageUrl: string | null;
  price: Rial;
  compareAtPrice: Rial | null;
  discountPercent: number;
  inStock: boolean;
  variantCount: number;
  defaultVariantId: string | null;
  ratingAverage: number | null;
  ratingCount: number;
  keySpecs: KeySpec[];
}

export interface ProductSpec {
  attributeId: string;
  code: string;
  name: string;
  group: string | null;
  unit: string | null;
  value: string;
  isComparable: boolean;
}

export type StockAvailability = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface VariantOption {
  name: string;
  value: string;
}

export interface ProductVariantView {
  id: string;
  sku: string;
  title: string | null;
  options: VariantOption[];
  price: Rial;
  compareAtPrice: Rial | null;
  discountPercent: number;
  availability: StockAvailability;
  /** Only exposed when stock is low (see commerce settings), otherwise null. */
  availableQuantity: number | null;
}

export interface ProductImage {
  url: string;
  alt: string | null;
}

export interface ProductDetail {
  id: string;
  slug: string;
  title: string;
  englishTitle: string | null;
  model: string | null;
  manufacturer: string | null;
  countryOfOrigin: string | null;
  usageType: UsageType | null;
  warranty: string | null;
  shortDescription: string | null;
  description: string | null;
  videoUrl: string | null;
  tags: string[];
  brand: BrandSummary | null;
  category: CategorySummary;
  breadcrumbs: BreadcrumbItem[];
  images: ProductImage[];
  specs: ProductSpec[];
  variants: ProductVariantView[];
  related: ProductCard[];
  accessories: ProductCard[];
  rating: { average: number | null; count: number };
  seo: { title: string; description: string | null; canonicalUrl: string | null };
  updatedAt: string;
}

export interface CompareProduct {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  brand: string | null;
  price: Rial;
  inStock: boolean;
  specs: Record<string, string>;
}

export interface CompareResult {
  products: CompareProduct[];
  attributes: { code: string; name: string; unit: string | null }[];
}

/* ---------------------------------------------------------------- search */

export interface FacetValue {
  value: string;
  label: string;
  count: number;
}

export interface AttributeFacet {
  code: string;
  name: string;
  unit: string | null;
  values: FacetValue[];
}

export interface ProductSearchResult extends Paginated<ProductCard> {
  query: string | null;
  engine: 'meilisearch' | 'database';
  facets: {
    brands: FacetValue[];
    categories: FacetValue[];
    attributes: AttributeFacet[];
    price: { min: Rial; max: Rial } | null;
  };
}

export interface SearchSuggestion {
  products: Pick<ProductCard, 'id' | 'slug' | 'title' | 'imageUrl' | 'price' | 'inStock'>[];
  categories: Pick<CategorySummary, 'name' | 'slug'>[];
}

/* ------------------------------------------------------------------ cart */

export type CartLineIssue = 'unavailable' | 'out_of_stock' | 'insufficient_stock';

export interface CartLine {
  id: string;
  variantId: string;
  productId: string;
  productSlug: string;
  title: string;
  variantTitle: string | null;
  options: VariantOption[];
  sku: string;
  imageUrl: string | null;
  unitPrice: Rial;
  compareAtPrice: Rial | null;
  quantity: number;
  lineTotal: Rial;
  availableQuantity: number;
  issue: CartLineIssue | null;
}

export interface CartTotals {
  itemsCount: number;
  subtotal: Rial;
  /** Savings from compare-at prices (informational, already reflected in subtotal). */
  productSavings: Rial;
  couponDiscount: Rial;
  shippingCost: Rial | null;
  tax: Rial;
  taxIncluded: boolean;
  total: Rial;
}

export interface CartView {
  id: string;
  lines: CartLine[];
  coupon: { code: string; description: string | null } | null;
  totals: CartTotals;
  warnings: string[];
}

export interface ShippingOption {
  id: string;
  code: string;
  name: string;
  description: string | null;
  cost: Rial;
  isFree: boolean;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
}

export interface CheckoutPreview {
  cart: CartView;
  shippingOptions: ShippingOption[];
  addresses: AddressView[];
  paymentProviders: { code: string; name: string }[];
}

export interface CheckoutResult {
  orderId: string;
  orderNumber: number;
  amount: Rial;
  paymentUrl: string;
}

/* --------------------------------------------------------------- account */

export interface AddressView {
  id: string;
  title: string | null;
  recipientName: string;
  recipientMobile: string;
  province: string;
  city: string;
  addressLine: string;
  plaque: string | null;
  unit: string | null;
  postalCode: string;
  isDefault: boolean;
}

export type AddressSnapshot = Omit<AddressView, 'id' | 'isDefault' | 'title'>;

export interface WishlistItem {
  productId: string;
  addedAt: string;
  product: ProductCard;
}

/* ---------------------------------------------------------------- orders */

export interface OrderItemView {
  id: string;
  productId: string | null;
  variantId: string | null;
  productSlug: string | null;
  title: string;
  variantTitle: string | null;
  sku: string;
  imageUrl: string | null;
  unitPrice: Rial;
  quantity: number;
  total: Rial;
}

export interface OrderHistoryEntry {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface PaymentView {
  id: string;
  provider: string;
  amount: Rial;
  status: PaymentStatus;
  referenceId: string | null;
  cardMask: string | null;
  failureReason: string | null;
  createdAt: string;
  verifiedAt: string | null;
}

export interface OrderSummary {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  total: Rial;
  itemsCount: number;
  createdAt: string;
  paidAt: string | null;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItemView[];
  subtotal: Rial;
  discountTotal: Rial;
  shippingCost: Rial;
  taxTotal: Rial;
  taxIncluded: boolean;
  couponCode: string | null;
  shippingMethodName: string;
  shippingAddress: AddressSnapshot;
  customerNote: string | null;
  trackingCode: string | null;
  reservationExpiresAt: string | null;
  history: OrderHistoryEntry[];
  payments: PaymentView[];
  canCancel: boolean;
  canPay: boolean;
}

export interface AdminOrderSummary extends OrderSummary {
  customer: { id: string; fullName: string; mobile: string | null };
}

export interface AdminOrderDetail extends OrderDetail {
  customer: { id: string; fullName: string; mobile: string | null; email: string | null };
  adminNote: string | null;
  allowedTransitions: OrderStatus[];
}

export interface PaymentResultView {
  status: PaymentStatus;
  orderId: string;
  orderNumber: number;
  amount: Rial;
  referenceId: string | null;
  message: string;
}

export interface MockPaymentSession {
  authority: string;
  amount: Rial;
  orderNumber: number;
  status: PaymentStatus;
  callbackUrl: string;
}

/* ---------------------------------------------------------- reviews / Q&A */

export interface ReviewView {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  isVerifiedBuyer: boolean;
  createdAt: string;
}

export interface QuestionView {
  id: string;
  body: string;
  authorName: string;
  answer: string | null;
  answeredBy: string | null;
  answeredAt: string | null;
  createdAt: string;
}

export interface AdminReviewView extends ReviewView {
  status: ReviewStatus;
  product: { id: string; title: string; slug: string };
}

export interface AdminQuestionView extends QuestionView {
  status: QuestionStatus;
  product: { id: string; title: string; slug: string };
}

/* ----------------------------------------------------------------- admin */

export interface AttributeOptionView {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
}

export interface AttributeView {
  id: string;
  code: string;
  name: string;
  type: AttributeType;
  unit: string | null;
  groupName: string | null;
  description: string | null;
  isFilterable: boolean;
  isSearchable: boolean;
  isComparable: boolean;
  sortOrder: number;
  options: AttributeOptionView[];
}

export interface CategoryAttributeView {
  attribute: AttributeView;
  isRequired: boolean;
  isFilterable: boolean;
  sortOrder: number;
}

export interface AdminCategoryView extends CategoryTreeNode {
  seoTitle: string | null;
  seoDescription: string | null;
  attributes: CategoryAttributeView[];
}

export interface AdminBrandView extends BrandSummary {
  description: string | null;
  country: string | null;
  website: string | null;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  productCount: number;
}

export interface StockLevelView {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  onHand: number;
  reserved: number;
  available: number;
}

export interface AdminVariantView {
  id: string;
  sku: string;
  barcode: string | null;
  title: string | null;
  options: VariantOption[];
  price: Rial;
  compareAtPrice: Rial | null;
  lowStockThreshold: number;
  weightGrams: number | null;
  isActive: boolean;
  stock: { onHand: number; reserved: number; available: number };
  levels: StockLevelView[];
}

export interface AdminProductListItem {
  id: string;
  title: string;
  slug: string;
  status: ProductStatus;
  imageUrl: string | null;
  brandName: string | null;
  categoryName: string;
  skus: string[];
  minPrice: Rial;
  maxPrice: Rial;
  stock: { onHand: number; reserved: number; available: number };
  isLowStock: boolean;
  updatedAt: string;
}

export interface AdminProductDetail {
  id: string;
  title: string;
  englishTitle: string | null;
  slug: string;
  status: ProductStatus;
  categoryId: string;
  brandId: string | null;
  model: string | null;
  manufacturer: string | null;
  countryOfOrigin: string | null;
  usageType: UsageType | null;
  warranty: string | null;
  shortDescription: string | null;
  description: string | null;
  videoUrl: string | null;
  tags: string[];
  images: ProductImage[];
  attributes: { attributeId: string; value: string | number | boolean | string[] }[];
  variants: AdminVariantView[];
  relatedProductIds: string[];
  accessoryProductIds: string[];
  isFeatured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  marketplaceSync: {
    channel: string;
    status: string;
    lastSyncedAt: string | null;
    lastError: string | null;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseView {
  id: string;
  code: string;
  name: string;
  province: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  priority: number;
  isActive: boolean;
  isDefault: boolean;
}

export interface InventoryRow {
  variantId: string;
  productId: string;
  productTitle: string;
  variantTitle: string | null;
  sku: string;
  lowStockThreshold: number;
  onHand: number;
  reserved: number;
  available: number;
  isLowStock: boolean;
  levels: StockLevelView[];
}

export interface StockMovementView {
  id: string;
  type: StockMovementType;
  quantity: number;
  onHandAfter: number;
  sku: string;
  productTitle: string;
  warehouseName: string;
  reference: string | null;
  note: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface CouponView {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  maxDiscount: Rial | null;
  minSubtotal: Rial | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface ShippingMethodView extends ShippingOption {
  baseCost: Rial;
  freeShippingThreshold: Rial | null;
  provinces: string[];
  isActive: boolean;
  sortOrder: number;
}

export interface CustomerListItem {
  id: string;
  fullName: string;
  mobile: string | null;
  email: string | null;
  isActive: boolean;
  ordersCount: number;
  totalSpent: Rial;
  createdAt: string;
}

export interface CustomerDetail extends CustomerListItem {
  nationalCode: string | null;
  addresses: AddressView[];
  recentOrders: OrderSummary[];
  lastLoginAt: string | null;
}

export interface StaffUserView {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  isActive: boolean;
  roles: { id: string; key: string; name: string }[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface RoleView {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Permission[];
  usersCount: number;
}

export interface AuditLogView {
  id: string;
  actorType: string;
  actor: { id: string; fullName: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface AdminPaymentView extends PaymentView {
  order: { id: string; orderNumber: number };
  customerName: string;
}

export interface DashboardStats {
  salesToday: Rial;
  salesMonth: Rial;
  ordersToday: number;
  ordersMonth: number;
  awaitingFulfillment: number;
  awaitingPayment: number;
  lowStockCount: number;
  customersCount: number;
  salesByDay: { date: string; total: Rial; orders: number }[];
  lowStockItems: InventoryRow[];
  topProducts: {
    productId: string;
    title: string;
    slug: string;
    quantity: number;
    revenue: Rial;
  }[];
  recentOrders: AdminOrderSummary[];
}

export interface ContentPageView {
  slug: string;
  title: string;
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}

export interface FaqItemView {
  id: string;
  question: string;
  answer: string;
  category: string | null;
}

export interface HomePageData {
  featured: ProductCard[];
  newest: ProductCard[];
  onSale: ProductCard[];
  categories: CategorySummary[];
  brands: BrandSummary[];
}

/* --------------------------------------------------------------- support */

export interface TicketMessageView {
  id: string;
  authorType: 'customer' | 'staff' | 'system';
  /** Staff are shown by first name only to customers. */
  authorName: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface TicketSummary {
  id: string;
  ticketNumber: number;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  orderNumber: number | null;
  unread: boolean;
  lastMessageAt: string;
  createdAt: string;
}

export interface TicketDetail extends TicketSummary {
  orderId: string | null;
  messages: TicketMessageView[];
  canReply: boolean;
}

export interface AdminTicketSummary extends Omit<TicketSummary, 'unread'> {
  priority: TicketPriority;
  unread: boolean;
  customer: { id: string; fullName: string; mobile: string | null };
  assignee: { id: string; fullName: string } | null;
  messagesCount: number;
}

export interface AdminTicketDetail extends AdminTicketSummary {
  orderId: string | null;
  customerEmail: string | null;
  messages: TicketMessageView[];
  /** Recent orders of the customer, for context while answering. */
  recentOrders: OrderSummary[];
}

export interface StaffOption {
  id: string;
  fullName: string;
}

/* -------------------------------------------------------------- invoices */

/** Party as printed on an invoice (snapshot taken when the invoice is issued). */
export interface InvoiceParty {
  name: string;
  nationalId: string | null;
  economicCode: string | null;
  registrationNumber: string | null;
  nationalCode: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
}

export interface InvoiceLine {
  title: string;
  sku: string | null;
  quantity: number;
  unitPrice: Rial;
  total: Rial;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: number;
  type: InvoiceType;
  orderId: string;
  orderNumber: number;
  buyerName: string;
  total: Rial;
  issuedAt: string;
}

export interface InvoiceView extends InvoiceSummary {
  /** For credit notes: the sale invoice being corrected. */
  saleInvoiceNumber: number | null;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  lines: InvoiceLine[];
  subtotal: Rial;
  discountTotal: Rial;
  shippingCost: Rial;
  taxTotal: Rial;
  taxIncluded: boolean;
  totalInWords: string;
  note: string | null;
}

/* ---------------------------------------------------------- integrations */

export interface IntegrationCredentialField {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  /** Whether a value is stored. Secret values are never returned. */
  configured: boolean;
  /** Non-secret values are shown as-is; secrets only as a masked hint. */
  preview: string | null;
}

export interface IntegrationView {
  code: string;
  name: string;
  description: string;
  /** push: we send products to the channel; pull: the channel reads our feed. */
  kind: 'push' | 'pull';
  /** False until the channel's official API spec and credentials are available. */
  available: boolean;
  /** Honest note about what is and is not implemented for this channel. */
  notes: string;
  isEnabled: boolean;
  status: IntegrationStatus;
  credentialFields: IntegrationCredentialField[];
  feedUrl: string | null;
  lastCheckedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  listings: Record<MarketplaceSyncStatus, number>;
}

export interface IntegrationLogView {
  id: string;
  level: IntegrationLogLevel;
  action: string;
  message: string;
  productId: string | null;
  createdAt: string;
}
