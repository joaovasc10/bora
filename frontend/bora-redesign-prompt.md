# PROMPT DE IMPLEMENTAÇÃO — BORA: REDESIGN COMPLETO DO FRONTEND

## CONTEXTO

Você é um engenheiro frontend sênior. Sua tarefa é **substituir completamente a interface atual** do app Bora — um mapa colaborativo de eventos urbanos de Porto Alegre — por um novo design de alta qualidade criado no Google Stitch, mantendo **toda a lógica e funcionalidades existentes** intactas.

O projeto usa:
- **Backend:** Django + DRF rodando em `https://bora.up.railway.app/`
- **Frontend atual:** HTML/CSS/JS vanilla + Mapbox GL JS + Tailwind CSS
- **Estrutura de arquivos relevante:**
  ```
  frontend/
  ├── src/
  │   ├── app.js
  │   ├── auth.js
  │   ├── events.js
  │   ├── filters.js
  │   ├── map.js
  │   └── pins.js
  ├── styles/
  │   └── main.css
  └── index.html
  ```

---

## DESIGN SYSTEM — USE EXATAMENTE ESSES VALORES

### Paleta de cores
```css
--background:           #0B0B0B;
--surface:              #0B0B0B;
--surface-low:          #111111;
--surface-container:    #1A1A1A;
--surface-high:         #242424;
--surface-highest:      #2D2D2D;
--primary:              #F97316;  /* laranja — cor de destaque única */
--on-primary:           #FFFFFF;
--on-surface:           #F8FAFC;
--on-surface-variant:   #A3A3A3;
--outline:              #404040;
--outline-variant:      #334155;
```

### Tipografia
- Fonte: **Plus Jakarta Sans** (Google Fonts)
- Pesos usados: 400, 500, 600, 700, 800
- Labels de seção: `uppercase`, `tracking-widest`, `font-black`, tamanho `10px`
- Títulos principais: `font-black`, `tracking-tighter`

### Border radius
- Padrão: `16px`
- Botões pill: `9999px`
- Cards: `12px` a `16px`

### Efeito glass panel
```css
.glass-panel {
  background: rgba(26, 26, 26, 0.75);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
```

---

## TELA 1 — HOME (MAPA PRINCIPAL)

### Layout geral
```
[SideNavBar 80px fixo] [InnerPanel 320px fixo] [Mapa ocupa o restante]
```

### SideNavBar (lado esquerdo, fixo, 80px de largura)
- Fundo: `#050505` com `backdrop-blur`
- Borda direita: `1px solid rgba(255,255,255,0.05)`
- **Logo** no topo: círculo laranja `#F97316` com ícone `bubble_chart` (Material Symbols)
- **Navegação** (ícones empilhados verticalmente, com gap entre eles):
  - Home — `home`
  - Add Event — `add_circle`
  - Explore — `explore`
  - Saved — `bookmark`
  - Profile — `person`
- O ícone **ativo** recebe: `background: rgba(249,115,22,0.1)`, `color: #F97316`, `border-radius: 9999px`, `padding: 12px`
- Ícones inativos: `color: #A3A3A3`, hover para `#F8FAFC`
- **Rodapé da sidebar:** avatar do usuário logado (circular, 40px), botão de notificações e settings
- Usuário logado exibido como iniciais + username em texto `10px`

### InnerPanel (320px, scrollável)
- Fundo: `#111111` com `backdrop-blur`
- Borda direita: `1px solid rgba(255,255,255,0.05)`
- **Cabeçalho:**
  - Título "Bora" em `font-black`, `tracking-tighter`, `24px`
  - Subtítulo "O Pulso da Cidade" em `uppercase`, `tracking-widest`, `10px`, cor `#A3A3A3`
- **Campo de busca:** fundo `#2D2D2D`, bordas sem borda, `border-radius: 12px`, ícone `search` à esquerda, placeholder "Buscar eventos..."
- **Botão "Pinar Meu Evento":** largura total, fundo `#F97316`, texto branco, `font-bold`, ícone `push_pin` à esquerda, sombra `0 4px 20px rgba(249,115,22,0.2)`, hover `brightness(1.1)`
- **Label "CATEGORIES":** `10px`, `uppercase`, `tracking-[0.2em]`, `opacity: 0.6`
- **Lista de categorias** (cada item é uma linha clicável):
  - Inativa: ícone + texto, `color: #A3A3A3`, hover muda fundo para `#242424` e cor para `#F97316`
  - Ativa: fundo `rgba(249,115,22,0.1)`, texto `#F97316`, borda `1px solid rgba(249,115,22,0.2)`, `border-radius: 12px`
  - Ícones (Material Symbols): palette, school, sports_soccer, festival, celebration, restaurant, child_care, sports_esports, diversity_3, forest, groups, pets, church, music_note

