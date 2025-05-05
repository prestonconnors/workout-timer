
## Setup and Installation

1.  **Prerequisites:**
    *   Python 3.7+
    *   `pip` (Python package installer)
    *   `git` (for cloning)

2.  **Clone the Repository:**
    ```bash
    git clone https://github.com/prestonconnors/workout-timer.git
    cd workout-timer
    ```

3.  **Create Virtual Environment (Recommended):**
    ```bash
    python -m venv venv
    # Activate the environment
    # On Windows:  .\venv\Scripts\activate
    # On Linux/macOS: source venv/bin/activate
    ```

4.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

5.  **Create Directories & Add Audio File:**
    *   The `routines/` directory will typically be created automatically by Flask on first startup if needed, but you can create it manually (`mkdir routines`). This is where uploaded routines are stored. You can pre-populate it with your `.yaml` workout files.
    *   Create the audio directory: `mkdir -p static/audio`
    *   Place your 5-second countdown audio file named `countdown_timer.mp3` inside `static/audio/`. **The application will not work correctly without this file.**

## Running the Application

You need a WSGI server to run the Flask app, especially for anything beyond basic local testing. **Do not use `flask run` for production.**

**Option 1: Waitress (Cross-Platform / Windows / Simple Linux)**

Waitress is a production-ready WSGI server written purely in Python, making it easy to use on Windows and Linux.

1.  Make sure Waitress is installed (it's included in `requirements.txt`).
2.  Run from the project root directory:
    ```bash
    # Example: listen on localhost, port 18347, 4 threads
    waitress-serve --host=127.0.0.1 --port=18347 --threads=4 app:app
    ```
    *   Adjust `--host` (use `0.0.0.0` to listen on all interfaces, mind firewall) and `--port` as needed.

**Option 2: Gunicorn (Linux/macOS - Recommended for Production on Linux)**

Gunicorn is a robust WSGI server for Unix-like systems. **It will NOT work directly on Windows.**

1.  Make sure Gunicorn is installed (it's included in `requirements.txt`).
2.  Use the provided configuration file (`gunicorn.conf.py`). Review the config file to adjust settings like `bind`, `workers`, `user`, `group` as needed for your environment.
3.  Run from the project root directory:
    ```bash
    # Ensure your virtual environment is active
    gunicorn -c gunicorn.conf.py app:app
    ```

## Production Deployment (Linux Recommended)

For a robust production setup on Linux, it's highly recommended to:

1.  **Use Gunicorn:** Run the application using Gunicorn as described above.
2.  **Use systemd:** Manage the Gunicorn process using `systemd` for reliability, automatic restarts, and startup on boot. See [Systemd Setup](#systemd-setup) below.
3.  **Use a Reverse Proxy (Nginx):** Place Nginx in front of Gunicorn. Nginx handles incoming connections, serves static files efficiently, manages SSL/TLS (HTTPS), and forwards dynamic requests to Gunicorn (running on `127.0.0.1:<port>`).

### Systemd Setup (Linux)

1.  **Create a Dedicated User:** Create a system user specifically for this application (e.g., `workoutapp`) for security. Do not run as root.
    ```bash
    sudo groupadd workoutapp
    sudo useradd -r -g workoutapp -s /bin/false workoutapp
    ```
2.  **Set Permissions:** Ensure the application user owns the project directory and has necessary permissions (read for code/venv, read/write for the `routines/` directory).
    ```bash
    # Replace /srv/workout-timer with your actual path
    sudo chown -R workoutapp:workoutapp /srv/workout-timer
    sudo chmod -R u+rX,g+rX /srv/workout-timer
    sudo chmod u+w /srv/workout-timer/routines # Grant write permission
    ```
3.  **Create systemd Unit File:** Create `/etc/systemd/system/workout-timer.service` with the following content (adjust paths and User/Group if needed):
    ```ini
    [Unit]
    Description=Gunicorn instance to serve the Workout Timer application
    After=network.target

    [Service]
    User=workoutapp
    Group=workoutapp
    WorkingDirectory=/srv/workout-timer
    ExecStart=/srv/workout-timer/venv/bin/gunicorn -c /srv/workout-timer/gunicorn.conf.py app:app
    Restart=on-failure
    RestartSec=5s
    StandardOutput=journal
    StandardError=journal

    [Install]
    WantedBy=multi-user.target
    ```
4.  **Manage the Service:**
    ```bash
    sudo systemctl daemon-reload         # Reload systemd config
    sudo systemctl enable workout-timer  # Enable on boot
    sudo systemctl start workout-timer   # Start the service now
    sudo systemctl status workout-timer  # Check status
    sudo journalctl -u workout-timer     # View logs
    ```

## Usage

1.  **Access the App:** Open the application URL (e.g., `http://127.0.0.1:18347` or your Nginx proxy URL) in your mobile browser.
2.  **Select Routine:** The main screen lists available `.yaml` files from the `routines` directory. Tap "Start".
3.  **Upload Routine:** Use the form to upload new YAML files.
4.  **Workout Screen:**
    *   Starts paused. Press Play to begin.
    *   View Remaining time, Current Exercise, Next Exercise, and the large Current Interval Timer.
    *   Use controls or keyboard (Space: Play/Pause, Left/Right Arrows: Prev/Next) to navigate.
    *   Listen for TTS announcements and the 5-second countdown audio.
5.  **Completion:** The "Workout Complete!" screen appears upon finishing.

## YAML Routine Format

The application expects a list of exercises/intervals in YAML format. Each item requires `name` and `length` (in seconds).

```yaml
# Example routine.yaml
- name: Warmup
  length: 60.0 # Float or int seconds are okay
  type: warmup # Optional

- name: Squat Jack + Cross Punch
  length: 20
  instructions: Perform a Squat Jack... # Optional instructions (not displayed yet)

- name: Rest
  length: 10
  type: rest

- name: Pushup / Leg Extension
  length: 20
  targeted_groups: [upper body] # Optional

- name: Rest
  length: 10

- name: Cool Down
  length: 45.0
  type: cool down

## Dependencies
Key dependencies are listed in requirements.txt.
Flask>=2.0
PyYAML>=5.0
Werkzeug>=2.0
# WSGI Servers (Install as needed)
gunicorn>=20.0 # For Linux Production
waitress>=2.0   # For Windows / Simpler Linux

## Potential Future Enhancements
Display optional exercise instructions on screen.
Visual progress indicators.
User configuration for sound volume, TTS voice, countdown length.
Workout history / statistics.
PWA (Progressive Web App) features for offline use/installability.
Option to edit/delete routines via the interface.