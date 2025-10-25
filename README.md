# Aluno Repórter — Rádio

Aplicação web para streaming de rádio com chat, pedidos musicais e galeria de fotos. O frontend não expõe segredos; todo acesso protegido ocorre via funções server-side.

## Funcionalidades
- Player com stream HTTPS e status opcional.
- Chat em tela cheia com reações (curtir/coração) e pedidos musicais.
- Galeria com miniaturas; clique define a imagem de topo (persistência local).
- Admin (mobile-first) para enviar fotos, definir capa e excluir, via `/.netlify/functions/admin`.
- PWA básico: `manifest.json` e `sw.js` (cache leve, network-first para `config.json`).

## Requisitos
- Navegador moderno (Chrome/Edge/Firefox/Safari).
- Netlify para hospedar as funções (`chat.js`, `admin.js`).

## Setup local
1. Copie `config.example.json` para `config.json` e preencha apenas valores públicos:
   - `station.name` e `station.primaryStream` (HTTPS).
   - `station.statusJsonUrl` (opcional).
   - `instagram.embedUrl` e `instagram.posts` (opcional).
   - Não inclua chaves privadas no `config.json`.
2. Desenvolvimento com funções:
   - `ADMIN_PASSWORD=admin123 npx netlify-cli@latest dev`
   - Abrir `http://localhost:8888/`.

## Backend (Netlify)
- Variáveis de ambiente no projeto Netlify:
  - `SUPABASE_URL`: URL do projeto Supabase.
  - `SUPABASE_SERVICE_ROLE`: chave de serviço (NÃO pública, usada só no backend).
  - `ADMIN_PASSWORD`: senha usada pelo painel admin.
- Endpoints:
  - `/.netlify/functions/chat` GET: lista mensagens (`?limit=200`).
  - `/.netlify/functions/chat` POST: insere mensagem (validação básica no servidor).
  - `/.netlify/functions/admin` POST: upload, definir capa, deletar; `X-Admin-Token` obrigatório.
- Deploy estático + funções:
  - Build command: vazio.
  - Publish directory: raiz.
  - `_headers`: cache curto para `config.json`.

## Estrutura principal
- `index.html`: app principal (inclui `styles.css`, `mobile.css`, `api_chat.js`, `app.js`, `mobile.js`).
- `app.js`: lógica de UI (slideshow/capa, chat, reações, modais via classe `.show`).
- `api_chat.js`: cliente para o endpoint server-side de chat.
- `mobile.css` / `styles.css`: estilos mobile e tema geral.
- `mobile.js`: utilidades mobile (inclui registro de service worker).
- `admin.html` + `admin-mobile.js` + `admin-mobile.css`: painel administrativo.
- `netlify/functions/chat.js` e `netlify/functions/admin.js`: funções server-side.
- `manifest.json` e `sw.js`: PWA básico.
- `config.json`: configuração pública; usar `config.example.json` como base.

## Itens movidos para lixeira/
Arquivos legados/sem uso atual foram deslocados para `lixeira/` por organização:
- `index_legacy.html`
- `admin_legacy.html`
- `supabase_chat.js`
- `supabase_storage.js`
- `drive.js`
- `server.py`

Se necessário, restaure movendo-os de volta à raiz.

## Comandos úteis
- Commit e push:
  - `git add -A && git commit -m "Atualizações" && git push`
- Servir só estático (sem funções):
  - `python3 -m http.server 8080`

## Troubleshooting
- Chat não conecta: rode com `netlify dev` e valide as funções (`chat`, `admin`).
- 500 na função: confira `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE` e `ADMIN_PASSWORD` no painel.
- Player não toca: confirme que o stream é HTTPS e acessível.