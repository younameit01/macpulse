import json
import asyncio
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from backend.database import SessionLocal
from backend.routes.overview import get_overview

router = APIRouter(prefix="/api/v1/stream", tags=["stream"])

@router.get("/overview")
async def stream_overview(request: Request, limit: int = None):
    """
    Server-Sent Events (SSE) endpoint streaming real-time fleet overview data
    to the React dashboard. Supports optional limit for testing.
    """
    async def event_generator():
        count = 0
        try:
            while True:
                # Disconnect check
                if await request.is_disconnected():
                    break

                # Create scoped session to fetch latest overview state
                db = SessionLocal()
                try:
                    overview_data = get_overview(db)
                    payload = overview_data.model_dump_json()
                finally:
                    db.close()

                # Yield SSE message format: event: <name>\ndata: <json>\n\n
                yield f"event: overview\ndata: {payload}\n\n"
                count += 1
                if limit is not None and count >= limit:
                    break

                # Stream update interval: 2 seconds
                await asyncio.sleep(2)
        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )
