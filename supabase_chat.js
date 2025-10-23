(function(){
  let client = null;
  let channel = null;
  let cache = [];
  let healthy = false;
  let lastError = null;
  let lastInsertError = null;
  const subscribers = new Set();

  function notify() { subscribers.forEach((fn) => { try { fn(); } catch(_){} }); }

  function getMessages() { return cache.slice(); }
  function isHealthy() { return !!healthy; }
  function getStatus() { return { healthy, lastError, lastInsertError }; }

  async function refresh(limit = 200) {
    if (!client) return;
    try {
      const { data, error } = await client
        .from('messages')
        .select('*')
        .order('ts', { ascending: true })
        .limit(limit);
      if (error) { lastError = error.message || String(error); console.error('[Supabase] select messages error:', error.message || error); return; }
      if (Array.isArray(data)) { cache = data; notify(); }
    } catch (e) { lastError = String(e?.message || e); console.error('[Supabase] refresh error:', e); }
  }

  async function addMessage(msg) {
    if (!client) { lastInsertError = 'client not initialized'; console.error('[Supabase] client not initialized'); return false; }
    try {
      const payload = {
        author_session: msg.author,
        name: msg.name,
        school: msg.school || null,
        avatar: msg.avatar || null,
        text: msg.text,
        type: msg.type || 'message',
        ts: new Date().toISOString()
      };
      const { error } = await client.from('messages').insert(payload);
      if (error) { lastInsertError = error.message || String(error); console.error('[Supabase] insert error:', error.message || error); return false; }
      lastInsertError = null;
      return true;
    } catch (e) { lastInsertError = String(e?.message || e); console.error('[Supabase] addMessage exception:', e); return false; }
  }

  function subscribe(handler) {
    if (typeof handler === 'function') subscribers.add(handler);
    return () => subscribers.delete(handler);
  }

  async function init(cfg) {
    const sb = cfg?.supabase;
    if (!sb?.url || !sb?.anonKey || typeof window.supabase === 'undefined') { lastError = 'missing config/client'; return; }
    const anon = String(sb.anonKey || '').replace(/^<|>$/g, '');
    client = window.supabase.createClient(sb.url, anon);
    // checar saúde: tabela existe e leitura permitida
    try {
      const { error } = await client.from('messages').select('id').limit(1);
      if (error) { lastError = error.message || String(error); console.error('[Supabase] health check error:', error.message || error); healthy = false; return; }
      healthy = true; lastError = null;
    } catch (e) { lastError = String(e?.message || e); console.error('[Supabase] health check exception:', e); healthy = false; return; }

    await refresh();
    try {
      channel = client.channel('chat')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async () => {
          await refresh();
        })
        .subscribe();
    } catch (e) { console.warn('Realtime não pôde inscrever', e); }
  }

  window.supabaseChat = { init, getMessages, addMessage, subscribe, isHealthy, getStatus };
})();