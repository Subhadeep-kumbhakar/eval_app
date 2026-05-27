# Student-Teacher Evaluation System

An AI-powered examination system where teachers upload course material, generate question papers automatically using LLM + RAG, and evaluate student answers with configurable strictness levels.

---

## How It Works (Step-by-Step)

### Step 1: Teacher Registration & Login

- Teachers register with name, email, subject, and password.
- Credentials are stored in a local SQLite database with hashed passwords.
- After login, teachers land on their dashboard where they can manage exams.

### Step 2: PDF Upload & Knowledge Base Creation

- Teacher uploads one or more PDFs (textbooks, notes, course material).
- The system extracts text from each PDF using `pdfplumber`.
- Extracted text is split into overlapping chunks (~500-1000 tokens each) using LangChain's `RecursiveCharacterTextSplitter`.
- Each chunk is converted into a vector embedding using a sentence-transformer model (e.g., `all-MiniLM-L6-v2`).
- Embeddings are stored in **ChromaDB**, a local vector database — this becomes the knowledge base for that exam.

**Why chunks?** LLMs have token limits. By chunking, we retrieve only the most relevant parts of the material when generating questions, making the output accurate and context-aware.

### Step 3: Exam Configuration

Teacher configures the question paper by setting:

| Parameter              | Example               |
|------------------------|-----------------------|
| Total Marks            | 100                   |
| Topic Weightage        | Ch1: 40%, Ch2: 30%, Ch3: 30% |
| Number of MCQs         | 20 (1 mark each)      |
| Number of Fill-in-the-Blanks | 10 (2 marks each) |
| Number of Subjective Questions | 5 (8 marks each) |

The system validates that marks distribution adds up to the total.

### Step 4: Question Paper Generation (RAG + LLM)

This is the core of the system. It uses **Retrieval-Augmented Generation (RAG)**:

1. **Retrieve**: For each topic, the system queries ChromaDB to fetch the most relevant text chunks using similarity search.
2. **Augment**: The retrieved chunks are injected into a prompt template along with the exam configuration (question types, count, marks).
3. **Generate**: The LLM (GPT-4 / Gemini / local Ollama) generates questions strictly from the provided context.

```
[Topic: "Data Structures"] + [Retrieved chunks about trees, graphs...]
    |
    v
Prompt: "Generate 5 MCQs from the following content. Each MCQ should have
         4 options with exactly one correct answer..."
    |
    v
LLM Output: Structured questions with answers
```

The system also generates a **model answer key** simultaneously, which is used later for evaluation.

### Step 5: Student Registration & Login

- Students register with name, email, roll number, and password.
- Separate authentication flow from teachers.
- After login, students see available exams assigned to them.

### Step 6: Student Answer Submission

- Students view the generated question paper on their dashboard.
- They type answers directly (for text-based submission) or upload an answer PDF.
- Answers are stored linked to the student ID and exam ID.

### Step 7: Automated Answer Evaluation

The evaluation pipeline handles each question type differently:

#### MCQ Evaluation
- **Method**: Exact match against answer key.
- Scoring: Full marks or zero — no partial credit.

#### Fill-in-the-Blanks Evaluation
- **Method**: Fuzzy string matching + keyword matching.
- Uses `fuzzywuzzy` or `rapidfuzz` for approximate matching.
- Handles spelling variations and synonyms.
- Scoring: Full or partial credit based on match ratio.

#### Subjective Answer Evaluation
- **Method**: Hybrid approach combining:
  - **Semantic Similarity**: Embed both the model answer and student answer, compute cosine similarity.
  - **LLM-based Rubric Evaluation**: Send the model answer + student answer + rubric to the LLM for detailed scoring.
- The LLM considers:
  - Key concepts covered
  - Factual accuracy
  - Depth of explanation
  - Relevance to the question

#### Evaluation Strictness Levels

The teacher selects a strictness level that adjusts scoring thresholds:

| Level  | Behavior |
|--------|----------|
| Easy   | Lenient grading — partial credit given generously, synonyms accepted freely, lower similarity threshold (~0.6) |
| Medium | Balanced grading — standard thresholds, reasonable partial credit (~0.75 similarity) |
| Hard   | Strict grading — high accuracy required, minimal partial credit, high similarity threshold (~0.85) |

### Step 8: Results & Feedback

- Per-question marks breakdown.
- AI-generated feedback explaining why marks were awarded or deducted.
- Total score with percentage.
- Teachers can review and override AI-assigned marks if needed.

---

## Project Structure

