"""
Coach domain logic: turning a user's own logged data into a system prompt,
and calling the configured LLM provider.

Kept out of the route module so the prompt construction can be tested
without going near HTTP, and so the provider call is the single seam that
tests stub.
"""
import os
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import Date, cast, func
from sqlalchemy.orm import Session

from app import models

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "anthropic/claude-sonnet-4.5"
REQUEST_TIMEOUT_SECONDS = 60.0

# How much history to replay to the provider. Long threads are truncated to
# the most recent turns so a months-old conversation cannot grow the request
# without bound; the system prompt is rebuilt each time regardless.
MAX_HISTORY_MESSAGES = 20

SYSTEM_PROMPT = """You are Gymind's in-app fitness coach.

You are talking to a specific person whose real logged training, nutrition \
and body-weight data is given below. Ground your advice in that data \
whenever it is relevant, and refer to it concretely rather than in \
generalities.

Guidelines:
- Be direct and practical. Short paragraphs, no filler preamble.
- Respect their stated goal, experience level, available equipment, \
injuries and dietary restrictions. Never program around equipment they \
do not have, or foods they have excluded.
- If they have logged an injury, do not suggest movements that load it \
without acknowledging the constraint.
- You are not a doctor. For pain, injury diagnosis, or medical or \
disordered-eating concerns, say plainly that they should see a qualified \
professional, and do not attempt to diagnose.
- If their data is too sparse to answer well, say what you would need them \
to log rather than inventing numbers.
- Never state a number as theirs unless it appears in the data below."""


class CoachUnavailable(RuntimeError):
    """The provider is unconfigured, unreachable, or returned no usable reply."""


def _format_list(values) -> str:
    if not values:
        return "none recorded"
    return ", ".join(str(v) for v in values if v)


def build_user_context(db: Session, user: models.User) -> str:
    """
    A compact plain-text snapshot of everything the coach is allowed to know
    about this user. Every query is scoped to their own rows.
    """
    lines: list[str] = [f"USER: {user.username}"]

    profile = (
        db.query(models.UserProfile)
        .filter(models.UserProfile.user_id == user.id)
        .first()
    )
    if profile:
        lines += [
            "",
            "PROFILE",
            f"- Goal: {profile.goal or 'not set'}",
            f"- Experience: {profile.experience_level or 'not set'}",
            f"- Injuries/limitations: {profile.injuries or 'none reported'}",
            f"- Equipment: {_format_list(profile.equipment)}",
            f"- Dietary restrictions: {_format_list(profile.dietary_restrictions)}",
        ]

    cutoff = datetime.now(timezone.utc) - timedelta(days=28)

    days_trained = (
        db.query(cast(models.UserWorkout.started_at, Date))
        .filter(
            models.UserWorkout.user_id == user.id,
            models.UserWorkout.ended_at.isnot(None),
            models.UserWorkout.started_at >= cutoff,
        )
        .distinct()
        .count()
    )
    lines += ["", "TRAINING (last 28 days)", f"- Days trained: {days_trained} of 28"]

    # Best Epley e1RM per muscle group — same formula as GET /progress/*, so
    # the coach quotes the same strength numbers the Progress tab shows.
    e1rm_expr = models.WorkoutSet.weight * (1 + models.WorkoutSet.reps / 30.0)
    strength = (
        db.query(models.Exercise.name, func.max(e1rm_expr))
        .select_from(models.WorkoutSet)
        .join(models.UserWorkout, models.WorkoutSet.workout_id == models.UserWorkout.id)
        .join(models.Exercise, models.WorkoutSet.exercise_id == models.Exercise.id)
        .filter(
            models.UserWorkout.user_id == user.id,
            models.WorkoutSet.weight.isnot(None),
            models.WorkoutSet.reps.isnot(None),
        )
        .group_by(models.Exercise.name)
        .order_by(func.max(e1rm_expr).desc())
        .limit(10)
        .all()
    )
    if strength:
        lines.append("- Best estimated 1RM (Epley) by exercise:")
        lines += [f"    {name}: {round(best, 1)}" for name, best in strength]
    else:
        lines.append("- No weighted sets logged yet.")

    recent_weights = (
        db.query(models.BodyWeightLog)
        .filter(models.BodyWeightLog.user_id == user.id)
        .order_by(models.BodyWeightLog.logged_at.desc())
        .limit(5)
        .all()
    )
    lines.append("")
    lines.append("BODY WEIGHT")
    if recent_weights:
        latest = recent_weights[0]
        lines.append(f"- Latest: {latest.weight} {latest.unit}")
        if len(recent_weights) > 1:
            oldest = recent_weights[-1]
            if oldest.unit == latest.unit:
                change = round(latest.weight - oldest.weight, 1)
                lines.append(
                    f"- Change across last {len(recent_weights)} entries: "
                    f"{change:+} {latest.unit}"
                )
    else:
        lines.append("- No entries logged yet.")

    target = (
        db.query(models.NutritionTarget)
        .filter(models.NutritionTarget.user_id == user.id)
        .first()
    )
    lines.append("")
    lines.append("NUTRITION TARGETS")
    if target:
        lines.append(
            f"- {target.target_calories or '?'} kcal, "
            f"{target.target_protein or '?'}g protein, "
            f"{target.target_carbs or '?'}g carbs, "
            f"{target.target_fat or '?'}g fat"
            f" ({'manually set' if target.is_manual else 'auto-calculated'})"
        )
    else:
        lines.append("- Not set.")

    return "\n".join(lines)


def build_messages(context: str, history: list[models.CoachMessage]) -> list[dict]:
    recent = history[-MAX_HISTORY_MESSAGES:]
    return [
        {"role": "system", "content": f"{SYSTEM_PROMPT}\n\n---\n\n{context}"},
        *({"role": m.role, "content": m.content} for m in recent),
    ]


def request_completion(messages: list[dict]) -> str:
    """
    Call the provider and return the assistant's text.

    This is the seam the test suite stubs — nothing above it performs I/O.
    """
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise CoachUnavailable("OPENROUTER_API_KEY is not configured")

    payload = {
        "model": os.getenv("OPENROUTER_MODEL", DEFAULT_MODEL),
        "messages": messages,
    }

    try:
        response = httpx.post(
            OPENROUTER_URL,
            json=payload,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
    except httpx.HTTPError as exc:
        raise CoachUnavailable("Coach provider request failed") from exc
    except (KeyError, IndexError, ValueError) as exc:
        raise CoachUnavailable("Coach provider returned an unexpected response") from exc

    if not content or not content.strip():
        raise CoachUnavailable("Coach provider returned an empty reply")

    return content.strip()
