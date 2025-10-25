exports.handler = async (event) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  // Do NOT fail early: allow auth_check even when Supabase is not configured
  const headersBase = {
    'apikey': SUPABASE_SERVICE_ROLE,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`
  };

  const token = (event.headers['x-admin-token'] || event.headers['X-Admin-Token'] || '').trim();
  const method = event.httpMethod;

  function json(status, body, extraHeaders = {}) {
    return {
      statusCode: status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...extraHeaders },
      body: JSON.stringify(body)
    };
  }

  function corsHeaders(){
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
    };
  }

  async function ensureBucket(name, isPublic){
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return false;
    const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${name}`, { headers: headersBase });
    if (r.status === 200) return true;
    const c = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST', headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, public: !!isPublic })
    });
    return c.ok;
  }

  async function listPhotos(){
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return { urls: [], names: [], mode: 'single', featured: null };
    await ensureBucket('cover', true);
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/cover`, {
      method: 'POST', headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: 100 })
    });
    if (!r.ok) return { urls: [], names: [], mode: 'single', featured: null };
    const items = await r.json();
    const names = (Array.isArray(items) ? items : []).filter(i => !i.name.endsWith('.json')).map(i => i.name);
    const modeCfg = await fetch(`${SUPABASE_URL}/storage/v1/object/public/cover/cover.json`, { headers: headersBase });
    let mode = 'single';
    let featured = null;
    try {
      if (modeCfg.ok) { const data = await modeCfg.json(); mode = data.mode || 'single'; featured = data.featured || null; }
    } catch(_){ }
    const urls = names.map(n => `${SUPABASE_URL}/storage/v1/object/public/cover/${encodeURIComponent(n)}`);
    return { urls, names, mode, featured };
  }

  async function setCoverConfig(cfg){
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return false;
    await ensureBucket('cover', true);
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/cover/cover.json`, {
      method: 'PUT', headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg || {})
    });
    return r.ok;
  }

  async function uploadPhoto(filename, contentType, base64Data){
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return null;
    await ensureBucket('cover', true);
    const bin = Buffer.from(base64Data, 'base64');
    const name = `${Date.now()}_${(filename || 'photo').replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/cover/${encodeURIComponent(name)}`, {
      method: 'POST', headers: { ...headersBase, 'Content-Type': contentType || 'application/octet-stream' },
      body: bin
    });
    if (!r.ok) return null;
    const listed = await listPhotos();
    if (listed.names.length > 10) {
      const sorted = listed.names.slice().sort();
      const toDelete = sorted.slice(0, sorted.length - 10);
      await Promise.all(toDelete.map(n => fetch(`${SUPABASE_URL}/storage/v1/object/cover/${encodeURIComponent(n)}`, { method: 'DELETE', headers: headersBase })));
    }
    return name;
  }

  async function deletePhoto(name){
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return false;
    await ensureBucket('cover', true);
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/cover/${encodeURIComponent(name)}`, { method: 'DELETE', headers: headersBase });
    return r.ok;
  }



  try {
    if (method === 'OPTIONS') return { statusCode: 204, headers: corsHeaders() };

    const qs = event.queryStringParameters || {};
    const isPhotos = qs.type === 'photos';
    const isModeration = qs.type === 'moderation';

    if (method === 'GET') {
      if (isPhotos) {
        const data = await listPhotos();
        return json(200, data);
      }

      return json(404, { error: 'Unknown GET' });
    }

    if (method === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      const action = payload.action;
      if (action === 'auth_check') {
        const ok = !!ADMIN_PASSWORD && token === ADMIN_PASSWORD;
        return json(ok ? 200 : 401, { ok });
      }
      if (!ADMIN_PASSWORD || token !== ADMIN_PASSWORD) {
        return json(401, { error: 'Unauthorized' });
      }
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
        return json(500, { error: 'Supabase not configured' });
      }
      if (action === 'upload_photo') {
        const name = await uploadPhoto(payload.filename, payload.contentType, payload.data);
        if (!name) return json(500, { error: 'Upload failed' });
        return json(200, { ok: true, name });
      }
      if (action === 'set_cover_mode') {
        const ok = await setCoverConfig({ mode: payload.mode || 'single', featured: payload.featured || null });
        return json(ok ? 200 : 500, { ok });
      }
      if (action === 'delete_photo') {
        const ok = await deletePhoto(payload.name);
        return json(ok ? 200 : 500, { ok });
      }

      return json(400, { error: 'Unknown action' });
    }

    if (method === 'DELETE') {
      const qsName = (event.queryStringParameters || {}).name;
      if (!ADMIN_PASSWORD || token !== ADMIN_PASSWORD) return json(401, { error: 'Unauthorized' });
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return json(500, { error: 'Supabase not configured' });
      if (!qsName) return json(400, { error: 'Missing name' });
      const ok = await deletePhoto(qsName);
      return json(ok ? 200 : 500, { ok });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (e) {
    console.error('[admin] exception', e);
    return json(500, { error: String(e?.message || e) });
  }
};