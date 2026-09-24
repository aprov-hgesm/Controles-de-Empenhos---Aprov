# EMPROVEX — Fluxo Oficial de Desenvolvimento, CI e Cloud Shell

Este documento registra a política oficial de desenvolvimento assistido do EMPROVEX.

Ele se aplica ao projeto inteiro e deve ser considerado junto da `main`, dos documentos de arquitetura e das memórias específicas de cada módulo.

## 1. Princípio geral

O objetivo do processo de validação é **proteger o sistema sem transformar cada pequena alteração em uma regressão completa obrigatória**.

A estratégia oficial passa a ser:

> pré-validação manual direcionada → CI seletivo por impacto → E2E completo quando o risco funcional justificar.

A segurança não deve ser reduzida. O que muda é a granularidade: cada tipo de alteração deve executar a bateria de testes proporcional ao risco introduzido.

## 2. Cloud Shell como parte ativa do desenvolvimento

O Cloud Shell não deve ser tratado apenas como último recurso.

O operador/fundador pode participar ativamente da execução técnica quando isso:
- reduz o tempo de espera do CI;
- valida rapidamente uma hipótese;
- antecipa um guard específico;
- permite build, deploy ou inspeção que o agente não consegue concluir diretamente;
- evita múltiplas rodadas longas no GitHub Actions.

O padrão é colaborativo:
1. o agente identifica exatamente o que precisa ser validado;
2. fornece um bloco curto e seguro de comandos;
3. o operador executa no Cloud Shell;
4. retorna somente a saída relevante;
5. o agente usa o resultado para corrigir ou avançar.

Essa participação manual é **uma ferramenta normal de aceleração**, não uma falha de autonomia.

## 3. Regras práticas do Cloud Shell

Preferências oficiais:

- usar clones persistentes em `~/...` quando o trabalho puder atravessar reinicializações de sessão;
- evitar depender de `/tmp` para clones importantes, pois o conteúdo pode desaparecer quando a sessão é reciclada;
- antes de testar, confirmar a branch e o commit com `git rev-parse HEAD`;
- atualizar a branch com `git fetch` + `git reset --hard origin/<branch>` quando o clone for exclusivamente de validação;
- rodar primeiro guards leves e diretamente relacionados ao diff;
- evitar `npm ci`, `npm run build` e Browser E2E quando não forem necessários para o diagnóstico;
- executar testes pesados somente quando agregarem evidência nova;
- preferir comandos independentes, um por vez, quando houver risco de a sessão ser interrompida;
- não usar `set -euo pipefail` de forma persistente em sessão interativa sem necessidade, pois isso pode fazer a shell encerrar o fluxo no primeiro erro e confundir diagnóstico;
- verificar espaço em disco e memória antes de builds pesados;
- não presumir deploy concluído sem confirmação objetiva.

## 4. Níveis oficiais de validação

### Nível A — Pré-validação rápida

Executada preferencialmente no Cloud Shell antes de um novo push quando houver risco de repetir um CI longo.

Deve incluir apenas o necessário para o domínio alterado, por exemplo:
- guards específicos;
- testes unitários/de domínio relacionados;
- TypeScript quando relevante;
- build apenas quando a alteração afetar compilação, bundle ou integração ampla.

Objetivo: detectar rapidamente erros locais e guards desatualizados antes de consumir uma rodada completa de CI.

### Gate zero — EMPROVEX Core Protection

Desde 2026-09-24, todo PR funcional executa também o workflow leve `.github/workflows/emprovex-core-protection.yml`.

Características:
- não executa `npm ci`;
- valida a fronteira do núcleo antes da suíte longa;
- impede imports da implementação do ADM Depósito pelo core operacional;
- impede que o ADM comande mutações de NF, Empenho, Cronograma ou Avisos;
- garante que as Rules operacionais não dependam do namespace `warehouse`;
- garante que recebimento de NF seja confirmado antes de efeitos auxiliares como alerta informativo e PDF/Drive;
- repete os guards de isolamento EMPROVEX/ADM e da fundação da FASE 0.

