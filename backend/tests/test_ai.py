from app import ai


def test_ask_answers_simple_arithmetic():
    reply = ai.ask("What is 2+2? Answer with just the number.")
    assert "4" in reply
