import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { auth, googleProvider, db } from "../firebase";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.successMsg) {
      setSuccess(location.state.successMsg);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/"); 
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userRef = doc(db, "users", result.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const generatedUsername = result.user.email.split("@")[0];
        await setDoc(userRef, {
          uid: result.user.uid,
          realName: result.user.displayName,
          username: generatedUsername.toLowerCase(),
          email: result.user.email,
          photoURL: result.user.photoURL,
          createdAt: new Date()
        });
      }
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center relative overflow-hidden font-sans">
      
      {/* 🎬 CINEMATIC BACKGROUND */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0"></div>
      
      {/* 🔮 Animated Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] animate-float pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] animate-float-delayed pointer-events-none"></div>

      {/* 📦 GLASS LOGIN CARD (Grand Reveal) */}
      <div className="relative z-10 w-full max-w-md p-8 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl animate-grand-reveal">
        
        {/* Header */}
        <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-2 drop-shadow-sm">
              Welcome Back
            </h1>
            <p className="text-gray-400 text-sm tracking-wide">Enter the realm of seamless chat.</p>
        </div>
        
        {/* Alerts */}
        {success && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold text-center animate-pulse">
                {success}
            </div>
        )}
        
        {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold text-center animate-shake">
                {error}
            </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          
          {/* Email Input */}
          <div className="group bg-black/30 border border-white/10 rounded-xl p-1 flex items-center focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all">
             <div className="p-3 text-gray-400 group-focus-within:text-emerald-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" /><path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" /></svg>
             </div>
             <input type="email" placeholder="Email Address" required 
                className="bg-transparent text-white w-full h-full p-2 outline-none placeholder-gray-500 text-sm font-medium" 
                onChange={(e) => setEmail(e.target.value)} />
          </div>

          {/* Password Input */}
          <div className="group bg-black/30 border border-white/10 rounded-xl p-1 flex items-center focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all">
             <div className="p-3 text-gray-400 group-focus-within:text-emerald-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" /></svg>
             </div>
             <input type="password" placeholder="Password" required 
                className="bg-transparent text-white w-full h-full p-2 outline-none placeholder-gray-500 text-sm font-medium" 
                onChange={(e) => setPassword(e.target.value)} />
          </div>
          
          <button type="submit" disabled={loading} 
            className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] flex justify-center items-center gap-2
            ${loading ? "bg-gray-600 cursor-not-allowed" : "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-emerald-500/20"}`}>
            {loading ? "Decrypting..." : "Access Dashboard"}
          </button>
        </form>

        <div className="flex items-center gap-4 my-6">
            <div className="h-[1px] bg-gradient-to-r from-transparent via-gray-600 to-transparent flex-1"></div>
            <span className="text-gray-500 text-xs font-mono">OR CONTINUE WITH</span>
            <div className="h-[1px] bg-gradient-to-r from-transparent via-gray-600 to-transparent flex-1"></div>
        </div>

        <button onClick={signInWithGoogle} className="w-full bg-white text-gray-900 py-3 rounded-xl font-bold hover:bg-gray-100 transition-all flex justify-center items-center gap-3 shadow-lg transform hover:scale-[1.02] active:scale-[0.98]">
            <img src="https://img.icons8.com/color/48/google-logo.png" className="w-5 h-5" alt="Google"/> 
            <span>Google Account</span>
        </button>

        <p className="text-center text-gray-400 text-xs mt-8">
          New to the network? <Link to="/signup" className="text-emerald-400 hover:text-emerald-300 font-bold underline transition">Create Identity</Link>
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

export default Login;