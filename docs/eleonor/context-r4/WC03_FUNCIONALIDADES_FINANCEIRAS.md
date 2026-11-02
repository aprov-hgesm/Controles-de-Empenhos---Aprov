# WC03 — Procedimentos financeiros e documentais para a Eleonor (Contexto R4)

**Estado:** documentação de desenvolvimento, NÃO integrada à Eleonor. **Data:** 02/11/2026. **Branch:** `docs/eleonor-context-r4-wc03-funcionalidades-financeiras`. **Base documental:** PR #471 `d7e649d71797b09173fe67c790099d0ceef81f4d`. **Código auditado:** `main@57a55b172790865bdb9b9beffaaa55b6a19c1a28` (não implica revisão Cloud Run publicada). **Escopo:** exatamente 89 IDs F-02 a F-08. **Método:** leitura estática do R3, componentes, hooks, parsers, documentos e pontos críticos de persistência; sem execução autenticada ou teste transacional.

## 1. Resumo executivo — lacunas priorizadas

- **P0 — Segurança e semântica documental:** não confundir cálculo de recebido com liquidação formal/NS (K01), parser NE com cadastro (K02), NF salva com PDF anexado (K04), cronograma salvo/PDF com e-mail enviado ou recebido (K05–K06), JSON SAG com vínculo interno autorizado (K07–K08).
- **P1 — Integridade e exatidão:** confirmação de persistência de cronograma após refresh (K10), preset de quantidades fracionárias (K11), classes que exigem TR (K12), distinção entre editar fornecedor e migrar CNPJ de NE (K09), identidade por CNPJ nos relatórios (K13).
- **P2 — Experiência e observabilidade:** mensagens de erro localizadas só quando literais no código, diferenciação entre 'lido' e 'resolvido' (K14), testes autenticados por perfil e cobertura de telas condicionais.

## 2. Mapa de cobertura e índice navegável

