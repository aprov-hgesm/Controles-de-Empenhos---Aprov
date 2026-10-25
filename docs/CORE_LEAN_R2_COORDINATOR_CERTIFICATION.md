# EMPROVEX CORE LEAN R2 — composição oficial (Coordenador)

**Escopo:** composição aditiva dos cinco Workers para certificação isolada. **Não autoriza merge, deploy, promoção, alteração de Firestore Rules, ativação de IDs fiscais v2 ou acesso a dados de produção.**

## Fontes e HEADs recebidos

- Base `main`: `afe163139089a1af8ffc81804464429d4d0f9528`
- W1 Warehouse #375: `afa0deba94905156a63bb636ae4ebcbb7452967d`
- W2 CI #372: `25ad486497aa4eb14dddf681a1f1643f8ce34f69`
- W3 Financeiro #373: `64bd70072def5b0898ffbe57d969476ab630ad37`
- W4 Assurance #374: `3f5a6440d92fa8a3a7784e9caf7e36f593a6fbd2`
- W5 Performance #377: `c1dc5d9f9457959cccf02171d84394a0d8066737`

## Método de composição

O tree de partida é a certificação experimental W1/W2/W3/W4/W5 no PR #380, commit `4f16b5f279d8501fc2ed98aa5281ddc953783d11`, com as correções de suites e do memorial Legal (sem trailing whitespace). Revisão exata dos blobs executáveis demonstrou equivalência aos HEADs finais de W2 e W5 para seus arquivos modificados posteriores. Esta composição adiciona o teste opcional de diagnóstico AuthZ Mobile e o memorial definitivo de W4 do seu último HEAD. O commit oficial é recriado com a `main` como pai único e não herda a história experimental.

O PR #370 de migração ampla AuthZ **não é integrado**: contém caminhos ainda não migrados e um conflito funcional na operação `WITHDRAWAL_FINALIZE_MOBILE` na fusão sintética; o teste independente provou negação segura 403, não autorização funcional. Não reduzir as Firestore Rules.

## Regra de certificação

Todos os PASS somente valem para o exato SHA onde foram executados. Em particular: no PR #380 original, W4 v1/v2/v3, W3 financeiro, W2 mutações, W5 transações/compatibilidade, Fast CI, Core, Recovery, Legal + Build passaram; **Application CI, Domain CI, Browser E2E e Warehouse Smoke foram SKIPPED**, não aprovados.

A branch oficial requer, sobre **seu próprio SHA**:

1. Fast CI, TypeScript, Core Protection, Recovery, Legal + Build PASS.
2. Domain CI nos seis domínios; nenhum `NOT_COMPOSED`, FAIL ou SKIPPED obrigatório.
3. Application CI integral e aliases de release requeridos PASS.
4. W4 independente v1/v2/v3, financeiro e testes negativos; W1 contrato/Emulator PASS.
5. W5 dados históricos, limites e transações reais v2/v3 no Emulator PASS.
6. Browser E2E / Warehouse Smoke aplicáveis executados e classificados; não afirmar PASS se skipped.
7. Revisar conflitos e limites (custo v3, AuthZ fora de escopo, NF v2 somente aditivo) e emitir GO/NO-GO formal.

## Custos e proteção

Benchmarks W5 em Emulator registraram v3 +4 RPCs por commit e maior latência de confirmação que v2 nos cenários comparáveis, mesmo número de writes e replay v3 mais rápido. Não confundir chamadas com reads faturáveis. Nunca remover auditoria de replay, verificação de ledger, mutex ou guardas transacionais para melhorar número de RPCs sem revalidação independente.

**Estado inicial:** NO-GO para merge/produção até execução dos gates oficiais neste HEAD. Integrar apenas código e testes; zero alterações à `main` e produção.
