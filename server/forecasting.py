import re
import warnings
from collections import defaultdict
from datetime import date, timedelta

import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.stattools import adfuller
from statsmodels.tsa.statespace.sarimax import SARIMAX

from metrics import compute_productivity

# The grid search in _fit_sarima tries candidate orders that don't converge
# well; only the winning AIC result is used, so per-candidate convergence
# warnings are noise.
warnings.filterwarnings("ignore")

MIN_WEEKS_FOR_MODEL = 16  # ~4 months: enough for a seasonal model to find a repeating pattern instead of fitting noise
WEEKS_PER_MONTH = 4
WORKING_DAYS_PER_MONTH = 26
ARIMA_ORDER = (1, 1, 1)

VALID_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")

# Candidate (p,d,q) orders for the SARIMA grid search, kept modest to bound
# the number of model fits.
PDQ_ORDERS = [(p, d, q) for p in range(3) for d in range(2) for q in range(3)]


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


def week_start(job_date_str):
    day = date.fromisoformat(job_date_str[:10])
    return (day - timedelta(days=day.weekday())).isoformat()


def build_weekly_productivity(all_orders):
    by_week = defaultdict(list)
    for order in all_orders:
        job_date = order.get("jobDate")
        if not job_date:
            continue
        try:
            key = week_start(job_date)
        except ValueError:
            continue
        by_week[key].append(order)

    return {
        week: compute_productivity(week_orders, 7)
        for week, week_orders in sorted(by_week.items())
    }


def dispatcher_weekly_series(weekly_productivity, dispatcher):
    weeks = sorted(w for w, result in weekly_productivity.items() if dispatcher in result)
    scores = [weekly_productivity[w][dispatcher]["overall_score"] for w in weeks]
    throughputs = [weekly_productivity[w][dispatcher]["metrics"]["throughput_per_day"] for w in weeks]
    return weeks, scores, throughputs


def _as_continuous_series(weeks, values):
    # SARIMA assumes evenly spaced observations, so a week with no jobs left
    # as a hole in the index would silently break the seasonal term.
    # Linear interpolation + edge fill keeps the shape intact without
    # inventing dramatic jumps.
    index = pd.to_datetime(weeks)
    series = pd.Series(values, index=index).sort_index()
    full_index = pd.date_range(start=series.index.min(), end=series.index.max(), freq="W-MON")
    series = series.reindex(full_index)
    return series.interpolate(method="linear").ffill().bfill()


def _select_seasonal_period(n_observations):
    # Only trust a seasonal signal once there's at least two full cycles of
    # data to confirm it; otherwise fall back to non-seasonal ARIMA.
    if n_observations >= 104:
        return 52
    if n_observations >= 52:
        return 13
    return 0


def _fit_sarima(series):
    seasonal_period = _select_seasonal_period(len(series))
    seasonal_options = (
        [(0, 0, 0, 0), (1, 0, 0, seasonal_period), (0, 1, 1, seasonal_period), (1, 1, 1, seasonal_period)]
        if seasonal_period
        else [(0, 0, 0, 0)]
    )

    best_aic = float("inf")
    best_fitted = None
    best_order = None
    best_seasonal_order = None

    for order in PDQ_ORDERS:
        for seasonal_order in seasonal_options:
            try:
                fitted = SARIMAX(
                    series,
                    order=order,
                    seasonal_order=seasonal_order,
                    enforce_stationarity=False,
                    enforce_invertibility=False,
                ).fit(disp=False)
            except Exception:
                continue
            if fitted.aic < best_aic:
                best_aic = fitted.aic
                best_fitted = fitted
                best_order = order
                best_seasonal_order = seasonal_order

    if best_fitted is None:
        raise ValueError("could not fit a SARIMA model to this series")

    return best_fitted, best_order, best_seasonal_order, seasonal_period


def _fit_and_forecast_arima(values, steps):
    fitted = ARIMA(values, order=ARIMA_ORDER).fit()
    forecast = fitted.get_forecast(steps=steps)
    mean = forecast.predicted_mean
    conf = forecast.conf_int(alpha=0.05)
    return [float(mean[i]) for i in range(steps)]


def check_dispatcher_model(weekly_productivity, dispatcher):
    weeks, scores, _ = dispatcher_weekly_series(weekly_productivity, dispatcher)
    if len(scores) < MIN_WEEKS_FOR_MODEL:
        return {
            "error": f"insufficient historical data ({len(scores)} weeks, need {MIN_WEEKS_FOR_MODEL})"
        }
    try:
        series = _as_continuous_series(weeks, scores)
        is_stationary = bool(adfuller(series.dropna())[1] < 0.05)
        fitted, order, seasonal_order, seasonal_period = _fit_sarima(series)
    except Exception as exc:
        return {"error": str(exc)}
    return {
        "weeks_available": len(scores),
        "model_order": order,
        "seasonal_order": seasonal_order,
        "seasonal_period_weeks": seasonal_period,
        "is_stationary": is_stationary,
        "aic_score": round(float(fitted.aic), 2),
        "status": "ready",
    }


