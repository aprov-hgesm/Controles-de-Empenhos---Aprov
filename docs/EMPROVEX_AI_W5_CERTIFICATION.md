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
