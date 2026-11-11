# EMPROVEX — COZINHA DIETÉTICA | MEMORIAL OFICIAL V1

**Data-base:** 11/11/2026  
**Identificador:** EMPROVEX-DIETAS-MEM-001  
**Status:** PLANEJAMENTO FUNCIONAL E ARQUITETURAL CONSOLIDADO — NÃO IMPLEMENTADO / NÃO HOMOLOGADO / NÃO PUBLICADO  
**Produto:** EMPROVEX — extensão Cozinha Dietética para Organizações Militares Hospitalares  
**Unidade-piloto de referência:** Hospital Geral de Santa Maria (HGeSM).  
**Repositório de referência:** aprov-hgesm/Controles-de-Empenhos---Aprov  
**Fonte:** requisitos e decisões de produto definidos nas conversas de planejamento; observações das capturas do SIGOM legado.  
**Natureza:** memorial de referência para desenvolvimento, testes, homologação e futuras revisões. Não substitui prescrição médica, protocolo assistencial, ato institucional, parecer jurídico ou autorização de tratamento de dados pessoais.

> **Regra de precedência:** este memorial é a referência do módulo Cozinha Dietética e da navegação de entrada aqui planejada; não altera as regras operacionais produtivas do EMPROVEX, os memoriais de Aprovisionamento, Almoxarifado, EMPRESAS e Segurança, nem o procedimento canônico de publicação Cloud Run. Qualquer conflito com contrato vigente de segurança ou de produção deve ser resolvido em PR separada, com teste de não regressão. Este commit é apenas documental.

---

## 1. Finalidade e princípios

Construir dentro do EMPROVEX um sistema hospitalar de solicitação, confecção de mapas, produção, conferência e distribuição de refeições aos pacientes, com auditoria e rastreabilidade. A operação será inicialmente centrada em **preenchimento manual rápido**, com programação alimentar **opcional** e introduzida progressivamente.

Princípios vinculantes de produto:

1. **Paciente e continuidade alimentar primeiro:** regras administrativas de prazo não dispensam encaminhamento assistencial de necessidades clínicas excepcionais.
2. **Simplicidade operacional:** poucos cliques, interfaces específicas por perfil, preenchimento manual como caminho principal na V1, sem solicitar reconfirmações desnecessárias.
3. **Planejamento e horários observados:** mapas das 06h, 10h e 16h, com registro preciso de envios e alterações.
4. **Prescrição médica como origem:** o médico prescreve a dieta; a unidade assistencial registra/atualiza a dieta no módulo de acordo com a prescrição vigente.
5. **Nutrição como auditoria:** a nutricionista consulta, audita, registra inconformidades e pode solicitar revisão diretamente ao médico; **não existe homologação nutricional rotineira obrigatória a cada pedido**.
6. **Responsabilidade baseada em evidência:** os eventos devem mostrar quem fez o quê e quando; o software não declara culpa nem isenção legal automática.
7. **Proteção por padrão:** dados de saúde não são dados logísticos comuns; isolamento rigoroso, mínimo acesso e implantação institucional autorizada.
8. **Sem regressões do núcleo:** extensão e navegação novas não devem impedir login ou transações de Aprovisionamento, Almoxarifado e outras áreas.
9. **GOV-SIMP-01:** simplificar burocracia, preservando os controles indispensáveis de segurança do paciente, privacidade e integridade operacional.

### 1.1 Decisões fechadas versus validações futuras

**Decisões funcionais de produto já definidas:** três ciclos diários; regras de 30 minutos; preenchimento manual prioritário; Nutrição auditora; perfis de unidade/cozinha; quatro opções no portal; novas rotas amigáveis; página comercial em /info; operação inicialmente orientada ao HGeSM.

**Ainda dependem de validação institucional e técnica:** protocolo de intercorrência após tolerância; responsabilidade formal e escalonamento; lista oficial e equivalência de dietas; perfis de acesso e autorização para dados pessoais; operação com prontuário médico; infraestrutura hospitalar definitiva; integração real com o SIGOM; datas de implantação e publicação. Não registrar esses itens como aprovados pelo hospital.

---

## 2. Portal EMPROVEX e endereços de acesso

O endereço **https://emprovex.com.br** passa, após implementação/homologação, a representar um **portal de seleção operacional**, com quatro cartões, sem expor dados internos antes da autenticação.

| Acesso exibido no portal | Rota canônica planejada | Destino |
|---|---|---|
| Aprovisionamento | /aprovisionamento | Login e módulo atual de empenhos, notas fiscais, cronogramas e operações do Aprovisionamento |
| Almoxarifado | /almoxarifado | Entrada e experiência própria do Almoxarifado |
| Cozinha Dietética | /cozinha-dietetica | Entrada hospitalar para unidades, Cozinha Dietética, Nutrição e administração operacional |
| Fornecedores | /fornecedores | Entrada empresarial/fornecedores, conforme evolução homologada da extensão Empresas |
| Link institucional (fora dos quatro cartões) | /info | Página comercial e institucional atual, com ligação de retorno ao portal |

**Regra de experiência:** cada cartão abre **tela de login visualmente específica**; identidade e autorização continuam centralizadas ou federadas por mecanismo seguro, sem duplicação de senhas e cadastros. Login válido não confere acesso automático aos outros módulos.

**Compatibilidade obrigatória com URLs históricas:**

- /central-empenhos -> /aprovisionamento; preservar query string (p. ex. tab), referências externas, links internos, deep links e comportamento de sessão.
- /login -> /aprovisionamento; evitar ciclos de redirecionamento.
- /hospitalar -> /cozinha-dietetica; alias preventivo, sem afirmar que a rota exista em produção.
- /institucional -> /info; preservar ativos, SEO e links do sítio comercial.
- /central-depositos e suas subrotas permanecem válidas para a operação do depósito; a introdução de /almoxarifado não quebra URLs ou fluxo atual.
- A rota empresarial histórica, se existente em branches futuras, deve ter integração/alias decidido após inspeção do estado real e testes de isolamento.