Uma falha neste gate é bloqueante e deve ser corrigida antes de investigar otimizações ou prosseguir com a fase funcional.

Documento arquitetural: `docs/EMPROVEX_CORE_PROTECTION.md`.

### Nível B — CI rápido de Pull Request

Diretriz alvo do projeto:

- TypeScript;
- higiene do diff;
- build;
- guards estruturais relacionados aos arquivos alterados;
- testes de domínio relacionados;
- smoke test de navegador quando necessário.

O CI deve evoluir para usar seleção por impacto/path filtering, evitando executar subsistemas sem relação com o diff.

Exemplo:
- mudança apenas em `features/inicio/**/*.css` não deve obrigar uma regressão completa de SAG, ADM Depósito, Drive e autenticação;
- mudança em hooks de NF, ações Firestore ou fluxo de cadastro deve acionar os testes funcionais correspondentes.

## 5. Browser E2E seletivo

O Browser E2E completo **não precisa rodar em toda alteração**.

Ele é obrigatório quando a mudança altera um fluxo que o usuário realmente executa no navegador, especialmente:
- login, logout, autenticação ou provisionamento;
- navegação funcional;
- formulários;
- cadastro, edição ou exclusão;
- envio, confirmação ou tramitação de Nota Fiscal;
- Comissão → Tesouraria;
- persistência ou reload;
- upload/visualização de documentos;
- Google Drive;
- SAG;
- ações administrativas;
- ADM Depósito quando houver nova interação operacional;
- mudanças em hooks/actions que alterem comportamento visível;
- mudanças de Firestore/Rules que façam parte de uma jornada de UI.

Em geral, o E2E completo não é necessário para:
- alterações puramente visuais em CSS;
- mudança de cor, brilho, espaçamento ou textura;
- remoção de decoração sem alterar interação;
- documentação;
- texto/copy;
- guards estáticos;
- funções puras já cobertas por teste de domínio.

Se uma alteração visual tocar também hitbox, clique, navegação, focus, tooltip interativo ou ação do usuário, deve existir pelo menos um smoke/E2E direcionado para esse comportamento.

## 6. Smoke E2E

O projeto deve preferir um smoke E2E curto para PRs de baixo risco quando houver necessidade de validar navegador sem executar a regressão completa.

Exemplo de smoke:
1. abrir aplicação;
2. autenticar;
3. confirmar Home;
4. navegar para uma superfície principal;
5. confirmar renderização/interação básica;
6. sair.

O smoke não substitui E2E completo para fluxos funcionais novos ou alterados.

## 7. E2E completo

A suíte completa continua sendo importante e deve permanecer disponível para:
- mudanças funcionais relevantes;
- integração de capacidades;
- merge/release quando o risco justificar;
- validação manual antes de publicação importante;
- execução periódica/agendada;
- investigação de regressões;
- alterações em infraestrutura compartilhada.

A meta é mover a suíte completa de “sempre em qualquer PR” para “quando o impacto exigir”.

## 8. Paralelização do CI

O workflow deve evoluir de um job monolítico para grupos independentes, sempre que viável:

- Core / TypeScript / build;
- Auth / segurança / multi-tenant;
- NF / Empenhos / Relatórios / SAG;
- Home / experiência visual;
- ADM Depósito;
- escalabilidade / telemetria;
- Browser E2E.

Benefícios esperados:
- falhas aparecem mais cedo;
- um guard tardio não força reexecução sequencial de tudo;
- domínios não relacionados podem terminar em paralelo;
- a causa de falha fica mais clara.

## 9. Regra de não bypass

Pré-validação manual não autoriza ignorar um erro real.

Quando um guard aponta uma incompatibilidade legítima entre funcionalidades, a correção deve ser feita antes do merge.

