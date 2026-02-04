import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EmojiPicker from "emoji-picker-react";
import { storage, db } from "../firebase"; // 👈 IMPORT DB
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore"; // 👈 FIRESTORE IMPORTS

// ✅ TICK COMPONENT
const MessageStatus = ({ status, isMyMessage }) => {
  if (!isMyMessage) return null;
  if (status === "sent") return <span className="text-gray-500 text-[10px] ml-1">✓</span>;
  if (status === "delivered") return <span className="text-gray-500 text-[10px] ml-1">✓✓</span>;
  if (status === "read") return <span className="text-blue-500 text-[10px] ml-1">✓✓</span>;
  return <span className="text-gray-500 text-[10px] ml-1">✓</span>; 
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


  // 🆕 HELPER: UPDATE RECENT CHATS LIST IN DATABASE
  const updateRecentChats = async (msgType, msgContent) => {
    // Only works for Private Chats (A_B)
    if (!isDirectMessage) return;

    // 1. Figure out who the OTHER person is
    const ids = roomId.split("_");
    const otherUid = ids[0] === userData.uid ? ids[1] : ids[0];

    const lastMessageText = msgType === "text" ? msgContent : `📷 Sent a ${msgType}`;

    try {
        // A. Update MY list
        const myChatRef = doc(db, "userChats", userData.uid);
        const myChatSnap = await getDoc(myChatRef);

        // Fetch OTHER user's details if we don't have them yet
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
             // Just update message
             await updateDoc(myChatRef, {
                [`${roomId}.lastMessage`]: lastMessageText,
                [`${roomId}.date`]: serverTimestamp()
            });
        }

        // B. Update THEIR list (So I appear on their screen)
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
      
      // 🆕 Update Database
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
        
        // 🆕 Update Database
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

  if (!userData) return <div className="bg-[#0b141a] h-screen flex items-center justify-center text-white font-bold">Loading Chat...</div>;

  return (
    <div className="flex w-full max-w-5xl h-[90vh] bg-[#0b141a] border border-gray-700 rounded-lg overflow-hidden shadow-2xl relative mx-auto mt-5">
      
      {!isDirectMessage && (
        <div className="w-1/3 bg-gray-800 border-r border-gray-700 hidden md:flex flex-col">
           <div className="p-4 bg-gray-750 border-b border-gray-700 flex justify-between items-center bg-[#202c33]">
             <div className="flex items-center gap-2">
               <img src={userData.photoURL} className="w-8 h-8 rounded-full" />
               <span className="font-bold text-gray-200 text-sm">{userData.realName}</span>
             </div>
             <button onClick={() => navigate("/")} className="text-red-400 text-xs hover:text-red-300">Exit</button>
          </div>
          <div className="p-3 bg-[#111b21]"><h3 className="text-green-400 text-xs font-bold uppercase">Active Users</h3></div>
          <div className="flex-1 overflow-y-auto bg-[#111b21]">
              {userList.map((u, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 border-b border-gray-800">
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">{u.charAt(0)}</div>
                      <p className="text-gray-200 text-sm">{u}</p>
                  </div>
              ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col bg-[#0b141a] relative bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat">
        <div className="bg-[#202c33] p-4 flex items-center justify-between shadow-md z-10">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate("/")} className="text-gray-400 text-xl md:hidden">⬅</button>
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                    {isDirectMessage ? "👤" : "#"}
                </div>
                <div>
                    <p className="font-bold text-gray-100">{isDirectMessage ? "Private Chat" : `Room: ${roomId}`}</p>
                    {typingUser && <p className="text-xs text-green-400 animate-pulse">{typingUser} typing...</p>}
                </div>
            </div>
             <button onClick={() => { localStorage.removeItem(`chat_${roomId}`); setMessageList([]); }} className="text-gray-400 text-xs">Clear Chat</button>
             {isDirectMessage && <button onClick={() => navigate("/")} className="text-red-400 text-xs ml-4 border border-red-500 p-1 rounded">Exit</button>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messageList.map((msg, index) => {
              const isMyMessage = userData.realName === msg.author;
              return (
                <div key={index} className={`flex w-full ${isMyMessage ? "justify-end" : "justify-start"}`}>
                    {!isMyMessage && <img src={msg.photo} className="w-6 h-6 rounded-full mr-2 self-start mt-1"/>}
                    <div className={`max-w-[85%] md:max-w-[70%] min-w-[120px] px-3 py-2 rounded-lg text-sm shadow-md relative group ${isMyMessage ? "bg-[#005c4b] text-white" : "bg-[#202c33] text-white"}`}>
                        {!isMyMessage && <p className="text-[10px] font-bold text-orange-400 mb-1">{msg.author}</p>}
                        
                        {msg.type === "image" ? <img src={msg.message} className="max-w-full rounded-lg mb-1" /> :
                         msg.type === "video" ? <video src={msg.message} controls className="max-w-full rounded-lg mb-1" /> :
                         msg.type === "audio" ? <audio src={msg.message} controls className="max-w-[200px] mt-1" /> :
                         <p className="break-words text-[15px] pb-2">{msg.message}</p>}
                        
                        <div className={`flex justify-end items-center mt-1 absolute bottom-1 right-2`}>
                            <p className={`text-[9px] mr-1 ${isMyMessage ? "text-green-200" : "text-gray-400"}`}>{msg.time}</p>
                            <MessageStatus status={msg.status} isMyMessage={isMyMessage} />
                        </div>
                    </div>
                </div>
              );
            })}
            
            {uploading && <div className="text-right text-green-500 text-xs animate-pulse">Sending file...</div>}
            {isRecording && <div className="text-center text-red-500 font-bold animate-pulse">🔴 Recording Audio...</div>}
            
            <div ref={bottomRef} />
        </div>

        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={selectFile} />
        
        <div className="bg-[#202c33] p-2 flex gap-2 items-center z-10">
            <button onClick={() => setShowEmoji(!showEmoji)} className="text-2xl text-gray-400 p-2 hover:text-white">😊</button>
            <button onClick={() => fileInputRef.current.click()} className="text-2xl text-gray-400 p-2 hover:text-white">📎</button>
            
            {showEmoji && <div className="absolute bottom-20 left-4"><EmojiPicker onEmojiClick={(e)=>setCurrentMessage(prev=>prev+e.emoji)} theme="dark" height={300}/></div>}
            
            <input type="text" value={currentMessage} placeholder="Type a message..." className="flex-1 p-3 bg-[#2a3942] text-white rounded-lg outline-none focus:bg-[#2a3942]"
                onChange={handleTyping} onKeyPress={(e) => { e.key === "Enter" && sendMessage(); }} />
            
            {currentMessage.trim() === "" ? (
               <button 
                 onMouseDown={startRecording} onMouseUp={stopRecording} 
                 onTouchStart={startRecording} onTouchEnd={stopRecording}
                 className={`p-3 rounded-full text-white transition ${isRecording ? "bg-red-600 scale-110" : "bg-[#00a884] hover:bg-[#008f6f]"}`}
               >🎤</button>
            ) : (
               <button onClick={sendMessage} className="bg-[#00a884] p-3 rounded-full text-white hover:bg-[#008f6f]">➤</button>
            )}
        </div>
      </div>
    </div>
  );
}

export default Chat;