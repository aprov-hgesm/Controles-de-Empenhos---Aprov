# EMPROVEX — Bloco 21 — Homologação de segundo setor real

## Objetivo

Comprovar em produção, com uma segunda Conta Google real, que o fluxo multi-tenant completo funciona fora do HGeSM e mantém isolamento, identidade, armazenamento e lifecycle.

## Regra de segurança

A Conta Google real usada na homologação **não deve ser gravada em arquivo versionado**. O e-mail é informado somente no painel administrativo de produção.

## Pré-condições

Antes do cadastro real, executar:

```bash
npm run verify:production-multitenant-readiness
npm run verify:multitenant-security
npm run test:security:multitenant
npm run typecheck
npm run build
```

Resultados obrigatórios:

```text
PRODUCTION MULTI-TENANT READINESS: READY
MULTI-TENANT SECURITY SUITE: READY
MULTI-TENANT SECURITY: READY
```

## Dados necessários do setor de homologação

- nome exibido do setor;
- workspaceId exclusivo;
- Conta Google real;
- nome institucional;
- sigla opcional;
- nome da seção;
- local padrão de entrega opcional;
- cargo/função padrão opcional.

O workspaceId e o e-mail se tornam identidade estrutural e não são editáveis pelo fluxo normal depois da criação.

## Fase 1 — Cadastro administrativo

Na produção, abrir:

```text
https://controles-de-empenhos-aprov.vercel.app/admin
```

Usando a identidade fundadora, cadastrar o setor.

Critérios:

- workspace criado com status active;
- platformAccount criada com status active;
- nenhum firebaseUid antes do primeiro login;
- settings/termoRecebimentoCounter criado com currentNumber = 0;
- settings/documentStorage ainda ausente;
- nenhuma coleção operacional precisa existir antes do uso.

## Fase 2 — Primeiro login real

Abrir a URL oficial em sessão de navegador separada e entrar com a Conta Google cadastrada.

Critérios:

- login aceito somente para o e-mail autorizado;
- firebaseUid vinculado no primeiro acesso;
- workspace resolvido corretamente;
- nenhum dado do HGeSM visível;
- nenhum dado de outro setor visível;
- interface operacional abre vazia para um tenant novo.

## Fase 3 — Google Drive

No cabeçalho, executar **Ativar Google Drive** usando a mesma Conta Google.

Critérios:

- reautenticação Google concluída;
- estrutura EMPROVEX criada ou reutilizada;
- pastas Notas de Empenho e Notas Fiscais disponíveis;
- settings/documentStorage criado no workspace correto;
- provider = google-drive;
- accountEmail = conta do setor;
- nenhum accessToken ou refreshToken persistido.

## Fase 4 — Smoke test operacional

Criar somente um registro de homologação claramente identificado e removível, preferencialmente sem dados sensíveis.

Validar:

- gravação ocorre somente no workspace do novo setor;
- HGeSM permanece inalterado;
- leitura/edição do registro funciona;
- contador TR permanece independente;
- upload documental usa o Drive do novo setor.

Se um registro de teste for criado, removê-lo ao final pelos meios normais da aplicação quando a função permitir; não apagar metadados estruturais diretamente no Firestore.

## Fase 5 — Suspensão

Com o setor logado em uma janela separada, usar a Administração EMPROVEX para suspender o setor.

Critérios:

- workspace.status = disabled;
- platformAccount.status = disabled;
- sessão operacional aberta é encerrada;
- novo login é recusado;
- dados permanecem preservados.

## Fase 6 — Reativação

Reativar pelo painel administrativo.

Critérios:

- workspace.status = active;
- platformAccount.status = active;
- mesmo firebaseUid permanece vinculado;
- login volta a funcionar;
- documentStorage e dados anteriores permanecem;
- Drive precisa apenas de nova autorização temporária após reload, quando necessário.

## Fase 7 — Verificação de isolamento

Com o segundo setor autenticado:

- não deve existir UI ou caminho que mostre dados HGeSM;
- qualquer tentativa direta a /workspaces/hgesm-aprov/... deve ser negada pelas Rules;
- conta fundadora em modo Administração não deve conseguir ler dados operacionais do segundo tenant.

Os cenários equivalentes já são exercitados automaticamente no Bloco 20; esta fase confirma o comportamento real em produção.

## Critério final de aprovação

O Bloco 21 só pode ser marcado como concluído quando todas as fases acima forem verificadas com a segunda Conta Google real e nenhuma correção de segurança ficar pendente.

Resultado final:

```text
SECOND SECTOR PRODUCTION HOMOLOGATION: READY
```

## Rollback

Se qualquer etapa falhar:

1. suspender o novo setor no painel administrativo;
2. não apagar workspace, platformAccount, contador ou documentStorage manualmente;
3. preservar evidências/logs;
4. corrigir o problema no código/Rules;
5. repetir os gates do Bloco 20;
6. reativar somente depois da correção publicada.
