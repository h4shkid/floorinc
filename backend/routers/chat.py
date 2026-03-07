"""
SSE chat endpoint for the AI inventory assistant.
"""

import json
import uuid
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.chat_agent import run_agent

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


@router.post("")
async def chat(req: ChatRequest):
    session_id = req.session_id or str(uuid.uuid4())

    async def event_stream():
        async for event in run_agent(session_id, req.message):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-Id": session_id,
        },
    )
