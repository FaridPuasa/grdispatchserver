import io

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

BRAND_BLUE = colors.HexColor("#2563EB")
LIGHT_BLUE = colors.HexColor("#EFF6FF")
BORDER_GREY = colors.HexColor("#E5E7EB")
ZEBRA_GREY = colors.HexColor("#F9FAFB")

_styles = getSampleStyleSheet()
TITLE_STYLE = ParagraphStyle("ReportTitle", parent=_styles["Title"], fontSize=20, spaceAfter=4)
SUBTITLE_STYLE = ParagraphStyle(
    "ReportSubtitle", parent=_styles["Normal"], fontSize=10, textColor=colors.grey, spaceAfter=12
)
SECTION_STYLE = ParagraphStyle("ReportSection", parent=_styles["Heading2"], spaceBefore=4, spaceAfter=8)
SUBHEADING_STYLE = _styles["Heading3"]
NORMAL_STYLE = _styles["Normal"]


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


def _metric_table(score_data):
    m = score_data["metrics"]
    rows = [
        ["Metric", "Value"],
        ["Overall Score", f"{score_data['overall_score']}%"],
        ["Delivery Success Rate", f"{m['delivery_success_rate']}%"],
        ["On-Time Rate", f"{m['on_time_rate']}%"],
        ["Route Difficulty Score", f"{m['route_difficulty_score']}%"],
        ["Throughput / Day", f"{m['throughput_per_day']}"],
        ["Total Jobs", str(score_data["total_jobs"])],
        ["Completed Jobs", str(score_data["completed_jobs"])],
    ]
    table = Table(rows, colWidths=[90 * mm, 60 * mm])
    table.setStyle(_table_style())
    return table


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
        return Paragraph("No completion gaps over 30 minutes detected.", NORMAL_STYLE)
    return Paragraph(
        f"{completion_gaps['total_gaps']} gap(s) over 30 minutes detected "
        f"(avg {completion_gaps['avg_gap_minutes']} min, max {completion_gaps['max_gap_minutes']} min).",
        NORMAL_STYLE,
    )


def generate_report_pdf(dispatcher_names, dispatcher_data, summary):
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

    for index, name in enumerate(ranked):
        score_data = dispatcher_data[name]
        if index > 0:
            story.append(PageBreak())
        story.append(Paragraph(name, SECTION_STYLE))
        story.append(_metric_table(score_data))
        story.append(Spacer(1, 6 * mm))
        story.append(Paragraph("Area Distribution", SUBHEADING_STYLE))
        story.append(_area_table(score_data.get("area_distribution")))
        story.append(Spacer(1, 6 * mm))
        story.append(Paragraph("Completion Gaps", SUBHEADING_STYLE))
        story.append(_gaps_paragraph(score_data.get("completion_gaps")))

    doc.build(story)
    return buffer.getvalue()
