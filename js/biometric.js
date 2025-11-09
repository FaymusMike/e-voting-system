// Biometric validation using WebAuthn API
import { db } from './firebase-config.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Check if WebAuthn is supported
export function isWebAuthnSupported() {
    return !!window.PublicKeyCredential;
}

// Register biometric credential
export async function registerBiometric(userId, userName) {
    if (!isWebAuthnSupported()) {
        alert('WebAuthn is not supported in this browser.');
        return null;
    }
    
    try {
        // Create challenge (in production, this should come from your server)
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        
        const publicKey = {
            challenge: challenge,
            rp: {
                name: "SecureVote System",
                id: window.location.hostname
            },
            user: {
                id: new Uint8Array(16),
                name: userName,
                displayName: userName
            },
            pubKeyCredParams: [
                {
                    type: "public-key",
                    alg: -7 // ES256
                }
            ],
            timeout: 60000,
            attestation: "direct"
        };
        
        const credential = await navigator.credentials.create({
            publicKey: publicKey
        });
        
        // Store the credential ID for later authentication
        await storeBiometricData(userId, credential);
        
        return credential;
    } catch (error) {
        console.error('Error registering biometric:', error);
        return null;
    }
}

// Authenticate with biometric
export async function authenticateBiometric() {
    if (!isWebAuthnSupported()) {
        alert('WebAuthn is not supported in this browser.');
        return false;
    }
    
    try {
        // Create challenge (in production, this should come from your server)
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        
        const publicKey = {
            challenge: challenge,
            timeout: 60000,
            rpId: window.location.hostname,
            allowCredentials: [] // In production, you would specify allowed credential IDs
        };
        
        const assertion = await navigator.credentials.get({
            publicKey: publicKey
        });
        
        return !!assertion;
    } catch (error) {
        console.error('Error authenticating with biometric:', error);
        return false;
    }
}

// Store biometric data in Firestore
async function storeBiometricData(userId, credential) {
    try {
        const credentialId = Array.from(new Uint8Array(credential.rawId));
        
        const voterRef = doc(db, "voters", userId);
        await updateDoc(voterRef, {
            biometricKey: credentialId
        });
        
        return true;
    } catch (error) {
        console.error('Error storing biometric data:', error);
        return false;
    }
}