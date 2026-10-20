"""
Reality Check API (FastAPI)

Endpoints used by the React frontend (see src/api.js):
    GET    /api/dashboard
    POST   /api/commitments
    PATCH  /api/commitments/{id}/outcome
    POST   /api/reality-check
Plus:
    GET    /          welcome message
    GET    /health    health check

Data is stored in backend/data.json next to this file.
No secrets or API keys are needed or used by this file.
"""

import json
import logging
import math
import os
import tempfile
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any, Literal, Optional, Union

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, StringConstraints, field_validator
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("reality-check")

APP_VERSION = "0.2.0"

# data.json lives in the same folder as this file (backend/data.json)
DATA_FILE = Path(__file__).resolve().parent / "data.json"

# Which websites may call this API from a browser. Vite's default is port 5173.
# To add more, set CORS_ORIGINS="http://localhost:5173,http://192.168.1.20:5173"
DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", DEFAULT_ORIGINS).split(",")
    if origin.strip()
]

# These exact strings are what the frontend displays and compares against.
Status = Literal["Completed", "Postponed", "In progress", "Missed"]

# A number of minutes: whole or decimal.
Minutes = Union[int, float]

# Text fields are trimmed, and required ones must not be empty after trimming.
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Category = Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)]
Note = Annotated[str, StringConstraints(max_length=1000)]
Decision = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]

MAX_MINUTES = 100000

app = FastAPI(
    title="Reality Check API",
    version=APP_VERSION,
    description="Backend for Reality Check, a personal accountability agent.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------
# Request models (Pydantic checks incoming JSON against these)
# --------------------------------------------------------------------------


def _check_minutes(value: Any, allow_zero: bool) -> Any:
    """Shared check for minute values: a real number in a sensible range."""
    if value is None:
        return value
    if isinstance(value, bool):  # in Python, True would otherwise count as 1
        raise ValueError("must be a number, not true/false")
    low_ok = value >= 0 if allow_zero else value > 0
    if not (low_ok and value <= MAX_MINUTES):  # also rejects NaN
        limit = "0 or more" if allow_zero else "greater than 0"
        raise ValueError(f"must be {limit} and at most {MAX_MINUTES}")
    return value


class CommitmentCreate(BaseModel):
    title: Title
    category: Category = "Other"
    plannedMinutes: Minutes
    dueAt: Optional[str] = None

    @field_validator("plannedMinutes", mode="before")
    @classmethod
    def reject_booleans(cls, value):
        if isinstance(value, bool):
            raise ValueError("must be a number, not true/false")
        return value

    @field_validator("plannedMinutes")
    @classmethod
    def planned_in_range(cls, value):
        return _check_minutes(value, allow_zero=False)


class OutcomeUpdate(BaseModel):
    status: Status
    actualMinutes: Optional[Minutes] = None
    note: Optional[Note] = None

    @field_validator("actualMinutes", mode="before")
    @classmethod
    def reject_booleans(cls, value):
        if isinstance(value, bool):
            raise ValueError("must be a number, not true/false")
        return value

    @field_validator("actualMinutes")
    @classmethod
    def actual_in_range(cls, value):
        return _check_minutes(value, allow_zero=True)


class RealityCheckRequest(BaseModel):
    decision: Decision


# --------------------------------------------------------------------------
# Reading and writing data.json
# --------------------------------------------------------------------------

# FastAPI runs normal (non-async) routes in several threads, so we lock
# around "read file -> change -> write file" to avoid two requests clashing.
_data_lock = threading.Lock()


class DataFileError(Exception):
    """data.json exists but cannot be read safely."""


def load_data() -> dict:
    """Read data.json. Creates it (empty) only if it does not exist yet."""
    if not DATA_FILE.exists():
        data = {"commitments": []}
        save_data(data)
        return data

    try:
        data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError, OSError) as exc:
        # Never overwrite a file we could not understand: your data stays safe.
        raise DataFileError(str(exc)) from exc

    if not isinstance(data, dict) or not isinstance(data.get("commitments", []), list):
        raise DataFileError('expected {"commitments": [...]}')

    data.setdefault("commitments", [])
    return data


