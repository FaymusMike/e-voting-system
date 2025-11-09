// js/face-simple.js - SIMPLIFIED VERSION WITH WORKING CAMERA
export async function startCamera(videoElementId) {
    const video = document.getElementById(videoElementId);
    
    try {
        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 500 },
                height: { ideal: 375 },
                facingMode: 'user'
            } 
        });
        
        video.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve();
            };
        });
        
        console.log('Camera started successfully');
        return true;
    } catch (error) {
        console.error('Error accessing camera:', error);
        
        // User-friendly error messages
        if (error.name === 'NotAllowedError') {
            throw new Error('Camera access denied. Please allow camera permissions and try again.');
        } else if (error.name === 'NotFoundError') {
            throw new Error('No camera found. Please ensure you have a camera connected.');
        } else if (error.name === 'NotSupportedError') {
            throw new Error('Camera not supported in this browser.');
        } else {
            throw new Error('Cannot access camera: ' + error.message);
        }
    }
}

export async function captureFace() {
    // For demo purposes - simulate face capture
    return new Promise((resolve) => {
        // Simulate processing time
        setTimeout(() => {
            // Generate a mock face descriptor (128 random numbers)
            const mockDescriptor = Array.from({length: 128}, () => Math.random());
            console.log('Face captured successfully (simulated)');
            resolve(mockDescriptor);
        }, 1000);
    });
}

export async function verifyFace(storedDescriptor) {
    // For demo purposes - always return true
    return true;
}

export function stopCamera(videoElementId) {
    const video = document.getElementById(videoElementId);
    if (video && video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
        console.log('Camera stopped');
    }
}