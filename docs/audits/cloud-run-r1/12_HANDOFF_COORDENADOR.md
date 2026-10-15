# HANDOFF — Worker 1 CLOUD-RUN-R1
**Data:** 2026-10-15. **Veredicto:** AUDITORIA DOCUMENTAL PARCIAL — EVIDÊNCIAS EXTERNAS PENDENTES; MIGRAÇÃO BLOQUEADA. Este PR não contém código, deploy, DNS ou credenciais.

## ONDE ESTAMOS
EMPROVEX publicado na Vercel com domínio emprovex.com.br conforme Memorial Oficial vigente; main investigada no SHA 2b1241fe3abd96c67766caf065d24a4b2a223b98. Next 15.5.24/React 19, output standalone; Firebase Auth e dois bancos Firestore nomeados. Manual deploy Vercel D-127 preservado.

## O QUE ESTAMOS FAZENDO
Inventário completo de árvore Git: 893 arquivos; inspeção focal de stack, auth, CRM/Empenhos, módulos de warehouse, Drive, server admin, cron, workflows e runbooks de recuperação. Criados 12 relatórios nesta branch de documentação com matriz de impacto funcional e critérios de GO/NO-GO. Conferida documentação oficial atual de Cloud Run, Hosting, IAM, Scheduler e preços. **Não foram realizados** testes local/build, smoke real, cópias de banco, acesso a Vercel/GCP/Firebase, criação de serviços ou qualquer mudança em produção.

## QUEM ESTÁ FAZENDO
Worker 1: evidências documentais; Coordenador: integração/decisões; administradores da conta proprietária: IAM/DNS/billing/OAuth/Vercel; Foundador: aprovação; worker backend: ADC/F05-F09; QA: E2E e recovery.

## O QUE FAZER A SEGUIR (prioridade)
P0 obter X01–X08 e X11 de 11_LACUNAS_E_VERIFICACOES_EXTERNAS.md, verificar backup nativo warehouse e Core, IAM dos bancos e identidade runtime. P0 criar plano e teste futuro de ADC sem chave JSON para fast-path/admin/monitoring. P0 isolar totalmente homologação da produção. P1 escolher Firebase Hosting vs LB medindo limite 60 segundos e região/custo. P1 planejar cron exclusivo Cloud Scheduler, OAuth/authDomain e proxies trusted. P1 desenvolver contêiner somente em branch futura autorizada após desenho. P1 executar suites comparativas e rollback antes de trocar domínio.

## QUEM O FARÁ
Admin Vercel/GCP/Firebase: dados externos e permissão mínima; Worker Backend/Auth: futura adaptação ADC; Infra/CI: container+WIF após autorização; QA: Emulator+browser+recovery; Coordenador: gates e release; Fundador: aceite.

## Painel de auditoria
- Branch: audit/cloud-run-r1-full-compatibility.
- Base HEAD: 2b1241fe3abd96c67766caf065d24a4b2a223b98.
- Documentos: 01 a 12 em docs/audits/cloud-run-r1/.
- Dependências Vercel mapeadas: 14 entradas V01–V14 (categorias auditadas, não exaustividade garantida).
- Riscos mapeados: 18 (4 BLOCKER; 2 CRÍTICO; 6 ALTO; 5 MÉDIO; 1 INFORMATIVO); todos pendentes.
- Lacunas externas: 16 (X01–X16); nenhuma certificada.
- Gates de liberação: 16 G01–G16; todos pendentes.
- Fonte oficial principal: https://docs.cloud.google.com/run/docs/securing/service-identity e https://firebase.google.com/docs/hosting/cloud-run.
- Próxima decisão: não publicar, não provisionar, não modificar banco; design detalhado condicionado a acesso de leitura e aceite do Coordenador.

Não confundir a conclusão de um dossiê documental com prova da viabilidade operacional plena. Manter Vercel intacta.
