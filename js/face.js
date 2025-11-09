// Face recognition implementation using FaceAPI.js
import { db } from './firebase-config.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let faceapi;
let video;
let canvas;
let modelsLoaded = false;

// Initialize face recognition
export async function initFaceRecognition() {
    try {
        // Load face-api.js models
        await faceapi.nets.tinyFaceDetector.loadFromUri('../models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('../models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('../models');
        await faceapi.nets.faceExpressionNet.loadFromUri('../models');
        
        modelsLoaded = true;
        console.log('FaceAPI models loaded successfully');
        return true;
    } catch (error) {
        console.error('Error loading FaceAPI models:', error);
        return false;
    }
}

// Start camera for face registration
export async function startCamera(videoElementId) {
    video = document.getElementById(videoElementId);
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 500, height: 375 } 
        });
        video.srcObject = stream;
        return true;
    } catch (error) {
        console.error('Error accessing camera:', error);
        return false;
    }
}

// Capture face and generate embedding
export async function captureFace() {
    if (!modelsLoaded) {
        alert('Face recognition models not loaded yet. Please wait.');
        return null;
    }
    
    try {
        const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
        
        if (detection) {
            const descriptor = Array.from(detection.descriptor);
            return descriptor;
        } else {
            alert('No face detected. Please try again.');
            return null;
        }
    } catch (error) {
        console.error('Error capturing face:', error);
        return null;
    }
}

// Verify face against stored descriptor
export async function verifyFace(storedDescriptor) {
    if (!modelsLoaded) {
        alert('Face recognition models not loaded yet.');
        return false;
    }
    
    try {
        const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
        
        if (detection) {
            const currentDescriptor = detection.descriptor;
            const distance = faceapi.euclideanDistance(currentDescriptor, new Float32Array(storedDescriptor));
            
            // Threshold for face matching (adjust as needed)
            const threshold = 0.6;
            return distance < threshold;
        } else {
            return false;
        }
    } catch (error) {
        console.error('Error verifying face:', error);
        return false;
    }
}

// Store face data in Firestore
export async function storeFaceData(userId, faceDescriptor) {
    try {
        const voterRef = doc(db, "voters", userId);
        await updateDoc(voterRef, {
            faceData: faceDescriptor
        });
        return true;
    } catch (error) {
        console.error('Error storing face data:', error);
        return false;
    }
}

// Stop camera
export function stopCamera() {
    if (video && video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
}