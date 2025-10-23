(function(){
  const KEY = 'ar_chat_messages';
  const subscribers = new Set();
  let bc = null;

  function prune(items, days = 7) {
    try {
      const maxAge = days * 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - maxAge;
      return (items || []).filter((m) => (m?.ts || 0) >= cutoff);
    } catch (_) { return items || []; }
  }

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; }
  }
  function write(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items || [])); } catch (_) {}
  }

  function notify() {
    subscribers.forEach((fn) => { try { fn(); } catch (_) {} });
  }

  function getMessages() {
    const msgs = prune(read(), 7);
    write(msgs);
    return msgs;
  }

  function addMessage(msg) {
    const msgs = getMessages();
    msgs.push(msg);
    write(msgs);
    notify();
    try { bc?.postMessage({ type: 'message-added' }); } catch (_) {}
  }

  function init() {
    try {
      bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ar_chat') : null;
      if (bc) bc.onmessage = (ev) => { if (ev?.data?.type === 'message-added') notify(); };
      window.addEventListener('storage', (e) => { if (e.key === KEY) notify(); });
    } catch (_) {}
  }

  function subscribe(fn) {
    if (typeof fn === 'function') subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  window.chatService = { init, getMessages, addMessage, subscribe };
})();