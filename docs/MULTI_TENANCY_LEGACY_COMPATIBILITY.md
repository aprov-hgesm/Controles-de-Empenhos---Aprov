# EMPROVEX — Bloco 13: compatibilidade legada controlada

## Objetivo

Depois do cutover do Bloco 12, o runtime oficial do HGeSM usa exclusivamente:

```text
/workspaces/hgesm-aprov/empenhos
/workspaces/hgesm-aprov/alerts
/workspaces/hgesm-aprov/invoices
/workspaces/hgesm-aprov/comissoes
/workspaces/hgesm-aprov/cronogramas
/workspaces/hgesm-aprov/settings
```

As coleções raiz históricas continuam preservadas, mas deixam de fazer parte do runtime normal.

O Bloco 13 transforma o legado em uma camada de compatibilidade controlada para:

- auditoria;
- comparação histórica;
- recuperação;
- investigação de incidentes;
- rollback administrativo planejado.

O legado não é mais um destino válido de escrita do aplicativo.

## Estado de runtime

O HGeSM permanece com:

```text
legacyDataMode=false
legacySettingsMode=false
```

`operationalScopeFromContext()` rejeita qualquer contexto operacional que tente reativar um dos modos legados. Isso impede que uma futura alteração acidental de flag volte a apontar o frontend para as coleções raiz.

## Proteção em duas camadas

### 1. Runtime

`lib/operationalPaths.ts` bloqueia contextos legados no runtime operacional.

Mesmo que uma flag seja alterada por engano, o aplicativo falha fechado em vez de voltar silenciosamente ao legado.

### 2. Firestore Rules

As coleções raiz históricas ficam somente leitura para a identidade fundadora do HGeSM:

```text
/empenhos/{id}
/alerts/{id}
/invoices/{id}
/comissoes/{id}
/cronogramas/{id}
/settings/{id}
```

Escritas são negadas pelas Rules.

Exceção intencional:

```text
/settings/global
```

continua sendo configuração global da plataforma, com leitura pública necessária ao branding pré-login e escrita administrativa da identidade fundadora.

## Auditoria automática

O comando:

```bash
npm run audit:legacy-runtime
```

valida:

- ausência de `legacyDataMode=true` no contexto operacional;
- ausência de `legacySettingsMode=true` no contexto operacional;
- ausência de chamadas Firestore diretas às cinco coleções raiz no código de runtime;
- ausência de acesso direto ao contador legado `settings/termoRecebimentoCounter`;
- legado operacional somente leitura em `firestore.rules`;
- preservação de `settings/global`.

Resultado esperado:

```text
LEGACY RUNTIME GUARD: READY
```

A mesma auditoria foi adicionada ao workflow `Application CI` para impedir regressões futuras em pull requests e execuções manuais de CI.

## Publicação das Rules

As alterações em `firestore.rules` só entram em vigor depois de deploy explícito para o banco EMPROVEX correto:

```text
Projeto: gen-lang-client-0982077967
Banco: ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1
```

Comando de referência no Cloud Shell:

```bash
firebase deploy \
  --only firestore:ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1 \
  --project gen-lang-client-0982077967
```

Nunca publicar estas Rules em outro banco Firestore do projeto.

## Rollback controlado

O rollback não é mais feito simplesmente alterando `legacyDataMode=true`.

Se for necessário retornar ao legado por incidente grave, o procedimento deve ser explícito:

1. interromper novas escritas operacionais;
2. comparar workspace e legado;
3. reconciliar qualquer dado criado depois do cutover;
4. criar/validar snapshot atual;
5. alterar o runtime conscientemente;
6. alterar temporariamente as Rules se escrita legada for realmente necessária;
7. executar typecheck/build/auditorias;
8. documentar o incidente e o ponto de restauração.

Isso evita perda silenciosa de dados recentes do workspace.

## Coleções legadas

Nenhuma coleção raiz é apagada no Bloco 13.

A preservação física continua importante durante o período de estabilização multi-tenant e para os blocos posteriores de desativação definitiva.

## Critério de encerramento

O Bloco 13 é encerrado somente depois de:

1. `npm run audit:legacy-runtime` retornar `READY`;
2. `npm run typecheck` passar;
3. `npm run build` passar;
4. as novas Rules serem implantadas no banco correto;
5. smoke test de produção confirmar funcionamento normal no workspace;
6. tentativa controlada de escrita legada ser recusada pelas Rules, sem alterar dados reais.