### Área do mapa (flex-1, ocupa o restante da tela)
- Mapbox GL JS inicializado com `style: 'mapbox://styles/mapbox/dark-v11'`
- Centro: `[-51.2177, -30.0346]`, zoom: `13`

**Filtros flutuantes (topo do mapa, centralizado):**
- Componente `glass-panel` em formato pill horizontal
- Botões de categoria: Feiras, Teatro, Rua, Corrida
- Ativo: `color: #F97316`, `border-bottom: 2px solid #F97316`
- Separador vertical + ícone `dark_mode`

**Widget de clima/info (canto superior direito):**
- Componente `glass-panel`, `border-radius: 16px`, `padding: 20px`
- Exibe: "Porto Alegre", temperatura, condição, separador vertical, "Nearby", contagem de eventos
- Temperatura e contagem em `font-bold`, `20px`
- Labels em `#F97316`, `10px`, `uppercase`, `tracking-widest`

**Pins no mapa:**
- Pin ativo/selecionado: círculo `#F97316` com `border: 4px solid surface`, ícone da categoria em branco, efeito `animate-ping` no anel externo
- Pins inativos: círculo `#242424`, ícone `#F97316`, `border: 2px solid background`, hover muda fundo para `#F97316` e ícone para branco
- Localização do usuário: círculo branco menor com anel pulsante `rgba(255,255,255,0.1)`

**Card de detalhe do evento (ao clicar num pin):**
- Tooltip flutuante sobre o mapa, NÃO uma sidebar que empurra o layout
- Largura: `256px`, `border-radius: 16px`, fundo `#1A1A1A`
- Seta triangular apontando para o pin (elemento CSS rotacionado 45°)
- Estrutura interna:
  - Imagem de capa: `128px` de altura, `border-radius: 12px`, tag "LIVE" se evento em andamento
  - Título do evento em `font-bold`
  - Distância com ícone `location_on` laranja
  - Botão "Ver detalhes" — largura total, hover muda para fundo `#F97316`
- Animação de entrada: `fade-in + zoom-in`

**Controles do mapa (canto inferior direito):**
- Botões circulares `glass-panel`: zoom in (`add`), zoom out (`remove`)
- Botão de localização: círculo sólido `#F97316`, ícone `near_me`

---

## TELA 2 — MODAL "PINAR NOVO EVENTO"

Disparado ao clicar em "Pinar Meu Evento" ou no ícone `add_circle` da sidebar.

### Overlay
- `position: fixed`, `inset: 0`, `z-index: 60`
- Fundo: `rgba(0,0,0,0.6)` com `backdrop-blur(8px)`
- Centralizar o modal com flexbox

### Container do modal
- `max-width: 896px`, `max-height: 90vh`
- Fundo: `rgba(26,26,26,0.9)` com `backdrop-blur(32px)`
- `border-radius: 24px`
- `border: 1px solid rgba(255,255,255,0.1)`
- `box-shadow: 0 25px 60px rgba(0,0,0,0.8)`
- Estrutura: Header fixo + Área scrollável + Footer fixo

### Header do modal
- Título "Pinar Novo Evento" — `font-black`, `30px`, `tracking-tight`
- Subtítulo "Contribua com o pulso da cidade." — `#A3A3A3`, `14px`
- Botão fechar (X): círculo `rgba(255,255,255,0.05)`, hover `rgba(255,255,255,0.1)`

### Corpo do modal — grid 2 colunas

**Coluna esquerda (detalhes):**

1. **Nome do Evento**
   - Label laranja, `10px`, uppercase, tracking-widest
   - Input: fundo `rgba(0,0,0,0.4)`, `border: 1px solid rgba(255,255,255,0.05)`, `border-radius: 12px`, padding `20px`
   - Focus: `ring: 2px solid #F97316`

2. **Categoria**
   - Label laranja
   - Chips horizontais clicáveis com ícone + texto
   - Chip ativo: fundo `#F97316`, texto `#FFFFFF`
   - Chip inativo: fundo `rgba(255,255,255,0.05)`, texto `#A3A3A3`, hover `rgba(255,255,255,0.1)`
   - Categorias: Feiras, Teatro, Rua, Corrida, Gastronomia (e demais categorias do sistema)

