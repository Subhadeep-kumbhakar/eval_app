import os
import json
import re
from pathlib import Path
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load .env file
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


def generate_exam_from_text(
    context_text: str,
    title: str = "Midterm Exam",
    num_mcq: int = 3,
    num_fill: int = 2,
    num_sub: int = 2,
    strictness: str = "medium",
) -> list:
    """Uses Gemini 3.6 Flash (Free) to synthesize structured exam questions from PDF text."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("[-] Error: GEMINI_API_KEY is missing from .env")
        return []

    try:
        client = genai.Client(api_key=api_key)
        sample_context = context_text[:15000] if context_text else "General Course Material"

        prompt = f"""
        You are a university professor creating an exam paper from this course material:
        \"\"\"{sample_context}\"\"\"

        EXAM REQUIREMENTS:
        - Exam Title: {title}
        - Generate exactly {num_mcq} Multiple Choice Questions (MCQ) [2 marks each, exactly 4 options with letters A, B, C, D, and 1 correct answer]
        - Generate exactly {num_fill} Fill in the Blanks questions [3 marks each, question MUST contain '______']
        - Generate exactly {num_sub} Subjective questions [5 marks each, with model answer key]
        - Difficulty / Strictness: {strictness}

        You MUST return ONLY a valid JSON array of question objects matching this schema:
        [
          {{
            "question_type": "mcq",
            "question_text": "What is ...?",
            "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
            "correct_answer": "A. ...",
            "marks": 2.0,
            "topic": "Topic Name",
            "difficulty": "{strictness}",
            "question_number": 1
          }},
          {{
            "question_type": "fill_blanks",
            "question_text": "... is defined as ______.",
            "options": [],
            "correct_answer": "Exact Term",
            "marks": 3.0,
            "topic": "Topic Name",
            "difficulty": "{strictness}",
            "question_number": 2
          }},
          {{
            "question_type": "subjective",
            "question_text": "Explain in detail ...",
            "options": [],
            "correct_answer": "Model answer explanation...",
            "marks": 5.0,
            "topic": "Topic Name",
            "difficulty": "{strictness}",
            "question_number": 3
          }}
        ]
        """

        print("[*] Requesting Gemini 3.6 Flash...")
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )

        text = response.text.strip()
        # Clean any potential markdown code blocks
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
        text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)

        questions = json.loads(text)
        print(f"[+] Generated {len(questions)} real AI questions via Gemini 3.6 Flash!")
        return questions

    except Exception as e:
        print(f"[-] Gemini Generation Error: {e}")
        return []