import { notFound } from 'next/navigation';
import { EmprovexVisualIntegrationPreview } from '@/components/visual/EmprovexVisualIntegrationPreview';

/** Development lab; inaccessible in production-mode builds (including Preview). */
export default function VisualR1IntegrationPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <EmprovexVisualIntegrationPreview />;
}
