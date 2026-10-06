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
| F01 | Android/Chrome abre e autentica | tela inicial/Central acessível | PENDENTE |
| F02 | câmera permitida | scanner abre e lê | PENDENTE |
| F03 | câmera negada/indisponível | fallback manual disponível | PENDENTE |
| F04 | Code128 físico | leitura reconhecida corretamente | PENDENTE |
| F05 | entrada/alocação | operação conclui sem UNASSIGNED operacional | PENDENTE |
| F06 | transferência física→física | origem/destino coerentes | PENDENTE |
| F07 | consulta por item/local | saldos/localizações coerentes | PENDENTE |
| F08 | inventário físico | TOTAL não oferece UNASSIGNED | PENDENTE |
| F09 | saída | baixa na posição física correta | PENDENTE |
| F10 | conferência de posição | material/posição coerentes | PENDENTE |
| F11 | Desktop ↔ Mobile | mesma regra operacional/resultado | PENDENTE |
| F12 | COMPACT/MEDIUM/LARGE | layout legível | PENDENTE |
| F13 | som/vibração | feedback funciona quando suportado | PENDENTE |
| F14 | double scan/cooldown | não duplica operação | PENDENTE |
| F15 | perda/retorno de rede | falha fechada e recuperação coerente | PENDENTE |
| F16 | iPhone/Safari quando disponível | smoke câmera/fallback | PENDENTE |

## 5. Regra de decisão

- Se F01–F15 passarem sem blocker e F16 não estiver disponível, classificar **PASS FÍSICO COM PENDÊNCIA DE DISPOSITIVO IOS**.
- Se F01–F16 passarem, classificar **PASS FÍSICO FINAL**.
- Qualquer erro que exija mudança de runtime invalida o re-freeze e exige nova composição/gates.
- Erro de treinamento/UX sem regressão funcional deve ser classificado separadamente e não bloquear automaticamente.

## 6. Produção

Nenhuma autorização de Production está incluída neste documento.

Após PASS físico final (ou PASS com pendência iOS explicitamente aceita), o próximo passo é decisão explícita do Fundador:

**GO / NO-GO PARA PRODUCTION**.
