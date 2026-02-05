import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword, updateProfile, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [realName, setRealName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Create User in Auth
      const res = await createUserWithEmailAndPassword(auth, email, password);
      
      // 2. Update Display Name
      await updateProfile(res.user, { displayName: realName });

      // 3. Save to Database
      await setDoc(doc(db, "users", res.user.uid), {
        uid: res.user.uid,
        realName: realName,
        username: username.toLowerCase(),
        email: email,
        photoURL: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
        createdAt: new Date()
      });

      // 4. FORCE LOGOUT & REDIRECT TO LOGIN
      await signOut(auth);
      
      navigate("/login", { state: { successMsg: "Account created successfully! Please log in." } });

    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center relative overflow-hidden font-sans">
      
      {/* 🎬 CINEMATIC BACKGROUND */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0"></div>
      
      {/* 🔮 Animated Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] animate-float pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] animate-float-delayed pointer-events-none"></div>

      {/* 📦 GLASS SIGNUP CARD */}
      <div className="relative z-10 w-full max-w-md p-8 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl animate-grand-reveal">
        
        {/* Header */}
        <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2 drop-shadow-sm">
              Join the Network
            </h1>
            <p className="text-gray-400 text-sm tracking-wide">Create your secure identity.</p>
        </div>
        
        {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold text-center animate-shake">
                {error}
            </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          
          {/* Real Name Input */}
          <div className="group bg-black/30 border border-white/10 rounded-xl p-1 flex items-center focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/50 transition-all">
             <div className="p-3 text-gray-400 group-focus-within:text-purple-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" /></svg>
             </div>
             <input type="text" placeholder="Real Name (e.g. John Doe)" required 
                className="bg-transparent text-white w-full h-full p-2 outline-none placeholder-gray-500 text-sm font-medium" 
                onChange={(e) => setRealName(e.target.value)} />
          </div>

          {/* Username Input */}
          <div className="group bg-black/30 border border-white/10 rounded-xl p-1 flex items-center focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/50 transition-all">
             <div className="p-3 text-gray-400 group-focus-within:text-purple-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" /></svg>
             </div>
             <input type="text" placeholder="Username (Unique ID)" required 
                className="bg-transparent text-white w-full h-full p-2 outline-none placeholder-gray-500 text-sm font-medium" 
                onChange={(e) => setUsername(e.target.value)} />
          </div>

          {/* Email Input */}
          <div className="group bg-black/30 border border-white/10 rounded-xl p-1 flex items-center focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/50 transition-all">
             <div className="p-3 text-gray-400 group-focus-within:text-purple-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" /><path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" /></svg>
             </div>
             <input type="email" placeholder="Email Address" required 
                className="bg-transparent text-white w-full h-full p-2 outline-none placeholder-gray-500 text-sm font-medium" 
                onChange={(e) => setEmail(e.target.value)} />
          </div>

          {/* Password Input */}
          <div className="group bg-black/30 border border-white/10 rounded-xl p-1 flex items-center focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/50 transition-all">
             <div className="p-3 text-gray-400 group-focus-within:text-purple-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" /></svg>
             </div>
             <input type="password" placeholder="Password" required 
                className="bg-transparent text-white w-full h-full p-2 outline-none placeholder-gray-500 text-sm font-medium" 
                onChange={(e) => setPassword(e.target.value)} />
          </div>
          
          <button type="submit" disabled={loading} 
            className={`w-full mt-4 py-3.5 rounded-xl font-bold text-white shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] flex justify-center items-center gap-2
            ${loading ? "bg-gray-600 cursor-not-allowed" : "bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 shadow-purple-500/20"}`}>
            {loading ? "Creating Identity..." : "Sign Up"}
          </button>
        </form>

        <p className="text-center text-gray-400 text-xs mt-8">
          Already have an identity? <Link to="/login" className="text-purple-400 hover:text-purple-300 font-bold underline transition">Log In</Link>
        </p>
      </div>
      
      <style>{`
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.3s ease-in-out; }
      `}</style>
    </div>
  );
}

export default Signup;