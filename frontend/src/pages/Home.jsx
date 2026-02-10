import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, doc, onSnapshot, updateDoc, orderBy } from "firebase/firestore";
import { db, auth } from "../firebase";
import { signOut } from "firebase/auth";

// 📱 MOBILE ACTION MODAL (Preserved)
const MobileActions = ({ onClose, onJoin, onSearch, initialTab = "search" }) => {
    const [tab, setTab] = useState(initialTab); 
    const [queryTxt, setQueryTxt] = useState("");
    const [roomTxt, setRoomTxt] = useState("");
    const [result, setResult] = useState(null);

    const handleSearch = async () => {
        if(!queryTxt) return;
        const q = query(collection(db, "users"), where("username", "==", queryTxt.toLowerCase()));
        const snap = await getDocs(q);
        if(!snap.empty) setResult(snap.docs[0].data());
        else alert("User not found");
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-[#1e293b] w-full sm:w-96 rounded-t-2xl sm:rounded-2xl p-6 border-t sm:border border-white/10 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-white font-bold text-lg">New Chat</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                </div>

                <div className="flex bg-black/20 p-1 rounded-xl mb-6">
                    <button onClick={() => setTab("search")} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${tab==="search" ? "bg-emerald-600 text-white shadow-lg" : "text-gray-400"}`}>Private DM</button>
                    <button onClick={() => setTab("join")} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${tab==="join" ? "bg-blue-600 text-white shadow-lg" : "text-gray-400"}`}>Group Chat</button>
                </div>

                {tab === "search" ? (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex gap-2">
                            <input type="text" placeholder="Username..." className="flex-1 bg-black/30 text-white p-3 rounded-xl outline-none border border-white/10"
                                onChange={(e)=>setQueryTxt(e.target.value)} />
                            <button onClick={handleSearch} className="bg-emerald-600 p-3 rounded-xl text-white">🔍</button>
                        </div>
                        {result && (
                            <div onClick={() => { onSearch(result); onClose(); }} className="bg-white/5 p-3 rounded-xl flex items-center gap-3 cursor-pointer border border-emerald-500/50 animate-pulse-once">
                                <img src={result.photoURL} className="w-10 h-10 rounded-full"/>
                                <div><p className="text-white font-bold">{result.realName}</p><p className="text-xs text-gray-400">@{result.username}</p></div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4 animate-fade-in">
                         <input type="text" placeholder="Enter Room ID..." className="w-full bg-black/30 text-white p-3 rounded-xl outline-none border border-white/10"
                                onChange={(e)=>setRoomTxt(e.target.value)} />
                         <button onClick={() => { onJoin(roomTxt); onClose(); }} className="w-full bg-blue-600 py-3 rounded-xl text-white font-bold shadow-lg">Join Room</button>
                    </div>
                )}
            </div>
        </div>
    );
};

function Home({ userData, socket }) {
  if (!userData) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-emerald-400 font-bold animate-pulse">Loading...</div>;

  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // For Stories
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [mobileMenuTab, setMobileMenuTab] = useState("search");
  
  // Desktop States
  const [room, setRoom] = useState("");
  const [searchUsername, setSearchUsername] = useState("");
  const [searchResult, setSearchResult] = useState(null);

  useEffect(() => {
    if (userData.uid) {
      // 1. Listen for My Chats
      const unsubChats = onSnapshot(doc(db, "userChats", userData.uid), (doc) => {
        if (doc.exists()) {
           const data = doc.data();
           const chatList = Object.entries(data).map(([roomId, chatData]) => ({ roomId, ...chatData })).sort((a,b) => b.date - a.date);
           setChats(chatList);
        }
      });

      // 2. Listen for All Users (For Stories Feature)
      const qUsers = query(collection(db, "users"), where("uid", "!=", userData.uid));
      const unsubUsers = onSnapshot(qUsers, (snap) => {
          setAllUsers(snap.docs.map(d => d.data()));
      });

      return () => { unsubChats(); unsubUsers(); };
    }
  }, [userData.uid]);

  const handleLogout = async () => { await signOut(auth); };

  const joinRoom = (roomID) => {
    if (roomID) {
      socket.emit("join_room", { room: roomID, username: userData.realName, photo: userData.photoURL });
      navigate(`/group/${roomID}`);
    }
  };

  const startDirectChat = (targetUser) => {
    if (targetUser) {
      const myUid = userData.uid;
      const theirUid = targetUser.uid;
      const roomID = myUid < theirUid ? `${myUid}_${theirUid}` : `${theirUid}_${myUid}`;
      socket.emit("join_room", { room: roomID, username: userData.realName, photo: userData.photoURL });
      navigate(`/dm/${roomID}`);
    }
  };

  // ✅ FIXED: UPDATED DESKTOP SEARCH FUNCTION
  const handleDesktopSearch = async () => {
    // 1. Trim spaces to avoid errors
    const term = searchUsername.trim().toLowerCase();
    if(!term) return;

    // 2. Clear previous result so UI updates
    setSearchResult(null);

    const q = query(collection(db, "users"), where("username", "==", term));
    const snap = await getDocs(q);

    if(!snap.empty) {
        setSearchResult(snap.docs[0].data());
    } else {
        // 3. Show Alert if not found
        alert("User not found! Please check the username (it must be exact).");
    }
  };

  const openRecentChat = async (chat) => {
      try { await updateDoc(doc(db, "userChats", userData.uid), { [`${chat.roomId}.unread`]: false }); } catch (e) {}
      socket.emit("join_room", { room: chat.roomId, username: userData.realName, photo: userData.photoURL });
      if (chat.roomId.includes("_")) navigate(`/dm/${chat.roomId}`);
      else navigate(`/group/${chat.roomId}`);
  };

  // Helper to open modal on specific tab
  const openMobileAction = (tab) => {
      setMobileMenuTab(tab);
      setShowMobileMenu(true);
  };

  return (
    <div className="h-[100dvh] bg-[#0f172a] flex items-center justify-center font-sans overflow-hidden relative">
      
      {/* 🔮 BACKGROUND ANIMATION (Shared) */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 to-black z-0"></div>
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[100px] pointer-events-none"></div>

      {/* ===================================================================================
                                         📱 MOBILE VIEW (REDESIGNED)
          =================================================================================== */}
      <div className="md:hidden flex flex-col w-full h-full relative z-10">
          
          {/* TOP HEADER */}
          <div className="px-6 pt-8 pb-4 flex justify-between items-center bg-gradient-to-b from-[#0f172a] to-transparent shrink-0">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Messages</h1>
                <p className="text-xs text-gray-400 font-medium">Welcome, {userData?.realName.split(" ")[0]}</p>
            </div>
            <div onClick={() => navigate("/profile")} className="relative cursor-pointer group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full opacity-75 animate-pulse blur-[2px]"></div>
                <img src={userData?.photoURL} className="relative w-10 h-10 rounded-full object-cover border-2 border-[#0f172a]" />
            </div>
          </div>

          {/* 📸 STORIES ROW */}
          <div className="px-6 pb-6 shrink-0">
             <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                {/* Add Story / New Chat Button */}
                <div onClick={() => openMobileAction('search')} className="flex flex-col items-center gap-1 shrink-0 cursor-pointer">
                    <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center bg-white/5 text-gray-400 text-xl hover:bg-white/10 transition">+</div>
                    <span className="text-[10px] text-gray-400">New Chat</span>
                </div>
                
                {/* Active Users (Stories) */}
                {allUsers.slice(0, 5).map((u, i) => (
                    <div key={i} onClick={() => startDirectChat(u)} className="flex flex-col items-center gap-1 shrink-0 cursor-pointer animate-fade-in" style={{animationDelay: `${i*100}ms`}}>
                        <div className="relative w-14 h-14 p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 to-pink-600">
                            <img src={u.photoURL} className="w-full h-full rounded-full object-cover border-2 border-[#0f172a]" />
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0f172a]"></div>
                        </div>
                        <span className="text-[10px] text-gray-300 w-14 truncate text-center">{u.realName.split(" ")[0]}</span>
                    </div>
                ))}
             </div>
          </div>

          {/* 💬 CHAT LIST (Glassmorphism) */}
          <div className="flex-1 overflow-y-auto px-4 pb-24 custom-scrollbar space-y-3">
             <div className="flex justify-between items-end px-2 mb-2">
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recent Chats</p>
             </div>

             {/* Public Group Card */}
             <div onClick={() => { socket.emit("join_room", { room: "public", username: userData.realName }); navigate("/group/public"); }} className="relative group cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl opacity-20 blur-md"></div>
                <div className="relative bg-[#1e293b]/60 backdrop-blur-xl border border-white/5 p-4 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">#</div>
                    <div className="flex-1">
                        <h3 className="text-white font-bold">Public Group</h3>
                        <p className="text-xs text-gray-400">Community Chat</p>
                    </div>
                </div>
             </div>

             {/* Chats List */}
             {chats.map((chat) => (
                 <div key={chat.roomId} onClick={() => openRecentChat(chat)} className={`p-3 rounded-2xl flex items-center gap-4 border transition active:scale-[0.98] cursor-pointer
                    ${chat.unread 
                        ? 'bg-white/10 backdrop-blur-md border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                        : 'bg-[#1e293b]/40 backdrop-blur-md border-white/5'}`}>
                     
                     <div className="relative">
                        <img src={chat.userInfo.photoURL} className="w-12 h-12 rounded-full object-cover" />
                        {chat.unread && <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-[#1e293b]"></div>}
                     </div>
                     
                     <div className="flex-1 min-w-0">
                         <div className="flex justify-between items-baseline">
                            <h3 className={`font-semibold text-sm truncate ${chat.unread ? 'text-white' : 'text-gray-200'}`}>{chat.userInfo.displayName}</h3>
                            <span className="text-[10px] text-gray-500">{new Date(chat.date?.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                         </div>
                         <p className={`text-xs truncate mt-0.5 ${chat.unread ? 'text-emerald-400 font-medium' : 'text-gray-400'}`}>{chat.lastMessage}</p>
                     </div>
                 </div>
             ))}
             
             {chats.length === 0 && (
                 <div className="text-center text-gray-500 mt-10 text-sm">No recent chats. Tap + above!</div>
             )}
          </div>

          {/* 🦶 BOTTOM NAVIGATION */}
          <div className="absolute bottom-0 w-full bg-[#0f172a]/90 backdrop-blur-xl border-t border-white/5 py-3 px-8 flex justify-between items-center z-50 pb-safe">
              <button className="flex flex-col items-center gap-1 text-blue-500">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" /><path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75v4.5a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" /></svg>
                  <span className="text-[10px] font-medium">Home</span>
              </button>
              
              <button onClick={() => openMobileAction('join')} className="flex flex-col items-center gap-1 text-gray-500 hover:text-white transition">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM15.75 9.75a3 3 0 116 0 3 3 0 01-6 0zM2.25 9.75a3 3 0 116 0 3 3 0 01-6 0zM6.31 15.117A6.745 6.745 0 0112 12a6.745 6.745 0 016.709 7.498.75.75 0 01-.372.568A12.696 12.696 0 0112 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 01-.372-.568 6.787 6.787 0 011.019-4.38z" clipRule="evenodd" /><path d="M5.082 14.254a6.755 6.755 0 00-1.717 5.368 4.484 4.484 0 01-1.223-3.982A7.501 7.501 0 015.082 14.254zM19.355 15.75a7.381 7.381 0 00-1.207-1.5 7.5 7.5 0 013.575 5.096 4.488 4.488 0 01-1.33-.637 6.756 6.756 0 00-1.038-2.959z" /></svg>
                  <span className="text-[10px] font-medium">Groups</span>
              </button>
              
              <button onClick={handleLogout} className="flex flex-col items-center gap-1 text-gray-500 hover:text-red-400 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
                  <span className="text-[10px] font-medium">Logout</span>
              </button>
          </div>
      </div>

      {/* ===================================================================================
                                         💻 DESKTOP VIEW (PRESERVED)
          =================================================================================== */}
      <div className="hidden md:flex w-full md:max-w-5xl h-full md:h-[90vh] bg-gray-900/60 md:backdrop-blur-xl md:border border-white/10 md:rounded-3xl shadow-2xl relative z-10 animate-scale-in">
        
        {/* LEFT SIDEBAR (Desktop) */}
        <div className="w-[350px] bg-black/20 border-r border-white/5 flex flex-col h-full">
            <div className="p-4 md:p-6 flex justify-between items-center border-b border-white/5 bg-white/5 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate("/profile")}>
                    <img src={userData.photoURL} className="w-12 h-12 rounded-full border-2 border-emerald-500 object-cover group-hover:scale-105 transition-transform" />
                    <div>
                        <h2 className="text-white font-bold text-lg group-hover:text-emerald-400 transition-colors">{userData.realName}</h2>
                        <p className="text-emerald-400 text-xs font-medium tracking-wide">ONLINE</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => navigate("/about")} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/5 transition"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg></button>
                    <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 p-2 rounded-full hover:bg-white/5 transition"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {chats.length === 0 && <div className="flex flex-col items-center justify-center h-40 text-gray-500 opacity-60"><p className="text-sm">No chats yet.</p></div>}
                {chats.map((chat, idx) => (
                    <div key={chat.roomId} onClick={() => openRecentChat(chat)} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border ${chat.unread ? 'bg-white/10 border-emerald-500/50' : 'border-transparent hover:bg-white/5 transition-colors'}`}>
                        <div className="relative"><img src={chat.userInfo.photoURL} className={`w-12 h-12 rounded-full object-cover ${chat.unread ? 'ring-2 ring-emerald-400' : ''}`} />{chat.unread && <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-gray-900 animate-pulse"></div>}</div>
                        <div className="flex-1 min-w-0"><div className="flex justify-between items-center mb-0.5"><h4 className={`font-semibold text-sm truncate ${chat.unread ? 'text-white' : 'text-gray-300'}`}>{chat.userInfo.displayName}</h4><span className="text-[10px] text-gray-500">{new Date(chat.date?.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div><p className={`text-xs truncate ${chat.unread ? 'text-emerald-300 font-medium' : 'text-gray-500'}`}>{chat.lastMessage}</p></div>
                    </div>
                ))}
            </div>
        </div>

        {/* RIGHT MAIN AREA (Desktop) */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
            <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500 mb-2 drop-shadow-lg">WhatsApp Lite</h1>
            <p className="text-gray-500 text-sm mb-8">Secure, Fast, and Elegant Messaging.</p>
            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl w-full max-w-md">
                <h3 className="text-emerald-400 text-sm font-bold uppercase mb-4 tracking-wider">Start a Conversation</h3>
                <div className="flex gap-2 mb-4">
                    <input type="text" placeholder="Username..." className="flex-1 bg-black/40 text-white p-3 rounded-lg outline-none border border-white/10 focus:border-emerald-500/50 transition-all" onChange={(e)=>setSearchUsername(e.target.value)}/>
                    <button onClick={handleDesktopSearch} className="bg-emerald-600 hover:bg-emerald-500 px-4 rounded-lg font-bold transition-colors">Find</button>
                </div>
                {searchResult && (
                    <div onClick={() => startDirectChat(searchResult)} className="bg-white/10 p-3 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-emerald-900/30 border border-transparent hover:border-emerald-500/30 transition-all">
                        <img src={searchResult.photoURL} className="w-10 h-10 rounded-full"/>
                        <div><p className="font-bold text-white">{searchResult.realName}</p><p className="text-xs text-gray-400">@{searchResult.username}</p></div>
                        <span className="ml-auto text-emerald-400 text-xs font-bold">Message →</span>
                    </div>
                )}
                <div className="my-6 border-t border-white/10 flex items-center justify-center"><span className="bg-[#131b2e] px-2 text-gray-500 text-xs -mt-2.5">OR</span></div>
                <div className="flex gap-2">
                     <input type="text" placeholder="Room ID..." className="flex-1 bg-black/40 text-white p-3 rounded-lg outline-none border border-white/10 focus:border-blue-500/50 transition-all" onChange={(e)=>setRoom(e.target.value)}/>
                     <button onClick={() => joinRoom(room)} className="bg-blue-600 hover:bg-blue-500 px-4 rounded-lg font-bold transition-colors">Join</button>
                </div>
            </div>
        </div>
      </div>

      {/* MOBILE MODAL */}
      {showMobileMenu && <MobileActions onClose={() => setShowMobileMenu(false)} onJoin={joinRoom} onSearch={startDirectChat} initialTab={mobileMenuTab} />}

      <style>{`
         .pb-safe { padding-bottom: env(safe-area-inset-bottom, 20px); }
         .no-scrollbar::-webkit-scrollbar { display: none; }
         .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
         .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
         .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
         .animate-slide-in-right { animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
         .animate-scale-in { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
         .animate-pulse-once { animation: pulseOnce 0.5s ease-out; }
         @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
         @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
         @keyframes slideInRight { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
         @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
         @keyframes pulseOnce { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); } }
      `}</style>
    </div>
  );
}

export default Home;