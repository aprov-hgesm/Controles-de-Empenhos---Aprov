# EMPROVEX — MEMORIAL OFICIAL DE SUPORTE, ONBOARDING E RETENÇÃO

**Versão:** R0.1 — 31/10/2026 (Brasília)  
**Status:** AUDITORIA ESTÁTICA CONCLUÍDA / PLANO APROVÁVEL / DESENVOLVIMENTO NÃO INICIADO  
**Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`  
**Baseline auditada:** `main@35825d5ad563361fecd1b3d2a00ca81a4734e532`  
**Branch deste memorial:** `docs/emprovex-suporte-onboarding-r0-20261031`  
**Diretriz obrigatória:** GOV-SIMP-01 — reaproveitamento máximo, segurança essencial, menor intervenção necessária, economia computacional e testes proporcionais ao risco.

> **Fonte canônica deste tema.** Este memorial governa exclusivamente a evolução de experiência do cliente, Academia/Ajuda, onboarding assistido, relacionamento, suporte e retenção. O memorial geral do EMPROVEX continua superior para release, autorização, identidade, billing e infraestrutura; os memoriais oficiais de Segurança, Empresas e Almoxarifado prevalecem em seus próprios domínios. Não interpretar uma decisão deste documento como autorização para merge, migração, Rules, secrets ou produção. Ao final de cada Worker, atualizar a seção 13 (handoff) por novo commit documental, sem reescrever a evidência histórica.

## 1. Objetivo e definição de sucesso

Estruturar a experiência do cliente desde o primeiro contato até a utilização continuada da plataforma; facilitar a obtenção de ajuda; registrar dificuldades relevantes; identificar clientes que não chegaram à primeira operação e oferecer acompanhamento humano antes de presumir abandono.

**Sucesso não é** aumentar reads, capturar cada clique, manter sessão aberta, fazer login ou simplesmente encerrar o checklist. **Sucesso é** o cliente conseguir uma tarefa útil, encontrar ajuda sem dificuldade e permanecer usando recursos pertinentes à sua rotina.

**Escopo inicial:** setores de Aprovisionamento atualmente suportados. **Empresas:** compatibilidade arquitetural futura, sem assumir que PRs empresariais DRAFT estão em produção.

## 2. Estado da auditoria, metodologia e limites

- Auditoria estática independente da árvore da `main`: 1.415 entradas, sem truncamento; código, rotas, componentes, contratos, Rules, testes e memoriais históricos correlatos.
- Referência imutável da revisão: `35825d5ad563361fecd1b3d2a00ca81a4734e532`.
- **Evidência C:** implementação observada no código; **H:** documentação ou teste histórico; **NI:** não identificada nas superfícies examinadas; **NV:** não verificável sem runtime/dados autorizados.
- Não foram executados login em tenant real, navegação produtiva, typecheck local, build, Firebase Emulator, Browser E2E, análise de satisfação ou leitura de dados reais de clientes. A consulta de checks diretamente para o SHA não retornou resultados associados; isso **não comprova falha de CI**.
- Não há baseline numérica confiável de ativação, retenção, churn ou satisfação. Não inventar taxas, metas históricas ou alegar redução de abandono já comprovada.
- Auditoria-base detalhada também registrada no documento `EMPROVEX_AUDITORIA_SUPORTE_ONBOARDING_RETENCAO_R0_20261031.md` entregue pelo chat em 31/10/2026; **este memorial reproduz abaixo os achados e as decisões necessárias de forma independente**. O arquivo original não foi incorporado ao repositório por inferência.

## 3. Jornada atual verificada no código

1. O institucional exibe o valor do plano, FAQ comercial, convite ao teste acompanhado e 14 IDs de vídeo da Academia EMPROVEX: `public/institucional/content.html` e `site.js`.
2. O formulário chama `POST /api/public/access-requests`; é validado no servidor, possui honeypot, proteção best-effort de burst e persiste `platformAccessRequests` por hash de e-mail.
3. A aba Admin **Interessados** lê `GET /api/admin/access-requests`, autenticado como fundador, e permite alterar `novo / contatado / em_teste / concluido / descartado`, além de links de e-mail e WhatsApp.
4. O administrador provisiona o workspace e a credencial via `AdminCreateSectorPanel` e `sectorProvisioningAdmin`, com trial opcional.
5. O operador tem recuperação e troca segura de senha, verificação de identidade, acesso por workspace e aceite legal antes da operação.
6. O `SectorFirstAccessChecklist` é curto e não bloqueante; confirma dados do setor, navegação e Drive opcional; persiste apenas em `localStorage` por UID.
7. A área de assinatura inclui ajuda para pagamento e `supportContact` configurável. Login, Termos e Privacidade referenciam `aprov1hgesm@gmail.com`.
8. Existem dados de billing, sessões ativas e telemetria operacional estimada, **mas não uma métrica comprovada de tarefa concluída e retenção**.

## 4. Matriz de reaproveitamento — NÃO duplicar estes recursos

| Recurso existente | Fonte de implementação | Diretriz |
| --- | --- | --- |
| Site e vídeos da Academia | `public/institucional/{content.html,site.js}` | Reaproveitar catálogo; player somente após clique |
| Primeiro acesso | `components/auth/SectorFirstAccessChecklist.tsx` | Preservar checklist simples e opcional |
| Recuperação de senha | `EmprovexLogin.tsx`, `SectorCredentialModal.tsx`, `useOperationalData.ts` | Não criar outro fluxo de Auth |
| Provisionamento | `AdminCreateSectorPanel.tsx`, `sectorProvisioningAdmin.ts` | Sem signup público novo |
| Interessados | `AdminAccessRequestsPanel.tsx`, API pública/admin | Evoluir o próprio processo; não implantar CRM paralelo |
| Billing, trial, regularização | `AdminBillingPanel.tsx`, `lib/billing.ts`, `app/regularizacao/page.tsx` | Não alterar regras financeiras por causa de suporte |
| Sessões e telemetria | `platformAdminSessions.ts`, `workspaceUsageTelemetry.ts`, `AdminUsageReportsPanel.tsx` | Não transformar consumo técnico em sinal de satisfação |
| Aceite e proteção | `LegalAcceptanceGate.tsx`, Auth, Rules, APIs server-side | Preservar autorização por identidade e workspace |
| Modo Essencial e Operador Móvel | shells e rotas existentes | Ajuda leve, sem efeitos obrigatórios ou dependência 3D |

## 5. Auditoria R0 — 16 achados com impacto e decisão

| ID | Evidência e lacuna | Prioridade | Decisão GOV-SIMP-01 |
| --- | --- | --- | --- |
| A-01 | Checklist guarda `completed` em `localStorage`, sem operação real nem status administrativo | P1 | Preservar UX; medir primeira tarefa útil separadamente |
| A-02 | Academia tem 14 vídeos, mas menus operacionais auditados não apresentam entrada Ajuda/Academia | P0 UX | Expor Ajuda leve, preferencialmente com fonte única do catálogo |
| A-03 | Login/Termos/Privacidade têm e-mail fixo; billing usa `supportContact` opcional | P0 UX | Confirmar canal oficial e unificar sua apresentação |
| A-04 | Não encontrado fluxo de chamados com abertura, tratamento e solução | P1 | Suporte humano mínimo primeiro; avaliar histórico simples sem helpdesk complexo |
| A-05 | `AdminAccessRequestsPanel` permite status e contato, mas sem notas/histórico/próxima ação | P1 | Evoluir interessados, sem novo CRM |
| A-06 | API de interessados usa `pageSize=100`, sem `nextPageToken` | P1 | Planejar paginação proporcional ao crescimento |
| A-07 | Reenvio do formulário por mesmo e-mail retorna sucesso em `409` sem atualizar contato | P1 | Preservar deduplicação e tornar nova tentativa rastreável de forma mínima |
| A-08 | API pública salva solicitação; não foi identificado disparo de notificação nessa rota | P1 | Sinalização simples ao Admin; automação só com necessidade |
| A-09 | Status `em_teste` do lead não está vinculado ao `workspaceId`/trial efetivo | P1 | Não inferir vínculo por e-mail; associação explícita e autorizada se necessária |
| A-10 | Telemetria agrega reads/writes/listeners por módulo; não comprova retenção | P1 | Definir marcos determinísticos de operação concluída |
| A-11 | `sessionSlots.lastSeenAt` e heartbeat medem sessão, não produtividade | P1 | Não usar como sinal isolado de adoção |
| A-12 | `AdminCreateSectorPanel.tsx` ativo afirma billing `OBSERVE` e ausência de bloqueio | P0 precisão | Confirmar enforcement atual antes de corrigir a descrição, sem alterar billing |
| A-13 | Memoriais SaaS antigos citam Vercel, Mercado Pago/R$ 70 e fundador Google-only | P1 doc | Tratar como história; prevalecem código/contrato atual e memorial de release |
| A-14 | Guard `verify-saas-r1-onboarding.mjs` verifica textos/estruturas, não a futura jornada de suporte | P1 QA | Criar poucos testes focados e smoke de navegação afetada |
| A-15 | Novo suporte exige fronteiras de workspace, minimização e retenção | P0 transversal | Autorizar por servidor; proibir dados sensíveis e vazamento entre UGs |
| A-16 | Não existem evidências reais de taxa de abandono ou satisfação | P1 evidência | Começar com medição, não com metas presumidas |

**P0 UX/precisão** acima não significa incidente P0 de segurança nem justifica alterar ou suspender produção. Para cada achado, aplicar a menor ação que melhore efetivamente o uso.

### 5.1. Observações confirmadas de código

- `app/api/admin/access-requests/route.ts` consulta até 100 registros e usa precondição `currentDocument.updateTime` para atualizar o status; preservar essa defesa contra edição concorrente.
- `app/api/public/access-requests/route.ts` trata HTTP 409 como sucesso idempotente e não reabre o lead. Não converter isso silenciosamente em sobrescrita de dados pessoais.
- `requestSecurity.ts` declara rate limit **local ao processo**, não distribuído entre instâncias Cloud Run.
- `AdminUsageReportsPanel.tsx` adverte: “Um dia sem registro não comprova que o sistema não foi utilizado.”
- `PlatformAdminView.tsx` usa `AdminCreateSectorPanel.tsx` e `AdminAccessRequestsPanel.tsx`; corrigir primeiro o componente realmente ativo, não apenas modal legado.
- A navegação auditada inclui `AppSidebar`, `MobileNavigation`, `WarehouseSidebar` e `WarehouseMobileShell`, sem Ajuda operacional identificada.

## 6. Plano de evolução por ondas (escopo PROPOSTO, não implementado)

### Onda R1 — Tirar fricção sem banco novo

- Consolidar e tornar visível o canal oficial de suporte nos pontos operacionais necessários, sem inventar WhatsApp ou e-mail novo.
- Expor a Academia como **Ajuda** dentro da experiência autenticada, incluindo modo Essencial/mobile e Central de Depósitos na integração apropriada; reutilizar 14 vídeos e agrupar por tarefa.
- Abrir vídeo somente mediante ação do usuário; evitar player automático, listeners extras ou payload pesado no carregamento.
- Corrigir texto efetivamente desatualizado no cadastro de setor após conferir billing atual.
- Manter checklist curto, sem wizard obrigatório e sem coleta de dados a cada passo.

**Critério R1:** usuário encontra Ajuda e contato em uma ou duas ações; navegação, login, aceite, assinatura, 3D e trabalho operacional seguem intactos.

### Onda R2 — Acompanhamento administrativo mínimo

- Evoluir interessados para facilitar acompanhamento sem recriar CRM: status atual, data de contato, observação curta e próxima ação **somente se necessários à operação**.
- Corrigir visibilidade acima de 100 registros quando o painel alcançar esse limite; preservar ordenação e paginação.
- Definir o comportamento do interessado que solicita acesso novamente, sem vazar existência de cadastro nem perder nova intenção de contato.
- Para cliente já provisionado, preferir inicialmente **registro de atendimento pelo responsável no Admin**. Só abrir protocolo self-service e coleção de tickets quando o uso mostrar necessidade real.
- Não interpretar lead `em_teste` como assinatura/trial concedido; vincular por identidade de workspace apenas em fluxo administrativo autorizado.

**Critério R2:** responsável localiza cliente e último contato; não perde solicitações e consegue registrar uma necessidade sem criar múltiplas fontes concorrentes de verdade.

### Onda R3 — Adoção e risco de abandono, sem espionagem de cliques

- Inspecionar contratos reais de criação/alteração bem-sucedida de empenhos, NF e depósito; definir quais operações constituem **primeiro valor entregue**.
- Preferir timestamps/dados existentes ou agregação pontual, e **não** criar evento adicional por clique, por render ou por heartbeat.
- Se nova persistência for estritamente necessária, um resumo agregado mínimo por workspace com UTC, tipo do marco e origem de cálculo; idempotência e revisão de Rules/IAM antes de codificar.
- Estados analíticos sugeridos: `sem_evidencia_de_ativacao`, `ativado`, `atividade_reduzida_a_confirmar`. O termo `abandonou` exige confirmação comercial/humana, não só ausência de telemetria.
- Reutilizar apenas como contexto complementar os dados de trial, uso técnico e sessões; não transformar qualquer um deles em score de churn determinístico isolado.
- Não aplicar critérios de inatividade uniformes a todos os setores sem calibragem por estágio de trial e rotina real.

**Critério R3:** mostrar um marco verificável e sua fonte para cada classificação, sem falsas certezas e sem elevar significativamente o custo computacional.

### Onda R4 — Feedback e automação condicionais

- Pergunta breve de utilidade ou motivo de não continuidade, quando houver evidência de necessidade; sem modal intrusivo.
- Automatizar lembretes de acompanhamento somente com consentimento/canal autorizado e demanda real; sem sistema massivo de e-mails ou chatbot obrigatório.
- **Não priorizada** antes de validar as R1–R3.

## 7. Estratégia de engenharia: HÍBRIDA (paralela isolada + integração sequencial)

**Decisão:** nem execução totalmente sequencial, que desperdiçaria independências, nem paralelismo irrestrito, que provocaria conflito de shell/Auth/Admin/Rules. Usar **3 Workers independentes em paralelo após a fundação documental**, e **1 Worker integrador sequencial**. A implementação de R2/R3 pode ocorrer em ondas posteriores se a fundação demandar evidência adicional. Nenhuma criação de workers ou alteração de código é autorizada automaticamente por este planejamento.

```text
W0 — memorial/auditoria R0.1 (ESTE DOCUMENTO, apenas docs)
            |
            v
   G0 — verificar main e PRs concorrentes, contratos e contato oficial
            |
            +----------------------+-----------------------+
            |                      |                       |
            v                      v                       v
 W1 — Ajuda/Academia       W2 — Atendimento leve   W3 — Métricas de adoção
      UI isolada               e leads isolados       auditoria determinística
            |                      |                       |
            +----------------------+-----------------------+
                                   |
                                   v
                  G1 — revisão de interfaces e conflitos
                                   |
                                   v
                   W4 — integração SEQUENCIAL por onda
                                   |
                                   v
                  G2 — testes focados + integração segura
                                   |
                                   v
                Merge/Cloud Run SOMENTE COM AUTORIZAÇÃO
