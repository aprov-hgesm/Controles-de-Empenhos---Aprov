# EMPROVEX AI — ATLAS LINGUÍSTICO PT-BR R3 — Anexo ao Memorial Oficial de Funcionalidades

**Status:** proposta documental e corpus de avaliação, NÃO integrada ao runtime. **Data:** 02/11/2026. **Origem:** auditoria de código da `main` e memorial R2 na PR #471.

## 1. Diagnóstico: o que falta para transformar 242 tutoriais em conhecimento conversacional

- **P0 — Leitura natural:** a camada `language.ts` reconhece alguns termos de NE/NF/estoque e poucos erros conhecidos; não tem tabela sistemática de `vc`, `kd`, `qnd`, `pq`, `tbm`, `hj`, `pfv`, `n`, `dnv` etc. O `parsePeriod` cobre `hoje`, `ontem`, `anteontem` e intervalos escritos por extenso, mas não uma gramática completa de internetês. Estas são oportunidades de **cobertura lexical**, não falhas comprovadas em produção.
- **P0 — Intenção e segurança:** `engine.ts` contém guarda contra mutações e identifica alguns pedidos de procedimentos, mas formas como `me ensina a ...`, `onde boto ...` e `pode explicar como...` precisam de contraste semântico com `faça por mim`. Em nenhum caso as palavras de cortesia autorizam escrita.
- **P0 — Ambiguidade de domínio:** `saldo`, `pendente`, `nota`, `baixa`, `recebido`, `pedido` e `enviado` são termos polissemânticos. A expansão lexical deve conservar restrições e não transferir automaticamente significados entre Empenhos, NFs, SISCOFIS e Depósitos.
- **P0 — Código protegido:** o parser preserva extrações de NE/CNPJ baseadas em texto original; qualquer normalizador posterior deve manter essa invariável, assim como barcodes, números, datas, valores, negativos e contextos de workspace.
- **P1 — Memória curta:** W4 aceita até quatro referências tipadas com duração nominal de 10 minutos, vinculadas a sessão e workspace. O corpus deve validar anáforas, correções e mudança de assunto, inclusive a ausência de referências fora da sessão.
- **P1 — Resposta de ajuda:** `conversation/knowledge.ts` é propositalmente um catálogo **institucional público restrito**, não uma base completa dos 242 procedimentos. Antes de um recurso RAG ou lookup aprovado, as respostas 'como fazer' podem continuar limitadas. A base R2/R3 não se torna automaticamente visível à Eleonor.
- **P1 — Confiança e filtros:** a pontuação de confiança do W4 é heurística não calibrada; uma frase fluente do LFM3 não substitui validação de intenção, parâmetros, filtros essenciais e autorização no W3.
- **P2 — Telemetria de melhoria:** o monitoramento futuro deve registrar apenas categorias de erro, identificadores e exemplos sintéticos/anonimizados, sem conversas privadas brutas, tokens, credenciais ou CNPJ identificável.

## 2. Princípios de normalização segura

1. **Preservar o original:** manter mensagem original separada de representação lexical normalizada; jamais usar normalização para modificar parâmetros de escrita/consulta sem validação.
2. **Aplicar por contexto:** a expansão é uma interpretação candidata de palavras isoladas; não é uma tabela de substituição cega. Uma sigla técnica tem prioridade quando documentada e sintaticamente ancorada, nunca só por caixa alta/minúscula.
3. **Conservar os operadores semânticos:** `não`, `sem`, `só`, `exceto`, `antes`, `depois`, `mais de`, `menos de`, `pago`, `pendente`, `emitido`, `cadastrado` e `recebido` podem alterar a resposta. Sua omissão torna a consulta não equivalente.
4. **Separar HOWTO, READ e WRITE:** orientar uma funcionalidade não equivale a executá-la; um comando imperativo não herda privilégios da forma educada. Consultas de dados passam por W3; tutoriais requerem fonte funcional aprovada.
5. **Proteger tokens atômicos:** não reescrever trechos identificados como NE, NF-e, CNPJ, NS, UG, código de barras, URI, e-mail, caminho, token, data, dinheiro, medida ou ID. Nunca eliminar zeros à esquerda.
6. **Não inventar equivalências:** Mapa de Existência SISCOFIS não é Pedido de Material; PDF não é baixa; checkout não é pagamento; NF cadastrada não é item fisicamente alocado.
7. **Perguntar uma vez, na ambiguidade material:** quando duas interpretações plausíveis levem a operações ou dados distintos, pedir o dado essencial, sem abrir questionário extenso.
8. **Responder com naturalidade profissional:** não corrigir o português do usuário espontaneamente, não imitar palavrões/gírias na resposta e não especular sobre idade, região ou educação do usuário.

## 3. Léxico de variantes — exemplos e restrições

### 3.1. Atalhos de interlocução e pronomes

