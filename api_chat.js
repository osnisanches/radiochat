(function(){
  let base = '/.netlify/functions/chat';
  let healthy = false;
  let lastError = null;
  let cache = [];
  const subscribers = new Set();

  function notify(){ subscribers.forEach((fn)=>{ try{ fn(); }catch(_){} }); }
  function getMessages(){ return cache.slice(); }
  function isHealthy(){ return !!healthy; }
  function getStatus(){ return { healthy, lastError }; }
  function setBase(b){ base = b; }

  async function detectBase(){
    // tenta Netlify, depois Vercel; só marca healthy se resposta válida (array)
    try {
      const r = await fetch('/.netlify/functions/chat?limit=1', { cache: 'no-store' });
      if (r.ok) {
        let data = null;
        try { data = await r.json(); } catch(_) { data = null; }
        if (Array.isArray(data)) { base = '/.netlify/functions/chat'; healthy = true; lastError = null; return; }
      }
    } catch (_) {}
    try {
      const r = await fetch('/api/chat?limit=1', { cache: 'no-store' });
      if (r.ok) {
        let data = null;
        try { data = await r.json(); } catch(_) { data = null; }
        if (Array.isArray(data)) { base = '/api/chat'; healthy = true; lastError = null; return; }
      }
    } catch (_) {}
    healthy = false;
    lastError = lastError || 'Resposta inválida do backend';
  }

  async function refresh(limit = 200){
    try {
      const r = await fetch(`${base}?limit=${limit}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('Falha ao listar mensagens');
      const data = await r.json();
      if (Array.isArray(data)) { cache = data; healthy = true; lastError = null; notify(); }
      else { healthy = false; lastError = 'Resposta inválida do backend'; notify(); }
    } catch (e) { healthy = false; lastError = String(e.message || e); notify(); }
  }

  async function addMessage(msg){
    try {
      const r = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg)
      });
      if (!r.ok) throw new Error('Falha ao enviar mensagem');
      lastError = null;
      await refresh();
      return true;
    } catch (e) { lastError = String(e.message || e); healthy = false; notify(); return false; }
  }

  async function react(id, kind){
    try {
      const url = `${base}?id=${encodeURIComponent(id)}&kind=${encodeURIComponent(kind)}`;
      const r = await fetch(url, { method: 'PATCH' });
      if (!r.ok) throw new Error('Falha ao registrar reação');
      lastError = null;
      await refresh();
      return true;
    } catch(e){ lastError = String(e.message || e); healthy = false; notify(); return false; }
  }

  function subscribe(handler){
    if (typeof handler === 'function') subscribers.add(handler);
    return ()=> subscribers.delete(handler);
  }

  async function init(){
    await detectBase();
    if (healthy) await refresh(); else notify();
  }

  window.apiChat = { init, getMessages, addMessage, react, subscribe, isHealthy, getStatus, setBase };
})();