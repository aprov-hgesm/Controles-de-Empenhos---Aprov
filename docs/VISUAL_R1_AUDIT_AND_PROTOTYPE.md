# VISUAL-R1 — Auditoria A + protótipo B (conceito A: Nebula Core)

**Data:** 2026-10-14
**Branch isolada:** `visual-r1-thinking-orbs-01`
**Base confirmada da main:** `97556bb8eb04af070016f9e58ddc2d9cca36bb35`
**Release Candidate protegido:** `61e372225834ed6060cd2b36dbdd55d1e1979c2c`
**Situação:** VISUAL-A PASS documental; VISUAL-B PARTIAL — conceito implementado isoladamente, aguardando aprovação estética, testes reais e integração.

## Escopo entregue

- Componente novo: `features/inicio/components/EmprovexThinkingOrb.tsx`.
- Estilização nova: `features/inicio/components/EmprovexThinkingOrb.module.css`.
- Sem alterações em `InicioCore.tsx`, `InicioView.tsx`, `app/page.tsx`, nos carregamentos existentes ou em contratos de negócio.
- Nenhuma dependência nova, acesso a rede, temporizador de carregamento, Canvas/WebGL ou operação de produção.

## Auditoria do núcleo e seus contratos

- `InicioView.tsx` posiciona o `InicioCore` na região `system`, dentro da cena e da constelação.
- `InicioCore.tsx` mantém a descrição agregada de empenhos/valor e uma telemetria sob foco/hover que contém: **avisos (críticos e atenção), recebimentos pendentes, valor de recebimentos, execução comprometida/recebida/percentual, estado do painel e classes QR, CALI, PASA, FUNADOM com quantidades e valores**.
- `InicioCore.module.css` usa `data-inicio-star-exclusion='core'`; a constelação lê a geometria dessa exclusão para afastar estrelas/elementos selecionáveis.
- `InicioView.tsx` define `allowSceneParallax=false`, `enableFineMotion=false` e `interactiveMotion={false}`. Isso foi intencional por desempenho; não reverter indiscriminadamente.
- O núcleo já contém `useReducedMotion` e resposta leve ao ponteiro, porém inativa na instância atual.
- `useInicioPerformanceProfile` define `full`, `balanced`, `static` com hardware, memória, ponteiro, reduced motion e visibilidade.
- `InicioView.module.css` pausa animações na aba oculta e mantém tamanhos/limites específicos para telas pequenas.
- Risco: atualmente o tooltip do núcleo fica oculto em ponteiro coarse; durante a integração final, preservar a telemetria e avaliar alternativa realmente utilizável em touch, sem retirar controles.

## Candidatos a carregamento

| Candidato | Estado atual | Decisão |
| --- | --- | --- |
| `OperationalSurfaceLoading.tsx` | Spinner CSS + textos de sincronização de seção | Prioridade 1 após aprovar a estética; variante medium com texto atual |
| `EmprovexAuthLoading.tsx` | `Loader2` + LoginAtmosphere e LoginStatusRail | Prioridade 2; avaliar sem alterar sessão/estados de identidade |
| `OperationalSurfaceTransition.tsx` | Transição de entrada, **não é loading** | Não substituir nesta fase |
| Cards e estados de loading adicionais | Ainda exigem inventário dedicado | Não modificar automaticamente |

## Avaliação de concorrência

- PR #286 (`rc-r1-preview-blockers-fix-01`, DRAFT) foi inspecionado.
- Arquivos alterados: workflow RC, rota intake, `app/page.tsx`, apresentação Warehouse e teste de logout.
- Os arquivos introduzidos por VISUAL-B não se sobrepõem à lista do PR #286.
- **Não editar `app/page.tsx`**, não alterar PR #286, RC ou produção.

## Arquitetura do componente conceitual

- API: `size='hero'|'large'|'medium'|'small'|'mini'`, `performance='full'|'balanced'|'static'`, `state='decorative'|'loading'`, `interactive`, `paused`, `label`, `className`.
- `decorative`: aria-hidden, não cria status operacional fictício.
- `loading`: `role=status` + etiqueta acessível; usar **somente** dentro de carregamento verdadeiro controlado pelo módulo original.
- Efeito CSS orgânico com transform/opacity e gradientes; sem dependência externa e sem animação de borda que altere layout.
- Pequenas dimensões reduzem camadas; `balanced` e `static` pausam os efeitos; `prefers-reduced-motion` elimina animações.
- Interatividade limita-se à variante hero em dispositivo com ponteiro fino; um rAF ocorre somente após o movimento e cessa ao estabilizar, ficando cancelado no cleanup/aba oculta.
- A avaliação de desempenho em navegador real com CPU/GPU e testagem de teclados/toque permanece **pendente**.

## Próxima integração, condicionada à aprovação estética

1. Preservar o `InicioCore` como contêiner operacional: aria, tooltip/telemetria, exclusão de estrelas, foco e posicionamento; substituir **somente a ilustração central** pelo `EmprovexThinkingOrb`.
2. Receber `performanceMode` e `ambientPaused` do perfil já existente; não reativar parallax nem movimentos de cena.
3. Avaliar visualmente em 1440×900, 1366×768, 844×390, 390×844 e 545×374.
4. Rodar `npm run typecheck`, `npm run build`, guards de Home/experiência e testes E2E pertinentes.
5. Só após aceite do núcleo, usar as variantes medium/large nos carregamentos seguros, sem alterar condições de resolução da espera.

## Governança e gates

**ONDE ESTAMOS:** protótipo novo em branch isolada; `main` e RC preservados.
**O QUE ESTAMOS FAZENDO:** consolidar proposta estética e manter rastreabilidade.
**QUEM ESTÁ FAZENDO:** Coordenador VISUAL-R1.
**O QUE FAZER A SEGUIR:** revisão estética do Fundador, depois testes e integração controlada.
**QUEM FARÁ:** Fundador aprova visual; Coordenador executa VISUAL-C/D/E; Coordenador Geral revê compatibilidade de release.

