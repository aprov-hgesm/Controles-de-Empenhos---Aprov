# EMPROVEX VISUAL-R1 — W5 — Handoff de integração

Data: 2026-10-14
Branch: `visual-r1-integration-01`
Base: `main@97556bb8eb04af070016f9e58ddc2d9cca36bb35`
Estado: COMPOSIÇÃO DRAFT / HOMOLOGAÇÃO PENDENTE

## SHAs de origem e ownership
- W1 #292: `1802e1b47191f3758f346deca6f89c25627ae722` — exclusivamente `features/visual-orbs/**` e rota `app/dev/visual-orb/**`. **Monocromático neste SHA**.
- W2 #291: `670a77bcffa0d2fcf746d5b0a4bda181380b0d54` — cinco componentes/contratos em `components/visual`, contrato ajustado só na branch W5.
- W3 #293: `fc26033297bb8b637a1a8461793fb37eb7d4c603` — `features/relatorios/components/**` (reaproveitado sobre a mesma base), auditoria documental.
- W4 #294: `8237e52bbd75a642d0208eedd7fb58e24807164f` — `components/visual/**` (Border Beam), laboratório, licença MIT, teste E2E e handoff.
- W5: `EmprovexThinkingOrbRenderer.tsx`, `EmprovexVisualIntegrationPreview.tsx`, `app/dev/visual-r1/page.tsx` e este relatório.

## Matriz de conflitos e decisões
| Conflito | Decisão W5 | Risco residual |
| --- | --- | --- |
| W1 encadeado ao #288 com bolhas Nebula rejeitadas | Selecionar apenas subárvore `features/visual-orbs` e rota W1 dev; **não incorporar os arquivos `features/inicio/components/EmprovexThinkingOrb.*`**, nem a branch/PR #288 | Conferir diff final |
| W1 API `size/performance/animation/speed/paused/roundness/sparkle` vs W2 `size/pixelSize/density/speed/intensity/paused` | Adaptador traduz tamanho e perfil/velocidade/pausa; usa escala CSS nos presets 136/116/72/42/20 sem alterar o motor nativo 20/64. Density/intensity não são implementados por W1: não simular parâmetros inexistentes | Testar fidelidade/responsividade |
| Canvas e Bloco 19.14 | Canvas **fora de `features/inicio`**; Home não alterada, guard preservado | Exige autorização formal do Coordenador VISUAL-R1 e Coordenador Geral R1 |
| Cor final do W1 | Não declarar integração da Home/loaders operacionais até código React colorido e novo CI verde | **BLOCKED** até novo commit do W1 |
| W3/W4 ainda sem aceite | Apenas branch DRAFT/laboratórios isolados, sem merge/produção | Fundador deve avaliar |
| Auth, Suspense, prontidão e logout | Componentes W2 não montados no fluxo real, sem alterações em `app/page.tsx`, transições ou guards | Validação E2E futura |
| RC/Rules/Firebase/operacional | Fora do escopo, sem alteração | Preservado |

## Demonstração de desenvolvimento
- `npm run dev` → `/dev/visual-r1`: adaptação W1+W2 em 5 dimensões, perfis, estados ilustrativos, Border Beam low.
- `/dev/visual-orb`: demonstração W1 original.
- `/visual-lab/border-beam`: demonstração W4.
- A rota integrada `/dev/visual-r1` abre somente com `NODE_ENV=development` ou `VERCEL_ENV=preview`, e retorna 404 em Vercel Production. Os laboratórios individuais W1/W4 continuam restritos a desenvolvimento local. Acessibilidade pública da URL do Preview ainda exige verificação pelo Fundador.
- O loading ilustrado é identificado como amostra, não representa qualquer operação real.

## Gates e decisão
Executar no **HEAD composto**: `npm ci`, `npm run typecheck`, `npm run build`, `git diff --check`, Application CI, Core Protection, Block 19.14, guards SAG/Relatórios e Playwright.
Verificar 1440×900, 1366×768, 844×390, 390×844, 545×374, foco/teclado/touch/reduced-motion/aba oculta/offscreen, hidratação, logout e término correto de loading/erro.
Medir FPS, CPU/GPU, memória, bundle e cena inicial.
**Não classificar PASS técnico final sem essas evidências**, W1 colorido e decisão arquitetural.
Não fazer merge na main, deploy Production ou mudança de Firestore Rules, dados, autenticação, cobrança ou RC.
