import { useEffect, useState } from "react";
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
  const [typingUser, setTypingUser] = useState("");

  useEffect(() => {
    socket.on("chat_history", (msgs) => setMessages(msgs));
    socket.on("receive_message", (msg) => setMessages((prev) => [...prev, msg]));
    socket.on("auth_error", () => alert("Invalid Passkey!"));

    socket.on("user_typing", (user) => setTypingUser(user));
    socket.on("user_stopped_typing", () => setTypingUser(""));
  }, []);

  const handleLogin = () => {
    if (passkey !== PRESET_PASSKEY) {
      alert("Incorrect passkey! Try again.");
      return;
    }
    if (!username.trim()) {
      alert("Please enter a username.");
      return;
    }
    localStorage.setItem("username", username);
    socket.emit("authenticate", { passkey, username });
    setIsAuthenticated(true);
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    socket.emit("send_message", { user: username, text: newMessage });
    setNewMessage("");
    socket.emit("user_stopped_typing");
  };

  const handleTyping = () => {
    socket.emit("user_typing", username);
    setTimeout(() => socket.emit("user_stopped_typing"), 2000);
  };

  return (
    <div className="app-container">
      {!isAuthenticated ? (
        <div className="login-container">
          <h2>Secure Group Chat</h2>
          <input type="text" placeholder="Enter Username" onChange={(e) => setUsername(e.target.value)} />
          <input type="password" placeholder="Enter Passkey" onChange={(e) => setPasskey(e.target.value)} />
          <button onClick={handleLogin}>Enter Chat</button>
        </div>
      ) : (
        <div className="chat-container">
          <h2>Welcome, {username}!</h2>
          <div className="messages">
            {messages.map((msg, index) => (
              <div key={index} className="message">
                <strong>{msg.user}:</strong> {msg.text}
              </div>
            ))}
          </div>
          {typingUser && <p className="typing-indicator">{typingUser} is typing...</p>}
          <div className="message-input">
            <input type="text" value={newMessage} placeholder="Type a message..." onChange={(e) => setNewMessage(e.target.value)} onKeyPress={handleTyping} />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
