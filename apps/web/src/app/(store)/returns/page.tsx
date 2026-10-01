import { ContentPage, contentPageMetadata } from '@/components/common/content-page';

export const generateMetadata = () => contentPageMetadata('returns');

export default function Page() {
  return <ContentPage slug="returns" />;
}
