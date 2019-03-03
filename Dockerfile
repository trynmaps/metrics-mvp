FROM node:alpine AS react

COPY . /opt/app
WORKDIR /opt/app/frontend
RUN yarn
RUN yarn build

FROM python:3.7.2

COPY --from=react /opt/app /opt/app

WORKDIR /opt/app

ENV FLASK_APP=metrics-api.py

RUN pip install -r requirements.txt

CMD ["python", "app.py"]
