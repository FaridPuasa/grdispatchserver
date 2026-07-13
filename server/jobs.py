import threading
import uuid
from datetime import datetime, timedelta, timezone

from db import get_collection

JOB_DATABASE = "GR_DMS"
JOB_COLLECTION = "prediction_jobs"
JOB_TTL = timedelta(hours=1)

# Job state lives in Mongo, not a process-local dict: Heroku can serve the
# start request and the poll requests from different gunicorn worker
# processes (or recycle the worker between them), so in-memory state isn't
# visible across those requests.
_index_ready = False
_index_lock = threading.Lock()


def _jobs_collection():
    global _index_ready
    collection = get_collection(JOB_DATABASE, JOB_COLLECTION)
    if not _index_ready:
        with _index_lock:
            if not _index_ready:
                collection.create_index("expires_at", expireAfterSeconds=0)
                _index_ready = True
    return collection


def start_job(target):
    job_id = uuid.uuid4().hex
    collection = _jobs_collection()
    collection.insert_one(
        {
            "_id": job_id,
            "status": "running",
            "result": None,
            "error": None,
            "expires_at": datetime.now(timezone.utc) + JOB_TTL,
        }
    )

    def run():
        try:
            result = target()
            collection.update_one({"_id": job_id}, {"$set": {"status": "done", "result": result}})
        except Exception as exc:
            collection.update_one({"_id": job_id}, {"$set": {"status": "error", "error": str(exc)}})

    threading.Thread(target=run, daemon=True).start()
    return job_id


def get_job(job_id):
    doc = _jobs_collection().find_one({"_id": job_id})
    if doc is None:
        return None
    return {"status": doc["status"], "result": doc.get("result"), "error": doc.get("error")}
