require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PASSKEY = process.env.PASSKEY || "secure123"; // Change this for security!

let messages = [];
let users = {}; // Store connected users

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Secure Group Chat Backend is Running!");
});

io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("authenticate", ({ passkey, username }) => {
        if (passkey !== PASSKEY) {
            socket.emit("auth_error", "Invalid passkey");
            return socket.disconnect();
        }

        users[socket.id] = username;
        io.emit("user_list", Object.values(users));
        socket.emit("chat_history", messages);
    });

    socket.on("send_message", (msg) => {
        const user = users[socket.id] || "Anonymous";
        const messageData = { user, text: msg.text };

        messages.push(messageData);
        io.emit("receive_message", messageData);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
        delete users[socket.id];
        io.emit("user_list", Object.values(users));
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
