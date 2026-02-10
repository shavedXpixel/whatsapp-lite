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
      "https://whatsapp-lite.vercel.app",
      "https://whatsapp-lite.vercel.app/"   
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

  // ✅ NEW: HANDLE EXPLICIT LEAVE (Navigation)
  socket.on("leave_room", (room) => {
      const user = userMap[socket.id];
      if (user) {
          // 1. Notify others
          socket.to(room).emit("receive_message", {
              author: "System",
              message: `${user.username} has left the chat`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });

          // 2. Remove from userMap
          delete userMap[socket.id];

          // 3. Update the list for everyone else
          io.to(room).emit("update_user_list", getUsersInRoom(room));
          
          // 4. Actually leave the socket channel
          socket.leave(room);
      }
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

  // 📞 CALLING EVENTS
  socket.on("callUser", ({ userToCall, signalData, from, name, callType }) => {
      io.to(userToCall).emit("callUser", { signal: signalData, from, name, callType });
  });

  socket.on("answerCall", (data) => {
      io.to(data.to).emit("callAccepted", data.signal);
  });

  socket.on("endCall", ({ to }) => {
      io.to(to).emit("callEnded");
  });

  // ❌ HANDLE TAB CLOSE / DISCONNECT
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