def save_data(data: dict) -> None:
    """Write to a temp file first, then swap it in, so a crash can't leave a half-written data.json."""
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=DATA_FILE.parent, prefix="data-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as tmp:
            json.dump(data, tmp, indent=2, ensure_ascii=False)
        os.replace(tmp_path, DATA_FILE)
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise


# --------------------------------------------------------------------------
# Helper functions (plain Python, no web code: easy to read and test)
# --------------------------------------------------------------------------


def is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def round_half_up(value: float) -> int:
    # Python's round() rounds 0.5 to the nearest even number; the frontend
    # (JavaScript) rounds it up. This keeps numbers consistent.
    return int(math.floor(value + 0.5))


def average(values: list) -> Optional[int]:
    return round_half_up(sum(values) / len(values)) if values else None


def format_minutes(value: Any) -> str:
    if is_number(value):
        return f"{int(value)} min" if float(value).is_integer() else f"{value} min"
    return "— min"


def observed_commitments(commitments: list) -> list:
    """Commitments that have a real recorded actual time and a valid planned time."""
    return [
        c
        for c in commitments
        if is_number(c.get("actualMinutes")) and is_number(c.get("plannedMinutes"))
    ]


def build_dashboard(commitments: list) -> dict:
    total = len(commitments)
    completed = sum(1 for c in commitments if c.get("status") == "Completed")
    postponed = sum(1 for c in commitments if c.get("status") == "Postponed")

    observed = observed_commitments(commitments)

    # We only show a pattern once there are at least 3 recorded outcomes.
    focus_pattern = None
    if len(observed) >= 3:
        focus_pattern = {
            "title": "Planning compared with observed time",
            "description": "Compare planned session lengths with the time recorded.",
            "plannedAverageMinutes": average([c["plannedMinutes"] for c in observed]),
            "actualAverageMinutes": average([c["actualMinutes"] for c in observed]),
            "sampleSize": len(observed),
            "confidence": f"Based on {len(observed)} recorded outcomes",
        }

    newest_first = sorted(commitments, key=lambda c: str(c.get("createdAt", "")), reverse=True)

    return {
        "mode": "live",
        "userLabel": "Local profile",
        "periodLabel": "All recorded commitments",
        "summary": {
            "commitments": total,
            "completed": completed,
            "postponed": postponed,
            "completionRate": round_half_up(completed / total * 100) if total else 0,
        },
        "focusPattern": focus_pattern,
        "commitments": [
            # "planned" is a ready-to-show label. The frontend formats the date
            # itself from "createdAt", in the user's own time zone.
            {**c, "planned": format_minutes(c.get("plannedMinutes"))}
            for c in newest_first
        ],
        "realityCheck": None,
    }


def build_reality_check(decision: str, commitments: list) -> dict:
    """
    Simple rules only. No AI. The decision text is only echoed back: the check
    uses your recorded planned-vs-actual minutes, across all categories.
    """
    observed = observed_commitments(commitments)
    count = len(observed)

    planned_avg = average([c["plannedMinutes"] for c in observed])
    actual_avg = average([c["actualMinutes"] for c in observed])
    enough_evidence = count >= 3
    gap = planned_avg - actual_avg if count else None
    runs_short = enough_evidence and gap is not None and gap > 0

    if count:
        facts = [
            f"{count} commitment(s) have recorded actual time.",
            f"Average planned time for those: {planned_avg} minutes.",
            f"Average recorded time for those: {actual_avg} minutes.",
        ]
    else:
        facts = ["No commitment outcomes with recorded time are available yet."]
    facts.append(
        "This check uses all categories together and does not analyse the wording of your decision."
    )

    if runs_short:
        suggested = max(15, actual_avg)
        pattern = "On average, recorded time has been shorter than planned time."
        recommendation = f"Consider starting with a {suggested}-minute session and reviewing your progress."
        next_action = f"Schedule a {suggested}-minute focused session"
    else:
        pattern = None
        recommendation = (
            "Record a few commitments and their actual outcomes before drawing conclusions."
            if not enough_evidence
            else "Keep recording outcomes; the recorded averages do not show planned time running longer than actual time."
        )
        next_action = "Record the outcome of your next commitment"

    if enough_evidence:
        interpretation = (
            "Use these recorded outcomes as context, not as a prediction of what you can achieve."
        )
    else:
        interpretation = "There is not enough recorded history to identify a recurring pattern yet."

    return {
        "currentDecision": decision,
        "facts": facts,
        "pattern": pattern,
        "interpretation": interpretation,
        "recommendation": recommendation,
        "nextAction": next_action,
    }


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------


