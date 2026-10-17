# EMPROVEX — Release consolidada (16/10/2026)

## Escopo — um único commit
- PR #325: formulário de cadastramento de depósitos e medidas individuais.
- PR #326: NE apenas manual/PDF, sem entrada JSON.
- PR #327: tooltip das NFs à frente de todas as camadas SVG.
- PR #328: clique na NF conduz a alocação detalhada, com NF destacada.
- PR #329: geladeira inox/freezer horizontal em quatro perspectivas e laboratório local.

## Integração
- O arquivo WarehouseLandingOperational.tsx combina explicitamente PR #328 (inclui #327) e o desenho de refrigerados de PR #329.
- O guard do bloco 14 foi adaptado à retirada do prompt PDF da antiga importação JSON (não dispensa o lazy loading das rotinas restantes).
- Não há novas migrações de dados aplicadas por esta composição. O ruleset do PR #325 está no repositório; **não publicar Rules separadamente** no processo de prebuild Vercel sem autorização e auditoria.
- A prévia DEV-only /visual-lab/frigorificos e /visual-lab/cadastro-deposito não deve existir em build production.

## Publicação controlada
1. CI verde no SHA exato deste commit (Application CI/Core/Recovery/Legal).
2. PowerShell: worktree isolada, Vercel production link, `vercel pull --environment=production`, `vercel build --prod`.
3. Apenas após build verde, `vercel deploy --prebuilt --archive=tgz --prod --scope aprov-hgesms-projects`.
4. Verificar URL final, acesso e fluxos principais; manter rollback para deployment anterior.
5. Não modificar main nem ativar deploy automático adicional antes de concluir a publicação manual.
