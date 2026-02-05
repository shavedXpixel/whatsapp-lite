import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { 
  doc, getDoc, setDoc, updateDoc, serverTimestamp, 
  collection, addDoc, query, orderBy, onSnapshot 
} from "firebase/firestore";

// 🎵 SOUND EFFECT
const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3";

// 🆔 PROFILE MODAL
const ProfileModal = ({ user, onClose }) => {
  if (!user) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-[#1e293b] border border-white/10 p-6 rounded-3xl shadow-2xl max-w-sm w-full relative flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
        <img src={user.photo || user.photoURL} className="w-32 h-32 rounded-full object-cover border-4 border-[#1e293b] mb-4 shadow-lg" />
        <h2 className="text-2xl font-bold text-white">{user.name || user.displayName || user.realName}</h2>
        <div className="w-full bg-black/20 rounded-xl p-4 text-center border border-white/5 mt-4">
            <p className="text-gray-400 text-xs uppercase font-bold mb-1">About</p>
            <p className="text-gray-200 italic">"{user.about || "No status set."}"</p>
        </div>
      </div>
    </div>
  );
};

const MessageStatus = ({ status, isMyMessage }) => {
  if (!isMyMessage) return null;
  if (status === "sent") return <span className="text-white/40 text-[10px] ml-1">✓</span>;
  if (status === "read") return <span className="text-cyan-400 text-[10px] ml-1">✓✓</span>;
  return <span className="text-white/40 text-[10px] ml-1">✓</span>; 
};

const TypingIndicator = () => (
    <div className="flex items-center gap-1 bg-white/5 p-3 rounded-2xl rounded-tl-none w-fit mb-4 ml-4 border border-white/5">
      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
    </div>
);

