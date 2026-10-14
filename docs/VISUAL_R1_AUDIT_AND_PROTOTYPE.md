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
