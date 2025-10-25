exports.handler = async (event) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE' }) };
  }

  const tableUrl = `${SUPABASE_URL}/rest/v1/messages`;
  const headers = {
    'apikey': SUPABASE_SERVICE_ROLE,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Prefer': 'return=representation'
  };

  try {
    if (event.httpMethod === 'GET') {
      const qs = event.queryStringParameters || {};
      const limit = Math.max(1, Math.min(200, parseInt(qs.limit || '200', 10)));
      const offset = Math.max(0, parseInt(qs.offset || '0', 10));
      const term = (qs.q || '').trim();
      const author = (qs.author || '').trim();
      const params = [];
      params.push('select=*');
      // ordem ascendente para que novas mensagens apareçam no fim
      params.push('order=ts.asc');
      if (term && author) {
        const enc = encodeURIComponent(term);
        const encAuth = encodeURIComponent(author);
        params.push(`or=(text.ilike.*${enc}*,name.ilike.*${enc}*,author_session.eq.${encAuth})`);
      } else if (term) {
        const enc = encodeURIComponent(term);
        params.push(`or=(text.ilike.*${enc}*,name.ilike.*${enc}*)`);
      } else if (author) {
        const encAuth = encodeURIComponent(author);
        params.push(`author_session.eq.${encAuth}`);
      }
      const url = `${tableUrl}?${params.join('&')}`;
      const headersWithRange = { ...headers, 'Range': `${offset}-${offset + limit - 1}` };
      const resp = await fetch(url, { headers: headersWithRange });
      const text = await resp.text();
      let body = text ? JSON.parse(text) : [];
      return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() }, body: JSON.stringify(body) };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      console.log('[chat] POST payload', { payload });
      // Basic validation and sanitization server-side
      const row = {
        author_session: String(payload.author || '').slice(0, 64) || null,
        name: String(payload.name || '').slice(0, 140) || 'Anônimo',
        // reutiliza a coluna school para reações/likes; aceita texto/JSON
        school: payload.school ? String(payload.school).slice(0, 200) : null,
        avatar: payload.avatar ? String(payload.avatar).slice(0, 200) : null,
        text: String(payload.text || '').slice(0, 240),
        type: payload.type ? String(payload.type).slice(0, 20) : 'message',
        ts: new Date().toISOString()
      };
      const resp = await fetch(tableUrl, { method: 'POST', headers, body: JSON.stringify(row) });
      console.log('[chat] Supabase POST status', resp.status);
      if (!resp.ok) {
        const errTxt = await resp.text();
        console.error('[chat] Insert failed', errTxt);
        return { statusCode: resp.status, headers: { ...corsHeaders() }, body: JSON.stringify({ error: errTxt || 'Insert failed' }) };
      }
      const inserted = await resp.json();
      return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() }, body: JSON.stringify(inserted) };
    }

    // PATCH: atualizar reações em "school" (JSON ou número como string)
    if (event.httpMethod === 'PATCH') {
      const qs = event.queryStringParameters || {};
      const id = (qs.id || '').trim();
      const kind = (qs.kind || '').trim(); // 'like' | 'heart'
      if (!id || !kind) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Missing id or kind' }) };

      // obter a linha atual
      const getUrl = `${tableUrl}?id=eq.${encodeURIComponent(id)}&select=*`;
      const got = await fetch(getUrl, { headers });
      if (!got.ok) {
        const errTxt = await got.text();
        return { statusCode: got.status, headers: corsHeaders(), body: JSON.stringify({ error: errTxt || 'Fetch failed' }) };
      }
      const arr = await got.json();
      const cur = Array.isArray(arr) && arr[0] ? arr[0] : null;
      if (!cur) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: 'Not found' }) };

      // interpretar school
      let counts = { like: 0, heart: 0 };
      try {
        if (typeof cur.school === 'string' && cur.school.trim()) {
          const parsed = JSON.parse(cur.school);
          if (parsed && typeof parsed === 'object') counts = { like: parseInt(parsed.like || 0, 10) || 0, heart: parseInt(parsed.heart || 0, 10) || 0 };
          else counts = { like: parseInt(cur.school || '0', 10) || 0, heart: 0 };
        }
      } catch (_) { counts = { like: parseInt(cur.school || '0', 10) || 0, heart: 0 }; }

      // incrementar
      if (kind === 'like') counts.like += 1; else if (kind === 'heart') counts.heart += 1; else return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Invalid kind' }) };

      const nextSchool = JSON.stringify(counts);
      const patchUrl = `${tableUrl}?id=eq.${encodeURIComponent(id)}`;
      const updated = await fetch(patchUrl, { method: 'PATCH', headers, body: JSON.stringify({ school: nextSchool }) });
      if (!updated.ok) {
        const errTxt = await updated.text();
        return { statusCode: updated.status, headers: corsHeaders(), body: JSON.stringify({ error: errTxt || 'Patch failed' }) };
      }
      const body = await updated.json();
      return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() }, body: JSON.stringify(body) };
    }

    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: corsHeaders() };
    }

    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (e) {
    console.error('[chat] Handler exception', e);
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: String(e && e.message || e) }) };
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS'
  };
}