function PersonalChat({ userData, socket }) {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [currentMessage, setCurrentMessage] = useState("");
  const [messageList, setMessageList] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [otherUser, setOtherUser] = useState(null); 
  const [showProfile, setShowProfile] = useState(false);
  
  const notificationAudio = useRef(new Audio(NOTIFICATION_SOUND));
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null); // 📸 REF FOR FILE INPUT

  // 1. SETUP
  useEffect(() => {
    if (userData && roomId) {
       socket.emit("join_room", { room: roomId, username: userData.realName });

       const ids = roomId.split("_");
       const otherUid = ids[0] === userData.uid ? ids[1] : ids[0];
       getDoc(doc(db, "users", otherUid)).then(snap => {
           if(snap.exists()) setOtherUser(snap.data());
       });

       const q = query(collection(db, "chats", roomId, "messages"), orderBy("createdAt", "asc"));
       const unsubscribe = onSnapshot(q, (snapshot) => {
           const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
           setMessageList(msgs);
           
           if (msgs.length > 0) {
               const lastMsg = msgs[msgs.length - 1];
               if (lastMsg.author !== userData.realName) {
                   updateDoc(doc(db, "userChats", userData.uid), { [`${roomId}.unread`]: false }).catch(()=>{});
                   notificationAudio.current.play().catch(()=>{}); 
               }
           }
       });

       return () => unsubscribe();
    }
  }, [roomId, userData]);

  // 2. TYPING LISTENERS
  useEffect(() => {
    socket.on("display_typing", (user) => setTypingUser(user));
    socket.on("hide_typing", () => setTypingUser(""));
    return () => { socket.off("display_typing"); socket.off("hide_typing"); };
  }, [socket]);

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [messageList, typingUser]);

  // 📸 HANDLE IMAGE SELECTION
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
        alert("Image too large! Please send images under 500KB.");
        return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        await sendMessage(reader.result, "image"); // Send as Image Type
    };
  };

  const sendMessage = async (content = currentMessage, type = "text") => {
    if (type === "text" && content.trim() === "") return;
    
    const messageData = {
        room: roomId,
        author: userData.realName,
        photo: userData.photoURL,
        message: type === "text" ? content : "📷 Image", // Fallback text for sidebar
        image: type === "image" ? content : null,        // Store Base64 here
        type: type,                                      // 'text' or 'image'
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fullDate: new Date().toISOString(),
        createdAt: serverTimestamp(),
        status: "sent"
    };

    await addDoc(collection(db, "chats", roomId, "messages"), messageData);
    
    // Update Sidebar Logic
    const ids = roomId.split("_");
    const otherUid = ids[0] === userData.uid ? ids[1] : ids[0];
    
    const chatUpdate = { 
        lastMessage: type === "text" ? content : "📷 Image", 
        date: serverTimestamp() 
    };

    const myChatRef = doc(db, "userChats", userData.uid);
    setDoc(myChatRef, { [roomId]: { userInfo: { uid: otherUid }, unread: false, ...chatUpdate }}, { merge: true });

    const theirChatRef = doc(db, "userChats", otherUid);
    setDoc(theirChatRef, { [roomId]: { 
        userInfo: { uid: userData.uid, displayName: userData.realName, photoURL: userData.photoURL }, 
        unread: true, ...chatUpdate 
    }}, { merge: true });

    if (type === "text") setCurrentMessage("");
    socket.emit("stop_typing", roomId);
  };

  const handleTyping = (e) => {
    setCurrentMessage(e.target.value);
    socket.emit("typing", { room: roomId, username: userData.realName });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => socket.emit("stop_typing", roomId), 2000);
  };

  if (!userData) return <div className="h-screen bg-black flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="fixed inset-0 bg-[#0b0f19] flex flex-col font-sans">
        
        {/* HEADER */}
        <div className="h-14 md:h-16 bg-black/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 z-30 shrink-0">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate("/")} className="text-gray-300 text-xl p-2 hover:bg-white/5 rounded-full">←</button>
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowProfile(true)}>
                    <img src={otherUser?.photoURL} className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover border border-white/10" />
                    <div>
                        <h2 className="font-bold text-white text-sm md:text-lg">{otherUser?.realName || "User"}</h2>
                        <p className="text-[10px] md:text-xs text-gray-400">{typingUser ? "Typing..." : "Encrypted Connection"}</p>
                    </div>
                </div>
            </div>
            <button onClick={() => navigate("/")} className="text-[10px] md:text-xs px-3 py-2 rounded-lg bg-blue-900/20 text-blue-300 border border-blue-500/20">Dashboard</button>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-24 custom-scrollbar">
            {messageList.map((msg, idx) => {
                const isMe = msg.author === userData.realName;
                return (
                    <div key={idx} className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${isMe ? "bg-blue-600 text-white rounded-br-none" : "bg-white/10 text-gray-200 rounded-bl-none"}`}>
                            
                            {/* 🖼️ IMAGE MESSAGE */}
                            {msg.type === "image" ? (
                                <img src={msg.image} className="w-full max-w-[200px] rounded-lg mb-1 border border-white/10" alt="sent" />
                            ) : (
                                <p>{msg.message}</p>
                            )}

                            <div className="flex justify-end gap-1 mt-1 opacity-70 text-[10px]">
                                <span>{msg.time}</span>
                                <MessageStatus isMyMessage={isMe} status={msg.status} />
                            </div>
                        </div>
                    </div>
                )
            })}
            {typingUser && typingUser !== userData.realName && <TypingIndicator />}
            <div ref={bottomRef} />
        </div>

        {/* INPUT - With Paperclip */}
        <div className="fixed bottom-0 left-0 w-full bg-[#0b0f19] border-t border-white/10 p-3 flex gap-2 z-40 pb-safe">
            
            {/* 📸 HIDDEN FILE INPUT */}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
            
            {/* 📎 ATTACHMENT BUTTON */}
            <button onClick={() => fileInputRef.current.click()} className="text-gray-400 hover:text-white p-3 rounded-full hover:bg-white/5 transition">
                📎
            </button>

            <input className="flex-1 bg-white/5 text-white p-3 rounded-full outline-none text-sm border border-white/5 focus:border-blue-500/50 transition-all placeholder-gray-500" 
                placeholder="Type a message..." value={currentMessage} onChange={handleTyping} 
                onKeyPress={(e) => e.key === "Enter" && sendMessage()} />
            
            <button onClick={() => sendMessage()} className="bg-blue-600 w-12 h-12 rounded-full text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform hover:bg-blue-500">
                <span className="-ml-0.5 text-lg">➤</span>
            </button>
        </div>

        {showProfile && <ProfileModal user={otherUser} onClose={() => setShowProfile(false)} />}

        <style>{`
            .pb-safe { padding-bottom: env(safe-area-inset-bottom); } 
            body { background-color: #0b0f19; }
        `}</style>
    </div>
  );
}

export default PersonalChat;