**Estado técnico verificado na main de 11/11/2026, SHA-base 34654f47004679b93b876ce98e459d8104752a76:** a raiz / hoje é reescrita para /institucional por next.config.ts; app/institucional/page.tsx contém a vitrine; /central-empenhos reexporta o shell de app/login/page.tsx; /central-depositos é módulo independente; app/page.tsx possui fallback histórico. **A nova navegação não foi implementada por este memorial.**

Implementação recomendada: criar portal público mínimo e página /info reaproveitando o conteúdo institucional; ativar a nova entrada /aprovisionamento como alias canônico do shell atual sem duplicar estado; acrescentar entradas de Almoxarifado, Cozinha Dietética e Fornecedores com guards no servidor. Aplicar troca de URLs por etapa separada, testes de rota/SEO/PWA e publicação controlada. Regras de redirecionamento devem preservar query strings e evitar perdas de sessão.

---

## 3. Organizações e identidades

O EMPROVEX terá uma classificação de organização/ambiente apta a habilitar a extensão para **OM Hospitalar / OMS**, sem impor o módulo a OMs comuns nem alterar unilateralmente contratos de cobrança.

A organização hospitalar é o perímetro institucional (identidade de OM/UG); **unidade assistencial** é uma subdivisão interna. Não confundir OM, workspace/setor, unidade assistencial, conta, perfil e assinatura.

### 3.1 Unidades iniciais do HGeSM

- Pronto Atendimento Médico (PAM);
- Oncologia;
- Unidade de Terapia Intensiva (UTI);
- Unidade de Pacientes Internos (UPI);
- Bloco Cirúrgico;
- Cozinha Dietética (produtora/distribuidora, não unidade solicitante);
- Nutrição (auditoria).

Nomes, siglas, leitos e organizações devem ser configuráveis para outras OMs hospitalares.

### 3.2 Perfis de acesso e respectivas atribuições

| Perfil | Pode fazer | Não deve fazer por padrão |
|---|---|---|
| Unidade solicitante | Cadastrar/consultar pacientes de sua responsabilidade, registrar dieta conforme prescrição médica, montar e enviar seus mapas, informar admissões, movimentações, jejum e alta, acompanhar entregas | Editar pedidos de outra unidade sem autorização; prescrever clinicamente; alterar registros de preparo/entrega |
| Cozinha Dietética | Receber mapas, visualizar filas e consolidados, executar preparo, montagem, conferência, expedição e registrar ocorrências; consultar dados mínimos para entrega segura | Alterar prescrição médica ou atribuir responsabilidade jurídica automaticamente |
| Nutrição / Auditoria | Visualizar dados necessários à auditoria, identificar inconformidades, emitir recomendações, contatar médico, acompanhar resposta, emitir relatórios | Ser etapa obrigatória de autorização de mapas rotineiros; modificar prescrição médica diretamente |
| Gestor hospitalar operacional | Configurar unidades, ciclos, usuários autorizados, regras e visualizar indicadores conforme atribuição | Ter acesso indiscriminado a dados clínicos sem necessidade funcional |
| Plataforma EMPROVEX | Habilitar módulo, administrar infraestrutura, disponibilidade e identidade institucional | Ler prontuários/dietas identificáveis por ser superadministrador comercial |
| Médico prescritor | **Prescreve a dieta no fluxo assistencial institucional**; eventualmente poderá receber solicitação de revisão e responder por integração futura | Necessidade de cadastro obrigatório no EMPROVEX na V1 |

A organização terá usuários pessoais identificados por UID, vínculo com uma ou mais unidades, função, status de habilitação e permissões concedidas pelo hospital. Não usar uma conta genérica compartilhada como único registro de autoria assistencial. Permissões checadas no backend, nunca somente na interface.

---

## 4. Regras operacionais dos três mapas diários

**Fuso operacional:** America/Sao_Paulo, horário local da unidade, com timestamps de auditoria armazenados de modo inequívoco (UTC + conversão de exibição). O nome do ciclo não deve ser confundido com a hora de lançamento do evento.

| Ciclo | Mapa deve estar confeccionado até | Refeição principal | Refeição secundária | Limite de tolerância para entrega da principal |
|---|---|---|---|---|
| 06h | 06:00 | Café da manhã | Lanche da manhã | 06:30 |
| 10h | 10:00 | Almoço | Lanche da tarde | 10:30 |
| 16h | 16:00 | Jantar | Ceia | 16:30 |

**Mapa das 06h:** pode ser preparado no dia anterior; a unidade continua responsável por atualizar alterações relevantes antes do fechamento e comunicar urgências.

**Regras de prazo:**

1. O envio regular ocorre **até a hora de confecção do mapa**: 06h, 10h ou 16h. A cozinha precisa receber a informação antes de iniciar a preparação/distribuição prevista.
2. **O prazo de confecção não é o mesmo que a tolerância de 30 minutos.** Essa tolerância é o limite indicado para entrega da refeição principal, não uma extensão automática do prazo normal de cadastrar ou alterar pedidos.
3. Após 06h30/10h30/16h30, a regra operacional informada pelo HGeSM prevê fornecimento **apenas da refeição secundária** no fluxo comum, com registro da solicitação tardia. A viabilidade real de preparo e entrega, inclusive dentro da tolerância, é indicada pela cozinha.
4. **Exceção assistencial:** se a secundária não for segura ou suficiente para o paciente, a unidade deve acionar imediatamente o profissional assistencial responsável e a Nutrição/médico conforme protocolo hospitalar. O sistema registra alerta e providência; jamais silencia a intercorrência nem presume que a falta de alimento é aceitável.
5. Pedidos após a hora oficial do mapa são **alterações/solicitações extraordinárias**, vinculadas a seu evento original. Devem identificar motivo e impacto sem reescrever a versão do mapa enviada no prazo.
6. Situações urgentes não são definidas livremente como prioritárias por qualquer usuário sem critério: a classificação deve ser estabelecida pela instituição.
7. A emissão, o preparo e a entrega terão eventos e horários próprios; não declarar que a cozinha entregou apenas porque produziu, nem que entregou ao leito apenas porque expediu ao setor.

### 4.1 Congelamento e versionamento

Cada mapa possui data, unidade, ciclo, autor, horário de criação, horário de envio, versão e itens/pacientes. No momento de fechamento, o sistema guarda **snapshot imutável** do mapa oficial; ajustes posteriores criam eventos/adendos com autoria, horário e justificativa curta, preservando o original.

**Não eliminar automaticamente o mapa por falta de confirmação:** exibir pendência da unidade, avisar cozinha/gestão e ativar plano institucional de contingência. Também não assumir que rascunho equivale a mapa recebido.

### 4.2 Estados distintos

- **Mapa:** rascunho → enviado → fechado; pode receber adendos e pendências depois do fechamento.
- **Pedido individual:** solicitado/validado operacionalmente → em preparo → pronto → expedido → entregue; além de cancelado, suspenso, bloqueado por segurança, necessidade de revisão e ocorrência.
- **Movimentação do paciente:** prevista → confirmada/cancelada; o evento previsto **não** é evento concluído.
- **Revisão de Nutrição:** identificada → comunicação registrada → resposta/encaminhamento → encerrada; não bloqueia indiscriminadamente a rotina.

Não misturar os quatro autômatos numa única coluna de status.

---

## 5. Operação inicial: preenchimento manual como regra

A V1 **não depende de programação alimentar contínua nem de planejamento antecipado** pela unidade. O usuário pode abrir um dos três mapas, localizar pacientes existentes ou cadastrar rapidamente novos, confirmar leito e dieta prescrita, incluir os itens e **enviar o mapa explicitamente**.

Fluxo mínimo:

1. Identificação automática da unidade do usuário; quem atua em mais de uma escolhe a autorizada.
2. Seleção do mapa de 06h/10h/16h e da data.
3. Busca/cadastro de paciente com identificação mínima necessária; associação à internação e leito.
4. Registro da dieta conforme prescrição médica vigente; seleção rápida no catálogo; restrições e alertas mostrados.
5. Adição de pacientes e visualização de totais (dieta principal/secundária, unidade, restrição e quantitativo).
6. **Enviar mapa**; recibo com autor, data, hora e versão. Cozinha recebe instantaneamente.
7. Acompanhamento do andamento e registro de alteração/ocorrência, se necessário.

Não exigir que a unidade preencha todos os dias uma programação de sete dias ou preveja toda a movimentação de pacientes. Não tornar obrigatório agendamento de amanhã, previsão de alta ou previsão de transferência para enviar um mapa.

**Aceleradores permitidos e opcionais:** preenchimento salvo, pesquisa por leito/nome/identificador, seleção múltipla, cópia de mapa anterior como **rascunho editável**, reaproveitamento de pacientes já cadastrados, atalhos por unidade e visualização de alterações desde o último mapa. Todo reaproveitamento deve confrontar alterações conhecidas de prescrição, jejum, alergias, alta e movimentação, e exigir a conferência final do responsável.

### 5.1 Implantação progressiva do planejamento alimentar

- **Fase A — Manual:** único modo necessário para o primeiro piloto; métricas de completude, tempo para montar mapas e aderência aos horários.
- **Fase B — Manual assistido:** copiar mapa anterior, incluir pacientes ainda ativos e destacar alterações; operação sempre revisável e confirmada pela unidade.
- **Fase C — Programação opcional:** pacientes podem ter grade alimentar e previsões de movimentação para sugerir mapas, se a unidade desejar; **não obrigatória** e sem ativação global compulsória.
- **Fase D — Integrações assistenciais futuras:** importar censo/prescrições de sistemas autorizados, mantendo a unidade responsável pelo acompanhamento do processo.

A passagem entre fases depende de adesão observada, testes e autorização institucional; não assumir que em alguns meses toda unidade estará preparada.

---

## 6. Pacientes, internações e movimentações

O sistema deve separar: **Pessoa/Paciente**, **Internação/Episódio**, **Localização atual e histórico de leitos**, **Prescrição/registro da dieta vigente**, **Mapa** e **Pedido de refeição**.

Cadastro rápido deve atender à operação, sem transformar o módulo em prontuário completo.

### 6.1 Movimentações exigidas

- Admissão de paciente à unidade;
- Transferência entre unidades (ex.: UTI → UPI);
- Remanejamento de leito;
- Encaminhamento temporário ao Bloco Cirúrgico e retorno;
- Previsão de entrada ou saída, quando informada **voluntariamente**;
- Alta prevista, confirmada ou cancelada;
- Óbito e outros desfechos, sob autorização e política institucional adequada;
- Alteração de dieta, jejum ou suspensão de fornecimento por ordem clínica.

**Regra de unicidade:** um paciente transferido não pode gerar duplicação indevida de refeição do mesmo ciclo para a mesma internação. O destino deve ser atualizado com rastreabilidade, sem apagar o registro original.

**Previsão não é confirmação:** alta prevista e transferência prevista nunca geram automaticamente cancelamento de refeição sem evento confirmado/regra assistencial aprovada. Atrasos de transferência devem ser comunicados e refletidos no destino do pedido. Mudanças depois de expedição requerem coordenação da distribuição.

A unidade de origem, unidade de destino, cozinha e responsável assistencial devem receber apenas avisos úteis, associados a uma ação real.

---

## 7. Prescrição, catálogo de dietas e segurança do paciente

**Regra institucional declarada pelo usuário para o HGeSM:** a dieta é prescrita pelo médico; a unidade a lança/atualiza no sistema conforme a prescrição; a nutricionista atua principalmente como auditora e pode pedir diretamente ao médico revisão. O módulo não permitirá que profissionais das unidades criem livremente uma prescrição nova por conveniência operacional.

Separar no cadastro:

