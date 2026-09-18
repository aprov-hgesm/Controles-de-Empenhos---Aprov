# EMPROVEX — Cinematic Login Redesign

## Objetivo
Elevar a área de autenticação do EMPROVEX a uma experiência premium, cinematográfica, institucional e tecnológica, sem alterar o modelo de autenticação, as regras de autorização, o isolamento de workspaces ou a segurança já existente.

## Baseline seguro
- Branch de trabalho: `feat/login-cinematic-redesign`
- Baseline da `main`: `79e5cfb6634ed52b21cb2692ca7dc06727e2ff94`
- Autenticação preservada:
  - `signInSectorUser(email, password)`
  - `signInUser()`
  - `finalizeSignIn()`
  - resolução fail-closed de workspace
- Não alterar Firestore Rules, Firebase Auth, providers, provisionamento, diretório da plataforma ou APIs administrativas.
- Não adicionar WebGL, vídeo de fundo, áudio automático ou dependências 3D pesadas.
- Reusar `motion`, `lucide-react`, CSS/SVG e fontes já carregadas por `next/font`.

## Arquitetura-alvo
```
components/auth/
  EmprovexLogin.tsx
  LoginAtmosphere.tsx
  LoginBrandStage.tsx
  LoginPanel.tsx
  LoginStatusRail.tsx
  LoginSuccessTransition.tsx
  LoginNetwork.tsx
  LoginLogoCore.tsx

app/
  page.tsx
  globals.css
```

A lógica de autenticação permanece no fluxo já existente. Os componentes de `components/auth` recebem callbacks/estado e cuidam apenas de UI, animação e feedback.

---

# Bloco 0 — Guardrails e baseline
## Escopo
Preparar o terreno antes de qualquer mudança visual.

## Ações
- Congelar baseline da `main`.
- Mapear contratos de autenticação e estados atuais.
- Definir tokens exclusivos do login para evitar contaminar o restante da aplicação.
- Definir estados visuais:
  - idle
  - field-focus
  - authenticating
  - success
  - error
- Definir feature boundary: nada visual poderá decidir autorização.

## Critérios de aceite
- Nenhuma alteração funcional.
- Nenhuma mudança em Firebase/Firestore.
- Build e typecheck continuam equivalentes ao baseline.

---

# Bloco 1 — Extração arquitetural do login
## Escopo
Retirar o bloco de login do `app/page.tsx` e transformá-lo em componente isolado.

## Implementação
Criar `components/auth/EmprovexLogin.tsx` e mover para ele:
- layout do login;
- formulário;
- visibilidade da senha;
- links legais;
- acesso Google;
- feedback visual de autenticação.

O `app/page.tsx` continuará sendo a fonte de:
- `signInSectorUser`;
- `signInUser`;
- `customLogo`;
- toast;
- estado da sessão.

## Critérios de aceite
- Login funcionalmente idêntico ao atual antes do redesign.
- E-mail/senha continuam funcionando.
- Google HGeSM continua funcionando.
- Erros continuam sendo exibidos.
- Nenhuma mudança nas rotas pós-login.

---

# Bloco 2 — Nova composição premium
## Escopo
Criar a estrutura visual definitiva antes dos efeitos avançados.

## Desktop
- Composição aproximadamente 55/45.
- Lado esquerdo: palco de marca e atmosfera.
- Lado direito: painel de autenticação premium.
- Hierarquia:
  - símbolo;
  - EMPROVEX;
  - Gestão Logística e Financeira;
  - mensagem curta;
  - login.

## Mobile
- Coluna única.
- Marca compacta acima do painel.
- Remover elementos puramente decorativos que prejudiquem espaço ou bateria.

## Linguagem
- Azul-marinho profundo / azul EMPROVEX / branco frio.
- Superfícies de vidro com bordas luminosas discretas.
- Montserrat na marca.
- Inter na interface.
- JetBrains Mono apenas em pequenos indicadores técnicos.

