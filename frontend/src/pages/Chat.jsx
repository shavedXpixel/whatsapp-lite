import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EmojiPicker from "emoji-picker-react";
import { storage, db } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

// ✅ TICK COMPONENT
const MessageStatus = ({ status, isMyMessage }) => {
  if (!isMyMessage) return null;
  if (status === "sent") return <span className="text-white/40 text-[10px] ml-1">✓</span>;
  if (status === "delivered") return <span className="text-white/40 text-[10px] ml-1">✓✓</span>;
  if (status === "read") return <span className="text-cyan-400 text-[10px] ml-1 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">✓✓</span>;
  return <span className="text-white/40 text-[10px] ml-1">✓</span>; 
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


  // HELPER: UPDATE RECENT CHATS
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

  if (!userData) return <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-blue-400 font-bold animate-pulse">Loading Chat...</div>;

  return (
    // ✅ CONTAINER: Force 100vh no matter what
    <div className="w-full h-screen bg-[#0b0f19] flex relative overflow-hidden font-sans">
      
      {/* 🔮 BACKGROUND */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-violet-600 rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-blob pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600 rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-blob animation-delay-4000 pointer-events-none"></div>

      {/* 🛑 SIDEBAR */}
      {!isDirectMessage && (
        <div className="w-[350px] h-full bg-black/20 backdrop-blur-xl border-r border-white/5 hidden md:flex flex-col z-20">
           <div className="p-6 border-b border-white/5 bg-white/5 backdrop-blur-md">
             <div className="flex items-center gap-4">
               <img src={userData.photoURL} className="w-12 h-12 rounded-full border-2 border-blue-500/50" />
               <div>
                 <p className="font-bold text-gray-100 text-lg">{userData.realName}</p>
                 <p className="text-blue-400 text-xs tracking-wider font-bold">ONLINE</p>
               </div>
             </div>
             <button onClick={() => navigate("/")} className="mt-6 w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 transition flex items-center justify-center gap-2 group border border-white/5">
                 <span className="group-hover:-translate-x-1 transition-transform">←</span> Return to Dashboard
             </button>
          </div>
          <div className="p-5 pb-2"><h3 className="text-blue-400 text-xs font-bold uppercase tracking-widest">Active Users</h3></div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {userList.map((u, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-transparent hover:border-blue-500/30 hover:bg-white/10 transition-all cursor-default group">
                      <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-full flex items-center justify-center font-bold text-white shadow-lg">{u.charAt(0)}</div>
                      <p className="text-gray-200 text-sm font-medium">{u}</p>
                  </div>
              ))}
          </div>
        </div>
      )}

      {/* 💬 MAIN CHAT AREA */}
      <div className="flex-1 h-full flex flex-col relative z-10">
        
        {/* HEADER */}
        <div className="h-16 bg-black/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 z-30 shadow-sm shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate("/")} className="text-gray-400 hover:text-white transition md:hidden p-2">←</button>
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                    {isDirectMessage ? "👤" : "#"}
                </div>
                <div>
                    <h2 className="font-bold text-white text-lg tracking-wide">{isDirectMessage ? "Private Chat" : `Room: ${roomId}`}</h2>
                    {typingUser && <p className="text-xs text-blue-400 animate-pulse font-medium tracking-wide">Typing...</p>}
                </div>
            </div>
             
             <div className="flex items-center gap-3">
                 <button onClick={() => { localStorage.removeItem(`chat_${roomId}`); setMessageList([]); }} className="text-gray-400 hover:text-white text-xs px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition bg-black/20">Clear</button>
             </div>
        </div>

        {/* MESSAGES - Added padding-bottom to prevent overlap */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 pb-24 custom-scrollbar bg-transparent">
            {messageList.map((msg, index) => {
              const isMyMessage = userData.realName === msg.author;
              const isSystem = msg.author === "System";

              if (isSystem) {
                  return (
                    <div key={index} className="flex justify-center my-4 opacity-70">
                        <span className="bg-white/5 border border-white/10 text-gray-400 text-xs px-3 py-1 rounded-full">{msg.message}</span>
                    </div>
                  );
              }

              return (
                <div key={index} className={`flex w-full animate-fade-in-up group ${isMyMessage ? "justify-end" : "justify-start"}`}>
                    {!isMyMessage && <img src={msg.photo} className="w-9 h-9 rounded-full mr-3 self-end mb-1 border border-white/10 shadow-lg"/>}
                    
                    <div className={`max-w-[85%] md:max-w-[60%] min-w-[120px] px-5 py-3 rounded-2xl text-[15px] shadow-2xl backdrop-blur-md relative border transition-transform hover:scale-[1.01]
                        ${isMyMessage 
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none border-blue-400/20" 
                            : "bg-white/5 text-gray-200 rounded-bl-none border-white/10 hover:bg-white/15"
                        }`}>
                        {!isMyMessage && <p className="text-[10px] font-bold text-blue-400 mb-1.5 tracking-wide uppercase opacity-80">{msg.author}</p>}
                        
                        {msg.type === "image" ? <img src={msg.message} className="max-w-full rounded-xl mb-1 border border-black/20 shadow-lg" /> :
                         msg.type === "video" ? <video src={msg.message} controls className="max-w-full rounded-xl mb-1 border border-black/20 shadow-lg" /> :
                         msg.type === "audio" ? <audio src={msg.message} controls className="max-w-[240px] mt-1" /> :
                         <p className="break-words leading-relaxed font-light tracking-wide">{msg.message}</p>}
                        
                        <div className={`flex justify-end items-center mt-1.5 gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity`}>
                            <p className="text-[9px] font-mono tracking-tighter">{msg.time}</p>
                            <MessageStatus status={msg.status} isMyMessage={isMyMessage} />
                        </div>
                    </div>
                </div>
              );
            })}
            {uploading && <div className="text-right text-blue-400 text-xs animate-pulse font-mono tracking-widest mr-4">UPLOADING...</div>}
            <div ref={bottomRef} />
        </div>

        {/* 🛠️ INPUT AREA - ABSOLUTE POSITIONED (Bulletproof Fix) */}
        <div className="absolute bottom-0 left-0 w-full bg-black/60 backdrop-blur-2xl border-t border-white/10 p-3 flex items-center gap-2 z-50">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={selectFile} />
            
            {showEmoji && <div className="absolute bottom-20 left-4 z-50 animate-fade-in-up shadow-2xl rounded-2xl overflow-hidden"><EmojiPicker onEmojiClick={(e)=>setCurrentMessage(prev=>prev+e.emoji)} theme="dark" height={350} searchDisabled skinTonesDisabled/></div>}

            <div className="flex-1 flex gap-2 items-center bg-white/5 p-1.5 pr-2 rounded-full border border-white/10 focus-within:border-blue-500/50 focus-within:bg-black/40 transition-all">
                <button onClick={() => setShowEmoji(!showEmoji)} className="text-lg text-gray-400 p-2 hover:text-yellow-400 hover:bg-white/5 rounded-full transition">😊</button>
                <button onClick={() => fileInputRef.current.click()} className="text-lg text-gray-400 p-2 hover:text-cyan-400 hover:bg-white/5 rounded-full transition">📎</button>
                
                <input type="text" value={currentMessage} placeholder="Type a message..." 
                    className="flex-1 p-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm tracking-wide"
                    onChange={handleTyping} onKeyPress={(e) => { e.key === "Enter" && sendMessage(); }} />
                
                {currentMessage.trim() === "" ? (
                   <button 
                     onMouseDown={startRecording} onMouseUp={stopRecording} 
                     onTouchStart={startRecording} onTouchEnd={stopRecording}
                     className={`p-2.5 rounded-full text-white transition-all shadow-lg ${isRecording ? "bg-red-500 scale-110 shadow-red-500/50" : "bg-white/10 hover:bg-white/20 hover:text-red-400"}`}
                   >🎤</button>
                ) : (
                   <button onClick={sendMessage} className="bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 p-2.5 rounded-full text-white shadow-lg shadow-blue-600/30 transition-all transform hover:scale-105 active:scale-95">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                      </svg>
                   </button>
                )}
            </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { bg: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
}

export default Chat;