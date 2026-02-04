import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import EmojiPicker from "emoji-picker-react";
import { Auth } from "./pages/Auth"; 
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "./firebase"; 
import { collection, query, where, getDocs, doc, onSnapshot } from "firebase/firestore"; // 🆕 Changed getDoc to onSnapshot

const socket = io.connect("http://localhost:3001");
const audio = new Audio("https://codeskulptor-demos.commondatastorage.googleapis.com/assets_sound_notification_bing.mp3");

function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [room, setRoom] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");
  const [messageList, setMessageList] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [userList, setUserList] = useState([]); 
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // SEARCH STATES
  const [searchUsername, setSearchUsername] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");

  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- 1. AUTH LISTENER & LIVE DB FETCH ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // 🆕 FIX: Use onSnapshot (Real-time) instead of getDoc
        // This waits for the database to be written before showing the UI
        const unsubDb = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          }
        });
        return () => unsubDb(); // Cleanup listener
      } else {
        setUserData(null);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // --- 2. SOCKET LISTENERS ---
  useEffect(() => {
    const handleReceiveMessage = (data) => {
      setMessageList((list) => [...list, data]);
      if (data.author !== (userData?.realName || "User") && data.author !== "System") {
        audio.play().catch((err) => console.log("Audio play failed:", err));
      }
    };
    
    const handleUserList = (users) => setUserList(users);
    const handleDisplayTyping = (user) => setTypingUser(user);
    const handleHideTyping = () => setTypingUser("");

    socket.on("receive_message", handleReceiveMessage);
    socket.on("update_user_list", handleUserList);
    socket.on("display_typing", handleDisplayTyping);
    socket.on("hide_typing", handleHideTyping);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("update_user_list", handleUserList);
      socket.off("display_typing", handleDisplayTyping);
      socket.off("hide_typing", handleHideTyping);
    };
  }, [userData]); 

  // --- 3. AUTO SCROLL ---
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageList, typingUser]);

  useEffect(() => {
    if (room && messageList.length > 0) {
      localStorage.setItem(`chat_${room}`, JSON.stringify(messageList));
    }
  }, [messageList, room]);

  // --- SEARCH USER ---
  const handleSearchUser = async () => {
    setSearchResult(null);
    setSearchError("");
    if(!searchUsername) return;

    try {
      const q = query(collection(db, "users"), where("username", "==", searchUsername.toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setSearchError("User not found!");
      } else {
        setSearchResult(querySnapshot.docs[0].data());
      }
    } catch (err) {
      console.error(err);
      setSearchError("Error searching.");
    }
  };

  const startDirectChat = () => {
    if (searchResult) {
      const myUid = user.uid;
      const theirUid = searchResult.uid;
      const roomID = myUid < theirUid ? `${myUid}_${theirUid}` : `${theirUid}_${myUid}`;
      
      setRoom(roomID); 
      joinRoom(roomID); 
      setSearchUsername(""); 
      setSearchResult(null);
    }
  };

  const joinRoom = (roomIDToJoin = room) => {
    if (roomIDToJoin !== "" && userData) {
      const username = userData.realName;
      const photo = userData.photoURL;

      socket.emit("join_room", { room: roomIDToJoin, username, photo });
      setShowChat(true);
      const savedMessages = localStorage.getItem(`chat_${roomIDToJoin}`);
      if (savedMessages) setMessageList(JSON.parse(savedMessages));
    }
  };

  const sendMessage = async () => {
    if (currentMessage !== "") {
      const messageData = {
        room: room,
        author: userData.realName || "User",
        photo: userData.photoURL,
        type: "text",
        message: currentMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      await socket.emit("send_message", messageData);
      setMessageList((list) => [...list, messageData]);
      setCurrentMessage("");
      setShowEmoji(false);
      socket.emit("stop_typing", room);
    }
  };

  const sendImage = async (imageContent) => {
    const messageData = {
      room: room,
      author: userData.realName || "User",
      photo: userData.photoURL,
      type: "image",
      message: imageContent,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    await socket.emit("send_message", messageData);
    setMessageList((list) => [...list, messageData]);
  };

  const selectFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1000000) { 
        alert("File too large! Keep it under 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        sendImage(reader.result);
      };
    }
  };

  const handleTyping = (e) => {
    setCurrentMessage(e.target.value);
    const username = userData?.realName || "User";
    socket.emit("typing", { room, username });
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop_typing", room);
    }, 2000);
  };

  const onEmojiClick = (emojiObject) => {
    setCurrentMessage((prev) => prev + emojiObject.emoji);
  };

  const clearChat = () => {
    localStorage.removeItem(`chat_${room}`);
    setMessageList([]);
    setShowMenu(false); 
  };

  const handleLogout = async () => {
    await signOut(auth);
    setShowChat(false);
    setRoom("");
    setUser(null);
    setUserData(null);
  };

  if (!user) {
    return <Auth />;
  }

  // 🆕 Better Loading Screen
  if (!userData) {
    return (
      <div className="h-screen bg-gray-900 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="animate-pulse">Setting up your profile...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 font-sans text-gray-100">
      
      {!showChat ? (
        // JOIN SCREEN
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-96 flex flex-col items-center gap-4 animate-fade-in">
          <img 
            src={userData.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} 
            className="w-24 h-24 rounded-full border-4 border-green-500 mb-2 object-cover shadow-lg"
            alt="Profile"
          />
          <h2 className="text-2xl font-bold text-white">Hi, {userData.realName}!</h2>
          <p className="text-gray-400 text-sm">@{userData.username}</p>
          
          <div className="w-full mt-4">
             <h3 className="text-left text-green-400 font-bold mb-2">Start a Chat</h3>
             
             <div className="flex gap-2">
                <input
                type="text"
                placeholder="Search Username..."
                className="flex-1 p-2 rounded-md bg-gray-700 text-white text-sm outline-none focus:border-blue-500 border border-transparent"
                onChange={(e) => setSearchUsername(e.target.value)}
                value={searchUsername}
                />
                <button 
                  onClick={handleSearchUser}
                  className="bg-blue-600 px-3 rounded-md text-white text-sm hover:bg-blue-700"
                >
                  Search
                </button>
            </div>
            
            {searchError && <p className="text-red-400 text-xs mt-1">{searchError}</p>}
            
            {searchResult && (
                <div onClick={startDirectChat} className="mt-3 bg-gray-700 p-2 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-gray-600 border border-green-500">
                    <img src={searchResult.photoURL} className="w-10 h-10 rounded-full" />
                    <div>
                        <p className="font-bold text-sm text-white">{searchResult.realName}</p>
                        <p className="text-xs text-gray-400">@{searchResult.username}</p>
                    </div>
                </div>
            )}
          </div>
          
          <div className="flex items-center w-full my-4">
            <div className="h-[1px] bg-gray-600 w-full"></div>
            <span className="px-2 text-gray-400 text-xs">OR GROUP</span>
            <div className="h-[1px] bg-gray-600 w-full"></div>
          </div>

          <div className="w-full">
            <input
              type="text"
              placeholder="Enter Room ID"
              className="w-full p-3 rounded-md bg-gray-700 text-white outline-none border border-transparent focus:border-green-500 transition"
              onChange={(event) => setRoom(event.target.value)}
              onKeyPress={(e) => e.key === "Enter" && joinRoom(room)}
            />
            <button
              onClick={() => joinRoom(room)}
              className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-md transition duration-300"
            >
              Join Group
            </button>
          </div>

          <button onClick={handleLogout} className="text-red-400 text-sm hover:underline mt-4">
            Log Out
          </button>
        </div>
      ) : (
        // MAIN CHAT SCREEN
        <div className="flex w-full max-w-5xl h-[90vh] bg-[#0b141a] border border-gray-700 rounded-lg overflow-hidden shadow-2xl relative">
          
          {/* SIDEBAR */}
          <div className="w-1/3 bg-gray-800 border-r border-gray-700 hidden md:flex flex-col">
            <div className="p-4 bg-gray-750 border-b border-gray-700 flex justify-between items-center bg-[#202c33]">
               <div className="flex items-center gap-2">
                 <img src={userData.photoURL} className="w-8 h-8 rounded-full" />
                 <div>
                    <span className="font-bold text-gray-200 text-sm block">{userData.realName}</span>
                    <span className="text-gray-400 text-xs block">@{userData.username}</span>
                 </div>
               </div>
               <button onClick={() => setShowChat(false)} className="text-red-400 text-xs hover:text-red-300">Exit</button>
            </div>
            
            <div className="p-3 bg-[#111b21]">
                <h3 className="text-green-400 text-xs font-bold uppercase tracking-wider mb-2">Active in Room ({userList.length})</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-[#111b21]">
                {userList.map((u, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 hover:bg-[#202c33] cursor-pointer transition border-b border-gray-800">
                        <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold">
                            {u.charAt(0).toUpperCase()}
                        </div>
                        <p className={`text-gray-200 font-medium ${u === userData.realName ? "italic text-green-400" : ""}`}>
                            {u} {u === userData.realName && "(You)"}
                        </p>
                    </div>
                ))}
            </div>
          </div>

          {/* CHAT AREA */}
          <div className="flex-1 flex flex-col bg-[#0b141a] relative bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat">
            <div className="bg-[#202c33] p-4 flex items-center justify-between shadow-md z-10 relative">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">#</div>
                    <div>
                        <p className="font-bold text-gray-100">Room: {room}</p>
                        {typingUser ? (
                            <p className="text-xs text-green-400 font-bold animate-pulse">{typingUser} is typing...</p>
                        ) : (
                            <p className="text-xs text-gray-400">tap here for group info</p>
                        )}
                    </div>
                </div>

                <div className="relative">
                  <button onClick={() => setShowMenu(!showMenu)} className="text-gray-400 hover:text-white text-2xl px-2">
                    ⋮
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 top-10 bg-[#2a3942] border border-gray-700 shadow-xl rounded w-40 overflow-hidden z-50">
                      <button 
                        onClick={clearChat} 
                        className="w-full text-left px-4 py-3 text-red-400 hover:bg-[#111b21] text-sm transition"
                      >
                        Clear Chat
                      </button>
                      <button 
                        onClick={() => setShowChat(false)} 
                        className="w-full text-left px-4 py-3 text-gray-200 hover:bg-[#111b21] text-sm transition"
                      >
                        Exit Room
                      </button>
                    </div>
                  )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {messageList.map((msg, index) => {
                  const isMyMessage = userData.realName === msg.author;
                  const isSystem = msg.author === "System";

                  if (isSystem) {
                    return (
                        <div key={index} className="flex justify-center my-4">
                            <span className="bg-[#1e2a30] text-yellow-500 text-xs px-3 py-1 rounded-lg shadow-sm uppercase tracking-wide font-bold">
                                {msg.message}
                            </span>
                        </div>
                    );
                  }

                  return (
                    <div key={index} className={`flex w-full ${isMyMessage ? "justify-end" : "justify-start"}`}>
                        {!isMyMessage && (
                            <img 
                                src={msg.photo || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} 
                                className="w-6 h-6 rounded-full mr-2 self-start mt-1"
                                title={msg.author}
                            />
                        )}

                        <div className={`max-w-[65%] min-w-[120px] px-3 py-2 rounded-lg text-sm shadow-md relative group ${
                            isMyMessage ? "bg-[#005c4b] text-white rounded-tr-none" : "bg-[#202c33] text-white rounded-tl-none"
                        }`}>
                            {!isMyMessage && <p className="text-[10px] font-bold text-orange-400 mb-1">{msg.author}</p>}
                            
                            {msg.type === "image" ? (
                                <img src={msg.message} alt="sent" className="max-w-full rounded-lg mb-1 border border-green-900" />
                            ) : (
                                <p className="break-words text-[15px] leading-relaxed pb-2">{msg.message}</p>
                            )}

                            <p className={`text-[9px] absolute bottom-1 right-2 ${isMyMessage ? "text-green-200" : "text-gray-400"}`}>
                                {msg.time} {isMyMessage && "✓✓"}
                            </p>
                        </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
            </div>

            {showEmoji && (
                <div className="absolute bottom-20 left-4 z-20 shadow-2xl rounded-xl overflow-hidden">
                    <EmojiPicker onEmojiClick={onEmojiClick} theme="dark" width={300} height={350} />
                </div>
            )}

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={selectFile} />

            <div className="bg-[#202c33] p-2 flex gap-2 items-center z-10">
                <button onClick={() => setShowEmoji(!showEmoji)} className="text-2xl text-gray-400 hover:text-gray-200 p-2 transition">😊</button>
                <button onClick={() => fileInputRef.current.click()} className="text-2xl text-gray-400 hover:text-gray-200 p-2 transition">📷</button>
                
                <input
                    type="text"
                    value={currentMessage}
                    placeholder="Type a message..."
                    className="flex-1 p-3 bg-[#2a3942] text-white rounded-lg outline-none placeholder-gray-400 focus:bg-[#2a3942]"
                    onChange={handleTyping}
                    onKeyPress={(event) => { event.key === "Enter" && sendMessage(); }}
                />
                
                <button onClick={sendMessage} className="bg-[#00a884] p-3 rounded-full hover:bg-[#008f6f] text-white transition shadow-lg">
                    ➤
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;