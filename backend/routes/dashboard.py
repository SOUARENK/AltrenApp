"""
Routes Dashboard — GET /dashboard/summary, GET /dashboard/tasks
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Dashboard"])


@router.get("/dashboard/summary")
async def get_dashboard_summary():
    """
    Retourne un résumé global pour le dashboard :
    - today : événements du jour (Outlook si connecté)
    - school : prochains examens (ENT si connecté)
    - work : tickets Jira (si configuré)
    """
    today_str = datetime.now(timezone.utc).date().isoformat()
    today_events = []

    try:
        from services.outlook_service import fetch_calendar_events, get_valid_token
        token = get_valid_token()
        raw_events = fetch_calendar_events(token, days=1)
        for e in raw_events:
            event_start = e.get("start", {}).get("dateTime", "")[:10]
            if event_start == today_str:
                today_events.append({
                    "id": e.get("id", ""),
                    "title": e.get("subject", "(Sans titre)"),
                    "start": e.get("start", {}).get("dateTime", "")[:19] + "Z",
                    "end": e.get("end", {}).get("dateTime", "")[:19] + "Z",
                    "source": "teams",
                    "location": e.get("location", {}).get("displayName") or None,
                    "description": e.get("bodyPreview") or None,
                })
    except ValueError:
        pass
    except Exception as exc:
        logger.warning("Outlook unavailable for dashboard : %s", exc)

    return {
        "today": {
            "date": today_str,
            "events": today_events,
        },
        "school": {
            "next_exams": [],
            "recent_grades": [],
            "pending_assignments": [],
        },
        "work": {
            "tickets": [],
            "deadlines": [],
            "meetings_this_week": len(today_events),
        },
    }


@router.get("/dashboard/tasks")
async def get_dashboard_tasks():
    """
    Retourne les tâches ouvertes (Jira si configuré, sinon liste vide).
    """
    import os
    jira_url = os.getenv("JIRA_BASE_URL", "")
    jira_email = os.getenv("JIRA_EMAIL", "")
    jira_token = os.getenv("JIRA_API_TOKEN", "")

    if jira_url and jira_email and jira_token:
        try:
            import httpx
            import base64
            credentials = base64.b64encode(f"{jira_email}:{jira_token}".encode()).decode()
            headers = {
                "Authorization": f"Basic {credentials}",
                "Accept": "application/json",
            }
            params = {
                "jql": "assignee = currentUser() AND status != Done ORDER BY priority DESC",
                "fields": "summary,status,priority,duedate",
                "maxResults": 20,
            }
            r = httpx.get(f"{jira_url}/rest/api/3/search", headers=headers, params=params, timeout=10)
            r.raise_for_status()
            issues = r.json().get("issues", [])
            tasks = [
                {
                    "id": issue["key"],
                    "title": issue["fields"]["summary"],
                    "status": issue["fields"]["status"]["name"],
                    "priority": issue["fields"]["priority"]["name"].lower(),
                    "due_date": issue["fields"].get("duedate"),
                }
                for issue in issues
            ]
            return {"tasks": tasks}
        except Exception as exc:
            logger.warning("Jira unavailable : %s", exc)

    return {"tasks": []}
