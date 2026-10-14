import { notFound } from 'next/navigation';
import { EmprovexVisualIntegrationPreview } from '@/components/visual/EmprovexVisualIntegrationPreview';

/** Isolated no-data lab: local development or Vercel preview only; always 404 in Production. */
export default function VisualR1IntegrationPage() {
  if (process.env.NODE_ENV !== 'development' && process.env.VERCEL_ENV !== 'preview') notFound();
  return <EmprovexVisualIntegrationPreview />;
}
