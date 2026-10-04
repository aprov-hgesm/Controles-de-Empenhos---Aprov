# MOBILE-A — HANDOFF DE CORREÇÃO

## Identidade

- **Branch:** `mobile-r1-a-platform-scanner`
- **HEAD de código corrigido:** `5b02b16e9aea03e368c389200141c09be8dcc8b8`
- **HEAD anterior devolvido:** `6abc35c60e5b0674f0e034b6da1476936345e41f`
- **Base original:** `53e28b81874ee1b7ce0bd484cc7a97537aa99473`
- **PR:** #221 — draft, não mergeado
- **Status:** **PARCIAL**

A correção de código solicitada pelo Coordenador foi concluída. A frente não é marcada como `APTO PARA REVISÃO` porque ainda faltam duas evidências externas exigidas pelo prompt corretivo: leitura objetiva do header HTTP efetivo do preview e um run verde do workflow SAAS-DL Legal Validation. O primeiro ficou inacessível pelas ferramentas desta sessão; o segundo falhou somente no próprio passo de Diff Hygiene por `no merge base`, enquanto todos os passos funcionais do workflow passaram.

## Correção 1 — Permissions-Policy

### Alteração

Em `next.config.ts`:

Antes:

```text
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Depois:

```text
Permissions-Policy: camera=(self), microphone=(), geolocation=()
```

A alteração é mínima:

- câmera permitida apenas para a própria origem;
- microfone continua bloqueado;
- geolocalização continua bloqueada;
- `X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options` e demais headers permanecem inalterados.

### Header efetivo

**Não observado diretamente nesta sessão.**

Evidências disponíveis:

- o Vercel Preview do HEAD corrigido ficou **Ready / SUCCESS**;
- URL de preview publicada pelo bot Vercel:
  `https://controles-de-empenhos-aprov-git-mo-35f854-aprov-hgesms-projects.vercel.app`;
- Production Build do novo HEAD passou tanto no Application CI quanto no workflow Legal Validation.

Tentativas de leitura HTTP real:

1. conector Vercel disponível nesta sessão:
   - tentativa de acessar deployment `E4gRPqGCnrEvPZtoGvLdKtJXDskQ`;
   - resposta: **403 Forbidden / Not authorized** para o scope `aprov-hgesms-projects`;
2. fetch direto do preview pelas ferramentas web:
   - preview não acessível por essa ferramenta;
3. `curl` no ambiente de execução:
   - ambiente sem resolução DNS externa para o host Vercel.

Portanto, não é feita alegação de que o header HTTP real foi lido. A confirmação ainda necessária é:

```text
Permissions-Policy: camera=(self), microphone=(), geolocation=()
```

na resposta de `/central-mobile`.

## Correção 2 — React Strict Mode

### Alteração

O lifecycle do `WarehouseMobileScanner` passou a marcar explicitamente o componente como montado no setup:

```ts
useEffect(() => {
  mountedRef.current = true;

  return () => {
    mountedRef.current = false;
    stopRef.current?.();
    stopRef.current = null;
  };
}, []);
```

Isso preserva:

- setup → `mountedRef.current = true`;
- cleanup → `mountedRef.current = false`;
- encerramento do stream/câmera;
- anulação de `stopRef`;
- ausência de stream duplicado;
- proteção contra update após unmount.

O fluxo fica resiliente ao ciclo de desenvolvimento do React Strict Mode:

```text
setup → cleanup → setup
```

## Proteção contra regressão

`scripts/verify-mobile-r1-platform-scanner.mjs` foi ampliado para proteger os dois contratos.

### Permissions-Policy

O verifier exige:

- `reactStrictMode: true`;
- `camera=(self), microphone=(), geolocation=()`;
- ausência de `camera=()`.

### Strict Mode lifecycle

O verifier checa semanticamente a ordem:

1. início do effect;
2. `mountedRef.current = true`;
3. `mountedRef.current = false`;
4. `stopRef.current?.()`;
5. `stopRef.current = null`;
6. fechamento do mesmo effect sem dependências.

Auditoria equivalente executada diretamente sobre os arquivos reais do HEAD no GitHub:

**44/44 checks PASS**.

## Arquivos alterados nesta correção

- `next.config.ts`;
- `features/warehouse/mobile/WarehouseMobileScanner.tsx`;
- `scripts/verify-mobile-r1-platform-scanner.mjs`;
- `docs/CENTRAL_MOBILE_R1_A_HANDOFF.md` — somente documentação deste handoff.

Não foram alterados:

- MOBILE-B;
- labels/PDF;
- resolver de localização;
- ledger;
- saldo;
- intake;
- outbound;
- inventory;
- Rules;
- billing;
- lifecycle comercial;
- legal acceptance;
- autenticação;
- modelos canônicos.

## Contratos preservados

Permanecem intactos:

- rota `/central-mobile`;
- `WarehouseMobileScanner`;
- `PRODUCT | LOCATION | UNKNOWN`;
- estados `EXPECT_*`;
- cooldown de 900 ms;
- fallback manual;
- feedback visual;
- som/vibração opcionais;
- lazy import do decoder;
- ZXing;
- teardown;
- shell móvel;
- isolamento do bundle desktop;
- Auth/workspace/UG/sessão/legal;
- classificação `UNKNOWN` sem resolver;
- ausência de escrita em saldo/ledger.

