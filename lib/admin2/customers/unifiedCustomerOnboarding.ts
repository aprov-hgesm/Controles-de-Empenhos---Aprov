import {
  buildProvisionedSectorRecords,
  validateSectorProvisioningInput,
  type CreateSectorWorkspaceInput,
} from '../../sectorProvisioning';
import { buildInitialBillingAccount } from '../../billing';
import type { Workspace } from '../../platformIdentity';
import {
  buildCommercialCustomer,
  type CommercialCustomer,
  type CommercialCustomerInput,
} from './commercialCustomerContract';

export interface UnifiedCustomerOnboardingInput {
  sector: CreateSectorWorkspaceInput;
  commercial: Omit<CommercialCustomerInput, 'workspaceId'>;
}

export const ADMIN2_INITIAL_TRIAL_DAYS = 30;

/** O onboarding ADMIN 2.0 sempre concede trial. Não aceitar override do formulário. */
export function validateUnifiedOnboarding(input: UnifiedCustomerOnboardingInput): string[] {
  return validateSectorProvisioningInput({
    ...input.sector,
    grantTrial: true,
  }).concat(
    input.commercial.displayName.trim() ? [] : ['Informe o nome comercial.'],
    input.commercial.contactName.length <= 100 ? [] : ['O nome do contato excede 100 caracteres.']
  );
}

export function buildUnifiedOnboardingRecords(
  input: UnifiedCustomerOnboardingInput,
  actor: string,
  firebaseUid: string,
  now: string
) {
  const errors = validateUnifiedOnboarding(input);
  if (errors.length) throw new Error(errors.join(' '));
  const { workspace, account } = buildProvisionedSectorRecords(
    { ...input.sector, grantTrial: true },
    actor,
    firebaseUid,
    now
  );
  const commercialCustomer = buildCommercialCustomer(
    workspace.id,
    { ...input.commercial, workspaceId: workspace.id },
    actor,
    now
  );
  const billingAccount = buildInitialBillingAccount(
    workspace,
    actor,
    true,
    ADMIN2_INITIAL_TRIAL_DAYS,
    now
  );
  if (billingAccount.status !== 'trial' || billingAccount.workspaceId !== workspace.id) {
    throw new Error('Onboarding não produziu o trial obrigatório de um workspace novo.');
  }
  return { workspace, account, commercialCustomer, billingAccount };
}

export interface UnifiedPreviewRecord {
  workspace: Workspace;
  commercialCustomer: CommercialCustomer;
  billing: ReturnType<typeof buildInitialBillingAccount>;
}

/** Espelho explícito do trial para estado transitório do localhost, sem escrever no Firebase. */
export function createPreviewOnboarding(
  input: UnifiedCustomerOnboardingInput,
  now = new Date().toISOString()
): UnifiedPreviewRecord {
  const result = buildUnifiedOnboardingRecords(input, 'preview-local', 'preview-emulator-only', now);
  return { workspace: result.workspace, commercialCustomer: result.commercialCustomer, billing: result.billingAccount };
}
