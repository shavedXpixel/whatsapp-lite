import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

function Home({ userData, socket }) {
  const navigate = useNavigate();
  const [room, setRoom] = useState("");
  const [searchUsername, setSearchUsername] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");

  const handleLogout = async () => {
    await signOut(auth);
  };

  const joinRoom = () => {
    if (room !== "") {
      socket.emit("join_room", { room, username: userData.realName, photo: userData.photoURL });
      navigate(`/chat/${room}`); // 👈 This changes the URL!
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
      navigate(`/chat/${roomID}`);
    }
  };

  return (
    <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-96 flex flex-col items-center gap-4 animate-fade-in mx-auto mt-20">
      <img src={userData.photoURL} className="w-24 h-24 rounded-full border-4 border-green-500 mb-2 object-cover" />
      <h2 className="text-2xl font-bold text-white">Hi, {userData.realName}!</h2>
      <p className="text-gray-400 text-sm">@{userData.username}</p>
      
      {/* SEARCH SECTION */}
      <div className="w-full mt-4">
         <h3 className="text-left text-green-400 font-bold mb-2">Start a Chat</h3>
         <div className="flex gap-2">
            <input type="text" placeholder="Search Username..." className="flex-1 p-2 rounded-md bg-gray-700 text-white outline-none"
            onChange={(e) => setSearchUsername(e.target.value)} value={searchUsername} />
            <button onClick={handleSearchUser} className="bg-blue-600 px-3 rounded-md text-white hover:bg-blue-700">Search</button>
        </div>
        {searchError && <p className="text-red-400 text-xs mt-1">{searchError}</p>}
        
        {searchResult && (
            <div onClick={startDirectChat} className="mt-3 bg-gray-700 p-2 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-gray-600 border border-green-500">
                <img src={searchResult.photoURL} className="w-10 h-10 rounded-full" />
                <div><p className="font-bold text-sm text-white">{searchResult.realName}</p><p className="text-xs text-gray-400">@{searchResult.username}</p></div>
            </div>
        )}
      </div>

      <div className="flex items-center w-full my-4">
        <div className="h-[1px] bg-gray-600 w-full"></div>
        <span className="px-2 text-gray-400 text-xs">OR GROUP</span>
        <div className="h-[1px] bg-gray-600 w-full"></div>
      </div>

      {/* JOIN ROOM SECTION */}
      <div className="w-full">
        <input type="text" placeholder="Enter Room ID" className="w-full p-3 rounded-md bg-gray-700 text-white outline-none border border-transparent focus:border-green-500 transition"
          onChange={(event) => setRoom(event.target.value)}
          onKeyPress={(e) => e.key === "Enter" && joinRoom()}
        />
        <button onClick={joinRoom} className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-md transition duration-300">
          Join Group
        </button>
      </div>
      <button onClick={handleLogout} className="text-red-400 text-sm hover:underline mt-4">Log Out</button>
    </div>
  );
}

export default Home;