import json
import secrets
import time

from typing import Any
from fastapi import APIRouter, HTTPException, Request, Body
from psycopg import sql
from psycopg.rows import dict_row

from app.database import get_db_pool

router = APIRouter(prefix="/api", tags=["Mutations"])


PK_MAP = {
    "patients": "patient_id",
    "nurses": "nurse_id",
    "medical_devices": "device_id",
    "logistics_shipments": "shipment_id",
    "resilience_alerts": "alert_id",
    "service_tickets": "ticket_id",
    "work_orders": "work_order_id",
    "therapy_sessions": "session_id",
    "nurse_patient_assignment": "assignment_id",
    "intervention_cases": "intervention_id",
    "inventory": "inventory_id",
    "risk_register": "risk_id",
}

WRITABLE = {
    "patients": ["assigned_nurse_id", "discharge_status"],
    "nurses": ["employment_status", "current_patient_load"],
    "medical_devices": ["operational_status"],
    "logistics_shipments": [
        "shipment_status",
        "distribution_center_id",
        "estimated_delivery_utc",
        "actual_delivery_utc",
    ],
    "resilience_alerts": [
        "alert_status",
        "response_action",
        "end_datetime_utc",
    ],
    "service_tickets": ["status", "assigned_technician_id"],
    "work_orders": ["status", "outcome", "completion_date_utc"],
    "therapy_sessions": ["session_status", "scheduled_datetime_utc"],
    "nurse_patient_assignment": ["active_status"],
    "intervention_cases": ["status"],
    "inventory": ["on_hand_qty", "reserved_qty", "available_qty"],
    "risk_register": ["status"],
}


POST_TABLES = {
    "resilience_alerts": "alert_id",
    "shipment_events": "shipment_event_id",
    "intervention_cases": "intervention_id",
    "risk_register": "risk_id",
    "work_orders": "work_order_id",
    "ticket_status_history": "ticket_status_event_id",
}


def generate_audit_id():
    return (
        f"AUD-{int(time.time() * 1000)}-"
        f"{secrets.token_hex(3)}"
    )