- Dieta oral, alimentação enteral, suplementos e outros tipos autorizados;
- Consistência (quando pertinente), restrições, alergias, ingredientes/produtos vedados e observações objetivas;
- Via, dispositivo, apresentação, volume e horário, quando aplicáveis; **SNE é dispositivo/via de acesso, não consistência alimentar**;
- Jejum/NPVO como condição clínica/suspensão, **não consistência**;
- Identificação da prescrição vigente, referência/registro de origem e data/hora de atualização;
- Itens de refeição e cardápio/preparações definidos para produção, sem substituir a prescrição.

**Origem de verdade:** o registro médico institucional. Enquanto não existir integração, a unidade informa a referência da prescrição/atualização conforme protocolo local. A cozinha opera com uma representação controlada e minimizada dos dados necessários.

**Alertas de segurança:** alergia, prescrição incompatível, jejum, restrição crítica, dieta alterada depois da montagem e duplicidade acionam aviso preventivo. Nos casos de risco imediato, o fluxo impede **liberação insegura** até esclarecimento pelo responsável assistencial, sem converter toda solicitação em pedido dependente de validação prévia da nutricionista.

A confirmação de entrega deve observar o protocolo institucional de identificação positiva do paciente, com pelo menos dois identificadores adequados e sem depender apenas do número de leito.

---

## 8. Interfaces por perfil

### 8.1 Unidade assistencial — quatro abas

| Aba | Conteúdo |
|---|---|
| Início | Próximo mapa, prazo, pacientes ativos, mapas pendentes, comunicados e alterações relevantes |
| Pacientes | Busca, cadastro rápido, leito, dieta vigente registrada, admissões, altas e transferências |
| Meus Mapas | Três ciclos, montagem manual em lista, seleção múltipla, envio, recibo, adendos |
| Acompanhamento | Status por refeição/paciente, mudanças, ocorrências, entregas e histórico filtrável |

No primeiro acesso, reconhecer automaticamente a unidade associada ao usuário; não exigir seleção repetida. Mobile-first/PWA, inclusive para turnos noturnos.

### 8.2 Cozinha Dietética — cinco abas

| Aba | Conteúdo |
|---|---|
| Painel | Fila em tempo real, mapas recebidos por ciclo, totais e avisos; sem exigir aceitar um a um |
| Produção | Quantidades agrupadas por dieta/preparação, lote, restrição e horário; início e conclusão em lote |
| Distribuição | Etiquetas, identificação, conferência, expedição, destino e confirmação de entrega |
| Ocorrências | Solicitações tardias, alteração pós-fechamento, falta, divergência, suspensão e retrabalho |
| Relatórios | Mapas diários, produção, entrega, pontualidade, cancelamentos, quantitativos e histórico |

Duas visões: **pedidos individuais** e **mapa consolidado de produção**. Inspirar-se em *Kitchen Display Systems* e logística de delivery, mas jamais importar escolha de dieta pelo consumidor como substituto de prescrição.

### 8.3 Nutrição — auditoria, cinco abas

| Aba | Conteúdo |
|---|---|
| Painel de Auditoria | Visão das dietas, alertas e tendências |
| Pacientes e Dietas | Consulta autorizada de dietas vigentes e histórico de alterações |
| Inconformidades | Achados, evidências e acompanhamento |
| Comunicação Médica | Solicitação de revisão ao prescritor e resposta registrada, sem alteração autônoma da prescrição |
| Relatórios | Auditorias, alterações, inconformidades e encaminhamentos |

### 8.4 Administração hospitalar

Configuração de unidades/leitos, funções/usuários, três ciclos, horários, catálogo autorizado, regras de exceção, avisos, parâmetros de impressão, indicadores e auditoria. Os administradores técnicos e comerciais da plataforma **não recebem acesso clínico por padrão**.

---

## 9. Operação da cozinha, distribuição e ocorrências

**Recebimento automático:** mapa enviado e válido entra na fila; não há clique adicional de aceite para cada paciente. Aviso visual e controle de status, com confirmação de início em lote.

**Produção consolidada:** agregações por data, ciclo, dieta, restrição, preparação e unidade; a cozinha pode consultar o detalhamento de cada bandeja. Mudança de prescrição em preparo/pronto gera bloqueio/alerta para reconferência.

**Etiquetas:** identificação suficiente para entrega segura, dieta e restrições relevantes, unidade/leito/destino, ciclo e identificador da refeição; sem dados sensíveis desnecessários ou exposição pública.

**Distribuição:** distinguir preparado, conferido, expedido, recebido pela unidade e entregue ao paciente; a implantação pode começar com poucas confirmações operacionais, mas nunca marcar entrega fictícia por dedução.

**Ocorrência objetiva automática:** autor, unidade, ID da internação/pedido, horário da solicitação, prazo aplicável, etapa, mudança, motivo e ação executada. Exemplos: unidade não atualizou admissão; transferência não informada; solicitação tardia; preparo tardio; distribuição tardia; alta prevista não confirmada; indisponibilidade do sistema.

A causa e eventual responsabilidade **são apuradas por registros e procedimentos humanos**, nunca determinadas automaticamente por regra de absolvição/culpabilização. A Cozinha Dietética deve ter evidência da hora efetiva do recebimento e das ações que realizou, especialmente quando a unidade descumpriu o planejamento.

### 9.1 Contingência

Se sistema/rede estiver indisponível, usar procedimento institucional alternativo (contato e mapa contingencial controlado), registrar hora do contato e, quando o serviço retornar, conciliar o ocorrido sem duplicar pedidos ou forjar horários originais. Toda mudança crítica de prescrição exige comunicação efetiva ao responsável assistencial e à cozinha.

---

## 10. Filtros e relatórios

Filtros úteis: OM/UG autorizada, unidade, leito, data, ciclo, tipo/consistência da dieta, principal/secundária, status, restrições, horário de envio, solicitações extraordinárias, entregas, cancelamentos e ocorrências.

Relatórios mínimos:

