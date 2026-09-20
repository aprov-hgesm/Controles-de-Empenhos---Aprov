# Bloco 17.7 — Firebase App Check

## Implementação

O cliente web inicializa Firebase App Check com `ReCaptchaEnterpriseProvider` quando
`NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` está configurada.

O App Check é ignorado nos E2E com Firebase Emulator. Nenhum debug token é versionado.

## Experiência do operador

A chave reCAPTCHA Enterprise usada pelo App Check deve ser score-based. O fluxo é invisível: o operador não recebe CAPTCHA, confirmação ou nova tela.

## Rollout seguro

1. Registrar a aplicação e a chave no Firebase/Google Cloud.
2. Configurar a variável de ambiente.
3. Publicar sem enforcement.
4. Observar métricas App Check em produção.
5. Validar login, Firestore, Drive e fluxos legítimos.
6. Somente então ativar enforcement progressivo no console Firebase.

O repositório deliberadamente não tenta ativar enforcement por código. Essa decisão depende das métricas reais do ambiente e ocorre depois do deploy observado.