@router.patch("/data/{table}/{record_id}")
async def update_record(
    table: str,
    record_id: str,
    request: Request,
    body: dict[str, Any] = Body(...)
):
    primary_key = PK_MAP.get(table)
    allowed_fields = WRITABLE.get(table)

    if not primary_key or not allowed_fields:
        raise HTTPException(
            status_code=403,
            detail={"error": "Table is read-only"},
        )

    

    entries = [
        (key, value)
        for key, value in body.items()
        if key in allowed_fields
    ]

    if not entries:
        raise HTTPException(
            status_code=400,
            detail={"error": "No permitted fields supplied"},
        )

    scenario_id = body.get("scenario_id") or "UI"

    if scenario_id != "UI" and scenario_id not in {
        "SCN1", "SCN2", "SCN3", "SCN4", "SCN5"
    }:
        raise HTTPException(
            status_code=400,
            detail={"error": "Invalid scenario_id"},
        )

    columns = [key for key, _ in entries]
    pool = get_db_pool()

    try:
        with pool.connection() as connection:
            with connection.transaction():
                with connection.cursor(row_factory=dict_row) as cursor:
                    cursor.execute(
                        sql.SQL(
                            "SELECT * FROM {} WHERE {} = %s FOR UPDATE"
                        ).format(
                            sql.Identifier(table),
                            sql.Identifier(primary_key),
                        ),
                        (record_id,),
                    )

                    before = cursor.fetchone()

                    if before is None:
                        raise HTTPException(
                            status_code=404,
                            detail={"error": "Record not found"},
                        )

                    assignments = sql.SQL(", ").join(
                        sql.SQL("{} = %s").format(sql.Identifier(column))
                        for column in columns
                    )

                    values = [value for _, value in entries]
                    values.append(record_id)

                    cursor.execute(
                        sql.SQL(
                            "UPDATE {} SET {} WHERE {} = %s RETURNING *"
                        ).format(
                            sql.Identifier(table),
                            assignments,
                            sql.Identifier(primary_key),
                        ),
                        values,
                    )

                    updated = cursor.fetchone()

                    cursor.execute(
                        """
                        INSERT INTO audit_log (
                            audit_id,
                            event_datetime_utc,
                            entity_type,
                            entity_id,
                            action,
                            previous_value,
                            new_value,
                            performed_by,
                            scenario_id
                        )
                        VALUES (%s, NOW(), %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            generate_audit_id(),
                            table,
                            record_id,
                            "UPDATE",
                            json.dumps(before, default=str),
                            json.dumps(updated, default=str),
                            request.headers.get("x-user-name", "CARE_COMPASS_UI"),
                            scenario_id,
                        ),
                    )

        return {"row": updated}

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail={"error": "Update failed"},
        )


@router.post("/logistics/shipments/{shipment_id}/transition")
async def transition_logistics_shipment(
    shipment_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
):
    """Atomically update a shipment, append its event, and write an audit record."""
    allowed_statuses = {"Created", "In Transit", "Delayed", "Rerouted", "Delivered"}
    next_status = body.get("shipment_status")
    next_center_id = body.get("distribution_center_id")
    if next_status not in allowed_statuses:
        raise HTTPException(status_code=400, detail={"error": "Unsupported shipment status"})
    if not next_center_id:
        raise HTTPException(status_code=400, detail={"error": "A distribution centre is required"})

    pool = get_db_pool()
    try:
        with pool.connection() as connection:
            with connection.transaction():
                with connection.cursor(row_factory=dict_row) as cursor:
                    cursor.execute(
                        "SELECT * FROM logistics_shipments WHERE shipment_id = %s FOR UPDATE",
                        (shipment_id,),
                    )
                    before = cursor.fetchone()
                    if before is None:
                        raise HTTPException(status_code=404, detail={"error": "Shipment not found"})

                    cursor.execute(
                        "SELECT * FROM distribution_centers WHERE distribution_center_id = %s",
                        (next_center_id,),
                    )
                    center = cursor.fetchone()
                    if center is None:
                        raise HTTPException(status_code=404, detail={"error": "Distribution centre not found"})
                    if center.get("operational_status") != "Operational":
                        raise HTTPException(status_code=409, detail={"error": "Selected distribution centre is not operational"})

                    current_center_id = before.get("distribution_center_id")
                    if next_center_id != current_center_id:
                        cursor.execute(
                            """
                            SELECT inventory_id, item_name, available_qty
                            FROM inventory
                            WHERE distribution_center_id = %s
                              AND LOWER(BTRIM(item_name)) = LOWER(BTRIM(%s))
                            FOR UPDATE
                            """,
                            (next_center_id, before.get("supply_category", "")),
                        )
                        stock = cursor.fetchone()
                        required_qty = int(before.get("quantity") or 0)
                        if stock is None:
                            raise HTTPException(
                                status_code=409,
                                detail={"error": "The selected distribution centre has no matching inventory item. Choose a centre with available stock."},
                            )
                        if int(stock.get("available_qty") or 0) < required_qty:
                            raise HTTPException(
                                status_code=409,
                                detail={
                                    "error": "Insufficient available inventory at the selected distribution centre",
                                    "available_qty": int(stock.get("available_qty") or 0),
                                    "required_qty": required_qty,
                                },
                            )

                    eta = body.get("estimated_delivery_utc")
                    if next_status == "Delivered":
                        cursor.execute(
                            """
                            UPDATE logistics_shipments
                            SET shipment_status = %s,
                                distribution_center_id = %s,
                                actual_delivery_utc = COALESCE(actual_delivery_utc, NOW())
                            WHERE shipment_id = %s
                            RETURNING *
                            """,
                            (next_status, next_center_id, shipment_id),
                        )
                    elif eta:
                        cursor.execute(
                            """
                            UPDATE logistics_shipments
                            SET shipment_status = %s,
                                distribution_center_id = %s,
                                estimated_delivery_utc = %s
                            WHERE shipment_id = %s
                            RETURNING *
                            """,
                            (next_status, next_center_id, eta, shipment_id),
                        )
                    else:
                        cursor.execute(
                            """
                            UPDATE logistics_shipments
                            SET shipment_status = %s,
                                distribution_center_id = %s
                            WHERE shipment_id = %s
                            RETURNING *
                            """,
                            (next_status, next_center_id, shipment_id),
                        )
                    updated = cursor.fetchone()
                    event_status = "Rerouted" if next_center_id != current_center_id else next_status
                    cursor.execute(
                        """
                        INSERT INTO shipment_events (
                            shipment_event_id, shipment_id, event_status,
                            event_datetime_utc, recorded_by, scenario_id
                        ) VALUES (%s, %s, %s, NOW(), %s, NULL)
                        """,
                        (
                            f"SHE_UI_{int(time.time() * 1000)}_{secrets.token_hex(3)}",
                            shipment_id,
                            event_status,
                            request.headers.get("x-user-name", "Logistics Manager"),
                        ),
                    )
                    cursor.execute(
                        """
                        INSERT INTO audit_log (
                            audit_id, event_datetime_utc, entity_type, entity_id,
                            action, previous_value, new_value, performed_by, scenario_id
                        ) VALUES (%s, NOW(), %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            generate_audit_id(),
                            "logistics_shipments",
                            shipment_id,
                            "SHIPMENT_" + next_status.upper().replace(" ", "_"),
                            json.dumps(before, default=str),
                            json.dumps(updated, default=str),
                            request.headers.get("x-user-name", "Logistics Manager"),
                            "UI",
                        ),
                    )
        return {"row": updated, "event_status": event_status, "message": "Shipment update, event history and audit record saved"}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail={"error": "Shipment workflow could not be saved"})


