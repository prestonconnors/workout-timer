# Gunicorn configuration file

import multiprocessing
import os

# --- Basic Settings ---

# The socket to bind to.
# Changed port from 5000 to 18347 (random unprivileged port).
# Use '127.0.0.1' (localhost) if running behind a reverse proxy like Nginx (recommended).
bind = "127.0.0.1:18347"

# --- Worker Processes ---

# The number of worker processes for handling requests.
# Adjust based on your server's resources (e.g., multiprocessing.cpu_count() * 2 + 1).
workers = 3

# The type of workers to use. 'sync' is default.
# Consider 'gevent' or 'uvicorn.workers.UvicornWorker' for async/higher concurrency needs
# (requires installing additional libraries).
worker_class = 'sync'

# The maximum number of requests a worker will process before restarting.
# max_requests = 1000
# max_requests_jitter = 50

# --- Logging ---

# Log to stdout/stderr ('-') for compatibility with systemd/Docker.
accesslog = '-'
errorlog = '-'

# Log level.
loglevel = 'info'

# Customize the access log format if needed.
# access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# --- Process Naming ---
# Set the process name for easier identification (requires `pip install setproctitle`)
# proc_name = 'workout_timer_app'

# --- Server Mechanics ---

# Timeout for workers in seconds.
# timeout = 30

# Seconds to wait for requests on a Keep-Alive connection.
# keepalive = 2

# Load application code before the worker processes are forked.
preload_app = True

# --- Security ---

# Run Gunicorn workers as a specific non-root user and group (RECOMMENDED).
# Ensure this user is created on your system and has necessary permissions
# if logging to files.
# Example:
# user = 'your_app_user'
# group = 'your_app_group'


# --- File Paths (Only needed if NOT logging to stdout/stderr) ---
# Ensure directories exist and have correct permissions if used.
# Example:
# pidfile = '/var/run/gunicorn/workout_timer.pid'


# Note: Ensure the directory for log files (e.g., /var/log/gunicorn) or pid file
#       (e.g., /var/run/gunicorn) exists and has correct permissions
#       if you choose to use file paths instead of stdout/stderr.