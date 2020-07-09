FROM node:10.16.0-stretch-slim AS react-dev
RUN mkdir -p /app/frontend && \
    npm install -g react-scripts@1.1.1
COPY ./frontend/package.json ./frontend/package-lock.json /app/frontend/
RUN cd /app/frontend && npm install
COPY ./frontend /app/frontend
WORKDIR /app/frontend
CMD ["npm","start"]

FROM python:3.7.2-slim-stretch AS flask-dev
RUN mkdir -p /app/backend && \
    apt-get update && \
    apt-get install -y curl nano less sudo
COPY ./backend/requirements.txt /app/backend/requirements.txt
RUN pip install -r /app/backend/requirements.txt
COPY ./backend /app/backend
RUN mkdir -p /app/backend/data
WORKDIR /app/backend
ENV FLASK_APP=metrics-api.py
CMD ["flask", "run", "--host", "0.0.0.0"]

FROM flask-dev as flask
ENV PORT 5000
CMD gunicorn --bind 0.0.0.0:$PORT metrics-api:app

FROM react-dev as react-build
ENV REACT_APP_METRICS_BASE_URL=
RUN cd /app/frontend && PUBLIC_URL="frontend/build" npm run build

FROM flask AS all-in-one
ENV METRICS_ALL_IN_ONE 1
COPY --from=react-build /app/frontend/build /app/frontend/build

FROM nginx:1.16.0-alpine as web
RUN mkdir /usr/share/nginx/html/frontend && \
    mkdir /var/cache/nginx/api-cache && \
    rm -rf /etc/nginx/conf.d
COPY --from=react-build /app/frontend/build /usr/share/nginx/html/frontend/build
RUN gzip -k9 /usr/share/nginx/html/frontend/build/static/css/*.css && \
    gzip -k9 /usr/share/nginx/html/frontend/build/static/js/*.js
COPY ./nginx/conf.d /etc/nginx/conf.d
ENV PORT 80
CMD /bin/sh -c "echo 'listen $PORT;' > /etc/nginx/server-vars.conf" && nginx -g 'daemon off;'
