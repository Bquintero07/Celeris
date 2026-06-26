import datetime
import decimal

import psycopg2.extras

from .db import get_connection

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_events",
            "description": "List events for the organization, optionally filtered by status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "Filter by approval_status",
                        "enum": ["draft", "pending", "approved", "rejected", "sent"],
                    },
                    "limit": {"type": "integer", "default": 10},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_event_detail",
            "description": "Get full details of a single event including all line items and totals.",
            "parameters": {
                "type": "object",
                "properties": {
                    "event_id": {"type": "string", "description": "UUID of the event"},
                },
                "required": ["event_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_clients",
            "description": "List all clients of the organization.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_financial_summary",
            "description": "Get revenue, cost, and margin totals across approved/sent events.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_events",
            "description": "Search events by keyword in their title.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Keyword to search in event title"},
                },
                "required": ["query"],
            },
        },
    },
]


def _clean(v):
    if isinstance(v, decimal.Decimal):
        return float(v)
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.isoformat()
    return v


def _row(row: dict) -> dict:
    return {k: _clean(v) for k, v in row.items()}


def execute_tool(name: str, args: dict, org_id: str) -> dict:
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            if name == "list_events":
                status = args.get("status")
                limit = min(int(args.get("limit", 10)), 50)
                if status:
                    cur.execute(
                        """SELECT e.id, e.title, e.event_type, e.approval_status,
                                  e.start_date, e.revenue, e.budget, c.name AS client_name
                           FROM public.events e
                           LEFT JOIN public.clients c ON c.id = e.client_id
                           WHERE e.organization_id = %s AND e.approval_status = %s
                           ORDER BY e.start_date DESC NULLS LAST LIMIT %s""",
                        (org_id, status, limit),
                    )
                else:
                    cur.execute(
                        """SELECT e.id, e.title, e.event_type, e.approval_status,
                                  e.start_date, e.revenue, e.budget, c.name AS client_name
                           FROM public.events e
                           LEFT JOIN public.clients c ON c.id = e.client_id
                           WHERE e.organization_id = %s
                           ORDER BY e.start_date DESC NULLS LAST LIMIT %s""",
                        (org_id, limit),
                    )
                return {"events": [_row(dict(r)) for r in cur.fetchall()]}

            elif name == "get_event_detail":
                cur.execute(
                    """SELECT e.*, c.name AS client_name, c.email AS client_email
                       FROM public.events e
                       LEFT JOIN public.clients c ON c.id = e.client_id
                       WHERE e.id = %s AND e.organization_id = %s LIMIT 1""",
                    (args["event_id"], org_id),
                )
                event = cur.fetchone()
                if not event:
                    return {"error": "Event not found"}
                cur.execute(
                    """SELECT category, name, quantity, unit_cost, total_cost, notes
                       FROM public.event_items
                       WHERE event_id = %s ORDER BY category, name""",
                    (args["event_id"],),
                )
                return {"event": _row(dict(event)), "items": [_row(dict(r)) for r in cur.fetchall()]}

            elif name == "list_clients":
                cur.execute(
                    """SELECT id, name, contact_name, email, phone
                       FROM public.clients WHERE organization_id = %s
                       ORDER BY name LIMIT 50""",
                    (org_id,),
                )
                return {"clients": [_row(dict(r)) for r in cur.fetchall()]}

            elif name == "get_financial_summary":
                cur.execute(
                    """SELECT
                         COUNT(*) AS total_events,
                         COUNT(*) FILTER (WHERE approval_status IN ('approved','sent')) AS approved_events,
                         COALESCE(SUM(revenue) FILTER (WHERE approval_status IN ('approved','sent')), 0) AS total_revenue,
                         COALESCE(SUM(budget)  FILTER (WHERE approval_status IN ('approved','sent')), 0) AS total_cost
                       FROM public.events WHERE organization_id = %s""",
                    (org_id,),
                )
                row = _row(dict(cur.fetchone()))
                row["total_margin"] = row["total_revenue"] - row["total_cost"]
                return row

            elif name == "search_events":
                cur.execute(
                    """SELECT e.id, e.title, e.event_type, e.approval_status,
                              e.start_date, e.revenue, c.name AS client_name
                       FROM public.events e
                       LEFT JOIN public.clients c ON c.id = e.client_id
                       WHERE e.organization_id = %s AND e.title ILIKE %s
                       ORDER BY e.start_date DESC NULLS LAST LIMIT 10""",
                    (org_id, f"%{args['query']}%"),
                )
                return {"events": [_row(dict(r)) for r in cur.fetchall()]}

            return {"error": f"Unknown tool: {name}"}
    finally:
        conn.close()
