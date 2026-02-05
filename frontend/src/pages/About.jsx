import { useNavigate } from "react-router-dom";
import { useState } from "react";

function About() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText("pupuhari123@gmail.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const features = [
    { icon: "⚡", title: "Real-time Messaging", desc: "Instant socket-based communication." },
    { icon: "🔐", title: "Secure Authentication", desc: "Powered by Firebase Security." },
    { icon: "📸", title: "Image Sharing", desc: "Send photos & memes instantly." },
    { icon: "👥", title: "Group Rooms", desc: "Create public channels for communities." },
    { icon: "😃", title: "Emoji Support", desc: "Express yourself with a full emoji picker." },
    { icon: "📱", title: "Fully Responsive", desc: "Works perfectly on Mobile & PC." },
  ];

  return (
    // ✅ FIX: h-full + overflow-y-auto allows scrolling inside the locked App container
    <div className="h-full w-full bg-[#0f172a] font-sans relative overflow-y-auto overflow-x-hidden flex flex-col items-center py-10 px-4 custom-scrollbar">
      
      {/* 🎬 BACKGROUND EFFECTS (Fixed so they don't scroll) */}
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0 pointer-events-none"></div>
      <div className="fixed top-[-10%] left-[-10%] w-96 h-96 bg-purple-600/30 rounded-full blur-[128px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-500/30 rounded-full blur-[128px] pointer-events-none"></div>

      {/* 🔙 BACK BUTTON */}
      <button onClick={() => navigate("/")} className="absolute top-6 left-6 z-50 flex items-center gap-2 text-gray-400 hover:text-white transition group bg-black/20 p-2 rounded-lg backdrop-blur-sm border border-white/5">
        <span className="group-hover:-translate-x-1 transition-transform">←</span> Back
      </button>

      {/* 📦 CONTENT CONTAINER */}
      <div className="relative z-10 w-full max-w-4xl space-y-12 animate-grand-reveal pb-20">
        
        {/* 👨‍💻 DEVELOPER CARD */}
        <div className="text-center space-y-4 mt-10">
            <div className="relative inline-block group">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-cyan-500 rounded-full blur opacity-40 group-hover:opacity-60 transition duration-500"></div>
                <img src="https://api.dicebear.com/9.x/micah/svg?seed=Priyansu" alt="Dev" 
                    className="relative w-32 h-32 rounded-full border-4 border-[#0f172a] shadow-2xl transform group-hover:scale-105 transition duration-500 bg-[#1e293b]" />
                <div className="absolute bottom-1 right-1 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-[#0f172a]">DEV</div>
            </div>
            
            <div>
                <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500">
                    Priyansu Dash
                </h1>
                <p className="text-gray-400 text-sm mt-2 tracking-widest uppercase">Full Stack Developer & Architect</p>
            </div>

            {/* Email Pill */}
            <div onClick={handleCopy} className="inline-flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2 rounded-full cursor-pointer transition-all active:scale-95 group">
                <span className="text-gray-300 font-mono text-sm">pupuhari123@gmail.com</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${copied ? "bg-green-500/20 text-green-400" : "bg-white/10 text-gray-400 group-hover:text-white"}`}>
                    {copied ? "COPIED ✓" : "COPY"}
                </span>
            </div>
        </div>

        {/* 🌟 FEATURES GRID */}
        <div>
            <h3 className="text-center text-white/50 text-xs font-bold uppercase tracking-[0.2em] mb-8">System Capabilities</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {features.map((feat, idx) => (
                    <div key={idx} className="bg-white/5 backdrop-blur-sm border border-white/5 p-6 rounded-2xl hover:bg-white/10 hover:border-emerald-500/30 transition-all duration-300 group"
                         style={{ animationDelay: `${idx * 100}ms` }}>
                        <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300">{feat.icon}</div>
                        <h4 className="text-white font-bold text-lg mb-1">{feat.title}</h4>
                        <p className="text-gray-400 text-sm leading-relaxed">{feat.desc}</p>
                    </div>
                ))}
            </div>
        </div>

        {/* FOOTER */}
        <div className="text-center pt-10 border-t border-white/5">
            <p className="text-gray-500 text-xs">
                © {new Date().getFullYear()} WhatsApp Lite. Crafted with 💙 by Priyansu.
            </p>
        </div>

      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
}

export default About;