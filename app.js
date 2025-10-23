let deferredPrompt = null;

async function loadConfig() {
  const res = await fetch('./config.json');
  if (!res.ok) throw new Error('Falha ao carregar config.json');
  return res.json();
}

function setText(id, text, { hidden = null } = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  if (typeof text === 'string') el.textContent = text;
  if (hidden !== null) el.hidden = !!hidden;
}

function setNowPlayingText(text) {
  setText('nowPlaying', text);
}

function updatePlayPauseUI(isPlaying) {
  // botão principal
  const btnMain = document.getElementById('playPauseBtn');
  const iconMain = btnMain?.querySelector('.material-icons');
  const labelMain = btnMain?.querySelector('.btn-text');
  if (btnMain && iconMain) {
    if (isPlaying) {
      iconMain.textContent = 'pause';
      labelMain && (labelMain.textContent = 'Pausar');
      btnMain.setAttribute('aria-label', 'Pausar');
    } else {
      iconMain.textContent = 'play_arrow';
      labelMain && (labelMain.textContent = 'Reproduzir');
      btnMain.setAttribute('aria-label', 'Reproduzir');
    }
  }
  // botão no chat (barra superior do modal)
  const btnChat = document.getElementById('playPauseBtnChat');
  const iconChat = btnChat?.querySelector('.material-icons');
  if (btnChat && iconChat) {
    iconChat.textContent = isPlaying ? 'pause' : 'play_arrow';
    btnChat.setAttribute('aria-label', isPlaying ? 'Pausar' : 'Reproduzir');
  }
}

function showTrackInfo(title, artist) {
  const info = [artist, title].filter(Boolean).join(' — ');
  setText('trackInfo', info || '', { hidden: !info });

  // Media Session (controle do SO)
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || 'Rádio',
        artist: artist || '',
        album: document.getElementById('stationName')?.textContent || 'Aluno Repórter',
        artwork: [{ src: 'https://via.placeholder.com/96.png?text=AR', sizes: '96x96', type: 'image/png' }]
      });
    } catch (_) {}
  }
}

function setupPlayer(cfg) {
  const audio = document.getElementById('radioAudio');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playPauseBtnChat = document.getElementById('playPauseBtnChat');
  const volumeRange = document.getElementById('volumeRange');
  const volumeRangeChat = document.getElementById('volumeRangeChat');
  const stationName = document.getElementById('stationName');

  stationName.textContent = cfg.station.name;
  audio.src = cfg.station.primaryStream;

  // Autoplay: tenta iniciar reprodução ao carregar
  (async () => {
    try {
      await audio.play();
      updatePlayPauseUI(true);
      setNowPlayingText('Tocando...');
    } catch (err) {
      console.warn('Autoplay bloqueado pelo navegador', err);
      setNowPlayingText('Pronto. Toque em Reproduzir.');
    }
  })();

  // Restaurar preferências
  const savedVolume = parseFloat(localStorage.getItem('ar_volume'));
  if (!Number.isNaN(savedVolume)) {
    audio.volume = savedVolume;
    if (volumeRange) volumeRange.value = String(savedVolume);
    if (volumeRangeChat) volumeRangeChat.value = String(savedVolume);
  }

  const handleTogglePlay = async () => {
    try {
      if (audio.paused) {
        await audio.play();
        updatePlayPauseUI(true);
        setNowPlayingText('Tocando...');
      } else {
        audio.pause();
        updatePlayPauseUI(false);
        setNowPlayingText('Pausado');
      }
    } catch (err) {
      console.warn('Erro ao reproduzir stream principal', err);
      setNowPlayingText('Falha ao reproduzir stream principal');
      showFallback(cfg);
    }
  };

  playPauseBtn?.addEventListener('click', handleTogglePlay);
  playPauseBtnChat?.addEventListener('click', handleTogglePlay);

  const onVolumeInput = (vStr) => {
    const v = parseFloat(vStr);
    if (Number.isFinite(v)) {
      audio.volume = v;
      localStorage.setItem('ar_volume', String(v));
      if (volumeRange && volumeRange.value !== String(v)) volumeRange.value = String(v);
      if (volumeRangeChat && volumeRangeChat.value !== String(v)) volumeRangeChat.value = String(v);
    }
  };
  volumeRange?.addEventListener('input', (e) => onVolumeInput(e.target.value));
  volumeRangeChat?.addEventListener('input', (e) => onVolumeInput(e.target.value));

  audio.addEventListener('play', () => updatePlayPauseUI(true));
  audio.addEventListener('pause', () => updatePlayPauseUI(false));

  audio.addEventListener('error', () => {
    console.warn('Erro no elemento <audio>, alternando para fallback');
    setNowPlayingText('Erro no stream principal');
    showFallback(cfg);
  });

  // Se existir statusJsonUrl, tenta obter título/artista
  if (cfg.station.statusJsonUrl) {
    tryFetchingStatus(cfg.station.statusJsonUrl)
      .then(({ title, artist }) => {
        if (title || artist) showTrackInfo(title, artist);
      })
      .catch(() => {});
  }

  // MediaSession actions
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', async () => {
        await audio.play();
        updatePlayPauseUI(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audio.pause();
        updatePlayPauseUI(false);
      });
    } catch (_) {}
  }

  // Atalhos de teclado
  window.addEventListener('keydown', (e) => {
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      handleTogglePlay();
    }

    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      e.preventDefault();
      const delta = e.code === 'ArrowUp' ? 0.05 : -0.05;
      let v = Math.min(1, Math.max(0, audio.volume + delta));
      onVolumeInput(String(v));
    }
  });
}

