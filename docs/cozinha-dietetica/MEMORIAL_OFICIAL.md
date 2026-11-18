# COZINHA DIETÉTICA — MEMORIAL OFICIAL DO SISTEMA

**Atualizado em:** 18/11/2026 (Brasília)  
**Projeto:** Cozinha Dietética — gestão de mapas, preparo e distribuição hospitalar  
**Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`  
**Base funcional F0:** PR [#555](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/555), branch `feat/cozinha-dietetica-f0-firebase-hosting-20261115`  
**Frente F1 em revisão:** `feat/cozinha-dietetica-f1-estabilizacao-ci-20261118` (PR Draft, sem publicação)  
**Código da revisão operacional de 16/11:** `967da1b805753e69deea86b28fab2f6ee6045daf` (histórico).  
**Base exata da F1:** `294ca1366afc89e4960b52516960520f7d2c4966` (HEAD F0 consultado em 18/11).  
**Situação:** melhorias implementadas e aprovadas por testes automatizados sintéticos; **não confundir build aprovado, branch pronta ou site provisionado com implantação da versão ou homologação clínica**.

> **Leitura canônica:** este documento reúne a visão do produto e o ponto de retomada operacional atual. Os handoffs W0–W12 continuam como histórico técnico imutável. Decisões posteriores verificadas no código prevalecem sobre descrições de estágio anterior. A Cozinha Dietética é um produto hospitalar independente e não deve afetar a produção financeira/logística do EMPROVEX.

## F1 — estabilização de CI e preparo da homologação operacional (18/11/2026)

**Estado:** alterações técnicas propostas em branch/PR Draft isolados. Não representam merge, deploy, novo acesso clínico ou homologação assistencial. **GOV-SIMP-01:** corrigir somente atritos reais, sem cadastros, aprovações ou camadas adicionais.

### Fronteiras e testes automáticos

- O `tsconfig.json` da raiz verifica EMPROVEX e os módulos hospitalares compartilhados, mas exclui os dois projetos independentes `apps/hospital-web` e `apps/hospital-api`, que mantêm seus próprios `tsconfig.json`, dependências e builds.
- `tests/hospital/f1-type-boundaries.test.mjs` comprova a separação, sem retirar os componentes hospitalares compartilhados do escopo de tipos da raiz.
- A jornada operacional sintética e o typecheck da raiz passam a integrar a validação de PRs F1 direcionados à F0. O build independente da interface React e da API Next é reexecutado pelo workflow hospitalar.
- Não são fornecidas credenciais GCP/Firebase reais aos testes; Auth/Firestore Emulator usam exclusivamente o projeto demonstrativo `demo-cozinha-dietetica`.
- Falhas do CI **não são consideradas solucionadas** até o resultado dos runs do commit final do PR confirmar os gates exigidos.

### Roteiro de homologação — somente pacientes fictícios

| Jornada | Aceite mínimo observável |
|---|---|
| Acesso | Unidade, Cozinha, Nutrição e Admin entram somente nas suas áreas; token inválido e hospital/unidade alheios são rejeitados pela API |
| Solicitação | Em 06h/10h/16h, cadastrar paciente/leito/dieta no mapa, salvar próximo, enviar e consultar recibo; principal e secundária independentes |
| Recebimento e preparo | Cozinha vê somente mapas enviados, confirma recebimento real, agrupa as dietas e registra lote/preparo sem criar etapas fictícias |
| Distribuição | Gerar etiquetas e lista, conferir identificação/alergias, montar, expedir e registrar **hora física efetiva** da entrega; imprimir nunca confirma distribuição |
| Segurança e exceções | Testar jejum/NPVO, alergia, acompanhante, mudança de leito, atraso, adendo, correção pós-envio e idempotência sem duplicações |
| Nutrição | Consultar, auditar e tratar achados sem aprovação rotineira de mapas |
| Resiliência e UX | Executar recuperação de dados sintéticos no emulador, verificar uso móvel/desktop, erros de rede e rastreio sem dados clínicos nos artefatos |

**Fora do escopo dos testes de CI:** comprovação de uso clínico com pacientes reais, proteção e backup/restore do ambiente GCP real, dispositivo físico, aceite assistencial institucional e publicação automatizada efetiva. Essas decisões exigem verificação no ambiente pertinente, sem converter resultados sintéticos em autorização assistencial.

**Próxima decisão de publicação:** somente após os gates do PR e, separadamente, autorização explícita para a versão identificada; a F1 não edita `ops/hospital-f0-hosting-promotion-request.json` e não executa merge nem deploy.

## Atualização de infraestrutura — publicação via GitHub sem chave privada (16/11/2026)

**Decisão:** preservar Firebase Hosting para a interface React e Cloud Run para a API clínica.
O usuário confirmou visualmente `Deploy complete!` no Cloud Shell e HTTP 200 do site,
além da revisão pronta da API `cozinha-dietetica-api-00002-87n`. Isso **não substitui**
o teste completo de operações clínicas reais.

**Novo mecanismo preparado em código:**
- Script de provisionamento único `ops/hospital-f0-provision-github-wif.sh` para criar,
  **somente quando executado pelo responsável no Cloud Shell**, a identidade
  `hospital-hosting-deployer@cozinha-dietetica.iam.gserviceaccount.com`,
  pool `hospital-github` e provider `hosting-promotion`.
- Federação GitHub OIDC restrita aos IDs permanentes do repositório e proprietário,
  refs da branch hospitalar/`main`, evento push e workflow hospitalar único.
  Papéis limitados ao projeto hospitalar: Firebase Hosting Admin, API Keys Viewer
  e Cloud Run Viewer; sem chaves JSON e sem direitos de alteração do Firestore,
  Firebase Auth ou Cloud Run. Hosting Admin ainda cobre o Hosting do **projeto** inteiro.
- Workflow `.github/workflows/hospital-f0-hosting-promote.yml` condicionado
  à alteração **exclusiva** de `ops/hospital-f0-hosting-promotion-request.json`
  por pedido explícito do responsável no chat, com SHA exato do código anterior.
  Inclui testes sintéticos, build isolado, deploy apenas do Hosting, verificação
  HTTP do site/proxy e tentativa de rollback pela API do Hosting.
- O arquivo de solicitação começa **não autorizado** (`not_requested`).
  Um simples commit de código não publica automaticamente a produção.

**Fronteira do estado real:** os scripts/workflow foram **versionados**, mas a identidade
**não foi provisionada nem testada em GitHub → GCP** nesta etapa pelo assistente.
Somente o resultado posterior do comando no Cloud Shell comprovará a configuração;
o primeiro workflow de promoção executado comprovará a federação end-to-end.
Este mecanismo é independente do publicador do EMPROVEX financeiro.

## 1. Propósito e princípio permanente de experiência

Disponibilizar às unidades assistenciais, Cozinha Dietética e Nutrição um sistema que economize tempo dos profissionais. O fluxo deve funcionar com a familiaridade de um aplicativo de pedidos de refeições: **pedir → receber → preparar → distribuir → acompanhar**. A auditoria ocorre em paralelo, sem fila obrigatória de aprovação nutricional.

A diretriz de produto é **GOV-SIMP-01: eficiência máxima e burocracia mínima**:
- Cada profissional registra somente dados necessários e ações realmente realizadas. Não solicitar informações duplicadas, aprovações de rotina ou passagem por telas intermediárias.
- Exibir a **próxima ação útil**, o status atual e eventuais alertas importantes; recursos técnicos e filtros ficam secundários.
- Priorizar operação em celular e computador, textos claros, botões acessíveis e feedback imediato de salvamento/erro.
- Não trocar segurança clínica por atalhos: identificação positiva, prescrição assistencial vigente, alergias, jejum, restrições e entrega efetiva continuam conferidos.
- Não inventar marcos: abrir uma página, imprimir, consultar ou receber eletronicamente um pedido **não significa** preparo, saída ou entrega física.
- Separar rigorosamente organizações, hospitais, unidades e papéis; usuários comerciais não obtêm acesso clínico por herança.

**Visão de qualidade:** um profissional novo deve conseguir solicitar, conferir e acompanhar sem precisar estudar um manual, mantendo apenas as orientações clínicas próprias de sua atividade.

## 2. Operação acordada — o caminho principal

| Etapa | Responsável | Experiência desejada / registro real |
|---|---|---|
| 1. Solicitação | Unidade assistencial | Selecionar mapa do horário, cadastrar pacientes/dietas em formulário único e tocar em **Salvar e enviar à Cozinha**. Para mais leitos: **Salvar e próximo paciente**. |
| 2. Recebimento | Cozinha Dietética | Ver mapas enviados por unidade, horário e prioridade; **confirmar recebimento** explicitamente, quando efetivamente recebido. |
| 3. Produção | Cozinha | Agrupar por dieta, consistência, observações e quantidade; iniciar e concluir lotes com a quantidade real, sem cadastro repetido de cada prato. |
| 4. Distribuição | Cozinha/copeiros | Separar as refeições, montar e conferir bandejas, registrar saída e, quando confirmada a entrega física, informar seu **horário efetivo**. |
| 5. Auditoria | Nutrição | Consultar referências, detectar e tratar inconformidades, registrar contatos médicos efetivamente realizados e emitir relatório. **Não aprovar mapas rotineiros.** |

O acompanhamento da unidade reflete as transições registradas pelas equipes. Refeição principal e secundária possuem **preparo e entrega independentes**; o mapa comum não presume que ambas foram distribuídas.

### Horários dos mapas

| Mapa | Refeição principal | Refeição secundária | Referência de horário |
|---|---|---|---|
| 06h | Café da manhã | Lanche da manhã | 06h; tolerância da principal até 06h30 |
| 10h | Almoço | Lanche da tarde | 10h; tolerância da principal até 10h30 |
| 16h | Jantar | Ceia | 16h; tolerância da principal até 16h30 |

O prazo regular do mapa e a tolerância da refeição principal são conceitos distintos. Solicitações posteriores, quando permitidas pelo fluxo vigente, têm justificativa objetiva e destaque para a Cozinha; **o atraso, por si só, não pode simular um bloqueio clínico nem dispensar uma avaliação assistencial necessária**.

### Informações essenciais do pedido

O formulário rápido inclui: nome completo, nascimento e leito; consistência (livre, branda, pastosa, líquidas e outras); via (oral/sonda); restrições; alergias evidenciadas; escolha independente das refeições; refeição para acompanhante quando aplicável; observações necessárias; conferência com orientação assistencial vigente.

**NPVO/SNE/sonda:** a interface não cria refeição oral de paciente nessas condições; acompanha as restrições e pode permitir refeição de acompanhante, se cabível. A plataforma **não prescreve dieta médica**.

## 3. Navegação atual por perfil — mínima e orientada ao trabalho

**Unidade assistencial (`UNIT`):**
1. **Solicitar dietas** — abre por padrão, com o mapa do horário mais provável selecionado conforme o relógio de São Paulo; a seleção é sugestão visual, não autorização.
2. **Acompanhar pedidos** — progresso de cada refeição e ocorrências; link direto após o envio.
3. **Pacientes e leitos** — cadastro, localização, transferências e ajustes quando necessários.
4. **Prescrições e dietas** — consulta/registro da referência assistencial, sem gerar prescrição.

**Cozinha (`KITCHEN`):** Pedidos recebidos → Produção → Distribuição → Ocorrências → Relatórios.

**Nutrição (`NUTRITION`):** Auditoria nutricional, internamente organizada em Visão geral, Consultar dieta, Pendências, Contato com médico e Relatórios. Filtros opcionais e consulta de internações por seleção, com resultado legível em cartões em vez de JSON bruto.

**Administração hospitalar (`HOSPITAL_ADMIN`):** Administração e Catálogo de dietas. O catálogo é necessário para habilitar as **bases institucionais autorizadas**; não exigir um item separado para cada consistência, pois a textura é escolhida na solicitação. Administração não recebe acesso a pacientes/mapas por padrão.

**Princípio:** interfaces mostram os menus úteis ao papel; a autorização verdadeira continua sendo verificada nas APIs do servidor.

## 4. O que foi implementado na auditoria de UX/fluxo de 16/11/2026

**Solicitação e unidade**
- Removido `Início` redundante do menu da Unidade; `Solicitar dietas` tornou-se entrada padrão.
- Cadastro rápido ajustado para **Salvar e próximo paciente** ou **Salvar e enviar à Cozinha**. No mapa em rascunho, a conclusão chama `map.submit` com a revisão atual; se a transmissão falhar, a mensagem informa que o cadastro foi salvo, mas o mapa **ainda não foi enviado**.
- Refeição principal inicialmente marcada; secundária desmarcada para não presumir solicitação da segunda refeição. Ambas continuam selecionáveis.
- Rascunho mantido montado enquanto o operador consulta outra aba; mudanças de data, ciclo ou unidade limpam o contexto pertinente. Filtros não descartam silenciosamente o mapa em edição.
- Aviso útil se a base oral institucional ainda não foi configurada, com indicação do caminho administrativo.
- Link claro do mapa enviado para o acompanhamento.

**Recebimento, produção, distribuição**
- Pedidos recebidos ordenados para destacar solicitações extraordinárias e o horário operacional atual, sem ocultar outros ciclos.
- Produção permanece agrupada por tipo/quantidade, com etapas efetivas e etiqueta separada da confirmação de preparo.
- Distribuição suporta **mais de 50 refeições por unidade** por páginas acessíveis; pendências têm precedência visual sobre entregas concluídas.
- Preenchimento do horário com **Usar hora atual** é atalho opcional; clicar nesse botão **não confirma entrega**. O usuário ainda confirma a entrega real e as conferências exigidas.

**Auditoria e administração**
- Nutrição sem aprovação rotineira; painel com filtros recolhidos e nomes de abas orientados à tarefa.
- Consulta de internações por seletor, com visualização compreensível do jejum, alergias e referências médicas, sem exigir digitação de IDs ou leitura de JSON.
- Administração ganhou entrada visível para o catálogo institucional com configuração inicial simplificada e opções técnicas secundárias.

**Aparência e desempenho**
- Continuidade da identidade visual premium do portal hospitalar, verde-esmeralda/dourado, com transições discretas, cabeçalho e áreas de trabalho consistentes, estados de carregamento legíveis e respeito à preferência de movimento reduzido.
- Módulos de telas carregados sob demanda (`React.lazy`/`Suspense`), reduzindo trabalho no primeiro carregamento e mantendo navegação prática.
- Acompanhamento consulta dados registrados periodicamente **a cada aproximadamente 18–20 segundos quando a tela está visível**: atualização automática por consulta, **não** streaming instantâneo ou confirmação de ação física.

**Arquivos de referência do código:** `apps/hospital-web/src/App.tsx`, `apps/hospital-web/src/hospital-brand.css`, `features/hospital/integration/navigation.mjs`, `features/hospital/maps/MeusMapasView.tsx`, `features/hospital/maps/MapRapidRegistration.tsx`, `features/hospital/integration/TrackingView.tsx`, `features/hospital/integration/KitchenMapsBoard.tsx`, `features/hospital/production/ProductionView.tsx`, `features/hospital/integration/DistributionQueue.tsx`, `features/hospital/distribution/DistributionView.tsx`, `features/hospital/nutrition-audit/NutritionAuditView.tsx`, `features/hospital/diets/DietasView.tsx`.

## 5. Arquitetura hospitalar independente e segurança operacional

- **Frontend:** Vite/React, `apps/hospital-web`, Firebase Hosting `cozinha-dietetica-web`, URL planejada `https://cozinha-dietetica-web.web.app`.
- **Backend:** Next API dedicada em `apps/hospital-api`, Cloud Run `cozinha-dietetica-api`, região `southamerica-east1`.
- **Identidade:** Firebase Authentication do projeto hospitalar `cozinha-dietetica`, token verificado pelo backend e membership de organização/unidade/perfil consultado no lado servidor.
- **Dados:** Firestore hospitalar do projeto independente, sem integração ou permissões herdadas do Firestore financeiro EMPROVEX. Preservar o serviço de QA privado `cozinha-dietetica-qa`.
- **Integridade:** eventos auditáveis, revisões concorrentes, idempotência, snapshots do mapa e controles de segurança contra duplicidade, alergias, jejum, alterações de referência e transições fictícias.
- **Impressão:** relatórios e etiquetas disponíveis conforme o estado de cada pedido; imprimir **não avança status**.
- **Limite de implantação:** o backend Cloud Run previamente validado por `/health` e um build web bem-sucedido **não** provam a integração autenticada completa Firebase Hosting → Cloud Run → Firestore.

