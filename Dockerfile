FROM ubuntu:bionic

RUN mkdir /app
RUN apt-get update
RUN apt-get install -y python3-pip
COPY ./requirements.txt /tmp/requirements.txt
RUN pip3 install -r /tmp/requirements.txt

WORKDIR /app
CMD ["python3", "metrics-api.py"]
