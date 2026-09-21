# Arquitetura da Central de Administração EMPROVEX

## Objetivo

A Central de Administração deixa de ser uma página monolítica e passa a organizar
as capacidades administrativas existentes em superfícies especializadas. A
mudança é de composição e navegação: autenticação, multi-tenancy, provisionamento,
sessões, telemetria, Firestore Rules e mecanismos de backup permanecem sob os
mesmos serviços e hooks já validados.

## Abas principais

1. Visão Geral
   - resumo de setores;
   - sessões monitoradas;
   - estado da telemetria global;
   - pontos que exigem atenção;
   - atalhos para ações administrativas frequentes.

2. Setores
   - diretório de workspaces;
   - busca por UG, OM, setor, e-mail e workspace;
   - filtros por estado ativo/suspenso;
   - edição, suspensão/reativação, redefinição de senha e exclusão continuam no
     fluxo administrativo existente.

3. Cadastrar Setor
   - superfície dedicada de provisionamento;
   - identificação da OM;
   - UG;
   - Gmail operacional;
   - senha inicial;
   - perfil institucional;
   - o backend de provisionamento existente continua responsável por Firebase
     Auth, UID, workspace e vínculo da UG.

4. Consumo & Cotas
   - Visão consolidada;
   - Firebase global;
   - consumo estimado por UG;
   - alertas e limites;
   - métricas globais reais e estimativas por UG continuam fontes distintas.

5. Sessões
   - reutiliza o painel do Bloco 16.2;
   - preserva limite de sessões por UG;
   - mantém encerramento remoto e conta fundadora ilimitada.

6. Backup & Recuperação
   - saúde do backup lógico por UG;
   - integridade e data do último backup;
   - backup global das identidades Firebase Auth;
   - nenhum bypass administrativo é criado para dados operacionais de outra UG.

7. Segurança
   - visão dos controles de acesso e isolamento;
   - status de diretório e telemetria;
   - referência explícita a Firestore Rules, defesa de documentos e modelo
     fundador/setor;
   - não declara disponibilidade de serviços externos quando não existe
     telemetria própria para comprová-la.

## Persistência da navegação

A aba principal é refletida na query string:

- /admin
- /admin?tab=setores
- /admin?tab=novo-setor
- /admin?tab=consumo
- /admin?tab=sessoes
- /admin?tab=backups
- /admin?tab=seguranca

A query não contém dados sensíveis e não altera o contexto de autenticação.

## Compatibilidade

A reorganização preserva os hooks administrativos de diretório, sessões,
telemetria, alertas e backup; as APIs administrativas existentes; as Firestore
Rules; e o isolamento operacional por workspace/UG.

Os guards históricos dos Blocos 16.3, 16.4 e 16.5 passam a aceitar o novo
AdminConsumptionHub, mas continuam exigindo a existência dos painéis originais
e a separação entre telemetria global real e estimativa por UG.
