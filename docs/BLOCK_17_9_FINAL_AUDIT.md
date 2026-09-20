# Bloco 17.9 — Auditoria final

## Resultado pretendido

O ciclo 17 fecha eficiência e escalabilidade sem transferir complexidade técnica para o operador.

### Contrato de experiência

O Bloco 17 não adiciona:
- campos obrigatórios;
- confirmações obrigatórias;
- CAPTCHA;
- refresh manual;
- escolha técnica de cache/listener;
- conhecimento de Firestore ou App Check.

### Arquitetura final

- lease: 30 min; renovação nominal: 15 min;
- controle multiaba: sessão lógica compartilhada, proteção autônoma por aba e mutex curto apenas na renovação do lease;
- branding: asset/configuração estática ou uma leitura por sessão, sem listener realtime;
- Drive settings: uma leitura por contexto, sem listener permanente;
- classes: listener somente nas superfícies que dependem delas;
- Relatórios: sem listener global de NFs; histórico por empenho/CNPJ em consultas paginadas;
- telemetria: estimativas por UG separadas de métricas globais reais;
- App Check: cliente instrumentado para reCAPTCHA Enterprise; enforcement somente após observação real em produção;
- baseline 17.0 preservado para comparação.

Nenhum deploy de produção faz parte deste fechamento de repositório.
