import { useState } from "react";
import { auth, googleProvider, db } from "../firebase";
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut } from "firebase/auth"; // 🆕 Added signOut
import { doc, setDoc, getDoc } from "firebase/firestore";

export const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [realName, setRealName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState(""); // 🆕 Success Message State
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg(""); // Clear previous success messages
    setLoading(true);

    try {
      if (isLogin) {
        // --- LOGIN LOGIC ---
        await signInWithEmailAndPassword(auth, email, password);
        // App.jsx detects login automatically
      } else {
        // --- SIGNUP LOGIC ---
        const res = await createUserWithEmailAndPassword(auth, email, password);
        
        // 1. Update Profile
        await updateProfile(res.user, { displayName: realName });

        // 2. Save to Database
        await setDoc(doc(db, "users", res.user.uid), {
          uid: res.user.uid,
          realName: realName,
          username: username.toLowerCase(),
          email: email,
          photoURL: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
          createdAt: new Date()
        });

        // 3. 🆕 FORCE LOGOUT & SHOW SUCCESS
        await signOut(auth); // Kick them out immediately
        setLoading(false);
        setIsLogin(true); // Switch to Login Mode
        setSuccessMsg("Account created successfully! Please log in."); // Show Banner
      }
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
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white font-sans">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96 flex flex-col gap-4">
        <h2 className="text-3xl font-bold text-center text-green-500 mb-2">
          {isLogin ? "Welcome Back" : "Create Account"}
        </h2>
        
        {/* 🆕 ERROR BANNER */}
        {error && <p className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded border border-red-500">{error}</p>}

        {/* 🆕 SUCCESS BANNER */}
        {successMsg && <div className="bg-green-900/30 text-green-400 p-3 rounded border border-green-500 text-center text-sm font-bold animate-pulse">
            {successMsg}
        </div>}

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          {!isLogin && (
            <>
              <input 
                type="text" placeholder="Real Name (e.g. John Doe)" required 
                className="p-3 rounded bg-gray-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                onChange={(e) => setRealName(e.target.value)}
              />
              <input 
                type="text" placeholder="Username (Unique ID)" required 
                className="p-3 rounded bg-gray-700 outline-none focus:ring-2 focus:ring-green-500 transition"
                onChange={(e) => setUsername(e.target.value)}
              />
            </>
          )}
          
          <input 
            type="email" placeholder="Email" required 
            className="p-3 rounded bg-gray-700 outline-none focus:ring-2 focus:ring-green-500 transition"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input 
            type="password" placeholder="Password" required 
            className="p-3 rounded bg-gray-700 outline-none focus:ring-2 focus:ring-green-500 transition"
            onChange={(e) => setPassword(e.target.value)}
          />
          
          <button 
            type="submit" 
            disabled={loading}
            className={`p-3 rounded font-bold transition flex justify-center ${
                loading ? "bg-gray-600 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {loading ? "Processing..." : (isLogin ? "Log In" : "Sign Up")}
          </button>
        </form>

        <div className="flex items-center justify-between my-2">
          <div className="h-[1px] bg-gray-600 w-full"></div>
          <span className="px-2 text-gray-400 text-sm">OR</span>
          <div className="h-[1px] bg-gray-600 w-full"></div>
        </div>

        <button onClick={signInWithGoogle} className="bg-white text-gray-900 p-3 rounded font-bold hover:bg-gray-200 transition flex justify-center gap-2">
           <img src="https://img.icons8.com/color/48/google-logo.png" className="w-6 h-6" alt="Google"/> 
           Sign in with Google
        </button>

        <p className="text-center text-gray-400 text-sm mt-4">
          {isLogin ? "Don't have an account?" : "Already have an account?"} 
          <span onClick={() => { setIsLogin(!isLogin); setSuccessMsg(""); setError(""); }} className="text-green-500 cursor-pointer ml-1 hover:underline">
            {isLogin ? "Sign Up" : "Log In"}
          </span>
        </p>
      </div>
    </div>
  );
};