```

### 7.1. W0 — Coordenação documental (concluída na criação da PR deste memorial)

**Escreve:** somente `docs/EMPROVEX_SUPORTE_ONBOARDING_MEMORIAL_OFICIAL.md`.  
**Entrega:** diagnóstico R0, inventário de reaproveitamento, fronteiras, dependências, estratégia de workers e handoff.  
**Não faz:** implementação, UI, API, banco, Rules, deployment.

### 7.2. W1 — Ajuda e Academia (paralelizável)

**Branch proposta:** `feat/emprovex-suporte-r1-w1-ajuda-academia`.  
**Escopo próprio:** criar módulo/componentes isolados em `features/support/` ou `components/support/`, com catálogo tipado e UX acessível de vídeos/contato. Não duplicar o conteúdo: reutilizar IDs/títulos oficiais por contrato único, mantendo compatibilidade com a landing. Não modificar `app/login/page.tsx`, `PlatformAdminView.tsx`, `AppSidebar.tsx`, `WarehouseSidebar.tsx` ou Rules nesta etapa; pontos de montagem são responsabilidade de W4 após reconciliar as frentes concorrentes.  
**Testes:** catálogo de vídeos e URLs permitidas, lazy-load do player, mobile/Essencial, render sem dependência de Firebase novo.  
**Handoff obrigatório:** API de props/ponto de montagem, arquivos alterados, SHA, testes e pendências de integração.

### 7.3. W2 — Relacionamento e atendimento leve (paralelizável com W1)

**Branch proposta:** `feat/emprovex-suporte-r1-w2-relacionamento`.  
**Escopo próprio:** desenhar e, quando autorizado, implementar **a menor melhoria** no fluxo de interessados/contato, preferencialmente via módulos auxiliares novos e endpoints isolados, não um CRM. Primeiro resolver contrato de repetição, paginação e histórico mínimo; separar claramente lead público de chamado de cliente autenticado. Não construir ticketing/Rules nova automaticamente; qualquer persistência além de `platformAccessRequests` exige descrição de finalidade, retenção e autorização.  
**Arquivos sensíveis reservados para W4:** `PlatformAdminView.tsx`, `app/login/page.tsx`, `AppSidebar.tsx`, `firestore.rules`. W2 poderá alterar `AdminAccessRequestsPanel.tsx` e sua API, desde que informe o contrato e não concorra com outro Worker neste mesmo arquivo.  
**Testes:** administração fundador-only; página >100, concorrência/versionamento, reenvio e ausência de vazamento/enumerabilidade; 400/401/403/409/429 conforme contrato.  
**Handoff:** esquema mínimo, ausência de writes extras desnecessários, mudanças na API, custos e riscos.

### 7.4. W3 — Adoção determinística (paralelizável, inicialmente SOMENTE LEITURA)

**Branch proposta, se houver artefato documental:** `audit/emprovex-suporte-r1-w3-adocao`.  
**Escopo:** auditar contratos reais de `empenhos`, `notas-fiscais`, `warehouse`, timestamps, retorno de mutações e fonte autoritativa; produzir matriz por evento com critérios de sucesso, idempotência, custo de leitura, eventual necessidade de registro adicional e implicações de isolamento.  
**Proibição:** não editar telas operacionais, Firestore Rules, banco ou hooks de escrita, e não inferir abandono por sessões/reads. **W3 não implementa telemetria nova nesta primeira rodada.** Se constatar que dados já existentes bastam, especificar consulta limitada e determinística.  
**Handoff:** critérios de ativação por módulo, falsos positivos, limitações de cobertura e recomendação GO/NO-GO para a implementação R3.

### 7.5. W4 — Integrador único (SEQUENCIAL, após W1/W2/W3)

**Branch futura:** `integration/emprovex-suporte-r1`, criada a partir da `main` atualizada no momento da integração (não pressupor que a baseline R0 permanecerá o HEAD).  
**Responsável exclusivo por resolver conflitos** de `app/login/page.tsx`, `PlatformAdminView.tsx`, `AppSidebar.tsx`, navegação Warehouse/mobile e contratos comuns.  
**Execução:** integrar primeiro a ajuda R1, depois o mínimo de relacionamento R2; só autorizar instrumentação R3 após o handoff W3 e comprovar custo/isolamento. Pode integrar em PRs menores por onda se isso evitar espera/risco; não manter branch longa até todas as fases.  
**Gates:** Fast CI + Core Protection + Application CI quando aplicáveis à mudança integrada, testes dirigidos de browser/UX; emulador apenas para mudança de autorização/persistência. Garantir que /empresa DRAFT não foi presumido ativo e que Almoxarifado ainda não integrado não sofreu regressão.

## 8. Concorrência atual observada (checkpoint 31/10)

PRs abertas inspecionadas no GitHub e cruzadas com lista real de arquivos modificados:

| Frente | PRs | Arquivos compartilhados e consequência |
| --- | --- | --- |
| EMPROVEX Empresas | #416, #417, #418, #419 | `PlatformAdminView.tsx`, `app/login/page.tsx`, `EmprovexLogin.tsx`, `platformIdentity.ts`. **W4 não edita esses arquivos simultaneamente sem rebase e revisão.** |
| EMPROVEX Almoxarifado | #436–#439 | #436 altera `app/login/page.tsx`, `AdminCreateSectorPanel.tsx`, `platformAccess.ts`, `platformIdentity.ts`, `firestore.rules`; filhos #437–#439 são branches isoladas. **Evitar tocar tais contratos em W1/W2/W3.** |
| EMPROVEX AI | #425, #428, #429 | Alterações de autorização e integração/endpoint; #429 toca autenticação do fundador no servidor. **W2 reutiliza o guard sem substituí-lo.** |
| Segurança/Cloud Run | memorial geral e de segurança | Não alterar fluxo de publicação, identidades IAM, billing ou configuração cloud para adicionar Ajuda. |

**Estratégia de colisão:** Workers W1 e W2 trabalham em áreas novas e disjuntas; W3 somente leitura. Após merge/homologação das frentes que mexem em shell/identidade, W4 reconcilia uma única vez. Não exigir esperar a conclusão de toda expansão Empresas/Almoxarifado para construir módulos isolados; **exigir reconciliação no momento de montá-los nas superfícies comuns**.

## 9. Contratos mínimos propostos (não criar schema sem necessidade)

### 9.1. Ajuda

- `topic`: categoria estática da tarefa (`empenhos`, `notas`, `cronogramas`, `depositos`, `geral`).
- `videos`: catálogo único de ID do YouTube, título e tópico; somente IDs explícitos permitidos; carregamento do embed sob ação direta do usuário.
- `supportContact`: canal autorizado pelo administrador; quando não configurado, usar fallback oficial validado no memorial/legal, sem exposição de telefone inventado.
- Nenhum token, workspaceId editável ou fetch recorrente necessário para renderizar tutoriais estáticos.

### 9.2. Relacionamento

- Manter `platformAccessRequests` como fonte de verdade da solicitação pública.
- Qualquer novo campo (ex.: `lastContactAt`, `nextActionAt`, observação curta) precisa de utilidade demonstrável, atualização founder-only, tamanho limitado e política de retenção.
- Um cliente já provisionado não deve ter seus chamados forçados dentro de um lead pelo mesmo e-mail; vínculo de workspace somente por identidade validada.
- Não armazenar documentos operacionais, credenciais ou mensagens livres extensas em registros comerciais.

### 9.3. Adoção

- Agregado por **workspace**, não score individual de comportamento dos militares.
- `firstValueAt` e `lastMeaningfulActivityAt` são nomes **ilustrativos** e não um contrato aprovado; derivar dos dados existentes sempre que possível.
- Evento de negócio: confirmação autoritativa de operação, não simples clique nem login.
- Campos ausentes = **sem evidência suficiente**; nunca classificar cancelamento ou churn automaticamente.
- Nenhuma coleta nova de PII ou monitoramento permanente no navegador para esse objetivo.

## 10. Segurança, LGPD, custo e desempenho

1. **Zero bypass multitenant:** resolver identidade e workspace pela sessão autenticada no servidor. Nunca aceitar workspace arbitrário enviado pelo usuário como autorização suficiente.
2. **Privacidade:** registrar finalidade/retensão dos metadados de atendimento; não solicitar senha, token, API key, NF, comprovante bancário ou outro documento sensível por padrão. Atualizar política legal somente se o novo tratamento exigir.
3. **Custo:** sem listeners permanentes de suporte, sem varredura diária de todos os workspaces, sem evento a cada clique; consultas somente quando uma tela relevante é aberta, ou agregações justificadas.
4. **Operacionalidade:** Help/Academia não impede login, regularização, operação móvel, impressão, 3D ou modo Essencial em caso de erro de vídeo ou serviço externo.
5. **Isolamento de workers:** não alterar fluxo de billing, Firebase Auth, Rules, Cloud Run, webhooks ou infraestrutura de pagamentos para implementar componentes meramente visuais.
6. **Portabilidade:** evitar dependência de Vercel; Cloud Run é o destino vigente de produção conforme memorial geral. Este planejamento não recria nem publica recursos cloud.

## 11. Certificação proporcional (GOV-SIMP-01)

| Mudança | Testes mínimos pertinentes |
| --- | --- |
| Documentação/contato/texto estático | Verificação de link e conteúdo; sem build ou E2E pesado obrigatórios por padrão |
| Catálogo/Ajuda UI | Teste de componente/links, mobile/Essencial, ausência de player automático; TypeScript/build na integração |
| API comercial | Testes de campos, paginação, versionamento e idempotência; Auth fundador-only; smoke negativo |
| Histórico novo de atendimento | Testes server-side de autorização, tenant cruzado, limite de payload e retenção |
| Métrica de adoção sem novos writes | Casos sintéticos de operação válida/inválida e ausência de evidência |
| Nova escrita/Rules (somente se autorizada) | Firebase Emulator e regressão de isolamento/Rules, mais teste dirigido do endpoint |
| Integração no shell | Fast CI, Core Protection, Application CI disponíveis e smoke navegador dos fluxos alterados; não desconsiderar falhas reais |

**Não refazer bateria geral após cada alteração documental; não declarar PASS por simples presença de scripts; não publicar sem checagens reais do SHA integrado.** Para uso real, medir base antes/depois sem inventar resultados.

## 12. Critérios de decisão e futuro backlog

**GO para desenvolvimento isolado W1 e desenho/implementação mínima W2**, desde que respeitem exclusões de arquivos. **GO somente de auditoria para W3**. **W4 bloqueado até handoffs e reconciliação de concorrência**. **NO-GO para implementação automática de helpdesk complexo, CRM separado, chatbot obrigatório, métricas comportamentais por clique, Rules novas ou deploy**.

O responsável pode executar primeiro uma R1 enxuta e observar uso real; R2/R3 são incrementais e podem ser reduzidas ou adiadas sem invalidar R1.

Indicadores futuros, ainda sem baseline quantitativa:
- **Ativação:** novos workspaces com primeira operação de negócio confirmada / novos workspaces elegíveis.
- **Tempo até primeiro resultado:** intervalo entre provisionamento e primeira operação confirmada.
- **Retenção operacional:** workspaces com operação pertinente em períodos consecutivos, diferenciando sem evidência de inatividade confirmada.
- **Suporte:** quantidade de dificuldades por workspace, categorias e resolução; dados coletados apenas se o canal efetivamente gerar registros.
- **Motivo de não continuidade:** informação explícita, não inferida por encerramento de trial ou silêncio técnico.

## 13. Registro de handoffs, auditoria e evolução

### 13.1. W0 — Fundação documental — 31/10/2026

- **Base:** `main@35825d5ad563361fecd1b3d2a00ca81a4734e532`.
- **Escopo:** auditoria somente leitura, 16 achados, código e PRs cruzados, matriz de reaproveitamento e plano híbrido.
- **PR documental:** [#440](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/440), **DRAFT**; commit inicial do memorial `7c01c38cb554720cfff33e86e4fa34ef1ad03473`. O SHA da branch poderá evoluir com atualizações exclusivamente documentais.
- **Validação:** documento criado/recuperado no GitHub; nenhum código funcional alterado; sem merge/deploy.
- **Parecer:** GO para trabalho isolado e planejamento; integração/produção condicionadas às etapas e autorização.
- **Riscos conhecidos:** documentações SaaS legadas, conflitos com Empresas e Almoxarifado, ausência de dados reais de churn.
- **Pendência não bloqueante:** confirmar canal de suporte oficial único e conferir texto de trial com o estado vigente da configuração financeira.

### 13.2. Modelo obrigatório para W1/W2/W3/W4

`Worker | branch | PR | base SHA | head SHA | arquivos | entregas | exclusões respeitadas | testes REALMENTE executados | dependências | GO/NO-GO | data`.

Nunca marcar feature como **implementada** por estar apenas neste plano; registrar por estágio `PLANEJADO`, `EM PR`, `INTEGRADO`, `PRODUÇÃO` com evidência e data.

### 13.3. Regras de manutenção

- Atualizar somente este memorial para decisões deste domínio; adicionar checkpoints datados em vez de substituir histórico.
- Ao iniciar cada Worker, verificar novamente a SHA da `main` e o conjunto de PRs que tocam arquivos compartilhados.
- Alteração de texto/contato não autoriza mudar regras de cobrança.
- Mudanças em conteúdo legal precisam preservar documentos e versões oficiais.
- Merge, promoção Cloud Run, Rules e dados produtivos só mediante autorização específica do responsável e processo do memorial geral.

### 13.4. Checkpoint — Entregas W1 e W2 verificadas no GitHub (31/10/2026, Brasília)

**Escopo deste checkpoint:** verificação somente leitura das PRs, de seus handoffs e dos checks associados aos SHAs finais. Esta atualização é exclusivamente documental; não houve merge, execução de testes em ambiente local nem deploy pelo coordenador.

| Worker | PR DRAFT | Head SHA verificado | Evidência e estado | Decisão |
| --- | --- | --- | --- | --- |
| W1 — Central de Ajuda/Academia | [#442](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/442) | `c3258b5e39a7ec5f19c4adeee128cd614064751c` | Workflow isolado da Academia SUCCESS, Fast CI SUCCESS, Core Protection SUCCESS, Visual-R2 SUCCESS. Handoff informa 5/5 testes + TypeScript PASS; código não foi integrado aos menus. | **GO para W4 técnico; NO-GO para produção direta** |
| W2 — Relacionamento/Interessados | [#443](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/443) | `ad76a306a34d0cb963719b3f0f8dbeaa2929cad2` | Fast CI SUCCESS **inclusive no último SHA**, Core Protection SUCCESS, Visual-R2 SUCCESS e demais checks aplicáveis. Handoff informa 8 verificações comportamentais sintéticas PASS, mas não comprova execução integral de `scripts/emprovex-support-w2.test.mjs` pela pipeline. | **GO condicional para W4 técnico; NO-GO para merge/produção isolados** |
| W0 — Memorial oficial | [#440](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/440) | Branch documental de referência, SHA variável | Memorial oficial criado, com auditoria R0 e plano híbrido; ainda DRAFT e fora da `main`. | **Handoff documental disponível** |

**Evidência dos arquivos e isolamento:**
- PR #442 contém cinco arquivos: `.github/workflows/emprovex-support-w1.yml`, `docs/EMPROVEX_SUPORTE_W1_R1_HANDOFF.md`, `features/support/EmprovexHelpCenter.tsx`, `features/support/tutorialCatalog.ts`, `scripts/emprovex-support-w1.test.mjs`. Não alterou login, sidebar, Admin ou Rules.
- PR #443 contém seis arquivos: `app/api/admin/access-requests/route.ts`, `app/api/public/access-requests/route.ts`, `components/admin/AdminAccessRequestsPanel.tsx`, `docs/handoffs/EMPROVEX_SUPORTE_R1_W2_HANDOFF.md`, `lib/server/accessRequestSupport.ts`, `scripts/emprovex-support-w2.test.mjs`. Não alterou shell, Auth, billing ou Rules.
- As mudanças funcionais de W1 e W2 são independentes nos arquivos examinados; a certificação da **composição** ainda não foi realizada. Em ambas, o Application CI apareceu `skipped` por serem PRs DRAFT, e isso não deve ser relatado como PASS.
- Handoffs oficiais: `docs/EMPROVEX_SUPORTE_W1_R1_HANDOFF.md` da branch W1 e `docs/handoffs/EMPROVEX_SUPORTE_R1_W2_HANDOFF.md` da branch W2. Os arquivos ainda estão em branches diferentes, não na `main`.

### 13.5. Liberação e sequência para W4 R1

**Decisão:** LIBERADO iniciar a integração técnica W4 com as PRs #442 e #443; **não** liberar merge na `main` nem produção por esta declaração. O W3 (auditoria de adoção e retenção) pode continuar separadamente e **não bloqueia a integração das capacidades R1 de Ajuda e Interessados**, desde que W4 não implante as métricas R3 nem faça promessas de redução de churn.

**Procedimento mínimo do W4, sem burocracia:**
1. Verificar a `main` mais recente e reconciliar apenas as alterações de código dos W1 e W2, documentando SHAs de origem; incluir handoffs na branch de integração e preservar a PR #440 como fonte documental. Se o memorial não estiver na main, evitar sobrescrita/duplicação de conteúdo quando for integrado.
2. Montar `EmprovexHelpCenter` na navegação operacional e no ponto apropriado da Central de Depósitos, com UX funcional desktop/mobile/Essencial e abertura leve sob demanda. Respeitar login, termos, assinatura, 3D e rotas existentes; conferir PRs concorrentes Empresas/Almoxarifado antes de editar shells.
3. Integrar o painel de Interessados e suas APIs preservando fundador-only, CAS, paginação server-side, reenvio neutro, validação das notas e ausência de associação indevida com trial/workspace.
4. Executar **uma vez** a suíte dirigida do W2 (Node 24, `node --experimental-strip-types --test scripts/emprovex-support-w2.test.mjs`) no SHA de integração. Aproveitar evidência W1 e CI já certificados, repetindo apenas testes necessários após mudança real.
5. Conferir atualização de informação de privacidade/retensão para `adminNote`, `lastContactAt`, `nextActionAt` e `lastRequestedAt`, conforme tratamento novo; não instituir migração ou Rules novas se o contrato atual for suficiente.
6. Rodar Fast CI + Core Protection + Application CI e smoke funcional/visual estritamente pertinentes ao SHA integrado; corrigir falhas reais, não remover guards ou checks.
7. Abrir PR DRAFT de integração, registrar handoff no memorial e apresentar GO/NO-GO. A publicação Cloud Run requer autorização específica do responsável, verificação de revisão/health e processo vigente de release; **não executar promoção automaticamente**.

**Não reabrir escopo:** sem CRM paralelo, chatbot, suporte por WhatsApp não configurado, ciclo de tickets completo, novas métricas por clique, mudanças de Auth/billing nem varreduras contínuas de dados.

### 13.6. Checkpoint — Integração W4 verificada no GitHub (31/10/2026, Brasília)

**Origem:** [PR #448 — EMPROVEX Suporte R1](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/448), branch `integration/emprovex-suporte-r1`, **DRAFT**, head **`85c9001b3802c735805d392ace94101fc684ade3`** após correção visual `85c9001b`. Base `main@35825d5ad563361fecd1b3d2a00ca81a4734e532`. Estado confirmado por consulta ao GitHub: PR aberta, `mergeable=true`, **não merged**, `main` inalterada no momento da conferência.

**Escopo comprovado por lista de 19 arquivos:** composição das entregas W1 (#442) e W2 (#443), `features/support/EmprovexHelpOverlay.tsx`, montagem em `app/login/page.tsx` e `components/layout/AppSidebar.tsx`, montagem da Central de Depósitos em `features/warehouse/components/WarehouseModuleShell.tsx` e `WarehouseSidebar.tsx`, scripts W1/W2/W4, workflow de certificação e handoffs isolados. **Nenhuma alteração em Firestore Rules, IAM, billing ou infraestrutura.** Handoff integrado na branch W4: `docs/handoffs/EMPROVEX_SUPORTE_R1_W4_HANDOFF.md`.

**Checks do SHA final verificados no GitHub:**

| Check / workflow | Evidência real | Estado |
| --- | --- | --- |
| EMPROVEX Support R1 integration certification | [run 41266420448](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/41266420448): executa as suítes W1, W2, W4 e `npm run typecheck` | **SUCCESS** |
| EMPROVEX Support W1 isolated certification | [run 41266420479](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/41266420479) | **SUCCESS** |
| EMPROVEX Fast CI | [run 41266420483](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/41266420483) | **SUCCESS** |
| EMPROVEX Core Protection | [run 41266420446](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/41266420446) | **SUCCESS** |
| VISUAL-R1 W4 QA (isolated) | [run 41266420450](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/41266420450) | **SUCCESS** |
| VISUAL-R2 Integrity Audit | [run 41266421435](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/41266421435): todos os jobs aplicáveis concluídos SUCCESS; inclusive Browser E2E geral — login no Firebase Emulator e tarefas operacionais | **SUCCESS** |
| Application CI | [run 41266420457](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/41266420457) — PR DRAFT | **SKIPPED**, não PASS |

**Limite de cobertura:** o teste `scripts/emprovex-support-w4.test.mjs` confere estaticamente os pontos de montagem e o isolamento. O Browser E2E geral da Visual R2 **não demonstra, por si só,** o clique real e a interação dentro do novo overlay de Ajuda em navegador autenticado no mobile e no modo Essencial. O próximo passo proporcional é **um teste visual/interativo dirigido** desses pontos, sem repetir integralmente as suites W1/W2/R2 já aprovadas. Confirmar também a adequação das novas anotações administrativas à política de privacidade/retensão antes de publicação.

**Parecer documental:** **GO para revisão final da integração**; a pendência do Browser E2E geral informada anteriormente está **RESOLVIDA — SUCCESS**. **NO-GO para afirmar homologação visual específica de Ajuda mobile/Essencial sem teste correspondente**, e **NO-GO para declarar Application CI PASS** enquanto estiver skipped. Para preparar merge, avaliar tornar a PR Ready for review e obter Application CI no SHA vigente, sem permitir merge automático. Merge na `main` e deploy/promoção Cloud Run permanecem sujeitos à autorização específica do responsável e às políticas de release vigentes.

### 13.7. ENCERRAMENTO — Suporte R1 em produção (01/11/2026, Brasília)

**Status final: IMPLEMENTADO, CERTIFICADO, INTEGRADO NA MAIN E PUBLICADO NO CLOUD RUN COM 100% DO TRÁFEGO.** Este checkpoint encerra a frente Suporte R1, sem encerrar o desenvolvimento contínuo do produto nem as frentes independentes.

**Integrações GitHub:**
- [PR #440 — Memorial oficial](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/440) **MERGED** via squash `56d24c0cdb005e3d63ac1703b2703afdd49caa46`.
- [PR #448 — Suporte R1 / W4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/448) **MERGED** via squash `e68f358e711167c5c0639c978b7c0da00e668bbb`.
- Correção restrita de whitespace Markdown em três handoffs, sem mudança de lógica: `31028642232250435459228df66d5a029cb39077`. O Application CI identificou inicialmente `Diff hygiene` reprovado por espaços finais nos handoffs; correção foi realizada, mantendo quebras de linha Markdown.
- Proteção adicional de teste no W4 para paginação sob demanda e Auth fundador: `72685d84e7b6c2805162940c2567a9ac0830b74a` (**SHA exato da imagem publicada**).

**Certificação do SHA `72685d84e7b6c2805162940c2567a9ac0830b74a`:**
- [Core Protection — run 41273609069](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/41273609069): **SUCCESS**.
- [Application CI — run 41273609073](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/41273609073): **SUCCESS**, incluindo validação principal e Block 16/17/18/19/20/21 Final Gates.
- [Cloud Run build and stage — run 41273609086](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/41273609086): **SUCCESS**, revisão criada e verificada com **0% de tráfego**; saúde da candidata e proteção HTTP 401 da rota de cobrança sem autenticação validadas.
- SHA da imagem no Artifact Registry: `sha256:e1fa1d84900ad16252c5af44f12bb370ad5c781841305ef69cc22538c738823a`.

**Publicação autorizada por mensagem expressa do responsável neste chat:**
- Commit exclusivamente de autorização: `b9301f786479f595036bf35b2416d83e2e8fde36`, alterando apenas `ops/cloud-run/promotion-request.json`, com `sourceSha` e `revision` fixos.
- [Workflow de promoção — run 41273907751](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/41273907751): **SUCCESS**. Verificou imagem/digest, serviço e identidade, promoveu e confirmou o tráfego **100%** para `emprovex-cloudrun-candidate-g72685d84e7b6-10` e saúde HTTPS do domínio `https://emprovex.com.br/api/health` com êxito.
- Revisão anterior preservada para rollback: `emprovex-cloudrun-candidate-dbadb5c53e62b-6`. Nenhum rollback foi necessário.
- Infraestrutura vigente preservada: projeto `gen-lang-client-0982077967`, região `southamerica-east1`, serviço `emprovex-cloudrun-candidate`, runtime service account `emprovex-run-runtime`. Não houve publicação de Firestore Rules, mudança de segredos ou gravação em dados reais de clientes pelo coordenador.