async function tryFetchingStatus(statusUrl) {
  try {
    const res = await fetch(statusUrl, { cache: 'no-store' });
    if (!res.ok) return {};
    const contentType = res.headers.get('content-type') || '';
    const txt = await res.text();
    if (contentType.includes('application/json')) {
      const json = JSON.parse(txt);
      const flat = JSON.stringify(json);
      const titleMatch = flat.match(/"(title|song|track)"\s*:\s*"([^"]+)"/i);
      const artistMatch = flat.match(/"(artist|streamer|performer)"\s*:\s*"([^"]+)"/i);
      const title = titleMatch ? titleMatch[2] : '';
      const artist = artistMatch ? artistMatch[2] : '';
      setNowPlayingText('Conectado à transmissão (status verificado)');
      return { title, artist };
    }
    setNowPlayingText('Conectado à transmissão (status verificado)');
    return {};
  } catch (e) {
    return {};
  }
}

function showFallback(cfg) {
  const fallbackContainer = document.getElementById('fallbackContainer');
  const iframe = document.getElementById('fallbackIframe');
  fallbackContainer.classList.remove('hidden');

  if (cfg.station.fallbackEmbedPage) {
    iframe.src = cfg.station.fallbackEmbedPage;
    setNowPlayingText('Usando player alternativo');
  } else {
    setNowPlayingText('Nenhum fallback configurado');
  }
}

function renderTimeline(cfg) {
  const grid = document.getElementById('timelineContainer');
  const embed = document.getElementById('embedContainer');
  if (!grid || !embed) return;
  grid.innerHTML = '';

  if (cfg.instagram?.embedUrl) {
    embed.hidden = false;
    const iframe = document.createElement('iframe');
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer';
    iframe.src = cfg.instagram.embedUrl;
    embed.innerHTML = '';
    embed.appendChild(iframe);
  } else {
    embed.hidden = true;
  }

  const posts = Array.isArray(cfg.instagram?.posts) ? cfg.instagram.posts : [];
  posts.forEach((p) => {
    const card = document.createElement('article');
    card.className = 'post-card';

    const img = document.createElement('img');
    img.className = 'post-media';
    img.src = p.image;
    img.alt = p.caption || 'Post';

    const body = document.createElement('div');
    body.className = 'post-body';

    const meta = document.createElement('div');
    meta.className = 'post-meta';
    const user = document.createElement('span');
    user.textContent = p.username;
    const time = document.createElement('time');
    const date = new Date(p.timestamp);
    time.title = date.toISOString();
    time.textContent = date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    meta.appendChild(user);
    meta.appendChild(time);

    const caption = document.createElement('p');
    caption.className = 'post-caption';
    caption.textContent = p.caption || '';

    if (p.link) {
      const link = document.createElement('a');
      link.href = p.link;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Ver no Instagram';
      link.style.display = 'inline-block';
      link.style.marginTop = '8px';
      body.appendChild(link);
    }

    body.insertAdjacentElement('afterbegin', meta);
    body.appendChild(caption);

    card.appendChild(img);
    card.appendChild(body);

    grid.appendChild(card);
  });
}

