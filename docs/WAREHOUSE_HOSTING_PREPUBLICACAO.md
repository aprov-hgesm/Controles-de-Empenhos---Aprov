# EMPROVEX — Checklist seguro de hospedagem antes da publicação

**Estado:** preparado em código, NÃO implantado. O conector Vercel do ChatGPT possui 403 para a equipe proprietária, mas **isso não bloqueia o procedimento já utilizado pelo Fundador**, por PowerShell autenticado em `aprov-hgesms-projects`. Procedimento canônico: `docs/EMPROVEX_RELEASE_POWERSHELL.md`.

## Implementado no RC

- Proteção de servidor: `LEDGER_MOVEMENT` genérico bloqueado com HTTP 403 antes de qualquer operação de estoque; a única via de ledger interno é Marco Zero SISCOFIS com prefixo verificável e `INITIAL_BALANCE`; demais motores especializados continuam disponíveis.
- `GET /api/central-depositos/health` protegido pela sessão Firebase do fundador. Em ambiente real, tenta obter token OAuth com a credencial administrativa e faz transação **read-only** no banco nomeado `emprovex-warehouse`. Retorna somente estados booleanos ou erro 503, não retorna credenciais, token, e-mail de conta de serviço, documentos nem conteúdo do Firestore.
- Em CI o health usa exclusivamente `demo-emprovex-security`/Emulator. Resultado PASS localhost não atesta credenciais Vercel reais.
- `vercel.json` contém `git.deploymentEnabled = false`: sem deploy automático com push ou PR.

## Acesso e segredo (ação do proprietário na equipe certa)

1. Operar com PowerShell autenticado na equipe proprietária `aprov-hgesms-projects`. Não é necessário conceder ao ChatGPT acesso adicional à Vercel. Confirmar projeto **controles-de-empenhos-aprov**; não criar projeto alternativo nem alterar produção por tentativa.
2. Conferir a existência de **FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON** no ambiente **Production** que será usado para criar um deployment staged sem domínio. É variável *server-side*; não usar `NEXT_PUBLIC_`, não salvar no repositório e não imprimir conteúdo em logs. Usar a interface segura da Vercel para inserir/rotacionar o valor, sem colar chaves nesta conversa.
3. A identidade administrativa deve ser do projeto definido em `firebase-applet-config.json`, com direitos **mínimos suficientes** no database `emprovex-warehouse` e, para operações de setor, acesso às APIs Firebase Auth/Identity Toolkit necessárias para custom claims. Revisar privilégios com administrador Google Cloud; usar conta exclusiva e rotação de chaves.
4. Garantir que **EMPROVEX_E2E_SERVER_AUTH**, **EMPROVEX_WAREHOUSE_ADMIN_EMULATOR**, **NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS** não estejam ativadas na hospedagem real.

## Validação staged (sem publicar domínio)

1. Após revisão de código e CI completo, o operador pode inspecionar sem imprimir segredos: `vercel project inspect controles-de-empenhos-aprov --scope aprov-hgesms-projects` e `vercel env ls production --scope aprov-hgesms-projects`.
2. Criar deployment de produção **sem domínio**, a partir do commit revisado: `vercel deploy --prod --skip-domain --scope aprov-hgesms-projects`. A etapa requer autorização da conta proprietária e **não é executada automaticamente**.
3. Testar o deployment protegido: chamar `GET /api/central-depositos/health` com ID token Firebase do fundador no header `Authorization: Bearer ...`, sem logar ou publicar o token. Aceitar só HTTP 200 com `checks.adminAccessToken=true` e `checks.warehouseTransaction=true`. HTTP 503 é NO-GO. Verificar que anônimos são rejeitados.
4. Smoke funcional em workspace isolado de QA: login, NF/alocação, saldos, lotes/FEFO, transferência, retirada, devolução e inventário; validar permissões e isolamento UG. Não usar dados da operação real. Testar correção do 409 para saldo insuficiente e rollback operacional.
5. Confirmar equivalência das **Rules candidatas** e a sequência correta de publicação do motor antes do corte. Rules de produção permanecem intactas até o backend estar validado e houver autorização expressa.
6. Promover exatamente o staged testado para `emprovex.com.br` somente após GO operacional e aprovação explícita. Deixar plano de rollback com URL/ID do deployment e versão das Rules anterior.

## Limites

- O endpoint de preflight **não grava** no banco e não prova que IAM possui todas as permissões de escrita; por isso o smoke funcional em workspace isolado é obrigatório.
- A devolução E2E atual utiliza um registro de consumo semeado no Emulator, não representa retirada finalizada de ponta a ponta; prova adicional ainda necessária para esse subfluxo.
- O caminho legado `ensureWarehouseIntakeEntryContext` não deve ser reutilizado até migração para comando especializado; o endpoint público de ledger genérico está bloqueado.

**Handoff:** onde — RC #349; fazendo — consolidar main por squash único; quem — executor GitHub; próximo — prebuild via PowerShell proprietário, staged, teste IAM e promoção; quem — Fundador no PowerShell e executor no GitHub.
