# GOVERNANCE-BACKUP-01 — Manifesto público

**Data da observação:** 2026-10-14  
**Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`  
**Branch de documentação:** `agent-eng-r1-w1-governance-backup`

## O que foi materialmente produzido
- Inventário documental e referências por SHA observadas no GitHub.
- Arquivo JSON `REFERENCIAS_PUBLICAS_2026-10-14.json` com **307 branches** e **60 PRs abertos**, incluindo as bases e heads quando retornadas.
- Procedimento PowerShell para executar posteriormente backup Git completo, verificação, restauração de prova, hash SHA-256 e cópia externa autorizada.
- Registros em commits documentais desta branch, sem modificar documentos canônicos.

## O que **não** foi feito
- **NÃO EXECUTADO:** `git clone --mirror`, captura integral de `refs/pull/*`, `git bundle create`, `git bundle verify`, `git clone` de recuperação, restauração de prova e armazenamento externo.
- **NÃO EXECUTADO:** exportação completa de comentários de PR, reviews, checks, settings, GitHub Actions secrets, configurações administrativas, releases e artefatos.
- **NÃO EXECUTADO:** operação de Firestore, deploy, merge, publicação de Rules ou alteração de credenciais/permissões.
- **NÃO EXISTE** neste worker um arquivo de backup Git material apto a restaurar o repositório fora do GitHub. Logo não existe hash SHA-256 válido a atribuir a esse bundle.
- Os SHAs das refs são **identificadores Git de commits**; não são hashes SHA-256 de um arquivo de backup.
- Um PR e uma branch no **mesmo repositório** não constituem salvaguarda contra exclusão ou comprometimento da origem.

## Estado e cobertura real
**PASS COM PENDÊNCIAS — inventário. BLOCKED — backup integral recuperável / cópia independente.** A governança do repositório não foi considerada certificada para migração com base apenas nos materiais presentes aqui.

## Dependência de autorização
O Coordenador/Fundador deve indicar um destino externo **privado, criptografado e com retenção controlada**, bem como autorizar expressamente a gravação nele. Não armazenar bundles, ZIPs, dumps, tokens ou logs sensíveis em PR público. Produzir checksums SHA-256 **após** gerar os arquivos localmente e comparar com a cópia externa.