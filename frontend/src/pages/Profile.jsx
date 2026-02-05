import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

function Profile({ userData }) {
  const navigate = useNavigate();
  const [name, setName] = useState(userData?.realName || "");
  const [status, setStatus] = useState(""); // New "About" field
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Fetch latest data from Firestore (in case they updated it previously)
  useEffect(() => {
    const fetchProfile = async () => {
      if (userData?.uid) {
        const docRef = doc(db, "users", userData.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.realName || "");
          setStatus(data.about || "Hey there! I am using WhatsApp Lite.");
        }
      }
    };
    fetchProfile();
  }, [userData]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const userRef = doc(db, "users", userData.uid);
      
      // Update Firestore
      await updateDoc(userRef, {
        realName: name,
        about: status
      });

      // Show Success Animation
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000); // Hide after 3s
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to save profile.");
    } finally {
      setLoading(false);
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
        
        {/* CLOSE BUTTON */}
        <button onClick={() => navigate("/")} className="absolute top-6 right-6 text-gray-400 hover:text-white transition">✕</button>

        <div className="flex flex-col items-center mb-8">
            <div className="relative group">
                <img src={userData.photoURL} className="w-24 h-24 rounded-full border-4 border-blue-500/30 shadow-lg shadow-blue-500/20 object-cover" />
                <div className="absolute inset-0 rounded-full border-2 border-white/10"></div>
            </div>
            <h2 className="text-2xl font-bold text-white mt-4">{userData.email}</h2>
            <p className="text-xs text-blue-400 font-mono tracking-wider uppercase mt-1">User ID: {userData.uid.slice(0, 6)}...</p>
        </div>

        <div className="space-y-6">
            {/* Display Name Input */}
            <div>
                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider ml-1 mb-2 block">Display Name</label>
                <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-3 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all">
                    <span className="text-xl mr-3">👤</span>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} 
                        className="bg-transparent text-white w-full outline-none placeholder-gray-600 font-medium" placeholder="Your Name" />
                </div>
            </div>

            {/* About / Status Input */}
            <div>
                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider ml-1 mb-2 block">About</label>
                <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-3 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all">
                    <span className="text-xl mr-3">📝</span>
                    <input type="text" value={status} onChange={(e) => setStatus(e.target.value)} 
                        className="bg-transparent text-white w-full outline-none placeholder-gray-600 font-medium" placeholder="Available, At Gym, etc." />
                </div>
            </div>
        </div>

        {/* SAVE BUTTON */}
        <button onClick={handleSave} disabled={loading} 
            className={`w-full mt-8 py-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2
            ${success ? "bg-green-500 shadow-green-500/30 cursor-default" : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/30"}`}
        >
            {loading ? "Saving..." : success ? "Saved Successfully! ✓" : "Save Changes"}
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