// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔥 Firebase configuration (from your console)
const firebaseConfig = {
  apiKey: "AIzaSyCvD00QzwL6tmz6Bcz_J8fPF5xkGxIGmwk",
  authDomain: "nervosound-a1e73.firebaseapp.com",
  projectId: "nervosound-a1e73",
  storageBucket: "nervosound-a1e73.appspot.com",
  messagingSenderId: "104739152232",
  appId: "1:104739152232:web:3a29bdec9a38a7b82f36dd",
  measurementId: "G-W7TRN9WJ85"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Firestore DB
export const db = getFirestore(app);
