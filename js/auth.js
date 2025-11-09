// js/auth.js - UPDATED WITH ROLE-BASED REDIRECTS
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

// Registration function with better error handling
export async function registerVoter(email, password, voterData) {
    try {
        console.log('Attempting to register:', email);
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('User created, storing voter data...');
        
        // Store voter data in Firestore
        await setDoc(doc(db, "voters", user.uid), {
            voterID: user.uid,
            fullName: voterData.fullName,
            email: email,
            voterId: voterData.voterId,
            role: 'voter', // Default role
            faceData: voterData.faceData || null,
            biometricKey: voterData.biometricKey || null,
            hasVoted: false,
            registrationDate: new Date().toISOString()
        });
        
        console.log('Voter data stored successfully');
        return { success: true, user: user };
        
    } catch (error) {
        console.error('Registration error details:', error);
        
        // User-friendly error messages
        let errorMessage = error.message;
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already registered. Please use a different email or login.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password is too weak. Please use at least 6 characters.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address. Please check your email format.';
        } else if (error.code === 'auth/operation-not-allowed') {
            errorMessage = 'Email/password accounts are not enabled. Please contact administrator.';
        }
        
        return { success: false, error: errorMessage };
    }
}

// Login function with role-based redirects
export async function loginVoter(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Get user role from Firestore
        const userData = await getVoterData(user.uid);
        if (userData.success) {
            const role = userData.data.role || 'voter';
            const fullName = userData.data.fullName || 'User';
            
            console.log('Login successful. Role:', role);
            
            return { 
                success: true, 
                user: user,
                role: role,
                fullName: fullName
            };
        }
        
        return { success: true, user: user, role: 'voter', fullName: 'User' };
        
    } catch (error) {
        console.error('Login error:', error);
        
        let errorMessage = error.message;
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email. Please register first.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password. Please try again.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed attempts. Please try again later.';
        }
        
        return { success: false, error: errorMessage };
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
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Get user role for callback
            const userData = await getVoterData(user.uid);
            const role = userData.success ? (userData.data.role || 'voter') : 'voter';
            callback(user, role);
        } else {
            callback(null, null);
        }
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
            return { success: false, error: "No voter data found!" };
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
        const userData = await getVoterData(userId);
        if (userData.success) {
            return userData.data.role === 'admin';
        }
        return false;
    } catch (error) {
        return false;
    }
}

// Check if user is voter
export async function isVoter(userId) {
    try {
        const userData = await getVoterData(userId);
        if (userData.success) {
            return userData.data.role === 'voter';
        }
        return false;
    } catch (error) {
        return false;
    }
}

// Get user role
export async function getUserRole(userId) {
    try {
        const userData = await getVoterData(userId);
        if (userData.success) {
            return userData.data.role || 'voter';
        }
        return 'voter';
    } catch (error) {
        return 'voter';
    }
}

// Redirect user based on role
export function redirectBasedOnRole(role, fullName = 'User') {
    if (role === 'admin') {
        // Store admin info in session storage
        sessionStorage.setItem('adminName', fullName);
        window.location.href = 'pages/admin.html';
    } else {
        // Store voter info in session storage
        sessionStorage.setItem('voterName', fullName);
        window.location.href = 'pages/vote.html';
    }
}