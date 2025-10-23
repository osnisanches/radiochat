(function(){
  let client = null;
  let bucket = 'photos';

  function dataUrlToBlob(dataUrl) {
    try {
      const [meta, b64] = String(dataUrl || '').split(',');
      const mime = /data:(.*?);base64/.exec(meta)?.[1] || 'image/jpeg';
      const bin = atob(b64 || '');
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    } catch (_) { return null; }
  }

  async function init(cfg) {
    const sb = cfg?.supabase;
    if (!sb?.url || !sb?.anonKey || typeof window.supabase === 'undefined') return;
    const anon = String(sb.anonKey || '').replace(/^<|>$/g, '');
    client = window.supabase.createClient(sb.url, anon);
    bucket = sb.bucket || 'photos';
  }

  async function uploadPhoto(dataUrl, name) {
    if (!client) return null;
    try {
      const blob = dataUrlToBlob(dataUrl);
      if (!blob) return null;
      const path = `${Date.now()}_${(name || 'foto').replace(/\s+/g,'_')}.jpg`;
      const { data, error } = await client.storage.from(bucket).upload(path, blob, { upsert: false, contentType: 'image/jpeg' });
      if (error) { console.warn('Erro upload storage', error); return null; }
      const { data: pub } = client.storage.from(bucket).getPublicUrl(path);
      const publicUrl = pub?.publicUrl || null;
      return publicUrl ? { id: path, link: publicUrl } : null;
    } catch (e) { console.warn('Falha upload Supabase Storage', e); return null; }
  }

  async function listRecent(limit = 20) {
    if (!client) return [];
    try {
      const { data, error } = await client.storage.from(bucket).list('', { limit, sortBy: { column: 'created_at', order: 'desc' } });
      if (error) return [];
      return (data || []).map((f) => {
        const { data: pub } = client.storage.from(bucket).getPublicUrl(f.name);
        return { id: f.id || f.name, name: f.name, link: pub?.publicUrl };
      });
    } catch (_) { return []; }
  }

  window.supabaseStorage = { init, uploadPhoto, listRecent };
})();