```
evaluation/
├── app.py                     # Streamlit entry point (multi-page)
├── requirements.txt           # Python dependencies
├── .env                       # API keys (OPENAI_API_KEY, etc.)
├── README.md
├── PROJECT_IDEAS.txt
│
├── config/
│   └── settings.py            # App configuration, constants
│
├── database/
│   ├── db.py                  # SQLite connection & setup
│   ├── models.py              # User, Exam, Question, Submission schemas
│   └── evaluation.db          # SQLite database file (auto-created)
│
├── auth/
│   ├── teacher_auth.py        # Teacher registration/login logic
│   └── student_auth.py        # Student registration/login logic
│
├── pdf_processing/
│   ├── extractor.py           # PDF text extraction (pdfplumber)
│   └── chunker.py             # Text chunking with LangChain
│
├── rag/
│   ├── embeddings.py          # Embedding model setup
│   ├── vector_store.py        # ChromaDB operations (store/query)
│   └── retriever.py           # Retrieval logic for question generation
│
├── generation/
│   ├── question_generator.py  # LLM-based question generation
│   ├── prompts.py             # Prompt templates for each question type
│   └── paper_builder.py       # Assembles final question paper
│
├── evaluation/
│   ├── mcq_evaluator.py       # Exact match for MCQs
│   ├── fill_evaluator.py      # Fuzzy match for fill-in-the-blanks
│   ├── subjective_evaluator.py# Semantic similarity + LLM evaluation
│   ├── scoring.py             # Marks aggregation & strictness logic
│   └── feedback.py            # AI feedback generation
│
├── pages/
│   ├── 1_Teacher_Dashboard.py # Teacher-facing Streamlit pages
│   ├── 2_Create_Exam.py       # PDF upload + exam config
│   ├── 3_Generate_Paper.py    # Question generation page
│   ├── 4_Student_Dashboard.py # Student-facing pages
│   ├── 5_Take_Exam.py         # Answer submission
│   └── 6_Results.py           # Marks & feedback display
│
└── utils/
    ├── pdf_utils.py           # Helper functions for PDF handling
    └── validators.py          # Input validation helpers
```

---

## Tech Stack

| Component          | Technology                              |
|--------------------|-----------------------------------------|
| **Frontend**       | Streamlit (multi-page app)              |
| **Backend**        | Python 3.10+                            |
| **LLM**           | OpenAI GPT-4 / Google Gemini / Ollama   |
| **Embeddings**     | sentence-transformers (`all-MiniLM-L6-v2`) |
| **Vector Store**   | ChromaDB                                |
| **RAG Framework**  | LangChain                               |
| **PDF Parsing**    | pdfplumber                              |
| **Database**       | SQLite                                  |
| **Auth**           | streamlit-authenticator                 |
| **Fuzzy Matching** | rapidfuzz                               |

---

## Installation & Setup

```bash
# 1. Clone or navigate to the project
cd evaluation

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate        # Linux/Mac
venv\Scripts\activate           # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up environment variables
# Create a .env file with:
OPENAI_API_KEY=your_key_here    # if using OpenAI
# OR
GOOGLE_API_KEY=your_key_here    # if using Gemini

# 5. Run the application
streamlit run app.py
```

---

## Key Dependencies

```
streamlit
langchain
langchain-community
langchain-openai          # or langchain-google-genai
chromadb
sentence-transformers
pdfplumber
rapidfuzz
streamlit-authenticator
python-dotenv
sqlite3                   # built-in
```

---

## API Endpoints (Logical Flow)

Since this is a Streamlit app, there are no REST endpoints. Instead, the logical flows are:

| Flow                  | Page                    | Action                                      |
|-----------------------|-------------------------|----------------------------------------------|
| Teacher Registration  | `app.py`                | Register with credentials                    |
| Teacher Login         | `app.py`                | Authenticate and redirect to dashboard       |
| Upload PDFs           | `Create_Exam.py`        | Upload, parse, chunk, embed, store           |
| Configure Exam        | `Create_Exam.py`        | Set marks, topics, question distribution     |
| Generate Paper        | `Generate_Paper.py`     | RAG retrieval + LLM generation               |
| Student Registration  | `app.py`                | Register with roll number                    |
| Student Login         | `app.py`                | Authenticate and redirect to dashboard       |
| Submit Answers        | `Take_Exam.py`          | Type or upload answers                       |
| Evaluate              | `Teacher_Dashboard.py`  | Select strictness, trigger evaluation        |
| View Results          | `Results.py`            | See marks, feedback, export                  |

---

## Suggested Enhancements (My Additions)

1. **Bloom's Taxonomy Tagging** — Tag each question with its cognitive level so the teacher can ensure a balanced assessment.
2. **Answer Key Auto-Generation** — Generate model answers alongside questions for consistent evaluation.
3. **Confidence Scoring** — Show the AI's confidence in each grading decision so teachers know which answers need manual review.
4. **Plagiarism Detection** — Compare student answers against each other using cosine similarity to flag potential copying.
5. **Question Bank** — Save generated questions for reuse across exams, with filtering by topic and difficulty.
6. **Class Analytics** — Dashboard showing average scores, pass rates, and topic-wise performance breakdowns.
7. **Distractor Generation** — For MCQs, generate plausible wrong options that test actual understanding.
8. **Manual Override** — Teachers can adjust any AI-assigned mark before finalizing results.

---

## License

This project is for educational purposes.
