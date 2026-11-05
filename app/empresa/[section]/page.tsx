import { notFound } from 'next/navigation';
import { CompanyModulePlaceholder } from '../../../components/company/CompanyModulePlaceholder';
import { companyShellModuleBySlug } from '../../../features/company/shell/navigation';

export default async function CompanySectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const module = companyShellModuleBySlug(section);
  if (!module || !module.slug) notFound();
  return <CompanyModulePlaceholder slug={module.slug} />;
}
