FROM node:10.16.0-stretch-slim AS react-dev
RUN mkdir -p /app/frontend && \
    npm install -g react-scripts@1.1.1
COPY ./frontend/package.json ./frontend/package-lock.json /app/frontend/
RUN cd /app/frontend && npm install
COPY ./frontend /app/frontend
WORKDIR /app/frontend
CMD ["npm","start"]

FROM python:3.7.2-slim-stretch AS flask
RUN mkdir /app
COPY ./requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt
COPY . /app
RUN mkdir /app/data
WORKDIR /app
ENV FLASK_APP=metrics-api.py
CMD ["flask", "run", "--host", "0.0.0.0"]

FROM react-dev as react-build
RUN cd /app/frontend && npm run build

FROM flask AS all-in-one
COPY --from=react-build /app/frontend/build /app/frontend/build

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
