from __future__ import annotations

import csv
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Iterable

from openpyxl import load_workbook
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
ARCHIVO_PERSONAL = ROOT / "archivo-personal"
IMPORTACIONES_DIR = ARCHIVO_PERSONAL / "importaciones"
EXTRACTED_WRITINGS_DIR = IMPORTACIONES_DIR / "escritos-extraidos"
FULL_OUTPUT_PATH = IMPORTACIONES_DIR / "private-life-import-full.json"
CURATED_OUTPUT_PATH = IMPORTACIONES_DIR / "private-life-import-curado.json"
HABITS_DIR = ARCHIVO_PERSONAL / "habitos" / "Loop Habits CSV 2026-04-09"
SERIES_CSV = ARCHIVO_PERSONAL / "series" / "46906f9a-6a9f-4101-bc43-67a5ba7cd38d.csv"
WRITINGS_DIR = ARCHIVO_PERSONAL / "escritos"
LIFE_XLSX = ARCHIVO_PERSONAL / "peliculas" / "Life .xlsx"

TEXTOS_TITLES = [
    "Tiempo",
    "El Diablo",
    "Mejorar Excusandose",
    "El Mundo es un Pendulo",
]

DATE_HEADER_RE = re.compile(r"(?m)^(?:(\d{1,2}:\d{2})\s+)?(\d{1,2}/\d{1,2}/\d{2,4})\b")
COSITAS_HEADER_RE = re.compile(
    r"(?mi)^(el\s+(?:domingo|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado))\s*:"
)


