FROM nginx:alpine
# static site
COPY ./portal/ /usr/share/nginx/html/
# nginx config for proxy to API
COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf
