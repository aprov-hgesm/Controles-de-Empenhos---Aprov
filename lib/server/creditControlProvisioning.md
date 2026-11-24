# Controle de Crédito R1 — provisionamento e contrato administrativo

Procedimento restrito ao proprietário/administrador autorizado da infraestrutura, após homologação. Nenhum provisionamento foi realizado pelo Worker 02.

1. No Firebase Authentication do projeto gen-lang-client-0982077967, confirmar a identidade previamente criada, UID exato, e-mail verificado e conta não desabilitada. Confirmar autorização institucional para atuar como gestor da UG financeira de seis dígitos.
2. Com a identidade administrativa já autorizada, na instância Firestore **emprovex-credito** (nunca no banco default ou operacional), criar explicitamente o documento creditControlMembers/{uid}, usando ID igual ao UID, campos uid e email (string; email normalizado em minúsculas), ug (string de seis dígitos), role (string gestor), centerId (null), active (boolean true). Conferir ausência de registro anterior; não sobrescrever outro vínculo nem mudar UG/role automaticamente. Para novos gestores ou troca de UG, repetir somente por autorização explícita do proprietário e revisão do vínculo anterior. Para revogar, ajustar active=false sem apagar o histórico. Registrar decisão no procedimento institucional existente.
3. Somente após homologação, gate técnico EMPROVEX_CREDIT_CONTROL_ENABLED=1 e login com a identidade autorizada. A aplicação não cria usuários Firebase, não envia convites, não concede acesso por login, nem altera claims, assinaturas ou credenciais globais. Revogar membro no banco dedicado não encerra outros módulos.

## Integração UI/API (Worker 04/06)

Uma única instância de useCreditSession() na página; renderizar <CreditLogin session={session}/> quando não autorizado. Usar session.member, session.user, session.loading, session.error, session.retry() e session.signOut(). No cabeçalho autorizado, informar que sair encerra a sessão Firebase compartilhada. GET /sessao é o endpoint de sessão; GET /importacao continua compatível.

GET /administracao retorna centers e, somente para gestor, members. Resposta de gestor limitada a 100 centros e 100 membros por consulta, com truncated=true quando houver mais. Não usar a listagem como prova de ausência de vínculo. POST /administracao aceita exclusivamente:
- {action:"saveCenter",id,name,active} (id estável, 1–64 caracteres ASCII alfanuméricos, hífen ou sublinhado; active boolean).
- {action:"saveCenter",initializeDefaults:true} (somente UG 160416, explícito, idempotente, não sobrescreve centros existentes).
- {action:"saveMember",uid,email,centerId} (perfil centro obrigatório, UG derivada da sessão; exige conta Firebase já existente, ativa e e-mail verificado; reativação explícita permitida).
- {action:"revokeMember",uid} (somente centro da própria UG; desativa o vínculo sem apagar dados).
Inativar centro impede sessões dos seus membros e novos vínculos; histórico financeiro permanece intacto. Reativação do centro restaura elegibilidade dos membros ainda ativos. Alterações concorrentes usam transação, precondições e erro 409; atualizar a listagem após mutação. Não enviar role ou ug no corpo.

O serviço reutiliza o token administrativo existente. Homologar permissão accounts:lookup da identidade runtime e confirmar que nenhuma permissão adicional é necessária; em caso de erro a concessão falha fechada. Nenhuma alteração IAM é efetuada nesta entrega.
