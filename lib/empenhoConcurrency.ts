import type { Empenho } from './types';

export type EmpenhoConcurrencyErrorCode =
  | 'stale_revision'
  | 'create_conflict'
  | 'missing_empenho'
  | 'invalid_revision';

export class EmpenhoConcurrencyError extends Error {
  readonly code: EmpenhoConcurrencyErrorCode;

  constructor(code: EmpenhoConcurrencyErrorCode, message: string) {
    super(message);
    this.name = 'EmpenhoConcurrencyError';
    this.code = code;
  }
}

export function getEmpenhoRevision(
  empenho?: Pick<Empenho, 'revision'> | null
): number {
  const revision = empenho?.revision;
  if (revision === undefined || revision === null) return 0;
  if (!Number.isInteger(revision) || revision < 0) {
    throw new EmpenhoConcurrencyError(
      'invalid_revision',
      'O controle de versão do empenho está inválido. Atualize os dados antes de continuar.'
    );
  }
  return revision;
}

export function assertEmpenhoRevision(
  stored: Pick<Empenho, 'id' | 'revision'>,
  expectedRevision: number | undefined | null
): void {
  const storedRevision = getEmpenhoRevision(stored);
  const expected = expectedRevision === undefined || expectedRevision === null
    ? 0
    : expectedRevision;

  if (!Number.isInteger(expected) || expected < 0) {
    throw new EmpenhoConcurrencyError(
      'invalid_revision',
      `A revisão esperada do empenho ${stored.id} é inválida.`
    );
  }

  if (storedRevision !== expected) {
    throw new EmpenhoConcurrencyError(
      'stale_revision',
      `O empenho ${stored.id} foi alterado por outra sessão. Nenhuma alteração foi sobrescrita. Atualize a tela e tente novamente.`
    );
  }
}

export function buildNextEmpenho(
  candidate: Empenho,
  stored: Pick<Empenho, 'revision'> | null,
  userId: string,
  now = new Date().toISOString()
): Empenho {
  const nextRevision = getEmpenhoRevision(stored) + 1;
  return {
    ...candidate,
    revision: nextRevision,
    updatedAt: now,
    updatedBy: userId,
  };
}

export function buildNextEmpenhoRevisionMetadata(
  stored: Pick<Empenho, 'revision'>,
  userId: string,
  now = new Date().toISOString()
): Pick<Empenho, 'revision' | 'updatedAt' | 'updatedBy'> {
  return {
    revision: getEmpenhoRevision(stored) + 1,
    updatedAt: now,
    updatedBy: userId,
  };
}

export function isEmpenhoConcurrencyError(
  error: unknown
): error is EmpenhoConcurrencyError {
  return error instanceof EmpenhoConcurrencyError;
}
