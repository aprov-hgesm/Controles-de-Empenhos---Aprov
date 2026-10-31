# EMPROVEX AI W5 R1 — Memorial de implementação e certificação

**Branch:** `feat/emprovex-ai-r1-w5-context-hardening` · **PR:** #429 (DRAFT, base PR #428) · **SHA-base:** `f405fb21d1d50f4c6ad74157d52fc148a463d5d9`.

## Escopo e arquitetura mantida
Interpretador W4/W5 → auditoria de filtros essenciais → parser fechado W3 → identidade Firebase/UID, workspace, UG, billing e módulo no servidor → W3 executor read-only → resposta baseada em dados e evidências. Nenhum segundo executor, alteração de Rules, escrita em dados reais, Oracle, Qwen ou Ollama.

## Auditoria direcionada da base W4.5
| Gravidade | Evidência / causa | Correção / estado |
| --- | --- | --- |
| P0 | `VERCEL_ENV !== 'production'` com flag = 1 habilitava endpoint num Cloud Run de produção sem `VERCEL_ENV` | `integration/environment.ts` compartilhado, flag desativada por padrão, Vercel **preview** com identidade explícita, Cloud Run sempre negado enquanto não houver certificação de deployment staging |
| P1 | Conteúdo do contexto W4.5 só tinha integridade HMAC e era decodificável pelo cliente | Token de contexto agora usa AES-256-GCM e HMAC distintos, mantendo cookie de sessão HttpOnly, vínculo UID/workspace/sid e TTL |
| P1 | Correção "na verdade feijão" não atualizava contexto em rota CLARIFY | Atualização tipada de `materialQuery` sem executar consultas, emissão de contexto novo criptografado |
| P1 | Perguntas compostas podiam executar apenas uma metade | Classificação antecipada e bloqueio conservador de multintenções; não habilita consultas múltiplas sem orçamento agregado certificado |
| P1 | Filtros por item/local/data/negação poderiam produzir interpretações globais | Guardas para itemId, restrições de estoque, exclusões, contabilidade SIAFI, datas; esclarecimento/indisponibilidade no lugar de resposta degradada |
| P2 | Respostas de saldo sem explicitação de origem contábil; páginas potencialmente truncadas | Ressalva SIAFI, cobertura parcial, aviso de mais páginas |

## Funcionalidades do motor W5
- Sinônimos, abreviações, erro controlado, nomenclatura de aprovisionamento e identificação de NE com exercício posposto ("empenho 66 de 2026").
- Referências curtas a material e NE; troca de material, correção explícita e não persistência intersessão/intertenant; assinatura HMAC e criptografia de contexto.
- Compósitos são reconhecidos e encaminhados para esclarecimento. **Não** se executa plano com duas intenções nesta fase.
- W3 valida identidades documentais, parâmetros, filtro por CNPJ, saldo operacional e cobertura; o interpretador não cria identidades canônicas nem deriva valores financeiros.

## Contratos W3 P0 intactos
`supplier_contact_find`, `commitment_get`, `commitment_total_balance`, `commitment_previous_open_list`, `schedule_sent_history_list`, `invoice_registration_period_list`, `warehouse_stock_get`, `warehouse_material_locations_list`.

## Cobertura e testes sintéticos
- `scripts/emprovex-ai-w5-corpus.json`: 120 casos anotados, 30 para contexto, 30 informal, 30 composições/filtros, 30 adversariais; 80 development + 40 heldout estratificados, sem afirmar acurácia universal.
- `scripts/emprovex-ai-w5.test.mjs`: classificação de rota, não execução indevida, intenção W3 e 20 sequências de vários turnos.
- `scripts/emprovex-ai-w5-security.test.mjs`: gate Vercel/Cloud Run, contexto cifrado/assinado, TTL, HTTP ask/query com infraestrutura simulada, adulteração, sessão, autenticação e tamanho de payload.
- `scripts/emprovex-ai-w5-benchmark.mjs`: latência de motor lexical sem I/O, p50/p95/p99 com 1000 amostras após aquecimento, consumo aproximado de heap; **não é** latência do Firestore.
- Workflow `EMPROVEX AI W5 Context Hardening Certification`: TypeScript, W5, W3/W4/W4.5 regressivos, W4 520 e 50 casos adicionais, benchmark e segurança de segredo.

### Certificação observada (SHA `3e8ab1fb638ee7140075f390b1363bac9c428a55`, antes da atualização documental/de benchmark)
- W5 corpus 120/120 sem falsas aceitações críticas nos casos definidos; 20/20 sequências PASS.
- TypeScript PASS, W5 HTTP/security PASS, W3/W4/W4.5 regressões PASS, 520/520 histórico PASS, 50/50 R1.1 PASS.
- W4.5 referência nesta execução: 32 requisições sintéticas, média 1,16 ms, p95 2 ms e p99 4 ms; 48 documentos examinados nos cenários, 0 escritas e 0 chamadas Qwen. **Não generalizar para produção.**
- Após o presente commit, o novo check CI é a fonte de verdade e substitui o status acima.

## Limites e próximos gates obrigatórios
1. Firebase Authentication e Firestore reais **não testados** para W5; usar homologação isolada e autorização expressa antes de qualquer teste com serviços reais.
2. Cloud Run deliberadamente fechado, inclusive em staging, até aprovação de identidade de ambiente não-prod, sem criar exceção por ausência de `VERCEL_ENV`.
3. Tokens são stateless, revogação individual exigiria estado dedicado; toda consulta reautoriza os direitos atuais; troca de segredo invalida tokens existentes.
4. Identificadores ambíguos e cobertura parcial não são promovidos a respostas completas.
5. Prontidão para **revisão independente**, não para merge, publicação ou habilitação produtiva. Application CI skipped não é PASS.

