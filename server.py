#!/usr/bin/env python3
import http.server
import socketserver
import os
import re

# Hardcoded Firebase credentials
# VITE_FIREBASE_API_KEY = "AIzaSyCK24mOBx3hpjSD8KD5Qk8nvUkhZVksMgM"
# VITE_FIREBASE_PROJECT_ID = "education-5c6dc"
# VITE_FIREBASE_APP_ID = "1:805733379650:web:7ea94e29a6b13ccb3bc7db"

VITE_FIREBASE_API_KEY = "AIzaSyDVANOKviR4hZFjSti3r3zk1p0hXbqbewk"
VITE_FIREBASE_PROJECT_ID = "education-5c6dc"
VITE_FIREBASE_APP_ID = "1:805733379650:web:7ea94e29a6b13ccb3bc7db"

class ConfigurableHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def do_GET(self):
        if self.path == '/' or self.path == '/index.html':
            self.serve_index_with_config()
        else:
            super().do_GET()

    def serve_index_with_config(self):
        try:
            with open('index.html', 'r') as f:
                content = f.read()
            # Inject environment variables into the HTML
            env_script = f"""
<script>
// Environment variables injected by server
window.VITE_FIREBASE_API_KEY = "{VITE_FIREBASE_API_KEY}";
window.VITE_FIREBASE_PROJECT_ID = "{VITE_FIREBASE_PROJECT_ID}";
window.VITE_FIREBASE_APP_ID = "{VITE_FIREBASE_APP_ID}";
</script>
"""
            
            # Insert the environment script before the closing head tag
            content = content.replace('</head>', f'{env_script}</head>')
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.send_header('Content-length', str(len(content.encode())))
            self.end_headers()
            self.wfile.write(content.encode())
            
        except Exception as e:
            print(f"Error serving index.html: {e}")
            super().do_GET()

if __name__ == "__main__":
    PORT = 5001
    with socketserver.TCPServer(("0.0.0.0", PORT), ConfigurableHTTPRequestHandler) as httpd:
        print(f"Server running at http://localhost:{PORT}/")
        httpd.serve_forever()
