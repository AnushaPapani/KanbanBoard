import os

from anthropic import Anthropic

MODEL = "claude-sonnet-5"

_client: Anthropic | None = None


def get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.environ["CLAUDE_API_KEY"])
    return _client


def ask(message: str) -> str:
    response = get_client().messages.create(
        model=MODEL,
        max_tokens=256,
        messages=[{"role": "user", "content": message}],
    )
    return response.content[0].text


_ACTION_SCHEMAS = [
    {
        "type": "object",
        "properties": {
            "type": {"const": "add_card"},
            "column_id": {"type": "string"},
            "title": {"type": "string"},
            "details": {"type": "string"},
        },
        "required": ["type", "column_id", "title", "details"],
    },
    {
        "type": "object",
        "properties": {
            "type": {"const": "update_card"},
            "card_id": {"type": "string"},
            "title": {"type": "string"},
            "details": {"type": "string"},
        },
        "required": ["type", "card_id", "title", "details"],
    },
    {
        "type": "object",
        "properties": {
            "type": {"const": "delete_card"},
            "card_id": {"type": "string"},
        },
        "required": ["type", "card_id"],
    },
    {
        "type": "object",
        "properties": {
            "type": {"const": "move_card"},
            "card_id": {"type": "string"},
            "column_id": {"type": "string"},
            "position": {"type": "integer"},
        },
        "required": ["type", "card_id", "column_id", "position"],
    },
    {
        "type": "object",
        "properties": {
            "type": {"const": "rename_column"},
            "column_id": {"type": "string"},
            "title": {"type": "string"},
        },
        "required": ["type", "column_id", "title"],
    },
]

RESPOND_TOOL = {
    "name": "respond",
    "description": "Reply to the user and optionally update the Kanban board.",
    "input_schema": {
        "type": "object",
        "properties": {
            "reply": {
                "type": "string",
                "description": "The natural-language reply to show the user.",
            },
            "actions": {
                "type": "array",
                "description": (
                    "Zero or more actions to apply to the board, in order. "
                    "Empty if the request doesn't require a board change."
                ),
                "items": {"anyOf": _ACTION_SCHEMAS},
            },
        },
        "required": ["reply", "actions"],
    },
}

SYSTEM_PROMPT = (
    "You are an assistant embedded in a single-board Kanban app. "
    "You can see the current board as JSON (columns, in order, each with its cardIds; "
    "cards keyed by id). You can create, edit, move, or delete cards, and rename columns, "
    "by returning actions for the respond tool. Always call the respond tool exactly once. "
    "Keep replies short and conversational. If the request doesn't require a board change, "
    "return an empty actions list."
)


def chat(board_json: str, history: list[dict], message: str) -> dict:
    messages = [*history, {"role": "user", "content": message}]
    response = get_client().messages.create(
        model=MODEL,
        max_tokens=1024,
        system=f"{SYSTEM_PROMPT}\n\nCurrent board:\n{board_json}",
        messages=messages,
        tools=[RESPOND_TOOL],
        tool_choice={"type": "tool", "name": "respond"},
    )
    for block in response.content:
        if block.type == "tool_use":
            return block.input
    raise RuntimeError("Model did not return the expected tool call")
