(function(){
  let ready = false;
  let gcfg = null;

  async function loadGapi() {
    if (window.gapi) return;
    await new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://apis.google.com/js/api.js';
      s.async = true; s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }

  async function init(cfg) {
    gcfg = cfg?.google || null;
    if (!gcfg?.apiKey || !gcfg?.clientId) { ready = false; return; }
    await loadGapi();
    await new Promise((resolve) => { try { gapi.load('client:auth2', resolve); } catch (_) { resolve(); } });
    try {
      await gapi.client.init({
        apiKey: gcfg.apiKey,
        clientId: gcfg.clientId,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        scope: 'https://www.googleapis.com/auth/drive.file'
      });
      ready = true;
    } catch (e) {
      console.warn('Falha ao inicializar Drive API', e);
      ready = false;
    }
  }

  async function signIn() {
    try { await gapi.auth2.getAuthInstance().signIn(); } catch (_) {}
  }

  async function uploadPhoto(dataUrl, name) {
    if (!ready) return null;
    try {
      if (!gapi.auth2.getAuthInstance().isSignedIn.get()) await signIn();
      const base64 = String(dataUrl || '').split(',')[1] || '';
      const meta = {
        name: name || `foto_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        parents: gcfg?.driveFolderId ? [gcfg.driveFolderId] : undefined
      };
      const boundary = 'drive_up_' + Math.random().toString(36).slice(2);
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64}\r\n--${boundary}--`;
      const token = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;
      const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'multipart/related; boundary=' + boundary
        },
        body
      });
      const file = await resp.json();
      try {
        await gapi.client.request({ path: `/drive/v3/files/${file.id}/permissions`, method: 'POST', body: { role: 'reader', type: 'anyone' } });
      } catch (_) {}
      const link = `https://drive.google.com/uc?id=${file.id}&export=download`;
      return { id: file.id, link };
    } catch (e) {
      console.warn('Upload para Drive falhou', e);
      return null;
    }
  }

  async function listRecent(limit = 20) {
    if (!ready) return [];
    try {
      const res = await gapi.client.drive.files.list({
        pageSize: limit,
        fields: 'files(id, name, webViewLink, webContentLink)',
        q: gcfg?.driveFolderId ? `'${gcfg.driveFolderId}' in parents` : undefined
      });
      return res?.result?.files || [];
    } catch (e) { return []; }
  }

  window.drive = { init, uploadPhoto, listRecent };
})();