**Classificação:** VISUAL-A PASS (auditoria estática); VISUAL-B PARTIAL (código/protótipo sem testes de aplicação). Não é aprovação de produção.

## VISUAL-ORB-CORE-01 — Worker 1 (candidato isolado, aguardando aceite)

- Base GitHub verificada: PR #288 HEAD `4224a51230b123c6bee7237ea233f66a806401ad`; branch de execução `visual-w1-orb-core-01` (PR próprio encadeado).
- A hipótese estética anterior de `Nebula Core` foi rejeitada. Substituídos o TSX/CSS do candidato isolado por Canvas 2D, geometrias e presets originais do MIT `Jakubantalik/thinking-orbs` (versão upstream 0.3.1).
- Fonte preservada integralmente em `features/visual-orbs/vendor/thinking-orbs/`, incluindo `LICENSE`; sem dependência NPM nova e sem WebGL, gradients, bolhas azuis, filamentos ou serviços de rede.
- Presets `20` e `64` continuam distintos. As variantes `hero=136`, `large=116`, `medium=72`, `small=42`, `mini=20` usam escala de transformação de Canvas, sem editar geometria, distribuição, contraste ou velocidades nativas. `hero` cabe em até 98 px no mobile.
- 9 estados nativos são configuráveis. A opção de referência é `working`, com pontos girando nas órbitas; o modo `searching` usa meridiano pontilhado. Interação translacional máxima de 1,8 px só no perfil `full` com ponteiro fino.
- `full` até 45 FPS, `balanced` até 20 FPS e `static` sem loop; reduced-motion captura quadro estático, hidden-tab e IntersectionObserver suspendem frames, ResizeObserver calibra DPR de no máximo 2. Cleanup cancela RAF e observers/listeners.
- Acessibilidade: variante `decorative` é oculta de leitor de tela; a variante `loading` apresenta status apenas se realmente usada para carregamento (o W2 decide loaders). O Canvas nunca intercepta ações da Home.
- Demonstração executável em `npm run dev` no endereço `http://localhost:3000/dev/visual-orb`, com seletores para nove estados, tamanhos, perfis, pausa e interação. A rota retorna 404 fora de desenvolvimento.
- `InicioCore.tsx`, `InicioCore.module.css`, `InicioView.tsx`, `useInicioPerformanceProfile.ts` e `app/page.tsx` permanecem intactos. Nenhuma substituição do núcleo operacional antes da aprovação estética explícita.
- Higiene: espaços finais removidos deste documento na branch do Worker 1, corrigindo a causa conhecida do `git diff --check` vermelho em #288. Novo CI e testes reais ainda precisam ser verificados no HEAD próprio.
- Responsabilidade compartilhada: congelar mudanças simultâneas no mesmo TSX/CSS do W1 antes da integração pelo Coordenador. Nenhum merge, deploy de produção, alteração em Rules/Firestore/autenticação/RC.

## Decisão de isolamento — guard Bloco 19.14

O CI do HEAD `3ee65283` (`Application CI #38522074356`) falhou no `Block 19.14 final closure guard` com a mensagem `[BLOCK] Início adicionou Canvas.` O script `scripts/verify-block-19-14-final-closure.mjs` proíbe literalmente `<canvas` em qualquer arquivo TS/TSX/CSS sob `features/inicio`. Esse guard é parte do contrato econômico da Home e não pode ser afrouxado silenciosamente por este worker.

**Solução nesta branch:** remoção do candidato originalmente adicionado a `features/inicio/components/EmprovexThinkingOrb.*` (sem tocar em `InicioCore`, `InicioView` ou nas rotinas operacionais) e relocação dos arquivos novos para `features/visual-orbs/components` e `features/visual-orbs/vendor/thinking-orbs`. O protótipo continua isolado em `app/dev/visual-orb/page.tsx`, apenas na execução local development. **O Canvas não faz parte da Home.** Nenhum guard, teste, Rules ou configuração de deploy foi alterado.

A integração futura do Canvas na Home exigirá revisão explícita pelos Coordenadores VISUAL-R1 e Geral R1 sobre a compatibilidade entre a nova demanda e o guard 19.14, seguida de autorização do Fundador, orçamento de FPS/desempenho e E2E. Simplesmente esconder o Canvas atrás de imports para satisfazer um grep não seria certificação funcional.

## VISUAL-ORB-POLISH-02 — cintilação e volume esférico (sem integração)

A pedido do Fundador, o candidato `working` ganha dois parâmetros independentes: `sparkle` (padrão 0,68), para cintilações brancas e efêmeras das partículas móveis, e `roundness` (padrão 0,72), para uma nuvem de pontos distribuída em uma superfície esférica via Fibonacci lattice. Ambos aceitam valores de 0 a 1; quando ambos são zero, os quadros originais seguem sem modificação. O filtro `polishWorkingFrame` permanece FORA do diretório protegido `features/inicio` e não altera a geometria/licença do upstream MIT.

A camada adicional usa somente pontos Canvas 2D em escala de cinza, sem filtros, gradientes, linhas, filamentos ou WebGL. Efeitos somente na animação `working`, mantendo os oito outros estados intocados. O comportamento de preferência de movimento reduzido, estático, visibilidade, limpeza de listeners e DPR é herdado do componente isolado. Na rota `/dev/visual-orb`, existem sliders de esfericidade/cintilação para comparar ao original (0/0). Este commit é somente um novo candidato de aprovação estética; NÃO há autorização de integração com a Home nem liberação do guard Block 19.14.
