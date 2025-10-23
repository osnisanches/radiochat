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
    // tenta Netlify, depois Vercel
    try {
      const r = await fetch('/.netlify/functions/chat?limit=1', { cache: 'no-store' });
      if (r.ok) { base = '/.netlify/functions/chat'; healthy = true; return; }
    } catch (_) {}
    try {
      const r = await fetch('/api/chat?limit=1', { cache: 'no-store' });
      if (r.ok) { base = '/api/chat'; healthy = true; return; }
    } catch (_) {}
    healthy = false;
  }

  async function refresh(limit = 200){
    try {
      const r = await fetch(`${base}?limit=${limit}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('Falha ao listar mensagens');
      const data = await r.json();
      if (Array.isArray(data)) { cache = data; notify(); }
    } catch (e) { lastError = String(e.message || e); }
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
    } catch (e) { lastError = String(e.message || e); return false; }
  }

  function subscribe(handler){
    if (typeof handler === 'function') subscribers.add(handler);
    return ()=> subscribers.delete(handler);
  }

  async function init(){
    await detectBase();
    if (healthy) await refresh();
  }

  window.apiChat = { init, getMessages, addMessage, subscribe, isHealthy, getStatus, setBase };
})();