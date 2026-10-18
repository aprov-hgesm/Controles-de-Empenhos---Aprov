# EMPROVEX — Cliente 360° V2 | Contrato de leitura e acompanhamento

**Data:** 2026-10-18
**Branch ativa:** \`feat/admin2-w01-sidebar-local-preview\`
**PR:** #339 DRAFT
**Ambiente:** \`http://localhost:3001/admin2-preview?area=customers\`, rota bloqueada fora de \`next dev\`.
**Estado de aceite:** implementado em código para QA; **aguardando CI final e validação do Fundador no localhost**. Não publicado.

## Atualização contratual 1:1 (18/10/2026)

**Decisão mais recente do Fundador:** um workspace corresponde a **um cliente comercial independente**. A referência abaixo ao modelo futuro 1:N é histórica/superada. O modelo comercial agora é `platformCustomers/{workspaceId}` e a Ficha 360 exibe contatos somente do cadastro cujo ID coincide com o workspace atual; não existe vínculo auxiliar, união de workspaces ou conta comercial compartilhada. As consultas read-only de billing e auditoria por workspace permanecem idênticas.

---

## 1. O que a V2 realmente entrega

Ficha 360° administrativa em quatro seções:
- **Visão geral:** OM/UG, workspace, setor, atualização, status real, e-mail operacional, situação/valor do billing existentes.
- **Financeiro:** status de assinatura, trial/VIP, pagamento exigido e histórico paginado de \`billingCycles\` por competência, com valores, status, vencimento e confirmação. É um extrato de documentos registrados; **não** uma consolidação contábil, nem receita total recebida.
- **Atividades:** consulta real **sob demanda** à \`platformAuditEvents\`, filtrada pelo workspace; máximo de 12 registros. É **amostra limitada**, SEM garantia de eventos mais recentes: IDs dos eventos são aleatórios e a consulta por workspace não ordena por data. A amostra é ordenada localmente após chegar. Só se mostram operação, tipo, ator e data; **NÃO** \`before\`, \`after\`, notas operacionais ou dados de outros setores. Uma timeline de auditoria exaustiva exigirá projeto de indexação/resumo separado.
- **Vínculos e contato:** contato operacional autorizado e vínculo com workspace atual. Campos de contato comercial e telefone ficam explicitamente \`Ainda não cadastrado\`, sem inventar informações; relação Cliente comercial 1:N definida **apenas em tipos e função pura**.

## 2. Contratos novos

- \`lib/admin2/customers/customer360Contract.ts\`: interfaces \`CommercialCustomerDraft\`, \`CustomerWorkspaceLinkDraft\`, \`CustomerCycleRecord\`, \`CustomerAuditRecord\`; mapeamento que rejeita referências entre workspaces; status/legendas de cobrança e auditoria. **Sem persistência comercial.**
- \`lib/admin2/customers/customer360Read.ts\`: leitura estritamente limitada via Web SDK, usando Rules atuais.

### 2.1 Competências — economia Firestore
O billing atual grava documentos com ID canônico \`workspaceId__YYYY-MM\`. A consulta usa:
\`orderBy(documentId(),'desc')\` + \`startAt(workspaceId + '__\\uf8ff')\` + \`endAt(workspaceId + '__')\` + \`limit(7)\`. A ficha exibe no máximo **6 competências por página**, avançando pelo cursor da última linha visível. Isso usa o índice interno por ID, sem consulta de toda a coleção nem índice composto adicional.

**Limitação declarada:** documentos legados com ID fora do padrão canônico não aparecem. O extrato serve para acompanhamento administrativo, não é prova de inexistência de uma cobrança passada.

### 2.2 Auditoria — amostra não cronológica
\`where('workspaceId','==',workspaceId)\` + \`limit(12)\`. Usa índice de campo simples existente no Firestore, não exige um novo índice composto. Como os IDs de auditoria são aleatórios, mesmo ordenando os 12 registros em memória a consulta **não** equivale a \`orderBy('createdAt','desc')\`. Não declarar que são as últimas 12 ações. A seção informa a limitação para o Fundador e mantém o restante dos detalhes não acessados.

### 2.3 Carregamento inteligente e segurança
- \`billingAccounts/{workspaceId}\` somente quando a ficha abre (já existe da V1).
- \`billingCycles\` somente quando o usuário aciona a seção **Financeiro**.
- \`platformAuditEvents\` somente quando o usuário aciona **Atividades**.
- **Nenhuma leitura extra ao navegar no diretório** fora das buscas paginadas existentes. Não adicionar \`onSnapshot\`.
- Usuário precisa de autenticação fundadora Google e as Rules \`isPlatformAdmin\` existentes continuam mandando; não abrir workspaces operacionais nem arquivos Drive.
- V2 não grava em nenhuma coleção, não muda Rules, índices, políticas de billing, processos de suspensão, IAM, deploy ou produção.
- Não reusar sessões de terceiros, não fingir evento, não criar contato comercial placeholder com dado pessoal verdadeiro.

## 3. Testes e aceite de localhost

Testes versionados:
\`\`\`powershell
node --test scripts/admin2-sidebar-preview.test.mjs scripts/admin2-customer-contract.test.mjs scripts/admin2-customer-360-v2.test.mjs
\`\`\`

Checklist de validação humana:
1. Acessar **Clientes**, escolher workspace real e clicar em **Ver ficha**.
2. **Visão geral:** validar OM/UG, assinatura, ausência de dados falsos e mensagem read-only.
3. **Financeiro:** verificar competências/paginação e que cobrança VIP/trial permanece inalterada. Abrir sem ciclos deve mostrar estado vazio, não erro fatal.
4. **Atividades:** validar eventos existentes e aviso de amostra não exaustiva; se vazio, mensagem verdadeira.
5. **Vínculos e contato:** confirmar e-mail operacional correto e pendência de Cliente comercial independente.
6. Voltar ao diretório, trocar de workspace e verificar que dados financeiros/auditoria não vazam entre fichas.
7. Confirmar que a sidebar fixa/tema claro V3 permanecem intactos, sem alteração ou escrita Firestore.
8. Registros indexados ou data ausente devem cair em estados de erro/vazio, nunca dados fabricados.

## 4. Próxima etapa, não executada

Após aceite da V2: desenhar contrato de persistência de \`Customer\` comercial e relacionamento com contatos/tickets e possíveis vários workspaces, com Rules/testes Emulator e migração/backfill dry-run. Qualquer gravação real requer autorização específica do Fundador e release separada.

**Fonte:** \`docs/admin2/ADMIN_CORE_CONTINUIDADE_SEQUENCIAL.md\` é atualizado após cada marco.