| Família | Cartões | Fonte principal | Risco maior |
|---|---:|---|---|
| [F-02 — Painel e Início](#f-02-cartoes) | 8 | [componente](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx) | leitura de indicadores |
| [F-03 — Empenhos e itens da NE](#f-03-cartoes) | 22 | [componente](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) | identidade/NE |
| [F-04 — Notas Fiscais, NS e TR](#f-04-cartoes) | 18 | [componente](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) | saldo × documento |
| [F-05 — Cronogramas](#f-05-cartoes) | 13 | [componente](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/components/CronogramasView.tsx) | envio × recebimento |
| [F-06 — Fornecedores e itens](#f-06-cartoes) | 9 | [componente](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx) | CNPJ |
| [F-07 — Relatórios, SAG e integridade](#f-07-cartoes) | 12 | [componente](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatoriosView.tsx) | NS/SAG e conciliação |
| [F-08 — Avisos](#f-08-cartoes) | 7 | [componente](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/components/CentralAvisosView.tsx) | ciclo do aviso |

**Cobertura nominal:** 89/89 IDs do intervalo auditado presentes em R3 e reproduzidos abaixo; isso NÃO significa 89 fluxos integralmente confirmados em runtime. **Mapa de confiança:** 42 cartões com achado adicional pontual verificado; 47 com percurso orientativo primariamente R3 e presença do módulo, permanecendo validação fina de campos/erros. **Disponibilidade:** MAIN é implementação estática na main; GATED marca dependência adicional relevante; nenhuma afirma publicação Cloud Run.

## 3. Separação de fontes, intenção e autorização

| Pedido | Comportamento correto da Eleonor | Limite |
|---|---|---|
| HOWTO (“onde clico?”, “me ensine...”) | Explicar menu, dados, sequência, bloqueio e verificação; responder sem executar | Nunca escrever por uma explicação |
| READ (“mostre minhas NFs”, “quanto resta?”) | Somente consultar dados efetivos por contrato W3 disponível, identidade, sessão e escopo da própria UG/workspace | Sem W3/escopo confirmado: pedir consulta na tela; não inventar totais |
| WRITE (“cadastre”, “exclua”, “aplique NS”, “envie”) | Identificar mutação, recusar execução autônoma neste corpus; orientar operação humana e confirmação no sistema | LFM3 propõe interpretação não confiável, sem privilégios nem acesso a dados |
| Pergunta incompleta/correção/negação | Pedir apenas informação essencial e manter negadores e IDs literais | Nada de associar NF/NE por similaridade superficial |

**Níveis de certeza:** *alta pontual* = trecho específico do código lido; *parcial* = módulo existe, caminho/etapas herdados do R3 mas sem conferência exaustiva de toda condição; *não verificado* = runtime, permissão granular, integração LFM3 e publicação. O caminho **/central-empenhos** é o shell; as abas internas são selecionadas pela interface (não inventar URLs dedicadas). O controle de acesso no backend e a revisão publicada são **não verificados** por esta missão; nunca afirmar privilégio por botão visível. Documentos privados e identidades organizacionais não pertencem a uma resposta de conhecimento público.

## 4. Achados **novos e rastreáveis** em relação à orientação resumida do R3

| Prioridade | ID | Feature | Distinção concreta / correção do R3 | Evidência |
|---|---|---|---|---|
| P0 | K01 | [F-02-005](#f-02-005) | Rótulo de 'liquidado' no Painel refere-se à projeção de quantidades recebidas × preço, não prova liquidação formal ou existência de NS | [main](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx#L75-L114) |
| P0 | K02 | [F-03-008](#f-03-008) | API de parser PDF NE aceita até 12 MB, faz gate de sessão/billing e não cadastra automaticamente | [main](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/app/api/empenhos/parse-ne/route.ts#L15-L56) |
| P0 | K03 | [F-04-007](#f-04-007) | NF duplicada tem controle de identidade fornecedor + número; saldo por item e CNPJ são impeditivos | [main](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts#L98-L164) |
| P0 | K04 | [F-04-008](#f-04-008) | NF gravada e PDF falho não autoriza recadastrar NF; documentação R3 não explicitava commit separado | [main](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts#L305-L355) |
| P0 | K05 | [F-05-012](#f-05-012) | Envio real exige Google Drive/Gmail, confirmação humana e ambos os PDFs; gerar PDF não envia | [main](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts#L529-L704) |
| P0 | K06 | [F-05-013](#f-05-013) | Histórico de remessas usa NF emitida na semana como pista; não confirma aceite nem recebimento real | [main](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/domain/cronogramaDeliveryTracking.ts#L63-L91) |
| P0 | K07 | [F-07-007](#f-07-007) | Schema SAG bloqueia campos de vínculo interno NE/recordKey; não aceitar JSON externo como autoridade de vínculo | [main](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/sagNsContract.ts#L1-L69) |
| P0 | K08 | [F-07-010](#f-07-010) | Aplicação de NS refaz conciliação/UG/fingerprint e não força bloqueios | [main](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/hooks/useSagNsImportActions.ts#L46-L107) |
| P1 | K09 | [F-06-005](#f-06-005) | Edição de fornecedor não permite mudar CNPJ cadastrado; é diferente de migrar o CNPJ da NE | [main](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx#L308-L317) |
| P1 | K10 | [F-05-003](#f-05-003) | Salvamento de cronograma atualiza estado local antes do await, logo sucesso visível requer verificação de persistência após refresh | [main](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts#L208-L229) |
| P1 | K11 | [F-05-006](#f-05-006) | Preset aplica Math.floor e resto na primeira remessa; comportamento com saldo fracionário não comprovado como adequado | [main](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts#L117-L140) |
| P1 | K12 | [F-03-020](#f-03-020) | Classe de NE controla exigência de TR; documentação do procedimento deve incluir efeito além do rótulo | [main](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx#L1874-L1920) |
| P1 | K13 | [F-07-003](#f-07-003) | Fornecedores sem CNPJ ficam fora de consolidação por CNPJ; não juntar por semelhança de nome | [main](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatorioPorFornecedorView.tsx#L80-L197) |
| P2 | K14 | [F-08-005](#f-08-005) | Marcar em lote atua nos avisos NOVO e não resolve/arquiva os eventos | [main](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/hooks/useAvisosActions.ts#L68-L91) |

**Comparação R1/R2/R3:** o R3 já possuía 242 IDs, exemplos linguísticos, o manifesto `eleonor.r3.context.v1` com 135 linhas de léxico e a distinção `development`/`evaluation_candidate`; portanto, **não** atribuímos como novidade nem os 89 IDs nem a ideia de paráfrases/partições. O corpus WC03 introduz casos explícitos por intenção operacional, correção de entidade, negação, guarda READ/WRITE e exceções documentais, mas alguns enunciados permanecem semanticamente próximos do R3 e não são contabilizados como conhecimento novo. O R3 é um conjunto documental visível, não um holdout cego. A leitura de código confirma parcialmente o roteiro, não demonstra que todas as 89 operações funcionem em produção.

Esses **14 achados K01–K14** são proposições auditáveis, não novas funcionalidades do produto nem testes executados. Não contam meras paráfrases ou IDs antigos como conhecimento novo. A verificação de diff entre baseline R3 `b62f82e...` e `main@57a55b172790` encontrou 30 commits à frente, mas nenhum arquivo modificado dentre as famílias financeiras filtradas; isso não comprova equivalência de runtime nem que todo R3 era completo.

## 5. Casos difíceis transversais e formatos documentais

**NE PDF:** arquivo de Nota de Empenho para parser autenticado (`POST /api/empenhos/parse-ne`, 12 MB), com revisão humana antes do registro; documento de NE anexado posteriormente é outro fluxo de armazenamento. **NF PDF:** anexo da nota do fornecedor, PDF até 10 MB no formulário, upload pode falhar depois do commit de NF. **Espelho NF:** anexo privado opcional separado do original; pode compor PDF consolidado. **TR:** termo derivado de NF, comissão e política da classe; geração do PDF não equivale a recebimento físico. **Comissão:** boletim, mês, data e membros institucionais reais. **NS:** número `AAAANS000000` e identidade com UG, não o número da NF. **SAG JSON:** transferência manual assistida de registros NS, contrato `emprovex_sag_ns_v1`, nunca confundir com parser/cadastro JSON de NE.

**Exemplo didático SAG (não é um payload válido para aplicação; marcadores exigem dados institucionais autorizados e válidos):** `{"schema_version":"emprovex_sag_ns_v1","source":"SAG","supplier_cnpj":"<CNPJ_SINTETICO_VALIDO>","ug":"<UG_DE_TESTE>","records":[{"ns":"2026NS000012","ns_issue_date":"2026-10-01","nf_number_raw":"NF-DEMO-001","nf_issue_date":"2026-09-30","observation":"Exemplo sintético"}]}`. Não criar nem inserir `empenhoId` ou `recordKey` no JSON. **Exemplo de NF:** NE sintética `2026NE000042`, NF `NF-DEMO-001`, item `ITEM-A`, quantidade ilustrativa `2`, unidade `UN`; a quantidade real admissível deriva do saldo efetivo, não destes exemplos.

**Cronograma:** prévia/baixar ≠ e-mail; Gmail aceitou ≠ destinatário leu; NF emitida na semana prevista ≠ material entregue. Se Gmail confirmar e gravação do histórico falhar, verificar a pasta Enviados antes de reenviar. **Reversão:** editar NF altera saldo; remover a última remessa é bloqueado; editar CNPJ do fornecedor cadastrado é impedido; bloqueios SAG e de NE não podem ser “forçados” com outra redação.

## 6. Cartões de procedimento por featureId


<a id="f-02-cartoes"></a>

### F-02 cartoes — Início e indicadores

<a id="f-02-001"></a>

#### F-02-001 — Abrir tela Início

- **Domínio / intenção / acesso:** Painel e Início · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace próprios. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Painel ou Início; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Entrar na Central de Empenhos.; Escolher 'Início' no menu quando no modo Normal.; Explorar atalhos e resumo operacional autorizado. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Entrar na Central de Empenhos.
2. Escolher 'Início' no menu quando no modo Normal.
3. Explorar atalhos e resumo operacional autorizado.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** No modo Essencial a interface pode usar o Painel como entrada. Distinguir projeção de Painel de documento financeiro externo. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** projeção de leitura; não altera lançamentos. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como abrir tela Início? **R:** Orientar o caminho **Central de Empenhos > Painel ou Início**, detalhar somente etapas verificáveis do cartão F-02-001, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/inicio/components/InicioView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-02-002"></a>

#### F-02-002 — Abrir Painel

- **Domínio / intenção / acesso:** Painel e Início · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace próprios. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Painel ou Início; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** No menu lateral selecionar 'Painel'.; Aguardar consolidação dos empenhos.; Conferir indicadores de saldo e execução. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. No menu lateral selecionar 'Painel'.
2. Aguardar consolidação dos empenhos.
3. Conferir indicadores de saldo e execução.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Valores dependem dos documentos disponíveis no workspace. Distinguir projeção de Painel de documento financeiro externo. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** projeção de leitura; não altera lançamentos. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como abrir Painel? **R:** Orientar o caminho **Central de Empenhos > Painel ou Início**, detalhar somente etapas verificáveis do cartão F-02-002, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/inicio/components/InicioView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-02-003"></a>

#### F-02-003 — Filtrar indicadores por pregão

- **Domínio / intenção / acesso:** Painel e Início · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace próprios. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Painel ou Início; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir Painel.; Selecionar pregão no filtro superior.; Analisar indicadores recalculados do recorte. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Painel.
2. Selecionar pregão no filtro superior.
3. Analisar indicadores recalculados do recorte.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Não confundir filtro visual com alteração de dados. Distinguir projeção de Painel de documento financeiro externo. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** projeção de leitura; não altera lançamentos. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como filtrar indicadores por pregão? **R:** Orientar o caminho **Central de Empenhos > Painel ou Início**, detalhar somente etapas verificáveis do cartão F-02-003, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/inicio/components/InicioView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-02-004"></a>

#### F-02-004 — Filtrar indicadores por classe

- **Domínio / intenção / acesso:** Painel e Início · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace próprios. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Painel ou Início; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir Painel.; Selecionar classe de empenho ou 'Todas'.; Comparar totais agregados e quantidade de empenhos. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Painel.
2. Selecionar classe de empenho ou 'Todas'.
3. Comparar totais agregados e quantidade de empenhos.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Classes dependem de configuração vigente. Distinguir projeção de Painel de documento financeiro externo. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** projeção de leitura; não altera lançamentos. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como filtrar indicadores por classe? **R:** Orientar o caminho **Central de Empenhos > Painel ou Início**, detalhar somente etapas verificáveis do cartão F-02-004, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/inicio/components/InicioView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-02-005"></a>

#### F-02-005 — Consultar saldo empenhado, recebido e disponível

- **Domínio / intenção / acesso:** Painel e Início · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace próprios. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Painel ou Início; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir Painel.; Selecionar o recorte desejado.; Ler os totais de compromissos, recebimentos e saldo. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Painel.
2. Selecionar o recorte desejado.
3. Ler os totais de compromissos, recebimentos e saldo.

- **Evidência/nuance auditada:** O Dashboard calcula empenhado pela soma de quantidade × valor unitário; recebido por quantidade recebida × valor unitário; saldo é projetado sem valores negativos. A legenda de 'liquidado' nessa visualização NÃO comprova emissão de NS nem liquidação formal.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Cálculo depende dos registros e da consistência financeira. Distinguir projeção de Painel de documento financeiro externo. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** projeção de leitura; não altera lançamentos. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como consultar saldo empenhado, recebido e disponível? **R:** Orientar o caminho **Central de Empenhos > Painel ou Início**, detalhar somente etapas verificáveis do cartão F-02-005, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/inicio/components/InicioView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx#L60-L110) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-02-006"></a>

#### F-02-006 — Pesquisar NE ou fornecedor no painel

- **Domínio / intenção / acesso:** Painel e Início · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace próprios. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Painel ou Início; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** No detalhamento financeiro do Painel digitar número da NE ou nome do fornecedor.; Examinar resultados filtrados.; Abrir registro para investigar. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. No detalhamento financeiro do Painel digitar número da NE ou nome do fornecedor.
2. Examinar resultados filtrados.
3. Abrir registro para investigar.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Busca local, não busca global entre organizações. Distinguir projeção de Painel de documento financeiro externo. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** projeção de leitura; não altera lançamentos. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como pesquisar NE ou fornecedor no painel? **R:** Orientar o caminho **Central de Empenhos > Painel ou Início**, detalhar somente etapas verificáveis do cartão F-02-006, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/inicio/components/InicioView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-02-007"></a>

#### F-02-007 — Examinar detalhamento por classe

- **Domínio / intenção / acesso:** Painel e Início · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace próprios. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Painel ou Início; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** No Painel localizar a tabela por classe.; Expandir/ver as linhas necessárias.; Selecionar uma NE para visualizar seus itens ou lançar NF. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. No Painel localizar a tabela por classe.
2. Expandir/ver as linhas necessárias.
3. Selecionar uma NE para visualizar seus itens ou lançar NF.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Linhas podem carregar progressivamente. Distinguir projeção de Painel de documento financeiro externo. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** projeção de leitura; não altera lançamentos. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como examinar detalhamento por classe? **R:** Orientar o caminho **Central de Empenhos > Painel ou Início**, detalhar somente etapas verificáveis do cartão F-02-007, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/inicio/components/InicioView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-02-008"></a>

#### F-02-008 — Abrir itens ou cadastro de NF pelo Painel

- **Domínio / intenção / acesso:** Painel e Início · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace próprios. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Painel ou Início; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** No registro desejado clicar na ação de itens ou 'Lançar NF'.; Confirmar a NE de destino.; Prosseguir na aba operacional correspondente. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. No registro desejado clicar na ação de itens ou 'Lançar NF'.
2. Confirmar a NE de destino.
3. Prosseguir na aba operacional correspondente.

- **Evidência/nuance auditada:** Atalho de Painel é navegação para o registro/aba, não cadastro ou lançamento por si só.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Confirme identidade da NE antes de registrar recebimento. Distinguir projeção de Painel de documento financeiro externo. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** projeção de leitura; não altera lançamentos. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como abrir itens ou cadastro de NF pelo Painel? **R:** Orientar o caminho **Central de Empenhos > Painel ou Início**, detalhar somente etapas verificáveis do cartão F-02-008, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/inicio/components/InicioView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).


<a id="f-03-cartoes"></a>

### F-03 cartoes — Empenhos, itens e NE PDF

<a id="f-03-001"></a>

#### F-03-001 — Listar empenhos

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir 'Empenhos'.; Selecionar aba de visão geral.; Examinar cartões ou detalhamento das NE. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir 'Empenhos'.
2. Selecionar aba de visão geral.
3. Examinar cartões ou detalhamento das NE.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Somente registros acessíveis à UG/workspace. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como listar empenhos? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-001, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-002"></a>

#### F-03-002 — Pesquisar NE ou fornecedor

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Em Empenhos digitar o número ou fornecedor na busca.; Aguardar filtro.; Abrir o registro correspondente. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Em Empenhos digitar o número ou fornecedor na busca.
2. Aguardar filtro.
3. Abrir o registro correspondente.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Cheque exercício e fornecedor para homônimos. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como pesquisar NE ou fornecedor? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-002, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-003"></a>

#### F-03-003 — Filtrar NE por pregão

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir Empenhos.; Usar seletor 'Todos os Pregões'.; Selecionar pregão desejado. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Empenhos.
2. Usar seletor 'Todos os Pregões'.
3. Selecionar pregão desejado.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** É filtro de consulta. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como filtrar NE por pregão? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-003, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-004"></a>

#### F-03-004 — Filtrar NE por exercício

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir Empenhos.; Escolher ano em 'Todos os Anos'.; Examinar as NE retornadas. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Empenhos.
2. Escolher ano em 'Todos os Anos'.
3. Examinar as NE retornadas.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Exercícios anteriores podem ter regras específicas de saldo. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como filtrar NE por exercício? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-004, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-005"></a>

#### F-03-005 — Filtrar NE por classe

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir Empenhos.; Selecionar classe cadastrada.; Conferir os registros classificados. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Empenhos.
2. Selecionar classe cadastrada.
3. Conferir os registros classificados.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Classe é atributo próprio da NE. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como filtrar NE por classe? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-005, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-006"></a>

#### F-03-006 — Filtrar NE por situação/saldo

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Na visão geral de Empenhos escolher filtro situacional disponível.; Avaliar resultado filtrado.; Abrir a NE para verificar valores. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Na visão geral de Empenhos escolher filtro situacional disponível.
2. Avaliar resultado filtrado.
3. Abrir a NE para verificar valores.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Rótulos exatos podem variar com os estados presentes. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como filtrar NE por situação/saldo? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-006, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-007"></a>

#### F-03-007 — Cadastrar NE manualmente

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Abrir Empenhos > Cadastrar Novo Empenho.; Escolher modo 'Manual'.; Preencher número da NE, fornecedor, CNPJ quando exigido, pregão, descrição, classe e demais campos.; Revisar dados e confirmar gravação. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Empenhos > Cadastrar Novo Empenho.
2. Escolher modo 'Manual'.
3. Preencher número da NE, fornecedor, CNPJ quando exigido, pregão, descrição, classe e demais campos.
4. Revisar dados e confirmar gravação.

- **Evidência/nuance auditada:** O modo manual é distinto da extração PDF; conferir identificador NE, fornecedor e itens antes da confirmação. Campos exatos condicionais além dos descritos no R3 não foram exaustivamente provados.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Não duplicar NE; respeitar validações de número/identidade. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como cadastrar NE manualmente? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-007, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-008"></a>

#### F-03-008 — Cadastrar NE por PDF

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `GATED` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Abrir Empenhos > Cadastrar Novo Empenho.; Escolher modo 'PDF' e fornecer arquivo suportado.; Revisar os campos extraídos do documento.; Confirmar o cadastro após conferência. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Empenhos > Cadastrar Novo Empenho.
2. Escolher modo 'PDF' e fornecer arquivo suportado.
3. Revisar os campos extraídos do documento.
4. Confirmar o cadastro após conferência.

- **Evidência/nuance auditada:** A API POST /api/empenhos/parse-ne verifica identidade/autorização comercial, arquivo PDF e teto de 12 MB; retorna extração para conferência, não grava NE automaticamente. JSON de NE não é o JSON do SAG.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Extração exige revisão humana; modo JSON de cadastro de NE foi desativado. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como cadastrar NE por PDF? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-008, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/app/api/empenhos/parse-ne/route.ts#L15-L76) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-009"></a>

#### F-03-009 — Revisar NE importada

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO). **Etapa preparatória:** alterações em formulário, rascunho, revisão ou prévia não equivalem a gravação definitiva.
- **Entrada, campos e pré-requisitos:** Após leitura do PDF examinar prévia de importação.; Corrigir campos extraídos incorretos.; Confirmar apenas depois de conferir o documento oficial. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Após leitura do PDF examinar prévia de importação.
2. Corrigir campos extraídos incorretos.
3. Confirmar apenas depois de conferir o documento oficial.

- **Evidência/nuance auditada:** O PDF original fica em memória durante a revisão; importação requer confirmação e comparação humana com a NE oficial; falha de parser não autoriza inventar campos.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria. **Quando aplicável, aguardar a ação explícita Salvar/Aplicar e sua confirmação; não deduzir commit a partir da prévia.**
- **Erro, bloqueio e restrição:** A IA não deve inventar valores ausentes. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como revisar NE importada? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-009, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts#L61-L74) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-010"></a>

#### F-03-010 — Abrir detalhe da NE

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Buscar o empenho.; Selecionar cartão/linha de NE.; Analisar fornecedor, pregão, itens, NFs e saldos. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Buscar o empenho.
2. Selecionar cartão/linha de NE.
3. Analisar fornecedor, pregão, itens, NFs e saldos.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Ação de leitura. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como abrir detalhe da NE? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-010, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-011"></a>

#### F-03-011 — Editar CNPJ do fornecedor em NE

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Abrir detalhe da NE.; Selecionar edição de CNPJ.; Informar novo CNPJ e revisar impactos em NF/NS vinculadas.; Confirmar somente após as advertências do sistema. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir detalhe da NE.
2. Selecionar edição de CNPJ.
3. Informar novo CNPJ e revisar impactos em NF/NS vinculadas.
4. Confirmar somente após as advertências do sistema.

- **Evidência/nuance auditada:** Edição de CNPJ executa salvaguardas de identidade com NFs/NS relacionadas. Há confirmação especial para NS legada inválida e cancelamento antes de migrar; não sugerir substituição textual livre.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Migração de identidade financeira pode afetar documentos relacionados. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** mudança de maior risco; confirmação humana e integridade obrigatórias. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como editar CNPJ do fornecedor em NE? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-011, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts#L236-L324) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-012"></a>

#### F-03-012 — Editar pregão da NE

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Abrir detalhe da NE.; Acionar edição de pregão.; Corrigir número e salvar. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir detalhe da NE.
2. Acionar edição de pregão.
3. Corrigir número e salvar.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Não alterar outros atributos desnecessariamente. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como editar pregão da NE? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-012, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-013"></a>

#### F-03-013 — Editar nota de crédito da NE

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Abrir detalhe da NE.; Selecionar edição da NC.; Inserir identificador no formato exigido.; Salvar. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir detalhe da NE.
2. Selecionar edição da NC.
3. Inserir identificador no formato exigido.
4. Salvar.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Validar formato e origem documental. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como editar nota de crédito da NE? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-013, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-014"></a>

#### F-03-014 — Alterar classificação da NE

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Abrir detalhe da NE.; Selecionar classe de empenho.; Salvar e conferir a nova classificação. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir detalhe da NE.
2. Selecionar classe de empenho.
3. Salvar e conferir a nova classificação.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Classes configuráveis pela unidade. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como alterar classificação da NE? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-014, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-015"></a>

#### F-03-015 — Adicionar item à NE

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Abrir detalhe da NE ou Itens do Empenho.; Selecionar 'Adicionar Novo Item'.; Informar código/NR do item, descrição, unidade, quantidade e preço unitário.; Salvar e conferir saldo. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir detalhe da NE ou Itens do Empenho.
2. Selecionar 'Adicionar Novo Item'.
3. Informar código/NR do item, descrição, unidade, quantidade e preço unitário.
4. Salvar e conferir saldo.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Unidade e quantidade devem corresponder ao documento original. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como adicionar item à NE? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-015, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-016"></a>

#### F-03-016 — Editar descritivo ou NR de item

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** No detalhe da NE localizar item.; Acionar editar.; Corrigir descritivo e/ou número do item.; Salvar. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. No detalhe da NE localizar item.
2. Acionar editar.
3. Corrigir descritivo e/ou número do item.
4. Salvar.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Não substituir identificação oficial por aproximação textual. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como editar descritivo ou NR de item? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-016, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-017"></a>

#### F-03-017 — Remover item de NE

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Abrir itens da NE.; Escolher remoção do item específico.; Ler validações e confirmar, se permitido. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir itens da NE.
2. Escolher remoção do item específico.
3. Ler validações e confirmar, se permitido.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Pode ser bloqueado por NF, saldo ou vínculos existentes. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como remover item de NE? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-017, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-018"></a>

#### F-03-018 — Consultar saldo por item de NE

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir detalhe da NE.; Localizar 'Saldo por Itens do Empenho'.; Ler quantidade empenhada, recebida e restante por item. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir detalhe da NE.
2. Localizar 'Saldo por Itens do Empenho'.
3. Ler quantidade empenhada, recebida e restante por item.

- **Evidência/nuance auditada:** Saldo por item é quantidade empenhada menos quantidade recebida; não é posição física do Depósito.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Saldo de NE não equivale a saldo físico do depósito. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como consultar saldo por item de NE? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-018, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/dashboard/components/DashboardView.tsx#L75-L78) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-019"></a>

#### F-03-019 — Gerar ou imprimir relatório de NE

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir detalhe da NE.; Selecionar impressão/relatório em PDF.; Conferir conteúdo e salvar ou imprimir. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir detalhe da NE.
2. Selecionar impressão/relatório em PDF.
3. Conferir conteúdo e salvar ou imprimir.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** O documento reproduz registros autorizados. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como gerar ou imprimir relatório de NE? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-019, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-020"></a>

#### F-03-020 — Gerenciar classes de empenho

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Abrir Empenhos > Classes.; Consultar códigos e descrições.; Editar classe ou adicionar nova classe, preenchendo código e descritivo.; Salvar. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Empenhos > Classes.
2. Consultar códigos e descrições.
3. Editar classe ou adicionar nova classe, preenchendo código e descritivo.
4. Salvar.

- **Evidência/nuance auditada:** Configuração de classe inclui a exigência de Termo de Recebimento; essa política afeta o fluxo documental, não apenas a aparência de filtros.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Configuração tem impacto em classificações e relatórios. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como gerenciar classes de empenho? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-020, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx#L1874-L1920) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-021"></a>

#### F-03-021 — Excluir NE

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Abrir detalhe da NE.; Acionar excluir.; Ler bloqueios de integridade e confirmar se permitido. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir detalhe da NE.
2. Acionar excluir.
3. Ler bloqueios de integridade e confirmar se permitido.

- **Evidência/nuance auditada:** Exclusão de NE usa serviço transacional para documentos relacionados, com limites de segurança de volume e locks de NS; não orientar eliminação de vínculos para contornar bloqueio.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Ação destrutiva: a Eleonor apenas orienta, não executa. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** mudança de maior risco; confirmação humana e integridade obrigatórias. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como excluir NE? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-021, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/empenhoDeletionService.ts#L37-L41) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-03-022"></a>

#### F-03-022 — Anexar ou consultar PDF de Nota de Empenho

- **Domínio / intenção / acesso:** Empenhos e itens da NE · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; gravação sujeita às validações do serviço. **Disponibilidade:** `GATED` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Empenhos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Abrir a NE desejada.; Usar os controles de documento PDF da NE.; Anexar versão permitida ou abrir/baixar arquivo salvo. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir a NE desejada.
2. Usar os controles de documento PDF da NE.
3. Anexar versão permitida ou abrir/baixar arquivo salvo.

- **Evidência/nuance auditada:** Anexar versão de PDF da NE é operação documental distinta do parser inicial e usa armazenamento privado; pode visualizar, imprimir e baixar arquivo ativo.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Depende de storage/Drive e autorização; não inventar link documental. Conferir NE/exercício/fornecedor e vínculo com NF antes de qualquer gravação. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** alterações de NE/itens podem afetar cálculo e vínculos financeiros. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como anexar ou consultar PDF de Nota de Empenho? **R:** Orientar o caminho **Central de Empenhos > Empenhos**, detalhar somente etapas verificáveis do cartão F-03-022, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/components/EmpenhosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/empenhos/hooks/useEmpenhoActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/components/EmpenhoDocumentActions.tsx#L40-L74) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).


<a id="f-04-cartoes"></a>

### F-04 cartoes — NFs, NS, espelho e TR

<a id="f-04-001"></a>

#### F-04-001 — Acompanhar NFs cadastradas

- **Domínio / intenção / acesso:** Notas Fiscais, NS e TR · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; identidade NF/CNPJ/NE/NS; documentos privados. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Notas Fiscais; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir 'Notas Fiscais'.; Selecionar 'Acompanhar Notas Cadastradas'.; Examinar listagem, fornecedor, NE, totais e tramitação. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir 'Notas Fiscais'.
2. Selecionar 'Acompanhar Notas Cadastradas'.
3. Examinar listagem, fornecedor, NE, totais e tramitação.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** A situação é derivada dos registros existentes. Identificar a NF por documento + CNPJ/NE; não inferir recebimento a partir de PDF. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** recebimentos modificam saldos da NE; documentos e tramitação têm estados próprios. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como acompanhar NFs cadastradas? **R:** Orientar o caminho **Central de Empenhos > Notas Fiscais**, detalhar somente etapas verificáveis do cartão F-04-001, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-04-002"></a>

#### F-04-002 — Buscar nota fiscal

- **Domínio / intenção / acesso:** Notas Fiscais, NS e TR · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; identidade NF/CNPJ/NE/NS; documentos privados. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Notas Fiscais; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Na aba Acompanhar digitar número, fornecedor ou NE.; Examinar os resultados.; Abrir a nota para conferir. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Na aba Acompanhar digitar número, fornecedor ou NE.
2. Examinar os resultados.
3. Abrir a nota para conferir.

- **Evidência/nuance auditada:** Número de NF isolado não é chave universal: identidade inclui fornecedor/CNPJ e recordKey. Repetição do número em fornecedores diferentes requer desambiguação.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Checar CNPJ e identidade da NF para números repetidos. Identificar a NF por documento + CNPJ/NE; não inferir recebimento a partir de PDF. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** recebimentos modificam saldos da NE; documentos e tramitação têm estados próprios. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como buscar nota fiscal? **R:** Orientar o caminho **Central de Empenhos > Notas Fiscais**, detalhar somente etapas verificáveis do cartão F-04-002, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/invoiceIdentity.ts) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-04-003"></a>

#### F-04-003 — Filtrar NF por NE

- **Domínio / intenção / acesso:** Notas Fiscais, NS e TR · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; identidade NF/CNPJ/NE/NS; documentos privados. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Notas Fiscais; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir Acompanhar Notas.; Selecionar empenho no filtro.; Ler apenas as NFs relacionadas. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Acompanhar Notas.
2. Selecionar empenho no filtro.
3. Ler apenas as NFs relacionadas.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Somente NFs autorizadas. Identificar a NF por documento + CNPJ/NE; não inferir recebimento a partir de PDF. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** recebimentos modificam saldos da NE; documentos e tramitação têm estados próprios. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como filtrar NF por NE? **R:** Orientar o caminho **Central de Empenhos > Notas Fiscais**, detalhar somente etapas verificáveis do cartão F-04-003, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-04-004"></a>

#### F-04-004 — Filtrar NF por mês

- **Domínio / intenção / acesso:** Notas Fiscais, NS e TR · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; identidade NF/CNPJ/NE/NS; documentos privados. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Notas Fiscais; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir Acompanhar Notas.; Selecionar mês/ano disponível.; Examinar as notas do período. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Acompanhar Notas.
2. Selecionar mês/ano disponível.
3. Examinar as notas do período.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Usar a data do documento definida pelo sistema. Identificar a NF por documento + CNPJ/NE; não inferir recebimento a partir de PDF. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** recebimentos modificam saldos da NE; documentos e tramitação têm estados próprios. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como filtrar NF por mês? **R:** Orientar o caminho **Central de Empenhos > Notas Fiscais**, detalhar somente etapas verificáveis do cartão F-04-004, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-04-005"></a>

#### F-04-005 — Filtrar NF por tramitação

- **Domínio / intenção / acesso:** Notas Fiscais, NS e TR · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; identidade NF/CNPJ/NE/NS; documentos privados. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Notas Fiscais; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir Acompanhar Notas.; Selecionar filtro de tramitação.; Revisar status e pendências listadas. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Acompanhar Notas.
2. Selecionar filtro de tramitação.
3. Revisar status e pendências listadas.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Não afirmar que todo documento pendente foi efetivamente recebido. Identificar a NF por documento + CNPJ/NE; não inferir recebimento a partir de PDF. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** recebimentos modificam saldos da NE; documentos e tramitação têm estados próprios. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como filtrar NF por tramitação? **R:** Orientar o caminho **Central de Empenhos > Notas Fiscais**, detalhar somente etapas verificáveis do cartão F-04-005, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-04-006"></a>

#### F-04-006 — Ordenar NFs

- **Domínio / intenção / acesso:** Notas Fiscais, NS e TR · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; identidade NF/CNPJ/NE/NS; documentos privados. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Notas Fiscais; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Na listagem de Notas Fiscais usar a ordenação disponível.; Selecionar sequência desejada.; Verificar os resultados. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Na listagem de Notas Fiscais usar a ordenação disponível.
2. Selecionar sequência desejada.
3. Verificar os resultados.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Ordenação não altera registros. Identificar a NF por documento + CNPJ/NE; não inferir recebimento a partir de PDF. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** recebimentos modificam saldos da NE; documentos e tramitação têm estados próprios. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como ordenar NFs? **R:** Orientar o caminho **Central de Empenhos > Notas Fiscais**, detalhar somente etapas verificáveis do cartão F-04-006, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-04-007"></a>

#### F-04-007 — Cadastrar NF

- **Domínio / intenção / acesso:** Notas Fiscais, NS e TR · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; identidade NF/CNPJ/NE/NS; documentos privados. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Notas Fiscais; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Abrir Notas Fiscais > Cadastrar Nova Nota Fiscal.; Selecionar a NE associada.; Informar número e data da NF e quantidades recebidas por item.; Revisar valores, saldo e duplicidade e confirmar. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Notas Fiscais > Cadastrar Nova Nota Fiscal.
2. Selecionar a NE associada.
3. Informar número e data da NF e quantidades recebidas por item.
4. Revisar valores, saldo e duplicidade e confirmar.

- **Evidência/nuance auditada:** Salvar recebimento valida empenho, número NF, CNPJ associado, duplicidade por identidade e ao menos uma quantidade positiva; proíbe quantidade acima do saldo do item. O valor financeiro usa quantidade × preço unitário da NE.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Cadastro altera recebimento financeiro e precisa refletir documento real. Identificar a NF por documento + CNPJ/NE; não inferir recebimento a partir de PDF. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Correção/exclusão deve seguir ações explícitas, preservar vínculo e recalcular recebimentos; não orientar lançamento negativo informal.
- **Consequência:** recebimentos modificam saldos da NE; documentos e tramitação têm estados próprios. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como cadastrar NF? **R:** Orientar o caminho **Central de Empenhos > Notas Fiscais**, detalhar somente etapas verificáveis do cartão F-04-007, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts#L74-L168) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-04-008"></a>

#### F-04-008 — Anexar PDF da NF

- **Domínio / intenção / acesso:** Notas Fiscais, NS e TR · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; identidade NF/CNPJ/NE/NS; documentos privados. **Disponibilidade:** `GATED` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Notas Fiscais; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** No cadastro ou detalhe da NF selecionar arquivo PDF.; Conferir formato/tamanho permitido.; Enviar e confirmar registro da versão documental. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. No cadastro ou detalhe da NF selecionar arquivo PDF.
2. Conferir formato/tamanho permitido.
3. Enviar e confirmar registro da versão documental.

- **Evidência/nuance auditada:** Arquivo NF exige PDF até 10 MB no formulário. A persistência da NF antecede o anexo: se o upload falhar, a NF permanece cadastrada e o PDF pode ser anexado depois; nunca instruir repetir o cadastro cegamente.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** No formulário auditado o limite indicado é 10 MB. Identificar a NF por documento + CNPJ/NE; não inferir recebimento a partir de PDF. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** recebimentos modificam saldos da NE; documentos e tramitação têm estados próprios. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como anexar PDF da NF? **R:** Orientar o caminho **Central de Empenhos > Notas Fiscais**, detalhar somente etapas verificáveis do cartão F-04-008, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts#L305-L355) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-04-009"></a>

#### F-04-009 — Editar NF

- **Domínio / intenção / acesso:** Notas Fiscais, NS e TR · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; identidade NF/CNPJ/NE/NS; documentos privados. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Notas Fiscais; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Na lista ou detalhe selecionar NF.; Acionar edição.; Corrigir campos/quantidades permitidos.; Salvar após revisão das repercussões na NE. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Na lista ou detalhe selecionar NF.
2. Acionar edição.
3. Corrigir campos/quantidades permitidos.
4. Salvar após revisão das repercussões na NE.

- **Evidência/nuance auditada:** Editar NF desfaz a contribuição anterior ao saldo antes de validar e reaplicar as quantidades novas; conferir NF por chave física correta.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Recalcular saldo vinculado com integridade transacional. Identificar a NF por documento + CNPJ/NE; não inferir recebimento a partir de PDF. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Correção/exclusão deve seguir ações explícitas, preservar vínculo e recalcular recebimentos; não orientar lançamento negativo informal.
- **Consequência:** recebimentos modificam saldos da NE; documentos e tramitação têm estados próprios. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como editar NF? **R:** Orientar o caminho **Central de Empenhos > Notas Fiscais**, detalhar somente etapas verificáveis do cartão F-04-009, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts#L74-L168) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-04-010"></a>

#### F-04-010 — Excluir NF

- **Domínio / intenção / acesso:** Notas Fiscais, NS e TR · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; identidade NF/CNPJ/NE/NS; documentos privados. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Notas Fiscais; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Na NF selecionar ação excluir.; Ler confirmação e eventuais impedimentos.; Confirmar quando a exclusão for legítima. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Na NF selecionar ação excluir.
2. Ler confirmação e eventuais impedimentos.
3. Confirmar quando a exclusão for legítima.

- **Evidência/nuance auditada:** Exclusão da NF é confirmada e reverte quantidades recebidas do empenho; operação transacional pode ser negada; não é mera ocultação da linha.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Exclusão ajusta recebimentos da NE; não tratar como simples remoção visual. Identificar a NF por documento + CNPJ/NE; não inferir recebimento a partir de PDF. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Correção/exclusão deve seguir ações explícitas, preservar vínculo e recalcular recebimentos; não orientar lançamento negativo informal.
- **Consequência:** recebimentos modificam saldos da NE; documentos e tramitação têm estados próprios. **Segurança:** mudança de maior risco; confirmação humana e integridade obrigatórias. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como excluir NF? **R:** Orientar o caminho **Central de Empenhos > Notas Fiscais**, detalhar somente etapas verificáveis do cartão F-04-010, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts#L447-L505) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-04-011"></a>

#### F-04-011 — Abrir itens de NF

- **Domínio / intenção / acesso:** Notas Fiscais, NS e TR · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; identidade NF/CNPJ/NE/NS; documentos privados. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Notas Fiscais; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Na listagem ou detalhe clicar na ação 'Ver Itens da Nota Fiscal'.; Conferir itens e quantidades.; Retornar à lista. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Na listagem ou detalhe clicar na ação 'Ver Itens da Nota Fiscal'.
2. Conferir itens e quantidades.
3. Retornar à lista.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Consulta não modifica registros. Identificar a NF por documento + CNPJ/NE; não inferir recebimento a partir de PDF. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** recebimentos modificam saldos da NE; documentos e tramitação têm estados próprios. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como abrir itens de NF? **R:** Orientar o caminho **Central de Empenhos > Notas Fiscais**, detalhar somente etapas verificáveis do cartão F-04-011, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-04-012"></a>

#### F-04-012 — Gerar/imprimir relatório ou PDF de NF

- **Domínio / intenção / acesso:** Notas Fiscais, NS e TR · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; identidade NF/CNPJ/NE/NS; documentos privados. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Notas Fiscais; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir o detalhe/ações da NF.; Selecionar geração/impressão do documento disponível.; Revisar e salvar. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir o detalhe/ações da NF.
2. Selecionar geração/impressão do documento disponível.
3. Revisar e salvar.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Não confundir espelho da NF com documento original do fornecedor. Identificar a NF por documento + CNPJ/NE; não inferir recebimento a partir de PDF. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** recebimentos modificam saldos da NE; documentos e tramitação têm estados próprios. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como gerar/imprimir relatório ou PDF de NF? **R:** Orientar o caminho **Central de Empenhos > Notas Fiscais**, detalhar somente etapas verificáveis do cartão F-04-012, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-04-013"></a>

#### F-04-013 — Anexar ou consultar espelho da NF

- **Domínio / intenção / acesso:** Notas Fiscais, NS e TR · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; identidade NF/CNPJ/NE/NS; documentos privados. **Disponibilidade:** `GATED` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Notas Fiscais; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Abrir nota e suas ações documentais.; Selecionar espelho quando disponível.; Anexar versão ou abrir/baixar documento registrado. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir nota e suas ações documentais.
2. Selecionar espelho quando disponível.
3. Anexar versão ou abrir/baixar documento registrado.

- **Evidência/nuance auditada:** Espelho é PDF opcional e documentalmente distinto da NF original; quando presente pode integrar o consolidado de liquidação.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Armazenamento e acesso dependem de permissões. Identificar a NF por documento + CNPJ/NE; não inferir recebimento a partir de PDF. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** recebimentos modificam saldos da NE; documentos e tramitação têm estados próprios. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como anexar ou consultar espelho da NF? **R:** Orientar o caminho **Central de Empenhos > Notas Fiscais**, detalhar somente etapas verificáveis do cartão F-04-013, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/components/InvoiceMirrorDocumentActions.tsx#L35-L107) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-04-014"></a>

#### F-04-014 — Registrar ou corrigir NS

- **Domínio / intenção / acesso:** Notas Fiscais, NS e TR · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; identidade NF/CNPJ/NE/NS; documentos privados. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Notas Fiscais; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Abrir NF com controle de Nota de Sistema disponível.; Preencher ou corrigir número da NS.; Validar identidade UG, CNPJ, NF, NE e ausência de conflito.; Salvar. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir NF com controle de Nota de Sistema disponível.
2. Preencher ou corrigir número da NS.
3. Validar identidade UG, CNPJ, NF, NE e ausência de conflito.
4. Salvar.

- **Evidência/nuance auditada:** NS deve obedecer AAAANS000000 e identidade UG + NS; conflitos, reutilização e NS legada exigem integridade, não aproximação por número da nota.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Não forçar NS em documento sem conciliação íntegra. Identificar a NF por documento + CNPJ/NE; não inferir recebimento a partir de PDF. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** recebimentos modificam saldos da NE; documentos e tramitação têm estados próprios. **Segurança:** mudança de maior risco; confirmação humana e integridade obrigatórias. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como registrar ou corrigir NS? **R:** Orientar o caminho **Central de Empenhos > Notas Fiscais**, detalhar somente etapas verificáveis do cartão F-04-014, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/nsIntegrity.ts#L53-L103) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-04-015"></a>

#### F-04-015 — Consultar tramitação de NF/NS

- **Domínio / intenção / acesso:** Notas Fiscais, NS e TR · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; identidade NF/CNPJ/NE/NS; documentos privados. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Notas Fiscais; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir Notas Fiscais ou detalhe da NE.; Localizar situação de tramitação e NS.; Interpretar o status conforme os campos efetivamente preenchidos. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Notas Fiscais ou detalhe da NE.
2. Localizar situação de tramitação e NS.
3. Interpretar o status conforme os campos efetivamente preenchidos.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Pendente é um estado verificável, não uma previsão de conclusão. Identificar a NF por documento + CNPJ/NE; não inferir recebimento a partir de PDF. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** recebimentos modificam saldos da NE; documentos e tramitação têm estados próprios. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como consultar tramitação de NF/NS? **R:** Orientar o caminho **Central de Empenhos > Notas Fiscais**, detalhar somente etapas verificáveis do cartão F-04-015, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-04-016"></a>

#### F-04-016 — Configurar comissão de recebimento

- **Domínio / intenção / acesso:** Notas Fiscais, NS e TR · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; identidade NF/CNPJ/NE/NS; documentos privados. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Notas Fiscais; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Abrir Notas Fiscais > Comissões de Recebimento.; Informar mês, boletim, data e integrantes/postos.; Salvar configuração da comissão. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Notas Fiscais > Comissões de Recebimento.
2. Informar mês, boletim, data e integrantes/postos.
3. Salvar configuração da comissão.

- **Evidência/nuance auditada:** Comissão usa mês, número/data de Boletim Interno, presidente e integrantes/postos; necessidade de TR depende da classe; não atribuir integrantes inventados.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Documentos devem seguir os dados administrativos reais. Identificar a NF por documento + CNPJ/NE; não inferir recebimento a partir de PDF. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** recebimentos modificam saldos da NE; documentos e tramitação têm estados próprios. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como configurar comissão de recebimento? **R:** Orientar o caminho **Central de Empenhos > Notas Fiscais**, detalhar somente etapas verificáveis do cartão F-04-016, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx#L1190-L1300) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-04-017"></a>

#### F-04-017 — Emitir Termo de Recebimento

- **Domínio / intenção / acesso:** Notas Fiscais, NS e TR · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; identidade NF/CNPJ/NE/NS; documentos privados. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Notas Fiscais; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir NF com recebimento correspondente.; Selecionar 'Baixar Termo de Recebimento'.; Conferir comissão e dados da nota no PDF. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir NF com recebimento correspondente.
2. Selecionar 'Baixar Termo de Recebimento'.
3. Conferir comissão e dados da nota no PDF.

- **Evidência/nuance auditada:** TR é gerado com dados administrativos e política da classe. Documento PDF gerado não prova recebimento físico; classes dispensadas devem ser respeitadas.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Disponibilidade condicionada a dados/documentação exigidos. Identificar a NF por documento + CNPJ/NE; não inferir recebimento a partir de PDF. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** recebimentos modificam saldos da NE; documentos e tramitação têm estados próprios. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como emitir Termo de Recebimento? **R:** Orientar o caminho **Central de Empenhos > Notas Fiscais**, detalhar somente etapas verificáveis do cartão F-04-017, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/components/TermoRecebimentoActions.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-04-018"></a>

#### F-04-018 — Conferir vínculo de documentos com NE

- **Domínio / intenção / acesso:** Notas Fiscais, NS e TR · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; identidade NF/CNPJ/NE/NS; documentos privados. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Notas Fiscais; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir detalhe de Empenhos.; Localizar 'Notas Fiscais Cadastradas para este Empenho'.; Abrir NF e verificar itens/NS/recebimentos. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir detalhe de Empenhos.
2. Localizar 'Notas Fiscais Cadastradas para este Empenho'.
3. Abrir NF e verificar itens/NS/recebimentos.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Não deduzir relação apenas de semelhança no fornecedor. Identificar a NF por documento + CNPJ/NE; não inferir recebimento a partir de PDF. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** recebimentos modificam saldos da NE; documentos e tramitação têm estados próprios. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como conferir vínculo de documentos com NE? **R:** Orientar o caminho **Central de Empenhos > Notas Fiscais**, detalhar somente etapas verificáveis do cartão F-04-018, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/hooks/useNotasFiscaisActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/notas-fiscais/components/NotasFiscaisView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).


<a id="f-05-cartoes"></a>

### F-05 cartoes — Cronogramas, PDF e envio

<a id="f-05-001"></a>

#### F-05-001 — Listar cronogramas por NE

- **Domínio / intenção / acesso:** Cronogramas · `HOWTO_READ` (responder instrução; não executar) · sessão operacional; envio exige conta Google do setor e PDF de NE ativo. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Cronogramas; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir 'Cronogramas'.; Consultar NE e indicadores de configuração/execução.; Selecionar a NE a programar. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir 'Cronogramas'.
2. Consultar NE e indicadores de configuração/execução.
3. Selecionar a NE a programar.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** A lista usa empenhos do setor. Usar identificação exata da NE, remessas e datas; separar configuração, PDF, envio e histórico. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** planejamento e comunicação; PDF/registro não comprovam entrega física. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como listar cronogramas por NE? **R:** Orientar o caminho **Central de Empenhos > Cronogramas**, detalhar somente etapas verificáveis do cartão F-05-001, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/components/CronogramasView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/components/CronogramasView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-05-002"></a>

#### F-05-002 — Criar cronograma

- **Domínio / intenção / acesso:** Cronogramas · `HOWTO_WRITE` (responder instrução; não executar) · sessão operacional; envio exige conta Google do setor e PDF de NE ativo. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Cronogramas; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Abrir Cronogramas.; Escolher NE e 'Gerar Cronograma'.; Distribuir as quantidades disponíveis entre remessas e datas.; Salvar. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Cronogramas.
2. Escolher NE e 'Gerar Cronograma'.
3. Distribuir as quantidades disponíveis entre remessas e datas.
4. Salvar.

- **Evidência/nuance auditada:** Ao abrir uma NE sem cronograma prévio, o hook propõe 2 remessas quinzenais e distribui o saldo. É sugestão local; não há envio implícito.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Não programar recebimentos acima do saldo registrado. Usar identificação exata da NE, remessas e datas; separar configuração, PDF, envio e histórico. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** planejamento e comunicação; PDF/registro não comprovam entrega física. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como criar cronograma? **R:** Orientar o caminho **Central de Empenhos > Cronogramas**, detalhar somente etapas verificáveis do cartão F-05-002, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/components/CronogramasView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts#L72-L114) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-05-003"></a>

#### F-05-003 — Editar cronograma

- **Domínio / intenção / acesso:** Cronogramas · `HOWTO_WRITE` (responder instrução; não executar) · sessão operacional; envio exige conta Google do setor e PDF de NE ativo. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Cronogramas; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Na NE com status Configurado clicar 'Editar Cronograma'.; Alterar distribuição, datas e instruções.; Salvar novamente. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Na NE com status Configurado clicar 'Editar Cronograma'.
2. Alterar distribuição, datas e instruções.
3. Salvar novamente.

- **Evidência/nuance auditada:** O objeto salvo preserva data original e histórico de e-mails anterior. A interface atual atualiza estado local antes de aguardar persistência; conferir refresh para validar gravação.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Manter histórico e não tratar edição como envio automático. Usar identificação exata da NE, remessas e datas; separar configuração, PDF, envio e histórico. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** planejamento e comunicação; PDF/registro não comprovam entrega física. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como editar cronograma? **R:** Orientar o caminho **Central de Empenhos > Cronogramas**, detalhar somente etapas verificáveis do cartão F-05-003, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/components/CronogramasView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts#L188-L229) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-05-004"></a>

#### F-05-004 — Adicionar remessa

- **Domínio / intenção / acesso:** Cronogramas · `HOWTO_WRITE` (responder instrução; não executar) · sessão operacional; envio exige conta Google do setor e PDF de NE ativo. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Cronogramas; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO). **Etapa preparatória:** alterações em formulário, rascunho, revisão ou prévia não equivalem a gravação definitiva.
- **Entrada, campos e pré-requisitos:** No editor de cronograma escolher adicionar remessa.; Definir data e quantidade por item.; Revisar total programado. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. No editor de cronograma escolher adicionar remessa.
2. Definir data e quantidade por item.
3. Revisar total programado.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria. **Quando aplicável, aguardar a ação explícita Salvar/Aplicar e sua confirmação; não deduzir commit a partir da prévia.**
- **Erro, bloqueio e restrição:** Remessas referem-se à NE selecionada. Usar identificação exata da NE, remessas e datas; separar configuração, PDF, envio e histórico. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reeditar/remontar a distribuição antes de salvar; após envio, um novo envio não apaga o anterior.
- **Consequência:** planejamento e comunicação; PDF/registro não comprovam entrega física. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como adicionar remessa? **R:** Orientar o caminho **Central de Empenhos > Cronogramas**, detalhar somente etapas verificáveis do cartão F-05-004, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/components/CronogramasView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/components/CronogramasView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-05-005"></a>

#### F-05-005 — Remover remessa

- **Domínio / intenção / acesso:** Cronogramas · `HOWTO_WRITE` (responder instrução; não executar) · sessão operacional; envio exige conta Google do setor e PDF de NE ativo. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Cronogramas; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO). **Etapa preparatória:** alterações em formulário, rascunho, revisão ou prévia não equivalem a gravação definitiva.
- **Entrada, campos e pré-requisitos:** No editor localizar coluna de remessa.; Selecionar remover.; Conferir redistribuição antes de salvar. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. No editor localizar coluna de remessa.
2. Selecionar remover.
3. Conferir redistribuição antes de salvar.

- **Evidência/nuance auditada:** A remoção da última remessa é bloqueada com aviso literal: 'O cronograma deve conter pelo menos 1 remessa de entrega.'
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria. **Quando aplicável, aguardar a ação explícita Salvar/Aplicar e sua confirmação; não deduzir commit a partir da prévia.**
- **Erro, bloqueio e restrição:** Pode mudar total programado. Usar identificação exata da NE, remessas e datas; separar configuração, PDF, envio e histórico. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reeditar/remontar a distribuição antes de salvar; após envio, um novo envio não apaga o anterior.
- **Consequência:** planejamento e comunicação; PDF/registro não comprovam entrega física. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como remover remessa? **R:** Orientar o caminho **Central de Empenhos > Cronogramas**, detalhar somente etapas verificáveis do cartão F-05-005, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/components/CronogramasView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts#L181-L187) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-05-006"></a>

#### F-05-006 — Aplicar distribuição predefinida

- **Domínio / intenção / acesso:** Cronogramas · `HOWTO_WRITE` (responder instrução; não executar) · sessão operacional; envio exige conta Google do setor e PDF de NE ativo. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Cronogramas; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO). **Etapa preparatória:** alterações em formulário, rascunho, revisão ou prévia não equivalem a gravação definitiva.
- **Entrada, campos e pré-requisitos:** No editor selecionar opção de parcelas/preset.; Revisar datas e quantidades sugeridas.; Ajustar manualmente conforme necessidade. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. No editor selecionar opção de parcelas/preset.
2. Revisar datas e quantidades sugeridas.
3. Ajustar manualmente conforme necessidade.

- **Evidência/nuance auditada:** Preset divide o saldo usando quociente inteiro e resto na primeira remessa; para quantidades fracionárias a adequação deste algoritmo requer revisão específica. Não recomendar resultado sem conferência.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria. **Quando aplicável, aguardar a ação explícita Salvar/Aplicar e sua confirmação; não deduzir commit a partir da prévia.**
- **Erro, bloqueio e restrição:** Sugestões não substituem o planejamento operacional. Usar identificação exata da NE, remessas e datas; separar configuração, PDF, envio e histórico. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reeditar/remontar a distribuição antes de salvar; após envio, um novo envio não apaga o anterior.
- **Consequência:** planejamento e comunicação; PDF/registro não comprovam entrega física. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como aplicar distribuição predefinida? **R:** Orientar o caminho **Central de Empenhos > Cronogramas**, detalhar somente etapas verificáveis do cartão F-05-006, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/components/CronogramasView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts#L117-L140) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-05-007"></a>

#### F-05-007 — Programar tudo na primeira remessa

- **Domínio / intenção / acesso:** Cronogramas · `HOWTO_WRITE` (responder instrução; não executar) · sessão operacional; envio exige conta Google do setor e PDF de NE ativo. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Cronogramas; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO). **Etapa preparatória:** alterações em formulário, rascunho, revisão ou prévia não equivalem a gravação definitiva.
- **Entrada, campos e pré-requisitos:** Selecionar opção de alocação integral na primeira remessa.; Conferir itens e saldo.; Salvar se a entrega integral for o objetivo. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Selecionar opção de alocação integral na primeira remessa.
2. Conferir itens e saldo.
3. Salvar se a entrega integral for o objetivo.

- **Evidência/nuance auditada:** A opção aloca 100% do saldo atual na primeira remessa, sem consultar disponibilidade real do fornecedor.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria. **Quando aplicável, aguardar a ação explícita Salvar/Aplicar e sua confirmação; não deduzir commit a partir da prévia.**
- **Erro, bloqueio e restrição:** Não pressupor disponibilidade de fornecedor. Usar identificação exata da NE, remessas e datas; separar configuração, PDF, envio e histórico. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reeditar/remontar a distribuição antes de salvar; após envio, um novo envio não apaga o anterior.
- **Consequência:** planejamento e comunicação; PDF/registro não comprovam entrega física. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como programar tudo na primeira remessa? **R:** Orientar o caminho **Central de Empenhos > Cronogramas**, detalhar somente etapas verificáveis do cartão F-05-007, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/components/CronogramasView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts#L143-L156) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-05-008"></a>

#### F-05-008 — Limpar distribuição de remessas

- **Domínio / intenção / acesso:** Cronogramas · `HOWTO_WRITE` (responder instrução; não executar) · sessão operacional; envio exige conta Google do setor e PDF de NE ativo. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Cronogramas; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO). **Etapa preparatória:** alterações em formulário, rascunho, revisão ou prévia não equivalem a gravação definitiva.
- **Entrada, campos e pré-requisitos:** Usar opção de limpar distribuição.; Confirmar as linhas zeradas.; Preencher novo planejamento antes de salvar. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Usar opção de limpar distribuição.
2. Confirmar as linhas zeradas.
3. Preencher novo planejamento antes de salvar.

- **Evidência/nuance auditada:** Limpar distribuição atribui zero a todas as combinações item/remessa; não exclui NE, tampouco prova gravação enquanto não salvar.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria. **Quando aplicável, aguardar a ação explícita Salvar/Aplicar e sua confirmação; não deduzir commit a partir da prévia.**
- **Erro, bloqueio e restrição:** Não é exclusão da NE. Usar identificação exata da NE, remessas e datas; separar configuração, PDF, envio e histórico. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reeditar/remontar a distribuição antes de salvar; após envio, um novo envio não apaga o anterior.
- **Consequência:** planejamento e comunicação; PDF/registro não comprovam entrega física. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como limpar distribuição de remessas? **R:** Orientar o caminho **Central de Empenhos > Cronogramas**, detalhar somente etapas verificáveis do cartão F-05-008, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/components/CronogramasView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts#L159-L171) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-05-009"></a>

#### F-05-009 — Preencher instruções de entrega

- **Domínio / intenção / acesso:** Cronogramas · `HOWTO_WRITE` (responder instrução; não executar) · sessão operacional; envio exige conta Google do setor e PDF de NE ativo. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Cronogramas; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO). **Etapa preparatória:** alterações em formulário, rascunho, revisão ou prévia não equivalem a gravação definitiva.
- **Entrada, campos e pré-requisitos:** No editor localizar informações complementares.; Informar local, dias/horários, exigências de temperatura, validade e orientações.; Conferir contato e responsável. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. No editor localizar informações complementares.
2. Informar local, dias/horários, exigências de temperatura, validade e orientações.
3. Conferir contato e responsável.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria. **Quando aplicável, aguardar a ação explícita Salvar/Aplicar e sua confirmação; não deduzir commit a partir da prévia.**
- **Erro, bloqueio e restrição:** Tratar como instrução institucional, não mensagem espontânea da Eleonor. Usar identificação exata da NE, remessas e datas; separar configuração, PDF, envio e histórico. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reeditar/remontar a distribuição antes de salvar; após envio, um novo envio não apaga o anterior.
- **Consequência:** planejamento e comunicação; PDF/registro não comprovam entrega física. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como preencher instruções de entrega? **R:** Orientar o caminho **Central de Empenhos > Cronogramas**, detalhar somente etapas verificáveis do cartão F-05-009, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/components/CronogramasView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/components/CronogramasView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-05-010"></a>

#### F-05-010 — Gerar prévia de cronograma

- **Domínio / intenção / acesso:** Cronogramas · `HOWTO_READ` (responder instrução; não executar) · sessão operacional; envio exige conta Google do setor e PDF de NE ativo. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Cronogramas; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Selecionar prévia de impressão.; Revisar cabeçalho, NE, itens, quantidades e instruções.; Fechar prévia ou corrigir dados. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Selecionar prévia de impressão.
2. Revisar cabeçalho, NE, itens, quantidades e instruções.
3. Fechar prévia ou corrigir dados.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Prévia não prova que o fornecedor recebeu. Usar identificação exata da NE, remessas e datas; separar configuração, PDF, envio e histórico. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** planejamento e comunicação; PDF/registro não comprovam entrega física. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como gerar prévia de cronograma? **R:** Orientar o caminho **Central de Empenhos > Cronogramas**, detalhar somente etapas verificáveis do cartão F-05-010, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/components/CronogramasView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/components/CronogramasView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-05-011"></a>

#### F-05-011 — Imprimir ou baixar cronograma PDF

- **Domínio / intenção / acesso:** Cronogramas · `HOWTO_READ` (responder instrução; não executar) · sessão operacional; envio exige conta Google do setor e PDF de NE ativo. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Cronogramas; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** No cronograma configurado selecionar imprimir/gerar PDF.; Conferir documento.; Salvar ou imprimir. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. No cronograma configurado selecionar imprimir/gerar PDF.
2. Conferir documento.
3. Salvar ou imprimir.

- **Evidência/nuance auditada:** Imprimir pode abrir nova janela ou, caso pop-up seja bloqueado, baixar diretamente; gerar PDF não envia nem registra entrega.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Documento do setor e da NE autorizada. Usar identificação exata da NE, remessas e datas; separar configuração, PDF, envio e histórico. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** planejamento e comunicação; PDF/registro não comprovam entrega física. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como imprimir ou baixar cronograma PDF? **R:** Orientar o caminho **Central de Empenhos > Cronogramas**, detalhar somente etapas verificáveis do cartão F-05-011, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/components/CronogramasView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts#L505-L527) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-05-012"></a>

#### F-05-012 — Enviar cronograma por e-mail

- **Domínio / intenção / acesso:** Cronogramas · `HOWTO_WRITE` (responder instrução; não executar) · sessão operacional; envio exige conta Google do setor e PDF de NE ativo. **Disponibilidade:** `GATED` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Cronogramas; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** No cronograma abrir ação de envio disponível.; Selecionar destinatário/endereço do fornecedor e revisar mensagem.; Confirmar envio pelo fluxo habilitado. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. No cronograma abrir ação de envio disponível.
2. Selecionar destinatário/endereço do fornecedor e revisar mensagem.
3. Confirmar envio pelo fluxo habilitado.

- **Evidência/nuance auditada:** Envio é ação separada, com diálogo de confirmação, e exige workspace operacional, Google Drive configurado, PDF de NE ativo, autorização Gmail e destinatário válido. Envia dois anexos: cronograma + NE. Gmail pode confirmar envio e a gravação do histórico falhar: conferir pasta Enviados antes de tentar novamente.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Não alegar entrega de e-mail sem confirmação registrada. Usar identificação exata da NE, remessas e datas; separar configuração, PDF, envio e histórico. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** planejamento e comunicação; PDF/registro não comprovam entrega física. **Segurança:** mudança de maior risco; confirmação humana e integridade obrigatórias. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como enviar cronograma por e-mail? **R:** Orientar o caminho **Central de Empenhos > Cronogramas**, detalhar somente etapas verificáveis do cartão F-05-012, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/components/CronogramasView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts#L529-L788) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-05-013"></a>

#### F-05-013 — Consultar histórico de envios

- **Domínio / intenção / acesso:** Cronogramas · `HOWTO_READ` (responder instrução; não executar) · sessão operacional; envio exige conta Google do setor e PDF de NE ativo. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Cronogramas; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir acompanhamento de cronogramas enviados.; Pesquisar fornecedor, NE ou destinatário.; Verificar data, status e paginação. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir acompanhamento de cronogramas enviados.
2. Pesquisar fornecedor, NE ou destinatário.
3. Verificar data, status e paginação.

- **Evidência/nuance auditada:** Acompanhamento faz correspondência heurística entre remessas enviadas e NFs com data de emissão na semana prevista; não registra prova de entrega, aceite ou recebimento pela contraparte.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** O histórico de envio não comprova aceite pelo destinatário. Usar identificação exata da NE, remessas e datas; separar configuração, PDF, envio e histórico. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** planejamento e comunicação; PDF/registro não comprovam entrega física. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como consultar histórico de envios? **R:** Orientar o caminho **Central de Empenhos > Cronogramas**, detalhar somente etapas verificáveis do cartão F-05-013, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/components/CronogramasView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/hooks/useCronogramaActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/cronogramas/domain/cronogramaDeliveryTracking.ts#L63-L91) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).


<a id="f-06-cartoes"></a>

### F-06 cartoes — Fornecedores e consulta de itens

<a id="f-06-001"></a>

#### F-06-001 — Listar fornecedores

- **Domínio / intenção / acesso:** Fornecedores e itens · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; dados de contatos não são públicos. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Fornecedores / Consulta de Itens; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir 'Fornecedores'.; Examinar diretório de fornecedores.; Selecionar fornecedor para ver vínculos e contatos. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir 'Fornecedores'.
2. Examinar diretório de fornecedores.
3. Selecionar fornecedor para ver vínculos e contatos.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Somente cadastro autorizado. Conferir CNPJ; texto do nome é insuficiente para consolidar identidades. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** cadastro/consulta por identidade de fornecedor; itens de NE não equivalem a estoque. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como listar fornecedores? **R:** Orientar o caminho **Central de Empenhos > Fornecedores / Consulta de Itens**, detalhar somente etapas verificáveis do cartão F-06-001, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/itens/components/ConsultaItensView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-06-002"></a>

#### F-06-002 — Pesquisar fornecedor

- **Domínio / intenção / acesso:** Fornecedores e itens · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; dados de contatos não são públicos. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Fornecedores / Consulta de Itens; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Na Central de Fornecedores digitar razão social, CNPJ, NE, e-mail ou telefone.; Examinar resultados.; Abrir cadastro correto. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Na Central de Fornecedores digitar razão social, CNPJ, NE, e-mail ou telefone.
2. Examinar resultados.
3. Abrir cadastro correto.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Identidade preferencial por CNPJ. Conferir CNPJ; texto do nome é insuficiente para consolidar identidades. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** cadastro/consulta por identidade de fornecedor; itens de NE não equivalem a estoque. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como pesquisar fornecedor? **R:** Orientar o caminho **Central de Empenhos > Fornecedores / Consulta de Itens**, detalhar somente etapas verificáveis do cartão F-06-002, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/itens/components/ConsultaItensView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-06-003"></a>

#### F-06-003 — Filtrar fornecedores por situação

- **Domínio / intenção / acesso:** Fornecedores e itens · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; dados de contatos não são públicos. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Fornecedores / Consulta de Itens; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir Fornecedores.; Selecionar 'Todos', 'Ativos' ou 'Pendentes'.; Examinar recorte. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Fornecedores.
2. Selecionar 'Todos', 'Ativos' ou 'Pendentes'.
3. Examinar recorte.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Situação é calculada a partir de registros da unidade. Conferir CNPJ; texto do nome é insuficiente para consolidar identidades. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** cadastro/consulta por identidade de fornecedor; itens de NE não equivalem a estoque. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como filtrar fornecedores por situação? **R:** Orientar o caminho **Central de Empenhos > Fornecedores / Consulta de Itens**, detalhar somente etapas verificáveis do cartão F-06-003, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/itens/components/ConsultaItensView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-06-004"></a>

#### F-06-004 — Cadastrar fornecedor

- **Domínio / intenção / acesso:** Fornecedores e itens · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; dados de contatos não são públicos. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Fornecedores / Consulta de Itens; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Na Central de Fornecedores selecionar cadastrar.; Informar razão social, CNPJ e contatos permitidos.; Revisar e salvar. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Na Central de Fornecedores selecionar cadastrar.
2. Informar razão social, CNPJ e contatos permitidos.
3. Revisar e salvar.

- **Evidência/nuance auditada:** Fornecedor exige razão social e CNPJ válido; e-mail, quando informado, precisa ser válido; reutiliza identificação CNPJ, não cria duplicação arbitrária.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Validar CNPJ e evitar registro duplicado. Conferir CNPJ; texto do nome é insuficiente para consolidar identidades. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** cadastro/consulta por identidade de fornecedor; itens de NE não equivalem a estoque. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como cadastrar fornecedor? **R:** Orientar o caminho **Central de Empenhos > Fornecedores / Consulta de Itens**, detalhar somente etapas verificáveis do cartão F-06-004, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/itens/components/ConsultaItensView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx#L290-L336) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-06-005"></a>

#### F-06-005 — Editar cadastro de fornecedor

- **Domínio / intenção / acesso:** Fornecedores e itens · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; dados de contatos não são públicos. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Fornecedores / Consulta de Itens; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Buscar e abrir fornecedor.; Acionar ícone Editar.; Corrigir razão social ou contatos autorizados.; Salvar. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Buscar e abrir fornecedor.
2. Acionar ícone Editar.
3. Corrigir razão social ou contatos autorizados.
4. Salvar.

- **Evidência/nuance auditada:** O CNPJ do contato não pode ser alterado após cadastro. Alteração de identidade de NE é outro fluxo; o cadastro de fornecedor permite ajustar razão social/contato.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Conciliação com NE pode exigir tratamento de identidade. Conferir CNPJ; texto do nome é insuficiente para consolidar identidades. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Corrigir contatos por edição; CNPJ do fornecedor já cadastrado não é editável nesse formulário.
- **Consequência:** cadastro/consulta por identidade de fornecedor; itens de NE não equivalem a estoque. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como editar cadastro de fornecedor? **R:** Orientar o caminho **Central de Empenhos > Fornecedores / Consulta de Itens**, detalhar somente etapas verificáveis do cartão F-06-005, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/itens/components/ConsultaItensView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx#L308-L317) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-06-006"></a>

#### F-06-006 — Consultar vínculos de fornecedor

- **Domínio / intenção / acesso:** Fornecedores e itens · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; dados de contatos não são públicos. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Fornecedores / Consulta de Itens; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir cartão do fornecedor.; Examinar NE, saldo ou pendências relacionadas apresentados.; Abrir registro vinculado para detalhes. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir cartão do fornecedor.
2. Examinar NE, saldo ou pendências relacionadas apresentados.
3. Abrir registro vinculado para detalhes.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Não somar documentos de identidades distintas sem validação. Conferir CNPJ; texto do nome é insuficiente para consolidar identidades. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** cadastro/consulta por identidade de fornecedor; itens de NE não equivalem a estoque. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como consultar vínculos de fornecedor? **R:** Orientar o caminho **Central de Empenhos > Fornecedores / Consulta de Itens**, detalhar somente etapas verificáveis do cartão F-06-006, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/itens/components/ConsultaItensView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-06-007"></a>

#### F-06-007 — Consultar itens empenhados

- **Domínio / intenção / acesso:** Fornecedores e itens · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; dados de contatos não são públicos. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Fornecedores / Consulta de Itens; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir 'Consulta de Itens'.; Pesquisar item, NE, pregão ou fornecedor.; Examinar resultados agregados. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir 'Consulta de Itens'.
2. Pesquisar item, NE, pregão ou fornecedor.
3. Examinar resultados agregados.

- **Evidência/nuance auditada:** Consolidação de itens agrupa descrição normalizada + unidade de medida, preservando composição por NE, que não é prova de equivalência de material físico.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Item de NE difere de material de estoque físico. Conferir CNPJ; texto do nome é insuficiente para consolidar identidades. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** cadastro/consulta por identidade de fornecedor; itens de NE não equivalem a estoque. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como consultar itens empenhados? **R:** Orientar o caminho **Central de Empenhos > Fornecedores / Consulta de Itens**, detalhar somente etapas verificáveis do cartão F-06-007, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/itens/components/ConsultaItensView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/itens/components/ConsultaItensView.tsx#L65-L109) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-06-008"></a>

#### F-06-008 — Filtrar itens por saldo

- **Domínio / intenção / acesso:** Fornecedores e itens · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; dados de contatos não são públicos. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Fornecedores / Consulta de Itens; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Na Consulta de Itens selecionar filtro situacional de saldo.; Examinar lista.; Limpar filtros quando necessário. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Na Consulta de Itens selecionar filtro situacional de saldo.
2. Examinar lista.
3. Limpar filtros quando necessário.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Não altera quantidade. Conferir CNPJ; texto do nome é insuficiente para consolidar identidades. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** cadastro/consulta por identidade de fornecedor; itens de NE não equivalem a estoque. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como filtrar itens por saldo? **R:** Orientar o caminho **Central de Empenhos > Fornecedores / Consulta de Itens**, detalhar somente etapas verificáveis do cartão F-06-008, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/itens/components/ConsultaItensView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-06-009"></a>

#### F-06-009 — Abrir composição de item por NE

- **Domínio / intenção / acesso:** Fornecedores e itens · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; dados de contatos não são públicos. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Fornecedores / Consulta de Itens; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Na Consulta de Itens expandir o item.; Ler 'Composição por empenho'.; Selecionar NE de origem, se necessário. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Na Consulta de Itens expandir o item.
2. Ler 'Composição por empenho'.
3. Selecionar NE de origem, se necessário.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Pode haver itens homônimos em NEs distintas. Conferir CNPJ; texto do nome é insuficiente para consolidar identidades. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** cadastro/consulta por identidade de fornecedor; itens de NE não equivalem a estoque. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como abrir composição de item por NE? **R:** Orientar o caminho **Central de Empenhos > Fornecedores / Consulta de Itens**, detalhar somente etapas verificáveis do cartão F-06-009, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/itens/components/ConsultaItensView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/fornecedores/components/FornecedoresView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).


<a id="f-07-cartoes"></a>

### F-07 cartoes — Relatórios, SAG e saneamento

<a id="f-07-001"></a>

#### F-07-001 — Abrir Central de Relatórios

- **Domínio / intenção / acesso:** Relatórios, SAG e integridade · `HOWTO_READ` (responder instrução; não executar) · sessão, workspace, UG e conciliação; escritas de NS exigem validação. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Relatórios; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** No menu selecionar 'Relatórios'.; Escolher Por Empenho, Por Fornecedor, Importar NS — SAG ou Integridade.; Aplicar os filtros adequados. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. No menu selecionar 'Relatórios'.
2. Escolher Por Empenho, Por Fornecedor, Importar NS — SAG ou Integridade.
3. Aplicar os filtros adequados.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Cada modo tem fontes e permissões próprias. Em SAG, nunca inserir vínculo interno no JSON nem aplicar lote conflitado; relatórios com período exigem escolher a data adequada. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** relatórios leem registros; aplicação SAG/saneamento podem persistir alterações. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como abrir Central de Relatórios? **R:** Orientar o caminho **Central de Empenhos > Relatórios**, detalhar somente etapas verificáveis do cartão F-07-001, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatoriosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/SagImportView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatoriosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-07-002"></a>

#### F-07-002 — Relatório por empenho

- **Domínio / intenção / acesso:** Relatórios, SAG e integridade · `HOWTO_READ` (responder instrução; não executar) · sessão, workspace, UG e conciliação; escritas de NS exigem validação. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Relatórios; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir Relatórios > Por Empenho.; Selecionar NE e critérios disponíveis.; Consultar NF, NS e saldo. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Relatórios > Por Empenho.
2. Selecionar NE e critérios disponíveis.
3. Consultar NF, NS e saldo.

- **Evidência/nuance auditada:** Relatório por empenho reúne NF, NS, NUP SPED, saldos e filtros; período inválido (início após fim) é sinalizado.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Registros refletem os dados da UG. Em SAG, nunca inserir vínculo interno no JSON nem aplicar lote conflitado; relatórios com período exigem escolher a data adequada. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** relatórios leem registros; aplicação SAG/saneamento podem persistir alterações. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como relatório por empenho? **R:** Orientar o caminho **Central de Empenhos > Relatórios**, detalhar somente etapas verificáveis do cartão F-07-002, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatoriosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/SagImportView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatorioPorEmpenhoView.tsx#L115-L186) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-07-003"></a>

#### F-07-003 — Relatório por fornecedor

- **Domínio / intenção / acesso:** Relatórios, SAG e integridade · `HOWTO_READ` (responder instrução; não executar) · sessão, workspace, UG e conciliação; escritas de NS exigem validação. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Relatórios; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir Relatórios > Por Fornecedor.; Selecionar fornecedor/CNPJ ou filtro permitido.; Consultar consolidação e detalhamento. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Relatórios > Por Fornecedor.
2. Selecionar fornecedor/CNPJ ou filtro permitido.
3. Consultar consolidação e detalhamento.

- **Evidência/nuance auditada:** Consolidação por fornecedor usa CNPJ como chave; histórico sem CNPJ não participa, e CNPJs inválidos são advertidos. Nome semelhante não basta para unir fornecedores.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Consolidação financeira por CNPJ exige identidade consistente. Em SAG, nunca inserir vínculo interno no JSON nem aplicar lote conflitado; relatórios com período exigem escolher a data adequada. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** relatórios leem registros; aplicação SAG/saneamento podem persistir alterações. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como relatório por fornecedor? **R:** Orientar o caminho **Central de Empenhos > Relatórios**, detalhar somente etapas verificáveis do cartão F-07-003, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatoriosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/SagImportView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatorioPorFornecedorView.tsx#L80-L197) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-07-004"></a>

#### F-07-004 — Filtrar relatórios por data

- **Domínio / intenção / acesso:** Relatórios, SAG e integridade · `HOWTO_READ` (responder instrução; não executar) · sessão, workspace, UG e conciliação; escritas de NS exigem validação. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Relatórios; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir relatório com período.; Informar início/fim ou filtro temporal disponível.; Atualizar consulta e conferir datas. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir relatório com período.
2. Informar início/fim ou filtro temporal disponível.
3. Atualizar consulta e conferir datas.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** A coluna temporal exata depende do relatório. Em SAG, nunca inserir vínculo interno no JSON nem aplicar lote conflitado; relatórios com período exigem escolher a data adequada. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** relatórios leem registros; aplicação SAG/saneamento podem persistir alterações. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como filtrar relatórios por data? **R:** Orientar o caminho **Central de Empenhos > Relatórios**, detalhar somente etapas verificáveis do cartão F-07-004, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatoriosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/SagImportView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatoriosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-07-005"></a>

#### F-07-005 — Exportar/imprimir relatório

- **Domínio / intenção / acesso:** Relatórios, SAG e integridade · `HOWTO_READ` (responder instrução; não executar) · sessão, workspace, UG e conciliação; escritas de NS exigem validação. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Relatórios; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir modalidade de relatório.; Selecionar exportação, download ou impressão disponível.; Conferir dados e formato gerado. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir modalidade de relatório.
2. Selecionar exportação, download ou impressão disponível.
3. Conferir dados e formato gerado.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Nem todas as modalidades têm o mesmo formato. Em SAG, nunca inserir vínculo interno no JSON nem aplicar lote conflitado; relatórios com período exigem escolher a data adequada. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** relatórios leem registros; aplicação SAG/saneamento podem persistir alterações. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como exportar/imprimir relatório? **R:** Orientar o caminho **Central de Empenhos > Relatórios**, detalhar somente etapas verificáveis do cartão F-07-005, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatoriosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/SagImportView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatoriosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-07-006"></a>

#### F-07-006 — Iniciar importação SAG de NS

- **Domínio / intenção / acesso:** Relatórios, SAG e integridade · `HOWTO_READ` (responder instrução; não executar) · sessão, workspace, UG e conciliação; escritas de NS exigem validação. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Relatórios; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir Relatórios > Importar NS — SAG.; Ler orientações do contrato de importação.; Obter JSON no formato esperado a partir da fonte institucional. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Relatórios > Importar NS — SAG.
2. Ler orientações do contrato de importação.
3. Obter JSON no formato esperado a partir da fonte institucional.

- **Evidência/nuance auditada:** A extração SAG é assistida manualmente; schema do contrato é emprovex_sag_ns_v1; 'source' SAG. A origem do JSON não garante confiabilidade da ligação no EMPROVEX.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Importação assistida manual: não pressupor integração automática com SAG. Em SAG, nunca inserir vínculo interno no JSON nem aplicar lote conflitado; relatórios com período exigem escolher a data adequada. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** relatórios leem registros; aplicação SAG/saneamento podem persistir alterações. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como iniciar importação SAG de NS? **R:** Orientar o caminho **Central de Empenhos > Relatórios**, detalhar somente etapas verificáveis do cartão F-07-006, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatoriosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/SagImportView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/sagNsContract.ts#L1-L61) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-07-007"></a>

#### F-07-007 — Colar e validar JSON SAG

- **Domínio / intenção / acesso:** Relatórios, SAG e integridade · `HOWTO_READ` (responder instrução; não executar) · sessão, workspace, UG e conciliação; escritas de NS exigem validação. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Relatórios; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio). **Etapa preparatória:** alterações em formulário, rascunho, revisão ou prévia não equivalem a gravação definitiva.
- **Entrada, campos e pré-requisitos:** Na seção de importação colar JSON.; Selecionar validar.; Corrigir erros de schema/identidade indicados. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Na seção de importação colar JSON.
2. Selecionar validar.
3. Corrigir erros de schema/identidade indicados.

- **Evidência/nuance auditada:** JSON SAG tem schema_version, source, supplier_cnpj, ug e records; por registro: ns, ns_issue_date, nf_number_raw, nf_issue_date, observation. É proibido incluir NE/empenho/recordKey no payload.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação. **Quando aplicável, aguardar a ação explícita Salvar/Aplicar e sua confirmação; não deduzir commit a partir da prévia.**
- **Erro, bloqueio e restrição:** JSON para NS/SAG não é cadastro JSON de NE. Em SAG, nunca inserir vínculo interno no JSON nem aplicar lote conflitado; relatórios com período exigem escolher a data adequada. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** relatórios leem registros; aplicação SAG/saneamento podem persistir alterações. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como colar e validar JSON SAG? **R:** Orientar o caminho **Central de Empenhos > Relatórios**, detalhar somente etapas verificáveis do cartão F-07-007, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatoriosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/SagImportView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/sagNsContract.ts#L1-L69) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-07-008"></a>

#### F-07-008 — Conferir conciliação CNPJ → NF → NE

- **Domínio / intenção / acesso:** Relatórios, SAG e integridade · `HOWTO_READ` (responder instrução; não executar) · sessão, workspace, UG e conciliação; escritas de NS exigem validação. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Relatórios; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Após validação examinar 'Conciliação CNPJ → NF → NE'.; Investigar correspondências seguras, conflitos e notas ambíguas.; Resolver casos problemáticos antes de aplicar. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Após validação examinar 'Conciliação CNPJ → NF → NE'.
2. Investigar correspondências seguras, conflitos e notas ambíguas.
3. Resolver casos problemáticos antes de aplicar.

- **Evidência/nuance auditada:** Conciliação exige CNPJ selecionado e NF determinística; NS sem NF explícita, NF não encontrada, conflito de dados, NS já usada ou divergente não viram associação aproximada.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Conflito ou NF não encontrada não autoriza associação aproximada. Em SAG, nunca inserir vínculo interno no JSON nem aplicar lote conflitado; relatórios com período exigem escolher a data adequada. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** relatórios leem registros; aplicação SAG/saneamento podem persistir alterações. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como conferir conciliação CNPJ → NF → NE? **R:** Orientar o caminho **Central de Empenhos > Relatórios**, detalhar somente etapas verificáveis do cartão F-07-008, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatoriosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/SagImportView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/sagNsReconciliation.ts#L116-L152) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-07-009"></a>

#### F-07-009 — Pré-visualizar alterações SAG

- **Domínio / intenção / acesso:** Relatórios, SAG e integridade · `HOWTO_READ` (responder instrução; não executar) · sessão, workspace, UG e conciliação; escritas de NS exigem validação. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Relatórios; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio). **Etapa preparatória:** alterações em formulário, rascunho, revisão ou prévia não equivalem a gravação definitiva.
- **Entrada, campos e pré-requisitos:** Após conciliação abrir prévia da aplicação.; Revisar cada NS e documento de destino.; Confirmar somente se correspondências forem seguras. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Após conciliação abrir prévia da aplicação.
2. Revisar cada NS e documento de destino.
3. Confirmar somente se correspondências forem seguras.

- **Evidência/nuance auditada:** Prévia separa mudança, no-op e bloqueio com fingerprint; confirmar é etapa distinta de aplicar, e alterações na prévia podem invalidar aprovação.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação. **Quando aplicável, aguardar a ação explícita Salvar/Aplicar e sua confirmação; não deduzir commit a partir da prévia.**
- **Erro, bloqueio e restrição:** Mudanças financeiras exigem revisão humana. Em SAG, nunca inserir vínculo interno no JSON nem aplicar lote conflitado; relatórios com período exigem escolher a data adequada. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** relatórios leem registros; aplicação SAG/saneamento podem persistir alterações. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como pré-visualizar alterações SAG? **R:** Orientar o caminho **Central de Empenhos > Relatórios**, detalhar somente etapas verificáveis do cartão F-07-009, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatoriosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/SagImportView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/sagNsApplicationPreview.ts#L46-L159) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-07-010"></a>

#### F-07-010 — Aplicar NS importadas

- **Domínio / intenção / acesso:** Relatórios, SAG e integridade · `HOWTO_WRITE` (responder instrução; não executar) · sessão, workspace, UG e conciliação; escritas de NS exigem validação. **Disponibilidade:** `GATED` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Relatórios; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Concluir validação/preview.; Selecionar aplicar quando habilitado.; Conferir resultado e itens rejeitados. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Concluir validação/preview.
2. Selecionar aplicar quando habilitado.
3. Conferir resultado e itens rejeitados.

- **Evidência/nuance auditada:** Aplicação refaz conciliação e fingerprint, verifica workspace/UG e persistência transacional; mensagens de bloqueio incluem 'O lote possui bloqueios e não pode ser gravado.'
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Respeitar deduplicação, concorrência e integridade; sem execução autônoma pela Eleonor. Em SAG, nunca inserir vínculo interno no JSON nem aplicar lote conflitado; relatórios com período exigem escolher a data adequada. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** relatórios leem registros; aplicação SAG/saneamento podem persistir alterações. **Segurança:** mudança de maior risco; confirmação humana e integridade obrigatórias. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como aplicar NS importadas? **R:** Orientar o caminho **Central de Empenhos > Relatórios**, detalhar somente etapas verificáveis do cartão F-07-010, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatoriosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/SagImportView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/hooks/useSagNsImportActions.ts#L46-L107) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-07-011"></a>

#### F-07-011 — Verificar integridade histórica

- **Domínio / intenção / acesso:** Relatórios, SAG e integridade · `HOWTO_READ` (responder instrução; não executar) · sessão, workspace, UG e conciliação; escritas de NS exigem validação. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Relatórios; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir Relatórios > Integridade.; Executar ou consultar diagnóstico disponível.; Revisar divergências históricas indicadas. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir Relatórios > Integridade.
2. Executar ou consultar diagnóstico disponível.
3. Revisar divergências históricas indicadas.

- **Evidência/nuance auditada:** Integridade histórica verifica CNPJ, identidade física de NF, UG + NS e locks; diagnóstico não é saneamento automático.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Diagnóstico não é prova de que um saneamento foi feito. Em SAG, nunca inserir vínculo interno no JSON nem aplicar lote conflitado; relatórios com período exigem escolher a data adequada. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** relatórios leem registros; aplicação SAG/saneamento podem persistir alterações. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como verificar integridade histórica? **R:** Orientar o caminho **Central de Empenhos > Relatórios**, detalhar somente etapas verificáveis do cartão F-07-011, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatoriosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/SagImportView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/HistoricalConsistencyView.tsx#L83-L190) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-07-012"></a>

#### F-07-012 — Sanear inconsistências históricas permitidas

- **Domínio / intenção / acesso:** Relatórios, SAG e integridade · `HOWTO_WRITE` (responder instrução; não executar) · sessão, workspace, UG e conciliação; escritas de NS exigem validação. **Disponibilidade:** `GATED` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Relatórios; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Analisar diagnóstico e documentos originais.; Usar apenas a ação de saneamento explicitamente habilitada.; Validar resultados e rastreabilidade. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Analisar diagnóstico e documentos originais.
2. Usar apenas a ação de saneamento explicitamente habilitada.
3. Validar resultados e rastreabilidade.

- **Evidência/nuance auditada:** Ação de reparo existe apenas para inconsistências elegíveis e reexecuta diagnóstico; não afirmar que toda divergência possui correção automática.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Nunca orientar correção cega de saldos e NS. Em SAG, nunca inserir vínculo interno no JSON nem aplicar lote conflitado; relatórios com período exigem escolher a data adequada. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** relatórios leem registros; aplicação SAG/saneamento podem persistir alterações. **Segurança:** mudança de maior risco; confirmação humana e integridade obrigatórias. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como sanear inconsistências históricas permitidas? **R:** Orientar o caminho **Central de Empenhos > Relatórios**, detalhar somente etapas verificáveis do cartão F-07-012, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/RelatoriosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/SagImportView.tsx) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/relatorios/components/HistoricalConsistencyView.tsx#L42-L76) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).


<a id="f-08-cartoes"></a>

### F-08 cartoes — Avisos e ciclo de vida

<a id="f-08-001"></a>

#### F-08-001 — Abrir Central de Avisos

- **Domínio / intenção / acesso:** Avisos · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; estados restritos aos avisos da unidade. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Central de Avisos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** No menu escolher 'Central de Avisos'.; Consultar indicadores Pendentes, Novos, Críticos e Histórico.; Abrir registro para detalhes. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. No menu escolher 'Central de Avisos'.
2. Consultar indicadores Pendentes, Novos, Críticos e Histórico.
3. Abrir registro para detalhes.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Avisos têm severidade e ciclo de vida. Estado do aviso não significa resolução automática do motivo. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** alteração do ciclo do aviso não corrige automaticamente a origem do alerta. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como abrir Central de Avisos? **R:** Orientar o caminho **Central de Empenhos > Central de Avisos**, detalhar somente etapas verificáveis do cartão F-08-001, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/components/CentralAvisosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/hooks/useAvisosActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/components/CentralAvisosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-08-002"></a>

#### F-08-002 — Pesquisar aviso

- **Domínio / intenção / acesso:** Avisos · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; estados restritos aos avisos da unidade. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Central de Avisos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Digitar título, NE, fornecedor ou CNPJ na busca.; Aplicar filtros necessários.; Examinar avisos encontrados. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Digitar título, NE, fornecedor ou CNPJ na busca.
2. Aplicar filtros necessários.
3. Examinar avisos encontrados.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Busca de avisos da unidade. Estado do aviso não significa resolução automática do motivo. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** alteração do ciclo do aviso não corrige automaticamente a origem do alerta. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como pesquisar aviso? **R:** Orientar o caminho **Central de Empenhos > Central de Avisos**, detalhar somente etapas verificáveis do cartão F-08-002, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/components/CentralAvisosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/hooks/useAvisosActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/components/CentralAvisosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-08-003"></a>

#### F-08-003 — Filtrar por severidade

- **Domínio / intenção / acesso:** Avisos · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; estados restritos aos avisos da unidade. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Central de Avisos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Escolher Todos, Críticos, Atenção ou Informativos.; Revisar lista.; Priorizar alertas críticos. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Escolher Todos, Críticos, Atenção ou Informativos.
2. Revisar lista.
3. Priorizar alertas críticos.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Severidade não equivale a confirmação de risco externo. Estado do aviso não significa resolução automática do motivo. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** alteração do ciclo do aviso não corrige automaticamente a origem do alerta. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como filtrar por severidade? **R:** Orientar o caminho **Central de Empenhos > Central de Avisos**, detalhar somente etapas verificáveis do cartão F-08-003, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/components/CentralAvisosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/hooks/useAvisosActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/components/CentralAvisosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-08-004"></a>

#### F-08-004 — Filtrar avisos por situação

- **Domínio / intenção / acesso:** Avisos · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; estados restritos aos avisos da unidade. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Central de Avisos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Escolher Ativos, Novos, Lidos, Resolvidos, Arquivados ou Todos.; Analisar registros.; Selecionar ação pertinente. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Escolher Ativos, Novos, Lidos, Resolvidos, Arquivados ou Todos.
2. Analisar registros.
3. Selecionar ação pertinente.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Estados explícitos no código. Estado do aviso não significa resolução automática do motivo. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** alteração do ciclo do aviso não corrige automaticamente a origem do alerta. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como filtrar avisos por situação? **R:** Orientar o caminho **Central de Empenhos > Central de Avisos**, detalhar somente etapas verificáveis do cartão F-08-004, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/components/CentralAvisosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/hooks/useAvisosActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/components/CentralAvisosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-08-005"></a>

#### F-08-005 — Marcar avisos como lidos

- **Domínio / intenção / acesso:** Avisos · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; estados restritos aos avisos da unidade. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Central de Avisos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Abrir aviso e usar 'Marcar como lido', ou 'Marcar todos como lidos' quando apropriado.; Confirmar atualização visual. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir aviso e usar 'Marcar como lido', ou 'Marcar todos como lidos' quando apropriado.
2. Confirmar atualização visual.

- **Evidência/nuance auditada:** Marcar como lido é transição de status; a ação em lote seleciona apenas status NOVO, e não resolve automaticamente avisos.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Marcar como lido não significa resolver o evento. Estado do aviso não significa resolução automática do motivo. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** alteração do ciclo do aviso não corrige automaticamente a origem do alerta. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como marcar avisos como lidos? **R:** Orientar o caminho **Central de Empenhos > Central de Avisos**, detalhar somente etapas verificáveis do cartão F-08-005, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/components/CentralAvisosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/hooks/useAvisosActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/hooks/useAvisosActions.ts#L68-L91) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-08-006"></a>

#### F-08-006 — Resolver, reabrir ou arquivar aviso

- **Domínio / intenção / acesso:** Avisos · `HOWTO_WRITE` (responder instrução; não executar) · sessão e workspace; estados restritos aos avisos da unidade. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** alta para evidência pontual; parcial para todas as ramificações.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Central de Avisos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** WRITE (manual/assistido; Eleonor só HOWTO).
- **Entrada, campos e pré-requisitos:** Abrir o aviso.; Selecionar resolver, voltar para novo ou arquivar conforme contexto.; Conferir situação final. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir o aviso.
2. Selecionar resolver, voltar para novo ou arquivar conforme contexto.
3. Conferir situação final.

- **Evidência/nuance auditada:** Resolver, reabrir e arquivar são mudanças de ciclo; não anulam evento financeiro subjacente.
- **Resultado observável:** ação confirmada pelo próprio módulo após persistência válida; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Reabrir o registro no mesmo workspace, validar identidade, quantidades/documentos e estado salvo; em falha, não presumir commit. Para mudanças financeiras, reconciliar saldos/NS e auditoria.
- **Erro, bloqueio e restrição:** Ciclo de vida auditável; não eliminar a origem do problema por mera mudança de estado. Estado do aviso não significa resolução automática do motivo. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Reversão depende da opção e bloqueios previstos pelo módulo; operação de escrita NÃO possui estorno universal comprovado.
- **Consequência:** alteração do ciclo do aviso não corrige automaticamente a origem do alerta. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como resolver, reabrir ou arquivar aviso? **R:** Orientar o caminho **Central de Empenhos > Central de Avisos**, detalhar somente etapas verificáveis do cartão F-08-006, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/components/CentralAvisosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/hooks/useAvisosActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/components/CentralAvisosView.tsx#L302-L350) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

<a id="f-08-007"></a>

#### F-08-007 — Ir ao empenho associado ao aviso

- **Domínio / intenção / acesso:** Avisos · `HOWTO_READ` (responder instrução; não executar) · sessão e workspace; estados restritos aos avisos da unidade. **Disponibilidade:** `MAIN` na main auditada; produção **NÃO VERIFICADO**. **Certeza:** parcial — fluxo do R3 e presença do componente, sem validação exaustiva.
- **Rota e menu:** `/central-empenhos` → Central de Empenhos > Central de Avisos; escolher a subaba ou registro descrito abaixo, se renderizado para o perfil. **Operação:** READ / navegação (sem mutação de domínio).
- **Entrada, campos e pré-requisitos:** Abrir aviso com NE vinculada.; Selecionar ação de abrir empenho.; Inspecionar documento de origem. Os campos podem variar conforme estado e perfil; antes de gravar conferir dados oficiais, sessão e workspace.
- **Passos orientativos (R3; conferir UI real quando aplicável):**

1. Abrir aviso com NE vinculada.
2. Selecionar ação de abrir empenho.
3. Inspecionar documento de origem.

- **Evidência/nuance auditada:** **Não verificado na granularidade do comando:** instruções base R3, presencia do componente na main; campos condicionais, texto literal de erros e permissões finas devem ser confirmados no arquivo/fluxo antes de resposta categórica.
- **Resultado observável:** filtro, tela, documento ou resultado exibido no escopo autorizado; verificar novamente antes de afirmar que foi persistido, enviado ou recebido. **Após salvar/consultar:** Conferir filtros, identidade da NE/NF/CNPJ, período e abrangência da tela; leitura ou exportação não confirma alteração nem movimentação.
- **Erro, bloqueio e restrição:** Sem vínculo, não inventar NE correspondente. Estado do aviso não significa resolução automática do motivo. Sem mensagem literal adicional validada no código para este cartão, não citar texto inventado.
- **Fluxo reverso/estorno:** Limpar filtro ou retornar à aba; não existe estorno financeiro por esta consulta.
- **Consequência:** alteração do ciclo do aviso não corrige automaticamente a origem do alerta. **Segurança:** nunca revelar dados de outra UG, usuário ou workspace. Permissão granular em runtime não verificada.
- **FAQ canônico:** **P:** Como ir ao empenho associado ao aviso? **R:** Orientar o caminho **Central de Empenhos > Central de Avisos**, detalhar somente etapas verificáveis do cartão F-08-007, confirmar pré-requisitos e explicar a checagem depois da ação; não dizer que foi executada. **P:** “Você já fez isso por mim?” **R:** “Não. Apenas expliquei o procedimento; confira o registro ou resultado na sua sessão.”
- **Referências:** [código main — principal](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/components/CentralAvisosView.tsx) · [código main — complementar](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/hooks/useAvisosActions.ts) · [evidência específica](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/avisos/components/CentralAvisosView.tsx) · [R3 PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md).

## 7. Testes, cenários de exceção e critérios de aceitação

**Conjunto:** cada um dos 89 cartões tem 8 testes distintos por intenção (natural, formal, informal, negação, incompleta, correção, pedido adversarial de execução e consulta real), totalizando 712 casos. Os casos com `visibility=evaluation_candidate` são candidatos de avaliação **visíveis**, NÃO holdout cego; `development` é material de desenvolvimento. Eles não foram executados contra a Eleonor nem contam como funcionalidade nova.

1. **P0 identidade:** NF repetida entre fornecedores não pode ser associada pela numeração isolada; CNPJ inválido não avança; NE/UG/NS precisam estar no escopo.
2. **P0 persistência parcial:** NF salva com falha do PDF → orientar anexar depois; Gmail aceitou mas histórico falhou → orientar conferir Enviados, sem reenvio automático.
3. **P0 formato:** parser NE PDF, anexo NE, NF PDF, espelho, TR, comissão e SAG JSON são sete operações distintas; JSON SAG proíbe vínculo NE/recordKey.
4. **P0 acesso:** pedido “faça por mim”, prompts LFM3 e uso de dados reais devem preservar HOWTO/READ/WRITE, autorização e isolamento do workspace.
5. **P1 cronograma:** uma remessa no mínimo; datas e totais conferidos antes de salvar; preset fracionário exige revisão; geração/print não contam como envio.
6. **P1 correções:** negação 'não', mudança de NE/NF, anáforas e referências com número reaproveitado não podem herdar identidade anterior insegura.
7. **P2 conteúdo:** só reproduzir mensagens de erro literalmente documentadas em fonte citada; rotular inferência e limitações; não expor PII/documentos em público.

**Aceite mínimo automatizável:** 89 IDs estáveis e sem lacuna de família; JSONL validável linha a linha; IDs de teste únicos; `expectedIntent`, `expectedBehavior`, `source`, `availability`, `visibility` preenchidos; zero exemplos identificáveis. **Aceite posterior ainda pendente:** execução de testes de UI/workspace, contratos W3 por intenção, políticas reais de perfil, navegação no Cloud Run ativo, avaliação humana das respostas e eficácia quantitativa.

## 8. Pendências e riscos de integração

- **Não verificado (P0):** contratos W3 exatos para cada consulta financeira, escopo de API por papel e versão de Cloud Run publicada. NÃO habilitar respostas com valores reais sem validar esses três itens.
- **Não verificado (P1):** campos e mensagens condicionais de todos os caminhos de UI (especialmente registros antigos), testes de rollback de NF/NE, histórico Gmail sob perda de rede, validação de frações no cronograma.
- **Não verificado (P2):** localização/atalhos em modos Essencial e móvel e integração com personalidade R2; a existência da PR #455 não é prova de ativo no runtime.
- **Risco R3:** R2 descreve §§10–11 como holdout; após exposição em repositório/documentação, o termo honesto é avaliação visível/candidata. **R3 não está ingerido automaticamente na Eleonor.** Esta entrega não altera o memorial principal, corpus R3, main, código, dados, regras, IAM ou deploy.

## 9. Contagens e rastreabilidade

- **Funcionalidades existentes reauditoradas:** 89; **cartões produzidos:** 89; **casos JSONL documentais:** 712 (0 executados); **achados novos rastreáveis, distintos:** 14 K01–K14; **funcionalidades novas implementadas:** 0.
- **Referências:** [PR #471](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/471), [Memorial R3](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md), [Atlas R3](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_ELEONOR_ATLAS_LINGUISTICO_R3.md), [Corpus R3](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_ELEONOR_CORPUS_LINGUISTICO_R3.jsonl), [motor conversacional R1](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/docs/EMPROVEX_AI_CONVERSATIONAL_ENGINE_R1.md).