1. Mapa por ciclo/unidade e consolidado hospitalar;
2. Total de preparações por dieta e refeição principal/secundária;
3. Horários reais de envio, preparação, expedição e entrega;
4. Solicitações após o prazo e motivos informados;
5. Alterações posteriores ao fechamento;
6. Movimentações e impacto nos pedidos;
7. Cancelamentos antes/depois do preparo e desperdício estimado;
8. Histórico de inconformidades da Nutrição e solicitações aos médicos;
9. Relatório de auditoria por usuário/evento, com acesso restrito;
10. Exportação PDF/planilha, com minimização dos dados pessoais e metadados de geração.

Indicadores agregados preferenciais para a gestão: mapas enviados no prazo, refeições por período, taxa de entrega, tempo por etapa, pedidos tardios por unidade, inconsistências, cancelamentos e desperdício. Evitar métricas punitivas automáticas sem interpretação do contexto.

---

## 11. Arquitetura lógica e infraestrutura proposta

### 11.1 Integração à plataforma

O EMPROVEX já dispõe de Next.js/React/TypeScript, autenticação Firebase, identificação por workspace/UG, Cloud Run, componentes de administração, auditoria e infraestrutura multi-tenant. Reutilizar padrões de UI, autenticação e observabilidade, **não** permissões amplas, bancos clínicos ou transações do Aprovisionamento.

**Fronteira modular sugerida:**

    app/
      portal/                  (ou entrada raiz por rewrite)
      info/
      aprovisionamento/
      almoxarifado/
      cozinha-dietetica/
      fornecedores/
      api/hospital/...         (somente endpoints autenticados, quando aplicável)
    features/
      hospital/
        dietas/
          domain/
          application/
          components/
          patients/
          prescriptions/
          maps/
          production/
          distribution/
          nutrition-audit/
          reporting/
    lib/server/hospital/       (authz, regras de negócio e acesso ao armazenamento)

As rotas acima são **propostas**, não nomes de arquivos já existentes. O módulo hospitalar não deve importar serviços financeiros de NF/empenhos nem modificar seus fluxos críticos.

### 11.2 Backend e armazenamento

**Arquitetura-alvo:** frontend EMPROVEX e backend hospitalar com identidade de serviço própria e datastore hospitalar isolado, acessado apenas por operações de servidor autorizadas. PostgreSQL transacional ou Firestore hospitalar dedicado são candidatos; selecionar pelo custo, isolamento, auditoria, transações e facilidade de manutenção, **não declarar escolhido antes de decisão técnica**.

Separar dados hospitalares de workspaces logísticos e empresariais. Validar sempre no servidor: usuário/UID, OM/UG, vínculo com unidade, papel, escopo do pedido, status de internação, horário/ciclo, autorização para criar/alterar/entregar. Uma conta do setor logístico não pode se tornar perfil clínico por analogia de e-mail.

Arquitetura recomendada sem burocracia: **monólito modular** com fronteira de dados hospitalares, em vez de microsserviços indiscriminados; se for exigida separação de runtime, manter apenas um serviço hospitalar adicional. Usar relógio de servidor confiável, idempotência por chave de pedido/ciclo, transações para evitar duplicidade e logs estruturados com correlação não identificável.

### 11.3 Entidades principais (modelo conceitual)

| Entidade | Papel |
|---|---|
| HospitalOrganizationConfig | OM/UG, habilitação hospitalar, timezone e parâmetros |
| HospitalUnit / Bed | Unidades, leitos e vínculos |
| HospitalMembership | UID, papéis, unidades permitidas, habilitação e trilha |
| Patient | Identidade mínima necessária, protegida |
| Admission | Internação/episódio e situação |
| PatientLocationEvent | Movimentações previstas e confirmadas |
| DietCatalog / Preparation | Dietas padronizadas e preparações |
| MedicalDietReference | Versão/registro operacional da prescrição médica; origem e alteração |
| MealCycleConfig | Janelas 06h, 10h, 16h e tolerâncias |
| DietMap / DietMapVersion | Mapa por unidade/ciclo/data, envio, snapshot e adendos |
| MealRequest | Refeição individual vinculada a uma internação, dieta e ciclo |
| ProductionBatch / MealLabel | Consolidado, preparo, montagem e conferência |
| DeliveryEvent | Expedição, transferência de custódia e entrega |
| NutritionAudit / MedicalReviewRequest | Achados e comunicação de revisão |
| Incident / AuditEvent | Eventos, causas informadas, autores e trilha imutável |

Cada pedido deve possuir chave lógica que previna duplicação indevida por internação + data + ciclo + tipo de refeição, permitindo alterações versionadas quando houver motivo legítimo. Separar **registro de dieta** de **solicitação de refeição**. Não guardar dados identificáveis de pacientes em repositório GitHub, screenshots de PR, telemetria pública ou ambientes de desenvolvimento.

### 11.4 Atualização em tempo real e disponibilidade

Atualizações em tempo real por WebSocket, SSE ou listeners autorizados, com fallback de atualização sem perda de estados. Controle de conexões e leitura eficiente para reduzir custos. Estados explícitos de loading, erro e dados parciais. Planejar contingência offline **operacional**, sem sincronização automática insegura de dietas.

### 11.5 Integrações futuras

Integração autorizada com prontuário, censo hospitalar e prescrições, preferencialmente por APIs e padrões interoperáveis apropriados; HL7 FHIR NutritionOrder pode orientar o modelo, sem impor integração antes da V1. Integração logística com estoque/consumo do Aprovisionamento será **agregada, opcional e minimizada**, sem expor informações clínicas nominativas nem criar dependências transacionais cruzadas.

---

## 12. Segurança, privacidade e responsabilidades

Dados de saúde são **dados pessoais sensíveis**. Antes de usar pacientes reais, obter a autorização institucional, definir responsabilidades de tratamento e verificar LGPD, controles internos do hospital, requisitos de infraestrutura, retenção, backup e resposta a incidentes.

Exigências mínimas:

- Princípio do mínimo privilégio por OM, unidade, profissional e finalidade; sem leitura global de pacientes por administração comercial.
- Autenticação individual, sessão segura e revogação de acesso; perfis segregados por backend.
- Criptografia em trânsito e em repouso; armazenamento de segredos fora do código; identidade de serviço específica.
- Trilhas de auditoria de leitura e alteração, com acesso restrito e sem registrar prescrição/identificadores sensíveis nos logs de aplicação.
- Backup testado, recuperação, monitoramento e contingência para horários críticos.
- Testes multi-tenant para negar leitura, edição ou inferência de dados de outra OM/unidade sem autorização.
- Política institucional de retenção, minimização, acesso por necessidade e impressão segura.
- Dados **fictícios ou anonimizados adequadamente** em QA e demonstrações; proibir produção de dados pessoais reais em ambientes de teste não aprovados.
- Avaliação proporcional de ameaças antes de conectividade externa/Internet e habilitação de contas assistenciais.

**Atenção:** segurança de APIs e autorização do servidor são necessárias mesmo com Firestore Rules estritas. A escolha por banco separado não substitui controles de aplicação. Sem proteção comprovada, manter o módulo não publicado ou sem acesso a dados reais.

---

## 13. Reaproveitamento de referências e padrões externos

- iFood / aplicativos de pedidos: navegação simples, status visível, atualização em tempo real e comunicação.
- Kitchen Display Systems: fila, preparo em lote, consolidação por preparação e priorização.
- Sistemas de logística: despacho, conferência, destino, confirmação e histórico.
- Sistemas hospitalares: identificação segura, dieta prescrita, jejum, alergias, rastreabilidade e comunicação.
- SIGOM legado: aproveitar conhecimento de campos, setor/leito, vias, restrições, etiquetas e mapa; **não clonar suas fragilidades de fluxo nem presumir que código/dados estejam acessíveis**.

Uso de bibliotecas e projetos externos somente após avaliação de licença, manutenção, vulnerabilidades e adequação a dados sensíveis. Nenhum fornecedor ou biblioteca foi selecionado por este memorial.

---

## 14. Plano de entrega sem regressões

**Fase 0 — Fundação documental e técnica:** homologar diretrizes locais, decidir arquitetura de armazenamento/autorização, definir modelos/contratos, cadastrar ambientes de QA e publicar protótipo sem dados reais.

**Fase 1 — Portal de acessos (PR isolada):** raiz com quatro opções, /info, /aprovisionamento e aliases; criar rotas de entrada com tela específica de login sem alterar funcionamento existente; validar links, histórico, sessão, billing, PWA e SEO. **Não fazer deploy automaticamente.**

**Fase 2 — Identidade hospitalar e MVP manual:** cadastro de OM hospitalar, usuários individuais/unidades/leitos; catálogos; paciente/internação; mapas manuais de 06h/10h/16h; dieta de origem médica, envio, adendo e prazos; cozinha com painel e produção; Nutrição auditora.

**Fase 3 — Operação ponta a ponta:** etiquetas, conferência, distribuição, confirmação, transferências/altas, pedidos tardios, alertas críticos, ocorrências e relatórios.

**Fase 4 — Piloto/Homologação institucional:** usar dados fictícios e cenários representativos; simular três ciclos e exceções. Só iniciar uso com pacientes reais após autorização, revisão de segurança e protocolos de contingência aprovados.

**Fase 5 — Evolução opcional:** copiar mapa anterior/manual assistido, previsões de movimentação, programação alimentar voluntária, integrações clínicas/logísticas após comprovar adesão.

**Restrições fixas:** branches isoladas, PRs revisáveis, sem merge/deploy nesta elaboração; não quebrar setores existentes, não alterar cobranças, contas externas, Firestore Rules produtivas ou serviços sem etapa própria aprovada; não introduzir dependências de serviços hospitalares dentro de operações críticas do Aprovisionamento.

---

## 15. Critérios mínimos de aceite e testes

1. Portal apresenta quatro opções corretas e /info contém a página comercial atual.
2. /central-empenhos e /login chegam a /aprovisionamento sem perda de parâmetros nem regressão de autenticação e billing.
3. /central-depositos e funcionalidades antigas continuam operando.
4. Cada perfil acessa somente unidades/ações autorizadas; teste de acesso cruzado entre duas OMs e duas unidades é negado.
5. Unidade envia mapa **manualmente** sem programação alimentar obrigatória.
6. Três mapas distintos por data/unidade; 06h pode ser preparado no dia anterior.
7. Servidor registra corretamente a hora oficial de fechamento e a janela 06:30/10:30/16:30, inclusive na virada de dia e em condições de concorrência.
8. Adendo posterior não altera o snapshot de mapa original; identificar quem enviou fora do prazo.
9. Transferência ou alta **prevista** não cancela refeição automaticamente.
10. Transferência confirmada não duplica pedido; destino de entrega fica coerente.
11. Nutrição registra auditoria e solicitação de revisão médica sem ser bloqueio rotineiro do mapa.
12. Alergia, jejum ou alteração crítica bloqueiam **entrega incompatível**, com comunicação/encaminhamento assistencial.
13. Cozinha produz em lote e registra preparo, expedição e entrega como eventos diferentes.
14. Exceção após a tolerância registra refeição secundária prevista e escalonamento clínico quando necessário; não impede assistência por decisão cega do sistema.
15. Relatórios reconcilam mapa, pedidos, preparo e entrega; registros não se perdem em indisponibilidade.
16. Nenhum dado pessoal de paciente aparece em logs públicos, builds, analytics, screenshots de CI ou ambientes de demonstração.
17. Testes de não regressão do núcleo EMPROVEX, incluindo empenhos, notas fiscais, Almoxarifado e login, permanecem aprovados.
18. Recuperação, contingência e resposta a indisponibilidade verificadas em simulação antes de operar com pacientes reais.

**Parecer neste marco:** GO para especificação e desenvolvimento isolado; **NO-GO para dados reais, ativação institucional ou publicação em produção** até homologação e autorização próprias.

---

## 16. Pendências legítimas para validação institucional

Não impedir a elaboração nem o protótipo; resolver antes do piloto real:

- Horário exato e mecanismo de recebimento/fechamento dos mapas na rotina do hospital, inclusive dias não úteis; comunicação de contingência.
- Critérios assistenciais para paciente recém-admitido, dieta insuficiente, alergia, jejum e pedido tardio.
- Catálogo oficial de dietas e refeições, formatos de etiquetas e impressão.
- Identificadores autorizados de paciente/internação e fonte formal de consulta à prescrição.
- Papéis e responsabilidade operacional de cada unidade, Nutrição, distribuição e Cozinha Dietética.
- Qual infraestrutura e contrato institucional permitirão guardar dados sensíveis, políticas de backup e retenção.
- Conexão possível e autorizada ao SIGOM/prontuário; migração não prevista por padrão.
- Alçadas de aprovação para liberação do módulo, implantação no HGeSM e posterior uso em outras OMS.

---

## 17. Histórico de decisões e manutenção

| Data | Marco | Efeito |
|---|---|---|
| 11/11/2026 | Memorial V1 consolidado | Regras de três mapas e tolerância, preenchimento manual prioritário, Nutrição como auditoria, navegação EMPROVEX e arquitetura segregada |
| Futuro | Adendo de design/implantação | Registrar decisão, PR, SHA, testes e estado (PLANEJADO, EM PR, HOMOLOGADO, PUBLICADO), sem reescrever retrospectivamente o histórico |

**Forma de manutenção:** manter este arquivo como memorial canônico de Cozinha Dietética. Acrescentar revisões datadas com links de PR, SHA, evidências e responsabilidades de cada mudança. Não afirmar implementação por simples presença do memorial no repositório.

**Referências técnicas internas de preservação:** README.md; docs/EMPROVEX_MEMORIAL_OFICIAL.md; docs/EMPROVEX_CORE_PROTECTION.md; docs/EMPROVEX_RELEASE_CLOUD_RUN.md; docs/EMPROVEX_EMPRESAS_MEMORIAL_OFICIAL.md; lib/platformIdentity.ts; lib/workspaceContext.ts; lib/platformModuleAccess.ts; lib/operationalPaths.ts; app/login/page.tsx; app/central-empenhos/page.tsx; app/central-depositos/page.tsx; app/institucional/page.tsx; next.config.ts.

---

## 18. Plano Mestre e prompts de execução dos Workers (adendo documental 11/11/2026)

O desenvolvimento será dividido em **W0–W9**, com contrato arquitetural compartilhado, arquivos reservados e integração única. A equipe deverá ler o **[Plano Mestre dos Workers R1](cozinha-dietetica/PLANO_MESTRE_WORKERS_R1.md)** antes de codificar.

| Worker | Missão executável | Prompt oficial |
|---|---|---|
| W0 | Fundação, contratos, identidade, autorização e armazenamento QA | [W0](cozinha-dietetica/workers/W0.md) |
| W1 | Portal, rotas, logins e compatibilidade | [W1](cozinha-dietetica/workers/W1.md) |
| W2 | Pacientes, leitos, internações e movimentações | [W2](cozinha-dietetica/workers/W2.md) |
| W3 | Dietas prescritas de referência e mapas manuais | [W3](cozinha-dietetica/workers/W3.md) |
| W4 | Painel da cozinha e produção | [W4](cozinha-dietetica/workers/W4.md) |
| W5 | Etiquetas, conferência, expedição e entrega | [W5](cozinha-dietetica/workers/W5.md) |
| W6 | Nutrição auditora e comunicação médica | [W6](cozinha-dietetica/workers/W6.md) |
| W7 | Administração hospitalar e permissões | [W7](cozinha-dietetica/workers/W7.md) |
| W8 | Filtros, indicadores, relatórios e exportação | [W8](cozinha-dietetica/workers/W8.md) |
| W9 | Integração de W0–W8, E2E, segurança e regressão | [W9](cozinha-dietetica/workers/W9.md) |

**Execução:** W0 fixa `W0_BASE_SHA` e entrega contratos; W1–W8 iniciam em branches independentes após essa fundação e podem atuar em paralelo; W9 integra em branch separada. **Nenhum Worker deve fazer merge na main ou deploy**. O comando de ativação está no Plano Mestre; troca-se apenas o número do Worker.

**Precedência:** os prompts detalham a execução deste memorial, **não** modificam suas decisões clínicas, o caráter manual inicial, os horários nem a obrigação de autorização institucional para o uso de dados reais. Todo adendo futuro terá status e evidências próprios.

---

## 19. Worker W10 — Firestore hospitalar operacional e regressão PWA (adendo 11/11/2026)

**Nova missão oficial:** [Worker W10 — prompt completo](cozinha-dietetica/workers/W10.md), incorporada ao [Plano Mestre dos Workers R1, seção 10](cozinha-dietetica/PLANO_MESTRE_WORKERS_R1.md). Este adendo **não revoga** os requisitos operacionais, perfis, horários e controles de segurança deste memorial.

### Estado que motivou W10

