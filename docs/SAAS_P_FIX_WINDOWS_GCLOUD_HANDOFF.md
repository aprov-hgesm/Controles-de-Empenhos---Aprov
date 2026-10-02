# SAAS-P — PILOT-OPS — Windows gcloud compatibility handoff

Data: 2026-10-02

Branch: `saas-p-fix-ops-windows-gcloud`

Base: `feat/saas-r1-commercializacao@837a2709f9131a8318a618cd274af82fd6e5d0e2`

## Problema observado

Durante P2/P3 da SAAS-P, o operador instalou e autenticou o Google Cloud CLI no Windows. O comando `where.exe gcloud` confirmou `gcloud.cmd` no PATH, mas os scripts Node retornaram “Google Cloud CLI não encontrado”.

Reprodução adicional:
- `spawnSync('gcloud.cmd', ['--version'])` no Windows retornou `EINVAL`.

Causa:
- os scripts chamavam `spawnSync('gcloud', ...)` diretamente;
- no Windows, o launcher do Cloud SDK é `gcloud.cmd`, que precisa ser executado via `cmd.exe`.

## Correção

Novo adaptador:
- `scripts/lib/gcloud-command.mjs`.

Comportamento:
- Linux/macOS/Cloud Shell: continua executando `gcloud` diretamente;
- Windows: executa `gcloud.cmd` através de `ComSpec/cmd.exe`;
- nenhum comando de domínio foi alterado;
- nenhum `apply` é introduzido ou automatizado.

Consumidores atualizados:
- `scripts/saas-r1-legacy-vip.mjs`;
- `scripts/firestore-recovery.mjs`.

Teste:
- `scripts/gcloud-command.test.mjs`;
- `npm run test:gcloud-command`.

## Escopo de segurança

Sem alteração em:
- Firestore Rules;
- schema/dados;
- billing;
- lifecycle;
- Auth;
- legal;
- `warehouseAccess`;
- aplicação web;
- deploy;
- comportamento de `apply`/restore.

A correção somente torna o launcher do CLI portável entre POSIX e Windows.

## Impacto MOBILE-R1

1. Arquivos/contratos afetados: apenas scripts de operação SaaS/recovery e package script de teste.
2. Mudança comportamental: somente execução local do `gcloud` no Windows.
3. Delta para Mobile: **NÃO**.
4. Gates Mobile a repetir: **nenhum gate funcional Mobile específico**.
5. Bloqueio Mobile: **nenhum**.

## Validação requerida

Antes de integrar:
1. `npm run test:gcloud-command`;
2. `npm run test:recovery`;
3. `git diff --check 837a2709f9131a8318a618cd274af82fd6e5d0e2...HEAD`;
4. validação real em Windows:
   - `npm run saas:r1:legacy-vip -- status`;
   - `npm run recovery:status`;
5. CI proporcional ao diff via PR.

Nenhuma operação de escrita em produção faz parte desta correção.