@app.get("/")
def read_root():
    """Welcome message. Confirms the server is reachable."""
    return {"message": "Welcome to the Reality Check API", "docs": "/docs"}


@app.get("/health")
def health_check():
    """Health check used by the frontend and deployment tools."""
    return {"status": "ok"}


@app.get("/api/dashboard", tags=["Dashboard"])
def get_dashboard():
    """Summary stats, detected pattern (if enough data) and all commitments, newest first."""
    with _data_lock:
        data = load_data()
    return build_dashboard(data["commitments"])


@app.post("/api/commitments", status_code=201, tags=["Commitments"])
def create_commitment(body: CommitmentCreate):
    """Save a new commitment. It starts as "In progress"."""
    commitment = {
        "id": str(uuid.uuid4()),
        "title": body.title,
        "category": body.category or "Other",
        "plannedMinutes": body.plannedMinutes,
        "dueAt": body.dueAt,
        "status": "In progress",
        "actualMinutes": None,
        "note": "",
        "createdAt": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
    }

    with _data_lock:
        data = load_data()
        data["commitments"].append(commitment)
        save_data(data)

    return commitment


@app.patch("/api/commitments/{commitment_id}/outcome", tags=["Commitments"])
def update_outcome(commitment_id: str, body: OutcomeUpdate):
    """
    Record what actually happened. Only fields you send are changed:
    leave out actualMinutes or note to keep their current values.
    """
    with _data_lock:
        data = load_data()
        commitment = next(
            (c for c in data["commitments"] if c.get("id") == commitment_id), None
        )
        if commitment is None:
            return JSONResponse(status_code=404, content={"error": "Commitment not found."})

        commitment["status"] = body.status
        if body.actualMinutes is not None:
            commitment["actualMinutes"] = body.actualMinutes
        if body.note is not None:
            commitment["note"] = body.note
        commitment["updatedAt"] = (
            datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        )
        save_data(data)

    return commitment


@app.post("/api/reality-check", tags=["Reality check"])
def create_reality_check(body: RealityCheckRequest):
    """Rule-based comparison of your recorded plans and outcomes. Not AI."""
    with _data_lock:
        data = load_data()
    return {"realityCheck": build_reality_check(body.decision, data["commitments"])}


# --------------------------------------------------------------------------
# Error handling: every error is {"error": "message"}, which is what
# src/api.js reads.
# --------------------------------------------------------------------------


@app.exception_handler(DataFileError)
async def data_file_error_handler(request: Request, exc: DataFileError):
    logger.error("data.json problem: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": "data.json could not be read. Your data was not changed; "
            "check the file for typos or restore a backup."
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """Wrong or missing fields in the request become one readable message."""
    messages = []
    for err in exc.errors():
        # loc looks like ("body", "title"); keep only the field name part.
        field = ".".join(str(p) for p in err["loc"] if p not in ("body", "query", "path"))
        reason = str(err.get("msg", "invalid value")).removeprefix("Value error, ")
        messages.append(f"{field}: {reason}" if field else reason)
    return JSONResponse(status_code=422, content={"error": "; ".join(messages) or "Invalid request."})


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(request: Request, exc: StarletteHTTPException):
    """Known errors such as 404 (unknown URL) and 405 (wrong method)."""
    return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail)})


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception):
    """Safety net: an unexpected crash returns clean JSON, not a traceback."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"error": "Internal server error."})
