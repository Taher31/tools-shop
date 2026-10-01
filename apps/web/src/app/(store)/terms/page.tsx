import { ContentPage, contentPageMetadata } from '@/components/common/content-page';

export const generateMetadata = () => contentPageMetadata('terms');

export default function Page() {
  return <ContentPage slug="terms" />;
}