**Parecer de engenharia sujeito ao último CI:** `W5_CONTEXT_ENGINE_READY_FOR_REVIEW` se todos os gates finais estiverem verdes; caso contrário, `W5_PARTIAL_BLOCKED`.

---

## W5 R1.1 — Correção pontual após revisão independente #5723387118 (31/10/2026)

**Referência de auditoria:** PR #429, commit `7855f9c6f011d72d8eca8c789422a4f97ba6ed5f`. **Branch preservada:** `feat/emprovex-ai-r1-w5-context-hardening`. Este registro complementa, sem substituir, a certificação W5 R1.

### P1-A — Filtros de situação
- **Antes:** `detectConstraints()` reconhecia basicamente vencido/pendente/atrasado precedidos por `somente/apenas`; perguntas como `Quais NFs cadastradas ontem que já foram pagas?` podiam gerar C06 sem a condição de pagamento.
- **Depois:** detecção de pago/não pago, liquidado/não liquidado, pendente, atrasado, entregue, recebido, concluído, cancelado, parcialmente atendido, em aberto e vencido. O catálogo W3 não representa estado de pagamento em C06; portanto, rota não determinística, sem execução nem perda de filtros. `Quais NFs foram cadastradas ontem?` segue elegível.
- **Limite:** status em empenhos históricos com saldo é mantido no contrato existente; nenhum contrato P1/P2 foi criado.

### P1-B — Localização física
- **Antes:** `Quanto arroz temos no almoxarifado?` não era reconhecido como filtro físico e podia retornar C07 agregado.
- **Depois:** detector inclui almoxarifado, depósito de secos/gêneros, estoque central, área de recebimento/armazenamento, sala, setor físico, posição, local de armazenagem e termos anteriores. Restrições não mapeáveis em `warehouse_stock_get` não executam saldo agregado; em `warehouse_material_locations_list`, identificação física por nome exige esclarecimento/ID canônico quando aplicável.

### P1-C — Respostas sem truncamento silencioso
- **Antes:** o formatador aplicava `v.slice(0,5)` mesmo quando W3 retornava 6–20 registros com cobertura completa.
- **Depois:** o apresentador utiliza todos os elementos da página já limitada pelo W3, sem criar nova paginação. Continuam sinalizados `coverage`, `status=partial`, `pagination.truncated`, limitações e resultado vazio. Regressões: 1, 5, 6, 10 e 20 NFs, cronogramas, empenhos, fornecedores e localizações com mais de cinco registros.

### P1-D — Isolamento do Firebase Auth Emulator
- **Antes:** três flags E2E e projeto `demo-` habilitavam decodificação sem verificação de assinatura, mesmo se replicadas num ambiente hospedado.
- **Depois:** fluxo de emulação precisa de flag E2E, projeto demo e endpoint de emulador local **mais** ambiente não hospedado. Única permissão HTTP: processo `Next dev`, `NODE_ENV=development`, `--hostname 127.0.0.1`, marcadores E2E locais; produção/preview Vercel, Cloud Run e ambientes remotos identificados rejeitam JWT não assinado, seguindo para validação JWKS RS256. Para preservar testes offline preexistentes do Warehouse, os scripts CLI `core-lean-r2-w5-transactions.mjs` e `core-lean-r2-w4-authz-mobile.integration.mjs` são autorizados **somente** em execução direta, com Auth e Firestore emuladores loopback, fora da produção e sem marcadores de hospedagem. Outros executáveis CLI, Next start e servidor com bind público são proibidos.
- **Evidência adicional:** uma versão intermediária bloqueou `true-transaction-probes`; correção restrita recuperou sua execução real com emuladores, sem permitir JWT emulado em endpoints de produção. Não afirmar garantia contra ambientes remotos arbitrários que ocultem deliberadamente sua identidade e executem um binário permitido em condições de laboratório; manter requisito de deploy seguro e revisão independente.

### P2 — Integridade de sobre-recebimento
- **Antes:** `Math.max(0, quantity-received)` apresentava zero para 100 empenhados e 120 recebidos.
- **Depois:** W3 rejeita a leitura com `AI_COMMITMENT_ITEM_INTEGRITY` quando `received>quantity`, assim como números negativos ou unidade/identificador inválidos. Não altera os dados originais nem a política de cobrança. **Decisão operacional pendente:** classificar sobre-recebimento legítimo/exceção/erro de dados históricos; a implementação falha de maneira segura, sem tratar automaticamente a condição como saldo zero.

### Certificação W5 R1.1
- Novo arquivo `scripts/emprovex-ai-w5-r11.test.mjs`: sete grupos de regressão, incluindo 18 frases de situação, 16 restrições locacionais, paginação/formatação, JWT normal sintético vs JWT emulado, identidade de ambiente, sobre-recebimento e valores negativos/não numéricos.
- Workflow `EMPROVEX AI W5 Context Hardening Certification` executa R1.1 além de TypeScript, corpus 120, 20 conversas, testes HTTP e regressões W3/W4/W4.5, corpus 520 + 50; Core Protection e Fast CI separados.
- Confirmações com serviços reais Firebase Auth e Firestore produtivos **não executadas**; ensaios são fixtures/emuladores isolados. Application CI em PR DRAFT pode permanecer `skipped`, que **não significa PASS**.
- Sem mudança de Firestore Rules, cobrança, exposição de endpoint, integração Qwen/Oracle, W6, deploy ou merge.

**Parecer após CI final:** `W5_R1_1_READY_FOR_INDEPENDENT_RECHECK` somente com todas as verificações críticas executadas e aprovadas. A classificação exige ainda rechecagem independente e não autoriza produção.
