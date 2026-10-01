import { ContentPage, contentPageMetadata } from '@/components/common/content-page';

export const generateMetadata = () => contentPageMetadata('warranty');

export default function Page() {
  return <ContentPage slug="warranty" />;
}
