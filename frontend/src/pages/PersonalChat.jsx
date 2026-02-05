import { useState, useEffect, useRef, useLayoutEffect } from "react";
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

// ==========================================
// 1. 📹 VIDEO CALL UI (Full Screen)
// ==========================================
const VideoCallScreen = ({ localStream, remoteStream, onEnd, toggleMic, toggleVideo, isMicOn, isVideoOn }) => {
    const myVideo = useRef();
    const userVideo = useRef();

    useEffect(() => { if (myVideo.current && localStream) myVideo.current.srcObject = localStream; }, [localStream]);
    useEffect(() => { if (userVideo.current && remoteStream) userVideo.current.srcObject = remoteStream; }, [remoteStream]);

    return (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center animate-fade-in">
            <div className="absolute inset-0 w-full h-full">
                {remoteStream ? <video ref={userVideo} autoPlay playsInline className="w-full h-full object-cover transform scale-x-[-1]" /> : <div className="flex items-center justify-center h-full text-white animate-pulse">Connecting Video...</div>}
            </div>
            <div className="absolute bottom-24 right-4 w-32 h-48 md:w-48 md:h-64 bg-gray-900 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-10">
                <video ref={myVideo} autoPlay playsInline muted className={`w-full h-full object-cover transform scale-x-[-1] ${!isVideoOn ? 'hidden' : ''}`} />
                {!isVideoOn && <div className="absolute inset-0 flex items-center justify-center text-2xl">🚫</div>}
            </div>
            <div className="absolute bottom-6 flex items-center gap-6 p-4 bg-black/40 backdrop-blur-md rounded-full border border-white/10 z-20">
                <button onClick={toggleMic} className={`p-4 rounded-full transition ${isMicOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 text-white'}`}>{isMicOn ? "🎤" : "🔇"}</button>
                <button onClick={onEnd} className="p-4 bg-red-600 rounded-full hover:bg-red-500 transition shadow-lg transform hover:scale-110"><svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24" strokeWidth={0} stroke="currentColor" className="w-6 h-6"><path d="M20.25 6.75l-2.25-2.25-6 6-6-6-2.25 2.25 6 6-6 6 2.25-2.25-6-6 6 6 2.25-2.25-6-6 6-6z" /></svg></button>
                <button onClick={toggleVideo} className={`p-4 rounded-full transition ${isVideoOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 text-white'}`}>{isVideoOn ? "📹" : "🚫"}</button>
            </div>
        </div>
    );
};

// ==========================================
// 2. 📞 AUDIO CALL UI (Phone Screen)
// ==========================================
const AudioCallScreen = ({ otherUser, incomingCaller, onEnd, toggleMic, isMicOn, onForceAudio }) => {
    const displayUser = incomingCaller || otherUser;
    const displayName = displayUser?.realName || displayUser?.name || "Unknown User";
    const displayPhoto = displayUser?.photoURL || displayUser?.photo || "https://cdn-icons-png.flaticon.com/512/149/149071.png";

    return (
        <div className="fixed inset-0 z-[200] bg-[#0f172a] flex flex-col items-center justify-center animate-fade-in">
             <div className="relative mb-8">
                <div className="absolute inset-0 bg-green-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
                <img src={displayPhoto} className="relative w-40 h-40 rounded-full border-4 border-[#1e293b] object-cover z-10 shadow-2xl" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">{displayName}</h2>
            <p className="text-green-400 font-mono tracking-widest uppercase text-sm mb-12 animate-pulse">Audio Call Connected</p>

            {/* FORCE AUDIO BUTTON (Important for Audio Calls) */}
            <button onClick={onForceAudio} className="mb-8 px-6 py-2 bg-white/5 rounded-full text-xs text-blue-300 border border-blue-500/30 hover:bg-white/10">🔊 Tap if no sound</button>

            <div className="flex items-center gap-8">
                <button onClick={toggleMic} className={`p-6 rounded-full transition shadow-xl ${isMicOn ? 'bg-[#1e293b] hover:bg-[#334155]' : 'bg-white text-black'}`}>
                     <span className="text-2xl">{isMicOn ? "🎤" : "🔇"}</span>
                </button>
                <button onClick={onEnd} className="p-6 bg-red-500 rounded-full hover:bg-red-600 transition shadow-xl transform hover:scale-110">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24" strokeWidth={0} stroke="currentColor" className="w-8 h-8"><path d="M20.25 6.75l-2.25-2.25-6 6-6-6-2.25 2.25 6 6-6 6 2.25-2.25-6-6 6 6 2.25-2.25-6-6 6-6z" /></svg>
                </button>
            </div>
        </div>
    );
};

