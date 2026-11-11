# EMPROVEX COZINHA DIETÉTICA — PLANO MESTRE DOS WORKERS R1
**Data:** 11/11/2026 | **Status:** ESPECIFICAÇÃO DE EXECUÇÃO — NÃO IMPLEMENTADO
**Memorial canônico:** [EMPROVEX_COZINHA_DIETETICA_MEMORIAL_OFICIAL.md](../EMPROVEX_COZINHA_DIETETICA_MEMORIAL_OFICIAL.md)
**Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`
**Pasta de prompts:** `docs/cozinha-dietetica/workers/W0.md` até `W9.md`

## 1. Missão executiva

Implementar um módulo **completo e integrado de Dietas Hospitalares**, não somente um conjunto de telas ilustrativas. Workflows reais, testes funcionais e segurança comprovada, com foco em mínimo trabalho por usuário e zero regressão do EMPROVEX operacional.

**Contrato inegociável:** médicos prescrevem no fluxo institucional; unidades registram dietas conforme prescrição e **enviam mapas manualmente** na V1; Nutrição audita e se comunica com médicos, **não homologa pedidos rotineiros**; cozinha recebe, prepara, expede e acompanha entregas. Programação alimentar é FUTURA e OPCIONAL.

**Três mapas locais (America/Sao_Paulo):**
- 06h: café da manhã + lanche da manhã; mapa confeccionado até 06:00, pode ser preparado no dia anterior; tolerância da principal até 06:30.
- 10h: almoço + lanche da tarde; mapa até 10:00; tolerância da principal até 10:30.
- 16h: jantar + ceia; mapa até 16:00; tolerância da principal até 16:30.

**Ponto crítico:** tolerância de entrega **não é extensão** do prazo regular de envio. Após tolerância, atendimento rotineiro de solicitação tardia prevê secundária; exceção clínica exige comunicação e conduta autorizada. Nunca bloquear assistência por regra administrativa cega. Fechamentos e adendos com versão e autoria imutáveis.

**Perfis:** unidades PAM, UTI, UPI, Oncologia e Bloco Cirúrgico; Cozinha Dietética; Nutrição auditora; Administração hospitalar. Usuários individuais vinculados à OM, unidade e papel. Sem acesso clínico para superadministrador comercial por padrão.

**Entrada EMPROVEX:** `/` portal (4 opções), `/aprovisionamento`, `/almoxarifado`, `/cozinha-dietetica`, `/fornecedores`; vitrine `/info`. Compatibilidade histórica: `/central-empenhos`, `/login`, `/institucional`, `/central-depositos`; `/hospitalar` como alias. Evitar perda de query string, sessão, PWA, billing e deep links.

## 2. Regras de colaboração (sem burocracia, sem entregas superficiais)

1. O Worker **lê** antes de codificar: este plano, memorial V1, o próprio `Wn.md`, `docs/EMPROVEX_CORE_PROTECTION.md`, `docs/EMPROVEX_RELEASE_CLOUD_RUN.md`, `README.md`, arquivos pertinentes ao módulo e estado atual de branches/PRs. **Não implementar a partir de memória genérica**.
2. Trabalhar diretamente, sem pedir confirmação para mudanças **dentro do escopo da branch isolada**. Não gastar esforço em planos vagos: entregar arquivos operacionais, APIs reais, validações, estados de erro, testes e evidência.
3. **Sem "MVP de fachada":** é vedado tratar mock, TODO, endpoint sem persistência, lista hardcoded, guard apenas visual, indicador inventado ou testes que apenas verificam strings como funcionalidade concluída. Dado fictício em testes/demos é permitido, explicitamente identificado.
4. **Segurança essencial é obrigatória:** backend autoriza por UID + OM/UG + membership + unidade/papel + objeto; ambiente clínico isolado do datastore logístico/empresarial; sem documentos reais de pacientes no Git ou logs; bloqueios de alergia/jejum; idempotência e histórico imutável.
5. Cada Worker só altera sua **área reservada**, exceto ajuste transversal estritamente necessário e acordado com W0/W9. Desvios em arquivos reservados de outro Worker devem virar proposta de contrato/handoff, não edição unilateral.
6. **Sem merge na main, sem deploy, sem alteração de serviço produtivo, Firestore Rules em produção, billing, dados reais, credenciais ou infraestrutura clínica real.** Tudo em branch e PR Draft; testes com mocks/emuladores **do ambiente de testes**, exercitando regras reais.
7. Inspecionar HEAD antes de criar branch; commits atômicos; após implementação executar typecheck/build/testes relevantes, registrar saídas reais (PASS/FAIL/SKIP), SHA de HEAD, dependências, riscos remanescentes e **GO/NO-GO**.
8. **Não pedir ao usuário que repita requisitos já presentes.** Se bloqueio externo impedir execução (credencial/protocolo institucional/integrador), implementar parte segura máxima e registrar bloqueio específico sem simular sucesso.
9. Trabalhar em UI móvel e desktop, com acessibilidade, estados de loading/empty/error/partial e desempenho proporcional. Priorizar conclusão de ponta a ponta do escopo próprio.
10. Respeitar o aviso de risco: nenhum relatório automatizado declara culpa ou isenção administrativa; entrega não é inferida de preparo ou expedição; auditoria nutricional não substitui prescrição.
11. Só W9 integra contratos cruzados. Se surgir ajuste central, abrir registro sucinto no handoff, não refatorar módulos alheios silenciosamente.
12. Não criar novos Workers nem dividir a missão em subplanos para adiar a implementação. Entregar o escopo do Worker no presente ciclo.

## 3. Sequência e estratégia real de paralelização

**A. Fundação, primeiro:** W0 cria **branch de código** `feat/cozinha-dietetica-w0-fundacao` a partir do HEAD atual de `main`, implementa contratos, motor de domínio, storage isolado para QA e autorização. Entrega PR Draft para main, testes e SHA imutável de referência (**W0_BASE_SHA**). Não merge nem deploy.

**B. Desenvolvimento paralelo, depois de W0:** W1 a W8 leem o HEAD/contratos reais de W0; criam seus próprios branches `feat/cozinha-dietetica-wN-<tema>` a partir do **mesmo W0_BASE_SHA** (não usar o HEAD móvel da main e não trabalhar em branch compartilhada). PRs Draft devem apontar para `feat/cozinha-dietetica-w0-fundacao` quando possível, documentando o SHA base.

**C. Integração, W9:** W9 abre `integration/cozinha-dietetica-r1` a partir do W0_BASE_SHA, verifica PRs e integra por cherry-pick/merge controlado **somente nessa branch isolada**, testa os caminhos completos e abre uma PR Draft de integração contra `main`, sem merge/deploy. W9 não declara produção habilitada. Manter PR W0 e PRs W1..W8 abertos até estratégia de merge autorizada; não criar duas integrações concorrentes.

**Se W0 ainda não existir ou não tiver contratos utilizáveis:** W1..W8 devem ler tudo e preparar código independente somente se não exigirem assumir contratos inexistentes; **não inventar interfaces incompatíveis e não afirmar conclusão**. Reportar dependência real e próxima ação técnica. W9 aguarda entregas indispensáveis ou integra progresso verificável, registrando NO-GO.

## 4. Contratos obrigatórios de fundação W0

W0 é dono dos contratos estáveis e testes de domínio. Deve definir/documentar APIs/DTOs em `features/hospital/core/**` e `docs/cozinha-dietetica/contracts/**` e um **handoff de importação e autenticação** que os demais possam utilizar. Convenções esperadas (nomes finais no handoff, não supor que já existam):

- `HospitalScope`: `uid`, `organizationId`, `ug`, `membershipId`, `roles`, `unitIds`, `active`;
- `Patient`, `Admission`, `Bed`, `PatientLocationEvent`;
- `MedicalDietReference`, `DietCatalogItem`, `AllergyRestriction`;
- `MealCycleConfig`, `DietMap`, `DietMapVersion`, `MealRequest`;
- `ProductionBatch`, `MealLabel`, `DeliveryEvent`, `Incident`, `AuditEvent`, `NutritionAudit`, `MedicalReviewRequest`.
- comandos idempotentes; versão/ETag para concorrência; evento imutável; `occurredAt` do servidor; `effectiveAt` clínico informado separado; resposta tipada de erro `UNAUTHORIZED / FORBIDDEN / INVALID / CONFLICT / NOT_FOUND / PRECONDITION / UNAVAILABLE`.
- leitura e escrita segregadas por OM e unidade; nunca acesso por e-mail ou parâmetro de query sem validação.
- relógio de ciclos com timezone do hospital, horário de mapa versus tolerância de entrega e regra de adendo.
- adapter de persistência **real em QA local** (por exemplo Postgres local ou Firebase emulator) ou implementação transacional de teste com paridade dos contratos; escolha **explícita** e sem provisionamento de produção.
- exemplos de consumo e comandos de teste que provem isolamento entre 2 OMs, 2 unidades, concurrent duplicate, jejum e timestamp de servidor.

Se faltar decisão de armazenamento, W0 deve escolher uma abordagem executável em teste e explicitar o que precisará ser homologado para produção. Não bloquear os demais com uma arquitetura inteiramente abstrata.

## 5. Ownership exclusivo e entregáveis por Worker

| Worker | Responsabilidade | Arquivos reservados / fronteira |
|---|---|---|
| **W0** | Fundação, contratos, segurança central, engine de ciclos, persistência QA | `features/hospital/core/**`, `lib/server/hospital/core/**`, `docs/cozinha-dietetica/contracts/**`, `tests/hospital/core/**` |
| **W1** | Portal público, rotas antigas/novas, autenticação visual modular | `app/portal/**`, `app/info/**`, `app/aprovisionamento/**`, `app/almoxarifado/**`, `app/cozinha-dietetica/page.tsx`, `app/fornecedores/**`, `next.config.ts`, `features/hospital/entry/**`, `tests/hospital/entry/**` |
| **W2** | Pacientes, internações, leitos, movimentações, identidade no perfil unidade | `features/hospital/patients/**`, `lib/server/hospital/patients/**`, `app/api/hospital/patients/**`, `tests/hospital/patients/**` |
| **W3** | Dietas/prescrição de referência, mapa manual, adendo, ciclos | `features/hospital/maps/**`, `features/hospital/diets/**`, `lib/server/hospital/maps/**`, `lib/server/hospital/diets/**`, `app/api/hospital/maps/**`, `app/api/hospital/diets/**`, `tests/hospital/maps/**` |
| **W4** | Painel de cozinha e produção em lotes | `features/hospital/production/**`, `lib/server/hospital/production/**`, `app/api/hospital/production/**`, `tests/hospital/production/**` |
| **W5** | Montagem, etiquetas, expedição, confirmação de entrega | `features/hospital/distribution/**`, `lib/server/hospital/distribution/**`, `app/api/hospital/distribution/**`, `tests/hospital/distribution/**` |
| **W6** | Nutrição auditora, inconformidades, solicitação de revisão médica | `features/hospital/nutrition-audit/**`, `lib/server/hospital/nutrition-audit/**`, `app/api/hospital/nutrition-audit/**`, `tests/hospital/nutrition-audit/**` |
| **W7** | Administração hospitalar, unidades, membros, configuração | `features/hospital/administration/**`, `lib/server/hospital/administration/**`, `app/api/hospital/administration/**`, `tests/hospital/administration/**` |
| **W8** | Relatórios, filtros, indicadores, exportações protegidas | `features/hospital/reporting/**`, `lib/server/hospital/reporting/**`, `app/api/hospital/reporting/**`, `tests/hospital/reporting/**` |
| **W9** | Integração transversal, composição das telas pós-login, E2E, regressões | `app/cozinha-dietetica/app/**`, `features/hospital/integration/**`, `tests/hospital/e2e/**`, `docs/cozinha-dietetica/integration/**` e alterações compartilhadas estritamente necessárias documentadas |

Em cada escopo podem criar testes/utilitários com prefixo próprio no `scripts/`, sem reescrever testes legados. **Mudanças de schema central somente W0** (ou W9 na etapa integradora, com reconciliação e testes). W1 pode modificar `next.config.ts` para regras de rota, respeitando os redirects/rewrite existentes; W9 só ajusta esse arquivo se o W1 documentar o conflito e testes requererem.

**Padrão de composição:** cada Worker de funcionalidade exporta componentes e funções consumíveis pelo W9, preferencialmente `<Area>View` e `<Area>Service`; nunca criar uma segunda aplicação concorrente. Serviços recebem `HospitalScope` verificado pelo servidor. UI e API do mesmo Worker devem conversar com persistência real de QA, não diretamente com mocks.

## 6. Dependências explícitas

| Worker | Dependências |
|---|---|
| W0 | Nenhuma das demais; inspeção da main e memorial |
| W1 | Contrato W0 de identidade/guards; preservação do shell legado |
| W2 | W0 `HospitalScope`, patient/admission/location contracts |
| W3 | W0 engine de ciclo; referenciar paciente via identificadores de W2 (contrato W0), sem ler implementação de W2 |
| W4 | W0 + contrato `MealRequest` de W3; não assumir aprovação prévia |
| W5 | W0 + estados de produção de W4 + pedido de W3 |
| W6 | W0 + leitura de dietas de W3; nunca bloquear rotina por auditoria |
| W7 | W0 membership, guarda por role e acesso administrativo |
| W8 | W0 eventos e interfaces de consulta de W2–W7, com adaptadores e evidência; não inventar fatos |
| W9 | W0 e resultados W1–W8; integra sem alterar responsabilidades clínicas |

**Eventos de fronteira mínimos:** patient/admission.updated, dietReference.updated, map.submitted/map.amended, meal.suspended, meal.production.started/completed, meal.dispatched/received/delivered, nutritionAudit.opened/closed, hospitalMembership.changed. Nomes definitivos fixados por W0; se diferente, documentar mapeamento antes de integrar.

## 7. Gates de qualidade e não regressão

**Cada Worker:** executar `npm run typecheck`, build quando tecnicamente suportado, testes do seu domínio; registrar log resumido, não inventar PASS. Em vez de apenas prints ou unit tests triviais, usar testes de comando/API, persistência, concorrência, permissão e componentes críticos. Não apagar falhas anteriores para simular verde.

**Gates transversais (W9):** autenticação, escopo cross-OM, cross-unit; paciente/internação; três ciclos; diferenças de 06:00/06:30, 10:00/10:30 e 16:00/16:30; alteração depois de fechamento; duplicidade concorrente e transferência; alergia/jejum; Nutrição sem bloqueio; preparo/expedição/entrega; contagens/relatórios reconciliados; indisponibilidade/contingência; portal e redirects; login/admin/empenhos/NF/Almoxarifado sem regressão.

**Saída GO/NO-GO:** GO de código para integração quando testes mínimos e proteção do módulo estiverem comprovados; **NO-GO para uso clínico/produção** até validação institucional, protocolos e avaliação de dados de saúde. Nunca afirmar que paciente real pode usar apenas porque CI passou.

## 8. Handoff padrão simples (cada PR Draft)

Incluir no corpo da PR **apenas informação útil**:

- Worker's `Wn`, missão concluída e interfaces/arquivos principais.
- Base original `W0_BASE_SHA` e HEAD atual.
- APIs/DTOs exportados, quem os consome, alterações contratuais necessárias.
- Testes e resultados reais; capturas apenas com dados sintéticos.
- Pendências de integração, decisões não tomadas, riscos e **GO/NO-GO**.
- Declaração objetiva: sem merge na main, sem deploy e sem dados reais.

**Ativação padronizada:** copiar a mensagem da seção 9 e substituir apenas o número de W0...W9.

## 9. Comando único de ativação (trocar **um único número**)

Copiar a mensagem abaixo e alterar **somente o dígito após W**. O Worker localizará o arquivo de seu próprio número, sem precisar escrever o nome do arquivo no pedido.

```text
/goal Você é o Worker W0 do EMPROVEX Cozinha Dietética. Acesse o repositório aprov-hgesm/Controles-de-Empenhos---Aprov, na branch docs/cozinha-dietetica-memorial-oficial-20261111, e localize em docs/cozinha-dietetica/workers/ o arquivo Markdown correspondente ao número do seu Worker. Leia esse prompt, o Plano Mestre e o Memorial Oficial, execute integralmente sua missão com código funcional e testes reais e abra PR Draft em branch isolada com SHA, handoff e GO/NO-GO. Não faça merge, deploy ou alterações produtivas.
```

**Ordem de ativação:** executar **W0 primeiro** (publicar contrato e W0_BASE_SHA); então **W1 a W8 podem trabalhar em paralelo**, cada um em seu próprio chat/branch; **W9** executa a integração depois que as entregas necessárias estiverem disponíveis. Os Workers não são tarefas agendadas nem executam sozinhos em segundo plano.

**Nenhum prompt concede permissão para acessar dados clínicos reais.** Apenas especifica código e testes em ambientes autorizados.
