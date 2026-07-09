import io
from datetime import date, timedelta

from reportlab.graphics.charts.barcharts import HorizontalBarChart, VerticalBarChart
from reportlab.graphics.charts.linecharts import HorizontalLineChart
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.widgets.markers import makeMarker
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from metrics import COMPLETED_STATUS, last_entry_time

BRAND_BLUE_HEX = "#2563EB"
PURPLE_HEX = "#7C3AED"
GREEN_HEX = "#16A34A"
AMBER_HEX = "#CA8A04"
RED_HEX = "#DC2626"

BRAND_BLUE = colors.HexColor(BRAND_BLUE_HEX)
PURPLE = colors.HexColor(PURPLE_HEX)
GREEN = colors.HexColor(GREEN_HEX)
AMBER = colors.HexColor(AMBER_HEX)
RED = colors.HexColor(RED_HEX)
LIGHT_BLUE = colors.HexColor("#EFF6FF")
BORDER_GREY = colors.HexColor("#E5E7EB")
ZEBRA_GREY = colors.HexColor("#F9FAFB")
MUTED_GREY = colors.HexColor("#6B7280")

_styles = getSampleStyleSheet()
TITLE_STYLE = ParagraphStyle("ReportTitle", parent=_styles["Title"], fontSize=20, spaceAfter=4)
SUBTITLE_STYLE = ParagraphStyle(
    "ReportSubtitle", parent=_styles["Normal"], fontSize=10, textColor=colors.grey, spaceAfter=12
)
SECTION_STYLE = ParagraphStyle("ReportSection", parent=_styles["Heading1"], spaceBefore=4, spaceAfter=6)
SUBHEADING_STYLE = ParagraphStyle("ReportSubheading", parent=_styles["Heading3"], spaceBefore=10, spaceAfter=4)
NORMAL_STYLE = _styles["Normal"]
STAT_LABEL_STYLE = ParagraphStyle("StatLabel", parent=_styles["Normal"], fontSize=8, textColor=MUTED_GREY)


def _score_color(value):
    if value >= 85:
        return GREEN
    if value >= 70:
        return AMBER
    return RED


def _score_color_hex(value):
    if value >= 85:
        return GREEN_HEX
    if value >= 70:
        return AMBER_HEX
    return RED_HEX


def _table_style(header_bg=BRAND_BLUE, header_fg=colors.white, zebra=True):
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("TEXTCOLOR", (0, 0), (-1, 0), header_fg),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GREY),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    if zebra:
        style.append(("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ZEBRA_GREY]))
    return TableStyle(style)


def _overview_table(summary, dispatcher_count):
    rows = [
        ["Total Jobs", "Warehouse Receipts", "Dispatchers Included"],
        [str(summary["total_jobs"]), str(summary["warehouse_receipts"]), str(dispatcher_count)],
    ]
    table = Table(rows, colWidths=[55 * mm, 55 * mm, 55 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), LIGHT_BLUE),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GREY),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def _stat_card(label, value, color_hex):
    return [
        Paragraph(label, STAT_LABEL_STYLE),
        Paragraph(
            f'<font color="{color_hex}"><b>{value}</b></font>', ParagraphStyle("StatValue", fontSize=16)
        ),
    ]


def _stat_cards_row(score_data, rank, total_dispatchers):
    cells = [
        _stat_card(
            "OVERALL SCORE", f"{score_data['overall_score']}%", _score_color_hex(score_data["overall_score"])
        ),
        _stat_card("TOTAL JOBS", str(score_data["total_jobs"]), BRAND_BLUE_HEX),
        _stat_card("COMPLETED", str(score_data["completed_jobs"]), PURPLE_HEX),
        _stat_card("RANK", f"#{rank} of {total_dispatchers}", GREEN_HEX),
    ]
    table = Table([cells], colWidths=[43 * mm] * 4)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), ZEBRA_GREY),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_GREY),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_GREY),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    return table


def _score_breakdown_chart(score_data):
    m = score_data["metrics"]
    values = [
        m["delivery_success_rate"],
        m["on_time_rate"],
        m["route_difficulty_score"],
        score_data["overall_score"],
    ]
    labels = ["Success", "On-Time", "Route Diff.", "Overall"]

    drawing = Drawing(480, 140)
    chart = VerticalBarChart()
    chart.x = 40
    chart.y = 30
    chart.width = 400
    chart.height = 95
    chart.data = [values]
    chart.categoryAxis.categoryNames = labels
    chart.categoryAxis.labels.fontSize = 9
    chart.valueAxis.valueMin = 0
    chart.valueAxis.valueMax = 100
    chart.valueAxis.valueStep = 25
    chart.valueAxis.labels.fontSize = 8
    chart.barWidth = 14
    chart.groupSpacing = 20
    chart.barLabelFormat = "%0.0f%%"
    chart.barLabels.fontSize = 8
    chart.barLabels.dy = 6
    for i, value in enumerate(values):
        chart.bars[(0, i)].fillColor = _score_color(value)
    drawing.add(chart)
    return drawing


def _trend_buckets(start_date, end_date, max_buckets=10):
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    total_days = (end - start).days + 1
    bucket_size = max(1, -(-total_days // max_buckets))
    buckets = []
    cursor = start
    while cursor <= end:
        bucket_end = min(cursor + timedelta(days=bucket_size - 1), end)
        buckets.append((cursor, bucket_end))
        cursor = bucket_end + timedelta(days=1)
    return buckets


def _bucket_label(bucket_start, bucket_end):
    if bucket_start == bucket_end:
        return bucket_start.strftime("%d %b")
    return f"{bucket_start.strftime('%d %b')}"


def _trend_chart(dispatcher_orders, start_date, end_date):
    buckets = _trend_buckets(start_date, end_date)
    if len(buckets) < 2:
        return None

    counts = [0] * len(buckets)
    for order in dispatcher_orders:
        completed_time = last_entry_time(order, COMPLETED_STATUS)
        if completed_time is None:
            continue
        day = completed_time.date()
        for i, (bucket_start, bucket_end) in enumerate(buckets):
            if bucket_start <= day <= bucket_end:
                counts[i] += 1
                break

    if sum(counts) == 0:
        return None

    labels = [_bucket_label(b_start, b_end) for b_start, b_end in buckets]

    drawing = Drawing(480, 150)
    chart = HorizontalLineChart()
    chart.x = 45
    chart.y = 35
    chart.width = 410
    chart.height = 95
    chart.data = [counts]
    chart.categoryAxis.categoryNames = labels
    chart.categoryAxis.labels.fontSize = 7
    chart.categoryAxis.labels.angle = 30
    chart.categoryAxis.labels.dy = -12
    chart.categoryAxis.labels.dx = -4
    chart.valueAxis.valueMin = 0
    chart.valueAxis.labels.fontSize = 8
    chart.lines[0].strokeColor = BRAND_BLUE
    chart.lines[0].strokeWidth = 2
    chart.lines[0].symbol = makeMarker("FilledCircle")
    chart.lines[0].symbol.strokeColor = BRAND_BLUE
    chart.lines[0].symbol.fillColor = BRAND_BLUE
    chart.lines[0].symbol.size = 4
    drawing.add(chart)
    return drawing


def _area_chart(area_distribution):
    if not area_distribution:
        return None
    items = sorted(area_distribution.items(), key=lambda kv: -kv[1])[:8]
    labels = [k for k, _ in items]
    values = [v for _, v in items]

    drawing = Drawing(480, 22 * len(items) + 25)
    chart = HorizontalBarChart()
    chart.x = 75
    chart.y = 15
    chart.width = 370
    chart.height = 22 * len(items)
    chart.data = [values]
    chart.categoryAxis.categoryNames = labels
    chart.categoryAxis.labels.fontSize = 8
    chart.valueAxis.valueMin = 0
    chart.valueAxis.labels.fontSize = 8
    chart.bars[0].fillColor = PURPLE
    chart.barLabelFormat = "%d"
    chart.barLabels.fontSize = 8
    chart.barLabels.dx = 6
    chart.bars.strokeColor = None
    drawing.add(chart)
    return drawing


def _area_table(area_distribution):
    if not area_distribution:
        return Paragraph("No area data available.", NORMAL_STYLE)
    total = sum(area_distribution.values())
    rows = [["Area", "Jobs", "% of Total"]]
    for area, count in sorted(area_distribution.items(), key=lambda kv: -kv[1]):
        pct = round(count / total * 100, 1) if total else 0
        rows.append([area, str(count), f"{pct}%"])
    table = Table(rows, colWidths=[60 * mm, 45 * mm, 45 * mm])
    table.setStyle(_table_style(header_bg=colors.HexColor("#F3F4F6"), header_fg=colors.black))
    return table


def _gaps_paragraph(completion_gaps):
    if not completion_gaps or not completion_gaps.get("total_gaps"):
        return Paragraph(
            '<font color="#16A34A">No completion gaps over 30 minutes detected.</font>', NORMAL_STYLE
        )
    return Paragraph(
        f"{completion_gaps['total_gaps']} gap(s) over 30 minutes detected "
        f"(avg {completion_gaps['avg_gap_minutes']} min, max {completion_gaps['max_gap_minutes']} min).",
        NORMAL_STYLE,
    )


def generate_report_pdf(dispatcher_names, dispatcher_data, summary, orders, start_date, end_date):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        title="Dispatcher Productivity Report",
    )

    orders_by_dispatcher = {}
    for order in orders:
        dispatcher = order.get("assignedTo") or "Unassigned"
        orders_by_dispatcher.setdefault(dispatcher, []).append(order)

    story = [
        Paragraph("Dispatcher Productivity Report", TITLE_STYLE),
        Paragraph(
            f"{summary['date_range']} | Database: {summary['database']}.{summary['collection']}",
            SUBTITLE_STYLE,
        ),
        _overview_table(summary, len(dispatcher_names)),
        Spacer(1, 10 * mm),
    ]

    ranked = sorted(dispatcher_names, key=lambda name: -dispatcher_data[name]["overall_score"])
    total_dispatchers = len(ranked)

    for index, name in enumerate(ranked):
        score_data = dispatcher_data[name]
        if index > 0:
            story.append(PageBreak())

        story.append(Paragraph(name, SECTION_STYLE))
        story.append(_stat_cards_row(score_data, index + 1, total_dispatchers))
        story.append(Spacer(1, 6 * mm))

        story.append(Paragraph("Score Breakdown", SUBHEADING_STYLE))
        story.append(_score_breakdown_chart(score_data))

        trend = _trend_chart(orders_by_dispatcher.get(name, []), start_date, end_date)
        if trend is not None:
            story.append(Paragraph("Completed Jobs Over Time", SUBHEADING_STYLE))
            story.append(trend)

        area_distribution = score_data.get("area_distribution")
        area_chart = _area_chart(area_distribution)
        if area_chart is not None:
            story.append(Paragraph("Area Distribution", SUBHEADING_STYLE))
            story.append(area_chart)
            story.append(Spacer(1, 3 * mm))
            story.append(_area_table(area_distribution))

        story.append(Paragraph("Completion Gaps", SUBHEADING_STYLE))
        story.append(_gaps_paragraph(score_data.get("completion_gaps")))

    doc.build(story)
    return buffer.getvalue()
