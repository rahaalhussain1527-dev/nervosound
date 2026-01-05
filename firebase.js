// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCvD0OQzwI6tmz6Bcz_J8FPF5xKgxIGmwk",
  authDomain: "nervosound-a1e73.firebaseapp.com",
  projectId: "nervosound-a1e73",
  storageBucket: "nervosound-a1e73.firebasestorage.app",
  messagingSenderId: "104739152232",
  appId: "1:104739152232:web:3a29bdec9a38a7b82f36dd",
  measurementId: "G-W7TRN9WJ85"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();