**Regra:** Expansão lexical de baixo risco apenas fora de identificadores e domínios técnicos.

| Grafias e variações ilustrativas | Leitura candidata | Limites de interpretação | Exemplo sintético |
|---|---|---|---|
| vc / vcs / cê / ce | você / vocês | reconhecer interlocução; 'ce' pode significar código/UF CE | vc consegue ver minha nf? |
| tu / ctu / cntg / ctg / cmg | tu / com tu / contigo / comigo | não presumir origem/região nem tratar pronome como entidade | tu consegue ver o saldo? |
| eu / nois / nós / a gente / agente | eu / nós / a gente | 'agente' pode ser cargo ou erro de 'a gente'; depende da frase | agente vai ver o estoque? |
| kd / cade / cadê / cad | cadê / onde está | 'cad' também pode ser CAD/sistema e deve exigir contexto | kd as nf? |
| oq / o q / oque / q | o que / que | 'q' pode indicar quantidade em fórmulas; preservar parâmetros | oq é ns? |
| pq / porq / pq? / pk | por que / porque | pergunta e explicação não são intercambiáveis automaticamente | pq a nf sumiu? |
| ql / ql é / qual | qual | 'QL' pode ser sigla em identificadores; não alterar símbolos | ql ne ainda tem saldo? |
| qm / quem / qm foi | quem | não pressupor permissão para dados pessoais | qm fez essa saida? |
| qnd / qdo / qndo / kd foi | quando | não converter data sem contexto | qnd enviei o cronograma? |
| qto / qnt / qt / qnts / qntos | quanto / quantidade / quantos | cuidado com unidade e valor financeiro | qnt de arroz tem? |
| cm / como / cm faz | como | 'cm' pode significar centímetros se acompanhado de número | cm faço pra cadastrar? |
| pra / pro / p/ / p | para / para o | 'p/' em unidades e rotas não deve ser substituído indiscriminadamente | manda p/ fornecedor |
| c/ / s/ / c / s | com / sem | 'c' e 's' isolados não são seguros; exigir sintaxe e preservar unidade s (segundo) | estoque s/ lote |
| d / dps / dpois / dnv / dnovo | de / depois / de novo | 'd' pode ser código e 'dnv' deve ser entendido como repetição, não autorização | tentei dnv |
| tb / tbm / tbém / tbem | também | não inferir operação adicional não explicitada | quero as ns tbm |
| td / tdo / tds / geral | tudo / todos | 'td' pode significar título/documento em contexto especializado | mostra tds nf |
| alg / alguem / ngm / ngn | alguém / ninguém | negação e quantificador precisam sobreviver | ngm recebeu? |

### 3.2. Cortesia e formulação de pedido

**Regra:** Adaptar a superfície linguística, preservando intenção, autorização e direção do ato.

| Grafias e variações ilustrativas | Leitura candidata | Limites de interpretação | Exemplo sintético |
|---|---|---|---|
| pfv / pf / porfa / pls / please | por favor | polidez não constitui confirmação nem permissão | pfv ajuda com NF |
| obg / obgd / obrigado / obrigada / vlw | agradecimento | não executar ação com base apenas em agradecimento | vlw |
| blz / beleza / suave / ok / fechou / show | entendido / confirmação social | 'fechou' não é confirmação de transação destrutiva | blz, onde clico? |
| pdc / pode crer / saquei / entendi / entd | entendi | evitar acrescentar entidade ou ação | pdc |
| msg / msgm / mensagem / recado | mensagem | não confundir mensagem com envio realizado | manda uma msg pro fornecedor |
| att / atualiza / atualizar / atualização | atualizar | 'att' também é despedida 'atenciosamente'; desambiguar | att o fornecedor |
| add / adc / adicionar / inclui | adicionar | pedido de escrita ≠ orientação sobre como adicionar | add novo item |
| print / screenshot / captura | imagem da tela / captura | não alegar que viu captura ausente | manda print da aba |
| me passa / me manda / envia / compartilha | apresentar ou enviar | pode ser exibir, copiar, baixar ou mandar externamente; esclarecer destino | me manda a nf |
| gentileza informar / solicito / requeiro / favor esclarecer | pedido formal de informação | não confundir formulário oficial com ação automática | solicito a relação de NFs |
| poderia verificar / favor conferir / peço a conferência | consulta / orientação de revisão | consulta só se houver dados autorizados | poderia verificar o saldo? |
| providencie / proceda / efetue / execute | ação administrativa solicitada | não executar apenas porque a expressão é formal | proceda à baixa |
| na moral / por gentileza / se puder / faz favor | pedido com tom variável | tom não muda privilégio | na moral, onde fica o botão? |
| rapidinho / resumidamente / em duas linhas | preferência de concisão | não omitir alerta importante por pedido de brevidade | responde rapidinho |
| sem enrolação / direto / objetivamente | preferência de objetividade | mantém perguntas essenciais e proteções | sem enrolação, explica NS |