Um CI vermelho só pode ser tratado como não bloqueante quando houver evidência clara de falha externa ou infraestrutura não relacionada ao código, devidamente identificada, por exemplo:
- build-rate-limit da Vercel;
- indisponibilidade externa;
- status duplicado já coberto por gate equivalente.

## 10. Estação local e cadência consolidada do ADM Depósito

Desde 2026-09-24, o desenvolvimento do ADM Depósito adota uma estação local de validação como ambiente preferencial de feedback rápido.

Capacidades disponíveis localmente:
- Node/Java;
- Firebase Auth + Firestore Emulator;
- Next.js local;
- Playwright;
- Chromium headless;
- suíte de segurança multi-tenant;
- Browser E2E.

Cadência oficial para as fases restantes do ADM:
1. desenvolver a capacidade;
2. executar Core Protection/isolamento e guards rápidos;
3. executar somente testes direcionados que correspondam ao domínio alterado;
4. continuar a implementação quando esses gates estiverem verdes;
5. após o fechamento funcional das capacidades restantes, executar a regressão pesada completa localmente;
6. corrigir de forma consolidada as falhas encontradas;
7. repetir os testes afetados e, ao final, a suíte completa;
8. usar GitHub CI como certificação final antes do fechamento/merge/release correspondente.

Esta regra não autoriza acumular uma falha conhecida:
- gate de Core Protection vermelho é bloqueante imediato;
- teste direcionado que demonstra regressão real deve ser corrigido antes de seguir;
- o que é diferido é a **repetição da regressão pesada completa**, não a correção de defeitos conhecidos.

Para o ADM Depósito, a FASE 13 continua sendo o gate formal de validação integrada e fechamento do piloto fundador.

## 11. Estado de implementação desta política

Esta documentação registra a **diretriz oficial**.

### 11.1 Alterações exclusivamente documentais — regra já implementada

Desde 2026-09-24, o `.github/workflows/application-ci.yml` usa `paths-ignore: docs/**` em `pull_request` e em pushes para `main`.

Regra permanente:
- se o diff contiver **somente arquivos em `docs/**`**, o Application CI não deve ser disparado;
- isso inclui atualização de ROADMAP, STATUS, HANDOFF, documentação técnica e memória operacional oficial;
- se o mesmo diff incluir qualquer arquivo fora de `docs/**`, a alteração deixa de ser documental-only e volta a seguir o CI normal;
- mudanças em código, Firestore Rules, scripts, testes, configuração, workflows ou infraestrutura **não** podem usar esta exceção;
- `workflow_dispatch` continua disponível para execução manual quando houver motivo objetivo;
- o workflow `Recovery guardrails` mantém seu próprio filtro de paths e só roda quando seus arquivos de recuperação forem afetados.

Objetivo: permitir que o fechamento documental posterior a uma fase já validada seja registrado sem repetir TypeScript, Firebase Emulator e Browser E2E sem evidência técnica nova.

### 11.2 Próximas otimizações

O restante da otimização do CI continua evolutivo:
- path filtering por domínio;
- jobs paralelos;
- smoke E2E;
- E2E seletivo;
- regressão completa sob condição apropriada;
- melhor reaproveitamento/cache de dependências e Playwright.

## 12. Regra para futuros chats/agentes

Antes de iniciar uma fase relevante:
1. consultar a `main`;
2. identificar os arquivos/domínios que serão alterados;
3. planejar os testes proporcionais ao impacto;
4. usar Cloud Shell de forma ativa quando isso economizar uma rodada longa;
5. preferir pré-validação direcionada antes de novo push;
6. não exigir intervenção manual para tarefas que o agente pode executar diretamente;
7. quando a intervenção do operador for útil, fornecer comandos curtos, copiáveis e de baixo risco;
8. preservar CI completo/E2E quando a mudança realmente afetar jornada de usuário.

Última consolidação: 2026-09-24.
