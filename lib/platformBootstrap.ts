import type { PlatformAdminAccount } from './platformIdentity';
import { normalizePlatformEmail } from './platformIdentity';

/**
 * Conta administrativa inicial da plataforma EMPROVEX.
 *
 * Este valor NAO concede, por si so, acesso a dados operacionais. O Bloco 2 apenas
 * registra a identidade bootstrap que sera usada pelos proximos blocos para criar
 * o registro administrativo e resolver o tipo de conta com seguranca.
 */
export const BOOTSTRAP_PLATFORM_ADMIN_EMAIL = normalizePlatformEmail(
  'codex.martis.dev@gmail.com'
);

export const BOOTSTRAP_PLATFORM_ADMIN_SOURCE = 'system:bootstrap';

/**
 * Verificacao deterministica usada durante a fase de bootstrap.
 * A fonte de verdade definitiva sera o registro administrativo persistido da
 * plataforma, e nao esta constante isoladamente.
 */
export function isBootstrapPlatformAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return normalizePlatformEmail(email) === BOOTSTRAP_PLATFORM_ADMIN_EMAIL;
}

/**
 * Cria o contrato inicial do administrador para posterior persistencia.
 * O firebaseUid permanece ausente ate o primeiro login Google bem-sucedido.
 */
export function createBootstrapPlatformAdminAccount(
  now: string = new Date().toISOString()
): PlatformAdminAccount {
  return {
    email: BOOTSTRAP_PLATFORM_ADMIN_EMAIL,
    accountType: 'platformAdmin',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    createdBy: BOOTSTRAP_PLATFORM_ADMIN_SOURCE,
  };
}
