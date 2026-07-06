import argparse
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LINKS_FILE = ROOT / "submission" / "submission-links.md"
CHECKLIST_FILE = ROOT / "docs" / "checklist.md"


def main() -> None:
    parser = argparse.ArgumentParser(description="Cap nhat link GitHub va video nop bai.")
    parser.add_argument("--github", required=True, help="URL GitHub repository")
    parser.add_argument("--video", required=True, help="URL video trinh bay")
    args = parser.parse_args()

    LINKS_FILE.write_text(
        f"""# Link nộp bài

| Hạng mục | Link |
| --- | --- |
| GitHub repository | {args.github} |
| Video trình bày 5-7 phút | {args.video} |

## Ghi chú

Hai link đã được cập nhật để dùng khi nộp bài.
""",
        encoding="utf-8",
    )

    checklist = CHECKLIST_FILE.read_text(encoding="utf-8")
    checklist = checklist.replace(
        "- [ ] Thêm link GitHub sau khi upload vào `submission/submission-links.md`.",
        "- [x] Thêm link GitHub sau khi upload vào `submission/submission-links.md`.",
    )
    checklist = checklist.replace(
        "- [ ] Thêm link video trình bày 5-7 phút vào `submission/submission-links.md`.",
        "- [x] Thêm link video trình bày 5-7 phút vào `submission/submission-links.md`.",
    )
    CHECKLIST_FILE.write_text(checklist, encoding="utf-8")
    print(LINKS_FILE)


if __name__ == "__main__":
    main()
