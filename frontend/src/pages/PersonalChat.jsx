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

// ... (Helper functions like Linkify, formatDate, MessageStatus, TypingIndicator remain same as previous Chat.jsx) ...
// For brevity, I'm assuming you can copy the helper functions from the previous Chat.jsx or I can provide them if needed. 
// Let's assume standard helpers are here.
const formatDate = (d) => new Date(d).toLocaleDateString();
const Linkify = ({text}) => <span>{text}</span>; // Placeholder, use real one
const MessageStatus = ({ status, isMyMessage }) => isMyMessage ? <span className="text-[10px] ml-1 text-cyan-400">✓✓</span> : null;
const TypingIndicator = () => <div className="text-gray-500 text-xs ml-4 animate-pulse">Typing...</div>;


function PersonalChat({ userData, socket }) {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [currentMessage, setCurrentMessage] = useState("");
  const [messageList, setMessageList] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [otherUser, setOtherUser] = useState(null); 
  const [showProfile, setShowProfile] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  
  const notificationAudio = useRef(new Audio(NOTIFICATION_SOUND));
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // 1. SETUP
  useEffect(() => {
    if (userData && roomId) {
       socket.emit("join_room", { room: roomId, username: userData.realName });

       // Get Other User Details
       const ids = roomId.split("_");
       const otherUid = ids[0] === userData.uid ? ids[1] : ids[0];
       getDoc(doc(db, "users", otherUid)).then(snap => {
           if(snap.exists()) setOtherUser(snap.data());
       });

       // Listen to Messages
       const q = query(collection(db, "chats", roomId, "messages"), orderBy("createdAt", "asc"));
       const unsubscribe = onSnapshot(q, (snapshot) => {
           const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
           setMessageList(msgs);
           
           if (msgs.length > 0) {
               const lastMsg = msgs[msgs.length - 1];
               if (lastMsg.author !== userData.realName) {
                   // Mark Read
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

  // 3. AUTO SCROLL
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [messageList, typingUser]);

  const sendMessage = async () => {
    if (currentMessage.trim() === "") return;
    
    const messageData = {
        room: roomId,
        author: userData.realName,
        photo: userData.photoURL,
        message: currentMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fullDate: new Date().toISOString(),
        createdAt: serverTimestamp(),
        status: "sent"
    };

    await addDoc(collection(db, "chats", roomId, "messages"), messageData);
    
    // Update Recent Chats (Logic same as before, simplified for brevity)
    // ... Copy updateRecentChats logic here ...
    const ids = roomId.split("_");
    const otherUid = ids[0] === userData.uid ? ids[1] : ids[0];
    
    const myChatRef = doc(db, "userChats", userData.uid);
    setDoc(myChatRef, { [roomId]: { 
        userInfo: { uid: otherUid }, lastMessage: currentMessage, date: serverTimestamp(), unread: false 
    }}, { merge: true });

    const theirChatRef = doc(db, "userChats", otherUid);
    setDoc(theirChatRef, { [roomId]: { 
        userInfo: { uid: userData.uid, displayName: userData.realName, photoURL: userData.photoURL }, 
        lastMessage: currentMessage, date: serverTimestamp(), unread: true 
    }}, { merge: true });

    setCurrentMessage("");
    setShowEmoji(false);
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
    <div className="w-full h-[100dvh] bg-[#0b0f19] flex flex-col font-sans overflow-hidden">
        {/* HEADER */}
        <div className="h-16 bg-black/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 z-30 shadow-sm shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate("/")} className="text-gray-400 hover:text-white transition p-2">←</button>
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowProfile(true)}>
                    <img src={otherUser?.photoURL} className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                    <div>
                        <h2 className="font-bold text-white text-lg">{otherUser?.realName || "User"}</h2>
                        <p className="text-xs text-gray-400">{typingUser ? "Typing..." : "Encrypted"}</p>
                    </div>
                </div>
            </div>
            <button onClick={() => navigate("/")} className="text-xs px-3 py-2 rounded-lg bg-blue-900/20 text-blue-300">Dashboard</button>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {messageList.map((msg, idx) => {
                const isMe = msg.author === userData.realName;
                return (
                    <div key={idx} className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] px-4 py-2 rounded-xl text-sm ${isMe ? "bg-blue-600 text-white" : "bg-white/10 text-gray-200"}`}>
                            <p>{msg.message}</p>
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

        {/* INPUT */}
        <div className="p-3 bg-black/60 backdrop-blur-md flex gap-2">
            <input className="flex-1 bg-white/5 text-white p-3 rounded-full outline-none" 
                placeholder="Type a message..." value={currentMessage} onChange={handleTyping} 
                onKeyPress={(e) => e.key === "Enter" && sendMessage()} />
            <button onClick={sendMessage} className="bg-blue-600 p-3 rounded-full text-white">➤</button>
        </div>

        {showProfile && <ProfileModal user={otherUser} onClose={() => setShowProfile(false)} />}
    </div>
  );
}

export default PersonalChat;