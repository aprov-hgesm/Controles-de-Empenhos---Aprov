# RC R1 — Warehouse integração funcional F05/F06/F09/performance

## Onde estamos
RC-base: PR #278 / `84af145bf22872c0a973dd3cd5f4954fcccc2f0d`. Nova branch de integração: `rc-r1-warehouse-full-integration-01`, isolada, sem merge. Fontes: F05 PR #270 HEAD `77312f69200f1ef75902e48a267d3ae9ba0389cb`; F09 PR #271 HEAD `de0285c656e92fc8743007863bd344acc0917e61`; performance PR #272 HEAD `16688e26cecbd3ecb6b1710c45b3dbbff463d56c`.

## O que fazemos
Transpor semanticamente **somente** os arquivos alterados pelas frentes F05, F09 e Performance. Preservar integralmente Rules PR #273 (blob `e4037e...`) e motor F06 PR #277 (blob `17bf8952...`). Scripts F05 + performance importados, nenhum dado real manipulado.

A suíte `.github/workflows/warehouse-rc-integration-emulator.yml` é independente e testa F05 e F09 **contra os arquivos de produção desta branch, sem overlay**. F06 mantém fixture original W6 por design e usa motor integrado, sem adaptadores para casos originais. Cache de barcode não é autoridade do saldo; workspaces/UID/UG separados e inválidos/TTL tratados.

## Gates
Exigir F05 REST; F06 9/9 originais + 8 adversariais; F09 Security; teste de performance real repository mock 8/8 e sintético 16/16; Core Protection; Application CI com guard Fase 8 preservado e etapa performance adicional. Todos no mesmo SHA após o último commit. Gate manual de Mobile/SaaS/Preview e latência faturada em Production fora do escopo.

## Riscos controlados
F05 modifica idempotência do replay e classifica falhas do upstream, não afirmar correção forense de incidente antigo sem RAW. F09 move validações de barcode/lote após replay já persistido; não relaxar Rules. Cache de barcode TTL 30 s, não cachear saldos; mudanças externas podem levar até TTL para atualizar UI, confirmação segue validação autoritativa.

## Governança
PR DRAFT; sem merge, deploy, publicação Rules, faturamento ou dados Production. Coordenador audita CI e emite GO/NO-GO técnico. Fundador mantém decisão GO/NO-GO produtiva.
