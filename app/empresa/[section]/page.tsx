import { notFound } from 'next/navigation';
import { CompanyModulePlaceholder } from '../../../components/company/CompanyModulePlaceholder';
import { companyModuleBySlug } from '../../../features/company/modules';

export default async function CompanySectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const module = companyModuleBySlug(section);
  if (!module || !module.slug) notFound();
  return <CompanyModulePlaceholder slug={module.slug} />;
}
