import os
import yaml
import math
import logging
from flask import Flask, render_template, request, redirect, url_for, jsonify, abort
from werkzeug.utils import secure_filename
from werkzeug.middleware.proxy_fix import ProxyFix # Recommended for proxy envs

# --- Configuration ---
UPLOAD_FOLDER = 'routines'
ALLOWED_EXTENSIONS = {'yaml', 'yml'}
ROUTINES_DIR = 'routines'

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024 # 1 MB

# Using ProxyFix - adjusts request based on X-Forwarded headers from Nginx
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

# Ensure routines directory exists
try:
    os.makedirs(ROUTINES_DIR, exist_ok=True)
    logging.info(f"Checked/created routines directory: {os.path.abspath(ROUTINES_DIR)}")
except OSError as e:
    logging.error(f"Could not create routines directory '{ROUTINES_DIR}': {e}")

# --- Helper Functions --- (No changes)
def allowed_file(filename): return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
def get_routines():
    routines_list = []
    if not os.path.isdir(ROUTINES_DIR): logging.error(f"Dir '{ROUTINES_DIR}' not found."); return routines_list
    try:
        for filename in os.listdir(ROUTINES_DIR):
            if filename.lower().endswith(('.yaml', '.yml')):
                filepath = os.path.join(ROUTINES_DIR, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f: yaml.safe_load(f.read(2048))
                    routines_list.append(filename)
                except Exception as err: logging.warning(f"Could not parse {filename}, skipping. Err: {err}")
    except OSError as e: logging.error(f"Error reading routines dir: {e}")
    return sorted(routines_list)

def parse_routine(filename):
    safe_filename = secure_filename(filename)
    filepath = os.path.join(ROUTINES_DIR, safe_filename)
    if not os.path.exists(filepath) or not allowed_file(safe_filename): return None, None
    try:
        with open(filepath, 'r', encoding='utf-8') as f: routine_data = yaml.safe_load(f)
        if not isinstance(routine_data, list): raise ValueError("YAML root not list.")
        total_duration_val = 0
        validated = []
        for i, step in enumerate(routine_data):
            if not (isinstance(step, dict) and step.get('name') and 'length' in step): raise ValueError(f"Invalid step {i}")
            try:
                length = float(step['length']); assert length >= 0
                step['length'] = math.ceil(length)
                total_duration_val += step['length']; validated.append(step)
            except: raise ValueError(f"Invalid length for {step.get('name')}")
        return validated, total_duration_val
    except Exception as e: logging.error(f"Error parsing {safe_filename}: {e}", exc_info=True); return None, None

# --- Routes ---
@app.route('/')
def index():
    routines = get_routines()
    return render_template('index.html', routines=routines)

@app.route('/upload', methods=['POST'])
def upload_routine():
    if 'routine_file' not in request.files or not request.files['routine_file'].filename: return redirect(url_for('index'))
    file = request.files['routine_file']
    if allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        try: file.save(filepath); logging.info(f"Uploaded: {filename}"); parse_routine(filename)
        except Exception as e: logging.error(f"Upload error for {filename}: {e}", exc_info=True)
    return redirect(url_for('index'))

# === Workout route: Removed autoplay reading ===
@app.route('/workout/<path:filename>')
def workout(filename):
    if '..' in filename or filename.startswith('/'): abort(400, "Invalid filename.")
    safe_filename = secure_filename(filename)
    filepath = os.path.join(ROUTINES_DIR, safe_filename)
    if not os.path.exists(filepath) or not allowed_file(safe_filename): abort(404, f"Routine '{safe_filename}' not found.")

    try: intro_d = max(0, int(request.args.get('intro', 0)))
    except: intro_d = 0
    try: outro_d = max(0, int(request.args.get('outro', 0)))
    except: outro_d = 0

    logging.info(f"Serving workout: {safe_filename} (Intro: {intro_d}s, Outro: {outro_d}s)")
    return render_template(
        'workout.html',
        routine_filename=safe_filename,
        intro_duration=intro_d,
        outro_duration=outro_d
        # No autoplay flag passed anymore
    )
# === End ===

@app.route('/routine/<path:filename>')
def get_routine_data(filename):
    if '..' in filename or filename.startswith('/'): abort(400, "Invalid filename.")
    safe_filename = secure_filename(filename)
    exercises, total_duration = parse_routine(safe_filename)
    if exercises is None: abort(404, f"Routine API: '{safe_filename}' not found.")
    return jsonify({'filename': safe_filename, 'exercises': exercises, 'total_duration': total_duration})

# --- Error Handlers --- (No changes)
@app.errorhandler(404)
def not_found_error(error): logging.debug(f"404: {request.path}"); return "<h1>404 - Not Found</h1>", 404
@app.errorhandler(500)
def internal_error(error): logging.error(f"500 Error: {error}", exc_info=True); return "<h1>500 - Server Error</h1>", 500

# --- Main Guard (for development only) ---
if __name__ == '__main__':
    logging.info("Flask dev server running. DEV ONLY."); app.run(host='0.0.0.0', port=5000, debug=True)