// ==========================================
// 3. 🔔 INCOMING / DIALING MODAL
// ==========================================
const CallModal = ({ callStatus, callType, otherUser, incomingCaller, onAnswer, onReject }) => {
    if (callStatus === "idle" || callStatus === "connected") return null;

    const displayUser = incomingCaller || otherUser;
    const displayName = displayUser?.realName || displayUser?.name || "Unknown User";
    const displayPhoto = displayUser?.photoURL || displayUser?.photo || "https://cdn-icons-png.flaticon.com/512/149/149071.png";

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in p-4">
            <div className="flex flex-col items-center gap-6 p-8 bg-[#1e293b] rounded-3xl border border-white/10 w-full max-w-sm shadow-2xl">
                <div className="relative">
                    <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl animate-pulse"></div>
                    <img src={displayPhoto} className="relative w-28 h-28 rounded-full border-4 border-[#0f172a] object-cover z-10" />
                </div>
                <h2 className="text-2xl font-bold text-white mt-2">{displayName}</h2>
                <div className="flex flex-col items-center gap-1">
                    <p className="text-blue-400 font-mono tracking-widest uppercase text-xs animate-pulse">
                        {callStatus === "calling" ? "Dialing..." : "Incoming Call..."}
                    </p>
                    <span className="text-xs bg-white/10 px-2 py-1 rounded text-gray-300">
                        {callType === "video" ? "📹 Video Call" : "📞 Audio Call"}
                    </span>
                </div>

                <div className="flex items-center gap-8 mt-4">
                    {callStatus === "incoming" && (
                        <button onClick={onAnswer} className="w-16 h-16 shrink-0 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition animate-bounce">
                            <span className="text-2xl">{callType === "video" ? "📹" : "📞"}</span>
                        </button>
                    )}
                    <button onClick={onReject} className="w-16 h-16 shrink-0 bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition hover:bg-red-600">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24" strokeWidth={0} stroke="currentColor" className="w-8 h-8"><path d="M20.25 6.75l-2.25-2.25-6 6-6-6-2.25 2.25 6 6-6 6 2.25-2.25-6-6 6 6 2.25-2.25-6-6 6-6z" /></svg>
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
  const [callType, setCallType] = useState("audio"); // 'audio' or 'video'
  const [callerSignal, setCallerSignal] = useState(null);
  const [incomingCaller, setIncomingCaller] = useState(null);
  
  // 🎥 MEDIA STATES
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);

  const notificationAudio = useRef(new Audio(NOTIFICATION_SOUND));
  const ringtoneAudio = useRef(new Audio(RINGTONE_SOUND));
  const userAudio = useRef(); 
  const connectionRef = useRef();
  
  // 🛠️ REFS
  const bottomRef = useRef(null);
  const scrollContainerRef = useRef(null); 
  const lastMessageIdRef = useRef(null);    
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const prevMessageListLength = useRef(0);
  const isInitialLoad = useRef(true); 

  useEffect(() => {
    if (userData && roomId) {
       socket.emit("setup", userData);
       socket.emit("join_room", { room: roomId, username: userData.realName });

       const ids = roomId.split("_");
       const otherUid = ids[0] === userData.uid ? ids[1] : ids[0];
       
       getDoc(doc(db, "users", otherUid)).then(snap => { if(snap.exists()) setOtherUser(snap.data()); });

       const q = query(collection(db, "chats", roomId, "messages"), orderBy("createdAt", "asc"));
       const unsubscribe = onSnapshot(q, (snapshot) => {
           const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
           setMessageList(msgs);
           
           if (isInitialLoad.current) {
               if(msgs.length > 0) lastMessageIdRef.current = msgs[msgs.length - 1].id;
               isInitialLoad.current = false;
               return; 
           }

           if (msgs.length > 0) {
               const lastMsg = msgs[msgs.length - 1];
               if (lastMsg.id !== lastMessageIdRef.current) {
                   lastMessageIdRef.current = lastMsg.id; 
                   const isMyMessage = lastMsg.uid ? (lastMsg.uid === userData.uid) : (lastMsg.author === userData.realName);
                   if (!isMyMessage) {
                       updateDoc(doc(db, "userChats", userData.uid), { [`${roomId}.unread`]: false }).catch(()=>{});
                       if(document.visibilityState === "hidden") notificationAudio.current.play().catch(()=>{}); 
                   }
               }
           }
       });

       // 📞 LISTEN FOR INCOMING CALLS
       socket.off("callUser"); 
       socket.on("callUser", (data) => {
           if (data.from === userData.uid) return;
           const callerPhoto = (data.from === otherUid && otherUser?.photoURL) ? otherUser.photoURL : "https://cdn-icons-png.flaticon.com/512/149/149071.png";
           setIncomingCaller({ realName: data.name, uid: data.from, photoURL: callerPhoto });
           setCallStatus("incoming");
           setCallType(data.callType || "audio"); // 🆕 Read call type
           setCallerSignal(data.signal);
           ringtoneAudio.current.loop = true;
           ringtoneAudio.current.play().catch(() => {});
       });

       socket.off("callAccepted");
       socket.on("callAccepted", (signal) => {
           setCallStatus("connected");
           if(connectionRef.current) connectionRef.current.signal(signal);
       });

       socket.off("callEnded");
       socket.on("callEnded", () => leaveCall());

       return () => { 
           unsubscribe(); 
           socket.off("callUser"); 
           socket.off("callAccepted"); 
           socket.off("callEnded");
       };
    }
  }, [roomId, userData, otherUser]);

  useLayoutEffect(() => {
      const container = scrollContainerRef.current;
      const currentLength = messageList.length;
      if (container && currentLength > prevMessageListLength.current) {
          const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
          if (prevMessageListLength.current === 0 || isNearBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
      prevMessageListLength.current = currentLength;
  }, [messageList]);

  const createPeer = (initiator, stream, type) => {
      const peer = new Peer({ 
          initiator: initiator, 
          trickle: false, 
          stream: stream,
          config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
      });

      peer.on("signal", (data) => {
          const ids = roomId.split("_");
          const otherUid = ids[0] === userData.uid ? ids[1] : ids[0];
          if(initiator) {
              // 🆕 Send callType along with signal
              socket.emit("callUser", { 
                  userToCall: otherUid, 
                  signalData: data, 
                  from: userData.uid, 
                  name: userData.realName,
                  callType: type 
              });
          } else {
              const targetId = incomingCaller?.uid || otherUid;
              socket.emit("answerCall", { signal: data, to: targetId }); 
          }
      });

      peer.on("stream", (stream) => {
          setRemoteStream(stream); 
          if(userAudio.current) { // Ensure audio plays for both modes
               userAudio.current.srcObject = stream;
               userAudio.current.play().catch(e => console.log("Autoplay blocked"));
          }
      });

      return peer;
  };

  // 🏁 START CALL (Takes Type: 'audio' or 'video')
  const startCall = (type) => {
      setCallStatus("calling");
      setCallType(type);
      const constraints = { video: type === "video", audio: true };

      navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
          setLocalStream(stream);
          connectionRef.current = createPeer(true, stream, type);
      }).catch(err => {
          alert("Permission Error: " + err.message);
          setCallStatus("idle");
      });
  };

  const answerCall = () => {
      setCallStatus("connected");
      ringtoneAudio.current.pause();
      // 🆕 Request media based on incoming call type
      const constraints = { video: callType === "video", audio: true };

      navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
          setLocalStream(stream);
          const peer = createPeer(false, stream, callType);
          peer.signal(callerSignal);
          connectionRef.current = peer;
      });
  };

  const leaveCall = () => {
      setCallStatus("idle");
      setIncomingCaller(null);
      setLocalStream(null);
      setRemoteStream(null);
      ringtoneAudio.current.pause();
      if (connectionRef.current) connectionRef.current.destroy();
      
      // Stop all tracks
      if (localStream) localStream.getTracks().forEach(track => track.stop());

      const ids = roomId.split("_");
      const otherUid = ids[0] === userData.uid ? ids[1] : ids[0];
      socket.emit("endCall", { to: incomingCaller?.uid || otherUid }); 
      window.location.reload(); 
  };

  // 🎛️ CONTROLS
  const toggleMic = () => {
      if (localStream) {
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) {
              audioTrack.enabled = !audioTrack.enabled;
              setIsMicOn(audioTrack.enabled);
          }
      }
  };

  const toggleVideo = () => {
      if (localStream) {
          const videoTrack = localStream.getVideoTracks()[0];
          if (videoTrack) {
              videoTrack.enabled = !videoTrack.enabled;
              setIsVideoOn(videoTrack.enabled);
          }
      }
  };
  
  const forceAudioPlay = () => {
      if(userAudio.current) userAudio.current.play();
  };

  // ... (Keep handleFileSelect, sendMessage, handleTyping) ...
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
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
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
            
            {/* 🆕 DUAL CALL BUTTONS */}
            <div className="flex items-center gap-2">
                <button onClick={() => startCall('audio')} className="p-3 rounded-full bg-white/5 text-green-400 hover:bg-green-500 hover:text-white transition" title="Voice Call">
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                </button>
                <button onClick={() => startCall('video')} className="p-3 rounded-full bg-white/5 text-blue-400 hover:bg-blue-500 hover:text-white transition" title="Video Call">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /></svg>
                </button>
            </div>
        </div>

        {/* MESSAGES */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-2 pb-24 custom-scrollbar">
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

        {/* 📞 CALL OVERLAYS */}
        
        {/* 1. INCOMING / DIALING SCREEN */}
        <CallModal 
            callStatus={callStatus} 
            callType={callType}
            otherUser={otherUser} 
            incomingCaller={incomingCaller} 
            onAnswer={answerCall} 
            onReject={leaveCall} 
        />
        
        {/* 2. ACTIVE VIDEO CALL */}
        {callStatus === "connected" && callType === "video" && (
            <VideoCallScreen 
                localStream={localStream} 
                remoteStream={remoteStream} 
                onEnd={leaveCall}
                toggleMic={toggleMic}
                toggleVideo={toggleVideo}
                isMicOn={isMicOn}
                isVideoOn={isVideoOn}
            />
        )}

        {/* 3. ACTIVE AUDIO CALL */}
        {callStatus === "connected" && callType === "audio" && (
            <AudioCallScreen 
                otherUser={otherUser}
                incomingCaller={incomingCaller}
                onEnd={leaveCall}
                toggleMic={toggleMic}
                isMicOn={isMicOn}
                onForceAudio={forceAudioPlay}
            />
        )}

        {/* HIDDEN AUDIO ELEMENT FOR AUDIO CALLS */}
        <audio ref={userAudio} autoPlay playsInline controls={false} />

        <style>{`
            .pb-safe { padding-bottom: env(safe-area-inset-bottom); } 
            body { background-color: #0b0f19; }
        `}</style>
    </div>
  );
}

export default PersonalChat;