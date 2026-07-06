import html
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPORT_MD = ROOT / "report" / "bao_cao_bai_tap_lon.md"
REPORT_HTML = ROOT / "submission" / "bao_cao_bai_tap_lon.html"


def convert_markdown_to_html(markdown_text: str) -> str:
    """Chuyển Markdown cơ bản sang HTML in báo cáo."""
    lines = markdown_text.splitlines()
    html_lines = []
    in_code = False
    in_list = False

    for line in lines:
        if line.startswith("```"):
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append("</code></pre>" if in_code else "<pre><code>")
            in_code = not in_code
            continue

        if in_code:
            html_lines.append(html.escape(line))
            continue

        if not line.strip():
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            continue

        if line.startswith("#"):
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            level = min(len(line) - len(line.lstrip("#")), 4)
            text = line[level:].strip()
            html_lines.append(f"<h{level}>{inline(text)}</h{level}>")
            continue

        if line.startswith("- "):
            if not in_list:
                html_lines.append("<ul>")
                in_list = True
            html_lines.append(f"<li>{inline(line[2:].strip())}</li>")
            continue

        if re.match(r"^\d+\. ", line):
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            text = re.sub(r"^\d+\. ", "", line)
            html_lines.append(f"<p>{inline(text)}</p>")
            continue

        if line.startswith("|"):
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            cells = [inline(cell.strip()) for cell in line.strip("|").split("|")]
            if all(set(cell.replace(" ", "")) <= {"-"} for cell in cells):
                continue
            tag = "th" if not html_lines or not html_lines[-1].startswith("<table") else "td"
            row = "".join(f"<{tag}>{cell}</{tag}>" for cell in cells)
            html_lines.append(f"<table><tr>{row}</tr></table>")
            continue

        if in_list:
            html_lines.append("</ul>")
            in_list = False
        html_lines.append(f"<p>{inline(line)}</p>")

    if in_list:
        html_lines.append("</ul>")
    return "\n".join(html_lines)


def inline(text: str) -> str:
    """Escape HTML và xử lý inline code/ảnh đơn giản."""
    image_match = re.fullmatch(r"!\[(.*?)\]\((.*?)\)", text.strip())
    if image_match:
        alt, src = image_match.groups()
        return f'<img src="{html.escape(src)}" alt="{html.escape(alt)}">'

    escaped = html.escape(text)
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
    return escaped


def main() -> None:
    REPORT_HTML.parent.mkdir(parents=True, exist_ok=True)
    content = convert_markdown_to_html(REPORT_MD.read_text(encoding="utf-8"))
    REPORT_HTML.write_text(
        f"""<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>Bao cao bai tap lon</title>
  <style>
    body {{ font-family: Arial, sans-serif; color: #17202a; line-height: 1.55; margin: 40px; }}
    h1, h2, h3 {{ color: #0f4c81; page-break-after: avoid; }}
    h1 {{ font-size: 28px; border-bottom: 2px solid #0f4c81; padding-bottom: 10px; }}
    h2 {{ font-size: 21px; margin-top: 28px; }}
    h3 {{ font-size: 17px; }}
    p, li {{ font-size: 12.5px; }}
    code {{ background: #f1f5f9; padding: 2px 4px; border-radius: 4px; }}
    pre {{ background: #0f172a; color: #e2e8f0; padding: 14px; border-radius: 6px; overflow-wrap: anywhere; white-space: pre-wrap; }}
    table {{ width: 100%; border-collapse: collapse; margin: 8px 0; page-break-inside: avoid; }}
    th, td {{ border: 1px solid #cbd5e1; padding: 7px; font-size: 11.5px; text-align: left; }}
    th {{ background: #eaf2f8; }}
    img {{ max-width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; margin: 12px 0; }}
  </style>
</head>
<body>
{content}
</body>
</html>
""",
        encoding="utf-8",
    )
    print(REPORT_HTML)


if __name__ == "__main__":
    main()
