import os
from datetime import date, datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv()

from flask import Flask, Response, g, jsonify, request
from flask_cors import CORS

from auth import (
    ALLOWED_EMAILS,
    create_session,
    delete_session,
    get_users_collection,
    public_user,
    require_auth,
    verify_password,
)
from db import get_client, get_collection
from metrics import EXCLUDED_DISPATCHERS, compute_productivity, parse_dt
from forecasting import (
    build_weekly_productivity,
    check_dispatcher_model,
    dispatcher_model_diagnostics,
    dispatcher_seasonal_decomposition,
    forecast_dispatcher,
)
from scenarios import run_scenario_analysis
from report import generate_report_pdf
from jobs import start_job, get_job

DEFAULT_DAILY_CAPACITY = 130
WAREHOUSE_STATUSES = {"At Warehouse", "Return to Warehouse"}
WAREHOUSE_ENTRY_WINDOW_DAYS = 30

app = Flask(__name__)
CORS(app)

ORDER_PROJECTION = {
    "doTrackingNumber": 1,
    "assignedTo": 1,
    "currentStatus": 1,
    "area": 1,
    "receiverPostalCode": 1,
    "receiverName": 1,
    "jobDate": 1,
    "history": 1,
    "warehouseEntry": 1,
}


def build_summary(orders, database_name, collection_name, start_date, end_date):
    return {
        "total_jobs": len(orders),
        "warehouse_receipts": sum(1 for o in orders if o.get("warehouseEntry") == "Yes"),
        "date_range": f"{start_date} to {end_date}",
        "database": database_name,
        "collection": collection_name,
    }


def count_in_warehouse(collection):
    cutoff = datetime.now(timezone.utc) - timedelta(days=WAREHOUSE_ENTRY_WINDOW_DAYS)
    docs = collection.find(
        {"currentStatus": {"$in": list(WAREHOUSE_STATUSES)}},
        {"warehouseEntryDateTime": 1},
    )
    count = 0
    for doc in docs:
        # warehouseEntryDateTime is stored inconsistently (BSON date, ISO string with
        # varying UTC offsets, or the placeholder "N/A"), so filter in Python via parse_dt
        # rather than relying on a single Mongo comparison operator across mixed types.
        try:
            entry_dt = parse_dt(doc.get("warehouseEntryDateTime"))
        except (ValueError, TypeError):
            continue
        if entry_dt is not None and entry_dt >= cutoff:
            count += 1
    return count


def period_days(start_date, end_date):
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    return max(1, (end - start).days + 1)


@app.get("/")
def index():
    return {"status": "ok", "service": "grdispatchserver"}


@app.get("/health")
def health():
    try:
        get_client().admin.command("ping")
        return {"status": "healthy", "mongo": "connected"}
    except Exception as exc:
        return {"status": "unhealthy", "error": str(exc)}, 503


@app.post("/api/auth/login")
def login():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    if email not in ALLOWED_EMAILS:
        return jsonify({"error": "invalid email or password"}), 401

    user = get_users_collection().find_one({"email": email})
    if not user or not verify_password(password, user.get("password")):
        return jsonify({"error": "invalid email or password"}), 401

    session_id = create_session(user)
    return jsonify({"token": session_id, "user": public_user(user)})


@app.get("/api/auth/me")
@require_auth
def me():
    return jsonify({"user": g.current_user})


@app.post("/api/auth/logout")
@require_auth
def logout():
    delete_session(g.session_id)
    return jsonify({"status": "logged out"})


@app.post("/api/productivity")
@require_auth
def productivity():
    body = request.get_json(silent=True) or {}
    database_name = body.get("database_name")
    collection_name = body.get("collection_name")
    start_date = body.get("start_date")
    end_date = body.get("end_date")

    if not all([database_name, collection_name, start_date, end_date]):
        return jsonify({"error": "database_name, collection_name, start_date, and end_date are required"}), 400

    collection = get_collection(database_name, collection_name)
    orders = list(
        collection.find(
            {"jobDate": {"$gte": start_date, "$lte": end_date}},
            ORDER_PROJECTION,
        )
    )

    days = period_days(start_date, end_date)
    data = compute_productivity(orders, days)
    summary = build_summary(orders, database_name, collection_name, start_date, end_date)
    summary["in_warehouse"] = count_in_warehouse(collection)

    response = {"data": data, "summary": summary}

    if body.get("comparison_period"):
        span = (date.fromisoformat(end_date) - date.fromisoformat(start_date)).days + 1
        comparison_end = date.fromisoformat(start_date) - timedelta(days=1)
        comparison_start = comparison_end - timedelta(days=span - 1)
        comparison_orders = list(
            collection.find(
                {
                    "jobDate": {
                        "$gte": comparison_start.isoformat(),
                        "$lte": comparison_end.isoformat(),
                    }
                },
                ORDER_PROJECTION,
            )
        )
        response["comparison_data"] = {
            "data": compute_productivity(comparison_orders, days),
            "summary": build_summary(
                comparison_orders,
                database_name,
                collection_name,
                comparison_start.isoformat(),
                comparison_end.isoformat(),
            ),
            "comparison_start_date": comparison_start.isoformat(),
            "comparison_end_date": comparison_end.isoformat(),
        }

    return jsonify(response)


