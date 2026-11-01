proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
proxy_connect_timeout 5s;
proxy_read_timeout 60s;
proxy_hide_header X-Powered-By;
# nginx adds the same security headers at the server level; avoid duplicates from the upstream.
proxy_hide_header X-Content-Type-Options;
proxy_hide_header X-Frame-Options;
proxy_hide_header Referrer-Policy;
proxy_hide_header Permissions-Policy;
proxy_hide_header Content-Security-Policy;
proxy_hide_header Strict-Transport-Security;
