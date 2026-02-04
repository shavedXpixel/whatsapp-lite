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
      
      // Navigate to Login with a Success Message
      navigate("/login", { state: { successMsg: "Account created successfully! Please log in." } });

    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white font-sans">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96 flex flex-col gap-4 animate-fade-in">
        <h2 className="text-3xl font-bold text-center text-green-500 mb-2">Create Account</h2>
        
        {error && <p className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded border border-red-500">{error}</p>}

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <input type="text" placeholder="Real Name (e.g. John Doe)" required className="p-3 rounded bg-gray-700 outline-none focus:ring-2 focus:ring-green-500" onChange={(e) => setRealName(e.target.value)} />
          <input type="text" placeholder="Username (Unique ID)" required className="p-3 rounded bg-gray-700 outline-none focus:ring-2 focus:ring-green-500" onChange={(e) => setUsername(e.target.value)} />
          <input type="email" placeholder="Email" required className="p-3 rounded bg-gray-700 outline-none focus:ring-2 focus:ring-green-500" onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" required className="p-3 rounded bg-gray-700 outline-none focus:ring-2 focus:ring-green-500" onChange={(e) => setPassword(e.target.value)} />
          
          <button type="submit" disabled={loading} className={`p-3 rounded font-bold transition flex justify-center ${loading ? "bg-gray-600 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"}`}>
            {loading ? "Creating..." : "Sign Up"}
          </button>
        </form>

        <p className="text-center text-gray-400 text-sm mt-4">
          Already have an account? <Link to="/login" className="text-green-500 hover:underline">Log In</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;