def forecast_dispatcher(all_orders, dispatcher, months_ahead, daily_capacity):
    weekly_productivity = build_weekly_productivity(all_orders)
    weeks, scores, throughputs = dispatcher_weekly_series(weekly_productivity, dispatcher)
    if len(scores) < MIN_WEEKS_FOR_MODEL:
        raise ValueError(
            f"insufficient historical data for {dispatcher}: only {len(scores)} week(s) available, "
            f"need at least {MIN_WEEKS_FOR_MODEL}"
        )

    weeks_ahead = months_ahead * WEEKS_PER_MONTH

    series = _as_continuous_series(weeks, scores)
    fitted, order, seasonal_order, _ = _fit_sarima(series)
    forecast_mean = fitted.forecast(steps=weeks_ahead)
    conf_int = fitted.get_forecast(steps=weeks_ahead).conf_int(alpha=0.05)

    throughput_forecast = _fit_and_forecast_arima(throughputs, weeks_ahead)

    monthly_capacity = daily_capacity * WORKING_DAYS_PER_MONTH

    predictions = []
    for month in range(months_ahead):
        start, end = month * WEEKS_PER_MONTH, (month + 1) * WEEKS_PER_MONTH
        predicted = float(forecast_mean.iloc[start:end].mean())
        lower = float(conf_int.iloc[start:end, 0].mean())
        upper = float(conf_int.iloc[start:end, 1].mean())

        predicted_throughput = max(0, sum(throughput_forecast[start:end]) / WEEKS_PER_MONTH)
        capacity_utilization = (
            round(predicted_throughput * WORKING_DAYS_PER_MONTH / monthly_capacity * 100, 1)
            if monthly_capacity
            else None
        )

        predictions.append(
            {
                "month": month + 1,
                "predicted_score": round(max(0, min(100, predicted)), 1),
                "confidence_lower": round(max(0, min(100, lower)), 1),
                "confidence_upper": round(max(0, min(100, upper)), 1),
                "capacity_utilization": capacity_utilization,
            }
        )

    return {
        "dispatcher": dispatcher,
        "model_type": f"SARIMA{order}x{seasonal_order}",
        "predictions": predictions,
        "capacity_constraints": {
            "daily_capacity": daily_capacity,
            "monthly_capacity": monthly_capacity,
        },
    }


def dispatcher_model_diagnostics(all_orders, dispatcher):
    weekly_productivity = build_weekly_productivity(all_orders)
    weeks, scores, _ = dispatcher_weekly_series(weekly_productivity, dispatcher)
    if len(scores) < MIN_WEEKS_FOR_MODEL:
        raise ValueError(
            f"insufficient historical data for {dispatcher}: only {len(scores)} week(s) available, "
            f"need at least {MIN_WEEKS_FOR_MODEL}"
        )

    series = _as_continuous_series(weeks, scores)
    fitted, order, seasonal_order, seasonal_period = _fit_sarima(series)

    return {
        "dispatcher": dispatcher,
        "model_order": order,
        "seasonal_order": seasonal_order,
        "seasonal_period_weeks": seasonal_period,
        "aic_score": round(float(fitted.aic), 2),
        "log_likelihood": round(float(fitted.llf), 2),
        "training_periods": len(series),
        "data_range": {
            "start": series.index[0].date().isoformat(),
            "end": series.index[-1].date().isoformat(),
        },
        "performance_stats": {
            "mean": round(float(series.mean()), 2),
            "std": round(float(series.std()), 2),
            "min": round(float(series.min()), 2),
            "max": round(float(series.max()), 2),
        },
    }


def dispatcher_seasonal_decomposition(all_orders, dispatcher):
    weekly_productivity = build_weekly_productivity(all_orders)
    weeks, scores, _ = dispatcher_weekly_series(weekly_productivity, dispatcher)
    if len(scores) < MIN_WEEKS_FOR_MODEL:
        raise ValueError(
            f"insufficient historical data for {dispatcher}: only {len(scores)} week(s) available, "
            f"need at least {MIN_WEEKS_FOR_MODEL}"
        )

    series = _as_continuous_series(weeks, scores)
    seasonal_period = _select_seasonal_period(len(series))
    if not seasonal_period or len(series) < seasonal_period * 2:
        raise ValueError("not enough history to decompose seasonality (need at least 2 full seasonal cycles)")

    decomposition = seasonal_decompose(series, model="additive", period=seasonal_period, extrapolate_trend="freq")

    return {
        "dispatcher": dispatcher,
        "seasonal_period_weeks": seasonal_period,
        "dates": [d.strftime("%Y-%m-%d") for d in series.index],
        "observed": [round(float(v), 2) for v in decomposition.observed],
        "trend": [round(float(v), 2) if not pd.isna(v) else None for v in decomposition.trend],
        "seasonal": [round(float(v), 2) for v in decomposition.seasonal],
        "residual": [round(float(v), 2) if not pd.isna(v) else None for v in decomposition.resid],
    }
