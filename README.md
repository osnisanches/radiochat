# Radiochat

Aplicação web simples para streaming de rádio com chat e integração opcional com Supabase e Google Drive. Inclui PWA com Service Worker para uso mobile/offline básico.

## Requisitos
- Navegador moderno (Chrome/Edge/Firefox/Safari).
- Supabase (URL e `anonKey`) se for usar chat/armazenamento.
- Google API (opcional) para listar fotos do Drive.

## Setup local
1. Copie o arquivo `config.example.json` para `config.json`:
   - Preencha:
     - `station.primaryStream`: URL HTTPS do seu stream.
     - `supabase.url` e `supabase.anonKey` (se usar chat/armazenamento).
     - `google.apiKey` e `google.clientId` (se usar Drive/Photos).
2. Sirva os arquivos com um servidor estático local:
   - Opção rápida: `python3 -m http.server 8080` (na pasta do projeto) e acesse `http://localhost:8080/`.
3. Abra `index.html` e valide:
   - Player toca seu stream.
   - Chat abre/fecha e envia mensagens (se Supabase configurado).
   - PWA instala em mobile (Chrome/Android).

## Segurança
- `config.json` NÃO é versionado (está no `.gitignore`). Use `config.example.json` para exemplos.
- `Supabase anonKey` é público por design; habilite RLS e políticas restritivas na sua tabela (ex.: `public.messages`).
- Restrinja sua `google apiKey` por domínios (HTTP referrer) e escopos.
- Evite segredos no cliente. Qualquer `adminPasscode` no frontend não é segurança real. Use autenticação/ACL no backend se precisar de área administrativa.

## Deploy
### Netlify
- Build command: vazio.
- Publish directory: raiz do projeto.
- Arquivo `_headers` (já incluso): limita cache do `config.json` para atualizações rápidas.
- Pós-deploy: valide player, chat, PWA e chamadas ao Supabase.

### Vercel
- Framework: Other.
- Build command: vazio.
- Output directory: raiz.
- Configure variáveis/URLs permitidas em `Project Settings` se necessário.

## Supabase (resumo)
- Crie a tabela `public.messages` (exemplo):
  - `id` (uuid ou bigint, PK)
  - `name` (text)
  - `avatar_url` (text, opcional)
  - `message` (text)
  - `created_at` (timestamp com default `now()`)
- Habilite RLS e crie políticas mínimas:
  - `SELECT`: permitir leitura pública se for desejado.
  - `INSERT`: permitir apenas o que considerar seguro (ex.: todos com `anon`, ou usuários autenticados).
- Opcional: habilite Realtime no schema público para atualizar o chat em tempo real.

## PWA e cache
- O Service Worker (`sw.js`) está incluído. Em produção, mantenha cache curto para `config.json` (via `_headers` ou estratégia network-first no SW).
- Teste em `Application > Service Workers` no DevTools e confirme atualização quando mudar o `config.json`.

## Comandos úteis
- Commit e push:
  - `git add -A && git commit -m "Atualizações" && git push`
- Servir local rapidamente:
  - `python3 -m http.server 8080`

## Próximos passos sugeridos
- Remover/ocultar qualquer fluxo de "adminPasscode" no cliente em produção.
- Implementar estratégia network-first para `config.json` no `sw.js` (se desejar cache controlado pelo SW).
- Adicionar README com instruções de Supabase mais detalhadas (migrations/policies) se o chat for central ao app.

## Troubleshooting
- Player não toca: verifique se o stream é HTTPS e suporta CORS.
- Chat não envia: confirme `supabase.url` e `anonKey`, RLS e políticas de `INSERT`.
- PWA não instala: valide `manifest.json`, ícones e ativação do Service Worker.