import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import {
  FaPaperclip,
  FaSmile,
  FaRegThumbsUp,
  FaTrashAlt,
  FaEdit,
  FaMicrophone,
  FaVideo,
  FaThumbtack,
  FaMoon,
  FaSun,
} from "react-icons/fa";
import "./style.css";

// Connect to the backend (assumed to support all these events)
const socket = io("https://securegroupchat-backend.onrender.com");

// Allowed users and preset passkey for demo purposes
const ALLOWED_USERS = ["Jack", "Ore", "Caius", "Jonah", "Alice"];
const PRESET_PASSKEY = "secure123";

// Helper function to format timestamps using built-in methods
const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
         ", " +
         date.toLocaleDateString();
};

function App() {
  // --- Login / Profile States ---
  const [passkey, setPasskey] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [otp, setOtp] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // --- Chat & App States ---
  const [messages, setMessages] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [recipient, setRecipient] = useState("All");
  const [room, setRoom] = useState("General");
  const [typingUser, setTypingUser] = useState(null);
  const [reactionPalette, setReactionPalette] = useState({}); // { messageId: boolean }
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [theme, setTheme] = useState("light");
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  const messagesEndRef = useRef(null);

  // --- Push Notifications: Request permission on mount ---
  useEffect(() => {
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  // --- Socket Listeners ---
  useEffect(() => {
    socket.on("chat_history", (msgs) => setMessages(msgs));
    socket.on("receive_message", (msg) => {
      setMessages((prev) => [...prev, msg]);
      // Show a push notification if the window is not focused
      if (document.hidden && Notification.permission === "granted") {
        new Notification(`New message from ${msg.user}`, { body: msg.text });
      }
    });
    socket.on("reaction_update", ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          (msg._id || msg.timestamp) === messageId ? { ...msg, reactions } : msg
        )
      );
    });
    socket.on("edit_message", ({ messageId, newText }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, text: newText } : msg
        )
      );
    });
    socket.on("delete_message", (messageId) => {
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    });
    socket.on("pin_message", (message) => {
      setPinnedMessages((prev) => [...prev, message]);
    });
    socket.on("user_list", (users) => setOnlineUsers(users));
    socket.on("user_typing", ({ user, isTyping }) => {
      setTypingUser(isTyping ? user : null);
    });
    // When joining a room, the backend may send a room-specific history:
    socket.on("room_history", (msgs) => setMessages(msgs));
  }, []);

  // Scroll to latest message when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pinnedMessages]);

  // Update document theme attribute when theme state changes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // --- Login Handler (with demo 2FA OTP) ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (passkey !== PRESET_PASSKEY) {
      alert("Incorrect passkey!");
      return;
    }
    if (!username.trim() || !ALLOWED_USERS.includes(username)) {
      alert("Invalid username!");
      return;
    }
    // For demo, require OTP to be "123456"
    if (otp !== "123456") {
      alert("Invalid OTP!");
      return;
    }
    // Save profile info locally if needed
    localStorage.setItem("username", username);
    localStorage.setItem("avatarUrl", avatarUrl);
    socket.emit("authenticate", { passkey, username, avatarUrl, room });
    setIsAuthenticated(true);
  };

  // --- Sending a Message ---
  const sendMessage = () => {
    if (!newMessage.trim()) return;
    socket.emit("send_message", {
      user: username,
      avatarUrl,
      text: newMessage,
      recipient,
      room,
      timestamp: new Date(),
    });
    setNewMessage("");
  };

  // --- File Upload Handler ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(
      "https://securegroupchat-backend.onrender.com/upload",
      {
        method: "POST",
        body: formData,
      }
    );
    const data = await response.json();
    socket.emit("send_message", {
      user: username,
      avatarUrl,
      fileUrl: data.fileUrl,
      fileType: data.fileType,
      recipient,
      room,
      timestamp: new Date(),
    });
  };

  // --- Typing Handler ---
  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    socket.emit("typing", { isTyping: e.target.value.length > 0 });
  };

  // --- Reaction Palette ---
  const toggleReactionPalette = (messageId) => {
    setReactionPalette((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const sendReaction = (messageId, emoji) => {
    socket.emit("send_reaction", {
      messageId,
      reaction: { emoji, user: username },
    });
    setReactionPalette((prev) => ({ ...prev, [messageId]: false }));
  };

  const reactionOptions = ["👍", "❤️", "😂", "😮", "😢", "👏"];

  // --- Clear Feed ---
  const clearFeed = () => {
    setMessages([]);
    setPinnedMessages([]);
  };

  // --- Editing a Message ---
  const handleEdit = (messageId, currentText) => {
    setEditingMessageId(messageId);
    setEditingText(currentText);
  };

  const submitEdit = (messageId) => {
    socket.emit("edit_message", { messageId, newText: editingText });
    setEditingMessageId(null);
    setEditingText("");
  };

  // --- Deleting a Message ---
  const handleDelete = (messageId) => {
    socket.emit("delete_message", messageId);
  };

  // --- Pin a Message ---
  const handlePin = (message) => {
    socket.emit("pin_message", message);
  };

  // --- Search Handler ---
  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  // Filter messages by search query (if provided)
  const filteredMessages = messages.filter(
    (msg) =>
      msg.text &&
      msg.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Room Joining ---
  const joinRoom = (roomName) => {
    setRoom(roomName);
    socket.emit("join_room", roomName);
    setMessages([]);
  };

  // --- Voice Message Recording ---
  const startRecording = async () => {
    if (!navigator.mediaDevices) {
      alert("Audio recording not supported");
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    let chunks = [];
    recorder.ondataavailable = (e) => {
      chunks.push(e.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      chunks = [];
      // Upload audio blob as file
      const formData = new FormData();
      formData.append("file", blob, "audio_message.webm");
      const response = await fetch(
        "https://securegroupchat-backend.onrender.com/upload",
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await response.json();
      socket.emit("send_message", {
        user: username,
        avatarUrl,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        recipient,
        room,
        timestamp: new Date(),
      });
      setRecording(false);
    };
    recorder.start();
    setMediaRecorder(recorder);
    setRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
    }
  };

  // --- Theme Toggle ---
  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <div className="app-container">
      {!isAuthenticated ? (
        <div className="login-container">
          <h1>Secure Group Chat</h1>
          <form className="login-box" onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Username"
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Passkey"
              onChange={(e) => setPasskey(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Avatar URL (optional)"
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
            <input
              type="text"
              placeholder="Enter OTP (demo: 123456)"
              onChange={(e) => setOtp(e.target.value)}
              required
            />
            <button type="submit">Enter Chat</button>
          </form>
          <p className="allowed-accounts">
            Allowed accounts: {ALLOWED_USERS.join(", ")}
          </p>
        </div>
      ) : (
        <div className="chat-wrapper">
          <div className="sidebar">
            <div className="sidebar-header">
              <h2>Rooms</h2>
              <button
                onClick={() => joinRoom("General")}
                className={room === "General" ? "selected" : ""}
              >
                General
              </button>
              <button
                onClick={() => joinRoom("Random")}
                className={room === "Random" ? "selected" : ""}
              >
                Random
              </button>
              <button
                onClick={() => joinRoom("Tech")}
                className={room === "Tech" ? "selected" : ""}
              >
                Tech
              </button>
            </div>
            <h3>Online Users</h3>
            <ul>
              <li
                onClick={() => setRecipient("All")}
                className={recipient === "All" ? "selected" : ""}
              >
                Group Chat
              </li>
              {onlineUsers.map(
                (user, index) =>
                  user !== username && (
                    <li
                      key={index}
                      onClick={() => setRecipient(user)}
                      className={recipient === user ? "selected" : ""}
                    >
                      {user} <span className="online-dot"></span>
                    </li>
                  )
              )}
            </ul>
            <button className="clear-feed-btn" onClick={clearFeed}>
              <FaTrashAlt /> Clear Feed
            </button>
            <div className="theme-toggle">
              <button onClick={toggleTheme}>
                {theme === "light" ? <FaMoon /> : <FaSun />}
              </button>
            </div>
          </div>

          <div className="chat-container">
            <div className="chat-header">
              <div className="header-info">
                <h2>
                  {recipient === "All"
                    ? "Group Chat"
                    : `Chat with ${recipient}`}{" "}
                  - Room: {room}
                </h2>
                {typingUser && (
                  <p className="typing-indicator">
                    {typingUser} is typing...
                  </p>
                )}
              </div>
              <div className="search-bar">
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={handleSearch}
                />
              </div>
            </div>
            {pinnedMessages.length > 0 && (
              <div className="pinned-messages">
                <h4>Pinned Messages</h4>
                {pinnedMessages.map((msg) => (
                  <div
                    key={msg._id || msg.timestamp}
                    className="pinned-message"
                  >
                    <strong>{msg.user}</strong>: {msg.text}
                  </div>
                ))}
              </div>
            )}
            <div className="messages">
              {filteredMessages.map((msg) => {
                const key = msg._id || msg.timestamp;
                return (
                  <div
                    key={key}
                    className={`message ${
                      msg.user === username ? "my-message" : ""
                    }`}
                  >
                    <div className="message-header">
                      <div className="avatar">
                        {msg.avatarUrl ? (
                          <img src={msg.avatarUrl} alt="avatar" />
                        ) : (
                          <span>{msg.user.charAt(0)}</span>
                        )}
                      </div>
                      <div className="meta">
                        <strong>{msg.user}</strong>
                        <span className="timestamp">
                          {formatTimestamp(msg.timestamp)}
                        </span>
                      </div>
                      <div className="actions">
                        {msg.user === username && (
                          <>
                            <button onClick={() => handleEdit(key, msg.text)}>
                              <FaEdit />
                            </button>
                            <button onClick={() => handleDelete(key)}>
                              <FaTrashAlt />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handlePin(msg)}
                          title="Pin message"
                        >
                          <FaThumbtack />
                        </button>
                        <button
                          className="reaction-btn"
                          onClick={() => toggleReactionPalette(key)}
                        >
                          <FaSmile />
                        </button>
                        {reactionPalette[key] && (
                          <div className="reaction-palette">
                            {reactionOptions.map((emoji, idx) => (
                              <span
                                key={idx}
                                onClick={() => sendReaction(key, emoji)}
                              >
                                {emoji}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="message-content">
                      {editingMessageId === key ? (
                        <div className="edit-container">
                          <input
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                          />
                          <button onClick={() => submitEdit(key)}>Save</button>
                        </div>
                      ) : (
                        <>
                          {msg.text && <span>{msg.text}</span>}
                          {msg.fileUrl &&
                            (msg.fileType &&
                            msg.fileType.startsWith("image/")
                              ? (
                                <img
                                  src={msg.fileUrl}
                                  alt="uploaded"
                                  className="media-preview"
                                />
                              )
                              : (
                                <a
                                  href={msg.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <FaPaperclip /> Download File
                                </a>
                              ))}
                        </>
                      )}
                    </div>
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="reactions">
                        {msg.reactions.map((r, idx) => (
                          <span key={idx} title={r.user}>
                            {r.emoji}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef}></div>
            </div>
            <div className="message-input">
              <label className="file-upload">
                <FaPaperclip />
                <input type="file" onChange={handleFileUpload} />
              </label>
              <input
                type="text"
                placeholder="Type your message..."
                value={newMessage}
                onChange={handleTyping}
              />
              <button onClick={sendMessage}>
                <FaRegThumbsUp />
              </button>
              <button onClick={recording ? stopRecording : startRecording}>
                <FaMicrophone />
              </button>
            </div>
            <div className="voice-video">
              <button>
                <FaVideo /> Video Call (Coming Soon)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
