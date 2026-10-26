# EMPROVEX /goal — Billing Server R1: memorial de migração e cutover

**Estado:** implementação em PR #396 DRAFT, não publicada. Nenhuma escrita em banco real, alteração de IAM ou Rules por este PR.

## Onde estamos / o que foi executado
- `lib/platformBillingStore.ts`: cliente não importa `firebase/firestore`; usa `/api/admin/billing`.
- `hooks/usePlatformAdminBilling.ts`: carrega diretório através da API e atualiza após comandos explícitos; removida migração de preços ao entrar na Administração.
- `app/api/admin/billing/route.ts`: valida Firebase ID token Google fundadora, e-mail verificado, requisições de tamanho limitado, cache desativado; bloqueia requisições sem identidade.
- `lib/server/platformBillingAdminStore.ts`: somente credencial de servidor IAM, banco nomeado definido no código, operações atômicas para config, trial, isenção, status, ciclo e auditoria.
- `scripts/billing-server-migration.test.mjs`: motor TypeScript real contra transporte REST simulado (sem produção), incluindo banco nomeado, cliente sem autorização, rollback, legado R$50, VIPs R$0, congelamento de ciclos.
- Compatibilidade: o portal setorial de assinatura conserva sua leitura restrita de `billingAccounts/{workspaceId}` via Firebase Rules; a consulta de `billingCycles` do portal já usa serviço no servidor.
- Preços e isenções existentes não mudam silenciosamente. A política de R$29,90 a R$69,90 permanece **fora** do faturamento automático até consentimento e contrato.

## O que NÃO fazer
1. **Não publicar `firestore.rules` do GitHub**: conteúdo difere do ruleset implantado no banco principal (V4).
2. **Não restringir Rules antes do deploy e smoke test autenticado da API**: isso impediria comandos da UI antiga.
3. **Não apagar BillingAccounts, BillingCycles, platformAuditEvents nem config**: dados históricos protegidos.
4. **Não reprecificar legado R$50 para R$70 automaticamente**. VIPs e fundador seguem isentos.
5. **Não fundir PR #392** (whitelist de price_migration) sem validação de escopo; novo motor não precisa dessa operação do navegador.
6. **Não alterar a Central 3D, Warehouse ou regras dos outros domínios**.
7. Evitar múltiplos builds na Vercel; conta Hobby pode ter limites de funções e deploys. Confirmar previamente a fonte imutável de produção; esta PR parte da `main`, não da snapshot da produção.

## Caminho de publicação controlada (a executar pelo fundador via PowerShell quando autorizado)
- Certificar GitHub Actions / testes Node / typecheck e equivalência de contratos.
- Validar no Emulator a identidade fundadora real Google, sector password negado e concorrência IAM, com banco nomeado simulado; mocks não equivalem a Emulator.
- Construir **snapshot de release isolado** sobre o commit efetivamente publicado em `emprovex.com.br`, transplantando somente os arquivos da migração após análise de conflitos. `main` e produção não são idênticos.
- Fazer um único deploy Vercel remoto `--prod --skip-domain --archive=tgz` e smoke autenticado no deployment staged, sem promover.
- Conferir GET e POST de cobrança, 3 VIPs isentos, config R$50, logs, status de todas as ações do painel e retorno ao workspace. Validar que a credencial `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` tem acesso ao banco correto. Se falhar, abandonar stage sem modificar produção.
- Promover a **mesma** URL imutável com `vercel.cmd promote ... --yes --scope aprov-hgesms-projects`. Nunca reconstruir só para promover.
- Após sucesso de API e observação funcional, consultar novamente a release de Rules publicada; gerar cópia e candidato de corte com **somente 5 restrições de escrita** em `platformBillingConfig`, `billingAccounts` e `billingCycles`. Manter `billingAccounts` leitura setorial e manter `platformAuditEvents` para outros fluxos que ainda dependem dele.
- Testar Rules candidatas no Emulator contra fluxos administrativo e setorial antes de publicar no database nomeado; fazer verificação pós-publicação e guardar rollback da release original.
- Não migrar / deletar documentos históricos; a mudança é de caminho de acesso.

## Quem faz o quê
- ChatGPT/GitHub: código, suite, PR, análise de CI, roteiro e candidato PowerShell sem alterações produtivas.
- Fundador/PowerShell: executar localmente testes, Vercel staged + promoção e publicação das Rules **somente depois** do GO de cada gate.
- Após validar: a interface não usa mais `billing.price_migration`, Firestore Rules são reduzidas **somente para os 3 namespaces de escrita financeira**, não globalmente.

## Gate de saída
- PASS CI + tipagem + testes reais E2E autenticados, fonte imutável e certidão de rollback.
- PASS staged autenticado, preços históricos sem mudança, VIPs 3/3 R$0, ZERO conflito de regras.
- PASS cutover Rules separado. Até lá: **NO-GO Rules e produção**.
