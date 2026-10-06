# RC-R1-PHYSICAL-CERT-01 — Certificação final do RC R1

Data: 2026-10-05/06

## Identidade

- RC re-frozen: `rc-r1-refreeze-01@fae9ce6aed7242e85d53fc8e6470fba4425a8c27`
- Branch de certificação: `rc-r1-physical-cert-01`
- Origem da composição: `rc-r1-composition-01@fae9ce6aed7242e85d53fc8e6470fba4425a8c27`
- Preview runtime-equivalente disponível: commit `5255bbcbc43593bcf66001adf85eb5d6264a121e`
- Preview conhecido: `https://controles-de-empenhos-aprov-git-rc-b384cb-aprov-hgesms-projects.vercel.app`

## 1. Equivalência de runtime

A comparação entre `5255bbcbc43593bcf66001adf85eb5d6264a121e` e o RC re-frozen `fae9ce6aed7242e85d53fc8e6470fba4425a8c27` mostra 14 commits à frente e 0 atrás.

O delta contém somente:

- workflows CI/Legal;
- documentação;
- `package.json` com script de verificação;
- guard `verify-saas-r1-final-audit`;
- scripts e testes de auditoria Warehouse read-only.

Não há alteração em `app/`, `features/` ou `lib/` entre o Preview verde e o RC re-frozen.

Conclusão operacional:

**o Preview de `5255bbcb...` é representativo do mesmo runtime de aplicação do RC re-frozen `fae9ce6...` para certificação física de UX/câmera/operações.**

Essa equivalência não transforma o Preview em Production e não autoriza deploy.

## 2. Evidência automatizada do RC re-frozen

No HEAD `fae9ce6aed7242e85d53fc8e6470fba4425a8c27`:

- Application CI `37402133902`: SUCCESS
- SAAS-DL Legal Validation `37402133906`: SUCCESS
- EMPROVEX Core Protection `37402133890`: SUCCESS
- Recovery guardrails `37402133915`: SUCCESS

Também verdes no Application CI:

- Production build
- TypeScript
- Diff hygiene
- MOBILE-K canonical ops
- Inventory
- Transfer
- Outbound
- Multi-tenant
- Sessions
- blocos finais 16/17/18/19/20/21

Rules preservadas:

- `firestore.rules@bc91185f34bcdcb4437a4de1078d1089a09292ba`
- `firestore.warehouse.rules@6e1f1050005314db4e17cb3136409abbddb0ee91`

Warehouse:

- repair autorizado já executado;
- lotExcess=0 nos dois materiais reparados;
- auditoria pós-repair com 0 inconsistências quantitativas.

## 3. Vercel

O RC re-frozen não ganhou novo Preview porque o status Vercel retornou:

`Deployment rate limited — retry in 24 hours.`

Isso é limitação externa de quota/build, não falha de build do aplicativo.

O Preview de `5255bbcb...` havia sido criado com Vercel SUCCESS e pode ser usado para a certificação física por equivalência de runtime comprovada acima.

## 4. Matriz física mínima

Executar no Preview runtime-equivalente:

| ID | Teste | Evidência exigida | Status |
| --- | --- | --- | --- |
| ID | Teste | Evidência observada | Status |
| --- | --- | --- | --- |
| F01 | Android/Chrome abre e autentica | acesso confirmado pelo Fundador | PASS |
| F02 | câmera permitida | scanner abriu e leu | PASS |
| F03 | câmera negada/indisponível | fallback manual funcionou | PASS |
| F04 | Code128 físico | leitura correta | PASS |
| F05 | entrada/alocação | erro `WAREHOUSE_FAST_PATH_UNAVAILABLE` | **BLOCKER** |
| F06 | transferência física→física | UI: “A transferência não pôde ser confirmada. Revalide os dados e tente novamente” | **BLOCKER / CAUSA A ISOLAR** |
| F07 | consulta por item/local | resultado coerente | PASS |
| F08 | inventário físico | fluxo passou e não ofereceu UNASSIGNED operacional | PASS |
| F09 | saída | resultado não confirmado; UI solicitou replay idempotente com a mesma chave | **PENDENTE DE REPLAY / BLOCKER SE RECORRENTE** |
| F10 | conferência de posição | resultado coerente | PASS |
| F11 | Desktop ↔ Mobile | coerência confirmada | PASS |
| F12 | COMPACT/MEDIUM/LARGE | legíveis | PASS |
| F13 | som/vibração | som OK; vibração não suportada pelo navegador | PASS COM LIMITAÇÃO DO DISPOSITIVO |
| F14 | double scan/cooldown | item não duplica; localização aceita leitura repetida | **BLOCKER UX/SCANNER** |
| F15 | perda/retorno de rede | não executado ainda | PENDENTE |
| F16 | iPhone/Safari quando disponível | dispositivo iOS indisponível | PENDENTE — IOS INDISPONÍVEL |

## 5. Resultado desta rodada

Classificação atual:

**BLOCKER — NÃO APTA PARA GO/PRODUCTION NESTE CHECKPOINT**

Motivos:

1. F05 falhou em runtime com `WAREHOUSE_FAST_PATH_UNAVAILABLE`;
2. F06 não confirmou a transferência e a UI não expôs o código técnico causal;
3. F14 confirmou double scan de códigos de localização;
4. F09 ainda exige replay idempotente para determinar se houve apenas resultado incerto/transiente ou falha recorrente;
5. F15 permanece pendente;
6. F16 fica como pendência de dispositivo iOS e não é blocker isolado por si só.

### Diagnóstico inicial

F05:
- o fast path usa a rota `/api/adm-deposito/intake-action`;
- essa rota depende de `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` para obter token Google server-side;
- `WAREHOUSE_FAST_PATH_UNAVAILABLE` também pode representar falha REST/commit do Firestore, portanto **não se declara ainda causa única** sem evidência de ambiente/log;
- não é permitido ampliar fallback para o caminho legado apenas para mascarar o erro, pois o fast path revalida Invoice/Empenho canônicos server-side.

F06:
- o erro mostrado é fallback genérico da UI;
- é necessário obter o erro técnico real ou reproduzir com teste dirigido antes de alterar domínio/Rules.

F09:
- o fluxo foi desenhado para replay seguro com a mesma identidade;
- o próximo clique em CONFIRMAR SAÍDA é parte válida do protocolo idempotente;
- se o replay confirmar sem segunda baixa, o caso pode ser reclassificado;
- se repetir o erro, torna-se blocker funcional confirmado.

F14:
- o scanner compartilhado mantém a câmera ativa depois de leitura válida;
- decoder permite novo sucesso em ~700 ms e o cooldown atual é 900 ms; mantendo o código diante da câmera, uma nova leitura pode ser aceita após a janela;
- a correção deve tornar a etapa de scanner single-shot após leitura válida, preservando entrada manual e feedback.

### Freeze

O snapshot `rc-r1-refreeze-01@fae9ce6...` permanece preservado como evidência histórica da candidata testada, mas **o re-freeze não pode ser considerado liberado para Production** após blockers físicos reais.

Qualquer correção de runtime deve ocorrer em branch corretiva própria e gerar novo SHA + gates + novo re-freeze.

## 6. Produção

Nenhuma autorização de Production está incluída neste documento.