- **W09:** PR Draft [#549](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/549) integrou W0–W8, com **SQLite exclusivamente de QA** e testes sintéticos. Não houve deploy ou liberação clínica.
- **Firebase hospitalar:** projeto `cozinha-dietetica`, Firestore `(default)`, Auth e-mail/senha, app Web e Rules de cliente fechadas (`allow read, write: if false;`) segundo as capturas fornecidas pelo usuário. Nenhum dado de paciente foi cadastrado.
- **Fundação Firebase isolada:** PR Draft [#550](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/550) separou autenticação do projeto logístico e criou gateway Firestore por IAM. Seus handlers clínicos W0–W9 **ainda usam SQLite síncrono**, inclusive relatórios SQL; portanto o banco hospitalar real **não está operacionalmente integrado**.
- **CI de referência da PR #550:** typecheck/build, 6 novos testes de Firebase, 111 testes hospitalares e 29 regressões passaram (146/146). A auditoria Visual-R2 relatou teste PWA histórico esperando redirecionamento de `/` para `/institucional`, incompatível com o novo portal planejado; corrigir teste/contrato sem desfazer portal.

### Contrato de execução W10

1. Migrar todos os serviços e handlers hospitalares para um datastore **Firestore transacional assíncrono**, preservando idempotência, versões imutáveis, unicidade, autorização por OM/UG/unidade e trilhas de auditoria.
2. Cobrir entrada, pacientes, dietas, mapas manuais das 06/10/16, produção, distribuição, Nutrição, Administração, ocorrências, relatórios e exportações; testar o fluxo completo com **emuladores e dados fictícios**, sem criar cópias divergentes do ledger.
3. Manter o projeto Firebase do hospital isolado do EMPROVEX principal, Firestore Rules negando leitura/escrita por SDK cliente, identidade de serviço com permissões mínimas e configuração segura quando institucionalmente autorizada.
4. Atualizar o teste PWA para `/` como portal e `/info` como vitrine, preservando os aliases históricos e a segurança/capacidade de instalação PWA.
5. Abrir **somente PR Draft W10**, partindo do HEAD atualizado da PR #550, contra a branch dessa mesma PR; não fazer merge, deploy, alteração de GCP produtivo, dados reais ou alterações na main.
6. GO somente para integração técnica QA se todos os fluxos e testes efetivamente passarem. **NO-GO para uso com pacientes e publicação** até autorização institucional, validação de IAM e dados sensíveis, contingência e homologação do hospital.

**Comando de ativação pronto:** consta na seção 10 do Plano Mestre. A pasta `docs/cozinha-dietetica/workers/` passa a conter **W0–W10** (onze prompts), mantendo os dez originais.

---

## 20. W11 — infraestrutura Firebase/Google Cloud hospitalar isolada (adendo 11/11/2026)

**Missão oficial:** [W11 — prompt completo](cozinha-dietetica/workers/W11.md), com [comando pronto no Plano Mestre, seção 11](cozinha-dietetica/PLANO_MESTRE_WORKERS_R1.md).

**Evidência que antecede W11:** PR Draft [#551](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/551), branch `feat/cozinha-dietetica-w10-firestore-operacional`, HEAD de referência `9572049742d9c9bfd4cd2265e999ab083728fd56`. A integração Firestore **passou no emulador**; os checks do HEAD final incluíram W10 QA, build, Fast CI, Core Protection e Visual-R2 com sucesso. **Isso não significa que o banco Firestore real, a identidade IAM ou um serviço Cloud Run estejam conectados.**

O projeto Firebase real `cozinha-dietetica` já existe com Firestore `(default)`, Auth e-mail/senha e regras negando acesso direto pelo cliente. O W11 **não** deve duplicar este projeto nem reutilizar o projeto EMPROVEX logístico/Empresas.

**Escopo W11:** desenvolver gateway Firestore real compatível com as operações assíncronas W10, preparar autenticação e IAM dedicados, fronteira Cloud Run **privada e isolada**, proteção contra acessos entre OMs/unidades, testes de Auth/Firestore em emulador e, **somente mediante autorização expressa e credenciais apropriadas**, smoke test no GCP hospitalar com dados fictícios. Nenhuma modificação real em IAM, regras, índices, serviço Cloud Run ou dados é autorizada apenas pela existência do prompt. Não declarar conectividade GCP como PASS se não executada.

**Entrega:** branch `feat/cozinha-dietetica-w11-infra-hospitalar-isolada` baseada no HEAD atualizado da PR #551; PR Draft **contra a branch W10**, `docs/cozinha-dietetica/integration/W11_HANDOFF_GCP_R1.md`, evidências técnicas e GO/NO-GO distintos para emulador, GCP real e produção.

**Não autorizado:** merge, deploy público, intervenção no Cloud Run do EMPROVEX principal, autorização clínica ou uso de pacientes reais.

## 21. W12 — homologação técnica integral e preparação do piloto controlado (adendo 11/11/2026)

**Missão oficial:** [W12 — prompt completo](cozinha-dietetica/workers/W12.md), com [comando no Plano Mestre, seção 12](cozinha-dietetica/PLANO_MESTRE_WORKERS_R1.md). **Ativar somente depois que W11 tiver branch, PR Draft, código e handoff verificáveis.**

**Escopo W12:** homologar os perfis Unidade, Cozinha, Nutrição auditora e Administração; ciclos 06/10/16, pedidos principal/secundário, dieta médica, jejum, alergias, transferência, concorrência, preparação, conferência, expedição, identificação positiva na entrega, auditoria e relatórios. Testar segurança multi-OM, sessões revogadas, custos, dispositivo móvel, PWA, desempenho, queda de rede, contingência e restauração, sem usar pessoas ou informações clínicas reais.

A homologação será informada em níveis independentes:
- **QA por emulador:** ambiente local e CI com dados fictícios.
- **QA no GCP hospitalar:** backend privado e banco Firestore real **somente com autorização expressa para o teste com dados sintéticos**.
- **Prontidão técnica de produção:** checklist e plano reversível (kill switch, rollback sem apagar eventos e monitoramento), sem disponibilização pública automática.
- **Piloto com pacientes reais:** **NO-GO até decisão institucional específica**, base legal/LGPD, plano de contingência aprovado e autorização posterior separada para qualquer ação de produção.

**Entrega:** branch `feat/cozinha-dietetica-w12-homologacao-piloto` com base no HEAD verificado do W11 e PR Draft contra a branch W11, `docs/cozinha-dietetica/integration/W12_HANDOFF_HOMOLOGACAO_R1.md`, testes concretos PASS/FAIL/NOT RUN e parecer técnico por ambiente.

**Planejamento consolidado:** W0–W10 entregues até teste de integração emulador; **W11 e W12 são os dois Workers adicionais previstos** para chegar à decisão de piloto. Código e CI não substituem autorização institucional de uso clínico.

---

**ENCERRAMENTO V1:** O futuro módulo EMPROVEX Cozinha Dietética será uma extensão hospitalar integrada ao portal comum, com operação manual inicial, produção e distribuição rastreáveis, auditoria nutricional não bloqueante, regras específicas do HGeSM e separação real de dados clínicos. O memorial é um contrato de planejamento e não constitui entrega de software.