@app.post("/api/export-report")
@require_auth
def export_report():
    body = request.get_json(silent=True) or {}
    database_name = body.get("database_name")
    collection_name = body.get("collection_name")
    start_date = body.get("start_date")
    end_date = body.get("end_date")
    requested_dispatchers = body.get("dispatchers")

    if not all([database_name, collection_name, start_date, end_date]):
        return jsonify({"error": "database_name, collection_name, start_date, and end_date are required"}), 400

    collection = get_collection(database_name, collection_name)
    orders = list(
        collection.find(
            {"jobDate": {"$gte": start_date, "$lte": end_date}},
            ORDER_PROJECTION,
        )
    )

    days = period_days(start_date, end_date)
    data = compute_productivity(orders, days)

    if requested_dispatchers and requested_dispatchers != "all":
        dispatcher_names = [name for name in requested_dispatchers if name in data]
        if not dispatcher_names:
            return jsonify({"error": "none of the requested dispatchers have data in this period"}), 400
        report_orders = [o for o in orders if o.get("assignedTo") in dispatcher_names]
    else:
        dispatcher_names = [name for name in data.keys() if name not in EXCLUDED_DISPATCHERS]
        report_orders = [o for o in orders if o.get("assignedTo") not in EXCLUDED_DISPATCHERS]

    summary = build_summary(report_orders, database_name, collection_name, start_date, end_date)
    summary["in_warehouse"] = count_in_warehouse(collection)
    pdf_bytes = generate_report_pdf(dispatcher_names, data, summary, report_orders, start_date, end_date)

    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="dispatcher-report-{start_date}-to-{end_date}.pdf"'
        },
    )


@app.post("/api/tracking-lookup")
@require_auth
def tracking_lookup():
    body = request.get_json(silent=True) or {}
    tracking_number = body.get("tracking_number")
    database_name = body.get("database_name")
    collection_name = body.get("collection_name")

    if not all([tracking_number, database_name, collection_name]):
        return jsonify({"error": "tracking_number, database_name, and collection_name are required"}), 400

    collection = get_collection(database_name, collection_name)
    jobs = list(
        collection.find(
            {"doTrackingNumber": {"$regex": tracking_number, "$options": "i"}},
            {**ORDER_PROJECTION, "receiverAddress": 1, "senderName": 1, "product": 1},
        )
    )
    for job in jobs:
        job["_id"] = str(job["_id"])
        for entry in job.get("history", []):
            if "_id" in entry:
                entry["_id"] = str(entry["_id"])
            if isinstance(entry.get("dateUpdated"), datetime):
                entry["dateUpdated"] = entry["dateUpdated"].isoformat()

    return jsonify({"jobs": jobs})


@app.get("/api/jobs/<job_id>")
@require_auth
def job_status(job_id):
    job = get_job(job_id)
    if job is None:
        return jsonify({"error": "job not found"}), 404
    return jsonify(job)


@app.post("/api/build-prediction-models")
@require_auth
def build_prediction_models():
    body = request.get_json(silent=True) or {}
    database_name = body.get("database_name")
    collection_name = body.get("collection_name")

    if not all([database_name, collection_name]):
        return jsonify({"error": "database_name and collection_name are required"}), 400

    def run():
        collection = get_collection(database_name, collection_name)
        all_orders = list(collection.find({}, ORDER_PROJECTION))

        dispatchers = {
            order.get("assignedTo")
            for order in all_orders
            if order.get("assignedTo") not in EXCLUDED_DISPATCHERS
        }

        weekly_productivity = build_weekly_productivity(all_orders)
        models_built = {
            dispatcher: check_dispatcher_model(weekly_productivity, dispatcher)
            for dispatcher in sorted(dispatchers)
        }

        return {"models_built": models_built, "total_models": len(models_built)}

    return jsonify({"job_id": start_job(run)}), 202


