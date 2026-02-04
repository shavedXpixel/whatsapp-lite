import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EmojiPicker from "emoji-picker-react";
import { storage, db } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

// ✅ PREMIUM TICK COMPONENT
const MessageStatus = ({ status, isMyMessage }) => {
  if (!isMyMessage) return null;
  if (status === "sent") return <span className="text-white/50 text-[10px] ml-1">✓</span>;
  if (status === "delivered") return <span className="text-white/50 text-[10px] ml-1">✓✓</span>;
  if (status === "read") return <span className="text-cyan-300 text-[10px] ml-1 drop-shadow-[0_0_2px_rgba(103,232,249,0.8)]">✓✓</span>;
  return <span className="text-white/50 text-[10px] ml-1">✓</span>; 
};

function Chat({ userData, socket }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const isDirectMessage = roomId.includes("_");

  const [currentMessage, setCurrentMessage] = useState("");
  const [messageList, setMessageList] = useState([]);
  const [userList, setUserList] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [typingUser, setTypingUser] = useState("");
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // 1. JOIN ROOM
  useEffect(() => {
    if (userData && roomId) {
       const joinRoom = () => {
          socket.emit("join_room", { room: roomId, username: userData.realName, photo: userData.photoURL });
       };
       joinRoom();
       socket.on("connect", joinRoom);

       const savedMessages = localStorage.getItem(`chat_${roomId}`);
       if (savedMessages) setMessageList(JSON.parse(savedMessages));

       return () => {
          socket.off("connect", joinRoom);
       };
    }
  }, [roomId, userData, socket]);

  // 2. SOCKET LISTENERS
  useEffect(() => {
    const handleReceiveMessage = (data) => {
      setMessageList((list) => {
        if (data.author !== userData.realName) {
            socket.emit("message_status_update", { room: roomId, messageId: data.id, status: "delivered" });
        }
        const newList = [...list, data];
        localStorage.setItem(`chat_${roomId}`, JSON.stringify(newList)); 
        return newList;
      });
    };

    const handleStatusUpdate = (data) => {
        setMessageList((list) => {
            const newList = list.map((msg) => {
                if (msg.id === data.messageId) {
                    return { ...msg, status: data.status };
                }
                return msg;
            });
            localStorage.setItem(`chat_${roomId}`, JSON.stringify(newList));
            return newList;
        });
    };

    const handleUserList = (users) => setUserList(users);
    const handleDisplayTyping = (user) => setTypingUser(user);
    const handleHideTyping = () => setTypingUser("");

    socket.on("receive_message", handleReceiveMessage);
    socket.on("message_status_updated", handleStatusUpdate); 
    socket.on("update_user_list", handleUserList);
    socket.on("display_typing", handleDisplayTyping);
    socket.on("hide_typing", handleHideTyping);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("message_status_updated", handleStatusUpdate);
      socket.off("update_user_list", handleUserList);
      socket.off("display_typing", handleDisplayTyping);
      socket.off("hide_typing", handleHideTyping);
    };
  }, [socket, roomId, userData]);

  // 3. AUTO SCROLL
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageList, typingUser, uploading, isRecording]);

  // 4. MARK READ
  useEffect(() => {
    const markRead = () => {
        if (document.visibilityState === 'visible') {
            messageList.forEach(msg => {
                if (msg.author !== userData.realName && msg.status !== "read") {
                    socket.emit("message_status_update", { room: roomId, messageId: msg.id, status: "read" });
                }
            });
        }
    };
    markRead();
    window.addEventListener("focus", markRead);
    return () => window.removeEventListener("focus", markRead);
  }, [messageList, roomId, userData, socket]);


  // HELPER: UPDATE RECENT CHATS LIST
  const updateRecentChats = async (msgType, msgContent) => {
    if (!isDirectMessage) return;
    const ids = roomId.split("_");
    const otherUid = ids[0] === userData.uid ? ids[1] : ids[0];
    const lastMessageText = msgType === "text" ? msgContent : `📷 Sent a ${msgType}`;

    try {
        const myChatRef = doc(db, "userChats", userData.uid);
        const myChatSnap = await getDoc(myChatRef);

        if (!myChatSnap.exists() || !myChatSnap.data()[roomId]) {
            const otherUserSnap = await getDoc(doc(db, "users", otherUid));
            const otherUserData = otherUserSnap.exists() ? otherUserSnap.data() : { realName: "User", photoURL: "" };
            
            await setDoc(myChatRef, {
                [roomId]: {
                    userInfo: { uid: otherUid, displayName: otherUserData.realName, photoURL: otherUserData.photoURL },
                    lastMessage: lastMessageText,
                    date: serverTimestamp()
                }
            }, { merge: true });
        } else {
             await updateDoc(myChatRef, {
                [`${roomId}.lastMessage`]: lastMessageText,
                [`${roomId}.date`]: serverTimestamp()
            });
        }

        const theirChatRef = doc(db, "userChats", otherUid);
        const theirChatSnap = await getDoc(theirChatRef);
        
        if (!theirChatSnap.exists() || !theirChatSnap.data()[roomId]) {
             await setDoc(theirChatRef, {
                [roomId]: {
                    userInfo: { uid: userData.uid, displayName: userData.realName, photoURL: userData.photoURL },
                    lastMessage: lastMessageText,
                    date: serverTimestamp()
                }
            }, { merge: true });
        } else {
             await updateDoc(theirChatRef, {
                [`${roomId}.lastMessage`]: lastMessageText,
                [`${roomId}.date`]: serverTimestamp()
            });
        }
    } catch (err) {
        console.error("Error updating chat list:", err);
    }
  };


  const sendMessage = async () => {
    if (currentMessage !== "") {
      const msgId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const messageData = {
        id: msgId,
        room: roomId,
        author: userData.realName,
        photo: userData.photoURL,
        type: "text",
        message: currentMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: "sent" 
      };
      
      await socket.emit("send_message", messageData);
      updateRecentChats("text", currentMessage);

      setMessageList((list) => {
          const newList = [...list, messageData];
          localStorage.setItem(`chat_${roomId}`, JSON.stringify(newList));
          return newList;
      });
      setCurrentMessage("");
      setShowEmoji(false);
      socket.emit("stop_typing", roomId);
    }
  };

  const sendFile = async (file, type) => {
    setUploading(true);
    try {
        const fileRef = ref(storage, `chat_files/${Date.now()}_${file.name || "audio.webm"}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        const msgId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const messageData = {
            id: msgId,
            room: roomId,
            author: userData.realName,
            photo: userData.photoURL,
            type: type,
            message: url,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: "sent"
        };
        await socket.emit("send_message", messageData);
        updateRecentChats(type, url);

        setMessageList((list) => {
            const newList = [...list, messageData];
            localStorage.setItem(`chat_${roomId}`, JSON.stringify(newList));
            return newList;
        });
    } catch (error) { alert("Upload failed!"); } 
    finally { setUploading(false); }
  };

  const selectFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert("File max 50MB"); return; }
    const type = file.type.startsWith("video/") ? "video" : "image";
    sendFile(file, type);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => audioChunksRef.current.push(event.data);
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        sendFile(audioBlob, "audio");
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) { alert("Microphone denied!"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTyping = (e) => {
    setCurrentMessage(e.target.value);
    socket.emit("typing", { room: roomId, username: userData.realName });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => socket.emit("stop_typing", roomId), 2000);
  };

  if (!userData) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-emerald-400 font-bold animate-pulse">Loading Chat...</div>;

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center font-sans relative overflow-hidden">
      
      {/* 🌟 BACKGROUND GLOW */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob"></div>
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob animation-delay-4000"></div>

      {/* 📦 GLASS CONTAINER */}
      <div className="w-full max-w-6xl h-[92vh] bg-gray-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl flex overflow-hidden z-10 animate-fade-in-up">
        
        {/* 🛑 SIDEBAR (Group Info / Active Users) */}
        {!isDirectMessage && (
          <div className="w-1/3 bg-black/20 border-r border-white/5 hidden md:flex flex-col backdrop-blur-sm">
             <div className="p-5 border-b border-white/5 bg-white/5">
               <div className="flex items-center gap-3">
                 <img src={userData.photoURL} className="w-10 h-10 rounded-full border border-emerald-500 shadow-lg shadow-emerald-500/20" />
                 <span className="font-bold text-gray-200 text-sm">{userData.realName}</span>
               </div>
               <button onClick={() => navigate("/")} className="mt-4 text-xs text-gray-400 hover:text-red-400 transition flex items-center gap-1 group">
                   <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Dashboard
               </button>
            </div>
            <div className="p-4"><h3 className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Active Users</h3></div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {userList.map((u, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 mb-2 rounded-xl bg-white/5 border border-transparent hover:border-emerald-500/30 hover:bg-white/10 transition-all">
                        <div className="w-8 h-8 bg-gradient-to-tr from-gray-700 to-gray-600 rounded-full flex items-center justify-center font-bold text-white shadow-inner">{u.charAt(0)}</div>
                        <p className="text-gray-200 text-sm font-medium">{u}</p>
                    </div>
                ))}
            </div>
          </div>
        )}

        {/* 💬 MAIN CHAT AREA */}
        <div className="flex-1 flex flex-col relative">
          
          {/* HEADER */}
          <div className="bg-white/5 backdrop-blur-md p-4 flex items-center justify-between border-b border-white/5 shadow-sm z-20">
              <div className="flex items-center gap-4">
                  <button onClick={() => navigate("/")} className="text-gray-400 hover:text-white transition md:hidden p-2 rounded-full hover:bg-white/10">←</button>
                  
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-500/20">
                      {isDirectMessage ? "👤" : "#"}
                  </div>
                  <div>
                      <p className="font-bold text-white tracking-wide">{isDirectMessage ? "Private Chat" : `Room: ${roomId}`}</p>
                      {typingUser ? (
                          <p className="text-xs text-emerald-400 animate-pulse font-medium">{typingUser} is typing...</p>
                      ) : (
                          <p className="text-[10px] text-emerald-500/60 font-medium tracking-wider">ENCRYPTED CONNECTION</p>
                      )}
                  </div>
              </div>
               
               <div className="flex items-center gap-2">
                   <button onClick={() => { localStorage.removeItem(`chat_${roomId}`); setMessageList([]); }} className="text-gray-500 hover:text-white text-xs px-3 py-1 rounded border border-white/10 hover:bg-white/5 transition">Clear</button>
                   {isDirectMessage && <button onClick={() => navigate("/")} className="text-red-400 hover:text-red-300 text-xs px-3 py-1 rounded border border-red-500/30 hover:bg-red-500/10 transition">Close</button>}
               </div>
          </div>

          {/* MESSAGES LIST */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-transparent">
              {messageList.map((msg, index) => {
                const isMyMessage = userData.realName === msg.author;
                return (
                  <div key={index} className={`flex w-full animate-fade-in-up ${isMyMessage ? "justify-end" : "justify-start"}`}>
                      {!isMyMessage && <img src={msg.photo} className="w-8 h-8 rounded-full mr-2 self-end mb-1 border border-white/10 shadow-sm"/>}
                      
                      <div className={`max-w-[85%] md:max-w-[65%] min-w-[120px] px-4 py-3 rounded-2xl text-sm shadow-xl backdrop-blur-sm relative border transition-all hover:scale-[1.01]
                          ${isMyMessage 
                              ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-br-none border-emerald-400/20" 
                              : "bg-white/10 text-gray-100 rounded-bl-none border-white/10"
                          }`}>
                          
                          {!isMyMessage && <p className="text-[10px] font-bold text-emerald-400 mb-1 tracking-wide">{msg.author}</p>}
                          
                          {msg.type === "image" ? <img src={msg.message} className="max-w-full rounded-lg mb-1 border border-black/20" /> :
                           msg.type === "video" ? <video src={msg.message} controls className="max-w-full rounded-lg mb-1 border border-black/20" /> :
                           msg.type === "audio" ? <audio src={msg.message} controls className="max-w-[200px] mt-1 accent-emerald-500" /> :
                           <p className="break-words text-[15px] leading-relaxed">{msg.message}</p>}
                          
                          <div className={`flex justify-end items-center mt-1 gap-1 opacity-70`}>
                              <p className="text-[9px] font-mono">{msg.time}</p>
                              <MessageStatus status={msg.status} isMyMessage={isMyMessage} />
                          </div>
                      </div>
                  </div>
                );
              })}
              
              {uploading && <div className="text-right text-emerald-500 text-xs animate-pulse font-mono">Uploading file...</div>}
              {isRecording && <div className="text-center bg-red-500/10 border border-red-500/30 text-red-400 p-2 rounded-lg text-xs font-bold animate-pulse mx-auto w-fit">🔴 Recording Audio...</div>}
              
              <div ref={bottomRef} />
          </div>

          <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={selectFile} />
          
          {/* INPUT AREA */}
          <div className="p-4 bg-black/20 backdrop-blur-md border-t border-white/5 relative z-20">
              {showEmoji && <div className="absolute bottom-24 left-4 z-50 animate-fade-in-up"><EmojiPicker onEmojiClick={(e)=>setCurrentMessage(prev=>prev+e.emoji)} theme="dark" height={350} searchDisabled skinTonesDisabled/></div>}

              <div className="flex gap-2 items-center bg-white/5 p-2 rounded-2xl border border-white/10 focus-within:border-emerald-500/50 focus-within:bg-white/10 transition-all shadow-lg">
                  <button onClick={() => setShowEmoji(!showEmoji)} className="text-xl text-gray-400 p-2 hover:text-yellow-400 hover:bg-white/5 rounded-full transition">😊</button>
                  <button onClick={() => fileInputRef.current.click()} className="text-xl text-gray-400 p-2 hover:text-blue-400 hover:bg-white/5 rounded-full transition">📎</button>
                  
                  <input type="text" value={currentMessage} placeholder="Type a message..." 
                      className="flex-1 p-2 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
                      onChange={handleTyping} onKeyPress={(e) => { e.key === "Enter" && sendMessage(); }} />
                  
                  {currentMessage.trim() === "" ? (
                     <button 
                       onMouseDown={startRecording} onMouseUp={stopRecording} 
                       onTouchStart={startRecording} onTouchEnd={stopRecording}
                       className={`p-3 rounded-xl text-white transition-all shadow-lg ${isRecording ? "bg-red-500 scale-110 shadow-red-500/50" : "bg-gray-700 hover:bg-gray-600"}`}
                     >🎤</button>
                  ) : (
                     <button onClick={sendMessage} className="bg-emerald-500 hover:bg-emerald-400 p-3 rounded-xl text-white shadow-lg shadow-emerald-500/30 transition-all transform hover:scale-105 active:scale-95">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                          <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                        </svg>
                     </button>
                  )}
              </div>
          </div>
        </div>
      </div>

      {/* GLOBAL STYLES FOR ANIMATIONS */}
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.4s ease-out forwards; }
        
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { bg: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #10b981; }
      `}</style>
    </div>
  );
}

export default Chat;