@router.post("/data/{table}", status_code=201)
async def create_record(
    table: str,
    body: dict[str, Any] = Body(...)
):
    primary_key = POST_TABLES.get(table)

    if not primary_key:
        raise HTTPException(
            status_code=403,
            detail={"error": "Table is not writable"},
        )

    

    if not body:
        raise HTTPException(
            status_code=400,
            detail={"error": "Empty record"},
        )

    if primary_key not in body or body[primary_key] is None:
        raise HTTPException(
            status_code=400,
            detail={"error": f"Missing primary key: {primary_key}"},
        )

    pool = get_db_pool()

    try:
        with pool.connection() as connection:
            with connection.transaction():
                with connection.cursor(row_factory=dict_row) as cursor:

                    # Get actual columns from PostgreSQL.
                    cursor.execute(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = %s
                        ORDER BY ordinal_position
                        """,
                        (table,),
                    )

                    actual_columns = {
                        row["column_name"]
                        for row in cursor.fetchall()
                    }

                    unknown_columns = set(body.keys()) - actual_columns

                    if unknown_columns:
                        raise HTTPException(
                            status_code=400,
                            detail={
                                "error": "Unknown columns supplied",
                                "columns": sorted(unknown_columns),
                            },
                        )

                    columns = list(body.keys())
                    values = [body[column] for column in columns]

                    column_sql = sql.SQL(", ").join(
                        sql.Identifier(column)
                        for column in columns
                    )

                    placeholders = sql.SQL(", ").join(
                        sql.Placeholder()
                        for _ in columns
                    )

                    insert_query = sql.SQL(
                        "INSERT INTO {} ({}) VALUES ({}) RETURNING *"
                    ).format(
                        sql.Identifier(table),
                        column_sql,
                        placeholders,
                    )

                    cursor.execute(insert_query, values)
                    created = cursor.fetchone()

                    # Match the existing Express behavior:
                    # only resilience_alerts creation creates an audit row.
                    if table == "resilience_alerts":
                        scenario_id = created.get("scenario_id") or "UI"

                        cursor.execute(
                            """
                            INSERT INTO audit_log (
                                audit_id,
                                event_datetime_utc,
                                entity_type,
                                entity_id,
                                action,
                                previous_value,
                                new_value,
                                performed_by,
                                scenario_id
                            )
                            VALUES (%s, NOW(), %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                generate_audit_id(),
                                table,
                                created[primary_key],
                                "CREATE",
                                json.dumps(None),
                                json.dumps(created, default=str),
                                "CARE_COMPASS_UI",
                                scenario_id,
                            ),
                        )

        return {"row": created}

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=400,
            detail={"error": "Insert failed"},
        )