@app.post("/api/custom-prediction")
@require_auth
def custom_prediction():
    body = request.get_json(silent=True) or {}
    dispatcher = body.get("dispatcher")
    database_name = body.get("database_name", "GR_DMS")
    collection_name = body.get("collection_name", "orders")
    months_ahead = int(body.get("months_ahead") or 3)
    daily_capacity = int(body.get("daily_capacity") or DEFAULT_DAILY_CAPACITY)

    if not dispatcher:
        return jsonify({"error": "dispatcher is required"}), 400

    def run():
        collection = get_collection(database_name, collection_name)
        all_orders = list(collection.find({}, ORDER_PROJECTION))
        return {"arima_prediction": forecast_dispatcher(all_orders, dispatcher, months_ahead, daily_capacity)}

    return jsonify({"job_id": start_job(run)}), 202


@app.post("/api/scenario-analysis")
@require_auth
def scenario_analysis():
    body = request.get_json(silent=True) or {}
    dispatcher = body.get("dispatcher")
    scenarios = body.get("scenarios")
    database_name = body.get("database_name", "GR_DMS")
    collection_name = body.get("collection_name", "orders")

    if not dispatcher or not scenarios:
        return jsonify({"error": "dispatcher and scenarios are required"}), 400

    def run():
        collection = get_collection(database_name, collection_name)
        all_orders = list(collection.find({}, ORDER_PROJECTION))
        return {"scenarios": run_scenario_analysis(all_orders, dispatcher, scenarios)}

    return jsonify({"job_id": start_job(run)}), 202


@app.post("/api/model-diagnostics")
@require_auth
def model_diagnostics():
    body = request.get_json(silent=True) or {}
    dispatcher = body.get("dispatcher")
    database_name = body.get("database_name", "GR_DMS")
    collection_name = body.get("collection_name", "orders")

    if not dispatcher:
        return jsonify({"error": "dispatcher is required"}), 400

    def run():
        collection = get_collection(database_name, collection_name)
        all_orders = list(collection.find({}, ORDER_PROJECTION))
        return {"diagnostics": dispatcher_model_diagnostics(all_orders, dispatcher)}

    return jsonify({"job_id": start_job(run)}), 202


@app.post("/api/seasonal-decomposition")
@require_auth
def seasonal_decomposition():
    body = request.get_json(silent=True) or {}
    dispatcher = body.get("dispatcher")
    database_name = body.get("database_name", "GR_DMS")
    collection_name = body.get("collection_name", "orders")

    if not dispatcher:
        return jsonify({"error": "dispatcher is required"}), 400

    collection = get_collection(database_name, collection_name)
    all_orders = list(collection.find({}, ORDER_PROJECTION))

    try:
        decomposition = dispatcher_seasonal_decomposition(all_orders, dispatcher)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"decomposition": decomposition})


@app.post("/api/bulk-custom-predictions")
@require_auth
def bulk_custom_predictions():
    body = request.get_json(silent=True) or {}
    database_name = body.get("database_name", "GR_DMS")
    collection_name = body.get("collection_name", "orders")
    months_ahead = int(body.get("months_ahead") or 3)
    daily_capacity = int(body.get("daily_capacity") or DEFAULT_DAILY_CAPACITY)
    requested_dispatchers = body.get("dispatchers")

    def run():
        collection = get_collection(database_name, collection_name)
        all_orders = list(collection.find({}, ORDER_PROJECTION))

        if requested_dispatchers and requested_dispatchers != "all":
            dispatchers = requested_dispatchers
        else:
            dispatchers = sorted(
                {
                    order.get("assignedTo")
                    for order in all_orders
                    if order.get("assignedTo") not in EXCLUDED_DISPATCHERS
                }
            )

        results = {}
        for dispatcher in dispatchers:
            try:
                results[dispatcher] = forecast_dispatcher(all_orders, dispatcher, months_ahead, daily_capacity)
            except Exception as exc:
                results[dispatcher] = {"error": str(exc)}

        return {
            "predictions": results,
            "total_predictions": sum(1 for r in results.values() if "error" not in r),
        }

    return jsonify({"job_id": start_job(run)}), 202


if __name__ == "__main__":
    app.run(port=int(os.environ.get("PORT", 5001)), debug=True)
