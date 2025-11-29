// For Firebase JS SDK v7.20.0 and later, measurementId is optional

// Firebase configuration - REPLACE WITH YOUR ACTUAL CONFIG FROM FIREBASE
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

// Test connection
console.log("Firebase initialized successfully");
