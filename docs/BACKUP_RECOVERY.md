# EMPROVEX — Backup e Recuperação (BR-0 a BR-14)

## Objetivo

Esta frente cria uma camada de recuperação comercial simples para a fase inicial do EMPROVEX (até 50 usuários), sem duplicar PDFs e sem ampliar o acesso do administrador aos dados operacionais de outras UGs.

Princípio operacional:

> O backup do EMPROVEX deve ser simples o suficiente para ser compreendido e restaurado mesmo que a aplicação principal esteja indisponível.

Princípio de privacidade:

> O administrador da plataforma acompanha a saúde dos backups, mas não recebe bypass para ler os empenhos, notas fiscais ou demais dados operacionais de uma UG externa.

## BR-0 — Mapa de dados

### Dados operacionais protegidos por workspace/UG

| Fonte | Papel | Restaurado |
| --- | --- | --- |
| `workspaces/{id}/empenhos` | Empenhos, itens, fornecedores e metadados de documento | Sim |
| `workspaces/{id}/invoices` | Notas fiscais, comissão, tesouraria, NS e localização | Sim |
| `workspaces/{id}/comissoes` | Comissões mensais | Sim |
| `workspaces/{id}/cronogramas` | Planejamento/entregas | Sim |
| `workspaces/{id}/alerts` | Alertas operacionais | Sim |
| `settings/termoRecebimentoCounter` | Continuidade da numeração de TR | Sim |
| `settings/empenhoClasses` | Classes e regra de TR | Sim |

### Dados reconstruídos, e não restaurados literalmente

- `settings/sagNsLock_*`: reconstruídos a partir das NFs com NS durante a restauração.
- `revision`, `updatedAt` e `updatedBy` dos empenhos: normalizados para uma criação válida no ciclo de recuperação.
- `homeSnapshot`: cache derivado, reconstruído pelo runtime.

### Dados deliberadamente excluídos

- bytes de PDFs;
- `settings/documentStorage` (a conexão Drive é reestabelecida no workspace);
- `settings/backupLease`;
- `settings/empenhoDelete_*`;
- slots e revogações de sessão;
- telemetria de consumo;
- caches/snapshots derivados;
- tokens OAuth do Google;
- password hashes e salts do Firebase Auth.

Os metadados de PDFs já existentes nos registros podem permanecer no JSON; nenhum byte do arquivo é serializado. Os documentos originais continuam no Google Drive da própria conta do setor.

## BR-1 — Schema

Formato atual: `emprovex-workspace-backup`.

`schemaVersion: 1`.

O envelope possui:
- identidade do workspace e UG;
- data UTC;
- UID/e-mail que gerou;
- coleções;
- settings restauráveis;
- estatísticas;
- indicação explícita `pdfBytesIncluded: false`;
- SHA-256 do payload.

IDs de documentos são preservados.

## BR-2 — Exportação lógica

O exportador roda no cliente autenticado do próprio workspace, usando as mesmas Firestore Rules do uso normal. Não existe API administrativa para ler dados operacionais de outra UG.

## BR-3 — Compressão e integridade

O JSON é serializado de forma determinística, recebe SHA-256 e, quando o navegador oferece `CompressionStream`, é salvo como `.json.gz`.

Depois do upload, o arquivo é baixado novamente e validado antes de ser marcado como sucesso.

## BR-4 — Google Drive

Escopo permanece:

`https://www.googleapis.com/auth/drive.file`

Estrutura:

```text
EMPROVEX/
  Notas de Empenho/
  Notas Fiscais/
  Backups/
```

O Drive da UG recebe somente arquivos criados pelo EMPROVEX. Tokens continuam em memória e não são persistidos.

## BR-5 — Telemetria central

A coleção `workspaceBackupStatus` contém apenas:
- workspaceId;
- UG;
- e-mail operacional;
- data da tentativa/sucesso;
- fileId/nome;
- tamanho;
- contagem de registros;
- schema;
- SHA-256;
- gatilho;
- status/erro técnico.

O fundador pode listar esses metadados. Não há conteúdo de empenhos/NFs nessa coleção.

## BR-6 — Backup automático oportunístico

Quando:
1. o usuário está autenticado;
2. o Drive está conectado;
3. não existe backup bem-sucedido recente;

o EMPROVEX tenta um backup automático.

Intervalo-alvo: 24 horas.

Um lease curto de cinco minutos evita duplicações concorrentes.

Nenhum refresh token do Google é armazenado. Se ninguém usar a UG naquele dia, não há alterações novas produzidas pelo EMPROVEX e o backup acontecerá no próximo uso conectado.

## BR-7 — Retenção

São mantidos até 30 backups do workspace.

A ordem é:
1. gerar;
2. enviar;
3. reler e validar;
4. registrar sucesso;
5. remover excedentes antigos.

