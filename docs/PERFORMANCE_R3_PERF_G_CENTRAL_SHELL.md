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

Resultados de build, First Load JS e demais gates serão registrados após execução do CI.