function setupHeaderActions(cfg) {
  const shareBtn = document.getElementById('shareBtn');
  const installBtn = document.getElementById('installBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const streamSelect = document.getElementById('streamSelect');
  const volumeRangeSettings = document.getElementById('volumeRangeSettings');
  const audio = document.getElementById('radioAudio');
  const volumeRange = document.getElementById('volumeRange');
  // Novos refs para modais de mensagens e pedidos
  const messageBtn = document.getElementById('messageBtn');
  const requestBtn = document.getElementById('requestBtn');
  const identityModal = document.getElementById('identityModal');
  const chatModal = document.getElementById('chatModal');
  const closeIdentityBtn = document.getElementById('closeIdentityBtn');
  const closeChatBtn = document.getElementById('closeChatBtn');
  const editIdentityBtn = document.getElementById('editIdentityBtn');
  const requestModal = document.getElementById('requestModal');
  const closeRequestBtn = document.getElementById('closeRequestBtn');
  const reqSendQuickBtn = document.getElementById('reqSendQuickBtn');
  const pageEl = document.querySelector('.page');
  // Slider de cards
  const cardsSlider = document.getElementById('cardsSlider');
  const toggleCardBtn = document.getElementById('toggleCardBtn');
  const openChatFromCardBtn = document.getElementById('openChatFromCardBtn');
  const cardsTrack = document.querySelector('.cards-track');
  const studioCard = document.querySelector('.studio-card');
  let cardIndex = 0;
  const setCardIndex = (i) => {
    cardIndex = Math.max(0, Math.min(1, i));
    cardsSlider?.style.setProperty('--card-index', String(cardIndex));
  };
  toggleCardBtn?.addEventListener('click', () => setCardIndex(cardIndex === 0 ? 1 : 0));
  openChatFromCardBtn?.addEventListener('click', () => {
    const hasIdentity = !!localStorage.getItem('ar_identity');
    if (!hasIdentity) {
      identityModal.hidden = false;
      document.getElementById('chatName')?.focus();
    } else {
      chatModal.hidden = false;
      renderProviderStatus(cfg);
      renderChat();
      document.getElementById('chatInput')?.focus();
      pageEl?.classList.add('chat-open');
    }
  });
  // Swipe simples + arraste
  let startX = 0; let currentX = 0; let dragging = false;
  const applyDrag = (dx) => { cardsSlider?.style.setProperty('--drag-offset', `${dx}px`); };
  const endDrag = (dx) => { applyDrag(0); cardsTrack && (cardsTrack.style.transition = 'transform 240ms ease'); if (Math.abs(dx) > 60) { if (dx < 0) setCardIndex(1); else setCardIndex(0); } };
  cardsSlider?.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; dragging = true; cardsTrack && (cardsTrack.style.transition = 'none'); });
  cardsSlider?.addEventListener('touchmove', (e) => { if (!dragging) return; currentX = e.touches[0].clientX; applyDrag(currentX - startX); });
  cardsSlider?.addEventListener('touchend', (e) => { dragging = false; endDrag((e.changedTouches[0].clientX) - startX); });
  studioCard?.addEventListener('mousedown', (e) => { startX = e.clientX; dragging = true; cardsTrack && (cardsTrack.style.transition = 'none'); });
  window.addEventListener('mousemove', (e) => { if (!dragging) return; currentX = e.clientX; applyDrag(currentX - startX); });
  window.addEventListener('mouseup', (e) => { if (!dragging) return; dragging = false; endDrag(e.clientX - startX); });

  // Fluxo de mensagens: abrir identidade primeiro (se não houver), senão abrir chat
  messageBtn?.addEventListener('click', () => {
    const hasIdentity = !!localStorage.getItem('ar_identity');
    if (!hasIdentity) {
      identityModal.hidden = false;
      document.getElementById('chatName')?.focus();
    } else {
      chatModal.hidden = false;
      renderChat();
      document.getElementById('chatInput')?.focus();
      pageEl?.classList.add('chat-open');
    }
  });
  // Permitir editar identidade dentro do chat
  editIdentityBtn?.addEventListener('click', () => {
    chatModal.hidden = true; identityModal.hidden = false; document.getElementById('chatName')?.focus();
  });
  closeIdentityBtn?.addEventListener('click', () => { identityModal.hidden = true; });
  closeChatBtn?.addEventListener('click', () => { chatModal.hidden = true; pageEl?.classList.remove('chat-open'); });

  // Pedido de música rápido
  requestBtn?.addEventListener('click', () => { requestModal.hidden = false; document.getElementById('reqArtistShort')?.focus(); });
  closeRequestBtn?.addEventListener('click', () => { requestModal.hidden = true; });
  reqSendQuickBtn?.addEventListener('click', () => sendRequestQuick(cfg));

  // Configurações: abrir, fechar e salvar
  settingsBtn?.addEventListener('click', () => {
    if (!settingsModal) return;
    settingsModal.hidden = false;
    // Popular select de stream (por ora, apenas principal)
    if (streamSelect) {
      streamSelect.innerHTML = '';
      const optPrimary = document.createElement('option');
      optPrimary.value = 'primary';
      optPrimary.textContent = 'Stream principal';
      streamSelect.appendChild(optPrimary);
      const savedSel = localStorage.getItem('ar_stream') || 'primary';
      streamSelect.value = savedSel;
    }
    // Volume atual ou salvo
    if (volumeRangeSettings) {
      const savedVol = parseFloat(localStorage.getItem('ar_volume'));
      const v = Number.isFinite(savedVol) ? savedVol : (audio?.volume ?? 0.8);
      volumeRangeSettings.value = String(v);
    }
  });
  closeSettingsBtn?.addEventListener('click', () => { if (settingsModal) settingsModal.hidden = true; });
  saveSettingsBtn?.addEventListener('click', () => {
    // Salvar volume
    const v = parseFloat(volumeRangeSettings?.value || '');
    if (Number.isFinite(v)) {
      localStorage.setItem('ar_volume', String(v));
      if (audio) audio.volume = v;
      if (volumeRange && volumeRange.value !== String(v)) volumeRange.value = String(v);
      const volumeRangeChat = document.getElementById('volumeRangeChat');
      if (volumeRangeChat && volumeRangeChat.value !== String(v)) volumeRangeChat.value = String(v);
    }
    // Salvar seleção de stream
    const sel = streamSelect?.value || 'primary';
    localStorage.setItem('ar_stream', sel);
    if (audio) {
      const desiredSrc = sel === 'primary' ? cfg.station.primaryStream : cfg.station.primaryStream;
      if (audio.src !== desiredSrc) {
        try { audio.pause(); } catch(_) {}
        audio.src = desiredSrc;
        try { audio.load(); } catch(_) {}
      }
    }
    if (settingsModal) settingsModal.hidden = true;
    try { showToast('Configurações salvas', { durationMs: 1600 }); } catch(_) {}
  });

  // ESC fecha modais e restaura fundo
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      settingsModal.hidden = true;
      identityModal.hidden = true;
      chatModal.hidden = true;
      requestModal.hidden = true;
      pageEl?.classList.remove('chat-open');
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str || '');
  return div.innerHTML;
}

