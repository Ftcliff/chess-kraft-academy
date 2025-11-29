// Firebase configuration for Chess Kraft Academy
const firebaseConfig = {
  apiKey: "AIzaSyBkdOw_hCe_uIFFIeBni_pO7aYEJB8IV_8",
  authDomain: "chess-kraft-academy.firebaseapp.com",
  projectId: "chess-kraft-academy",
  storageBucket: "chess-kraft-academy.firebasestorage.app",
  messagingSenderId: "306751063492",
  appId: "1:306751063492:web:8be02e1c47f219a0de1091",
  measurementId: "G-V55ZDDHS9C"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

console.log("Firebase initialized for Chess Kraft Academy");