### 3.3. Tempo, ordenação e dependências

**Regra:** Datas relativas dependem do relógio confiável e do fuso da consulta; data de emissão, cadastro e envio são distintas.

| Grafias e variações ilustrativas | Leitura candidata | Limites de interpretação | Exemplo sintético |
|---|---|---|---|
| hj / hoje / agr / agora | hoje / agora | 'agr' pode ser 'agradeço' em documento formal | nf cadastradas hj |
| ont / ontem / ontem msm | ontem | não fundir emissão e cadastro | nfs de ont |
| anteont / ante ontem / antes de ontem | anteontem | não inferir fuso do usuário por localidade de servidor | cadastrei anteont |
| amnh / amanha / amanhã / amnha | amanhã | pode ser planejamento, não registro ocorrido | cronograma pra amnh |
| dps / mais tarde / daqui a pouco | depois / no futuro | sem relógio não calcular data exata | vou fazer dps |
| sem passada / semana pass / sem retrasada | semana passada / retrasada | não usar último 7 dias como sinônimo de semana calendário | nfs sem pass |
| mes pass / mês passado / mes atual / esse mes | mês passado / este mês | definir intervalo civil com timezone | nfs mes pass |
| ult 7 dias / ultimos 7d / 7d | últimos 7 dias | '7d' é intervalo móvel, não semana calendário | envios ult 7d |
| fim de semana / fds | fim de semana | 'fds' também é interjeição grosseira; nunca converter sem contexto temporal | envios no fds |
| qnd enviou / data do envio / quando foi enviado | evento de envio | não confundir data programada com data efetiva | qnd enviei? |
| data de emissão / emiti / emitida | emissão de NF | não substituir por data de cadastro | nfs emitidas ontem |
| data do cadastro / lancei / inseri / registrei | cadastro no EMPROVEX | não confundir registro de NS com emissão de NF | notas lancadas hj |
| agora nao / dps eu faço | negação de ação atual | não iniciar operação | agora n quero cadastrar |
| a partir de / até / entre / no período | limites temporais | extremos inclusivos/exclusivos conforme contrato W3 | entre 01/09 e 30/09 |

### 3.4. Gírias, interjeições e sinais conversacionais

**Regra:** Detectar estado/emoção sem ridicularizar; não transformar expressão de frustração em diagnóstico técnico.

| Grafias e variações ilustrativas | Leitura candidata | Limites de interpretação | Exemplo sintético |
|---|---|---|---|
| deu ruim / zicou / azedou / lascou | houve problema | não inferir bug/culpa do sistema | deu ruim no empenho |
| bugou / tá bugado / ta zuado / zoadinho / zoado | aparente comportamento inesperado | perguntar etapa e erro observável | tá bugado o botão de NF |
| travou / congelou / ficou preso / empacou | interface não avançou | não presumir transação falhada ou duplicada | travou na baixa |
| sumiu / desapareceu / evaporou | não consigo localizar | revisar filtros/permissão antes de alegar exclusão | sumiu minha NE |
| não vai / n vai / não funciona / nn funfa | falha percebida | desambiguar qual ação, mensagem e tela | nao vai a saida |
| tá osso / tá puxado / complicado demais | dificuldade / frustração | oferecer passos concretos, sem paternalismo | tá osso achar a NF |
| quebrou / explodiu / fritou | falha aparente, hipérbole | não indicar incidente de infraestrutura sem prova | o painel fritou |
| cadê esse troço / negocio / bgl / bagulho | referência genérica | recuperar apenas contexto seguro; caso contrário perguntar | cadê esse bgl do estoque |
| bora / vamo / partiu / vms | intenção de iniciar conversa | não é autorização de mutação | bora conferir os empenhos |
| mano / cara / véi / vei / meo | vocativo informal | não imitar intimidade excessiva | mano onde ta NS |
| bah / tchê / tri / uai / oxente / eita | interjeição regional | não inferir região nem perfil com base na fala | bah sumiu a nf |
| kk / kkk / rs / rsrs / haha / hehe | riso | não remover negação vizinha nem tratar como ID | kkk errei a NE |
| aff / poxa / mds / puts | frustração ou surpresa | não rotular urgência clínica nem deduzir gravidade | aff de novo NF pendente |
| tá / ta / tô / to / tava / tavae | está / estou / estava | 'TO' pode ser UF ou código; não alterar IDs | ta dando erro |
| tipo assim / sabe / então / aí / tipo | marcador discursivo | reduzir apenas para intenção, preservando relações temporais | tipo assim, a NF dela |
| só / so / somente / apenas / unicamente | restrição | é filtro essencial; nunca descartar | só as pendentes |
| não / nao / ñ / n / nn / num / naum | negação | 'n', 'num' e 'no' exigem contexto; nunca remover negação | n quero excluir |
| mais ou menos / +- / por volta de | quantidade aproximada | não substituir por quantidade exata para baixa/estoque | uns 20 kg |

