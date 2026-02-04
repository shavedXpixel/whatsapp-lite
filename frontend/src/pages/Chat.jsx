import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EmojiPicker from "emoji-picker-react";
import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

// 🎵 SOUND EFFECT
const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3";

const formatDate = (dateString) => {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

const Linkify = ({ text }) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, index) => {
    if (part.match(urlRegex)) {
      return <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">{part}</a>;
    }
    return part;
  });
};

const MessageStatus = ({ status, isMyMessage }) => {
  if (!isMyMessage) return null;
  if (status === "sent") return <span className="text-white/40 text-[10px] ml-1">✓</span>;
  if (status === "delivered") return <span className="text-white/40 text-[10px] ml-1">✓✓</span>;
  if (status === "read") return <span className="text-cyan-400 text-[10px] ml-1 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">✓✓</span>;
  return <span className="text-white/40 text-[10px] ml-1">✓</span>; 
};

// ✨ ANIMATED TYPING BUBBLES
const TypingIndicator = () => (
  <div className="flex items-center gap-1 bg-white/5 p-3 rounded-2xl rounded-tl-none w-fit mb-4 border border-white/5 animate-fade-in-up">
    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
  </div>
);

function Chat({ userData, socket }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const isDirectMessage = roomId.includes("_");

  const [currentMessage, setCurrentMessage] = useState("");
  const [messageList, setMessageList] = useState([]);
  const [userList, setUserList] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [typingUser, setTypingUser] = useState("");
  
  const [replyTo, setReplyTo] = useState(null);
  const notificationAudio = useRef(new Audio(NOTIFICATION_SOUND));
  const bottomRef = useRef(null);
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
            notificationAudio.current.play().catch(e => console.log("Audio play blocked", e));
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
  }, [messageList, typingUser, replyTo]);

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

  const updateRecentChats = async (msgContent) => {
    if (!isDirectMessage) return;
    const ids = roomId.split("_");
    const otherUid = ids[0] === userData.uid ? ids[1] : ids[0];
    
    try {
        const myChatRef = doc(db, "userChats", userData.uid);
        const myChatSnap = await getDoc(myChatRef);

        const chatData = {
             userInfo: { uid: otherUid },
             lastMessage: msgContent,
             date: serverTimestamp()
        };

        if (!myChatSnap.exists() || !myChatSnap.data()[roomId]) {
             const otherUserSnap = await getDoc(doc(db, "users", otherUid));
             const otherUserData = otherUserSnap.exists() ? otherUserSnap.data() : { realName: "User", photoURL: "" };
             chatData.userInfo = { uid: otherUid, displayName: otherUserData.realName, photoURL: otherUserData.photoURL };
        }

        await setDoc(myChatRef, { [roomId]: chatData }, { merge: true });

        const theirChatRef = doc(db, "userChats", otherUid);
        const theirChatSnap = await getDoc(theirChatRef);
        const theirChatData = {
            userInfo: { uid: userData.uid, displayName: userData.realName, photoURL: userData.photoURL },
            lastMessage: msgContent,
            date: serverTimestamp()
        };
        await setDoc(theirChatRef, { [roomId]: theirChatData }, { merge: true });

    } catch (err) { console.error("Error updating chat list:", err); }
  };

  const sendMessage = async () => {
    if (currentMessage.trim() !== "") {
      const msgId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const messageData = {
        id: msgId,
        room: roomId,
        author: userData.realName,
        photo: userData.photoURL,
        message: currentMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fullDate: new Date().toISOString(), 
        status: "sent",
        replyTo: replyTo 
      };
      
      await socket.emit("send_message", messageData);
      updateRecentChats(currentMessage);

      setMessageList((list) => {
          const newList = [...list, messageData];
          localStorage.setItem(`chat_${roomId}`, JSON.stringify(newList));
          return newList;
      });
      setCurrentMessage("");
      setReplyTo(null);
      setShowEmoji(false);
      socket.emit("stop_typing", roomId);
    }
  };

  const handleTyping = (e) => {
    setCurrentMessage(e.target.value);
    socket.emit("typing", { room: roomId, username: userData.realName });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => socket.emit("stop_typing", roomId), 2000);
  };

  if (!userData) return <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-blue-400 font-bold animate-pulse">Loading Chat...</div>;

  let lastDate = null;

  return (
    <div className={`w-full h-[100dvh] bg-[#0b0f19] grid grid-cols-1 ${!isDirectMessage ? 'md:grid-cols-[350px_1fr]' : ''} overflow-hidden font-sans`}>
      
      {/* 🔮 BACKGROUND */}
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] bg-violet-600 rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-blob pointer-events-none"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600 rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-blob animation-delay-4000 pointer-events-none"></div>

      {/* 🛑 SIDEBAR (Hidden in Private Chat) */}
      {!isDirectMessage && (
        <div className="hidden md:flex flex-col h-full bg-black/20 backdrop-blur-xl border-r border-white/5 z-20 overflow-hidden">
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
      <div className="h-full flex flex-col relative z-10 w-full overflow-hidden">
        
        {/* HEADER - Updated Back Button Logic */}
        <div className="h-16 bg-black/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 z-30 shadow-sm shrink-0">
            <div className="flex items-center gap-4">
                {/* ✅ FIX: The back button is now visible if it's a Direct Message (no sidebar) OR if we are on mobile.
                   It is only hidden if it's a Group Chat on Desktop (since the sidebar is there).
                */}
                <button onClick={() => navigate("/")} className={`text-gray-400 hover:text-white transition p-2 ${!isDirectMessage ? 'md:hidden' : ''}`}>←</button>
                
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                    {isDirectMessage ? "👤" : "#"}
                </div>
                <div>
                    <h2 className="font-bold text-white text-lg tracking-wide">{isDirectMessage ? "Private Chat" : `Room: ${roomId}`}</h2>
                    <p className="text-xs text-gray-400 font-medium tracking-wide">Encrypted Connection</p>
                </div>
            </div>
             
             <div className="flex items-center gap-3">
                 {/* ✅ NEW DASHBOARD BUTTON for Private Chats */}
                 {isDirectMessage && (
                    <button onClick={() => navigate("/")} className="text-gray-300 hover:text-white text-xs px-3 py-2 rounded-lg border border-white/10 hover:bg-white/10 transition bg-blue-900/20">
                        Dashboard
                    </button>
                 )}
                 <button onClick={() => { localStorage.removeItem(`chat_${roomId}`); setMessageList([]); }} className="text-gray-400 hover:text-white text-xs px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition bg-black/20">Clear</button>
             </div>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-2 custom-scrollbar bg-transparent min-h-0">
            {messageList.map((msg, index) => {
              const isMyMessage = userData.realName === msg.author;
              const isSystem = msg.author === "System";

              // 📅 DATE SEPARATORS
              const msgDate = msg.fullDate ? new Date(msg.fullDate).toDateString() : null;
              const showDate = msgDate && msgDate !== lastDate;
              if (msgDate) lastDate = msgDate;

              // 🛑 SYSTEM MESSAGE
              if (isSystem) {
                  return (
                    <div key={index} className="flex justify-center my-2">
                        <span className="text-gray-500 text-[10px] font-mono tracking-wider opacity-75">
                           {msg.message}
                        </span>
                    </div>
                  );
              }

              return (
                <div key={index}>
                    {/* Render Date Divider */}
                    {showDate && (
                        <div className="flex justify-center my-6">
                            <span className="bg-white/5 border border-white/10 text-gray-400 text-[10px] px-3 py-1 rounded-full uppercase tracking-widest font-bold">
                                {formatDate(msg.fullDate)}
                            </span>
                        </div>
                    )}

                    <div className={`flex w-full animate-fade-in-up group mb-2 ${isMyMessage ? "justify-end" : "justify-start"}`}>
                        {!isMyMessage && <img src={msg.photo} className="w-9 h-9 rounded-full mr-3 self-end mb-1 border border-white/10 shadow-lg"/>}
                        
                        <div className={`max-w-[85%] md:max-w-[60%] min-w-[120px] px-5 py-3 rounded-2xl text-[15px] shadow-2xl backdrop-blur-md relative border transition-transform
                            ${isMyMessage 
                                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none border-blue-400/20" 
                                : "bg-white/5 text-gray-200 rounded-bl-none border-white/10 hover:bg-white/15"
                            }`}>
                            
                            {/* ↩️ REPLY PREVIEW */}
                            {msg.replyTo && (
                                <div className={`mb-2 p-2 rounded-lg text-xs border-l-4 ${isMyMessage ? "bg-black/20 border-white/50" : "bg-black/40 border-blue-500"}`}>
                                    <p className="font-bold opacity-80">{msg.replyTo.author}</p>
                                    <p className="truncate opacity-70">{msg.replyTo.message}</p>
                                </div>
                            )}

                            {!isMyMessage && <p className="text-[10px] font-bold text-blue-400 mb-1.5 tracking-wide uppercase opacity-80">{msg.author}</p>}
                            
                            <p className="break-words leading-relaxed font-light tracking-wide">
                                <Linkify text={msg.message} />
                            </p>
                            
                            <div className={`flex justify-between items-center mt-1.5 gap-2`}>
                                <button onClick={() => navigator.clipboard.writeText(msg.message)} className="opacity-0 group-hover:opacity-100 text-[9px] text-gray-300 hover:text-white transition">COPY</button>
                                
                                <div className="flex items-center gap-1.5 opacity-60">
                                    <button onClick={() => setReplyTo(msg)} className="opacity-0 group-hover:opacity-100 text-[9px] hover:text-cyan-300 transition mr-2">↩ REPLY</button>
                                    <p className="text-[9px] font-mono tracking-tighter">{msg.time}</p>
                                    <MessageStatus status={msg.status} isMyMessage={isMyMessage} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
              );
            })}
            
            {/* ✨ ANIMATED TYPING BUBBLES */}
            {typingUser && typingUser !== userData.realName && (
                <div className="ml-12 animate-fade-in-up">
                    <p className="text-[10px] text-gray-500 mb-1 ml-1">{typingUser} is typing...</p>
                    <TypingIndicator />
                </div>
            )}
            
            <div ref={bottomRef} />
        </div>

        {/* 🛠️ INPUT AREA */}
        <div className="w-full bg-black/60 backdrop-blur-2xl border-t border-white/10 p-3 shrink-0 z-30 flex flex-col">
            
            {/* ↩️ REPLYING TO BANNER */}
            {replyTo && (
                <div className="flex justify-between items-center bg-blue-900/30 p-2 mb-2 rounded-lg border-l-4 border-blue-500 animate-fade-in-up">
                    <div className="text-sm">
                        <span className="text-blue-400 font-bold block text-xs">Replying to {replyTo.author}</span>
                        <span className="text-gray-300 truncate block text-xs">{replyTo.message}</span>
                    </div>
                    <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-white px-2">✕</button>
                </div>
            )}

            <div className="flex items-center w-full gap-2">
                {showEmoji && <div className="absolute bottom-20 left-4 z-50 animate-fade-in-up shadow-2xl rounded-2xl overflow-hidden"><EmojiPicker onEmojiClick={(e)=>setCurrentMessage(prev=>prev+e.emoji)} theme="dark" height={350} searchDisabled skinTonesDisabled/></div>}

                <div className="flex flex-1 gap-2 items-center bg-white/5 p-1.5 pr-2 rounded-full border border-white/10 focus-within:border-blue-500/50 focus-within:bg-black/40 transition-all">
                    <button onClick={() => setShowEmoji(!showEmoji)} className="text-lg text-gray-400 p-2 hover:text-yellow-400 hover:bg-white/5 rounded-full transition">😊</button>
                    
                    <input type="text" value={currentMessage} placeholder={replyTo ? "Type your reply..." : "Type a message..."}
                        className="flex-1 p-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm tracking-wide"
                        onChange={handleTyping} onKeyPress={(e) => { e.key === "Enter" && sendMessage(); }} />
                    
                    <button onClick={sendMessage} className="bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 p-2.5 rounded-full text-white shadow-lg shadow-blue-600/30 transition-all transform hover:scale-105 active:scale-95">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                        </svg>
                    </button>
                </div>
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