import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";

const API =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function App() {

  // =====================================================
  // AUTH
  // =====================================================

  const [token, setToken] = useState(
    localStorage.getItem("kash-token")
  );

  const [user, setUser] = useState(null);

  const [authMode, setAuthMode] = useState("login");

  const [authName, setAuthName] = useState("");

  const [authEmail, setAuthEmail] = useState("");

  const [authPassword, setAuthPassword] = useState("");

  const [authLoading, setAuthLoading] = useState(false);

  const [authError, setAuthError] = useState("");

  // =====================================================
  // CHAT
  // =====================================================

  const [message, setMessage] = useState("");

  const [messages, setMessages] = useState([]);

  const [loading, setLoading] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [fileName, setFileName] = useState("");

  const [chatId, setChatId] = useState(null);

  const [chatHistory, setChatHistory] = useState([]);

  // =====================================================
  // VOICE
  // =====================================================

  const [isListening, setIsListening] = useState(false);

  const [speakingMessage, setSpeakingMessage] = useState(null);

  // =====================================================
  // SETTINGS
  // =====================================================

  const [settingsOpen, setSettingsOpen] = useState(false);

  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("kash-theme") === "dark"
  );

  const [voiceEnabled, setVoiceEnabled] = useState(
    localStorage.getItem("kash-voice") !== "false"
  );

  const [showAbout, setShowAbout] = useState(false);

  // =====================================================
  // REFS
  // =====================================================

  const messagesEndRef = useRef(null);

  const abortControllerRef = useRef(null);

  const recognitionRef = useRef(null);


  // =====================================================
  // AUTH HEADERS
  // =====================================================

  const authHeaders = () => {

    const currentToken =
      localStorage.getItem("kash-token");

    return {
      "Authorization":
        `Bearer ${currentToken}`
    };
  };


  // =====================================================
  // LOAD CURRENT USER
  // =====================================================

  useEffect(() => {

    if (!token) {
      return;
    }

    loadCurrentUser();

  }, [token]);


  const loadCurrentUser = async () => {

    try {

      const response = await fetch(
        `${API}/auth/me`,
        {
          headers: authHeaders()
        }
      );

      if (!response.ok) {

        logout(false);

        return;
      }

      const data = await response.json();

      setUser(data.user);

      loadChatHistory();

    } catch (error) {

      console.error(
        "Authentication error:",
        error
      );
    }
  };


  // =====================================================
  // LOGIN
  // =====================================================

  const login = async () => {

    setAuthError("");

    if (!authEmail.trim()) {

      setAuthError(
        "Please enter your email."
      );

      return;
    }

    if (!authPassword) {

      setAuthError(
        "Please enter your password."
      );

      return;
    }

    setAuthLoading(true);

    try {

      const response = await fetch(
        `${API}/auth/login`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            email: authEmail,
            password: authPassword
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {

        throw new Error(
          data.detail ||
          "Login failed"
        );
      }

      localStorage.setItem(
        "kash-token",
        data.token
      );

      setToken(data.token);

      setUser(data.user);

      setAuthPassword("");

    } catch (error) {

      setAuthError(
        error.message
      );

    } finally {

      setAuthLoading(false);
    }
  };


  // =====================================================
  // REGISTER
  // =====================================================

  const register = async () => {

    setAuthError("");

    if (!authName.trim()) {

      setAuthError(
        "Please enter your name."
      );

      return;
    }

    if (!authEmail.trim()) {

      setAuthError(
        "Please enter your email."
      );

      return;
    }

    if (authPassword.length < 6) {

      setAuthError(
        "Password must contain at least 6 characters."
      );

      return;
    }

    setAuthLoading(true);

    try {

      const response = await fetch(
        `${API}/auth/register`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            name: authName,
            email: authEmail,
            password: authPassword
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {

        throw new Error(
          data.detail ||
          "Registration failed"
        );
      }

      localStorage.setItem(
        "kash-token",
        data.token
      );

      setToken(data.token);

      setUser(data.user);

      setAuthPassword("");

    } catch (error) {

      setAuthError(
        error.message
      );

    } finally {

      setAuthLoading(false);
    }
  };


  // =====================================================
  // LOGOUT
  // =====================================================

  const logout = async (
    askConfirmation = true
  ) => {

    if (
      askConfirmation &&
      !window.confirm(
        "Are you sure you want to logout?"
      )
    ) {
      return;
    }

    try {

      await fetch(
        `${API}/auth/logout`,
        {
          method: "POST",
          headers: authHeaders()
        }
      );

    } catch (error) {

      console.error(
        "Logout error:",
        error
      );
    }

    localStorage.removeItem(
      "kash-token"
    );

    setToken(null);

    setUser(null);

    setMessages([]);

    setChatHistory([]);

    setChatId(null);

    setFileName("");

    setSettingsOpen(false);
  };


  // =====================================================
  // THEME
  // =====================================================

  useEffect(() => {

    document.body.classList.toggle(
      "dark-mode",
      darkMode
    );

    localStorage.setItem(
      "kash-theme",
      darkMode
        ? "dark"
        : "light"
    );

  }, [darkMode]);


  // =====================================================
  // VOICE SETTING
  // =====================================================

  useEffect(() => {

    localStorage.setItem(
      "kash-voice",
      voiceEnabled
        ? "true"
        : "false"
    );

    if (!voiceEnabled) {

      window.speechSynthesis?.cancel();

      setSpeakingMessage(null);
    }

  }, [voiceEnabled]);


  // =====================================================
  // LOAD CHAT HISTORY
  // =====================================================

  const loadChatHistory = async () => {

    if (!token) return;

    try {

      const response = await fetch(
        `${API}/chats`,
        {
          headers: authHeaders()
        }
      );

      if (
        response.status === 401
      ) {

        logout(false);

        return;
      }

      if (!response.ok) {

        throw new Error(
          "Could not load chats"
        );
      }

      const data =
        await response.json();

      setChatHistory(data);

    } catch (error) {

      console.error(
        "Could not load chat history:",
        error
      );
    }
  };


  // =====================================================
  // AUTO SCROLL
  // =====================================================

  useEffect(() => {

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });

  }, [messages]);


  // =====================================================
  // VOICE RECOGNITION
  // =====================================================

  useEffect(() => {

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition =
      new SpeechRecognition();

    recognition.continuous = false;

    recognition.interimResults = true;

    recognition.lang = "en-IN";

    recognition.onstart = () => {

      setIsListening(true);
    };

    recognition.onresult = (event) => {

      let transcript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {

        transcript +=
          event.results[i][0].transcript;
      }

      setMessage(transcript);
    };

    recognition.onerror = (event) => {

      console.error(
        "Voice recognition error:",
        event.error
      );

      setIsListening(false);
    };

    recognition.onend = () => {

      setIsListening(false);
    };

    recognitionRef.current =
      recognition;

    return () => {

      try {

        recognition.stop();

      } catch {}
    };

  }, []);


  // =====================================================
  // VOICE INPUT
  // =====================================================

  const toggleVoice = () => {

    if (!voiceEnabled) {

      alert(
        "Voice features are disabled in Settings."
      );

      return;
    }

    if (!recognitionRef.current) {

      alert(
        "Voice input is not supported in this browser. Please use Google Chrome."
      );

      return;
    }

    if (isListening) {

      recognitionRef.current.stop();

      setIsListening(false);

    } else {

      try {

        recognitionRef.current.start();

      } catch (error) {

        console.log(error);
      }
    }
  };


  // =====================================================
  // TEXT TO SPEECH
  // =====================================================

  const speakText = (
    text,
    index
  ) => {

    if (!voiceEnabled) {

      alert(
        "Voice features are disabled in Settings."
      );

      return;
    }

    if (
      !("speechSynthesis" in window)
    ) {

      alert(
        "Text-to-speech is not supported in this browser."
      );

      return;
    }

    window.speechSynthesis.cancel();

    if (
      speakingMessage === index
    ) {

      setSpeakingMessage(null);

      return;
    }

    const cleanText =
      text
        .replace(
          /```[\s\S]*?```/g,
          "Code omitted."
        )
        .replace(
          /[#*_>`]/g,
          ""
        )
        .replace(
          /\n+/g,
          " "
        );

    const utterance =
      new SpeechSynthesisUtterance(
        cleanText
      );

    utterance.lang = "en-IN";

    utterance.rate = 1;

    utterance.pitch = 1;

    utterance.onstart = () => {

      setSpeakingMessage(index);
    };

    utterance.onend = () => {

      setSpeakingMessage(null);
    };

    utterance.onerror = () => {

      setSpeakingMessage(null);
    };

    window.speechSynthesis.speak(
      utterance
    );
  };


  // =====================================================
  // NEW CHAT
  // =====================================================

  const createNewChat = () => {

    window.speechSynthesis?.cancel();

    setMessages([]);

    setFileName("");

    setChatId(null);

    setSpeakingMessage(null);

    setMessage("");

    setSettingsOpen(false);
  };


  // =====================================================
  // ENSURE CHAT EXISTS
  // =====================================================

  const ensureChat = async () => {

    if (chatId) {

      return chatId;
    }

    const response =
      await fetch(
        `${API}/chats`,
        {
          method: "POST",
          headers: authHeaders()
        }
      );

    if (!response.ok) {

      throw new Error(
        "Could not create chat"
      );
    }

    const data =
      await response.json();

    setChatId(
      data.chat_id
    );

    return data.chat_id;
  };


  // =====================================================
  // UPLOAD PDF
  // =====================================================

  const uploadPDF = async (
    event
  ) => {

    const file =
      event.target.files[0];

    if (!file) return;

    if (
      !file.name
        .toLowerCase()
        .endsWith(".pdf")
    ) {

      alert(
        "Please select a PDF file."
      );

      event.target.value = "";

      return;
    }

    setUploading(true);

    try {

      // Make sure PDF belongs
      // to a user's chat

      const currentChatId =
        await ensureChat();

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      formData.append(
        "chat_id",
        currentChatId
      );

      const response =
        await fetch(
          `${API}/upload`,
          {
            method: "POST",

            headers:
              authHeaders(),

            body: formData
          }
        );

      const data =
        await response.json();

      if (!response.ok) {

        throw new Error(
          data.detail ||
          "Upload failed"
        );
      }

      setFileName(
        file.name
      );

      setMessages(
        (prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              `📄 **${file.name}** uploaded successfully!\n\n` +
              `I can now answer questions about this document.`
          }
        ]
      );

    } catch (error) {

      console.error(
        "PDF upload error:",
        error
      );

      alert(
        error.message ||
        "Could not upload the PDF."
      );

    } finally {

      setUploading(false);

      event.target.value = "";
    }
  };


  // =====================================================
  // STOP RESPONSE
  // =====================================================

  const stopResponse = () => {

    if (
      abortControllerRef.current
    ) {

      abortControllerRef.current.abort();
    }

    window.speechSynthesis?.cancel();

    setSpeakingMessage(null);

    setLoading(false);
  };


  // =====================================================
  // SEND MESSAGE
  // =====================================================

  const sendMessage = async () => {

    if (
      !message.trim() ||
      loading
    ) {

      return;
    }

    const userText =
      message.trim();

    const userMessage = {
      role: "user",
      content: userText
    };

    const updatedMessages = [
      ...messages,
      userMessage
    ];

    setMessages(
      updatedMessages
    );

    setMessage("");

    setLoading(true);

    const controller =
      new AbortController();

    abortControllerRef.current =
      controller;

    try {

      // -------------------------------------------------
      // CREATE CHAT
      // -------------------------------------------------

      const currentChatId =
        await ensureChat();

      // -------------------------------------------------
      // SAVE USER MESSAGE
      // -------------------------------------------------

      const saveResponse =
        await fetch(
          `${API}/chats/${currentChatId}/messages`,
          {
            method: "POST",

            headers: {
              ...authHeaders(),
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              role: "user",
              content: userText
            })
          }
        );

      if (!saveResponse.ok) {

        throw new Error(
          "Could not save message"
        );
      }

      // -------------------------------------------------
      // AUTO RENAME
      // -------------------------------------------------

      if (
        messages.length === 0
      ) {

        let title =
          userText
            .replace(
              /\s+/g,
              " "
            )
            .trim();

        if (
          title.length > 35
        ) {

          title =
            title.substring(
              0,
              35
            ) + "...";
        }

        await fetch(
          `${API}/chats/${currentChatId}`,
          {
            method: "PUT",

            headers: {
              ...authHeaders(),
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              title
            })
          }
        );
      }

      // -------------------------------------------------
      // EMPTY AI MESSAGE
      // -------------------------------------------------

      setMessages(
        (prev) => [
          ...prev,
          {
            role: "assistant",
            content: ""
          }
        ]
      );

      // -------------------------------------------------
      // ASK AI
      // -------------------------------------------------

      const response =
        await fetch(
          `${API}/chat`,
          {
            method: "POST",

            headers: {
              ...authHeaders(),
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              messages:
                updatedMessages
            }),

            signal:
              controller.signal
          }
        );

      if (!response.ok) {

        const data =
          await response
            .json()
            .catch(
              () => ({})
            );

        throw new Error(
          data.detail ||
          "AI server error"
        );
      }

      if (!response.body) {

        throw new Error(
          "No response body"
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let aiResponse = "";

      while (true) {

        const {
          value,
          done
        } =
          await reader.read();

        if (done) break;

        const chunk =
          decoder.decode(
            value,
            {
              stream: true
            }
          );

        aiResponse += chunk;

        setMessages(
          (prev) => {

            const copy =
              [...prev];

            copy[
              copy.length - 1
            ] = {
              role:
                "assistant",
              content:
                aiResponse
            };

            return copy;
          }
        );
      }

      // -------------------------------------------------
      // SAVE AI RESPONSE
      // -------------------------------------------------

      if (
        aiResponse.trim()
      ) {

        await fetch(
          `${API}/chats/${currentChatId}/messages`,
          {
            method: "POST",

            headers: {
              ...authHeaders(),
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              role:
                "assistant",
              content:
                aiResponse
            })
          }
        );
      }

      await loadChatHistory();

    } catch (error) {

      if (
        error.name ===
        "AbortError"
      ) {

        return;
      }

      console.error(
        "AI Error:",
        error
      );

      setMessages(
        (prev) => {

          const copy =
            [...prev];

          if (
            copy.length > 0 &&
            copy[
              copy.length - 1
            ].role ===
              "assistant"
          ) {

            copy[
              copy.length - 1
            ] = {
              role:
                "assistant",
              content:
                "Sorry, I couldn't connect to the AI server."
            };
          }

          return copy;
        }
      );

    } finally {

      setLoading(false);

      abortControllerRef.current =
        null;
    }
  };


  // =====================================================
  // OPEN CHAT
  // =====================================================

  const openChat = async (
    id
  ) => {

    try {

      const response =
        await fetch(
          `${API}/chats/${id}/messages`,
          {
            headers:
              authHeaders()
          }
        );

      if (
        response.status === 403 ||
        response.status === 401
      ) {

        alert(
          "You do not have access to this chat."
        );

        return;
      }

      if (!response.ok) {

        throw new Error(
          "Could not load conversation"
        );
      }

      const data =
        await response.json();

      setMessages(data);

      setChatId(id);

      setSpeakingMessage(null);

      window.speechSynthesis?.cancel();

      setSettingsOpen(false);

    } catch (error) {

      console.error(
        "Could not load conversation:",
        error
      );
    }
  };


  // =====================================================
  // COPY
  // =====================================================

  const copyMessage = async (
    text
  ) => {

    try {

      await navigator.clipboard.writeText(
        text
      );

    } catch (error) {

      console.error(
        "Copy failed:",
        error
      );
    }
  };


  // =====================================================
  // CLEAR CURRENT CHAT
  // =====================================================

  const clearCurrentChat = async () => {

    if (!chatId) {

      setMessages([]);

      setFileName("");

      return;
    }

    const confirmed =
      window.confirm(
        "Delete the current conversation permanently?"
      );

    if (!confirmed) return;

    try {

      const response =
        await fetch(
          `${API}/chats/${chatId}`,
          {
            method: "DELETE",
            headers:
              authHeaders()
          }
        );

      if (!response.ok) {

        throw new Error(
          "Could not delete chat"
        );
      }

      setMessages([]);

      setFileName("");

      setChatId(null);

      await loadChatHistory();

    } catch (error) {

      alert(
        "Could not delete this chat."
      );

      console.error(error);
    }

    setSettingsOpen(false);
  };


  // =====================================================
  // CLEAR ALL HISTORY
  // =====================================================

  const clearAllChats = async () => {

    const confirmed =
      window.confirm(
        "This will permanently delete your chat history. Continue?"
      );

    if (!confirmed) return;

    try {

      for (
        const chat of chatHistory
      ) {

        await fetch(
          `${API}/chats/${chat.id}`,
          {
            method: "DELETE",
            headers:
              authHeaders()
          }
        );
      }

      setChatHistory([]);

      setMessages([]);

      setChatId(null);

      setFileName("");

      setSettingsOpen(false);

      alert(
        "Your chat history has been deleted."
      );

    } catch (error) {

      console.error(
        "Could not clear chats:",
        error
      );

      alert(
        "Could not delete all chats."
      );
    }
  };


  // =====================================================
  // INITIALS
  // =====================================================

  const getInitials = () => {

    if (!user?.name) {

      return "U";
    }

    return user.name
      .split(" ")
      .map(
        (word) =>
          word[0]
      )
      .join("")
      .substring(
        0,
        2
      )
      .toUpperCase();
  };


  // =====================================================
  // LOGIN / REGISTER SCREEN
  // =====================================================

  if (!token || !user) {

    return (
      <div className="auth-screen">

        <div className="auth-card">

          <div className="auth-logo">
            ✦
          </div>

          <h1>
            Kash AI
          </h1>

          <p className="auth-subtitle">
            Your intelligent assistant
          </p>

          {authMode === "register" && (

            <input
              type="text"
              placeholder="Your name"
              value={authName}
              onChange={(e) =>
                setAuthName(
                  e.target.value
                )
              }
            />

          )}

          <input
            type="email"
            placeholder="Email"
            value={authEmail}
            onChange={(e) =>
              setAuthEmail(
                e.target.value
              )
            }
          />

          <input
            type="password"
            placeholder="Password"
            value={authPassword}
            onChange={(e) =>
              setAuthPassword(
                e.target.value
              )
            }
            onKeyDown={(e) => {

              if (
                e.key === "Enter"
              ) {

                authMode === "login"
                  ? login()
                  : register();
              }

            }}
          />

          {authError && (

            <div className="auth-error">
              {authError}
            </div>

          )}

          <button
            className="auth-button"
            onClick={
              authMode === "login"
                ? login
                : register
            }
            disabled={authLoading}
          >

            {authLoading
              ? "Please wait..."
              : authMode === "login"
              ? "Login"
              : "Create Account"}

          </button>

          <button
            className="auth-switch"
            onClick={() => {

              setAuthError("");

              setAuthMode(
                authMode === "login"
                  ? "register"
                  : "login"
              );

            }}
          >

            {authMode === "login"
              ? "Don't have an account? Create one"
              : "Already have an account? Login"}

          </button>

        </div>

      </div>
    );
  }


  // =====================================================
  // MAIN UI
  // =====================================================

  return (

    <div className="app">

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside className="sidebar">

        <div className="logo">

          <div className="logo-icon">
            ✦
          </div>

          <div>

            <div className="logo-name">
              Kash AI
            </div>

            <div className="logo-subtitle">
              Your intelligent assistant
            </div>

          </div>

        </div>


        {/* NEW CHAT */}

        <button
          className="new-chat"
          onClick={
            createNewChat
          }
        >

          <span className="plus-icon">
            ＋
          </span>

          <span>
            New Chat
          </span>

        </button>


        {/* HISTORY */}

        <div className="history">

          <p className="history-title">
            RECENT CHATS
          </p>

          {chatHistory.length === 0 ? (

            <div className="chat-item empty-history">
              No conversations yet
            </div>

          ) : (

            chatHistory.map(
              (chat) => (

                <div
                  key={chat.id}
                  className={
                    `chat-item ${
                      chat.id === chatId
                        ? "active-chat"
                        : ""
                    }`
                  }
                  onClick={() =>
                    openChat(
                      chat.id
                    )
                  }
                >

                  <span className="chat-icon">
                    💬
                  </span>

                  <span className="chat-title">
                    {chat.title}
                  </span>

                </div>

              )
            )

          )}

        </div>


        {/* SIDEBAR BOTTOM */}

        <div className="sidebar-bottom">

          <button
            className="sidebar-option"
            onClick={() =>
              setSettingsOpen(
                !settingsOpen
              )
            }
          >

            <span>
              ⚙️
            </span>

            <span>
              Settings
            </span>

          </button>


          {/* USER */}

          <div className="user-profile">

            <div className="user-avatar">
              {getInitials()}
            </div>

            <div className="user-details">

              <strong>
                {user.name}
              </strong>

              <span>
                {user.email}
              </span>

            </div>

          </div>

        </div>

      </aside>


      {/* =================================================
          MAIN
      ================================================= */}

      <main className="main">


        {/* HEADER */}

        <header className="header">

          <div className="header-title">

            <div className="header-logo">
              ✦
            </div>

            <div>

              <h2>
                Kash AI
              </h2>

              <span className="online-status">

                <span className="status-dot"></span>

                AI Assistant

              </span>

            </div>

          </div>

          <button
            className="header-settings"
            onClick={() =>
              setSettingsOpen(
                !settingsOpen
              )
            }
            title="Settings"
          >
            ⚙️
          </button>

        </header>


        {/* =================================================
            SETTINGS
        ================================================= */}

        {settingsOpen && (

          <div className="settings-panel">

            <div className="settings-header">

              <div>

                <h2>
                  Settings
                </h2>

                <p>
                  Customize your Kash AI experience
                </p>

              </div>

              <button
                className="close-settings"
                onClick={() =>
                  setSettingsOpen(
                    false
                  )
                }
              >
                ×
              </button>

            </div>


            {/* APPEARANCE */}

            <div className="setting-section">

              <h3>
                Appearance
              </h3>

              <div className="setting-row">

                <div className="setting-info">

                  <span className="setting-icon">
                    {darkMode
                      ? "🌙"
                      : "☀️"}
                  </span>

                  <div>

                    <strong>
                      Dark mode
                    </strong>

                    <p>
                      Change the appearance of Kash AI
                    </p>

                  </div>

                </div>

                <label className="switch">

                  <input
                    type="checkbox"
                    checked={darkMode}
                    onChange={(e) =>
                      setDarkMode(
                        e.target.checked
                      )
                    }
                  />

                  <span className="slider"></span>

                </label>

              </div>

            </div>


            {/* VOICE */}

            <div className="setting-section">

              <h3>
                Voice
              </h3>

              <div className="setting-row">

                <div className="setting-info">

                  <span className="setting-icon">
                    🎤
                  </span>

                  <div>

                    <strong>
                      Voice features
                    </strong>

                    <p>
                      Enable voice input and read aloud
                    </p>

                  </div>

                </div>

                <label className="switch">

                  <input
                    type="checkbox"
                    checked={
                      voiceEnabled
                    }
                    onChange={(e) =>
                      setVoiceEnabled(
                        e.target.checked
                      )
                    }
                  />

                  <span className="slider"></span>

                </label>

              </div>

            </div>


            {/* CHAT */}

            <div className="setting-section">

              <h3>
                Chat
              </h3>

              <button
                className="settings-action"
                onClick={
                  clearCurrentChat
                }
              >

                <span>
                  🗑️
                </span>

                <div>

                  <strong>
                    Delete current chat
                  </strong>

                  <small>
                    Permanently remove the current conversation
                  </small>

                </div>

              </button>


              <button
                className="settings-action danger"
                onClick={
                  clearAllChats
                }
              >

                <span>
                  🧹
                </span>

                <div>

                  <strong>
                    Delete all chats
                  </strong>

                  <small>
                    Permanently remove your chat history
                  </small>

                </div>

              </button>

            </div>


            {/* ACCOUNT */}

            <div className="setting-section">

              <h3>
                Account
              </h3>

              <div className="account-card">

                <div className="account-avatar">
                  {getInitials()}
                </div>

                <div>

                  <strong>
                    {user.name}
                  </strong>

                  <span>
                    {user.email}
                  </span>

                </div>

              </div>

              <button
                className="logout-button"
                onClick={() =>
                  logout(true)
                }
              >
                🚪 Logout
              </button>

            </div>


            {/* ABOUT */}

            <div className="setting-section">

              <button
                className="about-button"
                onClick={() =>
                  setShowAbout(
                    true
                  )
                }
              >

                <span>
                  ℹ️
                </span>

                About Kash AI

              </button>

            </div>

          </div>

        )}


        {/* =================================================
            CHAT AREA
        ================================================= */}

        <section className="chat-area">

          {messages.length === 0 ? (

            <div className="welcome">

              <div className="welcome-logo">
                ✦
              </div>

              <h1>
                How can I help you?
              </h1>

              <p>
                Ask me anything, upload a PDF,
                or use your voice.
              </p>

              <div className="suggestions">

                <button
                  onClick={() =>
                    setMessage(
                      "Explain artificial intelligence in simple words"
                    )
                  }
                >
                  💡 Explain something
                </button>

                <button
                  onClick={() =>
                    setMessage(
                      "Help me write a program"
                    )
                  }
                >
                  💻 Write code
                </button>

                <button
                  onClick={() =>
                    setMessage(
                      "Give me some creative ideas"
                    )
                  }
                >
                  ✨ Get ideas
                </button>

              </div>

            </div>

          ) : (

            <div className="messages">

              {messages.map(
                (msg, index) => (

                  <div
                    key={index}
                    className={
                      `message ${msg.role}`
                    }
                  >

                    <div className="avatar">

                      {msg.role === "user"
                        ? getInitials()
                        : "✦"}

                    </div>

                    <div className="message-wrapper">

                      <div className="message-name">

                        {msg.role === "user"
                          ? user.name
                          : "Kash AI"}

                      </div>

                      <div className="message-content">

                        {msg.role === "assistant" ? (

                          <ReactMarkdown>
                            {msg.content}
                          </ReactMarkdown>

                        ) : (

                          msg.content

                        )}

                      </div>


                      {msg.role ===
                        "assistant" &&
                        msg.content && (

                          <div className="message-actions">

                            <button
                              className="action-button"
                              onClick={() =>
                                copyMessage(
                                  msg.content
                                )
                              }
                              title="Copy"
                            >
                              📋
                            </button>


                            {voiceEnabled && (

                              <button
                                className="action-button"
                                onClick={() =>
                                  speakText(
                                    msg.content,
                                    index
                                  )
                                }
                                title={
                                  speakingMessage ===
                                  index
                                    ? "Stop speaking"
                                    : "Read aloud"
                                }
                              >

                                {speakingMessage ===
                                index
                                  ? "⏹"
                                  : "🔊"}

                              </button>

                            )}

                          </div>

                        )}


                      {loading &&
                        index ===
                          messages.length - 1 &&
                        msg.role ===
                          "assistant" && (

                          <span className="cursor">
                            ▌
                          </span>

                        )}

                    </div>

                  </div>

                )
              )}

              <div
                ref={
                  messagesEndRef
                }
              />

            </div>

          )}

        </section>


        {/* =================================================
            INPUT
        ================================================= */}

        <div className="input-container">

          {fileName && (

            <div className="file-indicator">

              📄

              <span>
                {fileName}
              </span>

              <button
                onClick={() =>
                  setFileName("")
                }
              >
                ×
              </button>

            </div>

          )}


          <div className="input-box">


            {/* PDF */}

            <label
              className="upload-button"
              title="Upload PDF"
            >

              📎

              <input
                type="file"
                accept=".pdf"
                onChange={
                  uploadPDF
                }
                disabled={
                  uploading ||
                  loading
                }
                hidden
              />

            </label>


            {/* INPUT */}

            <input
              type="text"
              placeholder={
                uploading
                  ? "Uploading PDF..."
                  : isListening
                  ? "Listening..."
                  : "Message Kash AI..."
              }
              value={message}
              onChange={(e) =>
                setMessage(
                  e.target.value
                )
              }
              onKeyDown={(e) => {

                if (
                  e.key === "Enter" &&
                  !e.shiftKey
                ) {

                  e.preventDefault();

                  sendMessage();
                }

              }}
              disabled={uploading}
            />


            {/* VOICE */}

            {voiceEnabled && (

              <button
                className={
                  `voice-button ${
                    isListening
                      ? "listening"
                      : ""
                  }`
                }
                onClick={
                  toggleVoice
                }
                disabled={
                  uploading ||
                  loading
                }
                title={
                  isListening
                    ? "Stop listening"
                    : "Voice input"
                }
              >

                {isListening
                  ? "🔴"
                  : "🎤"}

              </button>

            )}


            {/* SEND */}

            <button
              className="send-button"
              onClick={
                loading
                  ? stopResponse
                  : sendMessage
              }
              disabled={
                uploading
              }
              title={
                loading
                  ? "Stop"
                  : "Send"
              }
            >

              {loading
                ? "⏹"
                : "➤"}

            </button>

          </div>


          <p className="disclaimer">
            Kash AI can make mistakes.
            Check important information.
          </p>

        </div>

      </main>


      {/* =================================================
          ABOUT MODAL
      ================================================= */}

      {showAbout && (

        <div
          className="modal-overlay"
          onClick={() =>
            setShowAbout(
              false
            )
          }
        >

          <div
            className="about-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <button
              className="modal-close"
              onClick={() =>
                setShowAbout(
                  false
                )
              }
            >
              ×
            </button>

            <div className="about-logo">
              ✦
            </div>

            <h2>
              Kash AI
            </h2>

            <p className="version">
              Your intelligent assistant
            </p>

            <p>
              Kash AI is a personal AI assistant
              designed to help you understand,
              create, learn and work smarter.
            </p>

            <div className="about-features">

              <span>
                ✦ AI Chat
              </span>

              <span>
                📄 PDF Intelligence
              </span>

              <span>
                🎤 Voice
              </span>

              <span>
                🔐 Secure Accounts
              </span>

            </div>

            <p className="copyright">
              Built with ❤️ using React,
              FastAPI and AI.
            </p>

          </div>

        </div>

      )}

    </div>
  );
}

export default App;