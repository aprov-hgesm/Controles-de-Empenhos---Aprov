# EMPROVEX Cozinha Dietética — Firebase isolado R1 (handoff)

**Data:** 11/11/2026 · **Origem:** PR #549 W09 (branch `integration/cozinha-dietetica-r1`)  
**Novo Firebase:** projeto `cozinha-dietetica`, Firestore `(default)`, aplicação Web registrada, Auth e-mail/senha. Capturas do proprietário mostram `allow read, write: if false;` e banco inicialmente vazio. **Não afirmar que o projeto real foi acessado pelo código nesta PR.**

## Resultado real desta implementação

1. **Firebase Auth do navegador isolado:** `lib/hospital/firebase-client.ts` cria uma instância Firebase **nomeada** (`emprovex-hospitalar`), vinculada **somente** ao projeto `cozinha-dietetica`. `HospitalEntry` e `HospitalShell` deixam de usar `@/lib/firebase` (identidade do EMPROVEX logístico). Sessões, logout e recuperação de senha ficam no Firebase hospitalar.
2. **Verificador servidor vinculado ao projeto:** `lib/server/hospital/firebase/verify-id-token.mjs` valida assinatura JWT do Google via `jose`, emissor, audiência e `auth_time`, e busca o registro atualizado em Identity Toolkit `accounts:lookup` para recusar usuário desabilitado ou sessão revogada (`validSince`). Em falha de assinatura, rede, conta ou configuração, retorna erro — **nunca conceder permissões de claims do navegador**. `core/auth.mjs` usa esse verificador; roles/OM/unidade continuam no membership server-side do W0.
3. **Novo gateway Firestore IAM**, ainda sem consumidores clínicos: `lib/server/hospital/firebase/firestore-gateway.mjs` usa Firestore REST, projeto e banco fixos, token OAuth da identidade Cloud Run via metadata service (sem JSON key), verifica e-mail esperado da **service account hospitalar**, valida OM, unidade, papel, tipo de registro e autor, suporta get/list e commit atômico de registro + evento com precondição create-only/ETag e timestamp Firestore. O gateway é **somente QA** por escolha explícita e fica bloqueado em `NODE_ENV=production`.
4. **Nenhuma substituição furtiva de armazenamento:** os serviços clínicos W0–W9 usam `HospitalQAStore` e acesso SQLite **síncrono** inclusive SQL na camada de relatórios. Não é tecnicamente seguro substituir por Firestore assíncrono sem refatorar suas operações como unidades de trabalho transacionais. Nesta PR, **SQLite QA permanece ativo e Firestore clínico permanece não habilitado**. Nenhum endpoint hospitalar permite gravar no projeto Firestore real.
5. Testes de projeto Firebase errado, usuário revogado/desabilitado, falhas fechadas, IAM/service account divergente, acesso entre unidades, escrita de evento atômica e regressões W09. Workflow `hospital-firebase-isolation-qa.yml` roda sem credenciais reais e sem deploy.

## Configuração de referência — somente QA autorizado

Configurações públicas do cliente (não são senhas):
```env
NEXT_PUBLIC_HOSPITAL_FIREBASE_PROJECT_ID=cozinha-dietetica
NEXT_PUBLIC_HOSPITAL_FIREBASE_API_KEY=<chave-publica-web-do-firebase>
NEXT_PUBLIC_HOSPITAL_FIREBASE_APP_ID=<app-id-web-hospitalar>
```

Para a aplicação hospitalar W09 atualmente em **QA local sintético**, preservam-se as flags W09 de SQLite e organização (ver `docs/cozinha-dietetica/integration/W09_HANDOFF_R1.md`), sem habilitar produção. A presença dessas variáveis públicas não cria conta, membership ou autorização clínica por si só.

Apenas para exercitar o gateway Firestore em **runtime QA isolado com identidade Cloud Run específica**, não no EMPROVEX principal:
```env
HOSPITAL_FIRESTORE_QA_ENABLED=1
HOSPITAL_FIRESTORE_PROJECT_ID=cozinha-dietetica
HOSPITAL_FIRESTORE_SERVICE_ACCOUNT_EMAIL=<conta-hospitalar>@cozinha-dietetica.iam.gserviceaccount.com
```
O gateway faz fail-closed quando qualquer elemento divergir. **Nunca usar essas flags para liberar dados reais ou em produção**. Testes unitários usam identidades e payloads sintéticos injetados; não provam conectividade com o GCP.

## IAM e proteção de dados — passos que exigem acesso autorizado ao Google Cloud

O GitHub não concede acesso IAM ao projeto Google Cloud. Por isso, **nenhuma conta de serviço, papel ou API GCP foi alterada nesta PR**. Para o piloto futuro:

- Criar uma **service account exclusivamente hospitalar** no projeto `cozinha-dietetica`, sem chaves JSON baixadas. Executar o backend hospitalar numa revisão/serviço **Cloud Run isolado**, com essa identidade e acesso privado. Não conceder permissão de Firestore hospitalar à identidade do Cloud Run logístico do EMPROVEX.
- Conceder exclusivamente a identidade hospitalar as permissões mínimas para os dados necessários (começar pela referência `roles/datastore.user` restrita ao projeto hospitalar e avaliar papel customizado conforme necessidades). Firestore Rules `allow read, write: if false;` **permanecem fechadas**; o SDK/REST de servidor com OAuth é controlado por IAM, não pelas Rules do SDK cliente.
- Validar também IAM para consulta de conta no Identity Toolkit, conectividade, auditoria, retenção, backup, protocolo de contingência e aprovação institucional. Projetos e contas distintas não substituem revisão de acesso por usuário/OM/unidade.
- Não criar collections/dados de pacientes manualmente e não utilizar dados pessoais em QA.

## Próximo passo técnico antes do uso real

Reestruturar o serviço de persistência hospitalar para **operações assíncronas transacionais nativas do Firestore**: read-modify-write por documento/versão, unicidade de refeição por internação+ciclo, snapshot imutável do mapa, journal imutável, autor e timestamps de servidor. Adaptar gradualmente handlers de pacientes, mapas, produção, distribuição, auditoria, administração e relatórios; executar E2E com **emulador Firestore + Auth** e posteriormente com **projeto QA** com dados sintéticos, validando isolamento cross-OM, concorrência e custos.

**Parecer:** GO para integração técnica de identidade hospitalar independente, revisão da camada Firestore e testes sintéticos. **NO-GO para dizer que o SQLite foi substituído; NO-GO para deploy, ativação hospitalar e uso com pacientes reais.** Nenhuma alteração em banco existente, IAM, Rules, main, Cloud Run ou infraestrutura de produção.
