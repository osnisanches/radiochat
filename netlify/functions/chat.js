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
      const limit = parseInt((event.queryStringParameters || {}).limit || '200', 10);
      const resp = await fetch(`${tableUrl}?select=*&order=ts.asc&limit=${limit}`, { headers });
      const text = await resp.text();
      const body = text ? JSON.parse(text) : [];
      return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() }, body: JSON.stringify(body) };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      console.log('[chat] POST payload', { payload });
      // Basic validation and sanitization server-side
      const row = {
        author_session: String(payload.author || '').slice(0, 64) || null,
        name: String(payload.name || '').slice(0, 80) || 'Anônimo',
        school: payload.school ? String(payload.school).slice(0, 80) : null,
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
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };
}