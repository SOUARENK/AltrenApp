"""
Routes Agenda — GET /agenda/events, GET /agenda/today
Retourne les événements depuis Outlook (si connecté) ou une liste vide.
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from models.schemas import AgendaEvent, AgendaEventsResponse, AgendaTodayResponse, UrgentTask

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Agenda"])


def _outlook_event_to_agenda(event: dict, index: int) -> AgendaEvent:
    """Convertit un événement Graph API en AgendaEvent."""
    return AgendaEvent(
        id=event.get("id") or f"event-{index}",
        title=event.get("subject", "(Sans titre)"),
        start=event.get("start", {}).get("dateTime", "")[:19] + "Z",
        end=event.get("end", {}).get("dateTime", "")[:19] + "Z",
        source="teams",
        location=event.get("location", {}).get("displayName") or None,
        description=event.get("bodyPreview") or None,
    )


def _ics_event_to_agenda(ev: dict) -> AgendaEvent:
    return AgendaEvent(
        id=ev["id"],
        title=ev["title"],
        start=ev["start"],
        end=ev.get("end"),
        source=ev.get("source", "ics"),
        location=ev.get("location"),
        description=ev.get("description"),
    )


def _filter_by_range(events: list[AgendaEvent], start: str | None, end: str | None) -> list[AgendaEvent]:
    if not start or not end:
        return events
    try:
        start_dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(end.replace("Z", "+00:00"))
        filtered = []
        for e in events:
            try:
                e_start = datetime.fromisoformat(e.start.replace("Z", "+00:00"))
                if start_dt <= e_start <= end_dt:
                    filtered.append(e)
            except Exception:
                filtered.append(e)
        return filtered
    except Exception:
        return events


@router.get("/agenda/events", response_model=AgendaEventsResponse)
async def get_agenda_events(start: str | None = None, end: str | None = None):
    """
    Retourne les événements calendrier unifiés.
    Sources : Outlook/Teams (si connecté) + calendriers ICS connectés.
    """
    events: list[AgendaEvent] = []

    # ── Outlook ───────────────────────────────────────────────────────────────
    try:
        from services.outlook_service import fetch_calendar_events, get_valid_token
        token = get_valid_token()
        raw_events = fetch_calendar_events(token, days=90)
        events += [_outlook_event_to_agenda(e, i) for i, e in enumerate(raw_events)]
    except ValueError:
        logger.info("Outlook non connecté.")
    except Exception as exc:
        logger.warning("Outlook indisponible : %s", exc)

    # ── Calendriers ICS ───────────────────────────────────────────────────────
    try:
        from services.direct_sync_service import fetch_ics_events_structured
        ics_events = fetch_ics_events_structured()
        events += [_ics_event_to_agenda(e) for e in ics_events]
    except Exception as exc:
        logger.warning("ICS indisponible : %s", exc)

    events = _filter_by_range(events, start, end)
    events.sort(key=lambda e: e.start)
    logger.info("Agenda events : %d événements retournés.", len(events))
    return AgendaEventsResponse(events=events)


@router.get("/agenda/today", response_model=AgendaTodayResponse)
async def get_agenda_today():
    """
    Retourne les événements d'aujourd'hui + les tâches urgentes.
    Sources : Outlook + ICS.
    """
    today = datetime.now(timezone.utc).date()
    today_str = today.isoformat()
    events: list[AgendaEvent] = []

    # ── Outlook ───────────────────────────────────────────────────────────────
    try:
        from services.outlook_service import fetch_calendar_events, get_valid_token
        token = get_valid_token()
        raw_events = fetch_calendar_events(token, days=1)
        for i, e in enumerate(raw_events):
            if e.get("start", {}).get("dateTime", "")[:10] == today_str:
                events.append(_outlook_event_to_agenda(e, i))
    except ValueError:
        pass
    except Exception as exc:
        logger.warning("Outlook today indisponible : %s", exc)

    # ── Calendriers ICS ───────────────────────────────────────────────────────
    try:
        from services.direct_sync_service import fetch_ics_events_structured
        for ev in fetch_ics_events_structured():
            if ev.get("start", "")[:10] == today_str:
                events.append(_ics_event_to_agenda(ev))
    except Exception as exc:
        logger.warning("ICS today indisponible : %s", exc)

    events.sort(key=lambda e: e.start)
    return AgendaTodayResponse(events=events, urgent_tasks=[], date=today_str)
