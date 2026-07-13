import threading
import uuid

# In-memory store: only correct with a single gunicorn worker process (current
# Procfile has no --workers flag, so this holds). A second worker/dyno would poll
# a job_id that was never started in its own process.
_jobs = {}
_lock = threading.Lock()


def start_job(target):
    job_id = uuid.uuid4().hex
    with _lock:
        _jobs[job_id] = {"status": "running", "result": None, "error": None}

    def run():
        try:
            result = target()
            with _lock:
                _jobs[job_id] = {"status": "done", "result": result, "error": None}
        except Exception as exc:
            with _lock:
                _jobs[job_id] = {"status": "error", "result": None, "error": str(exc)}

    threading.Thread(target=run, daemon=True).start()
    return job_id


def get_job(job_id):
    with _lock:
        return _jobs.get(job_id)
