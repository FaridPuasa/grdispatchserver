import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone

BRUNEI_TZ = timezone(timedelta(hours=8))

AREA_TIERS = {
    "TUTONG": 1,
    "TEMBURONG": 1,
    "KB": 2,
    "SERIA": 2,
    "LUMUT": 2,
    "B": 3,
    "G": 4,
    "JT": 4,
}

AREA_TOKEN_SPLIT_RE = re.compile(r"[/,&]")
AREA_SUBZONE_RE = re.compile(r"^([A-Z]+)\d+$")

TIER_POINTS = {1: 100, 2: 75, 3: 50, 4: 25}
NO_CREDIT_POINTS = 0

ON_TIME_SLA_HOURS = 72
GAP_THRESHOLD_MINUTES = 30

SCORE_WEIGHTS = {
    "success": 0.40,
    "route_area": 0.35,
    "on_time": 0.15,
    "throughput": 0.10,
}

COMPLETED_STATUS = "Completed"
AT_WAREHOUSE_STATUS = "At Warehouse"
OUT_FOR_DELIVERY_STATUS = "Out for Delivery"

EXCLUDED_DISPATCHERS = {"N/A", "Unassigned", None, ""}


def parse_dt(value):
    if not value:
        return None
    dt = value if isinstance(value, datetime) else datetime.fromisoformat(value)
    if dt.tzinfo is None:
        # Upstream history entries with no UTC offset are already Brunei
        # local wall-clock time (confirmed against timestamps that still
        # carry an explicit +08:00/+00:00 offset), not UTC.
        dt = dt.replace(tzinfo=BRUNEI_TZ)
    return dt


def area_tier_points(area):
    if not area:
        return NO_CREDIT_POINTS

    tiers = []
    for raw_token in AREA_TOKEN_SPLIT_RE.split(area.upper()):
        token = raw_token.strip()
        if not token:
            continue
        if token in AREA_TIERS:
            tiers.append(AREA_TIERS[token])
            continue
        subzone = AREA_SUBZONE_RE.match(token)
        if subzone and subzone.group(1) in AREA_TIERS:
            tiers.append(AREA_TIERS[subzone.group(1)])

    if not tiers:
        return NO_CREDIT_POINTS
    return TIER_POINTS[min(tiers)]


def history_entries(order, status_name):
    return [
        entry
        for entry in order.get("history", [])
        if entry.get("statusHistory") == status_name
    ]


def first_entry_time(order, status_name):
    entries = history_entries(order, status_name)
    if not entries:
        return None
    dts = [parse_dt(e.get("dateUpdated")) for e in entries]
    dts = [dt for dt in dts if dt is not None]
    return min(dts) if dts else None


def last_entry_time(order, status_name):
    entries = history_entries(order, status_name)
    if not entries:
        return None
    dts = [parse_dt(e.get("dateUpdated")) for e in entries]
    dts = [dt for dt in dts if dt is not None]
    return max(dts) if dts else None


def is_on_time(order):
    warehouse_time = first_entry_time(order, AT_WAREHOUSE_STATUS)
    completed_time = last_entry_time(order, COMPLETED_STATUS)
    if warehouse_time is None or completed_time is None:
        return None
    elapsed_hours = (completed_time - warehouse_time).total_seconds() / 3600
    return elapsed_hours <= ON_TIME_SLA_HOURS


def format_gap(minutes):
    hours, mins = divmod(round(minutes), 60)
    if hours:
        return f"{hours}h {mins}m"
    return f"{mins}min"


def compute_completion_gaps(orders):
    completions = []
    for order in orders:
        completed_time = last_entry_time(order, COMPLETED_STATUS)
        if completed_time is None:
            continue
        completions.append(
            {
                "time": completed_time,
                "track": order.get("doTrackingNumber"),
                "postal": order.get("receiverPostalCode"),
            }
        )
    completions.sort(key=lambda c: c["time"])

    by_day = defaultdict(list)
    for c in completions:
        by_day[c["time"].date().isoformat()].append(c)

    flagged_days = {}
    all_gap_minutes = []

    for day, day_completions in by_day.items():
        day_gaps = []
        for prev, current in zip(day_completions, day_completions[1:]):
            gap_minutes = (current["time"] - prev["time"]).total_seconds() / 60
            if gap_minutes > GAP_THRESHOLD_MINUTES:
                day_gaps.append(
                    {
                        "prev_track": prev["track"],
                        "current_track": current["track"],
                        "prev_postal": prev["postal"],
                        "current_postal": current["postal"],
                        "gap_formatted": format_gap(gap_minutes),
                        "prev_completion": prev["time"].isoformat(),
                        "current_completion": current["time"].isoformat(),
                    }
                )
                all_gap_minutes.append(gap_minutes)

        if day_gaps:
            flagged_days[day] = {
                "total_gaps": len(day_gaps),
                "total_jobs": len(day_completions),
                "gaps": day_gaps,
            }

    return {
        "total_gaps": len(all_gap_minutes),
        "avg_gap_minutes": round(sum(all_gap_minutes) / len(all_gap_minutes), 1)
        if all_gap_minutes
        else 0,
        "max_gap_minutes": round(max(all_gap_minutes), 1) if all_gap_minutes else 0,
        "flagged_days": flagged_days,
    }