Um backup antigo nunca é removido antes da validação do novo.

## BR-8 — Administração

`/admin/backups` apresenta:
- UGs monitoradas;
- protegidas;
- exigindo atenção;
- último backup;
- quantidade de registros;
- tamanho;
- prefixo do checksum;
- erro técnico mais recente.

Não permite abrir o conteúdo de backups de UGs externas.

## BR-9 — Validação e simulação

Antes da restauração:
- descompacta;
- valida JSON;
- valida formato/schema;
- recalcula SHA-256;
- valida workspace;
- valida UG;
- compara IDs existentes;
- informa quantos seriam criados e quantos seriam preservados.

## BR-10 — Restauração segura

Modo inicial: **somente ausentes**.

Registros existentes nunca são sobrescritos.

Ordem:
1. empenhos;
2. NFs;
3. locks canônicos de NS (junto com a NF quando necessário);
4. comissões;
5. alertas;
6. cronogramas;
7. settings restauráveis.

Empenhos restaurados reiniciam o metadado técnico de concorrência em `revision: 1`, mantendo o conteúdo de negócio.

O contador de TR é criado em zero e depois elevado ao valor salvo, respeitando as Rules monotônicas.

## BR-11 — Firebase Auth e diretório global

O fundador possui um backup separado no próprio Drive:

```text
EMPROVEX - Recuperação/
  Firebase Auth/
```

Esse pacote contém:
- UID;
- e-mail;
- verificação;
- status disabled;
- nome/foto;
- providers;
- customAttributes;
- metadados de criação/login;
- workspaces;
- platformAccounts;
- índice de UG;
- settings globais.

Não contém `passwordHash` nem `passwordSalt`.

Consequência deliberada: após perda total do Firebase Auth, usuários de e-mail/senha precisarão redefinir senha. Os UIDs e vínculos necessários para reconstrução permanecem disponíveis.

## BR-12 — Controles de segurança

- endpoint de Auth é founder-only;
- autenticação server-side;
- no-store;
- rate limit best-effort;
- kill switch `EMPROVEX_DISABLE_AUTH_BACKUP=1`;
- Drive token somente em memória;
- restauração de workspace exige usuário autenticado daquela própria UG;
- checksum + simulação antes da restauração;
- restauração padrão não destrutiva;
- nenhuma regra concede ao fundador acesso operacional a tenant externo.

## BR-13 — Teste de desastre

`scripts/workspace-backup-disaster.test.mjs` roda contra Firebase Auth + Firestore Emulator.

O teste:
1. cria identidade e workspace isolados;
2. representa um conjunto de dados salvo externamente;
3. garante ambiente operacional vazio;
4. restaura empenho;
5. restaura NF com NS + lock na mesma operação;
6. restaura comissão;
7. restaura alerta;
8. restaura cronograma;
9. restaura contador;
10. restaura classes;
11. compara IDs e campos críticos, incluindo datas de comissão e tesouraria.

Esse teste não apaga produção.

## BR-14 — Evolução e guard

`scripts/verify-backup-recovery.mjs` protege o contrato arquitetural no CI.

Ao criar uma nova coleção operacional que precise sobreviver a desastre, o mapa `WORKSPACE_BACKUP_COLLECTIONS` deve ser revisado. O guard compara o conjunto restaurável com o contrato de baseline.

## Runbook de perda

### Perda apenas de dados de uma UG

1. usuário entra na UG;
2. conecta o Google Drive;
3. abre o painel do Drive;
4. seleciona um backup;
5. executa **Validar**;
6. confere a simulação;
7. executa **Restaurar registros ausentes**;
8. valida totais e fluxos.

### Perda global do Firestore

1. restaurar código, Rules e indexes a partir do GitHub;
2. usar o pacote fundador para reconstruir diretório de workspaces/contas/UG;
3. cada UG autentica e restaura seu backup operacional a partir do próprio Drive;
4. caches, telemetria e sessões são reconstruídos pelo uso normal.

### Perda do Firebase Auth

1. usar o pacote fundador como inventário autoritativo de UID/e-mail/provider;
2. reconstruir identidades preservando os UIDs;
3. usuários de senha redefinem a credencial;
4. validar vínculos com `platformAccounts`;
5. restaurar dados operacionais por UG se necessário.

## Limitações conscientes da v1

- backup depende de uma sessão Drive conectada;
- não há refresh token persistente para backup offline;
- não há cópia de PDFs;
- não há password hashes;
- restauração não sobrescreve registros existentes;
- restauração global de identidade continua sendo procedimento administrativo controlado, não um botão automático destrutivo.

Essas limitações são intencionais para manter a primeira versão comercial simples e segura para até 50 usuários.
