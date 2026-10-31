import { notFound } from 'next/navigation';
import { EmprovexVisualIntegrationPreview } from '@/components/visual/EmprovexVisualIntegrationPreview';

/** Isolated no-data lab: local development only; always 404 on production Cloud Run. */
export default function VisualR1IntegrationPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <EmprovexVisualIntegrationPreview />;
}
