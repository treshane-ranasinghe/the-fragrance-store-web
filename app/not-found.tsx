import { RootDocument } from '@/components/RootDocument';
import { NotFoundView } from '@/components/store/NotFoundView';

/** 404 for URLs outside the storefront languages (e.g. under /admin); shown in English */
export default function NotFound() {
  return (
    <RootDocument lang="en">
      <NotFoundView />
    </RootDocument>
  );
}
