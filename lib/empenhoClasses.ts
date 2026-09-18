import type { Empenho } from './types';

export interface EmpenhoClassDefinition {
  code: string;
  description: string;
  requiresTermoRecebimento: boolean;
}

export const DEFAULT_EMPENHO_CLASSES: EmpenhoClassDefinition[] = [
  {
    code: 'QR',
    description: 'Quadro de Rancho / Subsistência e Alimentação Geral',
    requiresTermoRecebimento: true,
  },
  {
    code: 'CALI',
    description: 'Cálculo de Alimentação / Insumos e Materiais de Apoio',
    requiresTermoRecebimento: true,
  },
  {
    code: 'PASA',
    description: 'Plano de Apoio / Alimentação e Serviços Especializados',
    requiresTermoRecebimento: false,
  },
  {
    code: 'FUNADOM',
    description: 'Administração da OM / Apoio Administrativo',
    requiresTermoRecebimento: false,
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

function defaultRequirementForClass(code: string): boolean {
  return DEFAULT_EMPENHO_CLASSES.find((item) => item.code === code)?.requiresTermoRecebimento ?? true;
}

export function mergeEmpenhoClassDefinitions(
  configured: Array<Partial<EmpenhoClassDefinition>> | null | undefined,
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
      requiresTermoRecebimento:
        typeof item.requiresTermoRecebimento === 'boolean'
          ? item.requiresTermoRecebimento
          : definitions.get(code)?.requiresTermoRecebimento ?? true,
    });
  }

  for (const empenho of empenhos) {
    const code = normalizeEmpenhoClassCode(empenho.classification || 'QR') || 'QR';
    if (!definitions.has(code)) {
      definitions.set(code, {
        code,
        description: 'Classe identificada em empenho já cadastrado',
        requiresTermoRecebimento: defaultRequirementForClass(code),
      });
    }
  }

  return Array.from(definitions.values());
}

export function getEmpenhoClassDefinition(
  classification: string | null | undefined,
  definitions: EmpenhoClassDefinition[]
): EmpenhoClassDefinition {
  const code = normalizeEmpenhoClassCode(classification || 'QR') || 'QR';
  return definitions.find((item) => item.code === code) || {
    code,
    description: 'Classe de empenho',
    requiresTermoRecebimento: defaultRequirementForClass(code),
  };
}

export function classRequiresTermoRecebimento(
  classification: string | null | undefined,
  definitions: EmpenhoClassDefinition[]
): boolean {
  return getEmpenhoClassDefinition(classification, definitions).requiresTermoRecebimento;
}

export function validateNewEmpenhoClass(
  codeInput: string,
  descriptionInput: string,
  requiresTermoRecebimento: boolean,
  existing: EmpenhoClassDefinition[]
): EmpenhoClassDefinition {
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

  return { code, description, requiresTermoRecebimento };
}
