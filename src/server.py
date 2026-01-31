import http.server
import socketserver
import json
import torch
import io
import os
import base64
import webbrowser
import threading
import time
import socket
import argparse
import urllib.parse
from pathlib import Path
from urllib.parse import urlparse, parse_qs

# Configuration
PORT = 8000
SRC_DIR = Path(__file__).parent.absolute()
PROJECT_ROOT = SRC_DIR.parent

def extract_bone_name(full_name):
    if not full_name: return "Unknown"
    parts = full_name.split('_')
    if len(parts) >= 2:
        bone_name = parts[-2] if parts[-1].isdigit() else parts[-1]
        return bone_name
    return full_name.split('--')[-1]

class IntegratedHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Serve files from the 'src' directory
        super().__init__(*args, directory=str(SRC_DIR), **kwargs)

    def do_POST(self):
        if self.path == '/api/convert_pt':
            # PT -> JSON (Import)
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                buffer = io.BytesIO(post_data)
                data = torch.load(buffer, map_location='cpu')
                
                skeleton = data['skeleton']
                bone_names = data['bone_names']
                parent_mapping = data['parent_mapping']
                
                bones = []
                for i, name in enumerate(bone_names):
                    parent = parent_mapping.get(name, None)
                    pos = skeleton[i].tolist() if isinstance(skeleton, torch.Tensor) else skeleton[i]
                    
                    parent_index = -1
                    if parent and parent != name:
                        try:
                            parent_index = bone_names.index(parent)
                        except ValueError:
                            parent_index = -1

                    bone = {
                        "name": extract_bone_name(name),
                        "originalName": name,
                        "position": {"x": float(pos[0]), "y": float(pos[1]), "z": float(pos[2])},
                        "parentName": extract_bone_name(parent) if parent and parent != name else None,
                        "parentIndex": parent_index
                    }
                    bones.append(bone)
                
                result = {
                    "status": "success",
                    "skeleton": {
                        "name": "Converted Skeleton",
                        "bones": bones
                    }
                }
                self._send_json(result)
                
            except Exception as e:
                self._send_error(str(e))

        elif self.path == '/api/export_pt':
            # JSON -> PT (Export)
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                skeleton_json = data['skeleton']
                
                bone_names = [b.get('originalName') or b['name'] for b in skeleton_json['bones']]
                positions = [[b['position']['x'], b['position']['y'], b['position']['z']] for b in skeleton_json['bones']]
                
                parent_mapping = {}
                name_to_bone = {}
                for b in skeleton_json['bones']:
                    full_name = b.get('originalName') or b['name']
                    name_to_bone[full_name] = b
                
                for b in skeleton_json['bones']:
                    name = b.get('originalName') or b['name']
                    
                    parent_found = False
                    if b.get('parentIndex') is not None and b['parentIndex'] >= 0:
                        try:
                            parent_bone_data = skeleton_json['bones'][b['parentIndex']]
                            parent_mapping[name] = parent_bone_data.get('originalName') or parent_bone_data['name']
                            parent_found = True
                        except IndexError:
                            pass
                    
                    if not parent_found:
                        if b.get('parentName'):
                            target_parent_name = b['parentName']
                            simple_to_full = {extract_bone_name(b.get('originalName') or b['name']): (b.get('originalName') or b['name']) for b in skeleton_json['bones']}
                            
                            if target_parent_name in simple_to_full:
                                parent_mapping[name] = simple_to_full[target_parent_name]
                            elif target_parent_name in name_to_bone:
                                parent_mapping[name] = target_parent_name
                            else:
                                parent_mapping[name] = name
                        else:
                            parent_mapping[name] = name
                
                pt_data = {
                    "skeleton": torch.tensor(positions, dtype=torch.float32),
                    "bone_names": bone_names,
                    "parent_mapping": parent_mapping
                }
                
                buffer = io.BytesIO()
                torch.save(pt_data, buffer)
                buffer.seek(0)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/octet-stream')
                self.send_header('Content-Disposition', f'attachment; filename="{skeleton_json.get("name", "skeleton")}.pt"')
                self.end_headers()
                self.wfile.write(buffer.read())
                
            except Exception as e:
                self._send_error(str(e))
        else:
            super().do_POST()

    def do_GET(self):
        query_components = parse_qs(urlparse(self.path).query)
        if self.path.startswith('/api/load_local'):
            file_path = query_components.get('path', [None])[0]
            if file_path:
                try:
                    # Attempt to resolve path relative to project root
                    full_path = Path(file_path).expanduser()
                    if not full_path.is_absolute():
                        full_path = (PROJECT_ROOT / file_path).resolve()
                    else:
                        full_path = full_path.resolve()

                    if not full_path.exists():
                        raise FileNotFoundError(f"File not found: {file_path}")
                        
                    if full_path.suffix.lower() == '.pt':
                        data = torch.load(full_path, map_location='cpu')
                        skeleton = data['skeleton']
                        bone_names = data['bone_names']
                        parent_mapping = data['parent_mapping']
                        
                        bones = []
                        for i, name in enumerate(bone_names):
                            parent = parent_mapping.get(name, None)
                            pos = skeleton[i].tolist() if isinstance(skeleton, torch.Tensor) else skeleton[i]
                            
                            parent_index = -1
                            if parent and parent != name:
                                try:
                                    parent_index = bone_names.index(parent)
                                except ValueError:
                                    parent_index = -1

                            bone = {
                                "name": extract_bone_name(name),
                                "originalName": name,
                                "position": {"x": float(pos[0]), "y": float(pos[1]), "z": float(pos[2])},
                                "parentName": extract_bone_name(parent) if parent and parent != name else None,
                                "parentIndex": parent_index
                            }
                            bones.append(bone)
                        
                        result = {"status": "success", "skeleton": {"name": full_path.name, "bones": bones}}
                        self._send_json(result)
                    elif full_path.suffix.lower() == '.json':
                        with open(full_path, 'r') as f:
                            data = json.load(f)
                        self._send_json({"status": "success", "skeleton": data})
                    else:
                        raise ValueError("Unsupported file type")
                except Exception as e:
                    self._send_error(str(e))
            return
        super().do_GET()

    def _send_json(self, data):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _send_error(self, message):
        self.send_response(500)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"status": "error", "message": message}).encode())

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def open_browser(file_path=None):
    time.sleep(1)
    url = f"http://localhost:{PORT}"
    if file_path:
        quoted_path = urllib.parse.quote(os.path.abspath(file_path))
        url += f"/?file={quoted_path}"
    webbrowser.open(url)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='SK-Editor Server')
    parser.add_argument('file', nargs='?', help='Path to the skeleton file to open')
    parser.add_argument('--port', type=int, default=8000, help='Port to run the server on')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind the server to')
    parser.add_argument('--no-browser', action='store_true', help='Do not open browser automatically')
    args = parser.parse_args()
    
    PORT = args.port
    
    if not args.no_browser and is_port_in_use(PORT):
        print(f"⚠️  Port {PORT} is busy, opening in existing instance...")
        url = f"http://localhost:{PORT}"
        if args.file:
            url += f"/?file={urllib.parse.quote(os.path.abspath(args.file))}"
        webbrowser.open(url)
    else:
        print(f"🚀 SK-Editor Server starting at http://{args.host}:{PORT}")
        if not args.no_browser:
            threading.Thread(target=open_browser, args=(args.file,), daemon=True).start()
        
        try:
            # Note: The 'IntegratedHandler' will handle serving from 'src'
            socketserver.TCPServer.allow_reuse_address = True
            with socketserver.TCPServer((args.host, PORT), IntegratedHandler) as httpd:
                httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Server stopped.")
