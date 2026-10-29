# EMPROVEX — prévia segura no Windows (Modo Normal / Essencial)

## Por que /login em npm run dev pode mostrar erro HTTP 503?

O clone Git não possui a credencial de produção `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`.
Em `npm run dev` normal, a aplicação utiliza o Firebase real e o endpoint
`/api/legal-acceptance` precisa de credencial de serviço para verificar
o termo R4. Sem essa credencial o servidor pode retornar 503. **Não substitua
por `return true`, não desative o termo, não altere Firestore Rules e não copie
chaves de produção para o clone só para inspecionar a interface.**

## Prévia local isolada

No PowerShell, dentro da pasta `EMPROVEX-PREVIEW-ESSENCIAL`:

```powershell
# Se houver npm run dev anterior, Ctrl+C para encerrá-lo.
git pull --ff-only
npm.cmd install --no-save --package-lock=false @playwright/test@1.56.1
npx.cmd playwright install chromium
npm.cmd run preview:local
```

O runner:
1. Usa `firebase emulators:exec` no projeto ficcional `demo-emprovex-security`,
   com Firebase Auth e Firestore na máquina (portas 9099 e 8080);
2. Alimenta os emuladores com dados sintéticos de dois setores, inclusive Warehouse
   isolado no Firestore Emulator da porta 8081;
3. Abre **um Chromium interativo em http://127.0.0.1:3100/login**;
4. Intercepta **somente neste navegador de teste** o aceite legal e o gate de
   assinatura, verificando token no Auth Emulator e permissão / identidade / UG
   nas Rules do Firestore Emulator;
5. Permite selecionar **Normal / Essencial** no cabeçalho e conferir as abas.
   Nenhuma conta da produção precisa ser usada.

**Usuário fictício:** `sector-lifecycle@example.test`

**Senha fictícia:** `Emprovex-Teste!2026`

O link `http://localhost:3000/login` **não** terá essas interceptações:
o Chromium é aberto automaticamente pelo runner em **127.0.0.1:3100**.
Fechar o Chromium encerra a prévia e desmonta os emuladores.
O runner recusa usar `.env.production.local` no diretório do clone e não
exporta credenciais Google administrativas ao servidor.

### Limites

A prévia permite conferir o design, a navegação e funções cobertas pelos
emuladores. Não valida upload com Google Drive real, processamento de pagamentos,
nem APIs que dependem de IAM/serviços externos. Dados fictícios do emulador
podem ser recriados a cada início. Algumas ações que precisariam de serviços
externos podem retornar erros no laboratório; **isso não deve levar à remoção
de verificações na produção**.

Se faltar Java para o Firestore Emulator, instale JDK 21 e verifique com
`java -version`; se a porta estiver em uso, encerre outras instâncias locais.
Se não abrir a janela, confira se o Chromium foi instalado com
`npx.cmd playwright install chromium`.

## Evidência

A implementação normal/essencial e o fallback têm 11/11 casos E2E Playwright PASS
em Firebase Emulators na execução GitHub Actions #40951319841.
O runner de **prévia interativa** é uma conveniência adicional, distinta da
certificação do navegador headless e deve ser exercitado no computador Windows.
A produção permanece inalterada até merge/deploy explícitos.
