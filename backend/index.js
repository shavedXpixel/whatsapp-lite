const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

// 🆕 HEALTH CHECK ROUTE
app.get("/", (req, res) => {
  res.send("WhatsApp Backend Running 🚀");
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

  // ✅ 1. CRITICAL FIX: Setup Private User Channel
  // This allows us to call a specific person by their UID
  socket.on("setup", (userData) => {
    socket.join(userData.uid); 
    console.log(`User ${userData.uid} joined their private channel`);
    socket.emit("connected");
  });

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

  socket.on("message_status_update", (data) => {
    socket.to(data.room).emit("message_status_updated", data);
  });

  // 📞 CALLING EVENTS (Fixed for Private Calling) 📞
  
  // 1. Caller initiates call
  socket.on("callUser", ({ userToCall, signalData, from, name }) => {
      // ✅ FIX: Use 'io.to' to send to the specific User ID channel
      io.to(userToCall).emit("callUser", { signal: signalData, from, name });
  });

  // 2. Receiver answers call
  socket.on("answerCall", (data) => {
      // ✅ FIX: Send answer back to the Caller's ID
      io.to(data.to).emit("callAccepted", data.signal);
  });

  // 3. Either party ends call
  socket.on("endCall", ({ to }) => {
      io.to(to).emit("callEnded");
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