## Critérios de aceite
- Excelente leitura em 360 px, 768 px, 1366 px e 1920 px.
- Sem overflow horizontal.
- Contraste adequado.
- Formulário permanece prioridade visual.

---

# Bloco 3 — Atmosfera cinematográfica
## Componentes
- `LoginAtmosphere.tsx`
- `LoginNetwork.tsx`

## Elementos
### Profundidade em camadas
1. gradiente-base;
2. halos de luz;
3. grade técnica em perspectiva;
4. rede logística;
5. partículas mínimas;
6. vinheta cinematográfica;
7. ruído visual extremamente sutil.

### Rede logística EMPROVEX
Representação abstrata de:
`Empenho → Recebimento → NF → Liquidação → Relatórios`

- SVG leve.
- Nós e linhas finas.
- Pulsos percorrem caminhos lentamente.
- Não mostrar dados reais.

### Spotlight
- Desktop: spotlight suave acompanha o cursor.
- Movimento limitado e interpolado.
- Desativado em dispositivos touch.

### Constelação documental
Fragmentos visuais decorativos, sem dados reais:
- NE;
- NF;
- TR;
- pequenos números fictícios/abstratos;
- ícones documentais;
- linhas técnicas.

## Critérios de aceite
- Nenhum canvas/WebGL obrigatório.
- Sem queda perceptível de interação.
- Camadas têm `pointer-events: none`.
- Efeitos reduzidos/desligados com `prefers-reduced-motion`.

---

# Bloco 4 — Núcleo visual da marca
## Componentes
- `LoginBrandStage.tsx`
- `LoginLogoCore.tsx`

## Experiência
- Logo em maior escala.
- Entrada com montagem por camadas.
- Halo interno e externo.
- Reflexo especular leve.
- Parallax de poucos pixels.
- Núcleo com respiração lenta em idle.
- Tipografia cinética para `EMPROVEX`.
- Tracking se estabiliza durante a entrada.

## Estados do núcleo
- idle: respiração lenta;
- focus: iluminação aumenta discretamente;
- authenticating: pulso ritmado;
- success: onda luminosa;
- error: reação curta sem “alarme” agressivo.

## Critérios de aceite
- Custom logo continua suportado.
- Fallback EMP continua funcionando.
- Animação não distorce o arquivo da marca.
- Sem loop chamativo.

---

# Bloco 5 — Painel de autenticação e microinterações
## Componente
- `LoginPanel.tsx`

## Glass premium
- backdrop blur;
- borda translúcida;
- reflexo direcional;
- gradiente interno;
- sombra profunda controlada;
- brilho de borda somente quando necessário.

## Campos
- ícones já existentes;
- borda luminosa ao foco;
- leve deslocamento do ícone;
- feedback instantâneo;
- sem animações que movam o layout.

## Botão principal
Estados:
- Entrar;
- Autenticando;
- Acesso autorizado.

Interações:
- hover com iluminação direcional;
- press curto;
- brilho percorre a superfície durante processamento;
- spinner mantido como fallback objetivo.

## Google
- Manter como acesso institucional separado.
- Visual menos dominante que o login setorial.
- Não modificar provider nem fluxo.

## Critérios de aceite
- Tab navigation completa.
- Enter envia formulário.
- botão show/hide senha preservado.
- `aria-busy` e disabled preservados.
- foco visível.

---

# Bloco 6 — Scanner e narrativa de autenticação
## Componente
- `LoginStatusRail.tsx`

## Objetivo
Transformar o tempo real de autenticação em feedback visual, sem simular etapas de segurança inexistentes.

## Regras
Não afirmar etapas que o código não executa.

Feedback permitido:
- `Autenticando credenciais…`
- `Validando acesso ao workspace…`
- `Preparando ambiente…`

A sequência deve refletir estados verdadeiros do fluxo existente.

## Scanner
- faixa luminosa atravessa o painel durante autenticação;
- status muda conforme o estado real;
- falha encerra imediatamente;
- sucesso dispara transição do bloco 7.

