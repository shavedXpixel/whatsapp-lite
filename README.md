# 🚀 WhatsApp Lite

> A premium, real-time messaging application featuring a stunning Glassmorphism UI, seamless animations, and instant connectivity. Built with **React** and **Firebase**.

![Project Banner](https://via.placeholder.com/1200x600/0f172a/10b981?text=WhatsApp+Lite+Preview)

## ✨ Features

### 💬 Messaging
- **Real-time Chat:** Instant message delivery using Firestore live listeners.
- **Direct Messages (DM):** Private 1-on-1 chats with "Read Receipts" (✓✓).
- **Group Chats:** Open public rooms with active member lists.
- **Image Sharing:** Send compressed images instantly (Base64 architecture - No storage bucket required).
- **Typing Indicators:** See when others are typing in real-time.

### 🔐 Authentication & Security
- **Google Login:** One-click sign-in.
- **Email/Password:** Secure registration system.
- **Persistent Sessions:** Stays logged in even after refresh.

### 🎨 UI/UX Design
- **Glassmorphism:** Premium frosted glass aesthetics.
- **Cinematic Animations:** Grand entrance reveals, floating backgrounds, and smooth transitions.
- **Fully Responsive:** Optimized layouts for both Desktop and Mobile (Custom bottom navigation for mobile).
- **Interactive Profile:** Update display name, bio, and profile picture.

---

## 🛠️ Tech Stack

**Frontend:**
- [React.js](https://reactjs.org/) (Vite)
- [Tailwind CSS](https://tailwindcss.com/) (Styling)
- [Framer Motion / CSS Animations](https://www.framer.com/motion/)
- [React Router DOM](https://reactrouter.com/)

**Backend / Services:**
- [Firebase Auth](https://firebase.google.com/docs/auth) (Authentication)
- [Firebase Firestore](https://firebase.google.com/docs/firestore) (Real-time Database)
- [Socket.io-client](https://socket.io/) (Signaling & Typing status)

---

## 🚀 Getting Started

Follow these steps to run the project locally.

### 1. Clone the Repository
```bash
git clone [https://github.com/your-username/whatsapp-lite.git](https://github.com/your-username/whatsapp-lite.git)
cd whatsapp-lite

2. Install Dependencies
Bash
npm install
3. Configure Firebase
Go to Firebase Console.

Create a new project.

Enable Authentication (Google & Email/Password).

Enable Cloud Firestore (Create database in test mode).

Copy your Firebase config keys.

4. Setup Environment Variables
Create a .env file in the root directory and add your Firebase keys:

Code snippet
VITE_API_KEY=your_api_key
VITE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_PROJECT_ID=your_project_id
VITE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_MESSAGING_SENDER_ID=your_sender_id
VITE_APP_ID=your_app_id
5. Run the App
Bash
npm run dev
Open http://localhost:5173 to view it in the browser.

📂 Project Structure
Bash
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/
│   │   ├── Home.jsx         # Dashboard & Chat List
│   │   ├── Login.jsx        # Auth Page
│   │   ├── Signup.jsx       # Registration Page
│   │   ├── PersonalChat.jsx # 1-on-1 Chat Logic
│   │   ├── GroupChat.jsx    # Group Room Logic
│   │   ├── Profile.jsx      # User Settings
│   │   └── About.jsx        # Developer Info
│   ├── firebase.js      # Firebase Configuration
│   ├── socket.js        # Socket Connection
│   ├── App.jsx          # Routing & Auth State
│   └── index.css        # Global Styles & Animations
🛡️ Database Rules (Firestore)
Ensure your Firestore rules allow reads/writes for authenticated users:

JavaScript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
👨‍💻 Developer
Priyansu Dash Full Stack Developer & Architect

📧 Contact: pupuhari123@gmail.com

💻 GitHub: YourGitHubProfile

<p align="center"> Crafted with 💙 and lots of caffeine. </p>