function getSessionId() {
  let sid = localStorage.getItem('ar_session_id');
  if (!sid) { sid = crypto.randomUUID(); localStorage.setItem('ar_session_id', sid); }
  return sid;
}

function loadIdentity(cfg) {
  const saved = JSON.parse(localStorage.getItem('ar_identity') || '{}');
  const defaultAvatar = (cfg.interaction?.avatars && cfg.interaction.avatars[0]) || 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Dog';
  return {
    name: saved.name || 'Ouvinte',
    school: saved.school || '',
    avatar: saved.avatar || defaultAvatar
  };
}

function saveIdentity(id) {
  localStorage.setItem('ar_identity', JSON.stringify(id));
}

function populateAvatarPicker(cfg) {
  const picker = document.getElementById('avatarPicker');
  if (!picker) return;
  const avatars = (cfg.interaction?.avatars || [
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Dog',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Cat',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Fox',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Panda',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Koala'
  ]).slice(0,5);
  picker.innerHTML = '';
  avatars.forEach((url, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar-dot';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', 'false');
    btn.dataset.url = url;
    const img = document.createElement('img'); img.src = url; img.alt = `Avatar ${idx+1}`; btn.appendChild(img);
    btn.addEventListener('click', () => {
      [...picker.querySelectorAll('.avatar-dot')].forEach((el) => { el.setAttribute('aria-selected', 'false'); el.setAttribute('aria-checked', 'false'); });
      btn.setAttribute('aria-selected', 'true');
      btn.setAttribute('aria-checked', 'true');
      picker.dataset.selected = url;
    });
    picker.appendChild(btn);
  });
}

