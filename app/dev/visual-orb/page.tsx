import { notFound } from 'next/navigation';
import { EmprovexThinkingOrbPreview } from '@/features/inicio/components/EmprovexThinkingOrbPreview';

/** Deliberately unavailable in production builds; no auth or data involved. */
export default function VisualOrbDevelopmentPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <EmprovexThinkingOrbPreview />;
}
