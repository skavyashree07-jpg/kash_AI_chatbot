import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash


DATABASE = "chat_history.db"


# =========================================================
# DATABASE CONNECTION
# =========================================================

def get_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


# =========================================================
# CREATE DATABASE
# =========================================================

def create_database():

    connection = get_connection()
    cursor = connection.cursor()

    # -----------------------------------------------------
    # USERS
    # -----------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # -----------------------------------------------------
    # CHAT
    # -----------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL DEFAULT 'New Chat',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        )
    """)

    # -----------------------------------------------------
    # MESSAGES
    # -----------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (chat_id)
                REFERENCES chats(id)
                ON DELETE CASCADE
        )
    """)

    # -----------------------------------------------------
    # DOCUMENTS / PDFs
    # -----------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            chat_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE,

            FOREIGN KEY (chat_id)
                REFERENCES chats(id)
                ON DELETE CASCADE
        )
    """)

    # -----------------------------------------------------
    # SESSIONS
    # -----------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        )
    """)

    connection.commit()
    connection.close()


# =========================================================
# USER FUNCTIONS
# =========================================================

def create_user(name, email, password):

    connection = get_connection()
    cursor = connection.cursor()

    try:

        email = email.strip().lower()

        hashed_password = generate_password_hash(password)

        cursor.execute(
            """
            INSERT INTO users
            (name, email, password)
            VALUES (?, ?, ?)
            """,
            (
                name.strip(),
                email,
                hashed_password
            )
        )

        user_id = cursor.lastrowid

        connection.commit()

        return user_id

    except sqlite3.IntegrityError:

        return None

    finally:

        connection.close()


def verify_user(email, password):

    connection = get_connection()
    cursor = connection.cursor()

    email = email.strip().lower()

    cursor.execute(
        """
        SELECT *
        FROM users
        WHERE email = ?
        """,
        (email,)
    )

    user = cursor.fetchone()

    connection.close()

    if not user:
        return None

    if not check_password_hash(
        user["password"],
        password
    ):
        return None

    return dict(user)


def get_user_by_id(user_id):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            id,
            name,
            email,
            created_at
        FROM users
        WHERE id = ?
        """,
        (user_id,)
    )

    user = cursor.fetchone()

    connection.close()

    if not user:
        return None

    return dict(user)


# =========================================================
# SESSION FUNCTIONS
# =========================================================

def create_session(token, user_id):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO sessions
        (token, user_id)
        VALUES (?, ?)
        """,
        (
            token,
            user_id
        )
    )

    connection.commit()
    connection.close()


def get_user_id_from_token(token):

    if not token:
        return None

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT user_id
        FROM sessions
        WHERE token = ?
        """,
        (token,)
    )

    session = cursor.fetchone()

    connection.close()

    if not session:
        return None

    return session["user_id"]


def delete_session(token):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        DELETE FROM sessions
        WHERE token = ?
        """,
        (token,)
    )

    connection.commit()
    connection.close()


# =========================================================
# CHAT FUNCTIONS
# =========================================================

def create_chat(title="New Chat", user_id=None):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO chats
        (user_id, title)
        VALUES (?, ?)
        """,
        (
            user_id,
            title
        )
    )

    chat_id = cursor.lastrowid

    connection.commit()
    connection.close()

    return chat_id


def get_chats(user_id):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            id,
            title,
            created_at
        FROM chats
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC
        """,
        (user_id,)
    )

    chats = cursor.fetchall()

    connection.close()

    return [
        dict(chat)
        for chat in chats
    ]


def chat_belongs_to_user(chat_id, user_id):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id
        FROM chats
        WHERE id = ?
        AND user_id = ?
        """,
        (
            chat_id,
            user_id
        )
    )

    chat = cursor.fetchone()

    connection.close()

    return chat is not None


# =========================================================
# MESSAGE FUNCTIONS
# =========================================================

def save_message(chat_id, role, content):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO messages
        (chat_id, role, content)
        VALUES (?, ?, ?)
        """,
        (
            chat_id,
            role,
            content
        )
    )

    connection.commit()
    connection.close()


def get_messages(chat_id, user_id):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            messages.role,
            messages.content
        FROM messages
        JOIN chats
            ON messages.chat_id = chats.id
        WHERE messages.chat_id = ?
        AND chats.user_id = ?
        ORDER BY messages.id ASC
        """,
        (
            chat_id,
            user_id
        )
    )

    messages = cursor.fetchall()

    connection.close()

    return [
        dict(message)
        for message in messages
    ]


# =========================================================
# CHAT TITLE
# =========================================================

def update_chat_title_in_db(
    chat_id,
    title,
    user_id
):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE chats
        SET title = ?
        WHERE id = ?
        AND user_id = ?
        """,
        (
            title,
            chat_id,
            user_id
        )
    )

    connection.commit()

    updated = cursor.rowcount > 0

    connection.close()

    return updated


# =========================================================
# DELETE CHAT
# =========================================================

def delete_chat(chat_id, user_id):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        DELETE FROM chats
        WHERE id = ?
        AND user_id = ?
        """,
        (
            chat_id,
            user_id
        )
    )

    deleted = cursor.rowcount > 0

    connection.commit()
    connection.close()

    return deleted


# =========================================================
# DOCUMENT / PDF FUNCTIONS
# =========================================================

def save_document(
    user_id,
    chat_id,
    filename,
    content
):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO documents
        (
            user_id,
            chat_id,
            filename,
            content
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            user_id,
            chat_id,
            filename,
            content
        )
    )

    document_id = cursor.lastrowid

    connection.commit()
    connection.close()

    return document_id


def get_documents_for_chat(
    chat_id,
    user_id
):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            id,
            filename,
            content,
            created_at
        FROM documents
        WHERE chat_id = ?
        AND user_id = ?
        ORDER BY id DESC
        """,
        (
            chat_id,
            user_id
        )
    )

    documents = cursor.fetchall()

    connection.close()

    return [
        dict(document)
        for document in documents
    ]


def get_document_context(
    chat_id,
    user_id
):

    documents = get_documents_for_chat(
        chat_id,
        user_id
    )

    if not documents:
        return ""

    parts = []

    for document in documents:

        parts.append(
            f"""
DOCUMENT: {document['filename']}

{document['content']}
"""
        )

    return "\n\n".join(parts)