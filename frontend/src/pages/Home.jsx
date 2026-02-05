import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { signOut } from "firebase/auth";

function Home({ userData, socket }) {
  if (!userData) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-emerald-400 font-bold animate-pulse">Loading Profile...</div>;

  const navigate = useNavigate();
  const [room, setRoom] = useState("");
  const [searchUsername, setSearchUsername] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [chats, setChats] = useState([]);

  // 1. LISTEN TO RECENT CHATS
  useEffect(() => {
    if (userData.uid) {
      const unsub = onSnapshot(doc(db, "userChats", userData.uid), (doc) => {
        if (doc.exists()) {
           const data = doc.data();
           const chatList = Object.entries(data).map(([roomId, chatData]) => ({
              roomId, ...chatData
           })).sort((a,b) => b.date - a.date);
           setChats(chatList);
        }
      });
      return () => unsub();
    }
  }, [userData.uid]);

  const handleLogout = async () => { await signOut(auth); };

  const joinRoom = () => {
    if (room !== "") {
      socket.emit("join_room", { room, username: userData.realName, photo: userData.photoURL });
      // ✅ NAVIGATE TO GROUP PAGE
      navigate(`/group/${room}`);
    }
  };

  const handleSearchUser = async () => {
    setSearchResult(null);
    setSearchError("");
    if(!searchUsername) return;
    try {
      const q = query(collection(db, "users"), where("username", "==", searchUsername.toLowerCase()));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) setSearchError("User not found!");
      else setSearchResult(querySnapshot.docs[0].data());
    } catch (err) { setSearchError("Error searching."); }
  };

  const startDirectChat = () => {
    if (searchResult) {
      const myUid = userData.uid;
      const theirUid = searchResult.uid;
      const roomID = myUid < theirUid ? `${myUid}_${theirUid}` : `${theirUid}_${myUid}`;
      socket.emit("join_room", { room: roomID, username: userData.realName, photo: userData.photoURL });
      // ✅ NAVIGATE TO DM PAGE
      navigate(`/dm/${roomID}`);
    }
  };

  // ✅ CLEAR UNREAD STATUS & NAVIGATE CORRECTLY
  const openRecentChat = async (chat) => {
      // 1. Mark as Read in Database
      const chatRef = doc(db, "userChats", userData.uid);
      try {
          await updateDoc(chatRef, { [`${chat.roomId}.unread`]: false });
      } catch (e) { console.log("Error marking read:", e); }

      // 2. Join Socket
      socket.emit("join_room", { room: chat.roomId, username: userData.realName, photo: userData.photoURL });

      // 3. ✅ NAVIGATE BASED ON ID TYPE
      if (chat.roomId.includes("_")) {
          navigate(`/dm/${chat.roomId}`);
      } else {
          navigate(`/group/${chat.roomId}`);
      }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center font-sans relative overflow-hidden">
      
      {/* 🔮 BACKGROUND */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob"></div>
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob animation-delay-2000"></div>

      {/* 📦 CONTAINER */}
      <div className="w-full max-w-5xl h-[90vh] bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl flex overflow-hidden z-10 animate-fade-in-up">
        
        {/* 👈 LEFT SIDEBAR */}
        <div className="w-full md:w-[350px] bg-black/20 border-r border-white/5 flex flex-col">
            
            {/* Header with Profile Link */}
            <div className="p-6 flex justify-between items-center border-b border-white/5 bg-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate("/profile")}>
                    <div className="relative">
                        <img src={userData.photoURL} className="w-12 h-12 rounded-full border-2 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] object-cover group-hover:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs">⚙️</span>
                        </div>
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-lg group-hover:text-emerald-400 transition-colors">{userData.realName}</h2>
                        <p className="text-emerald-400 text-xs font-medium tracking-wide">ONLINE</p>
                    </div>
                </div>
                
                <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 transition p-2 rounded-full hover:bg-white/5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
            </div>

            {/* Recent Chats List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4 px-2">Recent Messages</h3>
                
                {chats.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-500 opacity-60">
                        <p className="text-sm">No conversations yet.</p>
                    </div>
                )}

                {chats.map((chat) => (
                    <div key={chat.roomId} onClick={() => openRecentChat(chat)} 
                         className={`group flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all duration-300 border 
                         ${chat.unread ? 'bg-white/10 border-emerald-500/50 shadow-[inset_0_0_15px_rgba(16,185,129,0.1)]' : 'hover:bg-white/10 border-transparent hover:border-white/5'}
                         `}>
                        
                        <div className="relative">
                            <img src={chat.userInfo.photoURL} className={`w-12 h-12 rounded-full object-cover transition-all ${chat.unread ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-900' : ''}`} />
                            {chat.unread && <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-gray-900"></div>}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                                <h4 className={`font-semibold text-sm truncate ${chat.unread ? 'text-white font-bold' : 'text-gray-300'}`}>{chat.userInfo.displayName}</h4>
                                <span className="text-[10px] text-gray-500">{new Date(chat.date?.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <p className={`text-xs truncate ${chat.unread ? 'text-emerald-300 font-medium' : 'text-gray-400'}`}>{chat.lastMessage}</p>
                                {chat.unread && <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></div>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* 👉 RIGHT MAIN AREA */}
        <div className="hidden md:flex flex-1 flex-col items-center justify-center relative">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black z-[-1]"></div>

            <div className="relative z-10 w-full max-w-md p-8">
                <div className="text-center mb-10">
                    <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500 mb-2 drop-shadow-lg">
                        WhatsApp Lite
                    </h1>
                    <p className="text-gray-400 text-sm">Secure, Fast, and Elegant Messaging.</p>
                </div>

                {/* SEARCH CARD */}
                <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-xl transition-all hover:border-emerald-500/30">
                    <h3 className="text-emerald-400 text-sm font-bold uppercase mb-4 tracking-wider">Start a Conversation</h3>
                    
                    <div className="relative group">
                        <input type="text" placeholder="Search by username..." 
                            className="w-full bg-black/40 text-white p-4 pl-12 rounded-xl outline-none border border-white/10 focus:border-emerald-500 transition-all placeholder-gray-500"
                            onChange={(e) => setSearchUsername(e.target.value)} value={searchUsername} 
                        />
                        <span className="absolute left-4 top-4 text-gray-400 group-focus-within:text-emerald-400 transition-colors">🔍</span>
                        <button onClick={handleSearchUser} className="absolute right-2 top-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg hover:shadow-emerald-500/50">
                            Find
                        </button>
                    </div>

                    {searchError && <p className="text-red-400 text-xs mt-3 bg-red-500/10 p-2 rounded border border-red-500/20 text-center">{searchError}</p>}
                    
                    {searchResult && (
                        <div onClick={startDirectChat} className="mt-4 bg-gradient-to-r from-gray-800 to-gray-900 p-3 rounded-xl flex items-center gap-4 cursor-pointer hover:from-emerald-900 hover:to-gray-900 border border-white/10 hover:border-emerald-500/50 transition-all group">
                            <img src={searchResult.photoURL} className="w-12 h-12 rounded-full border-2 border-gray-700 group-hover:border-emerald-400 transition-colors" />
                            <div>
                                <p className="font-bold text-white group-hover:text-emerald-300 transition-colors">{searchResult.realName}</p>
                                <p className="text-xs text-gray-500">@{searchResult.username}</p>
                            </div>
                            <span className="ml-auto text-emerald-500 text-sm opacity-0 group-hover:opacity-100 transition-opacity">Message →</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4 my-8">
                    <div className="h-[1px] bg-gradient-to-r from-transparent via-gray-600 to-transparent flex-1"></div>
                    <span className="text-gray-500 text-xs font-mono">OR</span>
                    <div className="h-[1px] bg-gradient-to-r from-transparent via-gray-600 to-transparent flex-1"></div>
                </div>

                <div className="relative group">
                     <input type="text" placeholder="Enter Room ID to Join..." 
                        className="w-full bg-black/40 text-white p-4 pl-4 rounded-xl outline-none border border-white/10 focus:border-blue-500 transition-all placeholder-gray-500"
                        onChange={(e) => setRoom(e.target.value)} 
                    />
                    <button onClick={joinRoom} className="mt-3 w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-900/30 transition-all transform hover:scale-[1.02] active:scale-[0.98]">
                        Join Group Chat
                    </button>
                </div>
            </div>
        </div>
      </div>
      
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { bg: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #10b981; }
      `}</style>
    </div>
  );
}

export default Home;