# EMPROVEX — MOBILE-J — Runbook de Certificação Física no Preview HTTPS do RC

Data de preparação: **2026-10-03**

## 1. Objetivo

Executar a certificação física da Central Móvel R1 no **Preview HTTPS do Release Candidate composto SaaS R1 + Mobile R1**, sem reabrir desenvolvimento funcional.

A MOBILE-J deve produzir evidência de uso real, não apenas evidência de CI.

## 2. Pré-condições para iniciar a execução física

Registrar antes do primeiro teste:

- RC branch:
- RC SHA:
- Preview HTTPS:
- HEAD SaaS final:
- HEAD Mobile final:
- CT-01 presente no RC:
  `camera=(self), microphone=(), geolocation=()`
- Rules principal hash:
- Warehouse Rules hash:
- Application CI:
- Core Protection:
- Recovery:
- Legal:
- Production Build:
- TypeScript:
- Diff Hygiene:

Se qualquer contrato transversal estiver em conflito, interromper apenas o bloco afetado e escalar ao Program Control.

## 3. Regra de evidência

Para cada caso registrar:

- data/hora;
- aparelho;
- sistema operacional;
- navegador;
- URL do Preview;
- usuário/workspace de teste;
- ação executada;
- resultado esperado;
- resultado observado;
- PASS / FAIL / PENDENTE;
- screenshot/foto/vídeo quando útil;
- erro exibido/log relevante;
- observação.

Não inferir PASS sem execução real.

## 4. Android / Chrome

| Caso | Resultado esperado | Estado |
| --- | --- | --- |
| abrir Central Mobile | Home carrega sem erro | PENDENTE |
| câmera permitida | scanner abre câmera traseira | PENDENTE |
| câmera negada | erro claro + fallback manual | PENDENTE |
| câmera indisponível | falha controlada + fallback | PENDENTE |
| abrir/fechar câmera | stream encerra corretamente | PENDENTE |
| trocar de rota | câmera é desmontada | PENDENTE |
| retornar à rota | câmera pode ser reaberta | PENDENTE |
| scan válido | feedback correto e um único evento | PENDENTE |
| double scan | cooldown evita duplicação | PENDENTE |
| scans consecutivos distintos | ambos processados após cooldown | PENDENTE |
| luz baixa | comportamento documentado | PENDENTE |
| reflexo | comportamento documentado | PENDENTE |
| perda de rede | erro fail-closed / sem falso sucesso | PENDENTE |
| retorno da rede | operação pode ser retomada com segurança | PENDENTE |
| fallback manual | entrada manual funcional | PENDENTE |

## 5. iPhone / Safari

Executar os mesmos cenários do Android quando houver aparelho disponível.

Estado inicial:

**PENDENTE**

Se não houver iPhone disponível durante a janela:

registrar explicitamente:

**PENDENTE — APARELHO NÃO DISPONÍVEL**

Não converter Android PASS em iPhone PASS.

## 6. Code128 físico

Imprimir os três presets oficiais:

- COMPACT;
- MEDIUM;
- LARGE.

Para cada um registrar:

| Preset | Impressão | Leitura | Distância | Enquadramento | Contraste | Repetição | Resultado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| COMPACT | PENDENTE | PENDENTE | — | — | — | — | PENDENTE |
| MEDIUM | PENDENTE | PENDENTE | — | — | — | — | PENDENTE |
| LARGE | PENDENTE | PENDENTE | — | — | — | — | PENDENTE |

Validar no mínimo:

- LOCAL;
- SUBPOSITION;
- produto/material;
- posição correta retornada;
- ausência de confusão entre etiquetas próximas.

Geração digital isolada não vale como certificação física.

## 7. Feedback físico

Validar:

| Caso | Estado |
| --- | --- |
| som de sucesso | PENDENTE |
| som de erro | PENDENTE |
| vibração | PENDENTE |
| feedback visual | PENDENTE |
| double scan sem duplo feedback enganoso | PENDENTE |
| cooldown | PENDENTE |
| erro de persistência sem feedback falso de sucesso | PENDENTE |

## 8. UX real

Validar em uso físico:

- uso com uma mão;
- legibilidade;
- tamanho dos botões;
- orientação;
- scroll;
- loading;
- empty states;
- retorno à Home;
- foco;
- teclado virtual;
- Enter quando aplicável;
- troca scanner ↔ formulário;
- recuperação após erro;
- mensagens de confirmação;
- navegação entre operações.

Classificar cada problema como:

- BLOQUEANTE;
- IMPORTANTE;
- COSMÉTICO;
- BACKLOG.

Somente regressão funcional concreta reabre desenvolvimento.

