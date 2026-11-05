# EMPROVEX EMPRESAS — AUDITORIA R1-M E PLANO EXECUTIVO DE WORKERS

**Data-base:** 05/11/2026 • **Natureza:** auditoria de código/CI, planejamento; nenhuma operação em produção.  
**Repositório:** \`aprov-hgesm/Controles-de-Empenhos---Aprov\`.  
**Base comparada:** \`main@80a2f3a3e30cfc31521be6ce05324da3cc952477\` (04/11/2026).  
**Head auditado:** PR [#510](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/510) \`2185952c4d2ea3d04456d1a5f343697cbad59886\`; branch \`integration/emprovex-empresas-r1-main-sync-20261105\`.  
**Fontes históricas:** [#419](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/419), [#447](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/447); [memorial oficial](../EMPROVEX_EMPRESAS_MEMORIAL_OFICIAL.md).  
**Decisão:** **GO para desenvolvimento técnico isolado e paralelo após W0; NO-GO para liberação comercial, escrita de dados empresariais reais e promoção Cloud Run** sem E2E e autorização separada.

## 1. Método e evidências observadas

- Inspeção dos 39 arquivos modificados/criados na PR #510 (5 commits, 2.853 adições e 506 exclusões, segundo metadados GitHub).
- Comparação da PR #510 com a \`main\` atual: **ahead 5, behind 0**; a PR é **Draft**, aberta, mesclável e não integrada.
- Leitura de código de identity, Auth, gateway, Admin, provisionamento, sessão, Firestore Rules, navegação empresarial, API, fornecedores/NE existentes e memorial do produto.
- CI no SHA auditado: [Empresas R1](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/42118155621), [Fast CI](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/42118155710), [Core Protection](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/42118155613), [Support R1](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/42118155629), [Visual R2](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/42118155642), [login público](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/42118155716) e [W4 integração](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/42118155822): **SUCCESS**. Dois workflows declararam \`SKIPPED\`, não \`PASS\`.
- O teste empresarial \`scripts/emprovex-empresas-sync-r1.test.mjs\` contém **10 verificações determinísticas/estáticas**; o \`scripts/e2e-browser-emulator.mjs\` existente executa jornada operacional setorial, **não demonstra** provisionamento/login/negação cross-company de conta empresarial QA.
- A extensão **Almoxarifado W9**, [#463](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/463), permanece Draft fora da main inspecionada. Não copiar a branch W9 para Empresas, nem depender dela como pré-requisito.

**Limite:** sem execução direta de GCP/Firebase de produção, nem criação de usuários reais; os resultados PASS são os da CI do repositório, não homologação empresarial de dados reais.

## 2. O que existe e o que não existe

| Área | Estado no código auditado | Evidência/limite |
|---|---|---|
| Conta empresarial, CNPJ, workspace e índice fiscal | Implementado na branch; integração sem E2E empresarial | \`lib/platformIdentity.ts\`, \`lib/companyProvisioning.ts\` |
| Provisionamento, consulta no Admin | Implementado, fundador-only | \`app/api/admin/provision-company/route.ts\`, \`companies/route.ts\`, \`components/admin/AdminCreateCompanyPanel.tsx\` |
| Login único, autorização server-side, portal | Implementado | \`app/login/page.tsx\`, \`lib/server/companySession.ts\`, \`app/empresa/**\` |
| Portal real | **Shell e placeholders**, nove destinos | \`features/company/modules.ts\`, \`CompanyModulePlaceholder.tsx\` |
| Empresas: equipe, papéis e convites | **Ausente** | Só e-mail/UID primário, sem members/RBAC |
| Clientes públicos / OMs e pedidos | **Ausente** | Não reutilizar o registro militar como tenant empresarial |
| Fornecedor de origem / catálogo / preços | **Ausente** | Não confundir o fornecedor da OM com a empresa cliente |
| NE recebida pela empresa / pedido da OM | **Ausente** | Parser de NE é reaproveitável, mas a API atual é protegida por billing setorial |
| Compra, confirmação, pedido a fornecedor | **Ausente** | Não existe pedido empresarial transacional |
| Estoque leve, reserva, ledger, alocações | **Ausente** | Warehouse militar é outro domínio e outro ledger |
| Dois cronogramas, risco de atraso, entrega | **Ausente** | Tela de Cronograma atual é do Aprovisionamento |
| NF, contas a pagar/receber, margem | **Ausente** | Nem despesas nem recebimentos de empresas devem herdar faturamento de OM |
| Billing empresarial e planos | **Não aprovado/implementado** | Preços antigos do memorial são hipóteses, não vigentes |

## 3. Achados ordenados por risco e ações proporcionais

| ID | Severidade | Constatação (arquivo e comportamento) | Ação e prova mínima |
|---|---|---|---|
| P0-01 | Alta / disponibilidade | \`app/login/page.tsx\` consulta \`/api/company/session\` para **todo usuário**. Em erro 5xx/timeout, o estado vira \`unavailable\`, inclusive para setor/fundador; a dependência empresarial pode afetar acesso institucional. | W0 deve preservar o acesso setorial sem permitir fallback empresarial inseguro. Criar testes de Auth: empresa, setor, fundador, 403, 401, 503, timeout e troca de usuário. |
| P0-02 | Alta / ativação | \`assertAdminMutationEnabled('company-provision')\` opera com **negação explícita** via \`EMPROVEX_DISABLE_COMPANY_PROVISIONING=1\`; sem essa variável, a API pode provisionar assim que o código for publicado. | Introduzir **habilitação positiva** para piloto (\`EMPROVEX_COMPANY_PILOT_ENABLED=1\`, OFF por padrão), respeitando o kill switch existente; testar 503 sem flag. |
| P0-03 | Alta / isolamento | Não há API de domínio empresarial nem autorização unificada para ela. \`verifyCompanySession\` só é exercido no endpoint de sessão. | W0 entrega \`requireCompanyContext\` no servidor, com UID, companyId, status, papel, limites de scope e testes IDOR; nenhuma escrita operacional sem esse guard. |
| P0-04 | Alta / prova | A bateria de 10 testes empresariais não exercita Firebase/Firestore Emulator com conta criada e usuários de duas empresas. | Testar ponta a ponta cadastro/rollback, autenticação, bloqueios e empresa A≠B; founder/setor não viram empresa. |
| P1-05 | Média / identidade | \`companyProvisioningAdmin.ts\` cria Auth com \`emailVerified: true\` antes de comprovar controle da caixa postal; o fundador fornece o e-mail. | Antes de piloto, preferir convite/validação de titularidade e primeiro acesso; não depender apenas de senha entregue manualmente. |
| P1-06 | Média / RBAC | \`CompanyAccount\` suporta um único \`authorizedEmail\`, sem membros, funções ou revogação de acessos de equipe. | W3 cria memberships e matriz de ações; princípio de menor privilégio; manter conta titular como bootstrap. |
| P1-07 | Média / escala | \`listCompanyDirectory()\` busca **todas** as páginas de \`workspaces\` e \`platformAccounts\` no servidor e filtra depois; não há consulta indexada exclusivamente empresarial. | Após P0, paginação/índice de empresas e limites; medir leituras, latência e retorno parcial; evitar reprocessar diretório setorial inteiro. |
| P1-08 | Média / unicidade | O provisionamento usa \`platformCnpjIndex\`, \`platformAuthUidIndex\` e locks transacionais, mas faltam testes de corrida real, falhas parciais e recuperação do serviço. | Testar simultaneidade de mesmo CNPJ/e-mail/workspace, falha no commit, falha após Auth, rollback e manutenção de lock de recuperação. |
| P1-09 | Média / fronteiras | \`lib/platformIdentity.ts\` incorpora \`company\` no tipo comum; \`platformAdminStore.ts\` filtra company após receber snapshots amplos. | Testes de discriminação estrita e de não exibição de empresas em bairro 3D, faturamento, depósitos e UG militar. |
| P1-10 | Média / UX | A navegação empresarial tem nove entradas, mas o plano mestre diferencia pedidos OM, compras, estoque, NF, cronogramas duplos, transporte e financeiro. Tudo ainda é placeholder. | W4 redesenha a arquitetura de informação **sem prometer módulos prontos**, mobile/Essencial/acessibilidade. |
| P1-11 | Média / escopo | \`app/api/empenhos/parse-ne\` tem autorizador/billing de setor; chamar essa API da empresa herdaria regras indevidas. | W5 reutiliza **somente** \`parseEmpenhoPdfBytes\` e funções puras mediante endpoint empresarial próprio e revisão humana. |
| P1-12 | Média / rastreabilidade | O plano exige N:M entre pedido OM, compra, estoque, entrega e pagamento; nenhum ledger/contrato implementado. | Contratos imutáveis e testes de quantidade, unidade, custo, reserva, idempotência, estorno e parcialidade antes de UI transacional. |
| P2-13 | Baixa / documentação | O memorial histórico cita rota \`/fornecedores\` como shell futuro, enquanto a rota implementada é \`/empresa\`. | Padronizar rota \`/empresa\` no novo trabalho sem apagar histórico. |
| P2-14 | Baixa / otimização | Cada resolução empresarial consulta Auth e Firestore via servidor, sem cache de autorização apropriado à revogação. | Medir p50/p95 e leituras; cache apenas para metadados não autorizativos e nunca usar cache antigo para conceder acesso. |

**Riscos excluídos de mudanças automáticas:** IAM/Cloud Run, Firestore Rules da main, cobrança do Aprovisionamento, qualquer ledger Warehouse, dados de produção, reversões de NFs, integração automática com OM, emissão de NF-e, bancário, OCR/modelos IA e entrega sem autorização.

## 4. Desenho mínimo que todos os Workers devem respeitar

### 4.1 Nomenclatura canônica

\`company\` = **empresa contratada/licitante, cliente do EMPROVEX**.  
\`publicCustomer\` = **OM/órgão comprador**.  
\`sourceSupplier\` = **fornecedor de origem da empresa licitante**.  
\`commitment\` = **NE recebida da OM**, não pedido de compra da empresa.  
\`customerOrder\` = **solicitação concreta da OM**, potencialmente parcial e repetida em uma mesma NE.  
\`purchaseOrder\` = **pedido da empresa ao fornecedor de origem**.

### 4.2 Segurança e persistência

- \`workspaces/{workspaceId}\` e \`platformAccounts/{email}\` continuam reservados ao **diretório de identidade**. Nenhum ledger operacional empresarial será colocado no workspace militar.
- O Plano V2 propõe \`supplierCompanyWorkspaces/{companyId}/...\`. W0 deve **fixar esse namespace ou justificar outro** antes de qualquer Worker escrever dados: um banco lógico, um tenant, um ledger por fato; sem dois repositórios concorrentes.
- Toda API de dados usa \`requireCompanyContext(request)\` ou equivalente **server-side**, valida \`companyId\` do token+membership, estado ativo, função, ação e ID de documento. Nem CNPJ nem slug enviado no corpo autorizam operações.
- Preferência: APIs server-side com identidade Cloud Run e controle de serviço, sem expor SDK de gravação empresarial a usuários, salvo desenho explícito de Rules+Emulator aprovado. **Deny-by-default** é obrigatório.
- Entidades versionadas, idempotencyKey para eventos financeiros/logísticos, datas com origem (informada, confirmada, estimada, real), valores \`centavos\` ou decimal auditável, unidades e conversões explícitas, soft cancel/estorno com auditoria.
- Um pedido OM pode ser atendido por várias compras; uma compra pode servir a vários pedidos. Reservas nunca podem ultrapassar saldo livre e fatos de entrega não equivalem a atesto/recebimento governamental.
- Reusar exclusivamente utilitários **puros** de PDF, parser, tabelas ou UI; não importar autorização, Rules, billing, contextos nem hooks do Aprovisionamento/Almoxarifado.
- W0 define \`contracts.ts\`, estados, result/error, namespaces, esquema de índice e fronteiras de API; Workers não criam coleções com nomes diferentes por conta própria.

## 5. Plano híbrido por ondas: paralelo sempre que houver contrato estável

### Onda S0 — W0 Integrador/Fundação (sequencial, curto, obrigatório)

**Dono:** integrador central. **Base:** head da PR #510; PR de hardening isolada, sem publicar.  
**Entrega:** corrigir P0-01, P0-02, P0-03, criar E2E para P0-04 e uma fixture de empresa A/B, consolidar contratos de negócio e namespaces, gerar API guard. Preservar login do fundador por senha/Google e acesso setorial.  
**Teste de saída:** typecheck, build, E2E Auth/Firestore/Playwright, dados de empresa A inacessíveis a B, testes de 401/403/503/timeouts, ausência de mudança na main. **Sem GO para cinco frentes até o contrato do W0 estar congelado.**

### Onda P1 — Cinco Workers verdadeiramente paralelos (todos partem do SHA W0)

| Worker / fronteira de arquivos | Entrega executável | Depende de |
|---|---|---|
| **W1 — OMs, NEs e pedidos**: \`features/company/customers/**\`, \`commitments/**\`, \`lib/company/customer*\` | Cadastro de OM, referência UG/UASG, NE e itens, pedido da OM distinto da NE, quantidades e revisão humana | Contrato W0 |
| **W2 — Fornecedores de origem e catálogo**: \`features/company/suppliers/**\`, \`catalog/**\`, \`lib/company/supplier*\` | Empresa de origem, contatos, produtos, unidade de compra, lead time, preço com data, status de fornecedor | Contrato W0 |
| **W3 — Equipe e autorização fina**: \`features/company/members/**\`, \`lib/company/roles*\`, \`lib/server/companyMembership*\` | Conta titular, membros, papéis, convite/revogação, autorização por ação; não alterar sessão institucional | Guard W0 |
| **W4 — Shell, UX e navegação**: \`components/company/**\`, \`features/company/shell/**\`, \`app/empresa/**\` | Menu operacional final, mobile e teclado, estados vazio/erro/carregando, modo Essencial sem 3D; componentes apenas de apresentação | Contrato de rotas W0 |
| **W5 — PDF, importação e exportação**: \`features/company/documents/**\`, \`lib/company/documents/**\` | Reusar parser NE puro, revisão do resultado, PDF de pedido, anexos com checagem de autorização; sem enviar e-mail/WhatsApp fictício | Contrato de documento W0 |

**Proibição de conflito:** W1–W5 não editam \`app/login/page.tsx\`, \`lib/platformIdentity.ts\`, \`firestore.rules\`, \`lib/server/companySession.ts\`, \`components/admin/PlatformAdminView.tsx\`, CI geral ou \`package-lock.json\` sem handoff ao integrador. APIs novas em caminhos de domínio distintos e sempre chamando o guard W0. Se precisarem de mudança transversal, registrar um patch pequeno para W0/W10, **não aplicar diretamente**.

### Onda P2 — Três Workers paralelos após contratos W1/W2/W3

| Worker | Entrega executável | Dependências |
|---|---|---|
| **W6 — Compras / abastecimento** | Necessidade de compra por falta, ordem de compra, revisão, estados de proposta/confirmado, recebimento parcial, cronograma inbound | W1 + W2 + RBAC W3 |
| **W7 — Estoque leve / alocação** | SKU canônico, ledger de estoque independente, reserva por linha, conversão de unidade, alocação N:M, estorno e concorrência | W1 + W2 + RBAC W3 |
| **W8 — Financeiro básico** | Modelos separados de NF de entrada/NF de saída, contas a pagar/receber e cálculos manuais determinísticos; sem marcar pagamento automaticamente | Contratos W1/W2/W3; integração após eventos de W6/W7 |

**W6 e W7 podem começar motores puros em paralelo no início da P1, mas não integrar gravações antes dos contratos congelados.** W8 pode começar fórmulas e telas sem assumir dados transacionais já existentes.

### Onda S1 — W9 Cronogramas integrados, expedição e prova (sequencial sobre W6/W7)

Montar os **dois cronogramas vinculados**: origem → recebimento e OM → separação/entrega. Calcular risco por último item indisponível, permitir parcialidades sem duplicação e mostrar data pedida, prometida, estimada e confirmada. Romaneio, comprovante e entrega direta origem→OM somente quando marcada; não simular atesto/baixa governamental. Integrar projeções financeiras do W8.

### Onda S2 — W10 Integração/piloto (sequencial)

Responsável por resolver conflitos em uma branch integradora, testar a jornada E2E, revisar IAM/Rules somente leitura, validar custo e publicar **apenas após GO explícito**. Não trazer código de Almox W9 para fechar Empresas.

## 6. Matriz E2E mínima e casos de aceite

**Identidade/isolamento (P0):**
1. Fundador por senha e Google continua chegando ao ambiente correto; setor externo por senha continua acessando Aprovisionamento.
2. Empresa válida acessa só \`/empresa\`; empresa suspensa/disabled não acessa; login inválido e provedor incorreto são rejeitados.
3. Empresa A não lê, escreve ou enumera pedidos, documentos, fornecedores, margens ou IDs da B; setor e fundador não se tornam empresa por fallback.
4. UID divergente, email divergente, workspace inexistente, membership revogado e token expirado dão 401/403, não dados parciais.
5. A falha no serviço empresarial (5xx, timeout, indisponibilidade IAM) não permite escalonamento e não deve derrubar sessão setorial válida.
6. Dois cadastros concorrentes com o mesmo CNPJ, e-mail ou workspace: **no máximo um concluído**, sem Auth órfão. Falha após criação Auth preserva bloqueio/recovery.
7. Flag piloto OFF impede provisionamento e operações novas por padrão; nenhum dado de produção é modificado pelo E2E.

**Domínio operacional (P1/P2):**
8. Uma NE vincula vários pedidos da OM, sem confundir quantidade empenhada com solicitada.
9. Pedido de 500 kg: 100 livres + compra de 300 a fornecedor A + compra de 100 a fornecedor B; sem reserva dupla.
10. Uma compra de 500 atende dois pedidos de 200/300; custo, estoque e alocação somam corretamente.
11. Unidade caixa/fardo/quilo com fator de conversão explícito preserva saldos, preço unitário e precisão.
12. Fornecedor confirma apenas 250/400 e propõe outra data; campo de prazo **não** altera promessa aceita com OM sem decisão humana.
13. Recebimento parcial, rejeição, cancelamento, devolução e repetição da mesma requisição mantêm ledger consistente.
14. Uma entrega parcial não cria atesto nem liquidação fictícios; assinatura/recusa são fatos distintos.
15. NF de compra gera **conta a pagar**; NF da OM/empresa gera **conta a receber**; margens indicam custos tributários/frete desconhecidos.
16. Empresa sem estoque faz entrega direta origem→OM sem transação física fictícia de entrada e saída.
17. Pedido PDF gerado; WhatsApp/e-mail são **rascunhos de envio** até confirmação efetiva, não mensagens já enviadas.
18. Proteção contra alteração simultânea: duas reservas no último saldo não podem ambas confirmar.
19. Usuário operacional não acessa funções financeiras/administrativas sem papel; revogação invalida novos requests.
20. Navegação por mobile/Essencial/teclado, erros úteis e sem cargas de dados militares/3D/Eleonor por acidente.

**Teste de regressão transversal:** Cloud Run/Hosting atual, login, HGeSM, setores externos, Warehouse, Admin, Core Protection, E2E Firebase existentes e Visual-R2 sem diferenças funcionais.

## 7. Regras práticas de branch, integração e QA

1. **Não atualizar #419/#447 por merge/rebase indiscriminado**. A fonte viva é #510; o histórico antigo é consulta.
2. W0 prepara \`integration/emprovex-empresas-r2-foundation\` a partir do SHA vigente de #510. Seu contrato aprovado é o **único ponto de partida** para W1–W5, cada um em \`feat/empresa-r2-wN-<escopo>\`.
3. Um Worker = PR Draft, arquivos próprios, handoff com: SHA base, 3–8 contratos, testes executados, itens não feitos e risco. Nada de copiar a árvore inteira do projeto, criar segunda fonte de verdade ou fazer deploy.
4. Cada Worker executa no mínimo \`npm run typecheck\`, testes do domínio, Core Protection relevante e build (com reutilização da CI). W0/W10 executam E2E Auth/Firestore e rotas críticas. **CI verde é necessário, não substitui QA empresarial.**
5. W10 integra primeiro as PRs sem conflito W1/W2/W3/W4/W5, depois W6/W7/W8 e por fim W9. Se a main avançar, sincronizar o integrador e preservar as correções recentes; nunca sobrescrever login/NF/Cloud Run.
6. Sem feature flag positiva, empresa fica desativada em ambientes publicados. Sem merge automático, alteração de IAM/Rules, cobrança, endpoint de produção ou promoção de tráfego por Worker.
7. Se algum Worker exige alterar contrato comum, abrir um handoff de interface/contrato ao integrador em vez de refatorar os demais branches sozinho.

## 8. Marcos e decisões GO/NO-GO

| Marco | Produto verificável | GO exigido |
|---|---|---|
| **R1-G Fundação** | Identidade segura, cadastro Admin, portal e E2E company QA | P0-01..04 resolvidos, controles founder/setor preservados; sem piloto comercial |
| **R2-MVP Compras** | Cadastrar OM e fornecedor, receber NE/pedido OM, gerar pedido de compra, acompanhar confirmação e risco inbound | W1/W2/W3/W5/W6 + testes N:M e dados reais de QA |
| **R2.1 Operação** | Estoque/reserva, recepção parcial, duplo cronograma e entrega comprovada | W7/W9, concorrência e parcialidades provadas |
| **R2.2 Financeiro manual** | NF de origem/venda, a pagar, a receber, margem e relatório de lacunas | W8 integrado, cálculos e autorização por papel |
| **R3 Piloto controlado** | Uma empresa piloto aprovada usa a jornada completa com assistente humano de suporte | W10: QA navegador, validação de dados, custo, backups e autorização explícita de deploy |

### Itens conscientemente fora do primeiro piloto

Marketplace/robô de pregão, lances, emissão de NF-e, banco/PIX, baixa financeira automática, integração com SISCOFIS das OMs, 3D Warehouse, roteirização ótima, GPS contínuo, parceiro externo sem convite e qualquer automação com alteração de compromisso formal de OM.

## 9. Parecer final e primeira missão executável

**Parecer da auditoria:** base de software R1-M viável, CI atual bem-sucedido, **maturidade operacional empresarial ainda R0/shell**. **GO de desenvolvimento paralelo condicionado ao W0**; **NO-GO de produção empresarial**, onboarding real, cobrança, regras publicadas ou uso como evidência de sistema completo.

**Próxima ação recomendada, sem burocracia:** iniciar **W0** diretamente na branch de fundação; corrigir segurança de ativação e acoplamento do login, criar autorização server-side para dados empresariais, schema e E2E com emuladores. Assim que W0 for comprovado, disparar **W1, W2, W3, W4 e W5 simultaneamente**, cada um com seus arquivos e critérios acima. Nenhuma entrevista, precificação ou expansão de Almox deve bloquear a fundação técnica já definida.

**Memorial:** manter este documento como auditoria executiva vigente; atualizar somente o checkpoint oficial quando as evidências passarem. O plano mestre de negócios continua sendo a referência de escopo, sem reescrita retroativa.
