'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type { CommerceSettings, LegalSettings, StoreSettings, TrustBadge } from '@toolshop/shared';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  NativeSelect,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from '@toolshop/ui';
import { Plus, RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminMutation } from '@/components/admin/query';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';

interface AllSettings {
  store: StoreSettings;
  legal: LegalSettings;
  commerce: CommerceSettings;
}

const SOCIALS: [keyof StoreSettings['socials'], string][] = [
  ['instagram', 'اینستاگرام'],
  ['telegram', 'تلگرام'],
  ['eitaa', 'ایتا'],
  ['bale', 'بله'],
  ['aparat', 'آپارات'],
  ['linkedin', 'لینکدین'],
];

function useGroupForm<G extends keyof AllSettings>(group: G, initial: AllSettings[G] | undefined) {
  const [value, setValue] = useState<AllSettings[G] | undefined>(initial);
  useEffect(() => setValue(initial), [initial]);
  const save = useAdminMutation(() => api.put(`/admin/settings/${group}`, value), {
    success: 'تنظیمات ذخیره شد.',
  });
  return { value, setValue, save };
}

export default function SettingsPage() {
  const { can } = usePermissions();
  const editable = can('settings.update');
  const settings = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get<AllSettings>('/admin/settings'),
  });
  const store = useGroupForm('store', settings.data?.store);
  const legal = useGroupForm('legal', settings.data?.legal);
  const commerce = useGroupForm('commerce', settings.data?.commerce);
  const reindex = useMutation({
    mutationFn: () => api.post('/admin/search/reindex'),
    onSuccess: () => toast.success('بازسازی ایندکس جستجو در صف قرار گرفت.'),
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!store.value || !legal.value || !commerce.value) return <Skeleton className="h-96" />;
  const s = store.value;
  const l = legal.value;
  const c = commerce.value;
  const setStore = (patch: Partial<StoreSettings>) => store.setValue({ ...s, ...patch });
  const setLegal = (patch: Partial<LegalSettings>) => legal.setValue({ ...l, ...patch });
  const setCommerce = (patch: Partial<CommerceSettings>) => commerce.setValue({ ...c, ...patch });
  const setBadge = (index: number, patch: Partial<TrustBadge>) =>
    setLegal({ trustBadges: l.trustBadges.map((b, i) => (i === index ? { ...b, ...patch } : b)) });

  return (
    <>
      <PageHeader
        title="تنظیمات"
        description="هویت فروشگاه، اطلاعات حقوقی و قواعد تجاری – همه تغییرات در گزارش رویدادها ثبت می‌شوند."
      />
      <Tabs defaultValue="store" dir="rtl">
        <TabsList className="mb-4">
          <TabsTrigger value="store">فروشگاه</TabsTrigger>
          <TabsTrigger value="legal">حقوقی و نمادها</TabsTrigger>
          <TabsTrigger value="commerce">فروش و مالیات</TabsTrigger>
          <TabsTrigger value="system">سیستم</TabsTrigger>
        </TabsList>

        <TabsContent value="store" className="pt-0">
          <Card>
            <CardContent className="grid gap-4 pt-5 md:grid-cols-2">
              <Field label="نام فروشگاه" htmlFor="st-name">
                <Input
                  id="st-name"
                  value={s.storeName}
                  disabled={!editable}
                  onChange={(e) => setStore({ storeName: e.target.value })}
                />
              </Field>
              <Field label="شعار" htmlFor="st-tag">
                <Input
                  id="st-tag"
                  value={s.tagline ?? ''}
                  disabled={!editable}
                  onChange={(e) => setStore({ tagline: e.target.value })}
                />
              </Field>
              <Field label="آدرس لوگو" htmlFor="st-logo" hint="خالی = لوگوی موقت">
                <Input
                  id="st-logo"
                  dir="ltr"
                  value={s.logoUrl ?? ''}
                  disabled={!editable}
                  onChange={(e) => setStore({ logoUrl: e.target.value })}
                />
              </Field>
              <Field label="تلفن پشتیبانی" htmlFor="st-phone">
                <Input
                  id="st-phone"
                  dir="ltr"
                  value={s.supportPhone ?? ''}
                  disabled={!editable}
                  onChange={(e) => setStore({ supportPhone: e.target.value })}
                />
              </Field>
              <Field label="ایمیل پشتیبانی" htmlFor="st-email">
                <Input
                  id="st-email"
                  dir="ltr"
                  value={s.supportEmail ?? ''}
                  disabled={!editable}
                  onChange={(e) => setStore({ supportEmail: e.target.value })}
                />
              </Field>
              <Field label="ساعات کاری" htmlFor="st-hours">
                <Input
                  id="st-hours"
                  value={s.workingHours ?? ''}
                  disabled={!editable}
                  onChange={(e) => setStore({ workingHours: e.target.value })}
                />
              </Field>
              <Field label="آدرس" htmlFor="st-addr" className="md:col-span-2">
                <Textarea
                  id="st-addr"
                  rows={2}
                  value={s.address ?? ''}
                  disabled={!editable}
                  onChange={(e) => setStore({ address: e.target.value })}
                />
              </Field>
              {SOCIALS.map(([key, label]) => (
                <Field key={key} label={label} htmlFor={`st-${key}`}>
                  <Input
                    id={`st-${key}`}
                    dir="ltr"
                    placeholder="https://"
                    value={s.socials[key] ?? ''}
                    disabled={!editable}
                    onChange={(e) => setStore({ socials: { ...s.socials, [key]: e.target.value } })}
                  />
                </Field>
              ))}
              {editable ? (
                <div className="md:col-span-2">
                  <Button
                    loading={store.save.isPending}
                    onClick={() => store.save.mutate(undefined)}
                  >
                    ذخیره
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="legal" className="pt-0">
          <Card>
            <CardContent className="grid gap-4 pt-5 md:grid-cols-2">
              <Field label="نام شرکت / فروشگاه" htmlFor="lg-co">
                <Input
                  id="lg-co"
                  value={l.companyName ?? ''}
                  disabled={!editable}
                  onChange={(e) => setLegal({ companyName: e.target.value })}
                />
              </Field>
              <Field label="شماره ثبت" htmlFor="lg-reg">
                <Input
                  id="lg-reg"
                  dir="ltr"
                  value={l.registrationNumber ?? ''}
                  disabled={!editable}
                  onChange={(e) => setLegal({ registrationNumber: e.target.value })}
                />
              </Field>
              <Field label="شناسه ملی" htmlFor="lg-nid">
                <Input
                  id="lg-nid"
                  dir="ltr"
                  value={l.nationalId ?? ''}
                  disabled={!editable}
                  onChange={(e) => setLegal({ nationalId: e.target.value })}
                />
              </Field>
              <Field label="کد اقتصادی" htmlFor="lg-eco">
                <Input
                  id="lg-eco"
                  dir="ltr"
                  value={l.economicCode ?? ''}
                  disabled={!editable}
                  onChange={(e) => setLegal({ economicCode: e.target.value })}
                />
              </Field>
              <Field label="مجوزها" htmlFor="lg-lic" className="md:col-span-2">
                <Textarea
                  id="lg-lic"
                  rows={2}
                  value={l.licenses ?? ''}
                  disabled={!editable}
                  onChange={(e) => setLegal({ licenses: e.target.value })}
                />
              </Field>
              <div className="space-y-2 md:col-span-2">
                <p className="text-sm font-bold">نمادهای اعتماد (اینماد، ساماندهی، …)</p>
                <Alert variant="info">
                  تصویر و لینکی را که سامانه صادرکننده نماد در اختیار شما گذاشته وارد کنید؛ در فوتر
                  همه صفحات نمایش داده می‌شود.
                </Alert>
                {l.trustBadges.map((badge, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_2fr_2fr_auto]">
                    <Input
                      placeholder="عنوان"
                      value={badge.title}
                      disabled={!editable}
                      onChange={(e) => setBadge(index, { title: e.target.value })}
                    />
                    <Input
                      placeholder="آدرس تصویر"
                      dir="ltr"
                      value={badge.imageUrl}
                      disabled={!editable}
                      onChange={(e) => setBadge(index, { imageUrl: e.target.value })}
                    />
                    <Input
                      placeholder="لینک"
                      dir="ltr"
                      value={badge.linkUrl ?? ''}
                      disabled={!editable}
                      onChange={(e) => setBadge(index, { linkUrl: e.target.value })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!editable}
                      onClick={() =>
                        setLegal({ trustBadges: l.trustBadges.filter((_, i) => i !== index) })
                      }
                      aria-label="حذف"
                    >
                      <X />
                    </Button>
                  </div>
                ))}
                {editable ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setLegal({
                        trustBadges: [...l.trustBadges, { title: '', imageUrl: '', linkUrl: null }],
                      })
                    }
                  >
                    <Plus /> افزودن نماد
                  </Button>
                ) : null}
              </div>
              {editable ? (
                <div className="md:col-span-2">
                  <Button
                    loading={legal.save.isPending}
                    onClick={() => legal.save.mutate(undefined)}
                  >
                    ذخیره
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commerce" className="pt-0">
          <Card>
            <CardContent className="grid gap-4 pt-5 md:grid-cols-2">
              <Field label="واحد نمایش قیمت" htmlFor="cm-cur">
                <NativeSelect
                  id="cm-cur"
                  value={c.displayCurrency}
                  disabled={!editable}
                  onChange={(e) =>
                    setCommerce({ displayCurrency: e.target.value as 'IRT' | 'IRR' })
                  }
                >
                  <option value="IRT">تومان</option>
                  <option value="IRR">ریال</option>
                </NativeSelect>
              </Field>
              <Field label="نرخ مالیات بر ارزش افزوده (٪)" htmlFor="cm-tax">
                <Input
                  id="cm-tax"
                  type="number"
                  dir="ltr"
                  value={c.taxRatePercent}
                  disabled={!editable}
                  onChange={(e) => setCommerce({ taxRatePercent: Number(e.target.value) })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={c.pricesIncludeTax}
                  disabled={!editable}
                  onCheckedChange={(v) => setCommerce({ pricesIncludeTax: v })}
                />{' '}
                قیمت‌ها شامل مالیات هستند
              </label>
              <Field label="نمایش تعداد موجودی وقتی کمتر از" htmlFor="cm-show">
                <Input
                  id="cm-show"
                  type="number"
                  dir="ltr"
                  value={c.showStockCountBelow}
                  disabled={!editable}
                  onChange={(e) => setCommerce({ showStockCountBelow: Number(e.target.value) })}
                />
              </Field>
              <Field label="حد هشدار پیش‌فرض موجودی" htmlFor="cm-low">
                <Input
                  id="cm-low"
                  type="number"
                  dir="ltr"
                  value={c.defaultLowStockThreshold}
                  disabled={!editable}
                  onChange={(e) =>
                    setCommerce({ defaultLowStockThreshold: Number(e.target.value) })
                  }
                />
              </Field>
              {editable ? (
                <div className="md:col-span-2">
                  <Button
                    loading={commerce.save.isPending}
                    onClick={() => commerce.save.mutate(undefined)}
                  >
                    ذخیره
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="pt-0">
          <Card>
            <CardHeader>
              <CardTitle>جستجو</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                ایندکس جستجو به‌صورت خودکار پس از هر تغییر محصول/موجودی به‌روز می‌شود. در صورت نیاز
                می‌توانید آن را به‌طور کامل و بدون قطعی بازسازی کنید.
              </p>
              <Button
                variant="outline"
                disabled={!can('search.reindex')}
                loading={reindex.isPending}
                onClick={() => reindex.mutate()}
              >
                <RefreshCw /> بازسازی کامل ایندکس جستجو
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
