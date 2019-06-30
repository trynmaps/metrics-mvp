FROM node:10.16.0-stretch-slim AS react-dev
RUN mkdir /app
RUN npm install -g react-scripts@1.1.1
COPY ./frontend /app/frontend
RUN cd /app/frontend && npm install
WORKDIR /app/frontend
CMD ["npm","start"]

FROM react-dev as react-build
RUN cd /app/frontend && npm run build

FROM nginx:1.16.0-alpine as web
RUN mkdir /usr/share/nginx/html/frontend && \
    mkdir /var/cache/nginx/api-cache && \
    rm -rf /etc/nginx/conf.d
COPY --from=react-build /app/frontend/build /usr/share/nginx/html/frontend/build
COPY --from=react-build /app/frontend/public /usr/share/nginx/html/frontend/public
RUN gzip -k9 /usr/share/nginx/html/frontend/build/static/css/*.css && \
    gzip -k9 /usr/share/nginx/html/frontend/build/static/js/*.js
COPY ./nginx/conf.d /etc/nginx/conf.d

ENV PORT 80
CMD /bin/sh -c "echo 'listen $PORT;' > /etc/nginx/server-vars.conf" && nginx -g 'daemon off;'
