const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const userMap = {}; // Tracks { socketId: { username, room } }

// 🆕 Helper: Get all users in a specific room
function getUsersInRoom(room) {
  const users = [];
  for (let socketId in userMap) {
    if (userMap[socketId].room === room) {
      users.push(userMap[socketId].username);
    }
  }
  // Remove duplicates (optional, but good if user opens 2 tabs)
  return [...new Set(users)];
}

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("join_room", (data) => {
    const { username, room } = data;
    socket.join(room);
    
    userMap[socket.id] = { username, room };

    // 1. Notify others
    socket.to(room).emit("receive_message", {
      author: "System",
      message: `${username} has joined the chat`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    // 🆕 2. Send updated user list to EVERYONE in the room
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

  socket.on("disconnect", () => {
    const user = userMap[socket.id];
    
    if (user) {
      socket.to(user.room).emit("receive_message", {
        author: "System",
        message: `${user.username} has left the chat`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      
      delete userMap[socket.id];

      // 🆕 3. Update user list after removal
      io.to(user.room).emit("update_user_list", getUsersInRoom(user.room));
    }
  });
});

server.listen(3001, () => {
  console.log("SERVER RUNNING");
});