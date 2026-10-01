# EMPROVEX SaaS R1 — Plano Mestre

Última atualização: **2026-10-01**
Baseline de produção: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`
Branch integradora: `feat/saas-r1-commercializacao`
Estado: **PLANEJAMENTO DETALHADO VALIDADO / CONTRATOS COMUNS CONGELADOS / ONDA 1 LIBERADA**

## 1. Objetivo

Transformar o EMPROVEX já publicado em um SaaS comercial inicial sustentável, com o mínimo de burocracia para fundador e cliente, sem reconstruir fundações que já existem e sem criar automações financeiras, infraestrutura ou fluxos self-service antes de haver necessidade real.

Princípio diretor:

> **Primeiro vender de forma assistida, segura e reversível. Automatizar apenas o que o piloto provar que custa tempo, causa erro ou impede crescimento.**

A R1 não é uma reescrita do EMPROVEX. É uma camada comercial, de ciclo de vida, segurança, legal e operação sobre a aplicação multi-tenant já existente.

## 2. Diagnóstico da base existente

A auditoria da `main` confirmou que a R1 já começa com fundações relevantes prontas:

### 2.1 Billing OBSERVE já existente

O Bloco 22 já implementa:
- mensalidade padrão de **R$ 50,00**;
- trial padrão de **30 dias**;
- vencimento administrativo no **5º dia útil**;
- tolerância de **10 dias corridos**;
- estados `trial`, `active`, `pending`, `suspended`, `canceled` e `exempt`;
- competências `open`, `pending`, `paid` e `waived`;
- painel administrativo de assinaturas;
- concessão de trial;
- confirmação manual de pagamento;
- alteração manual do status comercial;
- configuração de Pix;
- fundador isento;
- trilha de auditoria;
- Firestore Rules dedicadas;
- modo `observe` com `requirePayment=false` e suspensão automática desativada.

Conclusão: **não criar outro billing engine**.

### 2.2 Provisionamento e identidade já existentes

A plataforma já possui:
- criação administrativa de workspace/UG;
- criação/pré-vínculo da identidade Firebase;
- conta externa por e-mail/senha;
- fundador por Google;
- vínculo UID + e-mail + workspace + UG;
- rollback/recovery do provisionamento;
- limite de sessões e lease;
- fail-closed para identidade inconsistente.

Conclusão: **R1 continua com onboarding assistido; não haverá cadastro público de organização**.

### 2.3 Legal já existente

Já existem páginas públicas de:
- Política de Privacidade;
- Termos de Serviço;
- descrição de Google Drive/Gmail;
- retenção em termos gerais;
- contato de privacidade;
- referência a LGPD e Limited Use do Google.

Conclusão: revisar para contexto comercial e registrar aceite, em vez de recriar o legal do zero.

### 2.4 Backup, monitoramento e custos já existentes

A plataforma já possui:
- backup lógico por workspace no Google Drive;
- checksum, retenção e simulação de restauração;
- backup separado de Firebase Auth/diretório;
- teste de desastre em emulador;
- Cloud Monitoring global;
- telemetria estimada por UG;
- painel consolidado;
- alertas de uso/cota;
- histórico diário de consumo.

Conclusão: **completar lacunas operacionais**, principalmente backup nativo dos dois bancos Firestore, uptime externo e runbook comercial.

## 3. Caminho comercial escolhido para a R1

### 3.1 Decisão

O caminho inicial será:

> **trial interno do EMPROVEX + cobrança externa simples por Mercado Pago/Pix + confirmação administrativa no painel + suspensão manual e reversível.**

A R1 **não** terá:
- Checkout Pro próprio;
- Checkout Transparente;
- SDK de cartão;
- armazenamento de dados de pagamento;
- Access Token do Mercado Pago no cliente;
- webhook;
- conciliação automática;
- assinatura criada por API;
- emissão automática de cobrança;
- split;
- motor fiscal;
- auto-suspensão;
- autoexclusão de dados.

A documentação oficial do Mercado Pago mantém Link de Pagamento e Planos de Assinatura como soluções sem integração. Mesmo assim, a R1 preserva o fluxo manual já modelado pelo EMPROVEX porque ele evita mudar o contrato de vencimento, trial e status na primeira comercialização.

### 3.2 Evolução opcional

`Planos de Assinatura` do Mercado Pago, sem integração, fica como evolução **R1.1**, a ser reavaliada se:
- existirem clientes pagos suficientes para a conciliação manual virar trabalho recorrente relevante;
- o piloto demonstrar atrasos por esquecimento de pagamento;
- a data recorrente do provedor puder ser conciliada com o contrato comercial adotado sem duplicar fontes de verdade.

A API/webhook só entra depois de evidência adicional.

## 4. Contrato comercial canônico

### 4.1 Unidade comercial

Na R1:
- 1 cliente operacional = 1 workspace;
- 1 workspace = 1 UG;
- 1 workspace externo possui 1 conta operacional primária;
- a conta fundadora HGeSM permanece isenta;
- não haverá redesign multi-seat na R1.

O limite atual de sessões permanece uma regra operacional independente da cobrança.

### 4.2 Fonte de verdade comercial

A fonte canônica é `billingAccounts/{workspaceId}`.

Estados:
- `trial` — teste em andamento;
- `active` — comercialmente regular;
- `pending` — requer atenção/regularização;
- `suspended` — suspensão comercial explícita;
- `canceled` — encerramento comercial;
- `exempt` — fundador/isento.

Nenhuma frente poderá criar estados concorrentes com nomes diferentes.

### 4.3 Trial

Contrato:
- padrão: 30 dias;
- início: provisionamento/concessão administrativa;
- extensão: somente administrativa e auditada;
- fim do trial não apaga dados;
- fim do trial não dispara suspensão automática;
- após o fim, o painel deve colocar o workspace em atenção e o fundador decide ativação, pendência ou suspensão.

### 4.4 Preço, vencimento e tolerância

Baseline R1:
- R$ 50,00/mês;
- vencimento administrativo: 5º dia útil;
- tolerância: 10 dias corridos;
- feriados adicionais permanecem configuráveis;
- mudança de preço futura deve preservar histórico das competências anteriores.

### 4.5 Pagamento

O EMPROVEX não processará cartão/Pix diretamente.

A experiência será:
1. cliente recebe indicação clara de regularização;
2. abre o link externo configurado do Mercado Pago ou usa Pix;
3. pagamento acontece fora do EMPROVEX;
4. fundador confirma administrativamente;
5. competência passa a `paid`;
6. conta comercial passa a `active`;
7. a confirmação é auditada.

O sistema pode guardar somente metadados administrativos mínimos, como referência textual opcional do pagamento. Não guardar número de cartão, CVV, token de pagamento, credencial do Mercado Pago ou comprovante por padrão.

### 4.6 Suspensão

A suspensão inicial é **manual**.

Depois da tolerância:
- o painel sinaliza atenção;
- o fundador pode suspender;
- a ação deve ser explícita, auditada, idempotente e reversível;
- suspensão comercial **não exclui nem altera dados operacionais**;
- reativação deve recuperar o acesso sem migração de dados.

O enforcement não deverá adicionar uma consulta a `billingAccounts` em cada Rule operacional. A estratégia R1 é sincronizar, por ação administrativa segura, a suspensão comercial com os estados de acesso já existentes em `workspaces` e `platformAccounts`. As Rules atuais já exigem ambos como `active`.

A implementação deve atualizar os estados de acesso de forma atômica/recuperável e revogar sessões ativas quando necessário.

### 4.7 Cancelamento

`canceled` é estado comercial, não comando de exclusão.

Na R1:
- cancelamento não apaga workspace;
- não apaga documentos;
- não apaga histórico;
- não reaproveita UG/e-mail automaticamente;
- exportação/retenção/exclusão são processo separado;
- exclusão só ocorre por procedimento administrativo específico e após validação da regra legal aplicável.

## 5. Experiência pública de regularização

Criar uma superfície pública simples, sem exigir acesso operacional, com:
- nome EMPROVEX;
- explicação curta do status;
- botão para pagamento/regularização;
- alternativa Pix quando configurada;
- e-mail de suporte;
- links para Termos e Privacidade.

O link de pagamento é dado público de checkout, mas credenciais do provedor nunca são expostas.

Usuário suspenso deve receber uma mensagem humana como:
- “Acesso temporariamente suspenso. Regularize a assinatura ou fale com o suporte.”

Evitar mensagens técnicas como “billing”, “claim”, “workspace disabled” ou “permission denied”.

## 6. Onboarding R1

### 6.1 Modelo escolhido

Onboarding **assistido pelo fundador/admin**.

Não haverá:
- auto-cadastro de organização;
- autoaprovação;
- criação pública de workspace;
- descoberta automática de UG;
- contratação dentro do aplicativo.

### 6.2 Fluxo

1. fundador confirma dados mínimos do cliente;
2. cria workspace/UG pelo painel já existente;
3. informa e-mail operacional primário;
4. concede trial;
5. provisionamento cria Auth + diretório + billing;
6. cliente recebe credencial inicial por canal seguro;
7. primeiro acesso valida identidade;
8. cliente aceita a versão vigente de Termos/Privacidade;
9. cliente recebe checklist curto;
10. conexão Google Drive é opcional e orientada;
11. cliente começa a operar.

### 6.3 Redução de suporte

Adicionar:
- “Esqueci minha senha” usando o fluxo nativo do Firebase;
- troca de senha acessível ao usuário;
- mensagens claras para credencial inválida, conta suspensa, workspace inconsistente e limite de sessão;
- checklist de primeiro acesso com no máximo as ações realmente necessárias.

Não criar tour longo, chatbot obrigatório ou wizard que bloqueie o uso sem necessidade.

## 7. Contrato de aceite legal

A R1 deve registrar aceite de um **pacote legal versionado**, sem chamar todo tratamento de dados de “consentimento LGPD”.

Modelo:
- `legalBundleVersion`;
- `termsVersion`;
- `privacyVersion`;
- UID/e-mail;
- workspaceId/UG;
- `acceptedAt` com tempo confiável;
- user agent apenas se realmente necessário;
- documento imutável por versão.

Proposta de caminho:
`workspaces/{workspaceId}/legalAcceptances/{uid}__{legalBundleVersion}`

O runtime consulta apenas o ID esperado para a versão vigente. Não é necessário varrer histórico.

Novo aceite só é exigido quando a versão legal configurada mudar.

## 8. Segurança R1

Objetivos:
- preservar isolamento multi-tenant;
- remover dependência de decisão apenas visual;
- proteger ações administrativas;
- manter fail-closed;
- impedir que status comercial seja falsificado pelo tenant;
- não aumentar custo de Rules sem necessidade.

### 8.1 Suspensão/reativação

A frente de segurança implementará o enforcement depois de billing/onboarding estabilizados.

A ação administrativa deve:
1. validar sessão fundadora server-side;
2. ler vínculo workspace/conta/billing;
3. confirmar coerência de e-mail/UG/UID;
4. atualizar billing e estados de acesso de forma coordenada;
5. registrar auditoria;
6. revogar/encerrar leases quando suspender;
7. ser idempotente;
8. suportar recuperação de falha parcial;
9. nunca tocar dados operacionais.

### 8.2 Segredos

Continuar:
- nada sensível em `NEXT_PUBLIC_*`;
- Google/Cloud/Firebase Admin somente server-side;
- nenhuma credencial de pagamento na R1;
- tokens Google temporários conforme arquitetura atual.

### 8.3 Dependências

Auditar vulnerabilidades relevantes, mas não atualizar dependências em massa só para “zerar avisos”. Correção deve ser orientada por risco e compatibilidade.

## 9. Legal/privacidade R1

Revisar Termos e Privacidade para incluir:
- serviço comercial/trial;
- cobrança externa;
- Mercado Pago como provedor de pagamento quando utilizado;
- ausência de armazenamento de credenciais de pagamento pelo EMPROVEX;
- suspensão e reativação;
- cancelamento;
- retenção e exclusão separadas de inadimplência;
- canal de atendimento ao titular;
- fornecedores de infraestrutura;
- responsabilidades do cliente sobre dados institucionais inseridos;
- tratamento de incidentes.

Não declarar “100% conforme LGPD” por código.

Antes do SaaS aberto, o texto comercial deve receber validação jurídica/contábil adequada ao enquadramento real do responsável pelo serviço.

A ANPD prevê simplificações para agentes de tratamento de pequeno porte, inclusive possibilidade de não indicar encarregado, desde que atendidos os requisitos aplicáveis e exista canal com titulares. O EMPROVEX não presumirá enquadramento; a frente legal apenas deixará a estrutura técnica pronta.

## 10. Operação, backup e monitoramento

### 10.1 Backup

A estratégia R1 terá duas camadas:

**Camada A — backup nativo Firestore**
- habilitar backup agendado diário no banco operacional principal;
- habilitar backup agendado diário no banco `emprovex-warehouse`;
- retenção inicial enxuta, a ser confirmada pelo custo do piloto;
- executar pelo menos uma restauração real para banco novo antes do SaaS aberto.

**Camada B — backup lógico por workspace**
- preservar o backup atual no Drive;
- preservar checksum e restauração não destrutiva;
- usar essa camada para recuperação seletiva/tenant e portabilidade operacional.

A camada nativa é importante porque o backup lógico atual depende de sessão + Drive e não cobre sozinho toda a Central de Depósitos.

Rules e configuração de deploy continuam versionadas no GitHub.

### 10.2 Uptime

Usar o Cloud Monitoring já adotado pelo projeto.

Criar:
- endpoint público de health sem dados sensíveis e sem leitura de Firestore;
- uptime check HTTPS;
- validação de SSL;
- política de alerta simples.

Evitar contratar outro serviço de uptime na R1.

### 10.3 Erros e deploy

Manter:
- Vercel como fonte de status de deploy/runtime;
- GitHub Actions como certificação;
- alertas/monitoramento Firebase já existentes.

Adicionar runbook simples:
1. confirmar domínio;
2. confirmar último deploy;
3. verificar runtime errors;
4. verificar Firestore/Monitoring;
5. classificar impacto;
6. corrigir ou rollback;
7. registrar incidente relevante.

### 10.4 Suporte

R1 usa um canal simples já controlado pelo fundador, inicialmente e-mail.

Não criar helpdesk/ticketing antes do piloto demonstrar necessidade.

## 11. Piloto comercial

### 11.1 Objetivo

Validar operação real antes de abertura ampla.

Tamanho inicial recomendado:
- **3 a 5 workspaces externos assistidos**.

Não é um limite arquitetural; é um lote de aprendizagem.

### 11.2 Evidências mínimas

Antes de SAAS-J:
- pelo menos 3 onboardings reais completos;
- pelo menos 1 cliente efetivamente pago;
- pelo menos 1 fluxo trial → regularização/ativação;
- 1 exercício controlado de suspensão → bloqueio → reativação;
- 1 teste real de restauração nativa;
- nenhuma evidência de acesso cross-tenant;
- custo Firebase/Vercel observado;
- dúvidas de suporte classificadas;
- comportamento em máquina/conexão modestas observado.

### 11.3 Capacidade

Meta comercial inicial: até **100 usuários registrados**.

A certificação não deve confundir:
- cadastrados;
- ativos no período;
- sessões simultâneas.

Testar cenários reproduzíveis de crescimento e registrar o teto observado. Não declarar “100 simultâneos” apenas porque existem 100 cadastros.

## 12. Critérios para SaaS aberto

SAAS-J só pode aprovar abertura quando estiverem comprovados:
- billing/trial;
- pagamento/regularização;
- suspensão/reativação;
- onboarding;
- reset de senha;
- aceite legal;
- isolamento multi-tenant;
- backup de ambos os bancos;
- restauração testada;
- uptime/alerta;
- monitoramento de custo;
- runbook de incidente;
- piloto;
- capacidade/custo;
- regressão funcional do EMPROVEX;
- pendências conhecidas classificadas.

Abertura comercial continua exigindo decisão explícita do usuário.

## 13. Não objetivos da R1

Não entram sem nova decisão:
- múltiplos usuários/roles por workspace;
- self-service de contratação;
- checkout embutido;
- API/webhook Mercado Pago;
- suspensão automática;
- emissão fiscal automática;
- CRM;
- helpdesk;
- Kubernetes;
- microserviços;
- troca de Firebase/Vercel/Next.js;
- data warehouse;
- BI comercial complexo;
- apagar dados por inadimplência.

## 14. Fontes externas consultadas

Pesquisa de decisão, consultada em 2026-10-01:
- Mercado Pago Developers — Primeiros passos / soluções sem integração;
- Mercado Pago Developers — Planos de assinatura;
- Firebase / Cloud Firestore — Disaster recovery / scheduled backups;
- Google Cloud Monitoring — Public uptime checks;
- ANPD — Resolução CD/ANPD nº 2/2022 e Guia de Segurança para Agentes de Tratamento de Pequeno Porte.

Estas referências orientam o desenho, mas regras jurídicas, fiscais e comerciais finais devem considerar o enquadramento real do responsável pelo serviço.
