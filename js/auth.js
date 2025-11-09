import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc,
    collection,
    getDocs
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Registration function
export async function registerVoter(email, password, voterData) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Store voter data in Firestore
        await setDoc(doc(db, "voters", user.uid), {
            voterID: user.uid,
            fullName: voterData.fullName,
            email: email,
            voterId: voterData.voterId,
            faceData: voterData.faceData || null,
            biometricKey: voterData.biometricKey || null,
            hasVoted: false,
            registrationDate: new Date().toISOString()
        });
        
        return { success: true, user: user };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Login function
export async function loginVoter(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Logout function
export async function logoutUser() {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Check auth state
export function checkAuthState(callback) {
    onAuthStateChanged(auth, (user) => {
        callback(user);
    });
}

// Get voter data
export async function getVoterData(userId) {
    try {
        const docRef = doc(db, "voters", userId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return { success: true, data: docSnap.data() };
        } else {
            return { success: false, error: "No such document!" };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Update voter hasVoted status
export async function updateVoteStatus(userId) {
    try {
        const voterRef = doc(db, "voters", userId);
        await updateDoc(voterRef, {
            hasVoted: true,
            votedAt: new Date().toISOString()
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Check if user is admin
export async function isAdmin(userId) {
    try {
        const docRef = doc(db, "admins", userId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists();
    } catch (error) {
        return false;
    }
}