@router.post("/iot/trigger", status_code=201)
async def trigger_iot_alert(body: dict[str, Any] = Body(...)):
    """Atomically record an IoT event, patient risk, and assigned nurse intervention."""
    required = ("patient_id", "hospital_id", "assigned_nurse_id", "risk_type", "severity", "device_id", "observation")
    missing = [key for key in required if not body.get(key)]
    if missing:
        raise HTTPException(status_code=400, detail={"error": "Missing required fields", "fields": missing})

    stamp = int(time.time() * 1000)
    risk_id = f"RSK-IOT-{stamp}"
    intervention_id = f"INT-IOT-{stamp}"
    event_time = body.get("event_datetime_utc") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    risk = {
        "risk_id": risk_id,
        "patient_id": body["patient_id"],
        "hospital_id": body["hospital_id"],
        "risk_type": body["risk_type"],
        "severity": body["severity"],
        "status": "Open",
        "identified_datetime_utc": event_time,
        "scenario_id": None,
    }
    intervention = {
        "intervention_id": intervention_id,
        "patient_id": body["patient_id"],
        "therapy_episode_id": body.get("therapy_episode_id"),
        "assigned_nurse_id": body["assigned_nurse_id"],
        "intervention_type": f"{body['risk_type']} · {body['device_id']} · {body['observation']}",
        "risk_level": body["severity"],
        "status": "Assigned",
        "created_datetime_utc": event_time,
        "scenario_id": None,
    }

    pool = get_db_pool()
    try:
        with pool.connection() as connection:
            with connection.transaction():
                with connection.cursor(row_factory=dict_row) as cursor:
                    cursor.execute(
                        """
                        SELECT 1
                        FROM nurse_patient_assignment
                        WHERE nurse_id = %s AND patient_id = %s
                          AND active_status = TRUE
                        LIMIT 1
                        """,
                        (body["assigned_nurse_id"], body["patient_id"]),
                    )
                    if cursor.fetchone() is None:
                        raise HTTPException(
                            status_code=400,
                            detail={"error": "The selected nurse is not actively assigned to this patient. No alert was created."},
                        )

                    # Coalesce repeated bedside button presses for the same patient/device/event
                    # during a rolling 15-minute window. The transaction-scoped advisory lock
                    # prevents simultaneous clicks from creating duplicate rows.
                    dedupe_key = "|".join((str(body["patient_id"]), str(body["device_id"]), str(body["risk_type"])))
                    cursor.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (dedupe_key,))
                    cursor.execute(
                        """
                        SELECT * FROM risk_register
                        WHERE patient_id = %s AND risk_type = %s
                          AND identified_datetime_utc >= NOW() - INTERVAL '15 minutes'
                        ORDER BY identified_datetime_utc DESC LIMIT 1
                        """,
                        (body["patient_id"], body["risk_type"]),
                    )
                    existing_risk = cursor.fetchone()
                    if existing_risk:
                        cursor.execute(
                            """
                            SELECT * FROM intervention_cases
                            WHERE patient_id = %s AND assigned_nurse_id = %s
                              AND intervention_type LIKE %s
                              AND created_datetime_utc >= NOW() - INTERVAL '15 minutes'
                            ORDER BY created_datetime_utc DESC LIMIT 1
                            """,
                            (body["patient_id"], body["assigned_nurse_id"], f"%{body['device_id']}%"),
                        )
                        existing_intervention = cursor.fetchone()
                        return {
                            "event_id": f"IOT-DUPLICATE-{existing_risk['risk_id']}",
                            "risk": existing_risk,
                            "intervention": existing_intervention or {
                                "intervention_id": None,
                                "patient_id": body["patient_id"],
                                "assigned_nurse_id": body["assigned_nurse_id"],
                                "status": "Already recorded",
                            },
                            "deduplicated": True,
                            "window_minutes": 15,
                            "message": "Repeated alert suppressed; the existing open alert was retained",
                        }
                    for table, record, pk in (
                        ("risk_register", risk, "risk_id"),
                        ("intervention_cases", intervention, "intervention_id"),
                    ):
                        cursor.execute(
                            """
                            SELECT column_name
                            FROM information_schema.columns
                            WHERE table_schema = 'public' AND table_name = %s
                            """,
                            (table,),
                        )
                        actual = {row["column_name"] for row in cursor.fetchall()}
                        unknown = set(record) - actual
                        if unknown:
                            raise HTTPException(
                                status_code=400,
                                detail={"error": f"Unexpected columns for {table}", "columns": sorted(unknown)},
                            )
                        cols = list(record)
                        cursor.execute(
                            sql.SQL("INSERT INTO {} ({}) VALUES ({}) RETURNING *").format(
                                sql.Identifier(table),
                                sql.SQL(", ").join(sql.Identifier(col) for col in cols),
                                sql.SQL(", ").join(sql.Placeholder() for _ in cols),
                            ),
                            [record[col] for col in cols],
                        )
                        created = cursor.fetchone()
                        if created is None or created.get(pk) != record[pk]:
                            raise RuntimeError(f"Could not persist {table}")

                    cursor.execute(
                        """
                        INSERT INTO audit_log (
                            audit_id, event_datetime_utc, entity_type, entity_id,
                            action, previous_value, new_value, performed_by, scenario_id
                        ) VALUES (%s, NOW(), %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            generate_audit_id(), "iot_device", body["device_id"],
                            "TRIGGER_ALERT",
                            json.dumps(None),
                            json.dumps({
                                "patient_id": body["patient_id"],
                                "risk_id": risk_id,
                                "intervention_id": intervention_id,
                                "severity": body["severity"],
                                "observation": body["observation"],
                            }),
                            body.get("device_name", "Bedside IoT Monitor"),
                            "UI",
                        ),
                    )
        return {
            "event_id": f"IOT-{stamp}",
            "risk": risk,
            "intervention": intervention,
            "message": "IoT event and nurse response records committed",
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"error": "IoT event could not be committed", "reason": str(exc)})


def ensure_device_message_table(cursor):
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS patient_device_messages (
            message_id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            hospital_id TEXT,
            assigned_nurse_id TEXT NOT NULL,
            device_id TEXT NOT NULL,
            message_text TEXT NOT NULL,
            message_language TEXT,
            message_status TEXT NOT NULL DEFAULT 'Pending',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            acknowledged_at TIMESTAMPTZ,
            acknowledged_by TEXT
        )
    """)