3. **Data e Hora** — grid 2 colunas
   - Cada campo com ícone `calendar_today` / `schedule` à esquerda
   - Mesmo estilo dos inputs acima

4. **Descrição**
   - Textarea, `resize: none`, 3 linhas, mesmo estilo dos inputs

**Coluna direita (localização e extras):**

1. **Localização**
   - Input de busca com ícone `search`
   - **Mini-mapa de preview** abaixo do input:
     - Altura: `176px`, `border-radius: 12px`, fundo preto
     - Instância Mapbox GL JS em miniatura (ou imagem placeholder)
     - Ícone `location_on` centralizado, cor `#F97316`, tamanho `36px`, glow `drop-shadow(0 0 10px rgba(249,115,22,0.5))`
     - Badge "SELEÇÃO ATUAL" no canto inferior esquerdo: `glass-panel`, pill, ponto laranja pulsante

2. **Toggle "É gratuito?"**
   - Card com fundo `rgba(255,255,255,0.05)`, `border-radius: 12px`
   - Ícone `confirmation_number` laranja + label
   - Toggle switch: quando ativo, trilho `#F97316`

3. **Links extras** (dois inputs com ícones):
   - `link` — Link do Ingresso (URL)
   - `alternate_email` — Perfil do Instagram

### Footer do modal
- Fundo: `rgba(0,0,0,0.4)`, `border-top: 1px solid rgba(255,255,255,0.05)`
- **Lado esquerdo:** indicador de passos
  - "PASSO 01 / 02" — `10px`, uppercase, tracking-wide
  - Barra de progresso: dois segmentos, primeiro ativo em `#F97316`, segundo em `rgba(255,255,255,0.1)`
  - Separador vertical + texto "Detalhes & Localização" + "Rascunho salvo."
- **Lado direito:** botão CTA
  - Gradiente: `from #FFB690 to #F97316`
  - `border-radius: 12px`, `padding: 16px 40px`
  - Texto: "PUBLICAR EVENTO NO MAPA", uppercase, tracking-widest, font-black
  - Ícone `push_pin` à esquerda
  - Hover: `scale(1.05)`, active: `scale(0.95)`

---

## TELA 3 — ABA "EXPLORAR EVENTOS"

Ativada ao clicar no ícone `explore` da SideNavBar.

### Layout
- Mesma SideNavBar + TopNavBar (sem InnerPanel)
- Conteúdo: `margin-left: 80px`, `padding-top: 80px`, `padding: 32px`

### TopNavBar
- Input de busca com ícone à esquerda, `width: 256px`, fundo `#1A1A1A`, `border-radius: 9999px`
- Links de navegação: Feiras, Teatro, Rua, Corrida — `uppercase`, `tracking-widest`, `font-bold`
- Ícone `dark_mode` + botão "Pin My Event" laranja arredondado

### Cabeçalho da seção
- Título "Acontecendo em Breve" — `font-extrabold`, `48px`, `tracking-tighter`
- Subtítulo em `#A3A3A3`
- Botões à direita: "Este Fim de Semana" (laranja, pill) + "Ordenar" (escuro, pill, ícone `tune`)

### Grid assimétrico de cards (bento grid)
```
[Card Hero — 2 colunas de largura, 500px altura] [Card Sec. 1] [Card Sec. 2]
[Card Sec. 3]  [Card Sec. 4]
```

**Card Hero (destaque):**
- Imagem de fundo com `object-cover`, `scale(1.1)` no hover com `transition: 700ms`
- Overlay gradiente: `from black via transparent to transparent`
- Badges no topo esquerdo: "Featured" (fundo laranja) + "Entrada Franca" (fundo `rgba(0,0,0,0.6)` com `backdrop-blur`)
- Conteúdo na parte inferior:
  - Localização em `#F97316`, uppercase
  - Título do evento: `font-black`, `36px`, branco
  - Linha de meta: ícone `schedule` + horário + ícone `group` + contagem
  - Botão circular branco com seta `arrow_forward` à direita

**Cards secundários:**
- Fundo: `#1A1A1A`, `border-radius: 12px`
- `border: 1px solid rgba(255,255,255,0.05)`
- Hover: `transform: translateY(-8px)`, `transition: 300ms`
- Imagem no topo: `192px` de altura, badge de categoria no canto superior direito
- Corpo do card:
  - Título + rating com ícone `star` laranja
  - Distância com ícone `map`
  - Descrição: `2 linhas`, `font-size: 14px`, `#A3A3A3`
  - Rodapé: preço em `#F97316` (ou "Grátis") + data/hora em `#737373`
  - Separador `border-top: 1px solid rgba(255,255,255,0.05)`

