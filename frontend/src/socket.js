import io from "socket.io-client";

// YOUR BACKEND URL
const SOCKET_URL = "https://atomic-kay-shavedxpixel-924084a9.koyeb.app"; 

export const socket = io.connect(SOCKET_URL, {
    transports: ["websocket"], // ⚡⚡ FORCE FAST CONNECTION (No Polling)
    withCredentials: true,
    reconnectionAttempts: 5,   // Keep trying if internet fails
});