### 3.5. Verbos operacionais usados no chat

**Regra:** Distinguir pergunta HOWTO, consulta READ e ordem WRITE; a mesma palavra pode ocorrer nos três modos.

| Grafias e variações ilustrativas | Leitura candidata | Limites de interpretação | Exemplo sintético |
|---|---|---|---|
| bota / coloca / põe / joga / insere | cadastrar ou preencher | identificar objeto, campo e se usuário pede execução | onde boto a NF? |
| lança / lança aí / registra / dá entrada | cadastrar ou entrada | NF financeira vs entrada física | como lanço a nota? |
| baixa / dar baixa / tira do estoque / desconta | registrar saída ou abatimento | baixa física ≠ contabilização financeira ≠ exclusão | dá baixa em 5 caixas |
| puxa / traz / consulta / mostra / vê / lista | consultar | 'puxa o saldo' leitura; 'puxa a NF pra planilha' exportação | puxa as nfs |
| junta / agrupa / consolida | consolidar relatório | não mesclar fornecedores por grafia | junta por CNPJ |
| separa / separacao / picking | separação física | no piloto não representa baixa efetiva | separa 10 unidades |
| guarda / aloca / bota na prateleira | alocação física | exige localização rastreada; não confundir recebimento fiscal | onde guardo essas caixas? |
| passa pra outra estante / move / transfere | transferência interna | origem, destino, lote e quantidade | passa do freezer 1 pro 2 |
| zera / limpa / apaga / remove / deleta | ação potencialmente destrutiva | 'limpar filtro' ≠ apagar registro; esclarecer objeto | limpa esse cronograma |
| refaz / desmancha / desfaz / cancela | reversão ou edição | não assegurar undo automático | desfaz essa saida |
| fecha / conclui / finaliza / confirma | conclusão de fluxo | não executar sem fluxo transacional | fecha a saida |
| manda / despacha / compartilha / dispara | envio | exige destinatário, canal e prova de envio | manda o cronograma |
| exporta / gera PDF / printa / baixa arquivo | exportação | 'baixa' arquivo ≠ baixa estoque | baixa o pdf |
| checa / confere / valida / bate | revisar ou comparar | não declarar conformidade sem fonte | bate NF com NE |
| vincula / amarra / relaciona / associa | relacionamento documental | conferir identidade antes de vincular | amarra a NS na NF |
| regulariza / corrige / acerta / ajusta | correção | investigar causa e impacto; respeitar autorização | acerta saldo físico |

### 3.6. Termos técnicos do EMPROVEX e siglas

**Regra:** Termos de domínio têm precedência sobre gírias, mas apenas quando acompanhados do contexto correto; desambiguar siglas homógrafas.

| Grafias e variações ilustrativas | Leitura candidata | Limites de interpretação | Exemplo sintético |
|---|---|---|---|
| NE / N.E. / nota empenho / empenho | Nota de Empenho | não confundir NE sem acento com 'né' coloquial após normalização | saldo da NE 2026NE0007 |
| NF / N.F. / nfs / nota / nota fiscal | Nota Fiscal | 'nota' isolada pode ser NF, NE, NS ou outra nota; pedir contexto | NF 42 |
| NS / N.S. / nota de sistema | Nota de Sistema / Nota de Lançamento de Sistema | 'ns' pode ser gíria; diferenciar de NF e NE | NS da NF 42 |
| NC / N.C. / nota crédito | Nota de Crédito | não confundir com NF ou NC como outras siglas | vincular NC na NE |
| SIAFI / siafi | sistema financeiro federal | saldo SIAFI não deve ser inferido do EMPROVEX | confere no SIAFI? |
| SAG / sag | fonte de importação de NS | não confundir JSON SAG com PDF de NE | colei JSON SAG |
| SISCOFIS / siscofis / sisco | fonte logística | distinguir Mapa de Existência e Pedido de Material | tenho pdf do sisco |
| Mapa / mapa de existencia / mapa siscofis | Mapa de Existência de estoque | Warehouse na main; importação requer conferência | importar mapa |
| Pedido / pedido de material / ped mat | Pedido de Material | Almoxarifado PR/piloto; NÃO é mapa e não dá baixa | ped mat de siscofis |
| UG / u.g. / unidade gestora | unidade gestora | UG não prova identidade de workspace | UG 160416 |
| OM / organização militar / setor | organização/conta setorial | não tratar como sinônimo de workspace; cadastro separado | cadastro da OM |
| CNPJ / cnpj | identificador cadastral do fornecedor | validar 14 dígitos e DV; preservar pontuação/zeros | NF por CNPJ |
| NR / nr / número registro item | identificador/código de item quando contexto documentar | 'NR' também norma regulamentadora; jamais inventar | NR do item |
| FUNADOM / funadom | classificação específica do Almoxarifado R1-D | estado PR/piloto; não generalizar | classe FUNADOM |
| QR / CALI / classe | classes configuráveis de empenho | 'QR' também pode significar QR Code ou abreviação coloquial 'quero' | classe QR |
| barcode / cód barras / cod barras / cb | código de barras | CB ambíguo e não deve ser reescrito sozinho | lê cód barras |
| PWA / app instalado / atalho | aplicativo web instalável | não prometer operação offline | PWA no celular |
| TR / termo de recebimento / termo | Termo de Recebimento | 'TR' também pode ser transferência; confirmar contexto | emitir termo recebimento |
| NL / OB / ND / GPS / DARF | siglas financeiras externas | reconhecer conceito sem declarar recursos implementados | tem OB dessa NF? |
| PDF / TXT / CSV / JSON | formatos de documento/dados | não confundir suporte de um importador com outro | arquivo pdf |
| WS / workspace / conta / ambiente | espaço lógico de autorização | WS não substitui prova de autorização | outro WS |
| NF-e / NFS-e / NFE / NFS | documentos fiscais eletrônicos | NFS-e não é automaticamente plural de NF; desambiguar | é NFS-e ou NF? |