function populateAvatars(cfg) {
  const sel = document.getElementById('avatarSelect');
  if (!sel) return;
  const avatars = cfg.interaction?.avatars || [
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Dog',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Cat',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Fox',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Panda',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Koala',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Tiger',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Lion'
  ];
  sel.innerHTML = '';
  avatars.forEach((url) => {
    const opt = document.createElement('option');
    opt.value = url; opt.textContent = url.includes('seed=') ? url.split('seed=')[1] : url;
    sel.appendChild(opt);
  });
}

function initIdentity(cfg) {
  const id = loadIdentity(cfg);
  populateAvatarPicker(cfg);
  const nameInput = document.getElementById('chatName');
  const schoolInput = document.getElementById('chatSchool');
  const picker = document.getElementById('avatarPicker');
  const saveBtn = document.getElementById('identitySaveBtn');
  if (nameInput) nameInput.value = id.name;
  if (schoolInput) schoolInput.value = id.school;
  // Pré-selecionar avatar atual
  const current = id.avatar;
  [...(picker?.querySelectorAll('.avatar-dot') || [])].forEach((el) => {
    if (el.dataset.url === current) { el.setAttribute('aria-selected','true'); el.setAttribute('aria-checked','true'); picker.dataset.selected = current; }
  });
  function completeIdentity() {
    const nameVal = (nameInput?.value || '').trim();
    if (!nameVal) {
      if (nameInput) nameInput.setAttribute('aria-invalid', 'true');
      nameInput?.focus();
      return;
    }
    if (nameInput) nameInput.removeAttribute('aria-invalid');
    const updated = {
      name: nameVal.slice(0, 40),
      school: (schoolInput?.value || '').trim().slice(0, 40),
      avatar: picker?.dataset.selected || current
    };
    saveIdentity(updated);
    // Fechar identidade e abrir chat imediatamente
    const identityModal = document.getElementById('identityModal');
    const chatModal = document.getElementById('chatModal');
    const pageEl = document.querySelector('.page');
    if (identityModal) identityModal.hidden = true;
    if (chatModal) {
      chatModal.hidden = false;
      renderChat();
      document.getElementById('chatInput')?.focus();
      pageEl?.classList.add('chat-open');
    }
  }
  saveBtn?.addEventListener('click', () => completeIdentity());
  // Salvar com Enter em qualquer campo
  [nameInput, schoolInput].forEach((el) => {
    el?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); completeIdentity(); }
    });
  });
}

function pruneOld(items, days = 7) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return items.filter((it) => (it.ts || 0) >= cutoff);
}

