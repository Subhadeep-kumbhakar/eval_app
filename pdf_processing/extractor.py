import pdfplumber
import io


def extract_text_from_pdf(pdf_file) -> str:
    """Extract text from a PDF file object or path.

    Args:
        pdf_file: Either a file path (str) or a file-like object (e.g., Streamlit UploadedFile).

    Returns:
        Extracted text as a single string.
    """
    text_parts = []

    if isinstance(pdf_file, str):
        pdf = pdfplumber.open(pdf_file)
    else:
        pdf = pdfplumber.open(io.BytesIO(pdf_file.read()))

    with pdf as p:
        for page in p.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)

    return "\n\n".join(text_parts)


def extract_text_from_multiple_pdfs(pdf_files: list) -> dict[str, str]:
    """Extract text from multiple PDF files.

    Args:
        pdf_files: List of file objects or paths.

    Returns:
        Dict mapping filename to extracted text.
    """
    results = {}
    for pdf_file in pdf_files:
        name = pdf_file.name if hasattr(pdf_file, "name") else str(pdf_file)
        text = extract_text_from_pdf(pdf_file)
        results[name] = text
    return results
