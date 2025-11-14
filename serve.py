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

    def end_headers(self):
        # Enable CORS for all requests
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Cache control
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def run_server(port=3000):
    """Start the HTTP server"""
    # Change to directory where files are located
    # In Docker: /app, otherwise try to find sun-simulator
    if os.path.exists('/app/index.html'):
        os.chdir('/app')
    elif os.path.exists('/workspaces/ord-options-testing/sun-simulator'):
        os.chdir('/workspaces/ord-options-testing/sun-simulator')
    # else: stay in current directory

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
