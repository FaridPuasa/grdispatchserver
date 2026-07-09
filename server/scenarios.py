from collections import defaultdict

from forecasting import days_in_month, is_valid_month_key, month_key
from metrics import SCORE_WEIGHTS, compute_productivity

# Each scenario input field maps to metric adjustments.
# For 0-100 scaled metrics, the coefficient is additive percentage points per
# 100% relative change in the input multiplier (e.g. -15 means a full doubling
# of the input costs 15 points; a 30% increase costs 4.5 points).
# For throughput_per_day, the coefficient is a multiplicative pass-through
# since throughput is a rate, not a 0-100 score.
SCENARIO_ELASTICITY = {
    "total_jobs": {
        "throughput_per_day": 1.0,
        "delivery_success_rate": -15.0,
        "on_time_rate": -25.0,
    },
    "completion_rate": {
        "delivery_success_rate": 100.0,
    },
    "avg_completion_gap": {
        "on_time_rate": -100.0,
    },
    "throughput_per_day": {
        "throughput_per_day": 1.0,
    },
}

POINT_METRICS = {"delivery_success_rate", "on_time_rate", "route_difficulty_score"}


def latest_month_metrics(all_orders, dispatcher):
    by_month = defaultdict(list)
    for order in all_orders:
        job_date = order.get("jobDate")
        if not job_date:
            continue
        key = month_key(job_date)
        if not is_valid_month_key(key):
            continue
        by_month[key].append(order)

    for month in sorted(by_month.keys(), reverse=True):
        result = compute_productivity(by_month[month], days_in_month(month))
        if dispatcher in result:
            return month, result[dispatcher]
    return None, None


def apply_scenario(baseline_metrics, scenario_params):
    m = dict(baseline_metrics["metrics"])
    unmapped = []

    for param, multiplier in scenario_params.items():
        if param == "description":
            continue
        effects = SCENARIO_ELASTICITY.get(param)
        if effects is None:
            unmapped.append(param)
            continue
        relative_change = multiplier - 1
        for metric_name, coefficient in effects.items():
            if metric_name == "throughput_per_day":
                m["throughput_per_day"] = max(0, m["throughput_per_day"] * (1 + coefficient * relative_change))
                m["throughput_score"] = max(0, min(100, m["throughput_score"] * (1 + coefficient * relative_change)))
            elif metric_name in POINT_METRICS:
                m[metric_name] = max(0, min(100, m[metric_name] + coefficient * relative_change))

    new_overall = (
        SCORE_WEIGHTS["success"] * m["delivery_success_rate"]
        + SCORE_WEIGHTS["route_area"] * m["route_difficulty_score"]
        + SCORE_WEIGHTS["on_time"] * m["on_time_rate"]
        + SCORE_WEIGHTS["throughput"] * m["throughput_score"]
    )

    return round(new_overall, 1), m, unmapped


def describe_effects(baseline_metrics, new_metrics):
    labels = {
        "delivery_success_rate": "Delivery success rate",
        "on_time_rate": "On-time rate",
        "route_difficulty_score": "Route difficulty score",
        "throughput_per_day": "Throughput per day",
    }
    effects = []
    for key, label in labels.items():
        before = baseline_metrics["metrics"][key]
        after = new_metrics[key]
        delta = round(after - before, 1)
        if abs(delta) < 0.05:
            continue
        sign = "+" if delta > 0 else ""
        unit = "" if key == "throughput_per_day" else " pts"
        effects.append(f"{label}: {sign}{delta}{unit}")
    return effects


def run_scenario_analysis(all_orders, dispatcher, scenarios):
    month, baseline = latest_month_metrics(all_orders, dispatcher)
    if baseline is None:
        raise ValueError(f"no historical data available for dispatcher '{dispatcher}'")

    results = {}
    for scenario_name, scenario_params in scenarios.items():
        new_overall, new_metrics, unmapped = apply_scenario(baseline, scenario_params)
        predicted_change = round(new_overall - baseline["overall_score"], 1)
        description = scenario_params.get("description", scenario_name)

        results[scenario_name] = {
            "predicted_change": predicted_change,
            "predicted_score": new_overall,
            "impact_description": f"{description} (based on {month} baseline)",
            "detailed_effects": describe_effects(baseline, new_metrics),
            "likelihood": "Medium" if unmapped else "High",
        }

    return results
