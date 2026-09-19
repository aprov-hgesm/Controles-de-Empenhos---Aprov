# EMPROVEX — Bloco 10 — diagnóstico e saneamento histórico

## Objetivo

O Bloco 10 adiciona uma camada explícita de diagnóstico para dados criados antes das invariantes atuais de CNPJ, identidade de NF, UG + NS, locks e auditoria.

O princípio central é:

> **diagnosticar tudo; reparar automaticamente apenas o que pode ser provado como inequívoco no estado atual.**

O EMPROVEX não inventa dados históricos e não transforma a configuração atual do workspace em prova de um fato passado.

## Superfície operacional

O operador acessa:

```text
Relatórios → Integridade
```

A execução do diagnóstico é somente leitura. Cada achado recebe:

- código estável;
- severidade;
- entidade afetada;
- evidência objetiva;
- classificação de reparabilidade;
- explicação do motivo.

As classes de reparabilidade são:

```text
automatic        → reparo seguro disponível
manual_review    → exige conferência documental/humana
diagnostic_only  → informativo; nenhuma escrita oferecida
```

## Inconsistências detectadas

### CNPJ

- CNPJ inválido no empenho;
- CNPJ ausente na NF;
- CNPJ inválido já persistido na NF;
- divergência de CNPJ entre NF e empenho.

CNPJ **existente porém inválido** nunca é tratado como campo vazio. Ele exige revisão documental.

O único backfill automático de CNPJ ocorre quando:

1. a NF não possui CNPJ;
2. a NF não possui NS;
3. o empenho existe;
4. o CNPJ do empenho é matematicamente válido;
5. a condição continua verdadeira no momento da transação.

## Identidade física da NF

O diagnóstico verifica:

- `recordKey` ausente;
- `recordKey` divergente do ID físico;
- ID físico diferente da identidade canônica CNPJ + número da NF.

O campo `recordKey` só pode ser preenchido automaticamente quando a NF não possui NS e o ID físico já é exatamente a chave canônica esperada.

Migração física de documento continua sendo fluxo de revisão controlada; o Bloco 10 não move NFs ambíguas.

## NS e UG

O diagnóstico verifica:

- formato inválido de NS;
- UG sem número de NS;
- NS sem UG;
- UG da NS divergente da UG do workspace;
- duplicidade da mesma identidade UG + NS.

A única limpeza automática de campos nessa categoria é remover uma `nsUg` órfã quando a NF não possui `numeroNS`.

### Regra crítica

Uma NS histórica sem UG **não recebe automaticamente a UG atual do workspace**.

Mesmo quando existe lock legado, isso não é considerado prova suficiente da UG histórica. O achado permanece em revisão humana.

## Locks de NS

O diagnóstico reconhece:

- lock canônico ausente;
- lock canônico pertencente a outra NF;
- metadados do lock divergentes;
- lock legado migrável;
- lock legado redundante;
- lock órfão.

Reparos automáticos de lock exigem revalidação transacional.

São elegíveis:

- reconstrução de lock canônico quando a NF já possui identidade UG + NS válida e única;
- atualização de metadados quando a propriedade do lock não mudou;
- migração de lock legado para canônico quando a própria NF já possui UG canônica;
- remoção de lock legado redundante quando o canônico equivalente existe;
- remoção de lock órfão quando a NF proprietária continua inexistente.

Conflito de propriedade ou NS duplicada nunca é resolvido escolhendo um vencedor automaticamente.

## Revalidação antes de escrever

O diagnóstico não é autorização permanente para reparo.

Entre o scan e o clique do operador, os dados podem mudar. Por isso, cada reparo lê novamente os documentos relevantes dentro de uma transação Firestore e aborta se a evidência tiver mudado.

Exemplos:

- se uma NF que estava sem NS passa a possuir NS, o backfill automático de CNPJ é bloqueado;
- se o lock passou a pertencer a outra NF, a reconstrução é bloqueada;
- se uma NF reaparece, o lock anteriormente órfão não é removido.

## Auditoria

Todo reparo efetivo gera:

```text
operation = historical.repair
source = system
```

O evento é gravado na mesma transação do saneamento e registra:

- issueId;
- issueCode;
- repairKind;
- severidade;
- evidência original;
- estado antes;
- estado depois;
- ator autenticado;
- workspace e UG;
- correlationId.

A trilha continua append-only conforme o Bloco 8.

## Isolamento multi-tenant

O diagnóstico usa exclusivamente o `OperationalDataScope` da sessão atual.

O operador não fornece `workspaceId` ao scanner nem ao reparador. O workspace é resolvido a partir da identidade autenticada e das mesmas regras usadas pelo restante do sistema.

Na coleção `settings`, o scanner não faz leitura ampla: consulta apenas IDs no intervalo `sagNsLock_*`, evitando usar contador do termo, configuração do Drive ou outros settings sem relação com integridade de NS.

As Firestore Rules permitem `list` de `settings` somente ao setor autenticado do próprio workspace. Isso existe para que o Firestore consiga autorizar a consulta por prefixo; não existe bypass administrativo nem acesso cross-tenant. O Emulator prova tanto a consulta permitida no próprio workspace quanto a negação da mesma consulta em outro workspace.

## Browser E2E

A fixture E2E contém propositalmente uma NF histórica sem CNPJ, mas com vínculo inequívoco a um empenho de CNPJ válido.

A jornada automatizada executa:

```text
login
→ Relatórios
→ Integridade
→ executar diagnóstico
→ detectar invoice_missing_supplier_cnpj
→ reparar com segurança
→ novo diagnóstico limpo
→ reload
→ novo diagnóstico limpo
```

Assim, a validação atravessa UI, serviço de diagnóstico, transação de reparo, Firestore Rules, auditoria e persistência.

## O que o Bloco 10 não faz

- não adivinha CNPJ;
- não adivinha UG histórica;
- não escolhe proprietário de NS duplicada;
- não move documento com identidade ambígua;
- não apaga lock com proprietário ainda existente;
- não cria eventos retroativos fictícios para operações antigas.

## Critério de aceite

O Bloco 10 está pronto quando:

1. o motor classifica inconsistências sem mutar dados;
2. casos ambíguos não oferecem reparo automático;
3. reparos elegíveis são transacionais e idempotentes;
4. reparos são auditados;
5. a aba Integridade funciona para o workspace autenticado;
6. Browser E2E prova diagnóstico + reparo + persistência;
7. guard permanente do Bloco 10 passa;
8. Application CI, Emulator, TypeScript e build de produção permanecem verdes.
