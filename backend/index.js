const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

// 🆕 HEALTH CHECK ROUTE (The "Wake Up" Page)
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>WhatsApp Backend</title>
        <style>
          body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #0f172a; color: white; margin: 0; }
          .container { text-align: center; padding: 2rem; border: 1px solid #334155; border-radius: 10px; background: #1e293b; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .status { color: #4ade80; font-weight: bold; font-size: 1.5rem; display: flex; align-items: center; justify-content: center; gap: 10px; }
          .dot { width: 15px; height: 15px; background: #4ade80; border-radius: 50%; box-shadow: 0 0 10px #4ade80; }
          p { color: #94a3b8; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="status"><div class="dot"></div> Server is Running</div>
          <h1>WhatsApp Lite Backend 🚀</h1>
          <p>Socket.io is ready to accept connections.</p>
          <p>Last checked: ${new Date().toLocaleString()}</p>
        </div>
      </body>
    </html>
  `);
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",              // Localhost
      "https://whatsapp-lite.vercel.app",   // Vercel (No slash)
      "https://whatsapp-lite.vercel.app/"   // Vercel (With slash)
    ],
    methods: ["GET", "POST"],
  },
});

const userMap = {}; 

function getUsersInRoom(room) {
  const users = [];
  for (let socketId in userMap) {
    if (userMap[socketId].room === room) {
      users.push(userMap[socketId].username);
    }
  }
  return [...new Set(users)];
}

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("join_room", (data) => {
    const { username, room } = data;
    socket.join(room);
    userMap[socket.id] = { username, room };

    socket.to(room).emit("receive_message", {
      author: "System",
      message: `${username} has joined the chat`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    io.to(room).emit("update_user_list", getUsersInRoom(room));
  });

  socket.on("typing", (data) => {
    socket.to(data.room).emit("display_typing", data.username);
  });

  socket.on("stop_typing", (room) => {
    socket.to(room).emit("hide_typing");
  });

  socket.on("send_message", (data) => {
    socket.to(data.room).emit("receive_message", data);
  });

  // MESSAGE STATUS UPDATES (Blue Ticks)
  socket.on("message_status_update", (data) => {
    socket.to(data.room).emit("message_status_updated", data);
  });

  // 📞 CALLING EVENTS (WebRTC Signaling) 📞
  // 1. Caller initiates call
  socket.on("callUser", ({ userToCall, signalData, from, name }) => {
      // userToCall is actually the 'roomId' in our app, so we broadcast to that room
      socket.to(userToCall).emit("callUser", { signal: signalData, from, name });
  });

  // 2. Receiver answers call
  socket.on("answerCall", (data) => {
      // data.to is the roomId
      socket.to(data.to).emit("callAccepted", data.signal);
  });

  // 3. Either party ends call
  socket.on("endCall", ({ to }) => {
      socket.to(to).emit("callEnded");
  });

  socket.on("disconnect", () => {
    const user = userMap[socket.id];
    if (user) {
      socket.to(user.room).emit("receive_message", {
        author: "System",
        message: `${user.username} has left the chat`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      
      delete userMap[socket.id];
      io.to(user.room).emit("update_user_list", getUsersInRoom(user.room));
    }
  });
});

server.listen(3001, () => {
  console.log("SERVER RUNNING");
});