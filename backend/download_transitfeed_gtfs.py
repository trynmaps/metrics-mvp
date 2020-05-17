import boto3
from botocore.exceptions import ClientError
from requests import get
import requests
import pathlib

"""
Implements issue: https://github.com/trynmaps/metrics-mvp/issues/643

User should directly use the function update_gtfs.

This script downloads a GTFS file from transitfeed, and uploads it 
to the S3 bucket specified by the parameter of update_gtfs
"""

def GTFS_download(key, feed):
    """Download a file from https://transitfeeds.com/api/swagger/#!/default/getLatestFeedVersion

    :param key: transitfeeds private key
    :param feed: the unique ID of the feed
    :return: filename after download
    """
    replacefeed = feed.replace("/", "%2F")
    
    url = 'https://api.transitfeeds.com/v1/getLatestFeedVersion?key={}&feed={}'.format(key, replacefeed)
   
    gtfs_content = requests.get(url, allow_redirects=True)

    open('{}.zip'.format(replacefeed), 'wb').write(gtfs_content.content)
    return '{}.zip'.format(replacefeed)



def upload_file(file_name, bucket, object_name=None):
    """Upload a file to an S3 bucket, then delete this file 

    :param file_name: File to upload
    :param bucket: Bucket to upload to
    :param object_name: S3 object name. If not specified then file_name is used
    :return: None
    """

    # If S3 object_name was not specified, use file_name
    if object_name is None:
        object_name = file_name

    # Upload the file
    s3_client = boto3.client('s3')
    try:
        response = s3_client.upload_file(file_name, bucket, object_name)
    except ClientError as e:
        print(e)
    
    #* delete this file after upload
    p = pathlib.Path('./{}'.format(file_name))
    p.unlink()


def gtfs_exists(check_filename, bucket_name):
    """Check if file already exist in S3 bucket

    :param file_name: File to upload
    :param bucket: Bucket to upload to
    :return: True if file was uploaded, else False
    """
    fileSet = set()
    conn = boto3.client('s3')  # again assumes boto.cfg setup, assume AWS S3
    for key in conn.list_objects(Bucket=bucket_name)['Contents']:
        filename = key['Key']
        fileSet.add(filename)
    
    if check_filename in fileSet: return True
    return False

def update_gtfs(transitfeed_key, feed_id, s3_bucket_name):
    """
    download GTFS file from transitfeed, then upload downloaded file to
    S3 bucket, and delete the downloaded file locally
    :param transitfeed_key: transitfeeds API key
    :param feed_id: feed ID from transitfeed
    :param s3_bucket_name: S3 bucket name
    :return: True if file was uploaded, else False
    """
    try:
        feedfile = feed_id.replace("/", "%2F") + ".zip"
        #* check if feedfile exist in S3
        if gtfs_exists(feedfile, s3_bucket_name): 
            print("{} already in S3 bucket".format(feedfile))
            return

        #* download GTFS file to script directory
        f = GTFS_download(transitfeed_key, feed_id)

        #* upload to S3bucket
        upload_file(f, s3_bucket_name)

        print("{} successfully uploaded to S3".format(f))
    except:
        print("{} uploaded to S3 FAIL".format(f))