## Critérios de aceite
- Nada de “fake security theater”.
- Mensagens derivadas do estado real.
- Erro continua legível e imediato.

---

# Bloco 7 — Transição cinematográfica login → aplicação
## Componente
- `LoginSuccessTransition.tsx`

## Sequência
1. autenticação confirmada;
2. núcleo do logo intensifica;
3. onda luminosa se expande;
4. painel recua levemente;
5. blur/opacity controlados;
6. atmosfera se abre;
7. aplicação surge em continuidade visual.

## Regra essencial
A animação jamais deve atrasar artificialmente a autorização por vários segundos.

## Critérios de aceite
- Transição curta.
- Sem flash branco.
- Sem layout shift.
- Se reduced-motion: troca praticamente imediata.
- Não interferir no redirect do platform admin para `/admin`.

---

# Bloco 8 — Reatividade ambiental
## Escopo
Adicionar refinamentos de nível premium após a experiência principal estar estável.

## Interações
- luz reage discretamente ao cursor;
- painel reage com parallax máximo de poucos pixels;
- foco no e-mail aumenta ligeiramente o ambiente;
- foco em senha reduz atividade periférica;
- autenticação converge a atenção visual para o CTA;
- idle desacelera toda a cena.

## Mobile
- sem mouse tracking;
- sem DeviceMotion obrigatório;
- preferir animações CSS leves;
- número reduzido de partículas;
- blur menor.

## Critérios de aceite
- Nenhuma interação compete com o formulário.
- Nenhum efeito depende de permissão do navegador.
- Sem impacto relevante em bateria.

---

# Bloco 9 — Performance, acessibilidade e polimento
## Performance
- evitar imagens decorativas pesadas;
- SVG/CSS prioritários;
- limitar `will-change`;
- não manter timers desnecessários;
- animações por transform/opacity;
- evitar filtros animados grandes em mobile;
- validar bundle.

## Acessibilidade
- `prefers-reduced-motion`;
- contraste;
- labels;
- aria;
- teclado;
- foco;
- mensagens de erro;
- zoom do navegador.

## Browser matrix
- Chrome desktop/mobile;
- Edge;
- Firefox;
- Safari quando disponível.

## Critérios de aceite
- `npm run typecheck`;
- `npm run build`;
- lint aplicável ao projeto;
- sem hydration warning novo;
- sem console errors novos.

---

# Bloco 10 — Homologação e publicação
## Fluxo
1. validar branch;
2. revisar diff somente do login;
3. validar autenticação setorial;
4. validar Google fundador;
5. validar usuário inválido;
6. validar credencial inválida;
7. validar acesso mobile;
8. validar reduced-motion;
9. validar build;
10. somente então integrar na `main`.

## Rollback
A branch parte de um commit conhecido. Caso a experiência seja rejeitada, nenhuma mudança precisa alcançar a `main`.

---

# Ordem de execução recomendada
`0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10`

Os blocos 0–2 formam a fundação.
Os blocos 3–5 criam a identidade visual.
Os blocos 6–8 entregam o efeito cinematográfico.
Os blocos 9–10 garantem qualidade e publicação segura.

# Elementos “wow” contemplados
- entrada cinematográfica;
- profundidade multicamada;
- spotlight reativo;
- rede logística viva;
- constelação documental;
- logo com profundidade;
- núcleo visual respirando;
- tipografia cinética;
- glassmorphism avançado;
- inputs reativos;
- botão com estados cinematográficos;
- scanner de autenticação;
- narrativa de status baseada em estados reais;
- transição contínua login → dashboard;
- parallax;
- ambiente reativo ao foco/digitação;
- versão mobile adaptativa;
- reduced motion.

# Fora de escopo desta iniciativa
- mudança do modelo de autenticação;
- novas permissões;
- alterações de Firestore Rules;
- alterações de provisionamento;
- redesign do dashboard;
- efeitos sonoros;
- vídeo de fundo;
- Three.js/WebGL;
- coleta de telemetria adicional.
