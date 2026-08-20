#!/usr/bin/env python3
"""
Simple HTTP server for Sun Simulator application
Serves static files with proper MIME types and CDN resources
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import sys

class SunSimulatorHandler(SimpleHTTPRequestHandler):
    """Custom handler with CORS enabled and proper MIME types"""

    def send_response(self, code, message=None):
        # Record the status so end_headers can tell real vendor responses
        # from error responses
        self._status_code = code
        super().send_response(code, message)

    def end_headers(self):
        # Enable CORS for all requests
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Cache control: long-lived for vendor files, no-cache for everything
        # else. Never stamp immutable on a non-200 — a 404 cached with
        # max-age=31536000, immutable sits in CDNs (observed with Cloudflare
        # on sunsim.jedarden.com 2026-08-20) until it expires.
        if self.path.startswith('/vendor/') and getattr(self, '_status_code', 200) == 200:
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
        else:
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        # Lightweight liveness probe so health checks don't transfer the
        # full index.html on every interval
        if self.path.split('?')[0] == '/healthz':
            body = b'ok\n'
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

def run_server(port=3000):
    """Start the HTTP server"""
    # Change to directory where files are located
    # In Docker: /app, otherwise try to find sun-simulator
    if os.path.exists('/app/index.html'):
        os.chdir('/app')
    elif os.path.exists('/workspaces/ord-options-testing/sun-simulator'):
        os.chdir('/workspaces/ord-options-testing/sun-simulator')
    # else: stay in current directory

    # Bind all interfaces — Docker maps the container port to the host, so
    # binding localhost would leave the published port unreachable.
    server_address = ('0.0.0.0', port)
    httpd = HTTPServer(server_address, SunSimulatorHandler)

    print(f'\n🌞 Sun Simulator Server Starting...\n')
    print(f'   Local:   http://localhost:{port}')
    print(f'   Network: http://0.0.0.0:{port}')
    print(f'\n   Press Ctrl+C to stop the server\n')

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n\n🛑 Server stopped.\n')
        httpd.shutdown()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    run_server(port)
