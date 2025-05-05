import os
import yaml
import math
import logging
from flask import Flask, render_template, request, redirect, url_for, jsonify, abort
from werkzeug.utils import secure_filename

# --- Configuration ---
UPLOAD_FOLDER = 'routines'
ALLOWED_EXTENSIONS = {'yaml', 'yml'}
ROUTINES_DIR = 'routines' # Relative path to the routines directory

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')

# --- Flask App Setup ---
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024  # 1 MB max upload size

# Ensure routines directory exists on startup
try:
    os.makedirs(ROUTINES_DIR, exist_ok=True)
    logging.info(f"Checked/created routines directory: {os.path.abspath(ROUTINES_DIR)}")
except OSError as e:
    logging.error(f"Could not create routines directory '{ROUTINES_DIR}': {e}")
    # Depending on severity, might want to exit or handle differently
    # For now, we log the error and continue; app might fail later if dir needed.

# --- Helper Functions ---
def allowed_file(filename):
    """Checks if the uploaded file has an allowed extension."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_routines():
    """Gets a list of valid YAML files from the routines directory."""
    routines = []
    if not os.path.isdir(ROUTINES_DIR):
        logging.error(f"Routines directory '{ROUTINES_DIR}' not found or is not a directory.")
        return routines # Return empty list

    try:
        for filename in os.listdir(ROUTINES_DIR):
            if filename.lower().endswith(('.yaml', '.yml')):
                filepath = os.path.join(ROUTINES_DIR, filename)
                # Basic validation: Can we open and minimally parse it?
                try:
                    with open(filepath, 'r') as f:
                        yaml.safe_load(f) # Attempt a quick parse
                    routines.append(filename)
                    # logging.debug(f"Found valid routine file: {filename}") # Debug level log
                except (yaml.YAMLError, OSError, Exception) as parse_err:
                    logging.warning(f"Could not parse routine file '{filename}', skipping. Error: {parse_err}")
    except OSError as e:
        logging.error(f"Error reading routines directory '{ROUTINES_DIR}': {e}")

    return sorted(routines)


def parse_routine(filename):
    """Parses a YAML routine file and calculates total duration."""
    # Use secure_filename again for safety, though should already be clean
    safe_filename = secure_filename(filename)
    filepath = os.path.join(ROUTINES_DIR, safe_filename)

    if not os.path.exists(filepath):
        logging.warning(f"Routine file not found during parse attempt: {filepath}")
        return None, None
    if not allowed_file(safe_filename):
         logging.warning(f"Invalid file type attempted for parsing: {safe_filename}")
         return None, None # Should not happen if list is generated correctly

    try:
        with open(filepath, 'r', encoding='utf-8') as f: # Specify encoding
            routine_data = yaml.safe_load(f)

        if not isinstance(routine_data, list):
            raise ValueError("YAML root structure must be a list of exercises.")

        total_duration = 0
        validated_exercises = []
        for i, step in enumerate(routine_data):
            # Basic structure validation
            if not isinstance(step, dict):
                raise ValueError(f"Exercise item at index {i} is not a dictionary.")
            if 'name' not in step or not step['name']:
                 raise ValueError(f"Exercise at index {i} is missing 'name' or name is empty.")
            if 'length' not in step:
                 raise ValueError(f"Exercise '{step.get('name')}' (index {i}) is missing 'length'.")

            # Length validation
            try:
                length = float(step['length'])
                if length < 0:
                    raise ValueError(f"Exercise '{step.get('name')}' has negative length: {length}")
                # Store length as integer seconds (using ceil)
                step['length'] = math.ceil(length)
                if step['length'] == 0:
                     logging.warning(f"Exercise '{step.get('name')}' has zero duration after ceiling. Check routine file.")
                     # Depending on desired behavior, could skip, error, or allow
                total_duration += step['length']
                validated_exercises.append(step)
            except (ValueError, TypeError) as e:
                raise ValueError(f"Invalid length value for exercise '{step.get('name')}': {step.get('length')}. Error: {e}")

        return validated_exercises, total_duration
    except (yaml.YAMLError, FileNotFoundError, ValueError, OSError) as e:
        logging.error(f"Error parsing routine file '{safe_filename}': {e}")
        return None, None
    except Exception as e: # Catch unexpected errors
         logging.error(f"Unexpected error parsing routine '{safe_filename}': {e}", exc_info=True)
         return None, None

# --- Routes ---
@app.route('/')
def index():
    """Displays the main page with routine list and upload form."""
    routines = get_routines()
    return render_template('index.html', routines=routines)

@app.route('/upload', methods=['POST'])
def upload_routine():
    """Handles YAML file uploads."""
    if 'routine_file' not in request.files:
        logging.warning("Upload attempt with no 'routine_file' part in request.")
        # Optionally flash a message to the user
        return redirect(url_for('index'))

    file = request.files['routine_file']
    if file.filename == '':
        logging.warning("Upload attempt with empty filename.")
        # Optionally flash a message
        return redirect(url_for('index'))

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        try:
            file.save(filepath)
            logging.info(f"Successfully uploaded routine file: {filename}")
            # Optional: Validate immediately after upload
            parsed_data, _ = parse_routine(filename)
            if parsed_data is None:
                logging.warning(f"Uploaded file '{filename}' failed validation. It may be corrupt or invalid.")
                # Consider removing the file if it's invalid: os.remove(filepath)
                # Or flash a message to the user
            else:
                logging.info(f"Uploaded file '{filename}' passed basic validation.")

        except Exception as e:
            logging.error(f"Error saving uploaded file '{filename}': {e}", exc_info=True)
            # Optionally flash an error message
    else:
         logging.warning(f"Upload attempt with disallowed file type or no file: {file.filename}")
         # Optionally flash an error message

    return redirect(url_for('index'))

@app.route('/workout/<path:filename>') # Use path converter for flexibility if needed
def workout(filename):
    """Displays the workout timer page for a specific routine."""
    # Security: Basic check against directory traversal & ensure it's intended path
    if '..' in filename or filename.startswith('/'):
         logging.warning(f"Invalid filename detected in workout request: {filename}")
         abort(400, "Invalid filename.")

    # Normalize and secure the filename
    safe_filename = secure_filename(filename)
    # Check existence within the designated routines directory
    filepath = os.path.join(ROUTINES_DIR, safe_filename)

    if not os.path.exists(filepath) or not allowed_file(safe_filename):
        logging.warning(f"Workout routine not found or invalid: {filename} (checked: {filepath})")
        abort(404, f"Routine '{safe_filename}' not found or is invalid.")

    logging.info(f"Serving workout page for routine: {safe_filename}")
    return render_template('workout.html', routine_filename=safe_filename)

@app.route('/routine/<path:filename>') # Use path converter
def get_routine_data(filename):
    """API endpoint to fetch parsed routine data as JSON."""
    if '..' in filename or filename.startswith('/'):
         logging.warning(f"Invalid filename detected in routine API request: {filename}")
         abort(400, "Invalid filename.")

    safe_filename = secure_filename(filename)
    exercises, total_duration = parse_routine(safe_filename) # parse_routine logs errors

    if exercises is None:
        # Don't log again here, parse_routine already logged the specific error
        abort(404, f"Routine '{safe_filename}' not found or failed to parse.")

    # logging.info(f"Providing routine data for: {safe_filename}") # Can be verbose
    return jsonify({
        'filename': safe_filename,
        'exercises': exercises,
        'total_duration': total_duration
    })

# --- Custom Error Handling (Optional but recommended) ---
@app.errorhandler(404)
def not_found_error(error):
    return render_template('404.html'), 404 # You would need to create a templates/404.html

@app.errorhandler(500)
def internal_error(error):
    # Log the error details if not already done elsewhere
    logging.error(f"Server Error: {error}", exc_info=True)
    return render_template('500.html'), 500 # You would need to create a templates/500.html

# --- Main Execution Guard ---
# This part is typically NOT run directly in production.
# A WSGI server like Gunicorn or uWSGI will import the 'app' object.
if __name__ == '__main__':
    logging.warning("Starting Flask development server. DO NOT USE IN PRODUCTION.")
    # Use host='0.0.0.0' only if you need to access it from other devices on your network during dev.
    # For production, rely on the WSGI server binding.
    app.run(host='0.0.0.0', port=5000, debug=False) # DEBUG IS FALSE