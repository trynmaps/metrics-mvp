FROM python:3.7.2-slim-stretch

RUN mkdir /app
COPY . /app
RUN pip install -r /app/requirements.txt
WORKDIR /app
CMD ["python", "metrics-api.py"]
