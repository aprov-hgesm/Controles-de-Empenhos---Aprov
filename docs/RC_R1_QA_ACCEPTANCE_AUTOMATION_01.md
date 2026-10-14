# EMPROVEX R1 — QA Acceptance Automation 01

**Data:** 14/10/2026
**Worker:** RC-R1-QA-ACCEPTANCE-AUTOMATION-01
**Branch:** `rc-r1-qa-acceptance-automation-01`
**Base congelada, jamais modificada:** `61e372225834ed6060cd2b36dbdd55d1e1979c2c`
**SHA funcional efetivamente certificado:** `72537ef8c37549cf42d7b0b5895d9faf9bde500d`
**PR:** [#285 — DRAFT](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/285)
**Classificação:** **PASS COM PENDÊNCIAS** para a bateria local; **Macroação 3/4 ainda NÃO concluída**.

## 1. Resultado executado, não presumido

- [QA Acceptance Emulators #38513065801 — SUCCESS](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/38513065801), vinculado ao SHA funcional acima: **5/5 jobs SUCCESS**.
- Job `isolation-and-contracts`: seis verificações de ambiente (inclusive cenários fail-closed), checks dos hashes produtivos, regressões F05 e MOBILE-K: **SUCCESS**.
- Job `warehouse-f05-f09-mobile`: persistência REST F05 no Firestore Emulator, segurança F09 e simulações de scanner/domínio móvel: **SUCCESS**.
- Job `warehouse-f06`: 9 testes F06 originais preservados + suíte adversarial com idempotência, concorrência e permissões em Emulator: **SUCCESS**.
- Job `saas-legal-multitenant`: aceite jurídico/versionamento e multiusuário multi-workspace via Firebase Auth/Firestore Emulators: **SUCCESS**.
- Job `acceptance-browser`: Chromium + Playwright **10/10 PASS, 49,2 s** em browser local contra serviços fictícios separados; ambiente Ubuntu 24.04, Node 22, Java 21, projeto `demo-emprovex-security`.
- [Core Protection #38513070398](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/38513070398): **SUCCESS** no mesmo SHA.
- [Application CI #38513070236](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/38513070236): consultar sua conclusão final; este relatório não presume SUCCESS antes do término.

**Atenção:** o commit de documentação que atualiza este relatório sucede o SHA funcional certificado e precisa de seus próprios checks. Resultado em HEAD anterior jamais equivale automaticamente a nova aprovação.

## 2. Arquitetura, isolamento e modificações

Foram auditados `scripts/e2e-browser-emulator.mjs`, `playwright.e2e.config.mjs`, as specs E2E anteriores, as fixtures sintéticas, `firebase.security-test.json`, `firebase.warehouse-e2e-test.json`, os repositórios F05/F06/F09 e MOBILE-K.

- Projeto sempre fictício `demo-emprovex-security`.
- Firebase Auth Emulator `127.0.0.1:9099`.
- Firestore principal Emulator `127.0.0.1:8080`.
- Warehouse Firestore Emulator `127.0.0.1:8081`, database `emprovex-warehouse`. **Não unificar instâncias.**
- Guard explícito rejeita projeto não demo, destino externo e token/credencial de deploy presente. Com `EMPROVEX_RC_R1_QA_GUARD=1`, a checagem ocorre ANTES das fixtures mutáveis do browser.
- No código produtivo e Firestore Rules: **zero alterações**; workflow valida os hashes conhecidos.
- Tudo foi executado em GitHub Actions com Emulators e registros sintéticos, não no Preview nem Production.
- Artefatos de falha contêm apenas dados fictícios; não armazenar cookies, credenciais reais nem identificadores operacionais.

## 3. Matriz P01–P24 reconciliada

A classificação **PASS LOCAL** indica apenas o recorte efetivamente exercitado em Emulators; **não corresponde a PASS de aceite remoto completo da linha**. A referência com critérios completos é [PR #281](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/281).

| Caso | Evidência após QA | Estado de aceitação global |
|---|---|---|
| P01 — health | PASS LOCAL Playwright: 200, `status=ok`, timestamp, `no-store` | BLOCKED no Preview protegido |
| P02 — termos e privacidade | PASS LOCAL: duas páginas renderizadas | BLOCKED no Preview protegido |
| P03 — sem sessão | PASS LOCAL: Home oculta dados e depósito protegido redireciona | PENDENTE verificação no Preview |
| P04 — founder login/logout | PASS HUMANO VISUAL PARCIAL anterior; navegador local founder autentica | PENDENTE logout/revogação Preview |
| P05 — login setorial | PASS LOCAL: válido, inválido, logout; autorização na suíte multiusuário | PENDENTE Preview com identidades autorizadas |
| P06 — isolamento de workspaces | PASS LOCAL: dois contextos independentes, fornecedores A/B segregados e regras Auth/Firestore | PENDENTE Preview, VIP e UG reais |
| P07 — aceite legal | PASS LOCAL: gate condicional na UI + suíte legal/versões no Emulator | PENDENTE registro/versão reais no Preview |
| P08 — Central Depósitos | PASS LOCAL: material/posição destacados, saldos de fixture lidos por REST; PASS HUMANO VISUAL PARCIAL de depósitos/3D | PENDENTE conferir autoridade Firestore do Preview |
| P09 — F05 alocação | PASS LOCAL backend persistência REST; não houve jornada UI completa P09 nova | PENDENTE Preview com dados fictícios e isolamento aprovado |
| P10 — F05 replay | PASS LOCAL idempotência/colisão; **replay histórico sem `intent:` retorna 409 fail-closed** | PENDENTE compatibilidade UX e Preview |
| P11 — transferência F06 | PASS LOCAL F06 original sob Emulator | PENDENTE UI/Preview autenticado |
| P12 — concorrência F06 | PASS LOCAL original + adversarial, incluindo mesma/diferentes chaves | PENDENTE concorrência operacional Preview |
| P13 — F09 saída | PASS LOCAL segurança/repository e domínio móvel; sem validação completa UI+lote+ledger neste worker | PENDENTE operação Preview autorizada |
| P14 — inventário | PASS LOCAL testes de domínio móvel; E2E histórico disponível, sem nova jornada completa TOTAL+posição na aceitação | PENDENTE inventário TOTAL físico/Preview |
| P15 — consulta/conferência móvel | PASS LOCAL somente navegação portal e links de jornadas | PENDENTE consulta e conferência efetivas |
| P16 — Code128 físico | Não simulado como físico | PENDENTE dispositivo e etiqueta <=35 mm |
| P17 — câmera | Não testada em dispositivo real | PENDENTE Android Chrome, concedida/negada/fallback |
| P18 — double scan/cooldown | Regressões de scanner sintéticas; não confirmadas opticamente | PENDENTE dispositivo real |
| P19 — offline/online | Sem teste de rede real e replay de operação móvel | PENDENTE teste humano controlado |
| P20 — desktop/celular simultâneos | Não comprovada reconciliação real com ledger entre aparelhos | PENDENTE ambiente e dispositivos autorizados |
| P21 — responsividade e velocidade | PASS LOCAL viewport 390×844, sem overflow horizontal | PENDENTE PC/Android reais e métricas |
| P22 — Safari iPhone | Chromium Linux não representa Safari iOS | PENDENTE físico, se disponível |
| P23 — saúde/recuperação | PASS LOCAL health e gates anteriores; sem restore | BLOCKED saúde Preview / plano de rollback real |
| P24 — custo, retries e leituras | Não aferidos no billing real; tempos de Emulator não representam p50/p95 produtivos | PENDENTE instrumentação Macroação 4 |

**Não existe autorização para marcar 24/24 PASS.** Casos P03/P05/P06/P09–P14/P16–P20 continuam gates de aceitação global.

## 4. Falhas, reprodução, gravidade e correção

O primeiro workflow ampliado [#38512275760](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/38512275760) resultou **7 PASS / 3 FAIL** no Chromium, com quatro jobs de domínio verdes.

| Falha inicial | Causa observada | Correção restrita ao teste | Estado |
|---|---|---|---|
| P06 — 45 s, `sector-login-email` ausente após troca de usuário | Dois logins em série no mesmo contexto/browser geraram estado de sessão inadequado para a prova de isolamento | Dois `browser.newContext()` independentes, A e B simultâneos | PASS 10/10 no reteste |
| P08 — 20 s sem navegação founder após login | Teste não contemplava possível gate de aceite legal do founder | Aceitar legal apenas quando exigido, antes da navegação | PASS no reteste |
| P15/P21 — rota móvel redirecionava para login | Cenário tentava rota protegida sem autenticação | Autenticar founder sintético antes de abrir `/central-mobile` | PASS no reteste |

**Gravidade:** baixa para os três defeitos de harness; não há evidência para classificar como defeito produtivo. Arquivo responsável: `tests/e2e/rc-r1-acceptance.spec.mjs`. Nenhuma lógica da aplicação foi alterada. Os `PERMISSION_DENIED` dos testes adversariais são esperados e não foram tomados como erro novo.

**Risco conhecido, não corrigido nesta missão:** F05 replay legado sem `intent:` devolve 409 e não cria segunda movimentação, mas pode requerer tratamento operacional assistido. Não declarar compatibilidade UX aprovada.

## 5. Pendências que o Fundador precisa testar

Somente após comprovada separação dos bancos Preview/Production, integridade das Rules e autorização específica: (1) autenticação e logout real (Founder e setorial), aceite legal/versionamento e verificação visual dos registros de depósito; (2) jornadas com dados fictícios em workspace descartável para F05/F06/F09/inventário, medindo saldos e ledger antes/depois; (3) no smartphone real: Code128 impresso, câmera permitida/negada, double-scan, cooldown, fallback e modo offline/online; (4) comparação simultânea desktop/móvel; (5) responsividade e tempos no PC/Android; (6) Safari iPhone se disponível. Não executar testes mutáveis nos workspaces externos reais.

## 6. Limitações e bloqueios externos

- Separação banco Preview versus Production **não comprovada**, portanto testes remotos mutáveis **BLOCKED**.
- Sondagem não autenticada ao Preview recebeu 401/302 anteriormente: não contornar Vercel Authentication; o login humano anterior foi bem sucedido, contextos distintos.
- Health e termos só passaram localmente; a visibilidade pública no Preview está por comprovar.
- Emulators não demonstram latência da internet, leituras faturáveis no Firestore ou câmera óptica real.
- Não houve deploy, merge, publicação de Rules, cobrança, suspensão, repair ou alteração de `main`.

## 7. Handoff obrigatório

**ONDE ESTAMOS:** Macroação 3/4. PR #285 DRAFT; RC `61e372225834...` intacto. Bateria local **PASS COM PENDÊNCIAS**, aceitação Preview/física não encerrada.

**O QUE ESTAMOS FAZENDO:** Finalizamos guard fail-closed, fixtures reutilizadas, 10 E2E Playwright 10/10, 4 suites adicionais de backend e segurança, correção de harness e reconciliação da matriz.

**QUEM ESTÁ FAZENDO:** Worker RC-R1-QA-ACCEPTANCE-AUTOMATION-01, exclusivamente testes sintéticos locais/Emulator.

**O QUE FAZER A SEGUIR:** Conferir gates do novo HEAD documental, auditar PR e logs, conciliar este relatório com o Memorial Oficial sem alterar o freeze; depois certificar isolamento Preview/Production ANTES de liberar qualquer teste remoto mutável.

**QUEM FARÁ:** Worker fornece evidências e handoff; Coordenador audita/atualiza `docs/EMPROVEX_MEMORIAL_OFICIAL.md` na branch de coordenação e conduz a decisão; Fundador realiza apenas testes físicos e humanos autorizados.

**Resultado:** **PASS COM PENDÊNCIAS** para esta missão de automação local. **Não é GO de Production e não conclui Macroação 3/4.**