### Botão flutuante "Abrir Mapa" (canto inferior direito)
- Círculo laranja sólido, `padding: 24px`
- `box-shadow: 0 8px 32px rgba(249,115,22,0.3)`
- Hover: revela label "Abrir Mapa" com animação `max-width` de 0 para 100px
- Ao clicar: navega de volta para a Home (Tela 1)

---

## INTEGRAÇÕES E FUNCIONALIDADES — TUDO DEVE FUNCIONAR

### API endpoints que devem continuar sendo consumidos
```
GET  /api/events/           → carrega todos os pins no mapa
GET  /api/events/?category= → filtra pins por categoria
GET  /api/events/search/    → busca textual
POST /api/events/           → cria novo evento (formulário do modal)
GET  /api/categories/       → popula lista de categorias dinamicamente
POST /api/auth/login/       → autenticação
POST /api/auth/logout/      → logout
GET  /api/auth/me/          → dados do usuário logado (nome, avatar)
POST /api/events/{id}/interact/ → GOING, INTERESTED, SAVED
```

### Comportamento do mapa (preservar lógica existente de `map.js` e `pins.js`)
- Ao clicar numa categoria na InnerPanel: filtrar pins via `GET /api/events/?category={slug}`
- Ao clicar num filtro flutuante no topo do mapa: mesmo filtro
- Ao clicar num pin: exibir card de detalhe flutuante acima do pin
- "Pinar Meu Evento": verificar se usuário está logado
  - Se sim: abrir modal de criação
  - Se não: abrir modal de login primeiro, depois modal de criação
- Campo de busca: debounce de 300ms, chamar `GET /api/events/search/?q=`
- Geolocalização: botão `near_me` chama `navigator.geolocation.getCurrentPosition()`

### Modal de criação de evento (preservar lógica de `events.js`)
- Campo de localização: ao digitar, chamar Mapbox Geocoding API
- Clicar no mini-mapa: capturar lat/lng via `map.on('click')`
- Submit: `POST /api/events/` com `multipart/form-data` (se tiver upload de imagem)
- Sucesso: fechar modal + `map.flyTo()` para o novo pin + exibir card de detalhe

### Autenticação (preservar lógica de `auth.js`)
- Avatar do usuário na SideNavBar: carregar de `GET /api/auth/me/`
- Username exibido no rodapé da InnerPanel
- Logout: `POST /api/auth/logout/` + limpar tokens + recarregar estado

---

## INSTRUÇÕES TÉCNICAS DE IMPLEMENTAÇÃO

1. **Não apague** `map.js`, `pins.js`, `auth.js`, `events.js`, `filters.js` — refatore-os se necessário, mas mantenha toda a lógica de API
2. **Reescreva completamente** `index.html` e `main.css` com o novo design
3. Adicione a fonte **Plus Jakarta Sans** via Google Fonts no `<head>`
4. Adicione **Material Symbols Outlined** via Google Fonts no `<head>`:
   ```html
   <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
   ```
5. O Tailwind CDN já está disponível — use as classes utilitárias para o que fizer sentido
6. Para classes não cobertas pelo Tailwind CDN (como `backdrop-blur` customizado), use CSS inline ou classes no `main.css`
7. A navegação entre as 3 telas deve ser feita via **show/hide de seções** no mesmo HTML — não criar arquivos separados
8. As 3 telas são: `#view-map` (Home), `#view-modal-event` (modal overlay), `#view-explore` (Explorar)
9. **Teste cada funcionalidade** após implementar: login, logout, criação de evento, filtros, busca, card de detalhe

---

## ORDEM DE IMPLEMENTAÇÃO SUGERIDA

1. Estrutura HTML base com as 3 views e navegação entre elas
2. Design system: variáveis CSS, tipografia, animações base
3. SideNavBar (componente reutilizado nas 3 telas)
4. InnerPanel + lista de categorias dinâmica (via API)
5. Área do mapa com Mapbox + pins customizados
6. Card de detalhe flutuante
7. Filtros flutuantes + widget de clima
8. Modal de criação de evento completo
9. Tela de Explorar Eventos
10. Integração completa com todos os endpoints da API
11. Estados de loading, erro e vazio para todos os componentes
