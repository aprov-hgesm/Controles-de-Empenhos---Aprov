# VISUAL-R1 / WORKER 2 — VISUAL-LOADERS-01

Data: 2026-10-14
Base de partida verificada: main@97556bb8eb04af070016f9e58ddc2d9cca36bb35
Branch: visual-w2-loaders-01
Ownership: components/visual/*Loader*, components/visual/orbLoaderContract.ts,
components/visual/EmprovexOrbVisual.tsx, somente esta documentação.

## Contrato de isolamento

Entrega apenas a infraestrutura e a vitrine decorativa, sem alterar o motor de
partículas do Worker 1 nem os componentes existentes. Nenhuma integração operacional
está liberada antes do aceite estético explícito do Fundador.

Não modifica app/page.tsx, LoginStatusRail.tsx, OperationalSurfaceTransition.tsx,
Rules, Firebase, autenticação, queries, dependências, billing ou produção.

## Inventário de esperas confirmado por leitura do código

| Local | Condição real | Original | Decisão |
| --- | --- | --- | --- |
| app/page.tsx / OperationalSurfaceLoading | !activeOperationalDataReady | Spinner CSS e dois textos | Integrar somente após aceite do W1; preservar os textos |
| app/page.tsx / React.Suspense | activeOperationalDataReady e bundle do OperationalWorkspace pendente | Mesma tela de espera como fallback | Preservar o fallback e a montagem; sem timers |
| app/page.tsx / EmprovexAuthLoading | loadingAuth | LoginAtmosphere, LoginStatusRail, Loader2 e descrição contextual | Prioridade 2; substituir somente ícone quando aprovado |
| app/page.tsx / AppHeader | syncing ou !activeOperationalDataReady | Indicador de sincronização de cabeçalho | Sem substituição nesta etapa; sincronização em segundo plano é distinta |
| OperationalSurfaceTransition.tsx | Alteração de superfície/aba | Transição motion/blur com label | NÃO é carregamento; manter |
| EmprovexLogin / LoginSuccessTransition | Entrada e confirmação | Fluxos próprios de autenticação | Fora da integração inicial |

Outros spinners e estados locais de cards devem ser catalogados por contexto antes
de autorização para troca. A árvore do repositório não foi tratada como prova de
cobertura completa de todos os estados locais.

## API proposta ao Worker 1 e ao Coordenador

- OrbLoaderSize: hero (160), large (104), medium (64), small (40), mini (20);
  pixelSize é uma solicitação de dimensão visual, não uma promessa de resolução
  nativa da biblioteca original (que publica 20 e 64).
- OrbLoaderPerformance: full, balanced, static.
- OrbRendererProps: size, pixelSize, density, speed, intensity, paused.
- OrbRenderer: React ComponentType<OrbRendererProps>, injetado pelo integrador.
- EmprovexOrbVisual: slot puramente decorativo, aria-hidden, com fallback neutro.
- EmprovexOrbLoader: loading boolean obrigatório + label real; só emite role=status
  durante loading=true. Sem relógio, atraso ou dados.
- EmprovexLoadingBoundary: state explícito loading | ready | error.
  Erros requerem conteúdo próprio e nunca são mascarados com o indicador.
- EmprovexLoaderShowcase: vitrine isolada de cinco tamanhos, sem mount em rotas
  ou alteração de estado operacional.

As sugestões de densidade, velocidade e intensidade são números normalizados;
o W1 decide se o motor aprovado suporta esses parâmetros e, caso contrário, W5
produz um adaptador sem modificar silenciosamente a semântica do núcleo. O
renderizador não deve anunciar termos de raciocínio ou inteligência artificial.

A implementação do slot pausa por visibilitychange, respeita
prefers-reduced-motion via useReducedMotion e tem fallback sem animação nos modos
static/reduced motion/aba oculta. O renderizador final deve também implementar
suspensão quando estiver fora do viewport e governança de rAF/CPU/GPU.

## Regras de integração por parte de W5 (após aceite estético do W1)

1. Em OperationalSurfaceLoading, manter o section/testid/altura/copys atuais e
   substituir somente o spinner, usando o adaptador com preset medium.
2. Em EmprovexAuthLoading, manter LoginAtmosphere, LoginStatusRail,
   phase session/workspace e a descrição; substituir somente Loader2 após
   aprovação, usando small ou medium conforme o espaço do painel.
3. Não reescrever a condição !activeOperationalDataReady, fallback Suspense,
   loadingAuth, signin, sincronização em background ou erro do contexto de acesso.
4. Se renderizador W1 não estiver disponível, a integração deve manter o
   indicador existente ou usar fallback neutro, nunca criar um orbe alternativo.
5. Testar 1440x900, 1366x768, 844x390, 390x844, 545x374; toggle de
   reduced motion; esconder/exibir a aba; fluxo loading -> ready e loading ->
   error; monitorar ausência de flash, CLS e custo CPU/GPU.

## Verificação técnica / limitações

- Código isolado não está importado por telas do produto.
- Preview é um componente React para renderização controlada em ambiente de
  desenvolvimento; não é prova visual da biblioteca original.
- CI de TypeScript, build e diff hygiene deve ser aferido no commit/PR,
  não inferido de revisão estática.
- Integração funcional, E2E e medição CPU/GPU aguardam renderizador aprovado.

## Handoff executivo

ONDE ESTAMOS: visual-w2-loaders-01, DRAFT próprio, sem merge.
O QUE ESTAMOS FAZENDO: cinco presets, slot decorativo, boundary de estados reais,
vitrine e contrato público para integração do renderer W1.
QUEM ESTÁ FAZENDO: Worker 2 — VISUAL-LOADERS-01.
O QUE FAZER A SEGUIR: Coordenador VISUAL-R1 e W1 pactuam propriedades finais;
após aceite estético, W5 integra em arquivos operacionais e realiza CI/E2E/perf.
QUEM FARÁ: Coordenador VISUAL-R1, Worker 1 e Worker 5.
