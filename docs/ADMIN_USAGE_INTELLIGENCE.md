# Inteligência de Consumo & Cotas — EMPROVEX

## Objetivo

Transformar a área administrativa de consumo em uma central de capacidade financeira e operacional,
com leitura prioritária da franquia diária do Firestore Enterprise e histórico por UG.

A tela preserva duas fontes que não podem ser confundidas:

1. **Global real** — Google Cloud Monitoring do banco Firestore configurado.
2. **Por UG** — telemetria atribuída pelo próprio EMPROVEX.

A primeira responde **quanto da franquia real do banco foi consumido**. A segunda responde
**qual workspace/UG gerou atividade instrumentada pelo aplicativo**.

## Cota principal

O indicador principal é:

`firestore.googleapis.com/api/billable_read_units`

Referência padrão do Firestore Enterprise elegível ao free tier:

- Read Units: 50.000/dia;
- Real-time update units: 50.000/dia;
- Write Units: 40.000/dia.

A janela diária acompanha `America/Los_Angeles`, pois o free tier é reiniciado à meia-noite
do horário do Pacífico.

Os limites continuam parametrizáveis server-side por variáveis de ambiente. O painel não calcula
uma fatura final em moeda; armazenamento, rede, créditos e demais SKUs continuam no Google Cloud Billing.

## Resiliência da leitura global

O leitor do Monitoring possui duas fontes de credencial server-side:

1. `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`;
2. credencial dedicada `EMPROVEX_GCP_MONITORING_CLIENT_EMAIL/PRIVATE_KEY`.

O runtime tenta as credenciais disponíveis em sequência. Se a conta administrativa não possuir
`roles/monitoring.viewer`, a credencial dedicada pode assumir a consulta sem derrubar o painel.

Nenhuma credencial é enviada ao navegador.

## HGeSM fundador

O workspace `hgesm-aprov`, UG `160416`, é sempre incluído no conjunto administrativo de consumo,
mesmo durante uma condição transitória em que o diretório Firestore ainda não o tenha retornado.

A atividade operacional do fundador em perfil setor permanece atribuída à UG 160416.

Atividade puramente administrativa da plataforma não é artificialmente rateada para o HGeSM:
o painel global real continua mostrando esse custo no total do banco, enquanto a atribuição por UG
permanece limitada às operações instrumentadas em contexto operacional.

## Histórico global

Além da atualização durante consultas administrativas, a produção possui uma captura automática
diária via Vercel Cron em `/api/cron/usage-snapshot`. A execução ocorre às 09:15 UTC e consolida
o **dia anterior já encerrado no horário do Pacífico**, evitando que o histórico dependa de alguém
abrir o painel. A rota exige `CRON_SECRET` no header Bearer, seguindo o mecanismo de autenticação
de Cron Jobs da Vercel.

Cada consolidação atualiza um único documento diário:

`platformUsageHistory/{YYYY-MM-DD}`

O documento contém somente agregados de consumo e referência de cota. Refreshes do mesmo dia
substituem a fotografia anterior; não criam uma nova linha.

A escrita é server-side via IAM. Firestore Rules deixam a coleção somente leitura para a conta
fundadora e negam writes de clientes.

Isso permite acumular histórico além da retenção nativa de algumas métricas do Cloud Monitoring.

## Histórico por UG

O histórico por UG reutiliza a telemetria existente:

`workspaces/{workspaceId}/usageEstimates/{YYYY-MM-DD}`

Não é criada uma segunda coleção por setor.

O relatório carrega somente a UG selecionada. Portanto, um relatório anual lê no máximo um
documento diário por dia para aquela UG, em vez de varrer todas as UGs da plataforma.

## Períodos de relatório

A interface oferece:

- Diário — dia corrente;
- Semanal — últimos 7 dias;
- Mensal — mês corrente;
- Anual — ano corrente.

O relatório apresenta:

- percentual global real da franquia;
- Read Units usadas e limite diário;
- média e pico de consumo da franquia no período;
- reads/writes/deletes estimados da UG;
- snapshots e listeners atribuídos;
- participação estimada da UG no universo instrumentado do dia;
- tabela cronológica;
- exportação CSV.

## Eficiência

A área histórica usa `getDocs` pontual e não usa `onSnapshot`.

Nenhum listener é criado para histórico de cota. Atualizações acontecem apenas:

- na entrada/alteração do período;
- na troca da UG selecionada;
- quando o administrador pressiona Atualizar.

## Limitações e interpretação

O Google Cloud Monitoring observa o banco, não a UG de negócio do EMPROVEX.

Consequentemente:

- o percentual da franquia global é a referência real para capacidade/cobrança;
- a participação por UG é uma atribuição interna;
- o sistema não converte reads estimados de uma UG diretamente em Read Units oficiais;
- a soma das UGs não é apresentada como fatura.

O histórico global é acumulado pelo EMPROVEX a partir desta implementação. Lacunas anteriores à
implantação podem existir e devem permanecer visíveis como ausência de amostra, nunca como zero inventado.