@router.get("/device/messages")
def list_device_messages(nurse_id: str | None = None, patient_id: str | None = None):
    pool = get_db_pool()
    try:
        with pool.connection() as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                ensure_device_message_table(cursor)
                query = "SELECT * FROM patient_device_messages WHERE 1=1"
                params = []
                if nurse_id:
                    query += " AND assigned_nurse_id = %s"
                    params.append(nurse_id)
                if patient_id:
                    query += " AND patient_id = %s"
                    params.append(patient_id)
                query += " ORDER BY created_at DESC LIMIT 200"
                cursor.execute(query, params)
                return {"rows": cursor.fetchall()}
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"error": "Unable to load bedside messages", "reason": str(exc)})


@router.post("/device/messages", status_code=201)
def create_device_message(body: dict[str, Any] = Body(...)):
    required = ("patient_id", "assigned_nurse_id", "device_id", "message_text")
    missing = [key for key in required if not body.get(key)]
    if missing:
        raise HTTPException(status_code=400, detail={"error": "Missing required fields", "fields": missing})
    message_text = str(body["message_text"]).strip()
    if not message_text or len(message_text) > 4000:
        raise HTTPException(status_code=400, detail={"error": "Message must contain 1–4000 characters"})
    message_id = f"MSG-IOT-{int(time.time() * 1000)}-{secrets.token_hex(3).upper()}"
    pool = get_db_pool()
    try:
        with pool.connection() as connection:
            with connection.transaction():
                with connection.cursor(row_factory=dict_row) as cursor:
                    ensure_device_message_table(cursor)
                    cursor.execute("""
                        INSERT INTO patient_device_messages
                        (message_id, patient_id, hospital_id, assigned_nurse_id, device_id,
                         message_text, message_language, message_status)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,'Pending')
                        RETURNING *
                    """, (message_id, body["patient_id"], body.get("hospital_id"),
                          body["assigned_nurse_id"], body["device_id"], message_text,
                          body.get("message_language")))
                    row = cursor.fetchone()
        return {"message": row}
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"error": "Could not save bedside message", "reason": str(exc)})


