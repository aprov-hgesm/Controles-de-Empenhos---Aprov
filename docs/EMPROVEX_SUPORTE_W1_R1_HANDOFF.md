# EMPROVEX SUPORTE — Handoff W1 R1 (Ajuda / Academia)

**Estado:** IMPLEMENTADO EM BRANCH ISOLADA — ainda não integrado na navegação nem publicado.  
**Data:** 31/10/2026 (Brasília).  
**Repositório:** aprov-hgesm/Controles-de-Empenhos---Aprov  
**Branch:** feat/emprovex-suporte-r1-w1-ajuda-academia  
**Base da main confirmada:** 35825d5ad563361fecd1b3d2a00ca81a4734e532  
**Memorial de referência:** docs/EMPROVEX_SUPORTE_ONBOARDING_MEMORIAL_OFICIAL.md, PR #440, branch docs/emprovex-suporte-onboarding-r0-20261031.

## 1. Arquivos do W1

- features/support/tutorialCatalog.ts — espelho tipado e verificado dos 14 IDs/títulos oficiais da Academia; tópicos, filtro local, allowlist e URLs YouTube autorizadas.
- features/support/EmprovexHelpCenter.tsx — componente React independente, responsivo, acessível por teclado, player condicional e contato com suporte.
- scripts/emprovex-support-w1.test.mjs — testes executáveis: correspondência com landing/allowlist, títulos, filtros, links seguros, SSR sem iframe, isolamento.
- .github/workflows/emprovex-support-w1.yml — execução automática somente para alterações do módulo/testes, inclusive PR DRAFT.
- Este handoff — fora do memorial para não concorrer com W2.

Não houve edição dos shells compartilhados, arquivos de autenticação, cobrança, banco, Firebase Rules, Next app routes nem conteúdo institucional.

## 2. Reaproveitamento e limites

Fonte oficial conferida: public/institucional/content.html (14 vídeos) e public/institucional/site.js (allowlist de 14 IDs e player após clique). A landing permanece intacta, evitando regressão no site público. O catálogo do W1 espelha esses itens de forma tipada; o teste garante correspondência exata de IDs e títulos entre as duas superfícies. Em mudanças futuras, atualizar a landing e o catálogo juntos, mantendo o teste como trava contra divergência.

Categorias: Primeiros passos, Empenhos e saldos, Cronogramas, Notas Fiscais, Itens e fornecedores, Central de Depósitos e Relatórios. O tutorial de Cronogramas cobre também fornecedores. Não foi identificado vídeo do Operador Móvel: a Ajuda aponta para a demonstração ilustrada já existente em /institucional#explorar, sem inventar vídeo.

Contato fallback: aprov1hgesm@gmail.com, conferido no login e nos documentos legais. O host pode fornecer supportContact validado e configurado para substituir o fallback (apenas exibição, link mailto somente quando for e-mail). Não há número inventado.

Sem SDK Firebase, API, listener permanente, IA, embed antecipado, consulta de dados de clientes ou dependência externa de busca. A UI abre iframe youtube-nocookie.com exclusivamente quando um tutorial da lista permitida é escolhido; removido ao fechar. Se YouTube falhar, há link para o vídeo em youtube.com, sem bloquear operações.

## 3. Contrato de integração (W4)

Importar o módulo:
- import { EmprovexHelpCenter } from 'features/support/EmprovexHelpCenter' (ajustar caminho relativo conforme arquivo hospedeiro).
- Renderizar <EmprovexHelpCenter /> em aba ou rota autenticada apropriada.
- Props opcionais: supportContact?: string | null; initialTopic?: SupportTopicId; className?: string.
- Importação de tipos e tópicos: features/support/tutorialCatalog.ts.
- Não é necessário Provider, ID de workspace, token, backend ou coleção.

**Aprovisionamento desktop e mobile:** W4 adiciona ponto de entrada Ajuda no shell existente, sem alterar o contrato de abas por W1. Escolher montagem somente ao abrir a Ajuda, se a arquitetura da tela permitir lazy import. O módulo já usa grid responsiva e botões acessíveis.

**Central de Depósitos:** W4 adiciona botão Ajuda em seu próprio shell e pode chamar <EmprovexHelpCenter initialTopic="depositos" />. Não montar no canvas 3D; usar área de conteúdo ou painel/modal do shell.

**Modo Essencial:** o componente não depende do renderizador 3D, animações, filtros visuais ou VisualModeProvider. Preservar a mesma entrada de Ajuda; não acrescentar efeitos nem listeners permanentes.

**Contato:** preferir supportContact do contrato financeiro/configuração atual, já autorizado pelo host. Não buscar billing a partir do componente de Ajuda e não expor dados financeiros.

## 4. Testes e limites da evidência

Comando dirigido: node --test scripts/emprovex-support-w1.test.mjs  
Comando de tipos: npm run typecheck  
Workflow de PR: EMPROVEX Support W1 isolated certification.

Os testes executáveis verificam conteúdo e renderização React SSR, filtros, URLs e ausência de iframe na montagem inicial. A responsividade é inspecionada via classes mobile-first; a verificação visual interativa em browser real depende da etapa de integração W4. Validade estrutural de ID/URL não garante que todo vídeo permaneça publicamente disponível no YouTube.

Resultado dos checks/CI deve ser consultado no SHA atualizado da PR; não confundir script criado com teste aprovado. Sem autorização para merge ou deploy.

## 5. Parecer de integração técnica

**GO condicionado** à execução positiva dos testes dirigidos, TypeScript e revisão da PR, com integração exclusiva pelo W4. **NO-GO para produção** neste Worker. W2/W3 não foram modificados.

**PR:** registrada na abertura de PR DRAFT, sem merge.  
**Código implementado até:** b0a816fe6d867aec646198b8af6d1ed631e273b3.  
**SHA final da branch:** consultar head SHA da PR após o registro de evidências finais; este handoff é histórico.
