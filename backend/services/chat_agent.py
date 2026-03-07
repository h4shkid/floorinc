"""
Tool-calling agent loop with Ollama streaming.
Sends messages + tools to Qwen, handles tool calls, streams final answer via SSE.
"""

import os
import json
import logging
import httpx
from typing import AsyncGenerator
from services.chat_tools import TOOL_DEFINITIONS, TOOL_STATUS_MESSAGES, execute_tool
from services.chat_memory import (
    get_session_messages, add_session_message,
    save_long_term_memory, get_all_long_term_memories,
)

logger = logging.getLogger("uvicorn.error")

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:30b-a3b")
MAX_TOOL_ITERATIONS = 5

SYSTEM_PROMPT = """You are an inventory assistant for FlooringInc, a flooring company. You help the team analyze inventory, sales, forecasts, and purchase orders.

## Database Schema

**inventory**: sku (TEXT PK), display_name (TEXT), on_hand (INT), manufacturer (TEXT), item_cost (REAL), qty_on_order (INT), qty_committed (INT), is_drop_ship (INT), is_warehoused (INT), source_type (TEXT), is_sample (INT)

**sales**: id (INT PK), order_date (TEXT), sku (TEXT), quantity (INT), channel (TEXT), product_category (TEXT), item_revenue (REAL), product_cost (REAL), product_name (TEXT)

**lead_times**: sku (TEXT PK), product_category (TEXT), lead_time_days (INT), source (TEXT), updated_at (TEXT)

**purchase_orders**: id (INT PK), po_number (TEXT), po_date (TEXT), status (TEXT), vendor (TEXT), sku (TEXT), ordered_qty (INT), received_qty (INT), remaining_qty (INT), expected_date (TEXT), rate (REAL), amount (REAL)

## Business Logic

- **Available Qty** = on_hand - qty_committed (physical stock minus committed orders)
- **Velocity** = average daily sales over the velocity window (default 90 days)
- **Adjusted Velocity** = velocity * seasonality_factor
- **Days Remaining** = available_qty / adjusted_velocity
- **Urgency Classification**:
  - BACKORDER: available_qty < 0
  - RED: days_remaining <= lead_time_days (order immediately)
  - YELLOW: days_remaining <= lead_time_days * 1.5 (order soon)
  - GREEN: comfortable stock level

## Sales Channels
FI (FlooringInc.com), Amazon, Home Depot, Wayfair, Walmart, eBay, Other

## Rules
- ALWAYS use tools to look up data. NEVER fabricate or guess numbers.
- Be concise and direct. Use tables or bullet points for multiple items.
- When showing monetary values, format as USD with commas.
- If a question is ambiguous, ask for clarification.
- If data is not available, say so clearly.
- Do not use /no_think or /think tags.
"""


def _build_system_prompt() -> str:
    """Build system prompt with long-term memories appended."""
    prompt = SYSTEM_PROMPT
    memories = get_all_long_term_memories()
    if memories:
        prompt += "\n\n## Remembered Facts\n"
        for m in memories:
            prompt += f"- [{m['key']}] {m['content']}\n"
    return prompt


async def run_agent(session_id: str, user_message: str) -> AsyncGenerator[dict, None]:
    """
    Run the agent loop:
    1. Build messages (system + history + user message)
    2. Call Ollama with tools
    3. If tool call → execute → append result → repeat (max 5 iterations)
    4. Stream final answer tokens

    Yields SSE event dicts: {"type": "...", "content": "...", ...}
    """
    # Build conversation
    history = get_session_messages(session_id)
    messages = [{"role": "system", "content": _build_system_prompt()}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    # Save user message to session
    add_session_message(session_id, "user", user_message)

    iteration = 0
    full_response = ""

    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
        while iteration < MAX_TOOL_ITERATIONS:
            iteration += 1

            # Call Ollama (non-streaming first to check for tool calls)
            try:
                response = await client.post(
                    f"{OLLAMA_BASE_URL}/api/chat",
                    json={
                        "model": OLLAMA_MODEL,
                        "messages": messages,
                        "tools": TOOL_DEFINITIONS,
                        "stream": False,
                        "options": {
                            "temperature": 0.3,
                            "num_ctx": 8192,
                        },
                    },
                )
                response.raise_for_status()
            except httpx.ConnectError:
                yield {"type": "error", "content": "Cannot connect to Ollama. Make sure the LLM server is running."}
                return
            except httpx.HTTPStatusError as e:
                yield {"type": "error", "content": f"Ollama error: {e.response.status_code}"}
                return
            except Exception as e:
                yield {"type": "error", "content": f"LLM request failed: {str(e)}"}
                return

            data = response.json()
            assistant_msg = data.get("message", {})
            tool_calls = assistant_msg.get("tool_calls")

            if tool_calls:
                # Append assistant message with tool calls to conversation
                messages.append(assistant_msg)

                for tc in tool_calls:
                    fn_name = tc["function"]["name"]
                    fn_args = tc["function"].get("arguments", {})

                    # Send tool call indicator
                    status = TOOL_STATUS_MESSAGES.get(fn_name, f"Calling {fn_name}...")
                    yield {"type": "tool_call", "content": status, "metadata": {"tool": fn_name, "args": fn_args}}

                    # Handle save_memory specially
                    if fn_name == "save_memory":
                        save_long_term_memory(fn_args.get("key", ""), fn_args.get("content", ""))
                        tool_result = json.dumps({"status": "saved"})
                    else:
                        tool_result = execute_tool(fn_name, fn_args)

                    # Append tool result
                    messages.append({
                        "role": "tool",
                        "content": tool_result,
                    })

                # Continue loop — Ollama will process tool results
                continue

            # No tool calls — this is the final answer
            content = assistant_msg.get("content", "")
            if content:
                # Stream the content token by token (simulate streaming for SSE)
                # Since we used stream=False, send the whole response
                full_response = content
                yield {"type": "token", "content": content}

            break

    # Save assistant response to session
    if full_response:
        add_session_message(session_id, "assistant", full_response)

    yield {"type": "done"}
