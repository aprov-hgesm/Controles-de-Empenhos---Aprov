# EMPROVEX Empresas — W10 Etapa V — Worker único de estabilização pré-homologação

**Registro:** 08/11/2026  
**Natureza:** prompt oficial de execução, ainda não executado por este registro documental.  
**Base:** W10 Etapa IV PR #530; **último HEAD de referência:** `f84db403a295a4d590dfd246fcc8ba52d06f2c61`.  
**Estado desejado:** nova branch, UMA PR Draft de código, regressões e QA isolado — sem merge/deploy/produção.

## Prompt para ativar o Worker único (copiar integralmente)

```text
/goal Você é o WORKER ÚNICO W10 — ETAPA V: ESTABILIZAÇÃO PRÉ-HOMOLOGAÇÃO do EMPROVEX Empresas.

MISSÃO
Execute efetivamente UMA RODADA CONSOLIDADA de correções de segurança, integridade operacional, bugs de integração, usabilidade e refinamento visual do EMPROVEX Empresas, a partir da versão W10 Etapa IV. Trabalhe em branch exclusiva, faça alterações reais com testes reais, abra UMA PR Draft e entregue handoff com evidências e GO/NO-GO. NÃO basta apresentar diagnóstico ou plano. Não faça merge, deploy, habilitação de piloto, emissão fiscal real, alterações produtivas nem modificações militares. Minimizar burocracia; priorizar correções comprováveis e reversíveis.

REPOSITÓRIO E BASE OBRIGATÓRIA
- Repositório: aprov-hgesm/Controles-de-Empenhos---Aprov.
- Fonte de verdade de integração: PR #530, branch integration/emprovex-empresas-w10-stage4-w15-fiscal-20261106, HEAD de referência f84db403a295a4d590dfd246fcc8ba52d06f2c61.
- Bases/handoffs ancestrais: W10 Etapa III #527 (d9aa77a5e0c27b77582ecf6742a3358a509e8abb); W10 Etapa II #525 (49c8670a66ad858724454eff0683696dcb7efcd3); W15 #529 (65faaefacfb182e36111197fa578a6418caff068); W12 #521, W13 #522, W14 #526, W9 #523, W11 #524 e W0–W8.
- Leia o Memorial Oficial na PR #510, o handoff da #530 docs/empresas/W10_ETAPA_IV_HANDOFF_2026-11-06.md e os handoffs W10-III, W15, W9, W11 e W1.
- Consulte o HEAD ATUAL, os checks, a base, os diffs, os PRs abertos e o estado de main ANTES de começar. SHAs acima são referências históricas, nunca autorização para ignorar mudanças posteriores.
- Crie branch por exemplo integration/emprovex-empresas-w10-stage5-hardening-prehomol-20261108 a partir do HEAD mais recente de #530. Abra UMA PR Draft baseada na branch W10-IV, preservando a #530 e o trabalho dos demais workers. NÃO criar implementação paralela ou cherry-pick dos módulos já herdados.
- Esta tarefa não inclui publicação, contratação/autorização WLG, migração de produção ou habilitar endpoints fiscais de emissão.

CRITÉRIO DE VERDADE
Há achados identificados por leitura estática de código e lacunas de QA. Distinga em seu relatório: (A) defeito confirmado por reprodução/teste, (B) inconsistência confirmada pela implementação, (C) hipótese/risco a investigar, (D) dívida técnica/visual. NÃO alegue incidente real, exfiltração ou regressão em produção sem prova. Comece reproduzindo os problemas, escreva regressões antes ou com cada correção e registre a evidência por arquivo/linha e teste. Se um achado não se confirmar, explique e não altere código desnecessariamente.

P0-01 — SELEÇÃO MULTI-CNPJ E EXPIRAÇÃO DO COOKIE / TROCA DE TENANT
Arquivos: lib/company/profiles/selection.mjs; lib/server/companyProfiles/integration.ts; lib/server/companyAuthz/index.ts; lib/server/companySession.ts; app/api/company/session/route.ts; app/api/company/profiles/**; lib/company/companySessionClient.ts; components/company/CompanySessionGate.tsx; features/company/profiles/CompanyProfileSwitcher.tsx.
Problema: cookie __Host-emprovex-company-profile expira em 600 s; quando ele deixa de ser enviado, verifySelectedCompanySession utiliza base.workspaceId sem indicação ao cliente, embora a UI possa continuar exibindo um CNPJ diferente. Validar risco com Auth/Firestore Emulator e navegador, incluindo aba B aberta por >10 min, reload, aba concorrente, revogação, 401/403/503, rascunho pendente e perda/expiração do cookie.
Corrigir SEM ampliar permissões: impedir troca silenciosa de tenant; amarrar sessão de UI, seleção e toda leitura/mutação ao mesmo workspace validado server-side; checar explicitamente o workspace esperado quando aplicável, nunca aceitar workspace/CNPJ do navegador como autorização. Escolher estratégia segura e prática (revalidação/renovação controlada ou exigência de nova seleção e bloqueio de requests na mudança); manter compatibilidade com conta empresarial legada de um único workspace. Não permitir que um cookie ausente, expirado, adulterado, CNPJ de outra empresa ou profile revogado abra acesso à empresa errada. Invalide estado assíncrono/cache entre A e B e proteja requisições em voo. Reavalie possível estado ambíguo entre abas compartilhando cookie.
GATE: após expiração/switch, nenhuma operação vai ao workspace diferente do exibido/confirmado e nenhum dado de A aparece na UI de B.

P1-02 — REVALIDAÇÃO DE SESSÃO NÃO DESTRUTIVA E CONSISTÊNCIA DO ESTADO CLIENTE
O listener de focus de CompanySessionGate muda gate para checking e desmonta o portal a cada retorno, potencialmente apagando formulários W1–W15. Revalidar sem desmontagem arbitrária, preservando rascunhos SOMENTE enquanto o UID, o workspace e a permissão permanecem os mesmos; bloquear/limpar imediatamente após revogação, logout ou troca de CNPJ. Não persistir rascunhos fiscais/dados pessoais em localStorage para contornar o problema. Usar controle de geração e AbortController, evitando race conditions e respostas tardias. Testar troca de aba, minimizar/retornar celular, foco, login expirado e atualização concorrente.

P1-03 — COERÊNCIA ENTRE ENTREGA W9 E PEDIDO W1
Inspecionar lib/company/delivery/service.ts, domain.mjs, store.ts, integrações W1 customerOrders/commitments, W7 allocations/stockEvents e W8 Finance. Descobrir fonte canônica de fulfilledQuantity, dispatched e deliveredQuantity. Reproduzir o caso de entrega parcial, total, recusa, devolução e concorrência; distinguir comprovante logístico de atesto/baixa financeira. Se confirmado gap W1↔W9, implementar reconciliação transacional idempotente ou projeção consistente que reflita corretamente o total atendido, com CAS e guardas por linha/pedido. Sem segundo ledger nem atualização cega; evitar contagem dupla, sobreentrega, estorno indevido, duplicação por replays e leitura cruzada entre empresas. Caso domínio exija separação entre entregue fisicamente e contabilizado, tornar os indicadores e estados explícitos e documentar, sem falsificar fulfilledQuantity. Testes Auth/Firestore Emulator reais A/B e eventos repetidos.

P1-04 — CNPJ NUMÉRICO / ALFANUMÉRICO SEM PERDA OU AUTORIZAÇÃO INDEVIDA
Investigar compatibilidade entre lib/company/profiles/core.mjs (suporte alfanumérico), lib/company/fiscal/wlg/index.mjs (apenas dígitos), features/company/fiscal/flow.mjs, FiscalIssuanceWorkspace.tsx e formatações/contratos. Verificar padrão oficial vigente da Receita Federal, algoritmo de dígito verificador, regras de representação, validação da WLG e compatibilidade com SEFAZ, SEM presumir suporte WLG a CNPJ alfanumérico. Centralizar normalização/validação segura para identidade e exibição, nunca descartar letras, nunca inventar conversão para 14 dígitos. Onde o provedor fiscal não comprovar suporte, manter bloqueio claro e amigável de emissão, sem impedir acesso legítimo à plataforma. Testar numérico válido/inválido, alfanumérico válido/inválido, mudança de CNPJ, binding WLG e tenant A/B.

P1-05 — CONTRATO UI W15 ↔ MOTOR W14 E GATES FISCAIS
Examinar componentes/company/fiscal/FiscalIssuanceWorkspace.tsx, features/company/fiscal/{api,flow}.mjs, lib/company/fiscal/issuance/index.mjs, app/api/company/fiscal/nfe/route.ts, app/api/company/fiscal/connections/route.ts e W5 armazenamento privado.
Reconciliar contrato simplificado de create_draft com o motor W14 (payload fiscal validado, pedido W1, campos tributários, revisão e aprovação em etapas), inclusive incompatibilidade série 0 no frontend versus série >=1 no motor. O formulário precisa permitir revisar informações reais sem sugerir que campos insuficientes são NF-e válida. Não habilitar POST real, não desbloquear /api/company/fiscal/nfe (503 deve permanecer enquanto faltarem dependências), não usar 202 como autorização, não afirmar XML/DANFE verificados sem assinatura/protocolo/armazenamento. Se UX permitir preparação local de intenção, deixar status 'não enviado/não salvo' inequívoco. Normalizar mensagens de HTTP 503 e 409 e nunca permitir retry automático de envio desconhecido.
Fortalecer store fiscal: firestoreStore.mjs deve reconstruir e conferir chave de reserva (companyId+issuerCnpj+environment+series+number) a partir dos dados imutáveis do registro, não aceitar apenas prefixo livre, com testes de chave divergente, reuso, CAS e cross-tenant.

P1-06 — SELETOR GLOBAL DE EMPRESA MOBILE E ACESSIBILIDADE
Hoje CompanySessionGate.tsx renderiza CompanyProfileSwitcher apenas em lg; existe outro na tela fiscal, inclusive no desktop com o mesmo id='emprovex-company-profile'. Disponibilizar seleção da empresa ativa em todas as páginas tanto desktop quanto mobile; escolher uma montagem global única e eliminar duplicação de IDs/labels. Caso a tela fiscal precise de indicação adicional, mostrar identidade ativa em modo somente leitura, não segunda seleção. Cumprir WCAG: label, aria, foco, teclado, anúncio de mudança, contraste, botões de toque confortáveis e drawer responsivo. Não fazer switch otimista antes da autorização do servidor.

P2-07 — MODO ESSENCIAL, MAPAS E ABAS
O toggle no cabeçalho não chega ao RoutingWorkspace e MapLibreView recebe essential=false por padrão, contrariando a preferência. Passar modo por estado/contexto explícito (sem duplicar toggle) e impedir carregamento de assets/tiles no Essencial. Verificar limpeza ao alternar modos, manter lista textual acessível e planejamento manual funcionando. Respeitar prefers-reduced-motion; sem CDN não auditado, tiles OSM públicos abusivos ou chave de terceiros. Testar desktop/mobile, volta de sessão, mapa indisponível, modo normal e Essencial.

P2-08 — EXPERIÊNCIA VISUAL/UX PREMIUM SEM REDESENHO DESNECESSÁRIO
Inspecionar app/empresa/**, components/company/**, features/company/**, CompanyNavigation, CompanyFeedback, W15 FiscalIssuanceWorkspace, W8 FinanceWorkspace, W11 RoutingWorkspace, W9 DeliveryWorkspace. Comparar tokens, espaçamentos, tipografia, semântica, responsividade, vazios/loading/error, disabled, contrastes, feedback de ações e estados.
- Remover/desambiguar cabeçalhos repetidos em Notas Fiscais; manter separados Fiscal W15 e registros financeiros manuais W8, sem confusão 'NF emitida' versus 'NF lançada'.
- Simplificar a longa jornada fiscal mobile com seções/etapas progressivas (identidade → dados → revisão → status) e feedback contextual, sem esconder dados nem aceitar clique de emissão indevido.
- Padronizar raios, botões, inputs, tabelas, banners de aviso, textos e acessibilidade pelos padrões existentes; estilo contemporâneo e profissional sem dependências pesadas, efeitos excessivos, animações invasivas ou alteração na marca.
- Remover nomenclaturas internas W10/W14/W15, flags e IDs técnicos das mensagens voltadas ao cliente quando não são úteis; manter detalhe técnico disponível em diagnóstico e logs sanitizados.
- Atualizar copy defasada da homepage e rotas: não informar que candidatos/W9/W11 estão ausentes quando já integrados; tampouco prometer emissão fiscal real, relatório completo ou função ainda desligada.
- Avaliar carregamento dinâmico/lazy de módulos custosos, recorte por seção e responsividade horizontal onde realmente comprovado problema. Medir ou comparar build/client bundle antes/depois quando possível.
- Capturar telas REAIS de navegador com viewport desktop, tablet e smartphone, modo claro/escuro quando existente, e registrar evidências acessíveis. Não gerar mockups/screencaps artificiais para simular teste.

P2-09 — DATAS, QUANTIDADES, FUSOS E FORMULÁRIOS
Fazer revisão dirigida de formatadores, inputs datetime-local, parse de ISO UTC, conversões decimais, centavos de BRL, janelas de recebimento, virada de dia, rejeição de NaN e fuso brasileiro. Não reescrever todos os domínios; corrigir apenas defeitos reproduzidos e proteger com regressão. Validar mensagens úteis de erro. Verificar formulários com requisições concorrentes e ausência de cancelamento nas páginas W8/W11, sem alargar a missão para serviços externos.

P0 DE SEGURANÇA INEGOCIÁVEL
- Preservar separação empresa↔setor militar e empresa A↔empresa B, validações live UID, email verificado, perfil ativo, role/capability e recurso; nunca confiar no body/localStorage/CNPJ para grants.
- Manter EMPROVEX_COMPANY_PILOT_ENABLED OFF por padrão; manter emissão WLG/SEFAZ, cadastro comercial de 2º CNPJ, XML/DANFE e cancelamentos desligados. Não alterar IAM, Firestore Rules, Secret Manager, Cloud Run, Firebase Hosting, permissões reais, banco produtivo ou dados reais.
- Não tocar Almoxarifado, Warehouse, Aprovisionamento, Eleonor, billing nem interfaces militares. Sem migração de produção e sem novo ledger.
- Sem criar credenciais, tokens ou material fiscal real. Qualquer requisição à WLG/SEFAZ deve ser proibida por padrão e substituída por fixtures/mocks de QA. Legal e comercial WLG são trabalho externo para momento posterior.
- Evitar regressões por transformação ampla: alterações mínimas em componentes compartilhados; toda mudança transversal requer demonstração de que sessões militares permanecem isoladas.
- Não declarar 'sem vulnerabilidades' por CI verde. Se algum risco não puder ser resolvido com segurança, preservar bloqueio e registrar NO-GO localizado.

CERTIFICAÇÃO REAL OBRIGATÓRIA
1. Levantar baseline no HEAD da #530 e rodar testes relevantes antes de mudanças, sem tomar relatórios antigos como prova do novo HEAD.
2. Testes de regressão para cada correção: expiração de perfil (600s), restauração/negação de sessão, A/B, duas abas, revogação, ação pós-foco, isolamento de formulário, member A/owner B, cookies adulterados, fluxo API real em Emulator.
3. Auth+Firestore Emulator REAL projeto demo-* em loopback para multi-CNPJ, W1/W9/W7, CAS, replay, reservas fiscais e suspensão/revogação; não substituir por puro mock JS nem enviar token demo a serviços reais.
4. Suítes W0–W15 aplicáveis, W10-II/III/IV, W15 22/22, W14 38/38 e novos testes deste Worker; npm ci, npm run typecheck, npm run build e proteções Core/Fast/Visual-R2/R1 Sync aplicáveis. Reexecutar no SHA FINAL.
5. Criar/rodar Playwright E2E empresarial autenticado com Firebase Auth/Firestore Emulator para desktop e mobile, ao menos: login, identidade, switching 2 CNPJs, 10min cookie, foco, revogação, navegação, formulário W15 bloqueado, W8, W9/W11, modo Essencial e acesso por teclado. Caso não haja harness de navegador viável, sinalizar explicitamente 'PENDENTE' e NO-GO para homologação visual concluída; NÃO marcar PASS ou inventar prints.
6. Auditoria de dependências e build apenas local/CI; sem atualizações indiscriminadas de versões maiores de Next/React/Tailwind e sem novas bibliotecas ou componentes pesados sem necessidade e prova de compatibilidade.
7. Registrar matriz PASS/FAIL/SKIPPED/PENDING por teste e link do workflow do HEAD exato. SKIPPED ≠ PASS. Registrar evidência/linha do código para bugs reais e screenshots apenas se capturados de execução legítima.

ENTREGA
- Abrir UMA PR Draft com título sugerido "fix(empresas W10-V): estabilização pré-homologação, multi-CNPJ, fluxo e UX".
- Nova branch exclusivamente a partir da #530; NÃO empurrar mudanças diretamente para a #530, #510 nem main; não mesclar PRs.
- Criar docs/empresas/W10_ETAPA_V_HANDOFF_PRE_HOMOLOGACAO_2026-11-08.md na branch da nova PR com: baseline, arquivos modificados, antes/depois de cada item P0/P1/P2, bug reproduzido ou hipótese descartada, contratos protegidos, testes e links, dados QA usados (sem segredos), capturas reais quando disponíveis, pendências, SHA final, plano simples de rollback.
- Parecer separado e inequívoco: GO/NO-GO para (i) revisão técnica isolada; (ii) iniciar homologação controlada no Emulator/navegador; (iii) produção/comercial WLG/SEFAZ (deve continuar NO-GO até autorizações independentes).
- Documente achados remanescentes sem criar novas rodadas de burocracia. Se tudo puder ser resolvido em uma PR, resolva e teste nesta PR.
- Execute agora o código e os testes. Não faça somente um relatório. SEM MERGE E SEM DEPLOY.

VALOR FINAL: uma única PR Draft de correções efetivas, com isolamento empresarial preservado, UX profissional e regressões reais, pronta para revisão antes da homologação.
```

## Referências
- [Memorial Oficial Empresas](../EMPROVEX_EMPRESAS_MEMORIAL_OFICIAL.md)
- [W10 Etapa IV — PR #530](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/530)
- [W10 Etapa III — PR #527](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/527)
- [W15 — PR #529](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/529)
- [W9 — PR #523](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/523)
- [W11 — PR #524](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/524)

**Nota:** este commit cria instruções documentais. A execução técnica, testes e uma nova PR pertencem ao Worker a ser ativado.