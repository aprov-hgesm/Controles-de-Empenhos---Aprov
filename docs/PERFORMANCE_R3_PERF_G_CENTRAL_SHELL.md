# PERF-G — Shell/Layout persistente da Central de Depósitos

Base de implementação: `9c452a000d3cad87e92abf8087d88596ebe3e802`

Branch: `perf-r3-g-central-shell`

## Investigação inicial

- Não existia `app/adm-deposito/layout.tsx`.
- As seis rotas principais montavam individualmente `WarehouseProtectedSurface`.
- `WarehouseProtectedSurface` repetia resolução de identidade/workspace, gate em `/api/adm-deposito/status` e montagem de `WarehouseModuleShell`.
- `WarehouseModuleShell` continha header, sidebar, moldura visual e a chamada a `WarehouseSectionContent`.
- `WarehouseSectionContent` já preservava os boundaries `dynamic()` da PERF-B para as seis superfícies pesadas.
- A sidebar principal já usava `next/link`; não foi identificada necessidade de substituir navegação interna normal por hard reload.
- As rotas legadas usam `redirect()` server-side e permanecem intactas.
- O controle contínuo de sessão/workspace já existia em `platformSessionControl`, com listeners de workspace/conta/revogação e renovação de lease, mas não era acoplado ao gate persistente da Central.

## Arquitetura adotada

```text
app/adm-deposito/layout.tsx
  -> WarehouseProtectedLayout
       -> auth/workspace/status + session control fail-closed
       -> WarehouseWorkspaceProvider (contexto mínimo, sem shell/superfícies)
       -> WarehouseModuleShell (persistente)
            -> header/sidebar/moldura
            -> children da rota
                 -> WarehouseRouteContent
                      -> WarehouseSectionContent
                           -> dynamic() da superfície ativa
```

O shell não importa `WarehouseSectionContent` nem qualquer superfície operacional pesada. O contexto compartilhado vive em `WarehouseModuleContext.tsx`, isolado do gate e do shell, para que os chunks filhos não criem dependência estática de volta para o boundary persistente. O conteúdo continua pertencendo às páginas/segmentos filhos.

## Segurança

A persistência não transforma estado React em autoridade. Na entrada continuam obrigatórios:

- Firebase Auth;
- resolução autenticada de workspace;
- feature/access gate;
- `/api/adm-deposito/status` com `cache: no-store`;
- conferência de workspace/UG e refresh de claims quando necessário.

Para setores externos, enquanto o layout permanece montado, `startWorkspaceSessionControl` mantém fail-closed diante de:

- revogação da sessão;
- perda do lease;
- alteração/inativação de workspace;
- alteração/inativação da conta;
- divergência de UID, UG ou workspace.

Na invalidação, o conteúdo operacional é desmontado imediatamente, contexto/lease locais são limpos e a sessão é encerrada.

## Escopo preservado

- nenhuma mudança em intake;
- nenhuma mudança em outbound/ledger;
- nenhuma mudança em Rules/Firestore;
- nenhum cache global/TTL/localStorage novo;
- nenhuma mudança visual intencional;
- nenhuma remoção de rota legada.

## Validação

O guard `verify:performance-r3-central-shell` protege:

- existência do layout compartilhado;
- remoção da montagem duplicada de gate/shell das seis páginas principais;
- ausência de imports pesados no shell/gate;
- permanência dos `dynamic()` da PERF-B;
- navegação principal por `next/link`;
- presença do controle contínuo de sessão no boundary persistente.

### Evidência estrutural

O guard específico foi executado sobre os arquivos da branch e passou, confirmando layout compartilhado, ausência de imports estáticos das grandes superfícies no shell/gate, manutenção dos `dynamic()` da PERF-B e navegação principal por `next/link`.

Os contratos históricos da FASE 3 também foram alinhados à arquitetura persistente: o walking skeleton agora exige `WarehouseProtectedLayout` no layout compartilhado, `WarehouseRouteContent` nas seis páginas principais e rejeita o retorno de `WarehouseProtectedSurface` por página.

### Gates observados no Application CI

- TypeScript error budget: PASS;
- EMPROVEX Core Protection: PASS;
- Recovery tests/guardrails: PASS;
- multi-tenant Firestore security: PASS;
- ADM Depósito Phase 0 isolation: PASS;
- Central de Depósitos external workspace security: PASS;
- ADM Depósito Phase 3 walking skeleton tests: PASS;
- ADM Depósito Phase 3 guard: PASS;
- demais gates anteriores ao build: PASS;
- production build: PASS;
- TypeScript final: PASS.

A execução que produziu estas métricas chegou ao fim funcionalmente verde e apontou apenas um trailing whitespace neste próprio documento; a linha foi corrigida sem mudança de código.

### First Load JS

Referência imediatamente anterior, após PERF-B integrada: rotas principais da Central em aproximadamente **300 kB** e shared global em **104 kB**.

| Rota | Antes PERF-G | Depois PERF-G |
| --- | ---: | ---: |
| `/adm-deposito` | ~300 kB | 106 kB |
| `/adm-deposito/meus-depositos` | ~300 kB | 106 kB |
| `/adm-deposito/cadastro-de-itens` | ~300 kB | 106 kB |
| `/adm-deposito/saida-de-material` | ~300 kB | 106 kB |
| `/adm-deposito/controle-de-depositos` | ~300 kB | 106 kB |
| `/adm-deposito/controle-de-itens` | ~300 kB | 106 kB |
| Shared First Load JS | 104 kB | 104 kB |

A redução observada nas rotas principais em relação ao estado já otimizado pela PERF-B é de aproximadamente **194 kB por rota (64,7%)**, sem aumento do shared global. A referência de abertura da R3 era 579 kB para a família da Central.

### Browser E2E / Preview

Browser E2E não foi promovido a gate permanente. O Preview automático da Vercel não ficou disponível porque a conta atingiu o limite diário de deployments (`api-deployments-free-per-day`). A validação estrutural, de segurança, build e TypeScript foi realizada pelo GitHub Actions; a navegação visual pode ser confirmada manualmente após integração, conforme a política sob demanda.

## Riscos e integração

- PERF-D altera `WarehouseItemRegistrationOperational.tsx`; PERF-G não tocou sua lógica interna e preserva essa superfície como unidade lazy.
- PERF-F não deve elevar cache operacional para o layout/shell; eventual cache futuro deve continuar segregado por workspace e abaixo do boundary apropriado.
- PERF-I deve preservar o layout persistente e os `dynamic()` da PERF-B ao reconciliar frentes.
- O shell persiste enquanto o operador permanece no segmento `/adm-deposito`; sair da Central e reentrar remonta o boundary, comportamento esperado.
- Mudança/revogação de workspace, conta ou lease derruba o conteúdo operacional pelo controle contínuo fail-closed; estado React persistente não é usado como autoridade de acesso.

## Não realizado

- sem merge na branch integradora;
- sem merge na `main`;
- sem deploy de produção;
- sem alteração de Firestore ou Rules;
- sem cache PERF-F;
- sem mudança funcional de intake PERF-D;
- sem mudança funcional de outbound, ledger, saldo, barcode, lote ou material.