function readStore(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return fallback; }
}
function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function renderChat() {
  const list = document.getElementById('chatList');
  if (!list) return;
  const msgs = (window.chatService && typeof window.chatService.getMessages === 'function') ? window.chatService.getMessages() : [];
  list.innerHTML = '';
  const sid = getSessionId();
  msgs.forEach((m) => {
    const isMine = m.author === sid;
    const li = document.createElement('li');
    li.className = `message-item ${isMine ? 'mine' : 'theirs'}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    const img = document.createElement('img');
    img.src = m.avatar; img.alt = 'avatar';
    avatar.appendChild(img);

    const bubble = document.createElement('div');
    const bubbleClasses = ['bubble'];
    if (m.type === 'request') bubbleClasses.push('request');
    bubble.className = bubbleClasses.join(' ');

    // Sempre mostrar o nome do usuário
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = m.name + (m.school ? ` · ${m.school}` : '');
    bubble.appendChild(name);

    if (m.type === 'request') {
      const title = document.createElement('span');
      title.className = 'title';
      title.textContent = 'Pedido do ouvinte!';
      bubble.appendChild(title);
    }

    const text = document.createElement('p');
    text.textContent = m.text;
    bubble.appendChild(text);

    const time = document.createElement('span');
    time.className = 'time';
    const dt = new Date(m.ts || Date.now());
    time.textContent = `${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    bubble.appendChild(time);

    if (isMine) {
      li.appendChild(bubble);
    } else {
      li.appendChild(avatar);
      li.appendChild(bubble);
    }

    list.appendChild(li);
  });

  // Autoscroll: rolar para o fim sempre que renderizar
  try { list.scrollTop = list.scrollHeight; } catch (_) {}
}

function showToast(message, opts = {}) {
  try {
    const duration = opts.duration || 4000;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'alert');
    toast.textContent = String(message || '');
    document.body.appendChild(toast);
    // force reflow then show
    getComputedStyle(toast).opacity;
    toast.classList.add('visible');
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => { toast.remove(); }, 300);
    }, duration);
  } catch (_) {}
}
async function sendChatMessage(cfg) {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const text = (input.value || '').trim();
  if (!text) return;
  const id = loadIdentity(cfg);
  const sid = getSessionId();
  const msg = {
    id: crypto.randomUUID(),
    text,
    name: id.name,
    school: id.school,
    avatar: id.avatar,
    ts: Date.now(),
    reactions: { like: [], heart: [] },
    author: sid,
    type: document.getElementById('chatRequestBtn')?.getAttribute('aria-pressed') === 'true' ? 'request' : 'message'
  };
  if (!(window.chatService && typeof window.chatService.addMessage === 'function')) {
    showToast('Chat indisponível.');
    return;
  }
  let ok = true;
  try {
    const res = window.chatService.addMessage(msg);
    if (res && typeof res.then === 'function') ok = await res; else ok = true;
  } catch (e) { ok = false; }
  input.value = '';
  renderChat();
  if (!ok) {
    showToast('Falha ao enviar mensagem.');
  }
}

function toggleReaction(messageId, kind) {
  const sid = getSessionId();
  let msgs = readStore('ar_chat_messages');
  msgs = msgs.map((m) => {
    if (m.id !== messageId) return m;
    const arr = (m.reactions?.[kind] || []);
    const has = arr.includes(sid);
    const next = has ? arr.filter((x) => x !== sid) : [...arr, sid];
    m.reactions = Object.assign({}, m.reactions, { [kind]: next });
    return m;
  });
  writeStore('ar_chat_messages', msgs);
  renderChat();
}

function renderRequests() {
  const list = document.getElementById('requestsList');
  if (!list) return;
  let reqs = pruneOld(readStore('ar_music_requests'), 7);
  writeStore('ar_music_requests', reqs);
  list.innerHTML = '';
  reqs.forEach((r) => {
    const li = document.createElement('li');
    li.className = 'request-item';
    const dt = new Date(r.ts);
    li.textContent = `${r.artist} — ${r.song} \u00B7 por ${r.name} (${dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })})`;
    list.appendChild(li);
  });
}

function sendRequestQuick(cfg) {
  const artist = document.getElementById('reqArtistShort');
  const song = document.getElementById('reqSongShort');
  if (!artist || !song) return;
  const a = (artist.value || '').trim();
  const s = (song.value || '').trim();
  if (!a || !s) return;
  const id = loadIdentity(cfg);
  const req = { id: crypto.randomUUID(), artist: a.slice(0, 80), song: s.slice(0, 80), name: id.name, ts: Date.now() };
  const reqs = pruneOld(readStore('ar_music_requests'), 7);
  reqs.push(req);
  writeStore('ar_music_requests', reqs);
  // Também enviar para o chat como mensagem de pedido
  const sid = getSessionId();
  const msg = {
    id: crypto.randomUUID(),
    text: `${req.artist} — ${req.song}`,
    name: id.name,
    phone: id.phone,
    avatar: id.avatar,
    ts: Date.now(),
    author: sid,
    type: 'request'
  };
  if (window.chatService && typeof window.chatService.addMessage === 'function') {
    window.chatService.addMessage(msg);
  } else {
    showToast('Chat indisponível.');
  }
  renderChat();

  artist.value = ''; song.value = '';
  document.getElementById('requestModal').hidden = true;
}

