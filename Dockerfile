FROM python:3.7.2-slim-stretch

# Install python and node in the same image
# so that 'npm run build' can generate production frontend build
# that will be served by metrics-api.py (Flask) at /

RUN apt-get update
RUN apt-get install -y curl nano less sudo
RUN curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
RUN apt-get install -y nodejs
RUN apt-get update

RUN mkdir /app

RUN npm install -g react-scripts@1.1.1

COPY . /app

RUN pip install -r /app/requirements.txt
RUN cd /app/frontend && npm install
RUN cd /app/frontend && npm run build

RUN mkdir /app/data
WORKDIR /app

ENV FLASK_APP=metrics-api.py

# Override this command with ["react-scripts","start"]
# to run frontend React server in dev mode
CMD ["flask", "run", "--host", "0.0.0.0"]
