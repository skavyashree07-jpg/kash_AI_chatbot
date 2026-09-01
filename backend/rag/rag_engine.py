import re

from database import (
    save_document,
    get_user_documents
)


# =========================================================
# TEXT CHUNKING
# =========================================================

def chunk_text(text, chunk_size=1000):

    text = text.strip()

    if not text:
        return []

    chunks = []

    start = 0

    while start < len(text):

        end = start + chunk_size

        chunk = text[start:end]

        chunks.append(chunk)

        start = end

    return chunks


# =========================================================
# ADD DOCUMENT
# =========================================================

def add_document(
    user_id,
    text,
    filename
):

    chunks = chunk_text(text)

    if not chunks:
        return 0

    # Save complete document
    save_document(
        user_id,
        filename,
        text
    )

    return len(chunks)


# =========================================================
# SIMPLE USER-ISOLATED SEARCH
# =========================================================

def search_documents(
    user_id,
    query,
    number_of_results=4
):

    documents = get_user_documents(
        user_id
    )

    if not documents:
        return []


    # Words from question
    query_words = set(
        re.findall(
            r"\b\w+\b",
            query.lower()
        )
    )


    scored_chunks = []


    for document in documents:

        chunks = chunk_text(
            document["content"]
        )

        for chunk in chunks:

            chunk_words = set(
                re.findall(
                    r"\b\w+\b",
                    chunk.lower()
                )
            )

            score = len(
                query_words.intersection(
                    chunk_words
                )
            )

            if score > 0:

                scored_chunks.append(
                    (
                        score,
                        document["filename"],
                        chunk
                    )
                )


    scored_chunks.sort(
        key=lambda item: item[0],
        reverse=True
    )


    results = []

    for score, filename, chunk in scored_chunks[
        :number_of_results
    ]:

        results.append(
            f"[Source: {filename}]\n{chunk}"
        )


    return results