Proibido misturar as rotas, banco, identidade ou deploy do produto clínico com o EMPROVEX financeiro. Nenhum dado real de paciente deve ser usado em demonstrações ou logs de teste.

## 6. Evidências verificadas nesta revisão — sem confundir ambientes

**Referência do código testado:** `967da1b805753e69deea86b28fab2f6ee6045daf`.

| Verificação | Resultado real | Evidência |
|---|---|---|
| Regras de navegação, horários e progresso | **19/19 PASS** | [Jornada operacional sintética, run #43800259358](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/43800259358) |
| Fluxo E2E com pacientes fictícios, Firestore e Firebase Auth Emulators, contingência | **8/8 PASS** | Mesmo run; sem usuários ou prontuários reais |
| Regressão clínica e de autorização W0–W9 | **74/74 PASS** | Mesmo run; perfis, segurança e isolamento |
| Total da suíte operacional desta revisão | **101 testes aprovados, zero falhas** | Run #43800259358 (`success`) |
| Compilação do frontend independente e API | **PASS** | [Build Hospital F0, run #43800263759](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/43800263759) |
| Medição sintética do emulador | 40 amostras, 5 chamadas paralelas, p95 **20,14 ms**, sem falhas | Log de teste W12; **não equivale** à latência GCP/produção |
| Redução do arquivo JS principal compilado | cerca de 293 KB → 114 KB em gzip, **aproximação do artefato principal**, não da aplicação inteira | Build Vite; módulos divididos em chunks |

Uma primeira execução da suíte falhou **somente** porque o teste de navegação ainda exigia o menu antigo; a expectativa foi atualizada e a execução final ficou verde. O histórico de falha permanece nos GitHub Actions.

**Não executado/não comprovado por estas evidências:** auditoria presencial de usabilidade com operadores, E2E completo autenticado no site publicado com Firestore GCP real, comparação de latência do serviço em produção, homologação clínica institucional, publicação desta nova versão de frontend. Não declarar GO para pacientes reais.

## 7. Próximo ponto de retomada — sem nova burocracia

1. Atualizar e compilar a cópia do frontend com `ops/hospital-f0-extract-web.ps1` no checkout autorizado; publicar **apenas** o Hosting hospitalar quando o endpoint dedicado e a autenticação estiverem comprovadamente acessíveis e seguros. A publicação depende de comando operacional efetivo; **este memorial não a executa**.
2. Realizar uma única jornada curta de usuário sintético no ambiente integrado: **Unidade solicita → Cozinha recebe → Produção conclui → Distribuição registra horário real → Nutrição consulta**, incluindo visualização nas duas refeições, troca de aba, dados de alergia e permissões de cada perfil.
3. Validar o uso em celular e PC por operadores representativos; corrigir apenas pontos que realmente gerem cliques, dúvida ou retrabalho. Usar o mesmo projeto e infraestrutura hospitalar já existentes, sem criar ferramentas/camadas, workflows ou formulários administrativos redundantes.
4. Qualquer decisão de iniciar uso clínico com dados reais é **separada** da aprovação técnica por CI; exige autorização institucional e verificações essenciais de privacidade, segurança e operação.

## 8. Histórico e fontes técnicas preservadas

- [W0 — contratos, domínios e fluxos clínicos](contracts/W0_HANDOFF_R1.md).
- [W09 — integração e interface inicial](integration/W09_HANDOFF_R1.md).
- [W10 — Firestore e emuladores](integration/W10_HANDOFF_FIRESTORE_R1.md).
- [W11 — infraestrutura hospitalar isolada no Google Cloud](integration/W11_HANDOFF_GCP_R1.md).
- [W12 — homologação sintética, contingência e fronteiras de piloto](integration/W12_HANDOFF_HOMOLOGACAO_R1.md).
- [Firebase hospitalar isolado — histórico de integração](integration/FIREBASE_ISOLADO_HANDOFF_R1.md).
- [Portal independente — instruções operacionais](../../apps/hospital-web/README.md).

**Regra de manutenção deste memorial:** novas mudanças relevantes entram como atualização datada, distinguindo **decidido**, **implementado**, **testado** e **publicado**. Preservar histórico e evitar documentos paralelos desnecessários. O memorial nunca deve transformar um teste sintético ou uma intenção de deploy em certificação de produção.
