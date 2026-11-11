# W09 — Handoff e parecer técnico de integração R1

**Estado:** integração técnica em branch isolada; **NO-GO para produção, dados clínicos reais ou implantação hospitalar**.
**Base documental:** docs/cozinha-dietetica-memorial-oficial-20261111.
**Base imutável W0:** 4bcfee7730fc0da3177d9af8a81eabeb7f844abb.
**main lida antes da integração:** 34654f47004679b93b876ce98e459d8104752a76.
**Branch integradora:** integration/cozinha-dietetica-r1, PR Draft para main. HEAD final registrado no GitHub/PR.

## Código efetivamente integrado

Os blobs foram importados por SHA e caminho para a branch própria, **sem merge de PRs de Worker**, sem modificar base das PRs, main, serviços produtivos ou Firestore. Não houve sobreposição de arquivo entre os oito diffs:

| Worker | PR Draft | SHA efetivamente importado | Objetivo |
| --- | --- | --- | --- |
| W0 | #540 | 4bcfee7730fc0da3177d9af8a81eabeb7f844abb | Fundação, identidade e SQLite QA |
| W1 | #542 | a1efb94d810526d98b4f535e4938c39925180db4 | Portal e entrada modular |
| W2 | #541 | d98641c7fea1307cb1d2476c313e2ee20aee81c3 | Pacientes e leitos |
| W3 | #544 | 78dfc1119a70e4b363def1dcc2b66435b7d41c84 | Referências médicas, dietas e mapas |
| W4 | #545 | d0d539df339d31e18b840b38dd7b651dffc3e5fb | Fila da cozinha e produção |
| W5 | #543 | ba9ff52c1a5788f5d33a1f574d0eee6f9eb42277 | Distribuição e etiquetas |
| W6 | #548 | d84ab4670643f64be1ebfd80855d0c69cae7b248 | Nutrição auditora |
| W7 | #546 | fb6f0f88c58d50441908f424c4f65f677374104d | Administração do hospital |
| W8 | #547 | 5f2b6fa292053555c9f707474b9c0344ad153d56 | Relatórios e exportações |

**76 arquivos** distintos trazidos de W1–W8 além do commit-base W0. A migração documental dos prompts não é incluída na árvore de execução; continuam disponíveis na branch documental indicada.

### Contribuição específica W09

- Shell em /cozinha-dietetica/app com login Firebase W1 reaproveitado, leitura de membership no **servidor W0**, verificação de UID/OM/UG/unidades/papéis, estados de sessão e saída. Não confiar apenas na navegação para autorização.
- Unidade: Início, Pacientes W2, Dietas W3, Meus Mapas W3 e Acompanhamento W3 (map.list/map.get/recibo realmente obtidos das APIs).
- Cozinha: Painel, Produção W4, Distribuição W5 com IDs de refeições obtidos do **snapshot verdadeiro W4**, Ocorrências e Relatórios W8.
- Nutrição: auditoria, dietas, inconformidades, comunicação médica e relatórios nas abas reais do W6. Ela não homologa mapas de rotina.
- Administração hospitalar: área W7, sem privilégio de ler dados clínicos nominais por ser gestor; nenhuma permissão comercial se converte em papel hospitalar.
- Ajustes transversais estritos: W1 autoriza redirecionamento de gestor hospitalar com role validada para **somente sua área W7**; W8 aceita o filtro de visão inicial para abrir Ocorrências.
- Testes W09 em tests/hospital/e2e: navegação por papel, transações de mapa→lote→etiqueta/conferência→expedição→recibo→entrega, relatório, dupla OM, unidade alheia, jejum após preparo, deadline de cada ciclo, recusa de entrega duplicada.

### QA e limites atuais

**Não existe backend clínico autorizado para produção.** W0 é um SQLite em arquivo temporário/memória, destinado apenas ao laboratório. Requer validação/habilitação real do Firebase Admin com checagem de revogação, políticas IAM, datastore clínico dedicado, homologação LGPD, protocolos institucionais, decisões sobre identificação positiva, avaliação de contingência e piloto formal.

Para uma sessão **exclusivamente local, sintética e consentida**, os endpoints W1–W8 precisam de variáveis de ambiente coerentes apontando **para o mesmo arquivo SQLite QA em os.tmpdir()**:

- HOSPITAL_QA_ORGANIZATION_ID=<id sintético autorizado>
- HOSPITAL_QA_SQLITE_PATH=<mesmo arquivo temporário QA>
- HOSPITAL_QA_APP_READY=1
- HOSPITAL_PATIENTS_QA_ENABLED=1
- HOSPITAL_PATIENTS_QA_DB_PATH=<mesmo arquivo temporário QA>
- HOSPITAL_W3_QA_ENABLED=true
- HOSPITAL_W3_QA_SQLITE_PATH=<mesmo arquivo temporário QA>
- HOSPITAL_QA_DB_PATH=<mesmo arquivo temporário QA>
- HOSPITAL_QA_DISTRIBUTION_ENABLED=1
- HOSPITAL_QA_ADMIN_ENABLED=1
- HOSPITAL_QA_REPORTING_ENABLED=true

Essas flags **não devem ser definidas em Cloud Run de produção**. Nenhum teste W09 cadastra pacientes reais nem publica credenciais.

### Gates e evidências

A workflow **Hospital W09 - Integration QA** roda em GitHub Actions com Node 24, npm ci, npm run typecheck, npm run build, testes reais W0–W9, verificação do núcleo e regressões selecionadas (rotas, depósito, faturamento, NF). Resultados devem ser lidos **na execução do GitHub Actions**; nenhum passo pendente é declarado PASS.

| Gate | Situação |
| --- | --- |
| Integração de arquivos e commits | Executada, SHA dos componentes conferidos |
| Shell e adaptação de serviços existentes | Implementados na branch W09, dependentes dos testes de CI |
| Typecheck / build | Aferir no GitHub Actions; não presumir êxito |
| Testes funcionais, E2E, segurança, regressões | Aferir no GitHub Actions; não presumir êxito |
| Teste visual em dispositivo móvel real | Pendente; não há dispositivo/QA homologado aqui |
| Firebase Admin com token real e revogação | Pendente bootstrap e validação de serviço |
| Datastore institucional isolado, IAM e LGPD | Pendente decisão institucional, sem produção |
| Continuidade em falha de rede em hora crítica | Plano/infra de contingência hospitalar pendentes |
| Autorização para operar dados clínicos reais | NÃO AUTORIZADO |

### Riscos e rollback

- Não promover para produção. O rollback de futura publicação deverá manter as rotas antigas de Aprovisionamento/Almoxarifado e permitir desligar o módulo hospitalar pela política central. Alterações clínicas jamais são revertidas apagando trilhas; registrar correções compensatórias com autoria e horário real.
- Em indisponibilidade de mapa/serviço, a contingência deve ser **procedimento institucional externo** com documentação real, reentrada posteriormente auditável (horário efetivo declarado separado de horário de registro). Não forjar timestamps nem pressupor entrega.
- Monitorar erros de API e duração de operações apenas com IDs técnicos minimizados; nunca incluir paciente, leito, prescrição ou dieta identificável em logs, screenshots ou URLs públicas.
- Só declarar **GO para integração técnica** quando gates funcionais e regressões passarem sem falhas; até lá o status técnico é **condicional**. O parecer institucional é sempre **NO-GO** até autorização formal.

**Sem merge, sem deploy, sem alteração de banco, regras ou identidades em produção.**