**Verificação dos desenvolvimentos paralelos antes da publicação:** Almoxarifado #436/#441 permaneceu isolado; EMPROVEX Empresas #419/#447 suspenso; EMPROVEX AI/LFM3 #450 e Eleonor #453 em PRs independentes, não integrados ao release. O boletim administrativo R1/R2 já estava na main e teve publicação/homologação em ciclo próprio; sua ativação não foi repetida. Não presumir que essas frentes estejam homologadas ou publicadas por causa do merge de Suporte.

**Escopo operacional efetivamente publicado:** Central de Ajuda com catálogo oficial 14 vídeos, pesquisa e player sob demanda; entrada no Aprovisionamento e na Central de Depósitos com tópico específico; overlay acessível em desktop/mobile/Essencial; acompanhamento administrativo de interessados com paginação server-side 25 por página, reenvios tratados em janela de 24h e nota curta founder-only. Nenhum chatbot, CRM paralelo, listener adicional ou mudança de billing foi incluído.

**Limite de homologação:** CI, emulator/Browser E2E geral, health e tráfego foram confirmados. A interação manual dentro do novo overlay em navegador autenticado de cliente real **não foi certificada nesta execução**; poderá ser observada naturalmente em produção, sem justificar reabrir a implantação já concluída se não houver problema concreto.

