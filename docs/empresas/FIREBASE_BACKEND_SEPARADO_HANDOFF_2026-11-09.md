# EMPROVEX Empresas — integração Firebase independente (checkpoint de código)

**Projeto novo do titular:** `emprovex-empresas`. **Firestore:** `(default)` com Rules `allow read, write: if false;` confirmado em captura de console; Auth Email/Senha ligado; sem usuários cadastrados.

## Entregue na branch isolada
- `companyAuth` no Firebase Web separado e tela `/entrar-empresa`, sem reutilizar a autenticação do sistema militar.
- Guards de Auth empresariais usam JWT com issuer/audience fixos do projeto novo; emuladores `demo-*` com modo seguro preservados.
- Diretório, perfis, membros, provisionamento e os stores W1–W11 (clientes, fornecedores, compras, estoque, entregas, documentos, financeiro e rotas) apontam ao **Firestore novo**.
- Transportes Firestore não dependem de `firebase-applet-config.json` nem usam fallback de credenciais do serviço militar. O token privilegiado só pode ser obtido da identidade **Cloud Run da implantação empresarial**.
- APIs empresariais só podem ser ativadas em produção com `EMPROVEX_COMPANY_ISOLATED_RUNTIME=1`, `EMPROVEX_COMPANY_RUNTIME_PROJECT_ID=emprovex-empresas` e flag piloto; na implantação principal a flag permanece OFF.
- O schema de workspaces `workspaces/`, `platformAccounts/`, índices e `supplierCompanyWorkspaces/` permanece o mesmo, mas o banco vazio **não tem ainda usuários/workspaces**; nenhum dado militar é copiado.
- Fiscal WLG/NF-e continua 503, sem segredos e sem emissão.

## Bloqueios operacionais obrigatórios antes de conectar a um usuário real
1. Criar serviço **Cloud Run empresarial separado** no projeto `emprovex-empresas`, com conta de serviço dedicada e IAM de privilégio mínimo para Firestore e os recursos empresariais; não reutilizar a identidade do Cloud Run militar. No Spark ainda não é possível subir Cloud Run sem avaliar billing Blaze. Somente usuário autorizado pode configurar IAM/faturamento.
2. Definir `EMPROVEX_COMPANY_ISOLATED_RUNTIME=1`, `EMPROVEX_COMPANY_RUNTIME_PROJECT_ID=emprovex-empresas` e, para QA isolado, `EMPROVEX_COMPANY_PILOT_ENABLED=1` **exclusivamente no serviço separado**. Verificar kill switches e não alterar variáveis do serviço principal.
3. Aplicar restrições de roteamento para que essa instância não exponha rotas administrativas/setoriais, e servir somente login empresarial, `/empresa`, `/api/company/**` e assets necessários; URL inicial isolada. Não rotear `emprovex.com.br/empresa` antes de validar controles.
4. Configurar bootstrap de uma única empresa/usuário com Auth novo, Firestore novo, índices e vinculação UID/CNPJ **por fluxo administrativo próprio e auditado**. O provisionamento atual de fundador usa o Firebase Auth do projeto principal para verificar o administrador: **não deve ser simplesmente exposto no serviço empresarial**. É preciso separar um plano de controle que autorize provisionamento sem conceder acesso aos dados militares. Contas criadas no console isoladamente NÃO bastam para receber acesso.
5. Verificar region/edition do Firestore, orçamento, quotas/limites e que projetos e identidades realmente são distintos; testar regras `deny all` para cliente e IAM para servidor.
6. Executar Auth/Firestore Emulator e Playwright para login, navegação, troca A/B, revogação, tentativas cross-project, administração principal e mobile. Teste live somente com dados sintéticos e autorização explícita.
7. Guardar documentos empresariais em bucket próprio `EMPROVEX_COMPANY_DOCUMENTS_BUCKET`, caso o módulo W5 seja habilitado; nunca usar o bucket principal.
8. Conferir CI por **SHA exato** da PR Draft; não afirmar certificação até resultados publicados. Sem merge, deploy e sem alteração em dados reais.

## Gate operacional
- **GO** somente para revisão do código isolado e testes demo-* em CI.
- **NO-GO** para acesso empresarial live, criação produtiva de contas, piloto público, merge/deploy, ou migração de dados até concluir configuração do serviço/IAM, bootstrap e homologação no navegador.
- **Rollback:** fechar PR; nenhuma alteração em `main` ou no Cloud Run principal.

Este documento registra o limite do que é possível pelo GitHub nesta sessão; não confundir configuração do código com criação de credenciais/IAM ou deploy real.
