import json
import re
from rag.embeddings import embed_single
from generation.question_generator import get_llm_response
from generation.prompts import EVALUATION_PROMPT
from config.settings import STRICTNESS_THRESHOLDS
import numpy as np


def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    a = np.array(vec1)
    b = np.array(vec2)
    if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
        return 0.0
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def evaluate_subjective(question_text: str, student_answer: str,
                        correct_answer: str, max_marks: float,
                        strictness: str = "medium") -> dict:
    """Evaluate a subjective answer using semantic similarity + LLM.

    Uses a hybrid approach:
    1. Semantic similarity (embedding cosine similarity)
    2. LLM-based rubric evaluation

    Args:
        question_text: The question.
        student_answer: Student's answer.
        correct_answer: Model answer.
        max_marks: Maximum marks.
        strictness: easy / medium / hard.

    Returns:
        Dict with marks_awarded, feedback, confidence.
    """
    if not student_answer.strip():
        return {
            "marks_awarded": 0.0,
            "feedback": "No answer provided.",
            "confidence": 1.0,
        }

    thresholds = STRICTNESS_THRESHOLDS[strictness]
    sim_weight = thresholds["subjective_similarity_weight"]
    llm_weight = thresholds["subjective_llm_weight"]

    # --- Step 1: Semantic similarity ---
    student_embedding = embed_single(student_answer)
    model_embedding = embed_single(correct_answer)
    similarity = cosine_similarity(student_embedding, model_embedding)
    similarity_marks = similarity * max_marks

    # --- Step 2: LLM evaluation ---
    prompt = EVALUATION_PROMPT.format(
        question=question_text,
        model_answer=correct_answer,
        student_answer=student_answer,
        max_marks=max_marks,
        strictness=strictness,
    )

    try:
        response = get_llm_response(prompt)
        # Parse JSON from response
        text = response.strip()
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if match:
            text = match.group(1).strip()
        llm_result = json.loads(text)
        llm_marks = float(llm_result.get("marks_awarded", 0))
        llm_feedback = llm_result.get("feedback", "")
        llm_confidence = float(llm_result.get("confidence", 0.5))
    except (json.JSONDecodeError, KeyError, ValueError):
        # Fallback to similarity-only if LLM parsing fails
        llm_marks = similarity_marks
        llm_feedback = "Evaluated based on semantic similarity."
        llm_confidence = similarity

    # --- Step 3: Combine scores ---
    final_marks = (sim_weight * similarity_marks) + (llm_weight * llm_marks)
    final_marks = round(final_marks * 2) / 2  # Round to nearest 0.5
    final_marks = max(0, min(final_marks, max_marks))

    # Apply partial credit floor
    floor = thresholds["partial_credit_floor"]
    if final_marks > 0 and final_marks < floor * max_marks:
        final_marks = 0.0

    avg_confidence = (similarity + llm_confidence) / 2

    feedback = llm_feedback + f" [Semantic similarity: {similarity:.2f}]"

    return {
        "marks_awarded": final_marks,
        "feedback": feedback,
        "confidence": round(avg_confidence, 2),
    }
