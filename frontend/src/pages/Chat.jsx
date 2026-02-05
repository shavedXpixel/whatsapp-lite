import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EmojiPicker from "emoji-picker-react";
import { db } from "../firebase";
import { 
  doc, getDoc, setDoc, updateDoc, serverTimestamp, 
  collection, addDoc, query, orderBy, onSnapshot 
} from "firebase/firestore";

// 🎵 SOUND EFFECT
const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3";

// 🆔 PROFILE MODAL COMPONENT
const ProfileModal = ({ user, onClose }) => {
  if (!user) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-[#1e293b] border border-white/10 p-6 rounded-3xl shadow-2xl max-w-sm w-full relative flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
        
        <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-lg shadow-purple-500/20">
            <img src={user.photo || user.photoURL} className="w-full h-full rounded-full object-cover border-4 border-[#1e293b]" />
        </div>
        
        <h2 className="text-2xl font-bold text-white">{user.name || user.displayName}</h2>
        <p className="text-blue-400 text-xs font-mono mb-4 tracking-widest">USER INFO</p>
        
        <div className="w-full bg-black/20 rounded-xl p-4 text-center border border-white/5">
            <p className="text-gray-400 text-xs uppercase font-bold mb-1">About</p>
            <p className="text-gray-200 italic">"{user.about || "No status set."}"</p>
        </div>
      </div>
    </div>
  );
};

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
  const [userList, setUserList] = useState([]); // ✅ This will now update correctly
  const [showEmoji, setShowEmoji] = useState(false);
  const [typingUser, setTypingUser] = useState("");
  
  // 🆕 NEW STATES
  const [otherUser, setOtherUser] = useState(null); 
  const [showProfile, setShowProfile] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  
  const notificationAudio = useRef(new Audio(NOTIFICATION_SOUND));
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // 1. SOCKET & DATABASE LOGIC (MERGED TO FIX RACE CONDITION)
  useEffect(() => {
    if (userData && roomId) {
       
       // --- A. DEFINE SOCKET LISTENERS FIRST ---
       const handleUserList = (users) => {
           // console.log("Received User List:", users); // Debugging
           setUserList(users);
       };

       const handleDisplayTyping = (user) => setTypingUser(user);
       const handleHideTyping = () => setTypingUser("");

       // --- B. ATTACH LISTENERS ---
       socket.on("update_user_list", handleUserList);
       socket.on("display_typing", handleDisplayTyping);
       socket.on("hide_typing", handleHideTyping);

       // --- C. JOIN ROOM (AFTER LISTENERS ARE READY) ---
       socket.emit("join_room", { room: roomId, username: userData.realName, photo: userData.photoURL });

       // --- D. FETCH OTHER USER (HEADER INFO) ---
       if(isDirectMessage) {
          const ids = roomId.split("_");
          const otherUid = ids[0] === userData.uid ? ids[1] : ids[0];
          getDoc(doc(db, "users", otherUid)).then(snap => {
              if(snap.exists()) setOtherUser(snap.data());
          });
       }

       // --- E. REAL-TIME MESSAGES (FIRESTORE) ---
       const messagesRef = collection(db, "chats", roomId, "messages");
       const q = query(messagesRef, orderBy("createdAt", "asc"));

       const unsubscribeDb = onSnapshot(q, (snapshot) => {
           const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
           setMessageList(msgs);
           
           if (msgs.length > 0 && isDirectMessage) {
               const lastMsg = msgs[msgs.length - 1];
               if (lastMsg.author !== userData.realName) {
                   const myChatRef = doc(db, "userChats", userData.uid);
                   updateDoc(myChatRef, { [`${roomId}.unread`]: false }).catch(()=>{});
                   notificationAudio.current.play().catch(()=>{}); 
               }
           }
       });

       // --- F. CLEANUP ---
       return () => {
          socket.off("update_user_list", handleUserList);
          socket.off("display_typing", handleDisplayTyping);
          socket.off("hide_typing", handleHideTyping);
          unsubscribeDb();
          socket.emit("leave_room", roomId); // Ensure we leave so list updates for others
       };
    }
  }, [roomId, userData]); // Removed 'socket' dependency to prevent re-attaching constantly

  // 2. AUTO SCROLL
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageList, typingUser, replyTo]);


  // 3. UPDATE SIDEBAR LIST
  const updateRecentChats = async (msgContent) => {
    if (!isDirectMessage) return;
    const ids = roomId.split("_");
    const otherUid = ids[0] === userData.uid ? ids[1] : ids[0];
    
    try {
        const myChatRef = doc(db, "userChats", userData.uid);
        const myChatSnap = await getDoc(myChatRef);
        
        let chatData = {
             userInfo: { uid: otherUid },
             lastMessage: msgContent,
             date: serverTimestamp(),
             unread: false 
        };

        if (!myChatSnap.exists() || !myChatSnap.data()[roomId]) {
             const otherUserSnap = await getDoc(doc(db, "users", otherUid));
             const otherUserData = otherUserSnap.exists() ? otherUserSnap.data() : { realName: "User", photoURL: "" };
             chatData.userInfo = { uid: otherUid, displayName: otherUserData.realName, photoURL: otherUserData.photoURL };
        }
        await setDoc(myChatRef, { [roomId]: chatData }, { merge: true });

        const theirChatRef = doc(db, "userChats", otherUid);
        const theirChatSnap = await getDoc(theirChatRef);
        
        let theirChatData = {
            userInfo: { uid: userData.uid, displayName: userData.realName, photoURL: userData.photoURL },
            lastMessage: msgContent,
            date: serverTimestamp(),
            unread: true 
        };
        await setDoc(theirChatRef, { [roomId]: theirChatData }, { merge: true });

    } catch (err) { console.error("Error updating chat list:", err); }
  };

  const sendMessage = async () => {
    if (currentMessage.trim() !== "") {
      
      const messageData = {
        room: roomId,
        author: userData.realName,
        photo: userData.photoURL,
        message: currentMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fullDate: new Date().toISOString(),
        createdAt: serverTimestamp(), 
        status: "sent",
        replyTo: replyTo 
      };
      
      await addDoc(collection(db, "chats", roomId, "messages"), messageData);
      updateRecentChats(currentMessage);
      
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
      
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] bg-violet-600 rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-blob pointer-events-none"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600 rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-blob animation-delay-4000 pointer-events-none"></div>

      {/* SIDEBAR (Group Chat Only) */}
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
          <div className="p-5 pb-2"><h3 className="text-blue-400 text-xs font-bold uppercase tracking-widest">Active Users ({userList.length})</h3></div>
          
          {/* ✅ USER LIST RENDER */}
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

      {/* MAIN CHAT */}
      <div className="h-full flex flex-col relative z-10 w-full overflow-hidden">
        
        {/* HEADER */}
        <div className="h-16 bg-black/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 z-30 shadow-sm shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate("/")} className={`text-gray-400 hover:text-white transition p-2 ${!isDirectMessage ? 'md:hidden' : ''}`}>←</button>
                
                <div 
                   className={`flex items-center gap-3 ${isDirectMessage ? "cursor-pointer hover:opacity-80 transition" : ""}`}
                   onClick={() => isDirectMessage && otherUser && setShowProfile(true)}
                >
                    {isDirectMessage && otherUser ? (
                        <img src={otherUser.photoURL} className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                    ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                            {isDirectMessage ? "👤" : "#"}
                        </div>
                    )}
                    
                    <div>
                        <h2 className="font-bold text-white text-lg tracking-wide">
                            {isDirectMessage && otherUser ? otherUser.realName : (isDirectMessage ? "Private Chat" : `Room: ${roomId}`)}
                        </h2>
                        {typingUser ? <p className="text-xs text-blue-400 animate-pulse font-medium">Typing...</p> : 
                         <p className="text-xs text-gray-400 font-medium tracking-wide">Encrypted Connection</p>}
                    </div>
                </div>
            </div>
             
             <div className="flex items-center gap-3">
                 {isDirectMessage && (
                    <button onClick={() => navigate("/")} className="text-gray-300 hover:text-white text-xs px-3 py-2 rounded-lg border border-white/10 hover:bg-white/10 transition bg-blue-900/20">
                        Dashboard
                    </button>
                 )}
             </div>
        </div>

        {/* MESSAGES LIST */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-2 custom-scrollbar bg-transparent min-h-0">
            {messageList.map((msg, index) => {
              const isMyMessage = userData.realName === msg.author;
              const isSystem = msg.author === "System";
              const msgDate = msg.fullDate ? new Date(msg.fullDate).toDateString() : null;
              const showDate = msgDate && msgDate !== lastDate;
              if (msgDate) lastDate = msgDate;

              if (isSystem) return <div key={index} className="flex justify-center my-2"><span className="text-gray-500 text-[10px] font-mono tracking-wider opacity-75">{msg.message}</span></div>;

              return (
                <div key={index}>
                    {showDate && (
                        <div className="flex justify-center my-6">
                            <span className="bg-white/5 border border-white/10 text-gray-400 text-[10px] px-3 py-1 rounded-full uppercase tracking-widest font-bold">
                                {formatDate(msg.fullDate)}
                            </span>
                        </div>
                    )}

                    <div className={`flex w-full animate-fade-in-up group mb-2 ${isMyMessage ? "justify-end" : "justify-start"}`}>
                        {!isMyMessage && (
                            <img src={msg.photo} onClick={() => { setOtherUser({ name: msg.author, photo: msg.photo, about: "User in this chat." }); setShowProfile(true); }}
                                className="w-9 h-9 rounded-full mr-3 self-end mb-1 border border-white/10 shadow-lg cursor-pointer hover:scale-110 transition"
                            />
                        )}
                        
                        <div className={`max-w-[85%] md:max-w-[60%] min-w-[120px] px-5 py-3 rounded-2xl text-[15px] shadow-2xl backdrop-blur-md relative border transition-transform
                            ${isMyMessage ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none border-blue-400/20" 
                                          : "bg-white/5 text-gray-200 rounded-bl-none border-white/10 hover:bg-white/15"}`}>
                            
                            {msg.replyTo && (
                                <div className={`mb-2 p-2 rounded-lg text-xs border-l-4 ${isMyMessage ? "bg-black/20 border-white/50" : "bg-black/40 border-blue-500"}`}>
                                    <p className="font-bold opacity-80">{msg.replyTo.author}</p>
                                    <p className="truncate opacity-70">{msg.replyTo.message}</p>
                                </div>
                            )}

                            {!isMyMessage && <p className="text-[10px] font-bold text-blue-400 mb-1.5 tracking-wide uppercase opacity-80">{msg.author}</p>}
                            <p className="break-words leading-relaxed font-light tracking-wide"><Linkify text={msg.message} /></p>
                            
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
            
            {typingUser && typingUser !== userData.realName && (
                <div className="ml-12 animate-fade-in-up">
                    <p className="text-[10px] text-gray-500 mb-1 ml-1">{typingUser} is typing...</p>
                    <TypingIndicator />
                </div>
            )}
            <div ref={bottomRef} />
        </div>

        {/* INPUT AREA */}
        <div className="w-full bg-black/60 backdrop-blur-2xl border-t border-white/10 p-3 shrink-0 z-30 flex flex-col">
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
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                    </button>
                </div>
            </div>
        </div>

        {/* MODAL */}
        {showProfile && <ProfileModal user={otherUser} onClose={() => setShowProfile(false)} />}
      </div>
      
      <style>{`
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in-up { animation: fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { bg: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
}

export default Chat;