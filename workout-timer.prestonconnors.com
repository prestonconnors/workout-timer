# /etc/nginx/sites-available/workout-timer.prestonconnors.com

upstream workout_timer_app {
    server 127.0.0.1:18347 fail_timeout=0;
    # keepalive 32;
}

server { # HTTP redirect server
    listen 80;
    listen [::]:80;
    server_name workout-timer.prestonconnors.com;
    location / {
        return 301 https://$host$request_uri;
    }
}

server { # HTTPS main server
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name workout-timer.prestonconnors.com;

    # --- SSL Configuration ---
    ssl_certificate /etc/letsencrypt/live/prestonconnors.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/prestonconnors.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    # ------------------------

    client_max_body_size 2M;

    # --- Favicon Handling (Added) ---
    # Handle favicon requests to prevent 404s in logs
    # Option 1: Return empty response if you don't have a favicon
    location = /favicon.ico {
        log_not_found off; # Don't log this specific 404
        access_log off;    # Don't log access for favicon
        return 204;        # Return "No Content"
    }
    # Option 2: Serve an actual favicon file
    # location = /favicon.ico {
    #    alias /path/to/your/favicon.ico; # Point to your favicon file
    #    log_not_found off;
    #    access_log off;
    # }
    # ---------------------------------


    # --- Serve Static Files ---
    location /static/ {
        alias /srv/workout-timer/static/; # VERIFY THIS PATH
        expires 7d;
        add_header Cache-Control "public";
        access_log off;
        try_files $uri $uri/ =404;
    }

    # --- Proxy App ---
    location / {
        proxy_pass http://workout_timer_app; # Pass to Gunicorn

        # Essential Proxy Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }

    # --- Optional: Error Pages ---
    # error_page 500 502 503 504 /50x.html;
    # location = /50x.html { root /usr/share/nginx/html; }
}