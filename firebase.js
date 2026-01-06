import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCvDO0QZwL6tmz6Bcz_J8FPF5xkGxIGmwk",
  authDomain: "nervosound-a1e73.firebaseapp.com",
  projectId: "nervosound-a1e73",
  storageBucket: "nervosound-a1e73.appspot.com",
  messagingSenderId: "104739152232",
  appId: "1:104739152232:web:3a29bdec9a38a7b82f36dd"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
