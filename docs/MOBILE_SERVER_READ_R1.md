# MOBILE SERVER READ R1 — Primeira migração real do Operador Móvel

Base: f2650df5 (R368). Estado: branch de validação, SEM deploy de Rules, aplicação ou produção.

## Mudanças
- Seis telas do Operador Móvel deixam de consultar barcodeRepository via Firestore SDK.
- API POST /api/central-depositos/mobile-barcode autentica token e associa workspace/UG à sessão.
- A leitura no banco Warehouse é executada por IAM e o identificador de documento é derivado do código normalizado pelo próprio servidor.
- Retorno nulo significa código inexistente; falha de acesso/servidor é erro, jamais código livre.
- warehouseAdminBatchRead é reutilizável para próximas leituras, com escopo fechado, até 30 documentos e detecção de resposta incompleta.
- Nenhuma alteração nos motores de estoque, Firestore Rules, IAM, deploy, dados, main ou produção.

## A certificar antes de merge
1. Typecheck, build, Application CI, Core Protection e security guards.
2. Emulator: usuário sem token, workspace incorreto, UG alheia, documento ausente, associação ativa e inativa, falha IAM sem fallback.
3. Smoketest autenticado dos seis fluxos, em Preview/localhost isolado.
4. Medir latência e total de reads por scanner antes/depois. Migração para API não garante economia sozinha.

## Próximas migrações
Resolver de posições, saldos, lotes, materiais, sessões de inventário, consultas 3D e relatórios.
Somente após zerar dependências de leitura SDK considerar negar get/list na rules do Warehouse.
Preservar sempre allow create/update/delete: false para clientes. O banco principal não entra nesse corte.

firebase.json aponta para firestore.warehouse.server-only.rules, mas isso não prova qual ruleset está ativo no Firebase de produção.

## Piloto Motor de Confiança (escopo: somente Operador Móvel)

- `bindWarehouseMobileTrust`: policy fail-closed isolada, acionada DEPOIS de `verifyWarehouseRequest` sem nova autenticação ou consulta ao Firestore.
- Primeira operação liberada: `BARCODE_READ`. Escopo e UG vêm apenas do token já validado no servidor. As demais operações seguem os motores atuais até migração controlada.
- Uma solicitação com workspace divergente, identidade incompleta, UG inválida ou ação não autorizada é negada.
- `scripts/mobile-server-barcode-read.test.mjs` executa o motor de verdade com casos positivos/negativos; `verify-mobile-r1-intake-allocation.mjs` atualizado para exigir o novo contrato.
- Verificação mínima de Rules em teste: manter negação total de escritas SDK e isolamento de leitura; não usar leitura adicional no Firestore a cada operação para demonstrar confiança.
- Necessário Emulator de segurança e prova comportamental autenticada antes do merge. Não declarar piloto aprovado apenas por testes de contrato.

## Expansão das oito jornadas — motor compartilhado

- Gate de confiança aplicado às chamadas logísticas de alocação, entrada avulsa, transferência, retirada e inventário. A autorização original continua na mesma sessão Firebase; revalidações transacionais dos motores canônicos mantidas.
- Gateway `/api/central-depositos/mobile-read`: consultas somente de domínios e filtros enumerados, identidade validada no servidor, workspace fixado no token e comparação UG/workspace em cada documento retornado.
- Bridge de leitura (`mobileReadSdkBridge.ts`) substitui getDoc/getDocs no Operador Móvel por chamadas à API, sem fallback para SDK. Os repositórios do desktop não são modificados.
- Leituras físicas, material, localização, saldo, lote, inventário e destinos migradas nos adaptadores móveis. Leitura de NF continua na API Warehouse existente.
- Nenhuma Security Rule ou IAM foram alterados. O desktop ainda pode depender de acesso direto ao Firestore.
- A bridge não deve ser interpretada como economia garantida de operações faturadas. É necessário medir custos e latência nos oito fluxos antes da publicação.
- Toda falha da API, IAM, dados inconsistentes, tenant/UG divergentes é fail-closed — não executar fallback cliente.

## Condições de release

* Exigir CI, testes de Emulator de API (identidades permitidas e negadas), estoque e inventário, e inspeção real no celular antes de merge/deploy.
* A migração de leituras funciona com Rules legadas preservadas; não aplicar rules deny-all do banco Warehouse até o desktop estar migrado.
