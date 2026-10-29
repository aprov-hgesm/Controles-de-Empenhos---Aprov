# EMPROVEX — Release Normal/Essencial R3 — preparação da main e Vercel

**Data:** 29/10/2026 · **Estado:** CHECKLIST PRÉ-RELEASE, SEM PROMOÇÃO AUTOMÁTICA
**PR:** [#411](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/411) · **branch:** `feat/visual-mode-r1-session-navigation`
**Método obrigatório:** [EMPROVEX_RELEASE_POWERSHELL.md](../EMPROVEX_RELEASE_POWERSHELL.md)
**Coordenação:** GOV-SIMP-01 · **Fundador:** já conferiu a prévia visual e autorizou preparar a publicação.

## Escopo fechado

- Modo Essencial/Normal por sessão, navegação simplificada, Painel de carregamento progressivo e limpeza de efeitos fora do 3D.
- Fallback automático Essencial → Normal em falha visual detectável, sem logout/reload e sem relaxar gates.
- Carga sob demanda, proteção de identidade UID/UG e preservação de PDF de NF por NE.
- RAM R3: projeção de linhas do Painel em passagem única, mantendo **todos** os totais/filtros e limitando apenas o DOM de 60→120→... linhas no Essencial.
- Contratos de testes atualizados para o shell canônico `/login`, Firebase Emulator, métricas JS heap e preview interativo com dados sintéticos.

**Fora do escopo:** modificar banco real, Firestore Rules, modelos de cobrança, APIs de produção, motores de TR/PDF/NE/NF/NS/relatórios, integrações Drive/InfinitePay ou renderizador 3D.

## Provas verificadas ANTES da consolidação final

- [GitHub Actions #40960414624](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40960414624): **5 jobs Linux PASS** (documentos/NF/TR/Drive/Relatórios; Auth/Roles; Firebase Auth + Firestore Emulator; Warehouse/3D; Chromium E2E **12/12 PASS** incluindo baseline sintético de heap). Job Windows localhost **FAIL** por timeout de emulador 8081: **não é falha de prod Linux, não foi certificado**.
- [Fast CI #40960414611](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40960414611) PASS; Core Protection PASS, W4 visual/integridade e outros gates verificados no commit da auditoria.
- [SAAS-DL Legal #40960414614](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40960414614) FAIL **exclusivamente por quatro linhas com whitespace no arquivo `MODO_ESSENCIAL_AUDITORIA_SEGURANCA_R1_2026-10-29.md`**. Corrigido no commit `b00ca5eb0d573685abcf5f18821cc51c9db4a346`; exigir nova execução PASS.
- O workflow Windows de preview foi mantido disponível **apenas em disparo manual**, sem bloqueio da release Linux/Vercel, e conserva histórico de FAIL. Não anunciar Windows PASS.
- Captura inicial de heap via Chromium com dados fictícios; **não** equivale a memória RSS do Chrome de clientes ou ganho de 800 MB, que era amostra do Windows inteiro.

## GO de código / integração — pré-condições

1. Conferir `main` e `PR #411` para **HEAD final e divergência real**. A main incorporou dois checkpoints de memorial durante o desenvolvimento, já integralmente presentes no início do conteúdo da branch. Não atropelar alterações futuras. Não usar force push.
2. Sobre **o SHA de integração**, confirmar os jobs críticos: Fast CI/typecheck, Core Protection, Legal, Recovery, auditoria funcional Linux (5/5), W4 Visual QA, W4 Evidence e InfinitePay UI. Qualquer falha de funcionalidade/dados **NO-GO**.
3. Se GitHub disser conflito, resolver apenas os trechos realmente divergentes, preservar contratos e rerodar CI. NÃO retirar asserts de segurança ou modificar Rules para facilitar merge.
4. Depois do GO técnico e aceite humano, integrar uma única vez a PR #411 em `main` via squash (ou método aprovado pelo repositório) e registrar **SHA funcional completo (40 hex)** e URL do merge. O SHA da branch NÃO é SHA da main pós-squash.
5. A **main recém-integrada** deve passar smoke de build e teste crítico de pré-release. Divergência e documento não são autorização para promoção.

## ÚNICO deploy remoto, Vercel Hobby (proprietário executa no PowerShell autenticado)

`vercel.json` possui `git.deploymentEnabled=false`: merge não publica. **Não usar Vercel connector do ChatGPT (fora do escopo da equipe)**. Equipe: `aprov-hgesms-projects`; projeto: `controles-de-empenhos-aprov`; domínio: `https://emprovex.com.br`.

1. **Antes de iniciar**: proprietário roda `vercel.cmd inspect https://emprovex.com.br --scope aprov-hgesms-projects`; guarda ID do deployment atual para rollback e verifica que é Production/Ready.
2. Conforme [contrato canônico](../EMPROVEX_RELEASE_POWERSHELL.md), substituir o SHA da main no bloco de preparação e gerar clone limpo + `git archive` sem `.git`, no diretório `D:\EMPROVEX-RELEASE-<sha12>\deploy`. **Não usar a pasta `EMPROVEX-PREVIEW-ESSENCIAL`** com emuladores/arquivos locais.
3. Conferir equipe/projeto e apenas **nomes** das variáveis Production, incluindo `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` (não divulgar valor). Executar **uma vez**:
   ```powershell
   vercel.cmd project inspect controles-de-empenhos-aprov --scope aprov-hgesms-projects
   vercel.cmd link --yes --project controles-de-empenhos-aprov --scope aprov-hgesms-projects
   vercel.cmd env ls production --scope aprov-hgesms-projects
   vercel.cmd deploy --prod --skip-domain --archive=tgz --scope aprov-hgesms-projects
   ```
4. Guardar **URL/ID imutáveis** do novo staged, confirmar target production e status Ready:
   ```powershell
   $url = 'https://COLE_AQUI_A_URL_VERIFICADA.vercel.app'
   vercel.cmd inspect $url --scope aprov-hgesms-projects
   vercel.cmd curl /api/health --deployment $url --scope aprov-hgesms-projects
   ```
   Se já houver staged Ready, **não fazer deploy novamente**, apenas inspecionar.
5. Exigir smoke autenticado em workspace de QA: founder auth e `/api/central-depositos/health` protegido (`authenticatedFounder`, `adminAccessToken`, `warehouseTransaction`); negar anônimo; login externo/aceite/billing; seletor Normal↔Essencial; navegação sem erro; NF/arquivo por NE; relatórios/termo; Drive com conta QA; consulta de materiais; 3D e saída em lote sem alterar dados reais. Um simples `/api/health = ok` **não prova** operações.
6. **Somente após GO humano explícito**, promover o mesmo ID:
   ```powershell
   vercel.cmd promote $url --yes --scope aprov-hgesms-projects
   vercel.cmd inspect https://emprovex.com.br --scope aprov-hgesms-projects
   ```
   Comparar ID de produção com staged. Não reconstruir. Se falhar, inspecionar antes de repetir; manter deployment anterior para rollback.

## Saída obrigatória

Registrar em Memorial Oficial o SHA funcional da main, URLs/IDs Vercel antes/staged/depois, results dos testes específicos, status da promoção e eventuais limitações da homologação. **Não declarar publicação a partir de merge, push ou health isolado.** Zero Firestore Rules ou migrações neste release.

## Estado desta preparação

- Código de Essencial/RAM R3 implementado e testado em Linux com dados fictícios;
- Prévia visual aprovada pelo fundador;
- Check de whitespace de documentos corrigido; revalidação exigida;
- Windows Emulators local: diagnóstico pendente não bloqueante para Vercel Linux;
- **Release ainda não publicado**, aguardando commit final integrado e rito de staged/GO/promoção pelo PowerShell do fundador.