function sendRequest(cfg) {
  const artist = document.getElementById('reqArtist');
  const song = document.getElementById('reqSong');
  if (!artist || !song) return;
  const a = (artist.value || '').trim();
  const s = (song.value || '').trim();
  if (!a || !s) return;
  const id = loadIdentity(cfg);
  const req = { id: crypto.randomUUID(), artist: a.slice(0, 80), song: s.slice(0, 80), name: id.name, ts: Date.now() };
  const reqs = pruneOld(readStore('ar_music_requests'), 7);
  reqs.push(req);
  writeStore('ar_music_requests', reqs);

  // Também enviar para o chat como mensagem de pedido
  const sid = getSessionId();
  const msg = {
    id: crypto.randomUUID(),
    text: `${req.artist} — ${req.song}`,
    name: id.name,
    phone: id.phone,
    avatar: id.avatar,
    ts: Date.now(),
    author: sid,
    type: 'request'
  };
  if (window.chatService && typeof window.chatService.addMessage === 'function') {
    window.chatService.addMessage(msg);
  } else {
    showToast('Chat indisponível.');
  }
  renderChat();

  artist.value = ''; song.value = '';
  renderRequests();
}

function renderGallery() {
  const container = document.getElementById('galleryContainer');
  if (!container) return;
  let photos = readStore('ar_photos');
  // limitar a 20
  if (photos.length > 20) photos = photos.slice(photos.length - 20);
  writeStore('ar_photos', photos);
  container.innerHTML = '';
  photos.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'gallery-item';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = p.src; img.alt = 'Foto da rádio';
    const time = document.createElement('time');
    const dt = new Date(p.ts);
    time.textContent = dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    card.appendChild(img);
    card.appendChild(time);
    container.appendChild(card);
  });
}

async function fileToDataUrl(file, maxW = 1024) {
  const img = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = fr.result;
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, maxW / img.width);
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

async function publishPhoto(cfg) {
  const fileInput = document.getElementById('photoFileInput');
  const urlInput = document.getElementById('photoUrlInput');
  let src = '';
  let uploaded = null;
  if (fileInput?.files?.[0]) {
    try {
      const dataUrl = await fileToDataUrl(fileInput.files[0]);
      // tentar enviar ao Google Drive, se configurado
      if (window.drive && typeof window.drive.uploadPhoto === 'function') {
        uploaded = await window.drive.uploadPhoto(dataUrl, fileInput.files[0].name);
        if (uploaded?.link) src = uploaded.link; else src = dataUrl;
      } else {
        src = dataUrl;
      }
    } catch { alert('Falha ao processar imagem.'); return; }
  } else if (urlInput?.value) {
    src = urlInput.value.trim();
  } else {
    alert('Selecione um arquivo ou informe a URL.');
    return;
  }
  const photos = readStore('ar_photos');
  photos.push({ id: crypto.randomUUID(), src, ts: Date.now() });
  // manter últimas 20
  const trimmed = photos.length > 20 ? photos.slice(photos.length - 20) : photos;
  writeStore('ar_photos', trimmed);
  if (fileInput) fileInput.value = '';
  if (urlInput) urlInput.value = '';
  renderGallery();
}

function setupAdmin(cfg) {
  const gate = document.getElementById('adminGate');
  const panel = document.getElementById('adminPanel');
  const passInput = document.getElementById('adminPasscodeInput');
  const enterBtn = document.getElementById('adminEnterBtn');
  const sendPhotoBtn = document.getElementById('photoSendBtn');

  // Se a UI de admin não existe na página, não faz nada.
  if (!gate && !panel && !enterBtn && !sendPhotoBtn) return;

  enterBtn?.addEventListener('click', () => {
    const provided = (passInput?.value || '').trim();
    const pass = cfg.interaction?.adminPasscode || 'radio-admin';
    if (provided && provided === pass) {
      if (gate) gate.hidden = true; if (panel) panel.hidden = false;
    } else {
      alert('Código incorreto.');
    }
  });
  sendPhotoBtn?.addEventListener('click', () => publishPhoto(cfg));
}