### 3.7. Conceitos ambíguos de processos e estados

**Regra:** Rótulos de negócio devem permanecer vinculados a estado, documento, local e evento específicos.

| Grafias e variações ilustrativas | Leitura candidata | Limites de interpretação | Exemplo sintético |
|---|---|---|---|
| saldo | saldo por NE, item, NF ou estoque | pedir domínio quando não houver contexto; saldo financeiro ≠ kg | qual saldo? |
| recebido / chegou | recebimento financeiro, físico ou status do fornecedor | não inferir alocação física de NF recebida | já chegou? |
| pendente / em aberto | tramitação, pagamento, entrega, alocação ou conferência | desambiguar etapa e status | quais pendentes? |
| vencido / vence | validade de lote, prazo de entrega ou vencimento financeiro | não misturar validade de alimentos e pagamento | o que vence? |
| baixa | saída física, baixa financeira ou download de arquivo | identificar objeto, local e modalidade | quero dar baixa |
| nota | NE, NF, NS ou nota informal | não converter para NF por padrão quando isolado | cadê a nota? |
| entrega | remessa programada ou chegada confirmada | cronograma PDF não prova recebimento | teve entrega? |
| enviado | e-mail de cronograma ou exportação/compartilhamento | gerar PDF ≠ enviar; clique ≠ entrega | foi enviado? |
| estoque | saldo físico em depósito ou disponibilidade contratual | exigir fonte e local | tem 20 no estoque? |
| pedido | pedido de material ou solicitação de acesso | contexto SISCOFIS/Almox diferente de lead | meu pedido |
| material | item físico ou item de NE | NR e posição física não são intercambiáveis | onde ta material? |
| fornecedor / firma / empresa | cadastro fornecedor, empresa cliente ou pessoa jurídica | Empresas pausado, fornecedores em main | cadastrar empresa |
| comissão | comissão de recebimento ou comissão financeira | não ativar recurso QR/Almox por palavra isolada | comissão da NF |
| inventário | contagem, divergência, ajuste ou relatório | consulta ≠ ajuste confirmado | inventário deu ruim |
| liberado / disponível | visibilidade UI, acesso RBAC, flags ou revisão publicada | PR e main não são sinônimos de produção | já liberou? |
| concluído | registro salvo, documento emitido, e-mail enviado ou operação confirmada | exigir evidência da etapa correta | já concluiu? |
| excluir / arquivar / desativar | ações diferentes para registro, aviso e setor | não apagar por confusão com arquivamento | sumir da lista |
| reserva / separado | planejamento de separação versus baixa/reserva transacional | piloto Almox não reserva automaticamente | já reservei? |

### 3.8. Marcas de digitação, voz e formatação

**Regra:** Normalização conservadora sobre cópia de trabalho; manter texto original para auditoria e extração de entidades.

