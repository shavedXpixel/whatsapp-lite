import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EmojiPicker from "emoji-picker-react";
import { db } from "../firebase";
import { 
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, 
  deleteDoc, doc 
} from "firebase/firestore";

// 🎵 SOUND EFFECT
const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3";

// 🔔 NOTIFICATION BANNER (The Pop-up)
const NotificationBanner = ({ message }) => {
  if (!message) return null;
  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] animate-bounce-in">
      <div className="bg-emerald-600/90 backdrop-blur-md text-white px-6 py-2 rounded-full shadow-2xl border border-emerald-400/30 flex items-center gap-2">
        <span className="text-lg">👋</span>
        <span className="text-sm font-bold tracking-wide">{message}</span>
      </div>
    </div>
  );
};

// 👥 MEMBERS MODAL
const MembersModal = ({ users, onClose }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-[#1e293b] border border-white/10 p-6 rounded-2xl w-80 max-h-[60vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-bold text-lg">Active Members ({users.length})</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
            {users.map((u, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-full flex items-center justify-center font-bold text-white text-xs">{u.charAt(0)}</div>
                    <p className="text-gray-200 text-sm font-medium truncate">{u}</p>
                </div>
            ))}
        </div>
      </div>
    </div>
);

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

function GroupChat({ userData, socket }) {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [currentMessage, setCurrentMessage] = useState("");
  const [messageList, setMessageList] = useState([]); 
  const [userList, setUserList] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  
  // 🔔 Notification State
  const [notification, setNotification] = useState(null);
  const notificationTimeoutRef = useRef(null);
  
  const notificationAudio = useRef(new Audio(NOTIFICATION_SOUND));
  const bottomRef = useRef(null);

  // 1. JOIN ROOM & LISTENERS
  useEffect(() => {
    if (userData && roomId) {
       socket.emit("join_room", { room: roomId, username: userData.realName, photo: userData.photoURL });

       socket.on("update_user_list", (users) => setUserList(users));

       // 🆕 MODIFIED LISTENER: Handles System messages as Banners
       socket.on("receive_message", (data) => {
           if (data.author === "System" || !data.author) {
               // Trigger the banner
               setNotification(data.message);
               
               // Clear previous timeout if exists
               if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
               
               // Remove banner after 3 seconds
               notificationTimeoutRef.current = setTimeout(() => {
                   setNotification(null);
               }, 3000);
           }
       });

       const messagesRef = collection(db, "chats", roomId, "messages");
       const q = query(messagesRef, orderBy("createdAt", "asc"));

       const unsubscribeDb = onSnapshot(q, (snapshot) => {
           const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
           setMessageList(msgs);
           if (msgs.length > 0) {
               const lastMsg = msgs[msgs.length - 1];
               if (lastMsg.author !== userData.realName) notificationAudio.current.play().catch(()=>{}); 
           }
       });

       return () => {
          socket.emit("leave_room", roomId); 
          socket.off("update_user_list");
          socket.off("receive_message");
          if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
          unsubscribeDb();
       };
    }
  }, [roomId, userData, socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageList]);

  // 🗑️ CLEAR CHAT FUNCTION
  const clearChat = async () => {
      if (confirm("⚠️ Are you sure you want to delete ALL messages in this room? This cannot be undone.")) {
          messageList.forEach(async (msg) => {
              if (msg.id) {
                  await deleteDoc(doc(db, "chats", roomId, "messages", msg.id));
              }
          });
      }
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
      };
      
      await addDoc(collection(db, "chats", roomId, "messages"), messageData);
      setCurrentMessage("");
      setShowEmoji(false);
    }
  };

  let lastDate = null;

  return (
    <div className="fixed inset-0 bg-[#0b0f19] flex font-sans overflow-hidden">
      
      {/* 🔔 THE NOTIFICATION BANNER */}
      <NotificationBanner message={notification} />

      {/* 🛑 SIDEBAR (DESKTOP) */}
      <div className="hidden md:flex flex-col w-[300px] h-full bg-black/20 backdrop-blur-xl border-r border-white/5 z-20">
           <div className="p-6 border-b border-white/5 bg-white/5 backdrop-blur-md">
             <h2 className="font-bold text-white text-lg">Room: {roomId}</h2>
             <button onClick={() => navigate("/")} className="mt-4 w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 transition flex items-center justify-center gap-2 border border-white/5">
                 ← Dashboard
             </button>
          </div>
          <div className="p-5 pb-2"><h3 className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Active Users ({userList.length})</h3></div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {userList.map((u, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-transparent hover:border-emerald-500/30 hover:bg-white/10 transition-all cursor-default">
                      <div className="w-8 h-8 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-full flex items-center justify-center font-bold text-white shadow-lg text-xs">{u.charAt(0)}</div>
                      <p className="text-gray-200 text-sm font-medium truncate">{u}</p>
                  </div>
              ))}
          </div>
      </div>

      {/* 💬 MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col relative w-full h-full">
        
        {/* HEADER */}
        <div className="h-14 md:h-16 bg-black/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 z-30 shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate("/")} className="md:hidden text-gray-400 hover:text-white transition p-2">←</button>
                
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowMembers(true)}>
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">#</div>
                    <div>
                        <h2 className="font-bold text-white text-base md:text-lg tracking-wide">Public Room</h2>
                        <p className="text-xs text-emerald-400 font-medium tracking-wide">{userList.length} Online (Tap to view)</p>
                    </div>
                </div>
            </div>

            {/* 🗑️ CLEAR BUTTON */}
            <button onClick={clearChat} className="text-xs px-3 py-2 rounded-lg bg-red-900/20 text-red-400 border border-red-500/20 hover:bg-red-900/40 transition">
                Clear Chat
            </button>
        </div>

        {/* MESSAGES LIST */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-2 pb-24 custom-scrollbar bg-transparent">
            {messageList.map((msg, index) => {
              const isMyMessage = userData.realName === msg.author;
              
              // 🚫 We no longer render System messages here
              if (msg.author === "System") return null;

              const msgDate = msg.fullDate ? new Date(msg.fullDate).toDateString() : null;
              const showDate = msgDate && msgDate !== lastDate;
              if (msgDate) lastDate = msgDate;

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
                            <img src={msg.photo} className="w-9 h-9 rounded-full mr-3 self-end mb-1 border border-white/10 shadow-lg"/>
                        )}
                        
                        <div className={`max-w-[75%] md:max-w-[60%] min-w-[120px] px-5 py-3 rounded-2xl text-[15px] shadow-2xl backdrop-blur-md relative border 
                            ${isMyMessage ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none border-blue-400/20" 
                                          : "bg-white/5 text-gray-200 rounded-bl-none border-white/10 hover:bg-white/15"}`}>
                            
                            {!isMyMessage && <p className="text-[10px] font-bold text-blue-400 mb-1.5 tracking-wide uppercase opacity-80">{msg.author}</p>}
                            <p className="break-words leading-relaxed font-light tracking-wide"><Linkify text={msg.message} /></p>
                            <p className="text-[9px] text-right mt-1 opacity-60 font-mono">{msg.time}</p>
                        </div>
                    </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
        </div>

        {/* INPUT AREA */}
        <div className="fixed bottom-0 left-0 w-full md:relative bg-[#0b0f19] md:bg-black/60 backdrop-blur-2xl border-t border-white/10 p-3 shrink-0 z-30 flex items-center gap-2 pb-safe">
            
            {showEmoji && <div className="absolute bottom-20 left-4 z-50"><EmojiPicker onEmojiClick={(e)=>setCurrentMessage(prev=>prev+e.emoji)} theme="dark" height={350}/></div>}
            
            <button onClick={() => setShowEmoji(!showEmoji)} className="text-lg text-gray-400 p-3 hover:text-yellow-400 hover:bg-white/5 rounded-full transition">😊</button>
            
            <input type="text" value={currentMessage} placeholder="Message Room..." 
                className="flex-1 bg-white/5 text-white p-3 rounded-full outline-none border border-white/10 focus:border-blue-500/50 transition-all placeholder-gray-500"
                onChange={(e) => setCurrentMessage(e.target.value)} onClick={() => setShowEmoji(false)} 
                onKeyPress={(e) => { e.key === "Enter" && sendMessage(); }} />
            
            <button onClick={sendMessage} className="bg-blue-600 hover:bg-blue-500 p-3 rounded-full text-white shadow-lg transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
            </button>
        </div>
      </div>

      {showMembers && <MembersModal users={userList} onClose={() => setShowMembers(false)} />}
      
      <style>{`
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
        
        @keyframes bounce-in { 0% { transform: translate(-50%, -20px); opacity: 0; } 50% { transform: translate(-50%, 10px); opacity: 1; } 100% { transform: translate(-50%, 0); } }
        .animate-bounce-in { animation: bounce-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { bg: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
}

export default GroupChat;