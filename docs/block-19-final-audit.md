# Bloco 19.14 — auditoria final e fechamento técnico

## Status

**Fechamento técnico do Bloco 19: pronto para homologação humana.**

Este documento encerra o desenvolvimento técnico da nova experiência `Início` sem promover a PR para merge, sem alterar o landing pós-login e sem realizar deploy de produção.

## Escopo auditado

A auditoria final cobre:

- fundação e separação Início/Painel;
- cenário cinematográfico;
- núcleo EMPROVEX;
- sistema orbital;
- constelação operacional;
- identidade de UG/workspace;
- retomada e atalhos;
- microinterações;
- transições entre superfícies;
- snapshot econômico por UG;
- performance/GPU/reduced motion;
- responsividade;
- polimento visual final.

## Contrato de custo Firestore

O estado final preserva:

```
Início
→ 0 coleções operacionais brutas
→ 1 documento realtime homeSnapshot por workspace/UG
→ até 72 estrelas agregadas
```

Empenhos, Alertas, Invoices, Comissões e Cronogramas permanecem desligados no perfil realtime do Início.

O `homeSnapshot` é um dado derivado de apresentação e não substitui as coleções operacionais como fonte de verdade.

## Segurança e multitenancy

Validado automaticamente:

- snapshot vinculado ao próprio workspace e UG;
- leitura cross-workspace negada;
- UG divergente rejeitada;
- máximo de 72 estrelas aplicado pelas Rules;
- delete do snapshot negado;
- usuário externo do workspace B não enxerga dados do workspace A;
- regras operacionais continuam workspace-scoped;
- conta setorial continua submetida ao limite de sessões.

## Testes de operador externo automatizados

A suíte Browser E2E com Firebase Emulator usa dois operadores/workspaces setoriais independentes.

Cobertura:

- login setorial por e-mail/senha;
- autorização do operador;
- persistência após reload;
- isolamento entre dois workspaces;
- perfil realtime por superfície;
- Início econômico com um único documento operacional realtime;
- snapshot pronto após publicação;
- quatro viewports responsivos;
- duas sessões simultâneas permitidas para o setor;
- múltiplas abas da mesma instância compartilham a mesma vaga;
- terceira sessão independente é barrada;
- liberação de vaga após logout;
- fluxo de logout ao final dos testes.

Esses testes são equivalentes a operadores externos do ponto de vista de autenticação, workspace, Rules e navegador, mas rodam contra Firebase Emulator.

## Teste externo real — limite da auditoria automática

Ainda **não** é correto afirmar que cinco pessoas/contas reais utilizaram o ambiente de produção simultaneamente.

A homologação humana planejada com aproximadamente cinco contas externas deve ser feita após disponibilização de um ambiente acessível para teste e deve observar:

1. login simultâneo;
2. conexão Drive de cada setor;
3. upload e visualização de documentos;
4. troca entre Início, Painel e módulos;
5. constelação e snapshot;
6. impressão/visualização de PDFs;
7. comportamento mobile;
8. encerramento e retomada de sessão;
9. mensagens de erro e alertas;
10. telemetria/cotas durante o período.

Essa homologação é um **gate operacional pré-merge/pre-produção**, não uma lacuna de implementação do Bloco 19.

## Performance

Validado:

- RAF de parallax, retículo e núcleo é sob demanda;
- aba oculta pausa animações;
- perfis full/balanced/static;
- reduced motion;
- redução para hardware/touch limitado;
- sem WebGL/Three.js;
- sem Canvas na experiência Início;
- chrome final sem animação, blur ou backdrop-filter;
- nenhum listener Firestore novo introduzido por performance/polimento.

## Responsividade

Browser E2E cobre:

- 360 × 800;
- 390 × 844;
- 768 × 1024;
- 844 × 390.

Valida ausência de overflow horizontal e confinamento da identidade e dock à cena.

## Landing e rollout

O Dashboard/Painel permanece como landing pós-login:

```ts
useState<OperationalActiveTab>('painel')
```

A promoção automática do Início para landing deve ser uma decisão posterior à homologação humana.

## Estado da PR

A PR do Bloco 19 deve permanecer **Draft** até decisão explícita de homologação/merge.

O fechamento técnico não autoriza automaticamente:

- merge na `main`;
- deploy em produção;
- mudança do landing;
- teste com credenciais reais;
- alteração de cobrança/plano Firebase.

## Critério de fechamento técnico

O Bloco 19 pode ser considerado tecnicamente encerrado quando, no mesmo commit:

- todos os guards 19.1–19.14 passam;
- TypeScript passa;
- build de produção passa;
- diff hygiene passa;
- Browser E2E + Firebase Emulator passa;
- Recovery guardrails passa;
- Block 19 Final Closure Gate passa;
- branch permanece 0 commits atrás da `main`.
