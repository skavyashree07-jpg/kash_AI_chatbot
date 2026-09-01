import os
import secrets
import sqlite3

import requests

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    HTTPException,
    Header
)

from fastapi.middleware.cors import CORSMiddleware

from fastapi.responses import StreamingResponse

from pydantic import BaseModel

from pypdf import PdfReader

from database import (
    create_database,
    create_user,
    verify_user,
    get_user_by_id,

    create_session,
    get_user_id_from_token,
    delete_session,

    create_chat,
    get_chats,
    get_messages,
    chat_belongs_to_user,

    save_message,

    update_chat_title_in_db,
    delete_chat,

    save_document,
    get_document_context
)


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="Kash AI API"
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"]
)


# =========================================================
# DATABASE
# =========================================================

create_database()


# =========================================================
# OLLAMA
# =========================================================

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"

OLLAMA_MODEL = "qwen2.5:7b"


# =========================================================
# REQUEST MODELS
# =========================================================

class RegisterRequest(BaseModel):

    name: str
    email: str
    password: str


class LoginRequest(BaseModel):

    email: str
    password: str


class MessageRequest(BaseModel):

    role: str
    content: str


class TitleRequest(BaseModel):

    title: str


class ChatRequest(BaseModel):

    messages: list


# =========================================================
# AUTHENTICATION
# =========================================================

def get_current_user(
    authorization: str | None
):

    if not authorization:

        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )

    if not authorization.startswith(
        "Bearer "
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header"
        )

    token = authorization[
        7:
    ].strip()

    user_id = get_user_id_from_token(
        token
    )

    if not user_id:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session"
        )

    user = get_user_by_id(
        user_id
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/")
def home():

    return {
        "message": "Kash AI backend is running!"
    }


# =========================================================
# REGISTER
# =========================================================

@app.post("/auth/register")
def register(
    request: RegisterRequest
):

    name = request.name.strip()
    email = request.email.strip().lower()
    password = request.password

    if not name:

        raise HTTPException(
            status_code=400,
            detail="Name is required"
        )

    if not email:

        raise HTTPException(
            status_code=400,
            detail="Email is required"
        )

    if len(password) < 6:

        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 6 characters"
        )

    user_id = create_user(
        name,
        email,
        password
    )

    if user_id is None:

        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists"
        )

    # Automatically log in after registration

    token = secrets.token_urlsafe(32)

    create_session(
        token,
        user_id
    )

    user = get_user_by_id(
        user_id
    )

    return {
        "message": "Account created successfully",
        "token": token,
        "user": user
    }


# =========================================================
# LOGIN
# =========================================================

@app.post("/auth/login")
def login(
    request: LoginRequest
):

    user = verify_user(
        request.email,
        request.password
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    token = secrets.token_urlsafe(32)

    create_session(
        token,
        user["id"]
    )

    return {
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"]
        }
    }


# =========================================================
# LOGOUT
# =========================================================

@app.post("/auth/logout")
def logout(
    authorization: str | None = Header(default=None)
):

    if authorization and authorization.startswith(
        "Bearer "
    ):

        token = authorization[
            7:
        ].strip()

        delete_session(token)

    return {
        "message": "Logged out successfully"
    }


# =========================================================
# CURRENT USER
# =========================================================

@app.get("/auth/me")
def current_user(
    authorization: str | None = Header(default=None)
):

    user = get_current_user(
        authorization
    )

    return {
        "user": user
    }


# =========================================================
# CREATE CHAT
# =========================================================

@app.post("/chats")
def create_new_chat(
    authorization: str | None = Header(default=None)
):

    user = get_current_user(
        authorization
    )

    chat_id = create_chat(
        title="New Chat",
        user_id=user["id"]
    )

    return {
        "chat_id": chat_id
    }


# =========================================================
# GET USER'S CHATS
# =========================================================

@app.get("/chats")
def get_user_chats(
    authorization: str | None = Header(default=None)
):

    user = get_current_user(
        authorization
    )

    return get_chats(
        user["id"]
    )


# =========================================================
# GET CHAT MESSAGES
# =========================================================

@app.get("/chats/{chat_id}/messages")
def get_chat_messages(
    chat_id: int,
    authorization: str | None = Header(default=None)
):

    user = get_current_user(
        authorization
    )

    if not chat_belongs_to_user(
        chat_id,
        user["id"]
    ):

        raise HTTPException(
            status_code=403,
            detail="You do not have access to this chat"
        )

    return get_messages(
        chat_id,
        user["id"]
    )


# =========================================================
# SAVE MESSAGE
# =========================================================

@app.post("/chats/{chat_id}/messages")
def add_message(
    chat_id: int,
    request: MessageRequest,
    authorization: str | None = Header(default=None)
):

    user = get_current_user(
        authorization
    )

    if not chat_belongs_to_user(
        chat_id,
        user["id"]
    ):

        raise HTTPException(
            status_code=403,
            detail="You do not have access to this chat"
        )

    if request.role not in [
        "user",
        "assistant"
    ]:

        raise HTTPException(
            status_code=400,
            detail="Invalid message role"
        )

    save_message(
        chat_id,
        request.role,
        request.content
    )

    return {
        "message": "Message saved"
    }


# =========================================================
# UPDATE CHAT TITLE
# =========================================================

