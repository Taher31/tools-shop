import { ContentPage, contentPageMetadata } from '@/components/common/content-page';

export const generateMetadata = () => contentPageMetadata('about');

export default function Page() {
  return <ContentPage slug="about" />;
}
