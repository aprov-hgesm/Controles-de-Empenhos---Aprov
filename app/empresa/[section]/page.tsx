import { notFound } from 'next/navigation';
import { CompanyModulePlaceholder } from '../../../components/company/CompanyModulePlaceholder';
import { CompanyOperationalModule, COMPANY_ACTIVE_MODULE_SLUGS } from '../../../components/company/CompanyOperationalModule';
import { companyShellModuleBySlug } from '../../../features/company/shell/navigation';

export default async function CompanySectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const module = companyShellModuleBySlug(section);
  if (!module || !module.slug) notFound();
  return COMPANY_ACTIVE_MODULE_SLUGS.includes(module.slug as typeof COMPANY_ACTIVE_MODULE_SLUGS[number])
    ? <CompanyOperationalModule slug={module.slug} />
    : <CompanyModulePlaceholder slug={module.slug} />;
}
