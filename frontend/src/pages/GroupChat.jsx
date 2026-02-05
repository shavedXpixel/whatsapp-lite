import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EmojiPicker from "emoji-picker-react";
import { db } from "../firebase";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";

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

function GroupChat({ userData, socket }) {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [currentMessage, setCurrentMessage] = useState("");
  const [messageList, setMessageList] = useState([]); // Database Messages
  const [systemMessages, setSystemMessages] = useState([]); // Socket System Messages (Joined/Left)
  const [userList, setUserList] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  
  const notificationAudio = useRef(new Audio(NOTIFICATION_SOUND));
  const bottomRef = useRef(null);

  // 1. JOIN ROOM & LISTENERS
  useEffect(() => {
    if (userData && roomId) {
       // A. Join via Socket
       socket.emit("join_room", { room: roomId, username: userData.realName, photo: userData.photoURL });

       // B. Listen for User List Updates (Fixes "User not removed" bug)
       socket.on("update_user_list", (users) => {
           setUserList(users);
       });

       // C. Listen for System Messages (User Left/Joined)
       socket.on("receive_message", (data) => {
           // Only add if it's a System message (Author is "System" or implied)
           if (data.author === "System" || !data.author) {
               setSystemMessages(prev => [...prev, { ...data, id: `sys_${Date.now()}`, isSystem: true }]);
           }
       });

       // D. Listen to Firestore Messages
       const messagesRef = collection(db, "chats", roomId, "messages");
       const q = query(messagesRef, orderBy("createdAt", "asc"));

       const unsubscribeDb = onSnapshot(q, (snapshot) => {
           const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
           setMessageList(msgs);
           
           // Play sound for new messages (if not me)
           if (msgs.length > 0) {
               const lastMsg = msgs[msgs.length - 1];
               if (lastMsg.author !== userData.realName) {
                   notificationAudio.current.play().catch(()=>{}); 
               }
           }
       });

       return () => {
          socket.emit("leave_room", roomId); // ✅ Important: Tell server we left
          socket.off("update_user_list");
          socket.off("receive_message");
          unsubscribeDb();
       };
    }
  }, [roomId, userData, socket]);

  // 2. MERGE & SORT MESSAGES (Database + System)
  // We combine persistent DB messages with temporary System messages (Joined/Left)
  const combinedMessages = [...messageList, ...systemMessages].sort((a, b) => {
      // Handle different timestamp formats (Firestore vs Date.now)
      const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.timestamp || Date.now());
      const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.timestamp || Date.now());
      return timeA - timeB;
  });

  // 3. AUTO SCROLL
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [combinedMessages]);

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
    <div className="w-full h-[100dvh] bg-[#0b0f19] grid grid-cols-1 md:grid-cols-[300px_1fr] overflow-hidden font-sans">
      
      {/* 🛑 SIDEBAR (ACTIVE USERS) */}
      <div className="hidden md:flex flex-col h-full bg-black/20 backdrop-blur-xl border-r border-white/5 z-20 overflow-hidden">
           <div className="p-6 border-b border-white/5 bg-white/5 backdrop-blur-md">
             <h2 className="font-bold text-white text-lg">Room: {roomId}</h2>
             <button onClick={() => navigate("/")} className="mt-4 w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 transition flex items-center justify-center gap-2 border border-white/5">
                 ← Dashboard
             </button>
          </div>
          <div className="p-5 pb-2"><h3 className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Active Users ({userList.length})</h3></div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {userList.map((u, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-transparent hover:border-emerald-500/30 hover:bg-white/10 transition-all cursor-default animate-fade-in-up">
                      <div className="w-8 h-8 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-full flex items-center justify-center font-bold text-white shadow-lg text-xs">{u.charAt(0)}</div>
                      <p className="text-gray-200 text-sm font-medium truncate">{u}</p>
                  </div>
              ))}
          </div>
      </div>

      {/* 💬 MAIN CHAT AREA */}
      <div className="h-full flex flex-col relative z-10 w-full overflow-hidden">
        
        {/* HEADER */}
        <div className="h-16 bg-black/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 z-30 shadow-sm shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate("/")} className="md:hidden text-gray-400 hover:text-white transition p-2">←</button>
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">#</div>
                <div>
                    <h2 className="font-bold text-white text-lg tracking-wide">Public Room</h2>
                    <p className="text-xs text-emerald-400 font-medium tracking-wide">{userList.length} Online</p>
                </div>
            </div>
        </div>

        {/* MESSAGES LIST */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-2 custom-scrollbar bg-transparent min-h-0">
            {combinedMessages.map((msg, index) => {
              const isMyMessage = userData.realName === msg.author;
              const isSystem = msg.isSystem || msg.author === "System";

              const msgDate = msg.fullDate ? new Date(msg.fullDate).toDateString() : null;
              const showDate = msgDate && msgDate !== lastDate;
              if (msgDate) lastDate = msgDate;

              // 🛑 SYSTEM MESSAGE (User Left/Joined)
              if (isSystem) {
                  return (
                    <div key={index} className="flex justify-center my-4 opacity-80 animate-fade-in">
                        <span className="bg-white/5 border border-white/10 text-gray-400 text-[10px] px-3 py-1 rounded-full font-mono tracking-wider">
                           {msg.message}
                        </span>
                    </div>
                  );
              }

              return (
                <div key={index}>
                    {showDate && !isSystem && (
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
                        
                        <div className={`max-w-[85%] md:max-w-[60%] min-w-[120px] px-5 py-3 rounded-2xl text-[15px] shadow-2xl backdrop-blur-md relative border 
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
        <div className="w-full bg-black/60 backdrop-blur-2xl border-t border-white/10 p-3 shrink-0 z-30 flex items-center gap-2">
            {showEmoji && <div className="absolute bottom-20 left-4 z-50"><EmojiPicker onEmojiClick={(e)=>setCurrentMessage(prev=>prev+e.emoji)} theme="dark" height={350}/></div>}
            
            <button onClick={() => setShowEmoji(!showEmoji)} className="text-lg text-gray-400 p-3 hover:text-yellow-400 hover:bg-white/5 rounded-full transition">😊</button>
            
            <input type="text" value={currentMessage} placeholder="Message Room..." 
                className="flex-1 bg-white/5 text-white p-3 rounded-full outline-none border border-white/10 focus:border-blue-500/50 transition-all placeholder-gray-500"
                onChange={(e) => setCurrentMessage(e.target.value)} onKeyPress={(e) => { e.key === "Enter" && sendMessage(); }} />
            
            <button onClick={sendMessage} className="bg-blue-600 hover:bg-blue-500 p-3 rounded-full text-white shadow-lg transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
            </button>
        </div>
      </div>
      
      <style>{`
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
}

export default GroupChat;