import re
from collections import defaultdict
from datetime import date

from statsmodels.tsa.arima.model import ARIMA

from metrics import compute_productivity

MIN_MONTHS_FOR_MODEL = 6
WORKING_DAYS_PER_MONTH = 26
ARIMA_ORDER = (1, 1, 1)

VALID_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")


def month_key(job_date_str):
    return job_date_str[:7]


def is_valid_month_key(key):
    return bool(VALID_MONTH_RE.match(key))


def days_in_month(month_key_str):
    year, month = (int(part) for part in month_key_str.split("-"))
    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)
    return (next_month - date(year, month, 1)).days


def build_monthly_productivity(all_orders):
    by_month = defaultdict(list)
    for order in all_orders:
        job_date = order.get("jobDate")
        if not job_date:
            continue
        key = month_key(job_date)
        if not is_valid_month_key(key):
            continue
        by_month[key].append(order)

    return {
        month: compute_productivity(month_orders, days_in_month(month))
        for month, month_orders in sorted(by_month.items())
    }


def dispatcher_series_from_monthly(monthly_productivity, dispatcher):
    months = sorted(
        month for month, result in monthly_productivity.items() if dispatcher in result
    )
    scores = [monthly_productivity[m][dispatcher]["overall_score"] for m in months]
    throughputs = [
        monthly_productivity[m][dispatcher]["metrics"]["throughput_per_day"] for m in months
    ]
    return months, scores, throughputs


def build_dispatcher_monthly_series(all_orders, dispatcher):
    monthly_productivity = build_monthly_productivity(all_orders)
    return dispatcher_series_from_monthly(monthly_productivity, dispatcher)


def fit_and_forecast(values, steps):
    if len(values) < MIN_MONTHS_FOR_MODEL:
        raise ValueError(
            f"insufficient historical data: need at least {MIN_MONTHS_FOR_MODEL} months, have {len(values)}"
        )
    model = ARIMA(values, order=ARIMA_ORDER)
    fitted = model.fit()
    forecast = fitted.get_forecast(steps=steps)
    mean = forecast.predicted_mean
    conf = forecast.conf_int(alpha=0.05)
    return [
        {
            "predicted": float(mean[i]),
            "lower": float(conf[i][0]),
            "upper": float(conf[i][1]),
        }
        for i in range(steps)
    ]


def check_dispatcher_model(monthly_productivity, dispatcher):
    months, scores, _ = dispatcher_series_from_monthly(monthly_productivity, dispatcher)
    if len(scores) < MIN_MONTHS_FOR_MODEL:
        return {
            "error": f"insufficient historical data ({len(scores)} months, need {MIN_MONTHS_FOR_MODEL})"
        }
    try:
        fit_and_forecast(scores, 1)
    except Exception as exc:
        return {"error": str(exc)}
    return {"months_available": len(scores), "status": "ready"}


def forecast_dispatcher(all_orders, dispatcher, months_ahead, daily_capacity):
    months, scores, throughputs = build_dispatcher_monthly_series(all_orders, dispatcher)
    if len(scores) < MIN_MONTHS_FOR_MODEL:
        raise ValueError(
            f"insufficient historical data for {dispatcher}: only {len(scores)} month(s) available, "
            f"need at least {MIN_MONTHS_FOR_MODEL}"
        )

    score_forecast = fit_and_forecast(scores, months_ahead)
    throughput_forecast = fit_and_forecast(throughputs, months_ahead)

    monthly_capacity = daily_capacity * WORKING_DAYS_PER_MONTH

    predictions = []
    for i in range(months_ahead):
        predicted_throughput = max(0, throughput_forecast[i]["predicted"])
        capacity_utilization = (
            round(predicted_throughput * WORKING_DAYS_PER_MONTH / monthly_capacity * 100, 1)
            if monthly_capacity
            else None
        )
        predictions.append(
            {
                "month": i + 1,
                "predicted_score": round(max(0, min(100, score_forecast[i]["predicted"])), 1),
                "confidence_lower": round(max(0, min(100, score_forecast[i]["lower"])), 1),
                "confidence_upper": round(max(0, min(100, score_forecast[i]["upper"])), 1),
                "capacity_utilization": capacity_utilization,
            }
        )

    return {
        "dispatcher": dispatcher,
        "model_type": f"ARIMA{ARIMA_ORDER}",
        "predictions": predictions,
        "capacity_constraints": {
            "daily_capacity": daily_capacity,
            "monthly_capacity": monthly_capacity,
        },
    }
