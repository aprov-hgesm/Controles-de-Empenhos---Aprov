import { NextResponse } from 'next/server';

import { FounderAuthError } from '../../../../lib/server/firebaseFounderAuth';
import {
  verifyPlatformPrincipal,
  PlatformAuthorizationError,
} from '../../../../lib/server/platformAuthorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reply(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

/**
 * Contexto para clientes web/móveis: não aceita workspace, UG ou role do caller.
 * A política efetiva é revalidada em CADA operação sensível no servidor.
 */
export async function GET(request: Request) {
  try {
    const principal = await verifyPlatformPrincipal(request.headers.get('authorization'));
    return reply({
      authorized: true,
      role: principal.role,
      workspaceId: principal.workspaceId,
      ug: principal.ug,
    }, 200);
  } catch (error) {
    if (error instanceof FounderAuthError || error instanceof PlatformAuthorizationError) {
      return reply({ authorized: false, code: 'AUTHORIZATION_DENIED' }, error.status);
    }
    console.error('[authz/context] failure', error instanceof Error ? error.name : 'error');
    return reply({ authorized: false, code: 'AUTHORIZATION_UNAVAILABLE' }, 503);
  }
}
