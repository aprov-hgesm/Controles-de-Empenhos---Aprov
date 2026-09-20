# Bloco 18 — Segurança e resiliência operacional

## Objetivo

O Bloco 18 endurece o EMPROVEX contra abuso, chamadas malformadas, repetição excessiva,
arquivos inválidos e regressões de segurança sem transferir burocracia para o operador.

Princípio:

> Segurança deve ficar no backend, nas Rules, nos headers, nos limites e nos testes sempre que possível.

Baseline: `main@004d3351332761117729015b087bffd0fb23fc87`.

## 18.0 — Baseline e threat model

O ciclo começa reconhecendo controles já existentes em vez de duplicá-los:

- Firebase Auth com modelo híbrido de provider;
- UID vinculado para setores externos;
- isolamento por workspace/UG nas Firestore Rules;
- duas sessões externas simultâneas por workspace;
- revogação administrativa e lifecycle fail-closed;
- provisionamento com locks e rollback;
- SAG/NS com transações, locks e idempotência de domínio;
- trilha de auditoria imutável;
- Google Drive com escopo `drive.file`, token somente em memória e SHA-256;
- App Check instrumentado no cliente para rollout progressivo.

## 18.1 — Hardening silencioso das APIs

As APIs administrativas founder-only usam uma camada comum em
`lib/server/requestSecurity.ts`.

Ela acrescenta:

- `X-Request-Id` para correlação;
- respostas `private, no-store`;
- leitura JSON limitada a 32 KiB;
- rejeição de Content-Type incorreto;
- rejeição de JSON malformado;
- rejeição de payload acima do limite real, mesmo quando Content-Length não é confiável.

Autenticação e autorização founder-only continuam sendo a autoridade. A camada 18 não
substitui Firebase Auth nem as Firestore Rules.

## 18.2 — Burst protection sem infraestrutura nova

Existe um limitador local de bursts para as rotas administrativas:

- pré-auth: 180 solicitações/minuto por chave de cliente;
- leitura autenticada: 120/minuto por UID/rota;
- mutação autenticada: 30/minuto por UID/rota.

O bucket é local ao processo e limitado em memória. Em serverless ele **não é descrito como rate limit distribuído**. Seu objetivo é conter loops, cliques repetidos e abuso
concentrado sem introduzir Redis, banco auxiliar ou custo operacional adicional.

A autenticação, as Rules e os contratos transacionais continuam sendo as proteções
autorativas.

## 18.3 — Idempotência e retry seletivos

O EMPROVEX não recebe uma camada genérica de idempotência ou retry automático.

Isso é deliberado:

- SAG/NS já possui idempotência transacional;
- provisionamento já possui locks por identidade, fases e rollback;
- concorrência de empenhos já usa revisão esperada/transação;
- lease de sessão já possui identidade e transações;
- mutações administrativas não recebem retry automático, evitando repetir efeitos
  destrutivos em falhas ambíguas.

Retries futuros devem ser adicionados somente para operações comprovadamente seguras
ou idempotentes.

## 18.4 — Defesa documental e malware

O fluxo do usuário permanece igual: selecionar um PDF.

A defesa é aplicada em camadas:

- máximo de 10 MiB;
- MIME PDF quando o arquivo vem do seletor;
- assinatura mágica `%PDF-`;
- sanitização do nome antes de enviar ao Drive;
- validação novamente na camada genérica do Google Drive;
- validação do arquivo também ao recuperá-lo;
- SHA-256 origem ↔ arquivo recuperado após upload;
- escopo Google Drive `drive.file`;
- tokens Drive somente em memória.

O Bloco 18 **não inventa um antivírus por heurística**. Não há bloqueio baseado em strings
como `/JavaScript` ou `/OpenAction`, pois isso poderia rejeitar PDFs legítimos sem
garantir detecção de malware.

Se o perfil de risco futuro justificar análise antimalware dedicada, ela deve ser feita
por um mecanismo próprio de scanning/quarentena, de forma assíncrona e observável.

## 18.5 — Headers defensivos do navegador

O Next.js agora aplica globalmente:

- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `Permissions-Policy` bloqueando câmera, microfone e geolocalização;
- `X-DNS-Prefetch-Control: off`;
- `X-Permitted-Cross-Domain-Policies: none`;
- remoção do header `X-Powered-By`.

CSP em modo enforcement não foi ativada neste bloco porque Firebase Auth, Google
Identity Services, Drive e visualização por blob URL precisam ser inventariados e
observados antes. O objetivo é não transformar hardening em indisponibilidade.

## 18.6 — Dependências e segredos

Dependabot passa a revisar semanalmente:

- dependências npm;
- GitHub Actions.

Nenhum segredo novo é adicionado ao repositório. Kill switches são variáveis booleanas
server-side e não carregam credenciais.

## 18.7 — Eventos e correlação de segurança

Rejeições relevantes geram evento estruturado `EMPROVEX_SECURITY_EVENT` contendo:

- tipo do evento;
- operação;
- requestId;
- somente metadados técnicos mínimos.

Tokens, senhas, payloads e conteúdo documental não entram nesse log.

## 18.8 — Kill switches

Mutações administrativas críticas podem ser suspensas no servidor sem alterar a UI:

- `EMPROVEX_DISABLE_ADMIN_MUTATIONS=1`;
- `EMPROVEX_DISABLE_SECTOR_PROVISIONING=1`;
- `EMPROVEX_DISABLE_SECTOR_DELETION=1`;
- `EMPROVEX_DISABLE_SECTOR_PASSWORD_RESET=1`.

Por padrão todas permanecem desligadas. Nenhuma operação é suspensa apenas por incluir
este código.

## 18.9 — Testes defensivos e guards

O CI verifica:

- presença da camada comum de segurança;
- limites de payload;
- burst guard e limitação de memória;
- kill switches;
- correlação por requestId;
- uso da proteção em todas as APIs administrativas;
- defesa PDF em profundidade;
- headers defensivos;
- manutenção da idempotência/concorrência já existentes;
- ausência de nova infraestrutura complexa para segurança.

Browser E2E e toda a suíte anterior continuam sendo gates obrigatórios.

## 18.10 — Contrato de experiência

O Bloco 18 adiciona:

- **0** campos obrigatórios;
- **0** confirmações;
- **0** CAPTCHAs;
- **0** reautenticações rotineiras;
- **0** passos extras para upload;
- **0** dependências Redis/SIEM/antivírus externo.

Nenhum deploy de produção faz parte deste ciclo de repositório.
