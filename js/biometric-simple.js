// js/biometric-simple.js - SIMPLIFIED BIOMETRIC FOR DEMO
export async function registerBiometric(userId, userName) {
    // Simulate biometric registration
    return new Promise((resolve) => {
        setTimeout(() => {
            alert('Biometric registration simulated successfully!');
            resolve({ id: 'demo-biometric-id' });
        }, 1000);
    });
}

export async function authenticateBiometric() {
    // Simulate biometric authentication
    return new Promise((resolve) => {
        const shouldSucceed = confirm('For demo: Click OK to simulate successful biometric authentication');
        resolve(shouldSucceed);
    });
}

export function isWebAuthnSupported() {
    return true; // Always return true for demo
}