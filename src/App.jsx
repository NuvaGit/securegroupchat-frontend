import { useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import "./style.css"; 

const socket = io("https://securegroupchat-backend.onrender.com");

const PRESET_PASSKEY = "secure123";

function App() {
  const [passkey, setPasskey] = useState("");
  const [username, setUsername] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [recipient, setRecipient] = useState("All");
  const [typingUser, setTypingUser] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket.on("chat_history", (msgs) => setMessages(msgs));
    socket.on("receive_message", (msg) => setMessages((prev) => [...prev, msg]));
    socket.on("user_list", (users) => setOnlineUsers(users));
    socket.on("user_typing", ({ user, isTyping }) => {
      setTypingUser(isTyping ? user : null);
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passkey !== PRESET_PASSKEY) {
      alert("Incorrect passkey!");
      return;
    }
    if (!username.trim()) {
      alert("Enter a username.");
      return;
    }
    localStorage.setItem("username", username);
    socket.emit("authenticate", { passkey, username });
    setIsAuthenticated(true);
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    socket.emit("send_message", { user: username, text: newMessage, recipient });
    setNewMessage("");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("https://securegroupchat-backend.onrender.com/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    socket.emit("send_message", { user: username, fileUrl: data.fileUrl, fileType: data.fileType, recipient });
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    socket.emit("typing", { isTyping: e.target.value.length > 0 });
  };

  return (
    <div className="app-container">
      {!isAuthenticated ? (
        <div className="login-container">
          <h1>Secure Group Chat</h1>
          <form className="login-box" onSubmit={handleLogin}>
            <input type="text" placeholder="Username" onChange={(e) => setUsername(e.target.value)} required />
            <input type="password" placeholder="Passkey" onChange={(e) => setPasskey(e.target.value)} required />
            <button type="submit">Enter Chat</button>
          </form>
        </div>
      ) : (
        <div className="chat-wrapper">
          <div className="sidebar">
            <h2>The Jizzlers 2.0</h2>
            <h3>Online Users</h3>
            <ul>
              <li onClick={() => setRecipient("All")} className={recipient === "All" ? "selected" : ""}>Group Chat</li>
              {onlineUsers.map((user, index) => (
                user !== username && (
                  <li key={index} onClick={() => setRecipient(user)} className={recipient === user ? "selected" : ""}>
                    {user}
                  </li>
                )
              ))}
            </ul>
          </div>

          <div className="chat-container">
            <h2>{recipient === "All" ? "Group Chat" : `Chat with ${recipient}`}</h2>
            {typingUser && <p className="typing-indicator">{typingUser} is typing...</p>}
            <div className="messages">
              {messages.map((msg, index) => (
                <div key={index} className={`message ${msg.user === username ? "my-message" : ""}`}>
                  <strong>{msg.user}:</strong> {msg.text}
                  {msg.fileUrl && <a href={msg.fileUrl} target="_blank">📂 Download File</a>}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="message-input">
              <input type="text" value={newMessage} onChange={handleTyping} />
              <input type="file" onChange={handleFileUpload} />
              <button onClick={sendMessage}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
