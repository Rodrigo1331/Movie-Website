import { Link } from 'react-router';
import { Clapperboard } from 'lucide-react';
import { Page } from '../components/Layout';
import { EmptyState } from '../components/ui';

export function NotFoundPage() {
  return (
    <Page>
      <EmptyState icon={<Clapperboard />} title="Scene missing" action={<Link to="/" className="btn-primary">Back to dashboard</Link>}>
        This page ended up on the cutting room floor.
      </EmptyState>
    </Page>
  );
}