## 9. Jornada operacional ponta a ponta

Executar em workspace/material de teste controlado:

```text
LOGIN
→ CENTRAL MOBILE
→ LER MATERIAL / POSIÇÃO
→ ALLOCATE
→ CONSULTAR LOCALIZAÇÃO
→ TRANSFERIR
→ CONFERIR
→ INVENTARIAR
→ REALIZAR SAÍDA
→ CONSULTAR ESTADO FINAL
→ ABRIR CENTRAL DESKTOP
→ CONFIRMAR COERÊNCIA
```

Registrar IDs relevantes:

- workspace:
- UG:
- material:
- barcode:
- depósito:
- posição A:
- posição B:
- posição C:
- lote:
- movementIds:
- inventoryId:
- outboundId:

## 10. Invariantes a observar durante a jornada

### ALLOCATE
- pending quantity correta;
- posição canônica;
- sem saldo paralelo;
- barcode/material coerentes.

### TRANSFER
- origem/destino corretos;
- total agregado preservado;
- idempotência;
- sem saldo negativo.

### INVENTÁRIO
- salvar contagem não altera saldo;
- REVIEW antes de ajuste;
- confirmação humana;
- ajuste canônico;
- stale/reconciliation protegidos.

### OUTBOUND
- posição/lote válidos;
- FEFO coerente;
- baixa única;
- replay sem segunda baixa;
- saldo não negativo.

### CONFERÊNCIA
- read-only;
- CORRETO/INCORRETO coerente;
- nenhuma correção silenciosa;
- transferência usada como correção oficial.

## 11. Desktop ↔ Mobile

Após a jornada:

confirmar no Desktop:

- mesmo material;
- mesmo saldo;
- mesma posição;
- mesmo lote;
- mesmo histórico;
- mesmo ledger;
- mesma situação do inventário;
- mesma situação da saída.

Resultado:

**PENDENTE**

## 12. CT-01 no Preview

No Preview HTTPS verificar o header efetivo.

Esperado:

`Permissions-Policy: camera=(self), microphone=(), geolocation=()`

Registrar:

- URL:
- header observado:
- câmera funciona:
- microfone continua bloqueado:
- geolocalização continua bloqueada:
- resultado:

Não alterar `next.config.ts` dentro da MOBILE-J para forçar resultado.

## 13. Rede / recuperação

Executar pelo menos:

1. abrir scanner online;
2. desligar rede antes de uma operação crítica;
3. tentar operação;
4. confirmar ausência de falso sucesso;
5. religar rede;
6. repetir/reconciliar com segurança;
7. verificar idempotência.

Resultado:

**PENDENTE**

## 14. Performance observada

Registrar novamente:

- /central-mobile:
- /alocar:
- /transferir:
- /inventario:
- /saida:
- /conferir:
- Shared First Load:

Também registrar experiência perceptível:

- abertura inicial;
- abertura subsequente;
- abertura da câmera;
- troca de rota;
- resposta após scan.

Não inventar números sem medição.

## 15. Critério de interrupção imediata

Parar o teste e escalar se ocorrer:

- cross-workspace;
- acesso indevido;
- usuário legítimo bloqueado de forma sistêmica;
- saldo negativo;
- saldo/ledger divergentes;
- duplicação de movimento;
- barcode resolvendo material incorreto;
- posição incorreta persistida;
- falha generalizada da câmera por header;
- perda de dados;
- erro sistêmico de Auth/sessão/legal.

## 16. Reconciliação SaaS final

Antes de recomendar PASS FINAL:

1. buscar HEAD SaaS vivo;
2. comparar contra RC;
3. revisar Auth;
4. workspace/UG;
5. sessão;
6. Legal Gate;
7. lifecycle;
8. warehouseAccess;
9. Rules;
10. Warehouse Rules;
11. layout/shell;
12. repositories;
13. package/CI;
14. scanner dependencies;
15. CT-01.

Classificar:

- SEM DELTA;
- DELTA COMPATÍVEL;
- CONFLITO.

CONFLITO impede PASS FINAL.

## 17. Classificação permitida

Antes dos testes físicos e reconciliação final:

**PARCIAL TECNICAMENTE SAUDÁVEL / CERTIFICAÇÃO EM EXECUÇÃO**

Depois das evidências:

- PASS FINAL;
- PARCIAL;
- BLOQUEADA.

O Coordenador Mobile recomenda; o Program Control decide a barreira global.

## 18. Produção

Este runbook não autoriza:

- merge em main;
- deploy produtivo;
- Rules produtivas;
- migração;
- restore;
- lançamento público.

A certificação física deve ocorrer preferencialmente no Preview HTTPS do RC.
