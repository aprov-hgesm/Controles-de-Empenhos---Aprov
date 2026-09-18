import type { Empenho } from './types';

export interface EmpenhoClassDefinition {
  code: string;
  description: string;
}

export const DEFAULT_EMPENHO_CLASSES: EmpenhoClassDefinition[] = [
  {
    code: 'QR',
    description: 'Quadro de Rancho / Subsistência e Alimentação Geral',
  },
  {
    code: 'CALI',
    description: 'Cálculo de Alimentação / Insumos e Materiais de Apoio',
  },
  {
    code: 'PASA',
    description: 'Plano de Apoio / Alimentação e Serviços Especializados',
  },
  {
    code: 'FUNADOM',
    description: 'Administração da OM / Apoio Administrativo',
  },
];

export function normalizeEmpenhoClassCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 24);
}

export function normalizeEmpenhoClassDescription(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 180);
}

export function mergeEmpenhoClassDefinitions(
  configured: EmpenhoClassDefinition[] | null | undefined,
  empenhos: Empenho[] = []
): EmpenhoClassDefinition[] {
  const definitions = new Map<string, EmpenhoClassDefinition>();

  for (const item of DEFAULT_EMPENHO_CLASSES) {
    definitions.set(item.code, { ...item });
  }

  for (const item of configured || []) {
    const code = normalizeEmpenhoClassCode(item?.code || '');
    if (!code) continue;

    definitions.set(code, {
      code,
      description:
        normalizeEmpenhoClassDescription(item?.description || '')
        || definitions.get(code)?.description
        || 'Classe de empenho',
    });
  }

  for (const empenho of empenhos) {
    const code = normalizeEmpenhoClassCode(empenho.classification || 'QR') || 'QR';
    if (!definitions.has(code)) {
      definitions.set(code, {
        code,
        description: 'Classe identificada em empenho já cadastrado',
      });
    }
  }

  return Array.from(definitions.values());
}

export function validateNewEmpenhoClass(
  codeInput: string,
  descriptionInput: string,
  existing: EmpenhoClassDefinition[]
): { code: string; description: string } {
  const code = normalizeEmpenhoClassCode(codeInput);
  const description = normalizeEmpenhoClassDescription(descriptionInput);

  if (!code) {
    throw new Error('Informe um código válido para a nova classe.');
  }

  if (code.length < 2) {
    throw new Error('O código da classe deve possuir pelo menos 2 caracteres.');
  }

  if (!description) {
    throw new Error('Informe o descritivo da nova classe.');
  }

  if (existing.some((item) => normalizeEmpenhoClassCode(item.code) === code)) {
    throw new Error(`A classe ${code} já existe.`);
  }

  return { code, description };
}
