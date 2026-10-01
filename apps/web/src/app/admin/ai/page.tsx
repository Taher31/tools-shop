'use client';

import { useQuery } from '@tanstack/react-query';
import type { AiSettingsView } from '@toolshop/shared';
import { Badge, cn, Skeleton } from '@toolshop/ui';
import { BarChart3, MessageCircle, MessagesSquare, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { AiConversations } from '@/components/admin/ai/ai-conversations';
import { AiMessengers } from '@/components/admin/ai/ai-messengers';
import { AiOverview } from '@/components/admin/ai/ai-overview';
import { AiSettingsForm } from '@/components/admin/ai/ai-settings-form';
import { PageHeader } from '@/components/admin/page-header';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';

const TABS = [
  { id: 'overview', label: 'نمای کلی و مصرف', icon: BarChart3 },
  { id: 'settings', label: 'تنظیمات', icon: Settings2 },
  { id: 'conversations', label: 'گفت‌وگوها', icon: MessagesSquare },
  { id: 'messengers', label: 'ربات پیام‌رسان‌ها', icon: MessageCircle },
] as const;
type Tab = (typeof TABS)[number]['id'];

export default function AiCenterPage() {
  const { can } = usePermissions();
  const canManage = can('ai.manage');
  const [tab, setTab] = useState<Tab>('overview');
  const view = useQuery({
    queryKey: ['admin', 'ai', 'settings'],
    queryFn: () => api.get<AiSettingsView>('/admin/ai/settings'),
  });
  const v = view.data;

  return (
    <>
      <PageHeader
        title="مرکز هوش مصنوعی"
        description={
          <span className="flex flex-wrap items-center gap-2">
            {v ? (
              <Badge variant={v.settings.enabled && v.ready ? 'success' : 'secondary'}>
                {v.settings.enabled ? (v.ready ? 'فعال' : 'نیازمند کلید API') : 'خاموش'}
              </Badge>
            ) : null}
            دستیار فروش، پاسخ‌گویی به پرسش‌ها، پشتیبانی، تولید محتوا و ربات پیام‌رسان‌ها — با بودجه
            و نظارت کامل.
          </span>
        }
      />
      <div
        role="tablist"
        aria-label="بخش‌های مرکز هوش مصنوعی"
        className="bg-muted mb-5 flex gap-1 overflow-x-auto rounded-lg p-1"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors',
              tab === id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {!v ? (
          <Skeleton className="h-96" />
        ) : tab === 'overview' ? (
          <AiOverview view={v} />
        ) : tab === 'settings' ? (
          <AiSettingsForm key={JSON.stringify(v.settings)} view={v} canManage={canManage} />
        ) : tab === 'conversations' ? (
          <AiConversations />
        ) : (
          <AiMessengers canManage={canManage} />
        )}
      </div>
    </>
  );
}
