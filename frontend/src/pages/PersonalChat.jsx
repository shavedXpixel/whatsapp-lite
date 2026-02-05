import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EmojiPicker from "emoji-picker-react";
import Peer from "simple-peer"; 
import { db } from "../firebase";
import { 
  doc, getDoc, setDoc, updateDoc, serverTimestamp, 
  collection, addDoc, query, orderBy, onSnapshot 
} from "firebase/firestore";

// 🎵 SOUNDS
const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3";
const RINGTONE_SOUND = "https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3";

// 📞 CALL MODAL
const CallModal = ({ callStatus, otherUser, onAnswer, onReject, onEnd, debugLogs, onForceAudio }) => {
    if (callStatus === "idle") return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in">
            <div className="flex flex-col items-center gap-6 p-8 bg-white/5 rounded-3xl border border-white/10 w-[90%] max-w-md">
                <div className="relative">
                    <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl animate-pulse"></div>
                    <img src={otherUser?.photoURL} className="relative w-32 h-32 rounded-full border-4 border-black object-cover z-10" />
                </div>
                
                <h2 className="text-2xl font-bold text-white mt-4">{otherUser?.realName}</h2>
                <p className="text-blue-400 font-mono tracking-widest uppercase text-sm animate-pulse">
                    {callStatus === "calling" && "Calling..."}
                    {callStatus === "incoming" && "Incoming Call..."}
                    {callStatus === "connected" && "Connected"}
                </p>

                {/* 🛠️ DEEP DEBUG CONSOLE (Visible to User) */}
                <div className="bg-black/50 p-3 rounded-lg w-full text-[10px] font-mono text-left space-y-1 h-32 overflow-y-auto border border-white/10">
                    <p className="text-gray-400 font-bold border-b border-white/10 mb-1">CONNECTION LOGS:</p>
                    {debugLogs.map((log, i) => (
                        <p key={i} className={log.includes("ERROR") ? "text-red-400" : "text-green-400"}>
                            {">"} {log}
                        </p>
                    ))}
                </div>

                {callStatus === "connected" && (
                     <button onClick={onForceAudio} className="w-full bg-blue-600 py-3 rounded-xl font-bold text-white shadow-lg hover:bg-blue-500 transition">
                         🔊 Tap to Hear Audio
                     </button>
                )}

                <div className="flex gap-8 mt-4">
                    {callStatus === "incoming" && (
                        <button onClick={onAnswer} className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition animate-bounce">📞</button>
                    )}
                    <button onClick={callStatus === "incoming" ? onReject : onEnd} className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m-10.5-2.394l-.375.375-1.5-1.5.375-.375m4.875 13.5l.375.375 1.5-1.5-.375-.375m-6.375-3.375l-.375.375-1.5-1.5.375-.375m17.505-5.32c.507.094 1.01.216 1.503.364M3.75 20.25h16.5" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

// ... MessageStatus & TypingIndicator (Keep same) ...
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
  const [showEmoji, setShowEmoji] = useState(false);
  
  // 📞 CALL STATES
  const [callStatus, setCallStatus] = useState("idle"); 
  const [callerSignal, setCallerSignal] = useState(null);
  const [logs, setLogs] = useState([]); // Array of logs
  
  const notificationAudio = useRef(new Audio(NOTIFICATION_SOUND));
  const ringtoneAudio = useRef(new Audio(RINGTONE_SOUND));
  const userAudio = useRef(); 
  const connectionRef = useRef();
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  // 📝 LOGGING FUNCTION
  const addLog = (msg) => {
      console.log(msg);
      setLogs(prev => [...prev.slice(-4), msg]); // Keep last 5 logs
  };

  useEffect(() => {
    if (userData && roomId) {
       socket.emit("join_room", { room: roomId, username: userData.realName });

       const ids = roomId.split("_");
       const otherUid = ids[0] === userData.uid ? ids[1] : ids[0];
       getDoc(doc(db, "users", otherUid)).then(snap => { if(snap.exists()) setOtherUser(snap.data()); });

       const q = query(collection(db, "chats", roomId, "messages"), orderBy("createdAt", "asc"));
       const unsubscribe = onSnapshot(q, (snapshot) => {
           const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
           setMessageList(msgs);
       });

       socket.on("callUser", (data) => {
           setCallStatus("incoming");
           setCallerSignal(data.signal);
           ringtoneAudio.current.loop = true;
           ringtoneAudio.current.play().catch(() => {});
           addLog("📞 Incoming Call...");
       });

       socket.on("callAccepted", (signal) => {
           setCallStatus("connected");
           addLog("✅ Call Accepted by User");
           if(connectionRef.current) connectionRef.current.signal(signal);
       });

       socket.on("callEnded", () => leaveCall());

       return () => { 
           unsubscribe(); 
           socket.off("callUser"); 
           socket.off("callAccepted");
           socket.off("callEnded");
       };
    }
  }, [roomId, userData]);

  const forceAudioPlay = () => {
      if(userAudio.current) {
          userAudio.current.play()
             .then(() => addLog("🔊 Force Play Success"))
             .catch(e => addLog("❌ Force Play Failed: " + e.message));
      }
  };

  const createPeer = (initiator, stream) => {
      addLog(`🛠 Creating Peer (Initiator: ${initiator})`);
      const peer = new Peer({ 
          initiator: initiator, 
          trickle: false, 
          stream: stream,
          config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }] }
      });

      peer.on("signal", (data) => {
          addLog("📡 Signal Generated");
          if(initiator) socket.emit("callUser", { userToCall: roomId, signalData: data, from: userData.uid, name: userData.realName });
          else socket.emit("answerCall", { signal: data, to: roomId });
      });

      peer.on("connect", () => {
          addLog("🤝 P2P Connection Established!");
      });

      peer.on("stream", (remoteStream) => {
          addLog("🌊 Remote Stream Received!");
          addLog(`Tracks: ${remoteStream.getAudioTracks().length}`);
          
          if (userAudio.current) {
              userAudio.current.srcObject = remoteStream;
              userAudio.current.play().catch(e => addLog("⚠️ Auto-Play Blocked: " + e.message));
          }
      });

      peer.on("error", (err) => {
          addLog("❌ Peer Error: " + err.message);
      });

      return peer;
  };

  const callUser = () => {
      setCallStatus("calling");
      setLogs([]); // Clear logs
      navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then((stream) => {
          addLog("🎤 Mic Access Granted");
          connectionRef.current = createPeer(true, stream);
      }).catch(err => {
          addLog("❌ Mic Error: " + err.message);
          alert("Microphone Access Denied. Check Browser Settings.");
          setCallStatus("idle");
      });
  };

  const answerCall = () => {
      setCallStatus("connected");
      setLogs([]); // Clear logs
      ringtoneAudio.current.pause();
      
      navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then((stream) => {
          addLog("🎤 Mic Access Granted");
          const peer = createPeer(false, stream);
          peer.signal(callerSignal);
          connectionRef.current = peer;
      }).catch(err => addLog("❌ Mic Error: " + err.message));
  };

  const leaveCall = () => {
      setCallStatus("idle");
      ringtoneAudio.current.pause();
      if (connectionRef.current) connectionRef.current.destroy();
      socket.emit("endCall", { to: roomId });
      window.location.reload(); 
  };

  // ... (Keep sendMessage, handleTyping, handleFileSelect from before) ...
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert("Image too large! Please send images under 500KB."); return; }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => { await sendMessage(reader.result, "image"); };
  };

  const sendMessage = async (content = currentMessage, type = "text") => {
    if (type === "text" && content.trim() === "") return;
    const messageData = {
        room: roomId, author: userData.realName, uid: userData.uid, photo: userData.photoURL,
        message: type === "text" ? content : "📷 Image", image: type === "image" ? content : null, type: type,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), fullDate: new Date().toISOString(),
        createdAt: serverTimestamp(), status: "sent"
    };
    await addDoc(collection(db, "chats", roomId, "messages"), messageData);
    const ids = roomId.split("_");
    const otherUid = ids[0] === userData.uid ? ids[1] : ids[0];
    const chatUpdate = { lastMessage: type === "text" ? content : "📷 Image", date: serverTimestamp() };
    setDoc(doc(db, "userChats", userData.uid), { [roomId]: { userInfo: { uid: otherUid }, unread: false, ...chatUpdate }}, { merge: true });
    setDoc(doc(db, "userChats", otherUid), { [roomId]: { userInfo: { uid: userData.uid, displayName: userData.realName, photoURL: userData.photoURL }, unread: true, ...chatUpdate }}, { merge: true });
    if (type === "text") setCurrentMessage("");
    setShowEmoji(false);
    socket.emit("stop_typing", roomId);
  };

  const handleTyping = (e) => {
    setCurrentMessage(e.target.value);
    socket.emit("typing", { room: roomId, username: userData.realName });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => socket.emit("stop_typing", roomId), 2000);
  };
  
  useEffect(() => {
    socket.on("display_typing", (user) => setTypingUser(user));
    socket.on("hide_typing", () => setTypingUser(""));
    return () => { socket.off("display_typing"); socket.off("hide_typing"); };
  }, [socket]);
  
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [messageList, typingUser]);

  if (!userData) return <div className="h-screen bg-black flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="fixed inset-0 bg-[#0b0f19] flex flex-col font-sans">
        
        {/* HEADER */}
        <div className="h-14 md:h-16 bg-black/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 z-30 shrink-0">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate("/")} className="text-gray-300 text-xl p-2 hover:bg-white/5 rounded-full">←</button>
                <div className="flex items-center gap-3">
                    <img src={otherUser?.photoURL} className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover border border-white/10" />
                    <div>
                        <h2 className="font-bold text-white text-sm md:text-lg">{otherUser?.realName || "User"}</h2>
                        <p className="text-[10px] md:text-xs text-gray-400">{typingUser ? "Typing..." : "Encrypted Connection"}</p>
                    </div>
                </div>
            </div>
            
            <button onClick={callUser} className="p-3 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white transition">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
            </button>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-24 custom-scrollbar">
            {messageList.map((msg, idx) => {
                const isMe = msg.uid ? (msg.uid === userData.uid) : (msg.author === userData.realName);
                return (
                    <div key={idx} className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${isMe ? "bg-blue-600 text-white rounded-br-none" : "bg-white/10 text-gray-200 rounded-bl-none"}`}>
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

        {/* INPUT */}
        <div className="fixed bottom-0 left-0 w-full bg-[#0b0f19] border-t border-white/10 p-3 flex gap-2 z-40 pb-safe">
            {showEmoji && <div className="absolute bottom-20 left-4 z-50 animate-fade-in-up shadow-2xl rounded-2xl overflow-hidden"><EmojiPicker onEmojiClick={(e)=>setCurrentMessage(prev=>prev+e.emoji)} theme="dark" height={350}/></div>}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
            <button onClick={() => fileInputRef.current.click()} className="text-gray-400 hover:text-white p-3 rounded-full hover:bg-white/5 transition">📎</button>
            <button onClick={() => setShowEmoji(!showEmoji)} className="text-gray-400 hover:text-yellow-400 p-3 rounded-full hover:bg-white/5 transition">😊</button>
            <input className="flex-1 bg-white/5 text-white p-3 rounded-full outline-none text-sm border border-white/5 focus:border-blue-500/50 transition-all placeholder-gray-500" 
                placeholder="Type a message..." value={currentMessage} onChange={handleTyping} onClick={() => setShowEmoji(false)} onKeyPress={(e) => e.key === "Enter" && sendMessage()} />
            <button onClick={() => sendMessage()} className="bg-blue-600 w-12 h-12 rounded-full text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform hover:bg-blue-500"><span className="-ml-0.5 text-lg">➤</span></button>
        </div>

        {/* 📞 CALL MODAL WITH DEBUG */}
        <CallModal callStatus={callStatus} otherUser={otherUser} onAnswer={answerCall} onReject={leaveCall} onEnd={leaveCall} debugLogs={logs} onForceAudio={forceAudioPlay} />
        
        {/* 🔈 REMOTE AUDIO (Hidden but active) */}
        <audio ref={userAudio} autoPlay playsInline controls={false} />

        <style>{`
            .pb-safe { padding-bottom: env(safe-area-inset-bottom); } 
            body { background-color: #0b0f19; }
        `}</style>
    </div>
  );
}

export default PersonalChat;