# WAREHOUSE — RC F05/F06/F09 COMPOSIÇÃO CONTROLADA (2026-10-09)

## Onde estamos
Branch de integração: `rc-r1-warehouse-f06-f09-composition-01`.
Base exata do RC: `fae9ce6aed7242e85d53fc8e6470fba4425a8c27` (PR #262, DRAFT, sem merge).
Origem de Rules candidatas: PR #273 `4973fa876a08bb7329a9c9b83565d876c379404c`; blob `e4037e464ddbeed7629076dc7615266f0caafc7c`.
Origem do motor e testes: PR #277 `147b00f5b30fab407951035cb85e655cd16be339`; F06 original 9/9 e oito adversariais PASS no Emulator; F05/F09 PASS; Core e Application CI SUCCESS no HEAD de origem.

## O que estamos fazendo
Composição **sem merge** e com sobreposição direcionada de dois artefatos produtivos sobre o RC:
1. `firestore.warehouse.rules`: conteúdo exato aprovado em PR #273.
2. `lib/warehouse/locationRepository.ts`: conteúdo exato aprovado em PR #277.
Adicionados somente fixture, worker de testes e workflow da certificação do PR #277 para a branch RC. Workflows experimentais inseguros de isolamento do PR #273 **NÃO foram copiados**. Nenhuma alteração na produção.

## Atenção técnica
A Rules candidata (PR #273) não elimina necessariamente toda ocorrência de limite de 1.000 expressões; F06 possui reconciliação condicional fail-closed. O teste do RC deve usar os arquivos de aplicação sobrepostos efetivamente presentes e a fixture W6 fixada. A F05/F09 no workflow possuem overlay pinado **apenas para testar aqueles contratos**; não significa que todo código produtivo do PR #270/#271 esteja integrado a este RC. Esses PRs devem ser reconciliados separadamente antes do GO global.

## Riscos e limites
Sem medição de cobrança real Firestore, latência p50/p95, retries e carga em dispositivos reais. O onboarding completo dos setores permanece dependente de smoke humano de Preview. Avaliar compatibilidade com MOBILE-K, regras de estados físicos e proteção de outros módulos. Não equiparar CI verde a GO.

## Governança
Esta branch não autoriza merge em main, publicação de Firestore Rules, Vercel Production, alteração de dados reais ou promoção de RC. Manter PR DRAFT, repetir gates no HEAD composto. Fundador detém autoridade final. Coordenador faz auditoria e propõe GO/NO-GO.

## O que fazer a seguir e quem fará
Coordenador: conferir diff, Rules blob, SHA, CI/Emulator e interações com SaaS/Mobile; classificar RC GO/NO-GO. Workers 5–8: standby. Fundador: qualquer autorização produtiva posterior.
