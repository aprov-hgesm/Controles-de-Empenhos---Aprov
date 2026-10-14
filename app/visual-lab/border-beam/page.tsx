import { notFound } from 'next/navigation';
import { EmprovexBorderBeamDemo } from '@/components/visual/EmprovexBorderBeamDemo';

/** Internal visual laboratory. Hard 404 on ALL production-mode builds, including Preview. */
export default function BorderBeamLabPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <EmprovexBorderBeamDemo />;
}
