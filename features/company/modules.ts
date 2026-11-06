/** Canonical company-only module manifest, maintained by the W10 integrator.
 * Reuse W4 shell navigation, never maintain a second divergent registry.
 */
import { COMPANY_SHELL_MODULES, companyShellModuleBySlug } from './shell/navigation';
export const COMPANY_MODULES = COMPANY_SHELL_MODULES;
export type CompanyModuleSlug = typeof COMPANY_SHELL_MODULES[number]['slug'];
export const companyModuleBySlug = companyShellModuleBySlug;