def compute_area_distribution(orders):
    counts = defaultdict(int)
    for order in orders:
        area = order.get("area")
        if not area or area == "N/A":
            continue
        counts[area] += 1
    return dict(counts)


def _time_of_day_seconds(dt):
    return dt.hour * 3600 + dt.minute * 60 + dt.second


def _format_hhmm(seconds):
    hours, remainder = divmod(int(seconds) % 86400, 3600)
    minutes = remainder // 60
    return f"{hours:02d}:{minutes:02d}"


def compute_daily_schedule(orders):
    starts_by_day = defaultdict(list)
    ends_by_day = defaultdict(list)

    for order in orders:
        for entry in order.get("history", []):
            status = entry.get("statusHistory")
            if status not in (OUT_FOR_DELIVERY_STATUS, COMPLETED_STATUS):
                continue
            dt = parse_dt(entry.get("dateUpdated"))
            if dt is None:
                continue
            dt = dt.astimezone(BRUNEI_TZ)
            day = dt.date().isoformat()
            if status == OUT_FOR_DELIVERY_STATUS:
                starts_by_day[day].append(dt)
            else:
                ends_by_day[day].append(dt)

    daily = []
    for day in sorted(set(starts_by_day) | set(ends_by_day)):
        start_dt = min(starts_by_day[day]) if starts_by_day.get(day) else None
        end_dt = max(ends_by_day[day]) if ends_by_day.get(day) else None
        daily.append(
            {
                "date": day,
                "start_time": start_dt.strftime("%H:%M") if start_dt else None,
                "end_time": end_dt.strftime("%H:%M") if end_dt else None,
            }
        )

    start_seconds = [_time_of_day_seconds(min(v)) for v in starts_by_day.values()]
    end_seconds = [_time_of_day_seconds(max(v)) for v in ends_by_day.values()]

    return {
        "daily": daily,
        "avg_start_time": _format_hhmm(sum(start_seconds) / len(start_seconds)) if start_seconds else None,
        "avg_end_time": _format_hhmm(sum(end_seconds) / len(end_seconds)) if end_seconds else None,
        "days_worked": len(daily),
    }


def compute_dispatcher_metrics(orders, period_days):
    total_jobs = len(orders)
    completed_orders = [o for o in orders if o.get("currentStatus") == COMPLETED_STATUS]
    completed_jobs = len(completed_orders)

    delivery_success_rate = (
        round(completed_jobs / total_jobs * 100, 1) if total_jobs else 0
    )

    on_time_flags = [is_on_time(o) for o in completed_orders]
    on_time_flags = [f for f in on_time_flags if f is not None]
    on_time_rate = (
        round(sum(on_time_flags) / len(on_time_flags) * 100, 1)
        if on_time_flags
        else 0
    )

    route_difficulty_points = [area_tier_points(o.get("area")) for o in completed_orders]
    route_difficulty_score = (
        round(sum(route_difficulty_points) / len(route_difficulty_points), 1)
        if route_difficulty_points
        else 0
    )

    throughput_per_day = (
        round(completed_jobs / period_days, 2) if period_days else 0
    )

    return {
        "total_jobs": total_jobs,
        "completed_jobs": completed_jobs,
        "metrics": {
            "delivery_success_rate": delivery_success_rate,
            "on_time_rate": on_time_rate,
            "route_difficulty_score": route_difficulty_score,
            "throughput_per_day": throughput_per_day,
        },
        "completion_gaps": compute_completion_gaps(completed_orders),
        "area_distribution": compute_area_distribution(orders),
        "schedule": compute_daily_schedule(orders),
    }


def apply_overall_scores(dispatcher_metrics):
    throughputs = [
        d["metrics"]["throughput_per_day"] for d in dispatcher_metrics.values()
    ]
    company_avg_throughput = sum(throughputs) / len(throughputs) if throughputs else 0

    for data in dispatcher_metrics.values():
        m = data["metrics"]
        throughput_score = (
            min(100, (m["throughput_per_day"] / company_avg_throughput) * 100)
            if company_avg_throughput
            else 0
        )
        overall_score = (
            SCORE_WEIGHTS["success"] * m["delivery_success_rate"]
            + SCORE_WEIGHTS["route_area"] * m["route_difficulty_score"]
            + SCORE_WEIGHTS["on_time"] * m["on_time_rate"]
            + SCORE_WEIGHTS["throughput"] * throughput_score
        )
        m["throughput_score"] = round(throughput_score, 1)
        data["overall_score"] = round(overall_score, 1)

    return dispatcher_metrics


def compute_productivity(orders, period_days):
    by_dispatcher = defaultdict(list)
    for order in orders:
        dispatcher = order.get("assignedTo") or "Unassigned"
        if dispatcher in EXCLUDED_DISPATCHERS:
            continue
        by_dispatcher[dispatcher].append(order)

    result = {
        dispatcher: compute_dispatcher_metrics(dispatcher_orders, period_days)
        for dispatcher, dispatcher_orders in by_dispatcher.items()
    }
    return apply_overall_scores(result)
