import io from "socket.io-client";

// REPLACE WITH YOUR RENDER BACKEND URL
const SOCKET_URL = "https://whatsapp-backend-xv12.onrender.com"; 

export const socket = io.connect(SOCKET_URL);