| Grafias e variações ilustrativas | Leitura candidata | Limites de interpretação | Exemplo sintético |
|---|---|---|---|
| nfs pendentes de ontem | ausência de pontuação | não supor data de emissão | nfs pendentes de ontem |
| NUM, ne, NF, ns em minúscula | variação de caixa | não perder distinção NE/né | ne de hoje |
| cadastraaaa / pendeeeente / fooooi | alongamento expressivo | não aplicar correção em números/códigos | cadastreeei |
| nfs   de    ontem | múltiplos espaços | não deslocar offsets de identificadores críticos | nfs   ontem |
| conograma / crongrama / empeno / fornecedo | erros leves de escrita | dicionário restrito, sem autocorreção arbitrária | crongrama da NE |
| "cadê a nota" / 'a nota' | aspas e citação | texto citado não é ordem de execução | o erro fala 'delete' |
| eu quero, quero dizer, a NE | autocorreção em meio à fala | última correção explícita prevalece dentro do mesmo escopo | não, a NE |
| ; :) :( 😅 😡 📦 | sinais emocionais e emoji | não considerar emoji como autorização nem como ID | onde foi a nf 😭 |
| ARROZ / arroz / Arroz | variação caixa | comparação insensível a caixa apenas no vocabulário, não IDs | cadê ARROZ |
| R$ 1.234,56 / 1.234,56 | valor pt-BR | preservar vírgula decimal e ponto milhar | saldo de R$ 1.234,56 |
| 1,5 kg / 1500 g / 1 cx / un | quantidades e unidades | não converter unidade sem fator cadastrado | baixa 1 cx |
| 2026NE0007 / 2026 NE 0007 / NE 7 de 2026 | identificação de NE | não reconstruir ID ambíguo sem validação; zeros podem importar | NE 7 de 2026 |
| 01/11/26 / 1 nov / 01-11-2026 | data | ano de dois dígitos ou ordem ambígua exige confirmação | 1 nov a 3 nov |
| código com pontos, hífens e barras | identificador | não alterar CNPJ, barcode, URL, número NF/NS | chave NF-e |
| mensagem em 2 ou 3 balões | fragmentação da intenção | esperar referência de contexto confiável; evitar operação ao chegar balão 1 | essa NF / de ontem / só pendente |

## 4. Exemplos de pares mínimos: uma palavra muda a operação

1. **Par 01:** A: “Como faço para excluir a NF?” / B: “Exclui a NF agora.”. **Não equivaler:** HOWTO versus WRITE; a segunda é solicitação de mutação.
2. **Par 02:** A: “Quais NF estão pendentes de tramitação?” / B: “Quais NF estão pendentes de pagamento?”. **Não equivaler:** Consulta de status operacional versus estado financeiro não suportado automaticamente.
3. **Par 03:** A: “Qual o saldo da NE?” / B: “Qual o saldo do depósito?”. **Não equivaler:** Saldo por documento financeiro versus quantidade física.
4. **Par 04:** A: “Cadastraram a NF ontem?” / B: “A NF foi emitida ontem?”. **Não equivaler:** Data de cadastro versus data de emissão.
5. **Par 05:** A: “Onde baixo o PDF?” / B: “Onde dou baixa no material?”. **Não equivaler:** Download de arquivo versus saída física.
6. **Par 06:** A: “Manda o cronograma por e-mail.” / B: “Mostra o cronograma na tela.”. **Não equivaler:** Envio com destinatário versus visualização.
7. **Par 07:** A: “O material está separado.” / B: “O material já saiu do estoque.”. **Não equivaler:** Ficha de separação não é baixa.
8. **Par 08:** A: “NF chegou e foi cadastrada.” / B: “NF foi alocada no depósito.”. **Não equivaler:** Cadastro financeiro não prova alocação.
9. **Par 09:** A: “Já gerei o checkout.” / B: “O pagamento foi confirmado.”. **Não equivaler:** Criar link não prova liquidação.
10. **Par 10:** A: “Qual o status do Pedido de Material?” / B: “Qual o estado do Mapa de Existência?”. **Não equivaler:** SISCOFIS Pedido na PR/piloto versus Warehouse Mapa.
11. **Par 11:** A: “é essa NE, né?” / B: “é a NE 2026NE0007?”. **Não equivaler:** 'né' coloquial versus entidade NE, sem perder referência.
12. **Par 12:** A: “Quero as NFs do fds.” / B: “fds, não achei as NFs.”. **Não equivaler:** 'fds' como período versus interjeição.
13. **Par 13:** A: “Me ajuda com QR.” / B: “Quero ler o QR Code.”. **Não equivaler:** classe/QR code/abreviação; confirmar contexto.
14. **Par 14:** A: “Pode conferir NS da NF?” / B: “ns, não achei a NF.”. **Não equivaler:** sigla NS versus expressão informal; não interpretar sem âncora.
15. **Par 15:** A: “limpa o filtro” / B: “apaga a NF”. **Não equivaler:** limpeza de interface versus exclusão de registro.
16. **Par 16:** A: “recebi 15 caixas” / B: “cadastrei uma NF de 15 caixas”. **Não equivaler:** recebimento físico versus registro documental.
17. **Par 17:** A: “só as NFs com NS” / B: “NFs sem NS”. **Não equivaler:** restrições opostas: nunca eliminar 'só' nem 'sem'.
18. **Par 18:** A: “NFs dos últimos 7 dias” / B: “NFs da semana passada”. **Não equivaler:** janela móvel versus semana calendário.
19. **Par 19:** A: “essa nota já foi enviada” / B: “a nota já foi cadastrada”. **Não equivaler:** canal e evento de envio precisam de evidência.
20. **Par 20:** A: “quero saldo de 3 unidades” / B: “quero saldo de R$ 3”. **Não equivaler:** medidas não são moedas.
21. **Par 21:** A: “Mostra as NFs de outra UG” / B: “Mostra as NFs da minha UG”. **Não equivaler:** escopo autorizado distinto, sem override por prompt.
22. **Par 22:** A: “Pode explicar o ajuste do inventário?” / B: “Efetue o ajuste do inventário.”. **Não equivaler:** HOWTO versus mutação de estoque.
23. **Par 23:** A: “A prateleira está vazia” / B: “o depósito está vazio”. **Não equivaler:** local específico versus estoque agregado.
24. **Par 24:** A: “nf 42 do fornecedor A” / B: “nf 42 do fornecedor B”. **Não equivaler:** número de NF sozinho não é identidade única.
25. **Par 25:** A: “quero remover uma linha da prévia de importação” / B: “quero excluir o estoque importado”. **Não equivaler:** prévia temporária versus alteração de dados persistidos.

## 5. Gramática contextual: cinco perguntas antes de responder

**1. Qual ato o usuário deseja?** Explicação (HOWTO), leitura (READ), criação/alteração (WRITE), documentação institucional (ABOUT), conversa casual (SOCIAL) ou esclarecimento (CLARIFY). Identificar indícios morfológicos sem reduzir tudo a palavras-chave.

**2. Sobre qual objeto e qual etapa?** NE, item de NE, NF, NS, NC, cronograma, fornecedor, lote, posição, Mapa SISCOFIS, Pedido SISCOFIS, aviso, usuário, assinatura. 'Nota' e 'saldo' sem contexto podem exigir pergunta curta.

**3. Quais são os filtros essenciais?** Exercício, intervalo e significado de data, fornecedor/CNPJ, documento, material, lote/validade, posição, status, classe, UG/workspace. Preservar `sem`, `somente`, negativos e períodos; se o contrato não representar um filtro, não executar consulta parcial disfarçada de completa.

**4. O recurso existe e a identidade tem acesso?** Confrontar F correspondente, status MAIN/MAIN COM GATES/PR/PILOTO/PAUSADO, revisão realmente implantada, role de usuário, autorização W3 e contexto da sessão. Nunca expor roadmap interno ao cliente final apenas porque consta no memorial.

**5. Qual evidência suporta o resultado?** Para HOWTO: instruções auditadas e visibilidade; para READ: resposta determinística com cobertura e status; para WRITE: não executar pelo canal de IA somente-leitura. Nunca afirmar que registrou, enviou, baixou, pagou ou concluiu sem prova.

## 6. Política de contexto em múltiplos turnos e correções

- **Anáfora permitida:** `ela`, `essa`, `daquela`, `o mesmo`, `dele`, `lá`, `agora`, `dessas`, `e quanto?` só resolve referência quando gênero, objeto, intenção, sessão e domínio são compatíveis. Sem compatibilidade, `CLARIFY`.
- **Correção explícita:** `não, quis dizer NE`, `na verdade, a NF`, `corrigindo, 20 kg` substitui o elemento corrigido e não conserva filtros contraditórios silenciosamente.
- **Troca de módulo:** da NF para estoque, do Almox para Empresa, ou da operação para suporte, não transfere automaticamente objeto, saldo, destinatário, unidade ou autorização.
- **Fragmentos de mensagem:** um balão contendo apenas `a de ontem` pode apontar para a consulta anterior, mas não aciona ação de escrita.
- **Expiração e escopo:** a memória operacional existente não deve sobreviver a troca de workspace/usuário ou expiração. Não aumentar persistência apenas para reconhecer gírias.
- **Contexto negativo:** `só`, `menos`, `não`, `sem NS`, `exceto fornecedor X` integram as restrições e precisam ser representados por contrato ou rejeitados/esclarecidos.

## 7. Padrão de respostas adaptativo e acessível

- Usuário formal: responder formalmente, sem excesso de termos técnicos e com caminho de menu quando conhecido.
- Usuário informal: responder de modo direto, cordial, sem corrigir sua escrita e sem copiar palavrões.
- Usuário iniciante: explicar cada conceito na primeira ocorrência e usar passos numerados curtos, sem inventar telas.
- Usuário avançado: incluir sigla e referência técnica, mas preservar restrições; não fazer 'resposta seca' que omita riscos.
- Usuário frustrado: priorizar o próximo passo verificável e separar diagnóstico provável de fato demonstrado.
- Pedido de resultado real: se falhar a consulta, dizer `não consegui consultar` em vez de `não há registros`.

## 8. Arquitetura sugerida (ainda NÃO implementada)

**Pipeline recomendado:** mensagem original → detector de trechos protegidos → tokens + normalização contextual conservadora → extração de entidades/filtros → roteador WHAT/HOWTO/READ/WRITE → validador de ambiguidade e escopo → W3 determinístico para dados OU recuperação documental aprovada para tutoriais → apresentação R2 da Eleonor → registro de avaliação anonimizado.

Recomendação de desenvolvimento: função lexical pura e testável; dicionário versionado; fronteira explícita entre sinônimos e efeitos de negócio; comparação diferencial entre texto original e variantes; nunca usar LFM3 como autorizador; manter regressões antigas W4/W5 e holdouts isolados.

**Ordem prática GOV-SIMP-01:** 1) classificador HOWTO/READ/WRITE com casos mínimos; 2) lexicon de alto retorno (`vc`, `qnd`, `hj`, `kd`, `pfv`, `n`, `dps`) com contexto; 3) âncoras técnicas e negativos; 4) recuperação F + permissões/status; 5) avaliação de conversas e observabilidade; 6) integração privada e publicação só mediante autorização.

