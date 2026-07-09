import os

from pymongo import MongoClient

_client = None


def get_client():
    global _client
    if _client is None:
        uri = os.environ["MONGODB_URI"]
        _client = MongoClient(uri)
    return _client


def get_collection(database_name, collection_name):
    return get_client()[database_name][collection_name]