def clean_text(value: object | None) -> str:
    text = str(value or "").strip()
    replacements = {
        "BaÃ±o": "Baño",
        "BaÃƒÂ±o": "Baño",
        "FÃ­sico": "Físico",
        "FÃƒÂ­sico": "Físico",
        "pelÃ­cula": "película",
        "pelÃƒÂ­cula": "película",
        "miÃ©rcoles": "miércoles",
        "sÃ¡bado": "sábado",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return " ".join(text.split())


def slugify_tag(value: str) -> str:
    base = clean_text(value).lower()
    for source, target in {
        "á": "a",
        "é": "e",
        "í": "i",
        "ó": "o",
        "ú": "u",
        "ñ": "n",
        "?": "",
        ",": "",
        ".": "",
        ":": "",
        "/": "-",
        " ": "-",
    }.items():
        base = base.replace(source, target)
    return base.strip("-")


def sort_entries(entries: Iterable[dict]) -> list[dict]:
    return sorted(entries, key=lambda entry: (entry["date"], entry["id"]), reverse=True)


def normalize_date(raw: object | None) -> tuple[str | None, bool]:
    value = clean_text(raw)
    if not value:
      return None, False

    if re.fullmatch(r"\d{2}/\d{2}/\d{4}", value):
        day, month, year = value.split("/")
        return f"{year}-{month}-{day}", False
    if re.fullmatch(r"\d{1,2}/\d{1,2}/\d{2}", value):
        day, month, year = value.split("/")
        return f"20{int(year):02d}-{int(month):02d}-{int(day):02d}", False
    if re.fullmatch(r"\d{1,2}/\d{4}", value):
        month, year = value.split("/")
        return f"{year}-{int(month):02d}-01", True
    if re.fullmatch(r"-?\d{4}", value):
        return f"{value[-4:]}-01-01", True
    return None, False


def excel_date_to_iso(value: object) -> tuple[str | None, bool]:
    if value is None:
        return None, False
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d"), False
    if isinstance(value, (int, float)):
        year = int(value)
        if 1000 <= year <= 2100:
            return f"{year}-01-01", True
    return normalize_date(value)


def normalize_habit_name(name: str) -> str:
    normalized = clean_text(name).rstrip("?").strip()
    lowered = normalized.lower()
    if lowered in {"bao", "bano", "baño"}:
        return "Baño"
    if lowered in {"ejercico fsico", "ejercicio fisico", "ejercicio físico"}:
        return "Ejercicio físico"
    return normalized


def parse_habits_full() -> list[dict]:
    entries: list[dict] = []
    if not HABITS_DIR.exists():
        return entries

    for habit_dir in sorted(HABITS_DIR.iterdir()):
        if not habit_dir.is_dir():
            continue

        base_name = habit_dir.name.split(" ", 1)[1] if " " in habit_dir.name else habit_dir.name
        habit_name = normalize_habit_name(base_name)
        checkmarks_path = habit_dir / "Checkmarks.csv"
        if not checkmarks_path.exists():
            continue

        with checkmarks_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                if not (row.get("Value") or "").strip().startswith("YES"):
                    continue

                date = (row.get("Date") or "").strip()
                if not date:
                    continue

                notes = clean_text(row.get("Notes"))
                content = f"Registro diario de {habit_name}."
                if notes:
                    content = f"{content} Nota: {notes}"

                entries.append(
                    {
                        "id": f"habit-{slugify_tag(habit_name)}-{date}",
                        "type": "habit",
                        "section": "habit",
                        "title": habit_name,
                        "content": content,
                        "date": date,
                        "tags": ["habit", "loop", slugify_tag(habit_name)],
                    }
                )

    return sort_entries(entries)


def split_genres(value: object | None) -> list[str]:
    return [slugify_tag(item) for item in clean_text(value).split(",") if slugify_tag(item)]


def parse_series() -> list[dict]:
    entries: list[dict] = []
    if not SERIES_CSV.exists():
        return entries

    with SERIES_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            title = clean_text(row.get("Title"))
            date = (row.get("Date Rated") or row.get("Modified") or row.get("Created") or "").strip()
            if not title or not date:
                continue

            your_rating = clean_text(row.get("Your Rating"))
            imdb_rating = clean_text(row.get("IMDb Rating"))
            year = clean_text(row.get("Year"))
            runtime = clean_text(row.get("Runtime (mins)"))
            details = [
                f"IMDb {imdb_rating}." if imdb_rating else "",
                f"{year}." if year else "",
                f"{runtime} min." if runtime else "",
            ]
            tags = ["series", "imported", *split_genres(row.get("Genres"))[:4]]
            if your_rating:
                tags.append("rated")

            entries.append(
                {
                    "id": f"series-{slugify_tag(title)}-{date}",
                    "type": "series",
                    "section": "series",
                    "title": title,
                    "content": " ".join(part for part in details if part),
                    "date": date,
                    "rating": your_rating or None,
                    "tags": tags,
                }
            )

    return sort_entries(entries)


def parse_life_movies_xlsx() -> list[dict]:
    entries: list[dict] = []
    if not LIFE_XLSX.exists():
        return entries

    wb = load_workbook(LIFE_XLSX, data_only=True)
    if "Peliculas" not in wb.sheetnames:
        return entries

    ws = wb["Peliculas"]
    for row in ws.iter_rows(min_row=2, values_only=True):
        title = clean_text(row[0] if len(row) > 0 else None)
        genre_year = clean_text(row[4] if len(row) > 4 else None)
        watched_at, approximate_date = excel_date_to_iso(row[7] if len(row) > 7 else None)
        reaction = clean_text(row[8] if len(row) > 8 else None).lower()

        if not title or not genre_year or not watched_at:
            continue

        genre_match = re.match(r"(.+?)\s+(-?\d{4})$", genre_year)
        if genre_match:
            genres_text = clean_text(genre_match.group(1))
            release_year = genre_match.group(2).replace("-", "")
        else:
            year_inline = re.search(r"(\d{4})", str(row[7] if len(row) > 7 else ""))
            if not year_inline:
                continue
            genres_text = genre_year
            release_year = year_inline.group(1)

        reaction_tag = ""
        reaction_label = ""
        if "wow" in reaction:
            reaction_tag = "wow"
            reaction_label = "wow"
        elif "like" in reaction:
            reaction_tag = "liked"
            reaction_label = "i like"

        tags = ["movie", "imported", "life-xlsx", *split_genres(genres_text)]
        if reaction_tag:
            tags.append(reaction_tag)
        if approximate_date:
            tags.append("approx-date")

        content_parts = [f"{genres_text}.", f"{release_year}.", f"{reaction_label}." if reaction_label else ""]
        entries.append(
            {
                "id": f"movie-{slugify_tag(title)}-{watched_at}",
                "type": "movie",
                "section": "movie",
                "title": title,
                "content": " ".join(part for part in content_parts if part),
                "date": watched_at,
                "tags": tags[:8],
            }
        )

    return sort_entries(entries)


def parse_life_books_xlsx() -> list[dict]:
    entries: list[dict] = []
    if not LIFE_XLSX.exists():
        return entries

    wb = load_workbook(LIFE_XLSX, data_only=True)
    if "Libros" not in wb.sheetnames:
        return entries

    ws = wb["Libros"]
    for row in ws.iter_rows(min_row=2, values_only=True):
        title = clean_text(row[0] if len(row) > 0 else None)
        author = clean_text(row[4] if len(row) > 4 else None)
        publish_year = clean_text(row[5] if len(row) > 5 else None)
        start_date, start_approx = excel_date_to_iso(row[7] if len(row) > 7 else None)
        end_date, end_approx = excel_date_to_iso(row[9] if len(row) > 9 else None)
        rating = row[12] if len(row) > 12 else None

        if not title:
            continue

        chosen_date = end_date or start_date
        approximate_date = end_approx if end_date else start_approx
        if not chosen_date:
            continue

        tags = ["book", "imported", "life-xlsx"]
        if rating not in (None, ""):
            tags.append("rated")
        if approximate_date:
            tags.append("approx-date")

        content_parts = [
            f"{author}." if author else "",
            f"{publish_year}." if publish_year else "",
            f"Inicio {start_date}." if start_date else "",
            f"Fin {end_date}." if end_date else "",
        ]
        entries.append(
            {
                "id": f"book-{slugify_tag(title)}-{chosen_date}",
                "type": "book",
                "section": "book",
                "title": title,
                "content": " ".join(part for part in content_parts if part),
                "date": chosen_date,
                "rating": rating if rating not in (None, "") else None,
                "tags": tags,
            }
        )

    return sort_entries(entries)


def parse_jw_milestones_xlsx() -> list[dict]:
    entries: list[dict] = []
    if not LIFE_XLSX.exists():
        return entries

    wb = load_workbook(LIFE_XLSX, data_only=True)
    if "Hitos JW" not in wb.sheetnames:
        return entries

    ws = wb["Hitos JW"]
    for row in ws.iter_rows(min_row=2, values_only=True):
        title = clean_text(row[1] if len(row) > 1 else None)
        date_iso, approximate_date = excel_date_to_iso(row[3] if len(row) > 3 else None)
        note = clean_text(row[4] if len(row) > 4 else None)
        if not title or not date_iso:
            continue

        tags = ["jw", "milestone", "life-xlsx"]
        if approximate_date:
            tags.append("approx-date")

        entries.append(
            {
                "id": f"jw-{slugify_tag(title)}-{date_iso}",
                "type": "memory",
                "section": "general",
                "title": title,
                "content": f"{note}." if note else "",
                "date": date_iso,
                "tags": tags,
            }
        )

    return sort_entries(entries)


def normalize_extracted_text(text: str) -> str:
    lines = [clean_text(line) for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def collapse_content(text: str) -> str:
    parts = [clean_text(part) for part in text.splitlines()]
    return " ".join(part for part in parts if part)


def clip_content(text: str, limit: int = 1800) -> str:
    value = text.strip()
    if len(value) <= limit:
        return value
    return f"{value[:limit].rstrip()}..."


def file_date_string(path: Path) -> str:
    return datetime.fromtimestamp(path.stat().st_mtime).strftime("%Y-%m-%d")


def normalize_date_header(raw: str) -> str | None:
    if not re.fullmatch(r"\d{1,2}/\d{1,2}/\d{2,4}", raw):
        return None
    day, month, year = raw.split("/")
    if len(year) == 2:
        year = f"20{int(year):02d}"
    return f"{year}-{int(month):02d}-{int(day):02d}"


def split_solo_entries(text: str, path: Path) -> list[dict]:
    entries: list[dict] = []
    matches = list(DATE_HEADER_RE.finditer(text))
    if not matches:
        return entries

    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[start:end].strip()
        date_raw = match.group(2)
        date_iso = normalize_date_header(date_raw) or file_date_string(path)
        entries.append(
            {
                "id": f"thought-solo-{date_iso}-{index}",
                "type": "note",
                "section": "thought",
                "title": f"Solo {date_raw}",
                "content": clip_content(collapse_content(block)),
                "date": date_iso,
                "tags": ["escritos", "thought", "solo"],
            }
        )

    return entries


def split_cositas_entries(text: str, path: Path) -> list[dict]:
    entries: list[dict] = []
    matches = list(COSITAS_HEADER_RE.finditer(text))
    if not matches:
        return entries

    fallback_date = file_date_string(path)
    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[start:end].strip()
        heading = clean_text(match.group(1)).title()
        inner_date_match = re.search(r"\b(\d{1,2}/\d{1,2}/\d{2,4})\b", block)
        date_iso = normalize_date_header(inner_date_match.group(1)) if inner_date_match else None
        approximate = date_iso is None
        date_iso = date_iso or fallback_date
        tags = ["escritos", "thought", "cositas-xd"]
        if approximate:
            tags.append("approx-date")

        entries.append(
            {
                "id": f"thought-cositas-{date_iso}-{index}",
                "type": "note",
                "section": "thought",
                "title": f"{heading} {index + 1}" if approximate else heading,
                "content": clip_content(collapse_content(block)),
                "date": date_iso,
                "tags": tags,
            }
        )

    return entries


def split_textos_entries(text: str, path: Path) -> list[dict]:
    entries: list[dict] = []
    title_re = re.compile(rf"(?m)^({'|'.join(re.escape(title) for title in TEXTOS_TITLES)})\s*$")
    matches = list(title_re.finditer(text))
    if not matches:
        return entries

    fallback_date = file_date_string(path)
    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        title = clean_text(match.group(1))
        block = text[start:end].strip()
        entries.append(
            {
                "id": f"philosophy-{slugify_tag(title)}-{fallback_date}-{index}",
                "type": "note",
                "section": "philosophy",
                "title": title,
                "content": clip_content(collapse_content(block), limit=2400),
                "date": fallback_date,
                "tags": ["escritos", "philosophy", slugify_tag(title)],
            }
        )

    return entries


def parse_writings() -> list[dict]:
    entries: list[dict] = []
    if not WRITINGS_DIR.exists():
        return entries

    EXTRACTED_WRITINGS_DIR.mkdir(parents=True, exist_ok=True)

    for pdf_path in sorted(WRITINGS_DIR.glob("*.pdf")):
        if pdf_path.stem.lower().strip() == "life":
            continue

        reader = PdfReader(str(pdf_path))
        raw_text = "\n".join((page.extract_text() or "") for page in reader.pages)
        normalized = normalize_extracted_text(raw_text)
        if not normalized:
            continue

        (EXTRACTED_WRITINGS_DIR / f"{pdf_path.stem}.md").write_text(normalized, encoding="utf-8")

        stem = pdf_path.stem.lower().strip()
        if stem == "solo":
            entries.extend(split_solo_entries(normalized, pdf_path))
            continue
        if stem == "cositas xd":
            entries.extend(split_cositas_entries(normalized, pdf_path))
            continue
        if stem == "textos":
            entries.extend(split_textos_entries(normalized, pdf_path))
            continue

        entries.append(
            {
                "id": f"writing-{slugify_tag(pdf_path.stem)}-{file_date_string(pdf_path)}",
                "type": "note",
                "section": "thought",
                "title": clean_text(pdf_path.stem),
                "content": clip_content(collapse_content(normalized)),
                "date": file_date_string(pdf_path),
                "tags": ["escritos", slugify_tag(pdf_path.stem)],
            }
        )

    return sort_entries(entries)


def build_payload(entries: list[dict], note: str) -> dict:
    return {
        "version": 2,
        "exportedAt": None,
        "entries": sort_entries(entries),
        "meta": {
            "source": "archivo-personal",
            "notes": [note, "Archivo compatible con el importador JSON de la app."],
        },
    }


def main() -> None:
    habits_full = parse_habits_full()
    series_entries = parse_series()
    movie_entries = parse_life_movies_xlsx()
    book_entries = parse_life_books_xlsx()
    jw_entries = parse_jw_milestones_xlsx()
    writing_entries = parse_writings()

    full_entries = [
        *habits_full,
        *series_entries,
        *movie_entries,
        *book_entries,
        *jw_entries,
        *writing_entries,
    ]

    IMPORTACIONES_DIR.mkdir(parents=True, exist_ok=True)
    FULL_OUTPUT_PATH.write_text(
        json.dumps(build_payload(full_entries, "Importación completa con histórico real."), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    CURATED_OUTPUT_PATH.write_text(
        json.dumps(build_payload(full_entries, "Importación curada para la app actual."), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"Generated {FULL_OUTPUT_PATH}")
    print(f"Generated {CURATED_OUTPUT_PATH}")
    print(
        "Counts:",
        json.dumps(
            {
                "habits_full": len(habits_full),
                "series": len(series_entries),
                "movies": len(movie_entries),
                "books": len(book_entries),
                "jw_milestones": len(jw_entries),
                "writings": len(writing_entries),
            }
        ),
    )


if __name__ == "__main__":
    main()
