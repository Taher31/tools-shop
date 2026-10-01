import { ContentPage, contentPageMetadata } from '@/components/common/content-page';

export const generateMetadata = () => contentPageMetadata('privacy');

export default function Page() {
  return <ContentPage slug="privacy" />;
}