@router.patch("/device/messages/{message_id}/acknowledge")
def acknowledge_device_message(message_id: str, request: Request):
    pool = get_db_pool()
    try:
        with pool.connection() as connection:
            with connection.transaction():
                with connection.cursor(row_factory=dict_row) as cursor:
                    ensure_device_message_table(cursor)
                    cursor.execute("""
                        UPDATE patient_device_messages
                        SET message_status = 'Acknowledged',
                            acknowledged_at = COALESCE(acknowledged_at, NOW()),
                            acknowledged_by = COALESCE(acknowledged_by, %s)
                        WHERE message_id = %s
                        RETURNING *
                    """, (request.headers.get("x-user-name", "Assigned Nurse"), message_id))
                    row = cursor.fetchone()
                    if not row:
                        raise HTTPException(status_code=404, detail={"error": "Bedside message not found"})
        return {"message": row}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"error": "Could not acknowledge bedside message", "reason": str(exc)})


def ensure_nurse_leave_table(cursor):
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS nurse_leave_requests (
            leave_request_id TEXT PRIMARY KEY,
            requesting_nurse_id TEXT NOT NULL,
            cover_nurse_id TEXT NOT NULL,
            leave_start DATE NOT NULL,
            leave_end DATE NOT NULL,
            leave_days INTEGER NOT NULL,
            patients_to_cover INTEGER NOT NULL DEFAULT 0,
            sessions_to_cover INTEGER NOT NULL DEFAULT 0,
            request_status TEXT NOT NULL DEFAULT 'Pending Approval',
            requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            responded_at TIMESTAMPTZ,
            response_note TEXT
        )
    """)


@router.get("/nurse-leave")
def list_nurse_leave_requests(nurse_id: str | None = None):
    pool = get_db_pool()
    try:
        with pool.connection() as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                ensure_nurse_leave_table(cursor)
                if nurse_id:
                    cursor.execute("""
                        SELECT * FROM nurse_leave_requests
                        WHERE requesting_nurse_id = %s OR cover_nurse_id = %s
                        ORDER BY requested_at DESC LIMIT 200
                    """, (nurse_id, nurse_id))
                else:
                    cursor.execute("SELECT * FROM nurse_leave_requests ORDER BY requested_at DESC LIMIT 200")
                return {"rows": cursor.fetchall()}
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"error": "Unable to load nurse leave requests", "reason": str(exc)})


@router.post("/nurse-leave", status_code=201)
def create_nurse_leave_request(body: dict[str, Any] = Body(...)):
    required = ("requesting_nurse_id", "cover_nurse_id", "leave_start", "leave_end")
    missing = [key for key in required if not body.get(key)]
    if missing:
        raise HTTPException(status_code=400, detail={"error": "Missing required fields", "fields": missing})
    if body["requesting_nurse_id"] == body["cover_nurse_id"]:
        raise HTTPException(status_code=400, detail={"error": "Choose another nurse to cover this leave"})
    try:
        from datetime import date
        start = date.fromisoformat(str(body["leave_start"]))
        end = date.fromisoformat(str(body["leave_end"]))
        if end < start:
            raise ValueError("Leave end must be on or after leave start")
        days = (end - start).days + 1
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)})
    request_id = f"LV-{int(time.time() * 1000)}-{secrets.token_hex(3).upper()}"
    pool = get_db_pool()
    try:
        with pool.connection() as connection:
            with connection.transaction():
                with connection.cursor(row_factory=dict_row) as cursor:
                    ensure_nurse_leave_table(cursor)
                    cursor.execute("""
                        INSERT INTO nurse_leave_requests
                        (leave_request_id, requesting_nurse_id, cover_nurse_id,
                         leave_start, leave_end, leave_days, patients_to_cover,
                         sessions_to_cover, request_status)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'Pending Approval')
                        RETURNING *
                    """, (request_id, body["requesting_nurse_id"], body["cover_nurse_id"],
                          start, end, days, max(0, int(body.get("patients_to_cover", 0))),
                          max(0, int(body.get("sessions_to_cover", 0)))))
                    row = cursor.fetchone()
        return {"request": row, "message": "Leave coverage request sent for approval"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"error": "Could not create nurse leave request", "reason": str(exc)})


@router.patch("/nurse-leave/{request_id}/decision")
def decide_nurse_leave_request(request_id: str, request: Request, body: dict[str, Any] = Body(...)):
    decision = str(body.get("decision", "")).strip().lower()
    if decision not in ("approved", "declined"):
        raise HTTPException(status_code=400, detail={"error": "Decision must be approved or declined"})
    pool = get_db_pool()
    try:
        with pool.connection() as connection:
            with connection.transaction():
                with connection.cursor(row_factory=dict_row) as cursor:
                    ensure_nurse_leave_table(cursor)
                    cursor.execute("""
                        UPDATE nurse_leave_requests
                        SET request_status = %s, responded_at = NOW(), response_note = %s
                        WHERE leave_request_id = %s AND cover_nurse_id = %s
                          AND request_status = 'Pending Approval'
                        RETURNING *
                    """, ("Approved" if decision == "approved" else "Declined",
                          body.get("response_note"), request_id,
                          request.headers.get("x-nurse-id", "")))
                    row = cursor.fetchone()
                    if not row:
                        raise HTTPException(status_code=404, detail={"error": "Pending leave request not found"})
        return {"request": row}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"error": "Could not record leave decision", "reason": str(exc)})


@router.get("/iot/config")
def get_iot_configuration():
    """Return live nurse/patient assignments for the bedside device simulator."""
    try:
        with get_db_pool().connection() as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute("""
                    SELECT DISTINCT n.nurse_id, n.full_name
                    FROM public.nurses n
                    JOIN public.nurse_patient_assignment a ON a.nurse_id = n.nurse_id
                    WHERE a.active_status = TRUE
                    ORDER BY n.full_name
                """)
                nurses = cursor.fetchall()
                cursor.execute("""
                    SELECT a.nurse_id, p.patient_id, p.first_name, p.last_name,
                           p.hospital_id, te.therapy_episode_id
                    FROM public.nurse_patient_assignment a
                    JOIN public.patients p ON p.patient_id = a.patient_id
                    LEFT JOIN LATERAL (
                        SELECT therapy_episode_id
                        FROM public.therapy_episodes
                        WHERE patient_id = p.patient_id
                        ORDER BY therapy_episode_id
                        LIMIT 1
                    ) te ON TRUE
                    WHERE a.active_status = TRUE
                    ORDER BY a.nurse_id, p.last_name, p.first_name
                """)
                assignments = cursor.fetchall()
        return {"nurses": nurses, "assignments": assignments}
    except Exception:
        raise HTTPException(status_code=500, detail={"error": "Unable to load live IoT nurse and patient assignments"})
