#!/usr/bin/env python3
import os
import json
import uuid
import time
import datetime
import urllib.request
import urllib.error
import http.server
import socketserver

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(ROOT_DIR, 'config.json')

def _read_config():
    try:
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[server] Falha ao ler config.json: {e}")
        return {}

def _supabase_headers(key):
    # aceita anonKey com ou sem <>
    k = str(key or '').strip().strip('<>').strip()
    return {
        'apikey': k,
        'Authorization': f'Bearer {k}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }

def _http_get(url, headers=None, timeout=10):
    req = urllib.request.Request(url, headers=headers or {}, method='GET')
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read()
        return resp.status, resp.getheaders(), body

def _http_post(url, data_bytes, headers=None, timeout=10):
    req = urllib.request.Request(url, data=data_bytes, headers=headers or {}, method='POST')
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read()
        return resp.status, resp.getheaders(), body

def run_supabase_test():
    cfg = _read_config()
    sb = (cfg.get('supabase') or {})
    url = (sb.get('url') or '').rstrip('/')
    key = sb.get('anonKey') or ''

    print('[server] Iniciando teste provisório do Supabase...')
    if not url or not key:
        print('[server] Configuração Supabase ausente: url/anonKey não definidos.')
        return {'ok': False, 'reason': 'missing_config'}

    headers = _supabase_headers(key)
    base = url + '/rest/v1'
    table = base + '/messages'

    # 1) health check: leitura
    try:
        status, hdrs, body = _http_get(table + '?select=id&limit=1', headers=headers)
        if status == 200:
            print('[server] Leitura OK (health check).')
        else:
            print(f'[server] Falha leitura ({status}). Resposta: {body.decode("utf-8", errors="ignore")[:200]}')
            return {'ok': False, 'reason': 'read_failed', 'status': status}
    except urllib.error.HTTPError as e:
        err = e.read().decode('utf-8', errors='ignore')
        print(f'[server] Erro HTTP na leitura: {e.code} — {err[:200]}')
        return {'ok': False, 'reason': 'read_http_error', 'status': e.code, 'body': err}
    except Exception as e:
        print(f'[server] Exceção na leitura: {e}')
        return {'ok': False, 'reason': 'read_exception', 'error': str(e)}

    # 2) insert de teste
    payload = {
        'author_session': f'server_test_{uuid.uuid4().hex[:8]}',
        'name': 'ServerTester',
        'school': None,
        'avatar': None,
        'text': 'hello from server.py',
        'type': 'message',
        'ts': datetime.datetime.utcnow().isoformat() + 'Z'
    }
    try:
        status, hdrs, body = _http_post(table, json.dumps(payload).encode('utf-8'), headers=headers)
        if status in (200, 201):
            print('[server] Insert OK (mensagem de teste criada).')
        else:
            print(f'[server] Falha insert ({status}). Resposta: {body.decode("utf-8", errors="ignore")[:300]}')
            return {'ok': False, 'reason': 'insert_failed', 'status': status}
    except urllib.error.HTTPError as e:
        err = e.read().decode('utf-8', errors='ignore')
        print(f'[server] Erro HTTP no insert: {e.code} — {err[:300]}')
        return {'ok': False, 'reason': 'insert_http_error', 'status': e.code, 'body': err}
    except Exception as e:
        print(f'[server] Exceção no insert: {e}')
        return {'ok': False, 'reason': 'insert_exception', 'error': str(e)}

    print('[server] Teste Supabase concluído com sucesso.')
    return {'ok': True}

class Handler(http.server.SimpleHTTPRequestHandler):
    # Servir arquivos a partir da raiz do projeto
    def translate_path(self, path):
        # base no ROOT_DIR
        path = super().translate_path(path)
        # Garantir que usa ROOT_DIR
        rel = os.path.relpath(path, os.getcwd())
        return os.path.join(ROOT_DIR, rel)

def main(port=8000):
    os.chdir(ROOT_DIR)
    result = run_supabase_test()
    if not result.get('ok'):
        print('[server] Supabase indisponível. O frontend usará chat local (fallback).')
    else:
        print('[server] Supabase saúde OK. Chat deve conectar ao backend.')

    with socketserver.TCPServer(('', port), Handler) as httpd:
        print(f'[server] Servindo em http://localhost:{port}/  (Ctrl+C para parar)')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n[server] Encerrando servidor.')

if __name__ == '__main__':
    main()