# Radiochat

Aplicação web simples para streaming de rádio com chat. Agora sem exposição de chaves: todo acesso a dados protegidos é feito via endpoints server-side.

## Requisitos
- Navegador moderno (Chrome/Edge/Firefox/Safari).
- Netlify (ou Vercel) para hospedar funções server-side.

## Setup local
1. Copie `config.example.json` para `config.json` e preencha apenas valores públicos:
   - `station.name` e `station.primaryStream` (HTTPS).
   - `station.statusJsonUrl` (opcional).
   - `instagram.embedUrl` e `instagram.posts` (opcional).
   - Não inclua chaves de Supabase ou Google no `config.json`.
2. Servir local rapidamente:
   - `python3 -m http.server 8080` e acessar `http://localhost:8080/`.

## Backend (Netlify)
- Crie as variáveis de ambiente no projeto Netlify:
  - `SUPABASE_URL`: URL do seu projeto Supabase.
  - `SUPABASE_SERVICE_ROLE`: chave de serviço (NÃO pública). Fica apenas no backend.
- Endpoints:
  - `/.netlify/functions/chat` `GET`: lista mensagens (limite via `?limit=200`).
  - `/.netlify/functions/chat` `POST`: insere mensagem (validação básica no servidor).
- Deploy estático + funções:
  - Build command: vazio.
  - Publish directory: raiz.
  - `_headers`: já inclui cache curto para `config.json`.

## Segurança
- Zero chaves no frontend: nenhum `anonKey`, API key ou clientId é necessário no navegador.
- Supabase acessado via service role no backend (não exposto). Restrinja tabelas e lógica no servidor.
- RLS continua recomendada na base para consumo alternativo, mas o endpoint usa service role com validação.

## PWA e cache
- `sw.js` usa strategy network-first para `config.json`, com fallback offline.

## Comandos úteis
- Commit e push:
  - `git add -A && git commit -m "Atualizações" && git push`
- Servir local:
  - `python3 -m http.server 8080`

## Troubleshooting
- Chat não conecta: valide que o site está em um domínio do Netlify/Vercel com a função acessível.
- 500 na função: verifique variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE` no painel do provedor.
- Player não toca: confirme que o stream é HTTPS e acessível.