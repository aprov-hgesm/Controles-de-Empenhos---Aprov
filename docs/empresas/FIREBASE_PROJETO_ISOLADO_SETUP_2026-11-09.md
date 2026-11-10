# EMPROVEX Empresas — novo Firebase independente | preparação técnica

**Projeto criado pelo titular no console:** `emprovex-empresas` (plano Spark na captura).  
**Banco observado:** Firestore `(default)`, vazio, criado no console.  
**Aplicativo Web:** config pública do Firebase SDK capturada em 09/11/2026.  
**Base do código:** PR #531 W10-V, SHA `bedd3e23bcaf0d0af33dfc272f4456116bfd98fd`.

## O que foi implementado nesta PR
- `config/empresas-firebase-web.json`: apenas identificadores públicos do SDK Web do Firebase Empresas, com databaseId `(default)`. A `apiKey` do SDK web NÃO é segredo de servidor; exige regras seguras e políticas adequadas.
- `lib/company/firebaseProjectClient.ts`: inicializador de app nomeado `emprovex-empresas`, exports separados `companyAuth` e `companyDb`; suporte a Auth/Firestore Emulator apenas em projeto `demo-*` e loopback.
- `scripts/empresas-firebase-project-config.test.mjs`: checagens automatizadas de isolamento configuracional, sem tocar bancos reais.

**AVISO DE SEGURANÇA — INTEGRAÇÃO AINDA INCOMPLETA:** o portal W0–W15 NÃO foi migrado para `companyAuth`/`companyDb`. O login empresarial atual e o servidor ainda dependem de `lib/firebase.ts`/do projeto principal em vários pontos. Não substituir as importações isoladamente, pois isso criaria divergência cliente/servidor e erros de autorização; não liberar piloto nem habilitar `/empresa` em produção até o próximo checkpoint integrado.

## O que precisa ser verificado pelo titular no Firebase
1. **Authentication > Método de login**: Email/Senha ativo; sem login anônimo. Autorizar domínio de homologação somente quando existir.
2. **Firestore > dados e configurações**: verificar edição real (Enterprise ou Standard), localização, banco `(default)` e franquia efetiva. A captura não comprova a edição nem a região.
3. **Firestore > Segurança**: regras de negação inicial `allow read, write: if false;` (não abrir regras ao público); somente implantar regras dirigidas após revisão do projeto e da arquitetura do Auth.
4. **IAM/service accounts**: identidade servidor empresarial de privilégio mínimo, independente do serviço militar. Não enviar chaves privadas ao chat ou repositório.
5. **Hospedagem**: Spark não fornece Cloud Run na própria conta sem faturamento. Avaliar Blaze com orçamentos e alertas (alertas NÃO limitam custos) antes de provisionar serviço empresarial; não tocar Cloud Run do principal.
6. **Custos**: acompanhar as quotas e a edição na console; um segundo projeto não multiplica automaticamente todas as cotas Google Cloud.

## Trabalho de integração obrigatório (próximo Worker, somente ambiente isolado)
- Criar login empresarial com Firebase Auth do projeto `emprovex-empresas`, sem fazer o fundador/UG autenticar por esse projeto. As rotas `/empresa` exigem sessão de `companyAuth` compatível com verificação server-side.
- Migrar **todos** os guards e stores empresariais W0–W15 para o banco e IAM do projeto empresarial (incluindo `companySession.ts`, `firebaseFounderAuth` adaptado sem impacto ao fundador, `companyProfiles`, `companyMembership`, `companyProvisioningAdmin`, `lib/company/**` e serviços com URLs REST), sem consulta ou escrita cruzada no Firestore principal. O registro principal do fundador/admin deve permanecer protegido e imutável. Não criar credenciais administrativas na UI ou no GitHub.
- Revisar fluxo de provisionamento: fundador pode AUTORIZAR a criação sem seu token militar ser aceito como token empresarial. Opcionalmente criar controle separado de provisioning via serviço IAM dedicado; sem assumir acesso ao banco principal. Nunca compartilhar permissões militares.
- Criar ambiente de staging com URL própria, Auth e Firestore empresariais independentes; ativar piloto somente ali, restrito a contas QA e dados sintéticos. Emissão WLG/SEFAZ 503.
- Testes reais: Auth+Firestore Emulator, isolamento A/B/UG, revogação, flags e kill switch, multi-CNPJ 600s, Playwright mobile/desktop, regressões das PRs #530/#531, ausência de chamadas ao projeto principal, builds por ambiente.
- Só após go de QA: considerar `emprovex.com.br/empresa`, com roteamento e cookies sem interferência do sistema principal.

## Estado de entrega
**GO:** módulo público do SDK separado disponível na branch para integração.  
**NO-GO:** ativação em serviço de produção, merge, deploy, provisionamento real de contas, habilitação comercial ou testes que gravem dados reais.

Esta PR não altera `firebase-applet-config.json`, `lib/firebase.ts`, `firebase.json`, IAM, Rules, Auth existente, Cloud Run ou o banco original.