function setupInteractions(cfg) {
  // identidade
  initIdentity(cfg);

  // chat
  const sendBtn = document.getElementById('chatSendBtn');
  const chatInput = document.getElementById('chatInput');
  const chatRequestBtn = document.getElementById('chatRequestBtn');

  let composerMode = 'message'; // 'message' | 'request'
  const updateComposerUi = () => {
    if (!chatInput || !chatRequestBtn) return;
    if (composerMode === 'request') {
      chatInput.placeholder = 'Qual música/artista?';
      chatRequestBtn.setAttribute('aria-pressed', 'true');
      chatRequestBtn.classList.add('primary');
    } else {
      chatInput.placeholder = 'Escreva uma mensagem...';
      chatRequestBtn.setAttribute('aria-pressed', 'false');
      chatRequestBtn.classList.remove('primary');
    }
  };
  updateComposerUi();

  chatRequestBtn?.addEventListener('click', () => {
    composerMode = composerMode === 'request' ? 'message' : 'request';
    updateComposerUi();
    chatInput?.focus();
  });

  function sendRequestFromComposer() {
    if (!chatInput) return;
    const raw = (chatInput.value || '').trim();
    if (!raw) return;
    const id = loadIdentity(cfg);

    // tentativa de split "artista — música" ou "artista - música" ou "música / artista"
    let artist = '';
    let song = '';
    const parts = raw.split(/\s*[—\-\/|]\s*/);
    if (parts.length >= 2) {
      artist = parts[0].slice(0, 80);
      song = parts[1].slice(0, 80);
    } else {
      song = raw.slice(0, 80);
    }

    const req = { id: crypto.randomUUID(), artist, song, name: id.name, ts: Date.now() };
    const reqs = pruneOld(readStore('ar_music_requests'), 7);
    reqs.push(req);
    writeStore('ar_music_requests', reqs);

    const sid = getSessionId();
    const msg = {
      id: crypto.randomUUID(),
      text: artist && song ? `${artist} — ${song}` : song || raw,
      name: id.name,
      phone: id.phone,
      avatar: id.avatar,
      ts: Date.now(),
      author: sid,
      type: 'request'
    };
    const msgs = pruneOld(readStore('ar_chat_messages'), 7);
    msgs.push(msg);
    writeStore('ar_chat_messages', msgs);
    renderChat();

    chatInput.value = '';
    composerMode = 'message';
    updateComposerUi();
  }

  function sendCurrent() {
    if (composerMode === 'request') sendRequestFromComposer();
    else sendChatMessage(cfg);
  }

  sendBtn?.addEventListener('click', () => sendCurrent());
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendCurrent(); }
  });

  renderChat();

  // pedidos de música (antigo)
  const reqBtn = document.getElementById('reqSendBtn');
  reqBtn?.addEventListener('click', () => sendRequest(cfg));
  renderRequests();

  // galeria/admin
  setupAdmin(cfg);
  renderGallery();
}

(async function init() {
  try {
    const cfg = await loadConfig();

    // Preferir API server-side (Netlify/Vercel) para zero exposição
    try {
      await window.apiChat?.init?.();
      window.chatService = window.apiChat?.isHealthy?.() ? window.apiChat : null;
    } catch (_) {
      window.chatService = null;
    }

    setupPlayer(cfg);
    renderTimeline(cfg);
    setupHeaderActions(cfg);
    setupInteractions(cfg);
    renderProviderStatus(cfg);

    // Assinar atualizações do chat para rerender
    try { window.chatService?.subscribe(() => { renderChat(); }); } catch (_) {}

    registerServiceWorker();
  } catch (err) {
    console.error(err);
    alert('Falha ao iniciar a aplicação. Verifique os arquivos.');
  }
})();

function renderProviderStatus(cfg) {
  try {
    const status = window.apiChat?.getStatus?.();
    const container = document.querySelector('#chatModal .modal-header .modal-actions');
    if (!container) return;
    let badge = document.getElementById('providerStatusBadge');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'providerStatusBadge';
      badge.className = 'provider-badge';
      container.prepend(badge);
    }
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSendBtn');
    const reqBtn = document.getElementById('chatRequestBtn');
    if (status?.healthy) {
      badge.textContent = 'Conectado: API';
      badge.setAttribute('aria-label', 'Chat conectado via endpoint seguro');
      if (input) { input.disabled = false; input.placeholder = 'Escreva sua mensagem...'; }
      if (sendBtn) sendBtn.disabled = false;
      if (reqBtn) reqBtn.disabled = false;
    } else {
      const reason = status?.lastError ? ` — ${String(status.lastError).slice(0,80)}` : '';
      badge.textContent = 'Chat indisponível';
      badge.setAttribute('aria-label', `Backend indisponível${reason}`);
      if (input) { input.disabled = true; input.placeholder = 'Chat indisponível'; }
      if (sendBtn) sendBtn.disabled = true;
      if (reqBtn) reqBtn.disabled = true;
    }
  } catch (_) {}
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try { navigator.serviceWorker.register('./sw.js'); } catch (_) {}
  }
}