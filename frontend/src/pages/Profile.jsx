import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase"; 

function Profile({ userData }) {
  const navigate = useNavigate();
  const [name, setName] = useState(userData?.realName || "");
  const [username, setUsername] = useState(""); // 🆕 Username State
  const [status, setStatus] = useState("");
  const [photoURL, setPhotoURL] = useState(userData?.photoURL || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (userData?.uid) {
        const docRef = doc(db, "users", userData.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.realName || "");
          setUsername(data.username || ""); // 🆕 Fetch Username
          setStatus(data.about || "Hey there! I am using WhatsApp Lite.");
          setPhotoURL(data.photoURL || userData.photoURL);
        }
      }
    };
    fetchProfile();
  }, [userData]);

  // 🛠️ IMAGE UPLOAD (BASE64)
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 100 * 1024) {
        alert("Image too big! Please use an image smaller than 100KB.");
        return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    setLoading(true);
    reader.onloadend = async () => {
        const base64Image = reader.result;
        
        try {
            setPhotoURL(base64Image);
            const userRef = doc(db, "users", userData.uid);
            await updateDoc(userRef, { photoURL: base64Image });
            
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error("Error saving image:", error);
            alert("Failed to save image.");
        } finally {
            setLoading(false);
        }
    };
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const userRef = doc(db, "users", userData.uid);
      await updateDoc(userRef, {
        realName: name,
        about: status
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to save profile.");
    } finally {
      setLoading(false);
    }
  };

  // 🆕 COPY USERNAME FUNCTION
  const copyUsername = () => {
    if (username) {
        navigator.clipboard.writeText(username);
        alert("Username copied! ✅");
    }
  };

  if (!userData) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-blue-400 font-bold animate-pulse">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center font-sans relative overflow-hidden">
      
      {/* 🔮 BACKGROUND EFFECTS */}
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] bg-violet-600 rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-blob pointer-events-none"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600 rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-blob animation-delay-4000 pointer-events-none"></div>

      {/* 📦 SETTINGS CARD */}
      <div className="w-full max-w-md bg-gray-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-8 z-10 animate-fade-in-up relative">
        
        <button onClick={() => navigate("/")} className="absolute top-6 right-6 text-gray-400 hover:text-white transition">✕</button>

        <div className="flex flex-col items-center mb-8">
            {/* 📸 PROFILE PICTURE UPLOAD */}
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current.click()}>
                <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full opacity-75 blur group-hover:opacity-100 transition duration-200"></div>
                    <img src={photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} className="relative w-28 h-28 rounded-full border-4 border-[#0f172a] object-cover" />
                </div>
                
                {/* Overlay Icon */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <span className="bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold border border-white/20">📷 Change</span>
                </div>
                
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
            </div>

            <h2 className="text-2xl font-bold text-white mt-4">{name}</h2>
            {/* 🆕 USERNAME DISPLAY */}
            <div onClick={copyUsername} className="flex items-center gap-1.5 mt-1 bg-white/5 px-3 py-1 rounded-full border border-white/5 cursor-pointer hover:bg-white/10 transition active:scale-95 group">
                <span className="text-xs text-emerald-400 font-mono tracking-wider font-bold">@{username || "username"}</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-gray-500 group-hover:text-white transition"><path fillRule="evenodd" d="M15.988 3.012A2.25 2.25 0 0118 5.25v6.5A2.25 2.25 0 0115.75 14H13.5V7A2.5 2.5 0 0011 4.5H8.128a2.252 2.252 0 011.884-1.488A2.25 2.25 0 0112.25 1h1.5a2.25 2.25 0 012.238 2.012zM11.5 3.25a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v.25h-3v-.25z" clipRule="evenodd" /><path fillRule="evenodd" d="M2 7a2.5 2.5 0 012.5-2.5h6A2.5 2.5 0 0113 7v10a2.5 2.5 0 01-2.5 2.5h-6A2.5 2.5 0 012 17V7zm2.5-1A1.5 1.5 0 003 7v10a1.5 1.5 0 001.5 1.5h6A1.5 1.5 0 0012 17V7a1.5 1.5 0 00-1.5-1.5h-6z" clipRule="evenodd" /></svg>
            </div>
        </div>

        <div className="space-y-5">
            <div>
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest ml-1 mb-2 block">Display Name</label>
                <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-3 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all group">
                    <span className="text-lg mr-3 opacity-50 group-focus-within:opacity-100 transition">👤</span>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} 
                        className="bg-transparent text-white w-full outline-none placeholder-gray-600 font-medium text-sm" placeholder="Your Name" />
                </div>
            </div>

            <div>
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest ml-1 mb-2 block">About</label>
                <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-3 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all group">
                    <span className="text-lg mr-3 opacity-50 group-focus-within:opacity-100 transition">📝</span>
                    <input type="text" value={status} onChange={(e) => setStatus(e.target.value)} 
                        className="bg-transparent text-white w-full outline-none placeholder-gray-600 font-medium text-sm" placeholder="Available, At Gym, etc." />
                </div>
            </div>
        </div>

        <button onClick={handleSave} disabled={loading} 
            className={`w-full mt-8 py-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 relative overflow-hidden group
            ${success ? "bg-emerald-600 shadow-emerald-500/20 cursor-default" : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/30"}`}
        >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <span className="relative z-10">{loading ? "Updating..." : success ? "Saved Successfully! ✓" : "Save Changes"}</span>
        </button>

      </div>
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
}

export default Profile;