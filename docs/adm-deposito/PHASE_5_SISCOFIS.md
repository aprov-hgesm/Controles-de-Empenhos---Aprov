# FASE 5 — SISCOFIS / Marco Zero / Conciliação

Este documento registra o contrato técnico implementado na FASE 5 do ADM Depósito.

## 1. Princípio

O SISCOFIS permanece como referência externa oficial.

O EMPROVEX não interpreta o relatório com IA embutida. O fluxo operacional é:

1. EMPROVEX gera o prompt oficial;
2. o operador utiliza uma IA externa com o relatório SISCOFIS;
3. a IA devolve somente JSON no contrato versionado;
4. o operador cola o JSON no EMPROVEX;
5. o EMPROVEX valida;
6. o EMPROVEX apresenta a prévia;
7. o operador confirma;
8. somente então ocorre persistência.

Nenhum conteúdo inválido ou não confirmado altera estoque.

## 2. Contrato JSON

Versão:

\`warehouse_siscofis_import_v1\`

Estrutura:

\`\`\`json
{
  "schemaVersion": "warehouse_siscofis_import_v1",
  "ug": "160416",
  "referenceDate": "2026-09-22",
  "sourceLabel": "Relatório SISCOFIS - posição de estoque",
  "rows": [
    {
      "rowId": "linha-001",
      "materialId": null,
      "description": "Arroz tipo 1",
      "unit": {
        "code": "kg",
        "label": null
      },
      "quantity": 25,
      "unitValue": 6.5,
      "totalValue": 162.5
    }
  ]
}
\`\`\`

Regras:
- JSON deve conter apenas os campos definidos;
- \`schemaVersion\` é obrigatória;
- UG deve coincidir com o contexto autenticado;
- data-base usa \`YYYY-MM-DD\`;
- 1 a 500 linhas por importação;
- \`rowId\` deve ser único;
- \`materialId\` só pode apontar para material canônico válido ou ser \`null\`;
- unidade reutiliza o contrato canônico da FASE 1;
- quantidades são não negativas e possuem até 6 casas;
- valores monetários são nulos ou não negativos com até 2 casas;
- inconsistência entre quantidade × valor unitário e valor total é apresentada como aviso;
- Número de Ficha SISCOFIS não integra o contrato.

## 3. Prompt oficial

O prompt gerado pelo EMPROVEX contém:
- instrução de retornar somente JSON;
- schema versionado;
- UG esperada;
- unidades aceitas;
- regra de não inventar dados;
- proibição de Número de Ficha;
- catálogo bounded de até 500 materiais canônicos com \`materialId\`, descrição e unidade.

O catálogo serve para vínculo explícito. A IA externa só deve preencher \`materialId\` quando houver correspondência segura. Em dúvida, retorna \`null\`.

O EMPROVEX nunca aceita texto descritivo como substituto implícito de um \`materialId\` já existente.

## 4. Marco Zero

O primeiro SISCOFIS confirmado, enquanto não existir Marco Zero confirmado, é tratado como \`MARCO_ZERO\`.

Persistência de auditoria:

\`warehouse/{workspaceId}/siscofisSnapshots/marco-zero\`

Versão do snapshot:

\`warehouse_siscofis_snapshot_v1\`

O Marco Zero:
- é explícito;
- guarda workspace, UG, operador, data-base, hash da fonte e cutoff;
- registra as linhas consideradas;
- registra IDs dos movimentos produzidos;
- não escreve saldo diretamente;
- produz exclusivamente movimentos \`INITIAL_BALANCE\` no ledger oficial;
- usa a mesma materialização de saldo da FASE 2;
- usa chave idempotente derivada do hash da importação + material;
- não pode ser apagado;
- não pode ser redefinido por outra importação.

### Recuperação após interrupção

O documento passa por:

\`APPLYING → CONFIRMED\`

Se houver interrupção após parte dos movimentos:
- o mesmo JSON produz o mesmo hash;
- os mesmos movimentos produzem as mesmas chaves idempotentes;
- o processo pode ser retomado sem duplicar estoque;
- um JSON diferente não pode substituir um Marco Zero em andamento.

## 5. Material canônico

Quando uma linha traz \`materialId\`:
- o material precisa existir;
- precisa pertencer à UG;
- a unidade precisa coincidir.

No Marco Zero, uma linha com \`materialId: null\` pode originar um novo material canônico:
- ID determinístico \`mat_<32 hex>\`;
- derivado do workspace + semântica SISCOFIS Marco Zero + descrição normalizada + unidade;
- criado no mesmo contrato \`warehouse_material_v1\`;
- não cria um segundo catálogo.

Após o Marco Zero, uma linha sem \`materialId\` permanece \`UNRESOLVED\`.
Snapshot posterior não cria material automaticamente.

## 6. Cutoff e proteção contra duplicidade histórica

A FASE 5 reutiliza o documento de settings criado na FASE 4:

\`warehouse/{workspaceId}/settings/invoice-integration\`

Se o Marco Zero ocorrer antes de existir o cutoff, a confirmação cria o cutoff no mesmo contrato \`warehouse_invoice_settings_v1\`.

Se já existem saldos integrados após o cutoff:
- a data-base do Marco Zero deve ser anterior ao dia do cutoff;
- sobreposição é bloqueada antes da confirmação.

Assim:
- o Marco Zero representa o estoque preexistente;
- NFs posteriores ao cutoff continuam entrando pelo fluxo da FASE 4;
- NFs históricas anteriores ao cutoff não são retrointegradas silenciosamente.

## 7. Snapshots e conciliação

Depois do Marco Zero, toda importação confirmada é \`SNAPSHOT\`.

ID:
\`snapshot_<32 hex do hash da importação>\`

O snapshot:
- não chama o ledger;
- não cria \`INITIAL_BALANCE\`;
- não altera saldo;
- compara quantidade SISCOFIS com saldo EMPROVEX;
- persiste o resultado para auditoria;
- é idempotente pelo hash.

Estados:
- \`MATCHED\`: material resolvido e quantidades iguais;
- \`DIVERGENT\`: material resolvido e quantidades diferentes;
- \`UNRESOLVED\`: não há vínculo canônico seguro.

Diferença:
\`SISCOFIS - EMPROVEX\`

Divergência é informação para análise. Não existe autocorreção.

## 8. Segurança

Durante o piloto:
- somente a identidade fundadora autorizada acessa ADM Depósito;
- workspace permitido continua restrito ao HGeSM;
- novos snapshots possuem Firestore Rules próprias;
- criação valida schema, identidade, formato e limite de linhas;
- somente a transição controlada \`APPLYING → CONFIRMED\` do Marco Zero pode atualizar documento;
- exclusão de snapshots é proibida;
- usuários externos continuam sem acesso;
- fallback genérico do namespace não pode contornar as regras de \`siscofisSnapshots\`.

## 9. Performance

- materiais: leitura bounded em até 500;
- saldos: leitura bounded em até 500;
- histórico SISCOFIS: leitura sob demanda, UI exibe até 12;
- Firestore permite snapshot com no máximo 500 linhas;
- nenhum listener realtime novo;
- nenhum reprocessamento de histórico completo na abertura.

## 10. UX operacional

A aba SISCOFIS / Conciliação implementa:
- prompt oficial copiável;
- área para colar JSON;
- validação;
- lista de erros e avisos;
- preview com identificação Marco Zero ou snapshot;
- material, quantidade SISCOFIS, quantidade EMPROVEX, diferença e estado;
- confirmação explícita;
- histórico recente;
- aviso permanente de que divergência não corrige saldo automaticamente.

## 11. Testes e gates

Cobertura adicionada:
- \`scripts/warehouse-siscofis-contract.test.mjs\`;
- \`scripts/verify-adm-deposito-phase-5.mjs\`;
- cenários da FASE 5 em \`scripts/firestore-multitenancy-security.test.mjs\`;
- execução obrigatória no \`Application CI\`.

A bateria do PR também preserva:
- FASES 0–4;
- multi-tenant Firestore security;
- build de produção;
- TypeScript final;
- diff hygiene;
- Browser E2E com Firebase Emulator.

## 12. Fora do escopo

A FASE 5 não implementa:
- depósitos/localizações/transferências;
- lotes/validade/FEFO;
- saída expressa/scanner;
- Visão do Depósito;
- inventário físico;
- correção automática de divergência;
- expansão do módulo para usuários externos.

Essas capacidades permanecem nas fases posteriores do ROADMAP.
