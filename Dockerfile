FROM node:alpine AS react

COPY . /opt/app
WORKDIR /opt/app/frontend
RUN yarn && yarn build

FROM python:3.7.2
RUN groupadd -r app && useradd -r -g app app 
USER app

COPY --chown=app:app --from=react /opt/app /home/app

WORKDIR /home/app

RUN pip install --user -r requirements.txt

CMD ["python", "app.py"]
