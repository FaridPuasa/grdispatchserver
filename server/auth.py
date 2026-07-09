import json
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

import bcrypt
from flask import g, jsonify, request

from db import get_collection

APP_DATABASE = "GR_DMS"
USERS_COLLECTION = "users"
SESSIONS_COLLECTION = "sessions"

SESSION_TTL = timedelta(days=7)

ALLOWED_EMAILS = {
    "syahmi.ghafar@globex.com.bn",
    "dylan.chua@globex.com.bn",
    "operation2@globex.com.bn",
    "lovelyna.magdalin@globex.com.bn",
    "danny.chua@globex.com.bn",
}


def get_users_collection():
    return get_collection(APP_DATABASE, USERS_COLLECTION)


def get_sessions_collection():
    return get_collection(APP_DATABASE, SESSIONS_COLLECTION)


def verify_password(password, stored_hash):
    if not stored_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8"))
    except ValueError:
        return False


def public_user(user):
    return {
        "email": user["email"],
        "name": user.get("name") or user.get("fullName") or user["email"],
        "role": user.get("role", ""),
    }


def create_session(user):
    session_id = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + SESSION_TTL
    payload = json.dumps(public_user(user))
    get_sessions_collection().insert_one(
        {"_id": session_id, "expires": expires, "session": payload}
    )
    return session_id


def get_session_user(session_id):
    doc = get_sessions_collection().find_one({"_id": session_id})
    if not doc:
        return None
    expires = doc.get("expires")
    if expires and expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        get_sessions_collection().delete_one({"_id": session_id})
        return None
    try:
        return json.loads(doc["session"])
    except (KeyError, ValueError):
        return None


def delete_session(session_id):
    get_sessions_collection().delete_one({"_id": session_id})


def _extract_token():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    return header[len("Bearer "):]


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = _extract_token()
        if not token:
            return jsonify({"error": "authentication required"}), 401
        user = get_session_user(token)
        if not user:
            return jsonify({"error": "session expired, please log in again"}), 401
        g.current_user = user
        g.session_id = token
        return fn(*args, **kwargs)

    return wrapper
