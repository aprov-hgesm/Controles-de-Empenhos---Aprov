import { NextResponse } from 'next/server';

import { FounderAuthError } from '../../../../lib/server/firebaseFounderAuth';
import { verifyPlatformPrincipal, PlatformAuthorizationError } from '../../../../lib/server/platformAuthorization';
import { evaluateServerAuthorization } from '../../../../lib/server/authorizationPolicy';
import { parseEmpenhoPdfBytes } from '../../../../lib/server/empenhoPdfParser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 12 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const principal = await verifyPlatformPrincipal(request.headers.get('authorization'));
    const authorization = evaluateServerAuthorization(principal, { capability: 'core.parse' });
    if (!authorization.allowed) {
      return NextResponse.json({error:'Acesso operacional negado.'},{status:403});
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Selecione um PDF de Nota de Empenho.' },
        { status: 400 }
      );
    }

    if (
      file.size <= 0
      || file.size > MAX_FILE_SIZE
      || (
        file.type
        && file.type !== 'application/pdf'
      )
    ) {
      return NextResponse.json(
        { error: 'O arquivo deve ser um PDF de até 12 MB.' },
        { status: 400 }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = parseEmpenhoPdfBytes(bytes);

    return NextResponse.json(
      { result },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    if (error instanceof FounderAuthError || error instanceof PlatformAuthorizationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error('Falha ao interpretar Nota de Empenho SIAFI:', error);
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : 'Não foi possível interpretar a Nota de Empenho.',
      },
      { status: 422 }
    );
  }
}
