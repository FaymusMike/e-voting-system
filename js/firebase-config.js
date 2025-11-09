// js/firebase-config.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

const firebaseConfig = {
  apiKey: "AIzaSyDSSOLxxO1daJdDjFMzxGCcphUjBPKD1J4",
  authDomain: "e-voting-system-de4fd.firebaseapp.com",
  projectId: "e-voting-system-de4fd",
  storageBucket: "e-voting-system-de4fd.firebasestorage.app",
  messagingSenderId: "532915558271",
  appId: "1:532915558271:web:954a6edf1b82e22127ac4a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };