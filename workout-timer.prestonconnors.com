# /etc/nginx/sites-available/workout-timer.prestonconnors.com

# Upstream server where Gunicorn is running
upstream workout_timer_app {
    server 127.0.0.1:18347 fail_timeout=0;
    # keepalive 32; # Optional: Keepalive connections
}

# Server block for redirecting HTTP to HTTPS
server {
    if ($host = workout-timer.prestonconnors.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    listen [::]:80; # Listen on IPv6 if needed
    server_name workout-timer.prestonconnors.com;

    # Redirect all HTTP traffic to HTTPS with a 301 Moved Permanently
    location / {
        return 301 https://$host$request_uri;
    }


}

# Server block for handling HTTPS traffic
server {
    listen 443 ssl http2; # Listen on 443 for SSL, enable HTTP/2
    listen [::]:443 ssl http2; # Listen on IPv6 if needed
    server_name workout-timer.prestonconnors.com;

    # --- SSL Configuration ---
    # Specify the paths to your SSL certificate and key
    # These paths will likely be managed by Certbot if you use it
    ssl_certificate /etc/letsencrypt/live/prestonconnors.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/prestonconnors.com/privkey.pem; # managed by Certbot
    # Include standard SSL options (provided by Certbot or define manually)
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    # ------------------------

    # Set client body size limit (e.g., for uploads)
    client_max_body_size 2M;

    # Configure root path and index files (often not strictly needed when proxying everything)
    # root /srv/workout-timer/public; # If you had a specific public root
    # index index.html index.htm;

    # --- Serve Static Files Directly ---
    # Match requests starting with /static/
    location /static/ {
        # Filesystem path to the app's static files
        # ** VERIFY THIS PATH IS CORRECT **
        alias /srv/workout-timer/static/;

        # Cache settings
        expires 7d; # Cache for 7 days
        add_header Cache-Control "public";
        access_log off; # Don't log access for static files
        try_files $uri $uri/ =404; # Check if file exists
    }

    # --- Proxy All Other Requests to Gunicorn/Flask ---
    # Match the root ('/') and everything else not caught by /static/
    location / {
        # Proxy to the upstream Gunicorn app
        proxy_pass http://workout_timer_app; # Using upstream name

        # --- Essential Proxy Headers ---
        # Tell the backend app about the original request
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme; # Crucial for https detection in Flask
        # No need for X-Forwarded-Prefix when serving at the root of a domain
        proxy_redirect off;

        # Optional: Adjust proxy timeouts if needed
        # proxy_connect_timeout       60s;
        # proxy_send_timeout          60s;
        # proxy_read_timeout          60s;
    }

    # --- Optional: Custom Error Pages ---
    # error_page 500 502 503 504 /50x.html;
    # location = /50x.html {
    #   root /usr/share/nginx/html;
    # }

}