@app.put("/chats/{chat_id}")
def update_chat_title(
    chat_id: int,
    request: TitleRequest,
    authorization: str | None = Header(default=None)
):

    user = get_current_user(
        authorization
    )

    if not chat_belongs_to_user(
        chat_id,
        user["id"]
    ):

        raise HTTPException(
            status_code=403,
            detail="You do not have access to this chat"
        )

    updated = update_chat_title_in_db(
        chat_id,
        request.title,
        user["id"]
    )

    if not updated:

        raise HTTPException(
            status_code=404,
            detail="Chat not found"
        )

    return {
        "message": "Chat title updated"
    }


# =========================================================
# DELETE CHAT
# =========================================================

@app.delete("/chats/{chat_id}")
def remove_chat(
    chat_id: int,
    authorization: str | None = Header(default=None)
):

    user = get_current_user(
        authorization
    )

    deleted = delete_chat(
        chat_id,
        user["id"]
    )

    if not deleted:

        raise HTTPException(
            status_code=404,
            detail="Chat not found"
        )

    return {
        "message": "Chat deleted"
    }


# =========================================================
# PDF UPLOAD
# =========================================================

@app.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    chat_id: int | None = None,
    authorization: str | None = Header(default=None)
):

    user = get_current_user(
        authorization
    )

    # -----------------------------------------------------
    # CHECK FILE
    # -----------------------------------------------------

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="No file selected"
        )

    if not file.filename.lower().endswith(
        ".pdf"
    ):

        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed"
        )

    # -----------------------------------------------------
    # CREATE CHAT IF NECESSARY
    # -----------------------------------------------------

    if chat_id is None:

        chat_id = create_chat(
            title=file.filename[:35],
            user_id=user["id"]
        )

    # -----------------------------------------------------
    # SECURITY CHECK
    # -----------------------------------------------------

    if not chat_belongs_to_user(
        chat_id,
        user["id"]
    ):

        raise HTTPException(
            status_code=403,
            detail="You do not have access to this chat"
        )

    # -----------------------------------------------------
    # READ PDF
    # -----------------------------------------------------

    try:

        file_bytes = await file.read()

        temp_filename = (
            f"temp_{secrets.token_hex(8)}.pdf"
        )

        with open(
            temp_filename,
            "wb"
        ) as temp_file:

            temp_file.write(
                file_bytes
            )

        reader = PdfReader(
            temp_filename
        )

        text_parts = []

        for page in reader.pages:

            page_text = page.extract_text()

            if page_text:

                text_parts.append(
                    page_text
                )

        text = "\n\n".join(
            text_parts
        )

        os.remove(
            temp_filename
        )

    except Exception as error:

        print(
            "PDF ERROR:",
            error
        )

        raise HTTPException(
            status_code=500,
            detail="Could not read PDF"
        )

    if not text.strip():

        raise HTTPException(
            status_code=400,
            detail="Could not extract text from this PDF"
        )

    # -----------------------------------------------------
    # SAVE PDF TO USER'S CHAT
    # -----------------------------------------------------

    document_id = save_document(
        user["id"],
        chat_id,
        file.filename,
        text
    )

    return {
        "message": "PDF uploaded successfully",
        "filename": file.filename,
        "chat_id": chat_id,
        "document_id": document_id
    }


# =========================================================
# AI CHAT
# =========================================================

@app.post("/chat")
def chat(
    request: ChatRequest,
    authorization: str | None = Header(default=None)
):

    user = get_current_user(
        authorization
    )

    # -----------------------------------------------------
    # FIND LAST USER MESSAGE
    # -----------------------------------------------------

    messages = request.messages

    if not messages:

        raise HTTPException(
            status_code=400,
            detail="No messages provided"
        )

    # -----------------------------------------------------
    # SYSTEM PROMPT
    # -----------------------------------------------------

    system_prompt = """
You are Kash AI, a helpful intelligent assistant.

Answer clearly and accurately.

Use simple explanations when appropriate.

If the user asks programming questions,
provide useful and correct code.

If document context is provided,
use that information to answer questions
about the uploaded document.

Do not claim information exists in a PDF
when it is not present in the provided context.
"""

    # -----------------------------------------------------
    # OLLAMA MESSAGES
    # -----------------------------------------------------

    ollama_messages = [
        {
            "role": "system",
            "content": system_prompt
        }
    ]

    for msg in messages:

        role = msg.get(
            "role",
            "user"
        )

        content = msg.get(
            "content",
            ""
        )

        if role not in [
            "user",
            "assistant"
        ]:

            continue

        ollama_messages.append(
            {
                "role": role,
                "content": content
            }
        )

    # -----------------------------------------------------
    # OLLAMA REQUEST
    # -----------------------------------------------------

    payload = {
        "model": OLLAMA_MODEL,
        "messages": ollama_messages,
        "stream": True
    }

    def generate():

        try:

            response = requests.post(
                OLLAMA_URL,
                json=payload,
                stream=True,
                timeout=300
            )

            response.raise_for_status()

            for line in response.iter_lines():

                if not line:
                    continue

                try:

                    import json

                    data = json.loads(
                        line.decode("utf-8")
                    )

                    chunk = data.get(
                        "message",
                        {}
                    ).get(
                        "content",
                        ""
                    )

                    if chunk:

                        yield chunk

                except Exception:

                    continue

        except Exception as error:

            print(
                "OLLAMA ERROR:",
                error
            )

            yield (
                "\n\nSorry, I couldn't connect "
                "to the AI model."
            )

    return StreamingResponse(
        generate(),
        media_type="text/plain"
    )