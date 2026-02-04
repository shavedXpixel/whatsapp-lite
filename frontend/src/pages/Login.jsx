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

  // Check for success message passed from Signup page
  useEffect(() => {
    if (location.state?.successMsg) {
      setSuccess(location.state.successMsg);
      // Clear state so message doesn't persist on reload
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/"); // Go to Home
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Check if new user -> Create DB entry
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
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white font-sans">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96 flex flex-col gap-4 animate-fade-in">
        <h2 className="text-3xl font-bold text-center text-green-500 mb-2">Welcome Back</h2>
        
        {/* SUCCESS BANNER */}
        {success && <div className="bg-green-900/30 text-green-400 p-3 rounded border border-green-500 text-center text-sm font-bold animate-pulse">{success}</div>}
        
        {/* ERROR BANNER */}
        {error && <p className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded border border-red-500">{error}</p>}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input type="email" placeholder="Email" required className="p-3 rounded bg-gray-700 outline-none focus:ring-2 focus:ring-green-500" onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" required className="p-3 rounded bg-gray-700 outline-none focus:ring-2 focus:ring-green-500" onChange={(e) => setPassword(e.target.value)} />
          
          <button type="submit" disabled={loading} className={`p-3 rounded font-bold transition flex justify-center ${loading ? "bg-gray-600 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"}`}>
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <div className="flex items-center justify-between my-2">
          <div className="h-[1px] bg-gray-600 w-full"></div>
          <span className="px-2 text-gray-400 text-sm">OR</span>
          <div className="h-[1px] bg-gray-600 w-full"></div>
        </div>

        <button onClick={signInWithGoogle} className="bg-white text-gray-900 p-3 rounded font-bold hover:bg-gray-200 transition flex justify-center gap-2">
           <img src="https://img.icons8.com/color/48/google-logo.png" className="w-6 h-6" alt="Google"/> Sign in with Google
        </button>

        <p className="text-center text-gray-400 text-sm mt-4">
          Don't have an account? <Link to="/signup" className="text-green-500 hover:underline">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;