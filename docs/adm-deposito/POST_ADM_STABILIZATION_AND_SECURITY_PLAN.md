# Sequência pós-ADM — estabilização, melhorias e hardening de segurança

Data da decisão: 2026-09-25.

## Contexto

No momento desta decisão, o EMPROVEX possui apenas um usuário externo em operação e o foco prioritário permanece a conclusão do ADM Depósito.

A auditoria preventiva de segurança realizada antes desta decisão não identificou evidência de vazamento ativo de dados nem exposição pública intencional das coleções operacionais. Foram identificadas oportunidades de hardening preventivo que serão tratadas em etapa própria após a consolidação funcional do ADM, salvo surgimento de vulnerabilidade crítica/ativamente explorável.

## Ordem oficial de prioridade

### Etapa A — concluir o ADM Depósito

Prioridade imediata.

Objetivos:
- concluir a implementação planejada do ADM Depósito;
- finalizar o Módulo 14 e o fechamento técnico/documental correspondente;
- não expandir escopo desnecessariamente durante essa conclusão;
- preservar founder-only do piloto enquanto o módulo ainda estiver em estabilização.

### Etapa B — bateria dedicada de testes e melhoria do ADM Depósito

Começa após a conclusão funcional/técnica do ADM.

Objetivos:
- usar o módulo em cenário real;
- executar regressões adicionais e E2E específicos do ADM;
- revisar usabilidade dos fluxos de estoque, saída, inventário, SISCOFIS, croqui, relatórios, alertas e entregas;
- corrigir bugs encontrados no uso;
- melhorar performance, consumo Firestore, legibilidade e ergonomia;
- validar comportamento em máquinas mais antigas;
- revisar fluxos de barcode e operação rápida;
- consolidar as melhorias antes de qualquer expansão relevante para usuários externos.

Esta etapa é de estabilização e refinamento. Não deve reabrir contratos já consolidados sem evidência concreta de necessidade.

### Etapa C — hardening de segurança de dados da plataforma

Começa após a bateria de testes/melhorias do ADM, com foco transversal no EMPROVEX.

Backlog inicial originado da auditoria preventiva:
- atualizar dependências de segurança, com prioridade para Next.js e jsPDF conforme versões seguras disponíveis e regressão correspondente;
- adicionar Content Security Policy compatível com Firebase, Google Identity/Drive e recursos legítimos do EMPROVEX;
- confirmar e endurecer Firebase App Check, com rollout observado antes de enforcement;
- revisar persistência de sessão em computadores compartilhados;
- revisar política de senha dos setores externos;
- estudar migração de credencial administrativa persistente para Vercel OIDC + Google Workload Identity Federation e privilégio mínimo;
- revisar exposição deliberada de `settings/global` e preferir configuração pública explicitamente isolada/estática;
- reforçar tratamento de PDFs enviados por usuários;
- atualizar `security_spec.md` para refletir a arquitetura atual multi-tenant por workspace/UG/UID/provider;
- ampliar automação de segurança de dependências e análise estática;
- executar nova auditoria de Rules, APIs, segredos, logs, IAM e isolamento antes de ampliar significativamente a base externa.

## Regra de exceção de segurança

A priorização acima não significa adiar uma vulnerabilidade crítica conhecida.

Se durante as Etapas A ou B surgir:
- vazamento de dados confirmado;
- bypass de autenticação/autorização;
- acesso cross-tenant;
- segredo administrativo exposto;
- vulnerabilidade crítica aplicável ao runtime em produção;
- comprometimento de conta ou infraestrutura;

o hardening correspondente passa a ser bloqueante e deve ser tratado imediatamente, antes de continuar o desenvolvimento funcional.

Achados preventivos sem evidência de exploração permanecem no backlog da Etapa C.

## Relação com o Módulo 14

O Módulo 14 continua sendo a campanha final de validação e fechamento do ciclo atual do ADM Depósito.

Ele não é substituído por este plano.

A sequência passa a ser:

`concluir ADM / Módulo 14 → estabilização e melhorias ADM → hardening de segurança de dados da plataforma`

O Módulo 14 mantém:
- PowerShell como ambiente principal da campanha local;
- Core Protection;
- guards;
- testes de domínio;
- TypeScript;
- Firestore Emulator/multitenancy;
- walking skeleton;
- build;
- Browser E2E específico do ADM;
- regressão EMPROVEX/ADM;
- PR/Application CI quando aprovado.

A Etapa B pode adicionar uma segunda rodada de testes e refinamento com base no uso real, sem confundir essa estabilização posterior com o gate formal do Módulo 14.

## Expansão externa

O sucesso técnico do ADM não autoriza expansão ampla automaticamente.

Durante as Etapas A e B:
- manter expansão externa conservadora;
- usar o baixo número de usuários externos como oportunidade para estabilização controlada;
- qualquer aumento significativo da base deve considerar o estado da Etapa C de segurança.

## Estado

- Etapa A: **EM ANDAMENTO**;
- Etapa B: **PLANEJADA**;
- Etapa C: **PLANEJADA**;
- segurança crítica: **sempre bloqueante quando confirmada**.