## 9. Requisitos de avaliação e métricas

- Unidade de teste: registro da bateria R3, contendo `utterance`, `featureId`, `expectedIntentGroup`, `availability`, `expectedOutcome` e observações; ver dataset JSONL associado.
- Além de acerto de família/intenção: medir **preservação de negação**, **integridade de número/código/unidade**, **seleção correta de HOWTO vs WRITE**, **status PR/PAUSADO**, **filtro essencial** e **vínculo de contexto**.
- Falhas P0: execução de escrita simulada, consulta de outro workspace, vazamento de CNPJ, omissão de `sem`, confusão de NE/NF/NS com mutação, promessa de produção para PR ou baixa oficial a partir de Pedido em piloto.
- Exigir exemplos não derivados automaticamente para validação; frases artificiais não validam naturalmente linguagem real. Manter avaliação cega quando houver telemetria anonimizada autorizada.

## 10. Ideias adicionais além de gírias para fases futuras

1. **Mapa de erros e telas:** erro observável → causa possível, teste seguro e resolução; sem inventar mensagens.
2. **Glossário de rótulos efetivos da UI:** botão, menu, breadcrumb, modo Normal/Essencial, coluna e filtros por revisão.
3. **Mapa de papéis:** permissões demonstradas por setor, Admin, operador móvel e módulo; sem presumir por UG.
4. **Árvore de decisão de tarefas:** qual caminho usar para cadastrar NE, NF, NS, entrada, saída, inventário ou pedido.
5. **Estados de processo:** cadastro → validação → alocação → tramitação → envio, com evidências e ações distintas.
6. **Comparações cruzadas:** saldo financeiro/contratual/estoque, conta/UG/workspace, NF original/espelho, PDF gerado/enviado.
7. **Erros de reconhecimento de fala:** nomes de materiais, CNPJ ditado, data, número de NE, homófonos, pausas e autocorreções; apenas se suporte a voz for incorporado.
8. **Consulta de resultado com cobertura:** parcial, vazio, ambíguo, indisponível, sem autorização e erro técnico são resultados diferentes.
9. **Orientação normativa/administrativa:** separar ações no EMPROVEX de regras internas/legislação específica da UG, que exigem fonte vigente.
10. **Aprendizado editorial contínuo:** agrupar dúvidas reais anonimizadas por ID funcional, revisar fontes e status antes de acrescentar regra ao motor.

## 11. Referências e limites

1. Código primário: lib/emprovex-ai/context/language.ts, engine.ts, filterGuard.ts; lib/emprovex-ai/conversation/engine.ts, knowledge.ts; lib/emprovex-ai/integration/orchestrator.ts.
2. Memorial Oficial de Funcionalidades R2: 242 procedimentos F, 4.114 variações Q, 175 casos S e 41 conversas MT (PR #471).
3. Pesquisa sobre abreviações como variantes contextuais de português digital: https://www.semanticar.com.br/blog/abreviacoes-internet-significado (consulta de referência, não dicionário normativo).
4. Glossário SIAFI/NE e NS como documentação institucional: https://transparencia.presidentemedici.ro.gov.br/transparencia/aplicacoes/glossario/frmglossario.php (fonte auxiliar; prevalecem contratos operacionais e documentos oficiais vigentes).

**Integridade:** documento novo apenas, sem mudanças em `lib/`, APIs, autenticação, IAM, Firestore, domínio ou Cloud Run. O vocabulário é ilustrativo, sujeito a variação regional e individual; não é gramática normativa nem certificado de cobertura exaustiva. Proibido usar variantes do atlas para ampliar os contratos operacionais do W3 ou acessar recursos indisponíveis.