## Testes

### `npm run test:mobile-r1-scanner`

Executado em ambiente isolado com o script e o domínio atuais da branch.

Resultado:

```text
tests 6
pass 6
fail 0
```

**PASS — 6/6**

### `npm run verify:mobile-r1-platform-scanner`

O checkout completo não pôde ser materializado neste ambiente porque a execução local não possui resolução DNS para `github.com`.

Como evidência alternativa, a mesma lógica do verifier foi executada diretamente contra os arquivos reais do HEAD recuperados pelo conector GitHub.

Resultado:

**44/44 checks PASS**

Não é alegado que o comando npm completo foi executado sobre um checkout integral.

### `npm run typecheck`

Application CI #916 — **PASS**.

O passo **Final TypeScript validation** terminou com sucesso.

### `npm run build`

Application CI #916 — **PASS**.

Next.js 15.5.24:

- compilação otimizada: **26,0 s**;
- páginas estáticas: **29/29**.

O workflow SAAS-DL Legal Validation #27 também chegou ao Production Build e o build passou.

### `npm run verify:emprovex-core-protection`

- EMPROVEX Core Protection #203 — **SUCCESS**;
- Application CI #916 — passo de Core Protection **PASS**;
- Legal Validation #27 — passo de Core Protection **PASS**.

### `git diff --check`

Application CI #916 — **PASS**.

Esse workflow usa checkout com `fetch-depth: 0` e validou corretamente o diff contra a integradora.

## Workflows

- **Application CI #916:** **SUCCESS**
- **EMPROVEX Core Protection #203:** **SUCCESS**
- **Recovery #602:** **SUCCESS**
- **SAAS-DL Legal Validation #27:** **FAILURE — infraestrutura de Diff Hygiene**

Detalhe do Legal Validation #27:

Todos os passos anteriores ao Diff Hygiene passaram:

- instalação;
- TypeScript;
- páginas públicas/legal;
- aceite legal versionado;
- testes Firestore de aceite;
- Core Protection;
- Production Build.

A falha ocorreu apenas em:

```text
git fetch origin "feat/central-mobile-r1" --depth=1
git diff --check "origin/feat/central-mobile-r1...HEAD"

fatal: origin/feat/central-mobile-r1...HEAD: no merge base
```

Durante esse run, a integradora havia sofrido force-update. O workflow Legal usa fetch raso; a worker permanece intencionalmente na base congelada original e não foi rebaseada/mergeada, conforme instrução do Coordenador.

O Application CI #916, que usa `fetch-depth: 0`, encontrou o merge-base e concluiu o **Diff Hygiene com SUCCESS**.

## Gates não executados / não concluídos

- leitura direta do header HTTP efetivo de `/central-mobile`: **não concluída por falta de acesso ao scope Vercel e DNS externo no ambiente**;
- Browser E2E on demand: **não executado**;
- câmera física Android/iPhone: **não executada**;
- feedback tátil/sonoro em aparelho físico: **não executado**;
- Legal Validation verde: **não obtido** por falha de merge-base no passo de diff, sem falha funcional/legal anterior.

## Métricas

Application CI #916, novo HEAD:

- `/central-mobile`: **4,72 kB** Size / **109 kB** First Load JS;
- `/adm-deposito`: **2,33 kB** Size / **106 kB** First Load JS;
- Shared First Load JS: **104 kB**;
- geração estática: **29/29**;
- build: **26,0 s**.

Conclusão:

**nenhuma regressão de bundle foi observada em relação ao HEAD anterior certificado.**

## Estado da branch frente à integradora

A integradora avançou durante a correção.

Comparação atual:

- worker: **4 commits à frente** da base comum;
- worker: **11 commits atrás** da integradora;
- merge-base preservado: `53e28b81874ee1b7ce0bd484cc7a97537aa99473`.

Nenhum rebase ou merge foi feito, conforme instrução explícita do Coordenador.

## Riscos residuais

1. header HTTP real ainda precisa ser observado no preview/ambiente que tenha acesso;
2. validação física de câmera continua pendente da certificação integrada/final;
3. Legal Validation precisa de nova execução em condição onde o workflow consiga resolver o merge-base, ou tratamento coordenado da limitação do fetch raso;
4. a integradora avançou e a integração semântica pertence ao Coordenador.

## Documentação atualizada

- `docs/CENTRAL_MOBILE_R1_A_HANDOFF.md`

O Memorial Oficial e o Integration Status não foram alterados pela worker.

## Não realizado

- merge na integradora;
- merge em `main`;
- deploy/promoção de produção;
- publicação de Rules;
- rebase;
- merge da integradora na worker;
- alteração de MOBILE-B/C–H;
- alteração de ledger/saldo/intake/outbound/inventory;
- alteração de contratos canônicos;
- alegação de câmera física certificada;
- alegação de header HTTP observado sem evidência.

## Próximo gate do Coordenador

Para promover esta frente de **PARCIAL** para **APTO PARA REVISÃO**, ainda é necessário:

1. observar a resposta HTTP real de `/central-mobile` e confirmar:
   `Permissions-Policy: camera=(self), microphone=(), geolocation=()`;
2. decidir/reexecutar o SAAS-DL Legal Validation em condição que não falhe por ausência artificial de merge-base;
3. revisar o novo HEAD sem integrar automaticamente.
