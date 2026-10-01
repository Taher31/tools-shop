import { ContentPage, contentPageMetadata } from '@/components/common/content-page';

export const generateMetadata = () => contentPageMetadata('shipping');

export default function Page() {
  return <ContentPage slug="shipping" />;
}
