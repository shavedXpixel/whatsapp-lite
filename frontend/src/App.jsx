import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { socket } from "./socket"; 

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
// 🆕 IMPORT NEW CHAT PAGES
import GroupChat from "./pages/GroupChat";
import PersonalChat from "./pages/PersonalChat";

function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const unsubDb = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
             setUserData(docSnap.data());
             setLoading(false);
          } else {
             setUserData({
                realName: currentUser.displayName || "User",
                username: currentUser.email.split('@')[0],
                photoURL: currentUser.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                uid: currentUser.uid
             });
             setLoading(false);
          }
        }, () => setLoading(false));
        return () => unsubDb();
      } else {
        setUserData(null);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  if (loading) return <div className="h-screen bg-gray-900 text-white flex justify-center items-center">Loading App...</div>;

  return (
    <BrowserRouter>
      <div className="h-screen bg-gray-900 font-sans text-gray-100 overflow-hidden">
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/" />} />

          <Route path="/" element={user ? <Home userData={userData} socket={socket} /> : <Navigate to="/login" />} />
          
          {/* ✅ SPLIT CHAT ROUTES */}
          <Route path="/group/:roomId" element={user ? <GroupChat userData={userData} socket={socket} /> : <Navigate to="/login" />} />
          <Route path="/dm/:roomId" element={user ? <PersonalChat userData={userData} socket={socket} /> : <Navigate to="/login" />} />
          
          <Route path="/profile" element={user ? <Profile userData={userData} /> : <Navigate to="/login" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;