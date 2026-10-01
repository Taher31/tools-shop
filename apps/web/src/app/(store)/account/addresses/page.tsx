'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AddressView } from '@toolshop/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
  toast,
} from '@toolshop/ui';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AddressDialog, AddressText } from '@/components/account/address-form';
import { api } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';

export default function AddressesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AddressView | null>(null);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get<AddressView[]>('/account/addresses'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/account/addresses/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast.success('آدرس حذف شد.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const makeDefault = useMutation({
    mutationFn: (id: string) => api.post<AddressView[]>(`/account/addresses/${id}/default`, {}),
    onSuccess: (list) => queryClient.setQueryData(['addresses'], list),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>آدرس‌ها</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus /> آدرس جدید
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32" />
        ) : !data || data.length === 0 ? (
          <EmptyState icon={<MapPin />} title="هنوز آدرسی ثبت نکرده‌اید" />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {data.map((address) => (
              <li
                key={address.id}
                className="border-border flex flex-col gap-3 rounded-md border p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold">{address.title ?? 'آدرس'}</span>
                  {address.isDefault ? <Badge variant="success">پیش‌فرض</Badge> : null}
                </div>
                <AddressText address={address} />
                <div className="mt-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(address);
                      setOpen(true);
                    }}
                  >
                    <Pencil /> ویرایش
                  </Button>
                  {!address.isDefault ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => makeDefault.mutate(address.id)}
                    >
                      پیش‌فرض کن
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive ms-auto"
                    onClick={() => window.confirm('این آدرس حذف شود؟') && remove.mutate(address.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <AddressDialog open={open} onOpenChange={setOpen} address={editing} />
    </Card>
  );
}
