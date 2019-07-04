This directory is shared in the metrics-flask-dev Docker container as ~/.aws .

If you need to save data to S3 from your development environment, create a credentials file in this directory with your AWS credentials (but don't check it in to git), e.g.:

```
[default]
aws_access_key_id = ....
aws_secret_access_key = ....
```