**Decisão final:** **GO / ENCERRADO** para o desenvolvimento Suporte R1. Demais evoluções W3 (adoção/retencão), feedback R4, demandas de clientes e mudanças futuras são novos escopos, não pendências bloqueantes deste release.

## 14. Evidências de referência — código fixado na baseline

- [Checklist de primeiro acesso](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/35825d5ad563361fecd1b3d2a00ca81a4734e532/components/auth/SectorFirstAccessChecklist.tsx)
- [Login e suporte por e-mail](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/35825d5ad563361fecd1b3d2a00ca81a4734e532/components/auth/EmprovexLogin.tsx)
- [Navegação operacional](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/35825d5ad563361fecd1b3d2a00ca81a4734e532/components/layout/AppSidebar.tsx)
- [Academia institucional](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/35825d5ad563361fecd1b3d2a00ca81a4734e532/public/institucional/site.js)
- [Conteúdo comercial](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/35825d5ad563361fecd1b3d2a00ca81a4734e532/public/institucional/content.html)
- [API pública de interessados](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/35825d5ad563361fecd1b3d2a00ca81a4734e532/app/api/public/access-requests/route.ts)
- [API de interessados no Admin](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/35825d5ad563361fecd1b3d2a00ca81a4734e532/app/api/admin/access-requests/route.ts)
- [Painel de interessados](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/35825d5ad563361fecd1b3d2a00ca81a4734e532/components/admin/AdminAccessRequestsPanel.tsx)
- [Cadastro efetivo no Admin](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/35825d5ad563361fecd1b3d2a00ca81a4734e532/components/admin/AdminCreateSectorPanel.tsx)
- [Sessões do Admin](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/35825d5ad563361fecd1b3d2a00ca81a4734e532/lib/platformAdminSessions.ts)
- [Telemetria](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/35825d5ad563361fecd1b3d2a00ca81a4734e532/lib/workspaceUsageTelemetry.ts)
- [Histórico de consumo](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/35825d5ad563361fecd1b3d2a00ca81a4734e532/components/admin/AdminUsageReportsPanel.tsx)
- [Certificação estrutural anterior](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/35825d5ad563361fecd1b3d2a00ca81a4734e532/scripts/verify-saas-r1-onboarding.mjs)

## 15. Histórico

- **31/10/2026 — R0.1:** primeira versão do memorial oficial exclusivo de Suporte, Onboarding e Retenção; consolidação da auditoria de 16 achados e decisão expressa pelo desenvolvimento **híbrido: W1/W2 em paralelo, W3 somente leitura em paralelo, W4 integrador sequencial**. Nenhum trabalho funcional liberado para produção por este documento.
