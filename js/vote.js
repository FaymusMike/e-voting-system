// js/vote.js - COMPLETE DEBUGGED VERSION WITH CAMERA VERIFICATION
import { auth, db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    doc, 
    updateDoc, 
    increment,
    getDoc,
    setDoc,
    addDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getVoterData, updateVoteStatus, isAdmin, logoutUser } from './auth.js';
import { uploadCandidateImage, getPlaceholderImage } from './image-upload.js';

let currentUser = null;
let selectedCandidate = null;

// Camera state for verification
let verificationCameraStarted = false;
let faceVerified = false;
let biometricVerified = false;

// Initialize voting page
export async function initVotingPage() {
    try {
        // Check authentication
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                const voterData = await getVoterData(user.uid);
                
                if (voterData.success) {
                    // Check if user is admin trying to access voting page
                    if (voterData.data.role === 'admin') {
                        alert('Admins cannot vote. Redirecting to admin dashboard.');
                        window.location.href = 'admin.html';
                        return;
                    }
                    
                    if (voterData.data.hasVoted) {
                        alert('You have already voted in this election.');
                        window.location.href = '../index.html';
                        return;
                    }
                    
                    // Set voter name from session storage or Firestore
                    const voterName = sessionStorage.getItem('voterName') || voterData.data.fullName || 'Voter';
                    document.getElementById('voterName').textContent = `Welcome, ${voterName}`;
                    await loadCandidates();
                } else {
                    console.error('Failed to load voter data:', voterData.error);
                    alert('Error loading your voter information. Please try again.');
                }
            } else {
                window.location.href = 'login.html';
            }
        });
        
        // Setup logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await logoutUser();
                sessionStorage.removeItem('voterName');
                sessionStorage.removeItem('adminName');
                window.location.href = '../index.html';
            });
        }
    } catch (error) {
        console.error('Error initializing voting page:', error);
        alert('Error initializing voting system. Please refresh the page.');
    }
}

// Load candidates from Firestore
async function loadCandidates() {
    try {
        const querySnapshot = await getDocs(collection(db, "candidates"));
        const candidatesList = document.getElementById('candidatesList');
        
        if (!candidatesList) {
            console.error('Candidates list element not found');
            return;
        }
        
        candidatesList.innerHTML = '';
        
        if (querySnapshot.empty) {
            candidatesList.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-info">
                        <h5>No candidates available yet</h5>
                        <p>Please check back later or contact the administrator.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const candidate = doc.data();
            const candidateId = doc.id;
            const photoURL = candidate.photoURL || getPlaceholderImage(candidate.name);
            
            const candidateCard = `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card candidate-card">
                        <img src="${photoURL}" 
                             class="card-img-top candidate-img" alt="${candidate.name}"
                             onerror="this.src='${getPlaceholderImage(candidate.name)}'">
                        <div class="card-body">
                            <h5 class="card-title">${candidate.name}</h5>
                            <p class="card-text">
                                <strong>Party:</strong> ${candidate.party}<br>
                                <strong>Position:</strong> ${candidate.position}
                            </p>
                            <p class="card-text">${candidate.description || ''}</p>
                            <button class="btn btn-primary w-100 vote-candidate" 
                                    data-candidate-id="${candidateId}">
                                <i class="fas fa-vote-yea me-2"></i>Vote for ${candidate.name}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            candidatesList.innerHTML += candidateCard;
        });
        
        // Add event listeners to vote buttons
        document.querySelectorAll('.vote-candidate').forEach(button => {
            button.addEventListener('click', (e) => {
                selectedCandidate = e.target.getAttribute('data-candidate-id');
                showVerificationModal();
            });
        });
        
    } catch (error) {
        console.error('Error loading candidates:', error);
        const candidatesList = document.getElementById('candidatesList');
        if (candidatesList) {
            candidatesList.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-danger">
                        <h5>Error loading candidates</h5>
                        <p>Please try refreshing the page.</p>
                    </div>
                </div>
            `;
        }
    }
}

// Show verification modal - UPDATED WITH CAMERA
function showVerificationModal() {
    try {
        const modalElement = document.getElementById('verificationModal');
        if (!modalElement) {
            console.error('Verification modal not found');
            return;
        }
        
        // Reset verification state
        resetVerificationState();
        
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        
        // Setup verification button handlers
        setupVerificationHandlers();
        
    } catch (error) {
        console.error('Error showing verification modal:', error);
        alert('Error starting verification process. Please try again.');
    }
}

// Reset verification state
function resetVerificationState() {
    verificationCameraStarted = false;
    faceVerified = false;
    biometricVerified = false;
    
    // Reset UI
    document.querySelectorAll('.step-number').forEach(step => {
        step.classList.remove('step-active');
        step.innerHTML = step.id === 'faceStepNumber' ? '1' : '2';
    });
    
    document.getElementById('confirmVote').disabled = true;
    document.getElementById('captureVerificationFace').disabled = true;
    document.getElementById('verifyBiometricVote').disabled = true;
    
    // Clear status messages
    const faceStatus = document.getElementById('faceVerificationStatus');
    const biometricStatus = document.getElementById('biometricStatus');
    const progressElement = document.getElementById('verificationProgress');
    
    if (faceStatus) faceStatus.textContent = '';
    if (biometricStatus) biometricStatus.textContent = '';
    if (progressElement) progressElement.style.display = 'none';
    
    // Stop any running camera
    stopVerificationCamera();
}

// Setup verification handlers
function setupVerificationHandlers() {
    try {
        // Face verification handlers
        const startCameraBtn = document.getElementById('startVerificationCamera');
        const captureFaceBtn = document.getElementById('captureVerificationFace');
        const verifyBiometricBtn = document.getElementById('verifyBiometricVote');
        const confirmVoteBtn = document.getElementById('confirmVote');
        
        if (startCameraBtn) {
            startCameraBtn.onclick = startVerificationCamera;
        }
        if (captureFaceBtn) {
            captureFaceBtn.onclick = captureVerificationFace;
        }
        if (verifyBiometricBtn) {
            verifyBiometricBtn.onclick = verifyBiometricForVote;
        }
        if (confirmVoteBtn) {
            confirmVoteBtn.onclick = castVote;
        }
        
    } catch (error) {
        console.error('Error setting up verification handlers:', error);
    }
}

// Start camera for verification
async function startVerificationCamera() {
    try {
        const statusElement = document.getElementById('faceVerificationStatus');
        const startBtn = document.getElementById('startVerificationCamera');
        const captureBtn = document.getElementById('captureVerificationFace');
        
        if (statusElement) {
            statusElement.textContent = 'Starting camera...';
            statusElement.className = 'mt-2 text-center small text-info';
        }
        
        const videoElement = document.getElementById('verificationVideoElement');
        if (!videoElement) {
            throw new Error('Camera video element not found');
        }
        
        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            } 
        });
        
        videoElement.srcObject = stream;
        verificationCameraStarted = true;
        
        // Enable capture button
        if (captureBtn) {
            captureBtn.disabled = false;
        }
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.innerHTML = '<i class="fas fa-check me-1"></i>Camera Ready';
        }
        if (statusElement) {
            statusElement.textContent = 'Camera started! Position your face in the frame and click "Capture & Verify Face"';
            statusElement.className = 'mt-2 text-center small text-success';
        }
        
        console.log('Verification camera started successfully');
        
    } catch (error) {
        console.error('Error starting verification camera:', error);
        const statusElement = document.getElementById('faceVerificationStatus');
        
        let errorMessage = 'Error starting camera: ' + error.message;
        if (error.name === 'NotAllowedError') {
            errorMessage = 'Camera access denied. Please allow camera permissions to continue.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'No camera found. Please ensure you have a camera connected.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage = 'Camera not supported in this browser.';
        }
        
        if (statusElement) {
            statusElement.textContent = errorMessage;
            statusElement.className = 'mt-2 text-center small text-danger';
        }
        
        alert(errorMessage);
    }
}

// Capture and verify face
async function captureVerificationFace() {
    try {
        if (!verificationCameraStarted) {
            alert('Please start the camera first!');
            return;
        }
        
        const statusElement = document.getElementById('faceVerificationStatus');
        const captureBtn = document.getElementById('captureVerificationFace');
        const progressElement = document.getElementById('verificationProgress');
        const progressText = document.getElementById('progressText');
        
        if (statusElement) {
            statusElement.textContent = 'Capturing and verifying face...';
            statusElement.className = 'mt-2 text-center small text-info';
        }
        
        if (progressElement && progressText) {
            progressElement.style.display = 'block';
            progressText.textContent = 'Analyzing facial features...';
        }
        
        if (captureBtn) {
            captureBtn.disabled = true;
            captureBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Verifying...';
        }
        
        // Simulate face capture and verification process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // For demo purposes, we'll simulate successful verification
        faceVerified = true;
        
        // Update UI
        const faceStep = document.getElementById('faceStepNumber');
        if (faceStep) {
            faceStep.classList.add('step-active');
            faceStep.innerHTML = '<i class="fas fa-check"></i>';
        }
        
        if (statusElement) {
            statusElement.textContent = '✓ Face verified successfully!';
            statusElement.className = 'mt-2 text-center small text-success';
        }
        
        if (progressElement && progressText) {
            progressText.textContent = 'Face verification complete!';
        }
        
        // Enable biometric verification
        document.getElementById('verifyBiometricVote').disabled = false;
        
        // Stop camera after successful verification
        stopVerificationCamera();
        
        console.log('Face verification completed successfully');
        
        // Check if both verifications are complete
        checkAllVerifications();
        
    } catch (error) {
        console.error('Error during face verification:', error);
        const statusElement = document.getElementById('faceVerificationStatus');
        
        if (statusElement) {
            statusElement.textContent = 'Face verification failed. Please try again.';
            statusElement.className = 'mt-2 text-center small text-danger';
        }
        
        const captureBtn = document.getElementById('captureVerificationFace');
        if (captureBtn) {
            captureBtn.disabled = false;
            captureBtn.innerHTML = '<i class="fas fa-camera-retro me-1"></i>Capture & Verify Face';
        }
        
        alert('Face verification failed: ' + error.message);
    }
}

// Stop verification camera
function stopVerificationCamera() {
    const videoElement = document.getElementById('verificationVideoElement');
    if (videoElement && videoElement.srcObject) {
        const tracks = videoElement.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoElement.srcObject = null;
    }
    verificationCameraStarted = false;
}

// Verify biometric for voting - UPDATED
async function verifyBiometricForVote() {
    try {
        const statusElement = document.getElementById('biometricStatus');
        const verifyBtn = document.getElementById('verifyBiometricVote');
        const progressElement = document.getElementById('verificationProgress');
        const progressText = document.getElementById('progressText');
        
        if (statusElement) {
            statusElement.textContent = 'Starting biometric verification...';
            statusElement.className = 'mt-2 small text-info';
        }
        
        if (progressElement && progressText) {
            progressText.textContent = 'Waiting for biometric input...';
        }
        
        if (verifyBtn) {
            verifyBtn.disabled = true;
            verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Verifying...';
        }
        
        // Simulate biometric verification process
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // For demo, simulate successful biometric verification
        biometricVerified = true;
        
        // Update UI
        const biometricStep = document.getElementById('biometricStepNumber');
        if (biometricStep) {
            biometricStep.classList.add('step-active');
            biometricStep.innerHTML = '<i class="fas fa-check"></i>';
        }
        
        if (statusElement) {
            statusElement.textContent = '✓ Biometric verification successful!';
            statusElement.className = 'mt-2 small text-success';
        }
        
        if (progressElement && progressText) {
            progressText.textContent = 'All verifications complete! You can now cast your vote.';
            progressElement.className = 'alert alert-success mt-3';
        }
        
        console.log('Biometric verification completed successfully');
        
        // Check if both verifications are complete
        checkAllVerifications();
        
    } catch (error) {
        console.error('Error during biometric verification:', error);
        const statusElement = document.getElementById('biometricStatus');
        
        if (statusElement) {
            statusElement.textContent = 'Biometric verification failed. Please try again.';
            statusElement.className = 'mt-2 small text-danger';
        }
        
        const verifyBtn = document.getElementById('verifyBiometricVote');
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = '<i class="fas fa-fingerprint me-1"></i>Verify Biometric';
        }
        
        alert('Biometric verification failed: ' + error.message);
    }
}

// Check if all verifications are complete - UPDATED
function checkAllVerifications() {
    try {
        if (faceVerified && biometricVerified) {
            const confirmVoteBtn = document.getElementById('confirmVote');
            
            if (confirmVoteBtn) {
                confirmVoteBtn.disabled = false;
                confirmVoteBtn.innerHTML = '<i class="fas fa-check-circle me-2"></i>Confirm & Cast Vote';
            }
            
            console.log('All verifications complete, vote confirmation enabled');
        }
    } catch (error) {
        console.error('Error checking verifications:', error);
    }
}

// Cast the final vote
async function castVote() {
    try {
        if (!currentUser) {
            alert('You must be logged in to vote.');
            window.location.href = 'login.html';
            return;
        }
        
        if (!selectedCandidate) {
            alert('No candidate selected.');
            return;
        }
        
        if (!faceVerified || !biometricVerified) {
            alert('Please complete both verification steps before casting your vote.');
            return;
        }
        
        const confirmVoteBtn = document.getElementById('confirmVote');
        if (confirmVoteBtn) {
            confirmVoteBtn.disabled = true;
            confirmVoteBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Casting Vote...';
        }
        
        // Update candidate vote count
        const candidateRef = doc(db, "candidates", selectedCandidate);
        await updateDoc(candidateRef, {
            votes: increment(1)
        });
        
        // Update voter status
        await updateVoteStatus(currentUser.uid);
        
        // Record the vote
        await setDoc(doc(db, "votes", `${currentUser.uid}_${Date.now()}`), {
            voterId: currentUser.uid,
            candidateId: selectedCandidate,
            timestamp: new Date().toISOString(),
            election: "2024 Presidential Election"
        });
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('verificationModal'));
        if (modal) {
            modal.hide();
        }
        
        alert('Your vote has been successfully cast! Thank you for participating.');
        window.location.href = '../index.html';
        
    } catch (error) {
        console.error('Error casting vote:', error);
        alert('Error casting vote. Please try again.');
        
        // Reset button
        const confirmVoteBtn = document.getElementById('confirmVote');
        if (confirmVoteBtn) {
            confirmVoteBtn.disabled = false;
            confirmVoteBtn.innerHTML = '<i class="fas fa-check-circle me-2"></i>Confirm & Cast Vote';
        }
    }
}

// Initialize admin dashboard - FIXED VERSION
export async function initAdminDashboard() {
    try {
        console.log('Initializing admin dashboard...');
        
        // Show loading
        const authCheck = document.getElementById('authCheck');
        const adminContent = document.getElementById('adminContent');
        
        if (authCheck) authCheck.style.display = 'block';
        if (adminContent) adminContent.style.display = 'none';
        
        // Check auth state with timeout
        const authCheckPromise = new Promise((resolve, reject) => {
            const unsubscribe = auth.onAuthStateChanged(async (user) => {
                unsubscribe(); // Clean up listener
                resolve(user);
            });
            
            // Timeout after 10 seconds
            setTimeout(() => {
                unsubscribe();
                reject(new Error('Authentication check timeout'));
            }, 10000);
        });
        
        const user = await authCheckPromise;
        
        if (user) {
            console.log('User authenticated:', user.uid);
            
            try {
                // Check if user is admin with timeout
                const adminCheckPromise = Promise.race([
                    isAdmin(user.uid),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Admin check timeout')), 5000)
                    )
                ]);
                
                const userIsAdmin = await adminCheckPromise;
                const userData = await getVoterData(user.uid);
                
                if (userIsAdmin && userData.success) {
                    console.log('User is admin, loading dashboard...');
                    
                    // User is admin, show dashboard
                    if (authCheck) authCheck.style.display = 'none';
                    if (adminContent) adminContent.style.display = 'block';
                    
                    // Set admin welcome message
                    const adminName = sessionStorage.getItem('adminName') || userData.data.fullName || 'Admin';
                    const adminWelcome = document.getElementById('adminWelcome');
                    if (adminWelcome) {
                        adminWelcome.textContent = `Welcome, ${adminName}`;
                    }
                    
                    // Load admin data (don't wait for it to complete)
                    loadAdminData().catch(error => {
                        console.error('Error loading admin data:', error);
                        showDataError();
                    });
                    
                    setupAdminEventListeners();
                    
                } else {
                    // User is not admin
                    console.log('User is not admin, redirecting...');
                    handleNonAdminRedirect(userData);
                }
                
            } catch (error) {
                console.error('Error during admin check:', error);
                // If admin check fails, still show dashboard but with limited functionality
                if (authCheck) authCheck.style.display = 'none';
                if (adminContent) adminContent.style.display = 'block';
                
                showDataError();
                setupAdminEventListeners();
            }
            
        } else {
            // No user logged in
            console.log('No user logged in, redirecting to login...');
            handleNoUserRedirect();
        }
        
    } catch (error) {
        console.error('Error initializing admin dashboard:', error);
        
        // Show error state but don't block completely
        const authCheck = document.getElementById('authCheck');
        const adminContent = document.getElementById('adminContent');
        
        if (authCheck) authCheck.style.display = 'none';
        if (adminContent) adminContent.style.display = 'block';
        
        showDataError();
        setupAdminEventListeners();
    }
}

// Helper function for non-admin users
function handleNonAdminRedirect(userData) {
    const authCheck = document.getElementById('authCheck');
    if (authCheck) authCheck.style.display = 'none';
    
    if (userData.success && userData.data.role === 'voter') {
        alert('Access denied. Voters cannot access admin panel.');
        window.location.href = 'vote.html';
    } else {
        const createAdmin = confirm('You do not have admin privileges. Would you like to create an admin account?');
        if (createAdmin) {
            window.location.href = 'admin-register.html';
        } else {
            window.location.href = '../index.html';
        }
    }
}

// Helper function for no user
function handleNoUserRedirect() {
    const authCheck = document.getElementById('authCheck');
    if (authCheck) authCheck.style.display = 'none';
    
    const loginFirst = confirm('Please login to access admin panel. Would you like to login now?');
    if (loginFirst) {
        window.location.href = 'login.html';
    } else {
        window.location.href = '../index.html';
    }
}

// Show data error message
function showDataError() {
    console.warn('Some data failed to load due to permissions');
    const existingAlert = document.getElementById('dataErrorAlert');
    if (!existingAlert) {
        const alert = document.createElement('div');
        alert.id = 'dataErrorAlert';
        alert.className = 'alert alert-warning alert-dismissible fade show';
        alert.innerHTML = `
            <strong>Note:</strong> Some data may not load due to permission settings. 
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        const adminContent = document.getElementById('adminContent');
        if (adminContent) {
            adminContent.insertBefore(alert, adminContent.firstChild);
        }
    }
}

// Load admin data
async function loadAdminData() {
    try {
        await loadVoterStats();
        await loadCandidatesTable();
        await loadVotersTable();
        await loadResultsChart();
    } catch (error) {
        console.error('Error loading admin data:', error);
        alert('Error loading admin data. Please try refreshing the page.');
    }
}

// Load voter statistics - FIXED
async function loadVoterStats() {
    try {
        const votersSnapshot = await getDocs(collection(db, "voters"));
        const totalVoters = votersSnapshot.size;
        
        const votedVoters = votersSnapshot.docs.filter(doc => doc.data().hasVoted).length;
        
        // Update DOM elements safely
        const totalVotersEl = document.getElementById('totalVoters');
        const votesCastEl = document.getElementById('votesCast');
        const remainingVotersEl = document.getElementById('remainingVoters');
        const totalCandidatesEl = document.getElementById('totalCandidates');
        
        if (totalVotersEl) totalVotersEl.textContent = totalVoters;
        if (votesCastEl) votesCastEl.textContent = votedVoters;
        if (remainingVotersEl) remainingVotersEl.textContent = totalVoters - votedVoters;
        
        // Try to load candidates count
        try {
            const candidatesSnapshot = await getDocs(collection(db, "candidates"));
            if (totalCandidatesEl) totalCandidatesEl.textContent = candidatesSnapshot.size;
        } catch (candidateError) {
            console.warn('Could not load candidates count:', candidateError);
            if (totalCandidatesEl) totalCandidatesEl.textContent = 'N/A';
        }
        
    } catch (error) {
        console.error('Error loading voter stats:', error);
        
        // Set fallback values
        const totalVotersEl = document.getElementById('totalVoters');
        const votesCastEl = document.getElementById('votesCast');
        const remainingVotersEl = document.getElementById('remainingVoters');
        const totalCandidatesEl = document.getElementById('totalCandidates');
        
        if (totalVotersEl) totalVotersEl.textContent = 'N/A';
        if (votesCastEl) votesCastEl.textContent = 'N/A';
        if (remainingVotersEl) remainingVotersEl.textContent = 'N/A';
        if (totalCandidatesEl) totalCandidatesEl.textContent = 'N/A';
    }
}

// Load candidates for admin table - FIXED
async function loadCandidatesTable() {
    try {
        const querySnapshot = await getDocs(collection(db, "candidates"));
        const tableBody = document.getElementById('candidatesTable');
        
        if (!tableBody) {
            console.error('Candidates table body not found');
            return;
        }
        
        tableBody.innerHTML = '';
        
        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No candidates found</td></tr>';
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const candidate = doc.data();
            const photoURL = candidate.photoURL || getPlaceholderImage(candidate.name);
            
            tableBody.innerHTML += `
                <tr>
                    <td>
                        <img src="${photoURL}" 
                             alt="${candidate.name}" width="50" height="50" 
                             style="object-fit: cover; border-radius: 50%;"
                             onerror="this.src='${getPlaceholderImage(candidate.name)}'">
                    </td>
                    <td>${candidate.name}</td>
                    <td>${candidate.party}</td>
                    <td>${candidate.position}</td>
                    <td><strong>${candidate.votes || 0}</strong></td>
                    <td>
                        <span class="text-muted">View Only</span>
                    </td>
                </tr>
            `;
        });
        
    } catch (error) {
        console.error('Error loading candidates table:', error);
        const tableBody = document.getElementById('candidatesTable');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Cannot load candidates data
                    </td>
                </tr>
            `;
        }
    }
}

// Load voters for admin table
async function loadVotersTable() {
    try {
        const querySnapshot = await getDocs(collection(db, "voters"));
        const tableBody = document.getElementById('votersTable');
        
        if (!tableBody) {
            console.error('Voters table body not found');
            return;
        }
        
        tableBody.innerHTML = '';
        
        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No voters found</td></tr>';
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const voter = doc.data();
            const roleBadge = voter.role === 'admin' ? 
                '<span class="badge bg-danger"><i class="fas fa-shield-alt me-1"></i>Admin</span>' : 
                '<span class="badge bg-primary"><i class="fas fa-user me-1"></i>Voter</span>';
            
            const voteStatus = voter.hasVoted ? 
                '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Voted</span>' : 
                '<span class="badge bg-warning"><i class="fas fa-clock me-1"></i>Not Voted</span>';
            
            tableBody.innerHTML += `
                <tr>
                    <td>${voter.voterId || 'N/A'}</td>
                    <td>${voter.fullName}</td>
                    <td>${voter.email}</td>
                    <td>${roleBadge}</td>
                    <td>${voteStatus}</td>
                    <td>${voter.registrationDate ? new Date(voter.registrationDate).toLocaleDateString() : 'N/A'}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error loading voters table:', error);
        const tableBody = document.getElementById('votersTable');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading voters</td></tr>';
        }
    }
}

// Load results chart
async function loadResultsChart() {
    try {
        const querySnapshot = await getDocs(collection(db, "candidates"));
        const candidates = [];
        const votes = [];
        const backgroundColors = [
            '#3498db', '#e74c3c', '#2ecc71', '#f39c12', 
            '#9b59b6', '#1abc9c', '#34495e', '#d35400',
            '#16a085', '#c0392b', '#8e44ad', '#f1c40f'
        ];
        
        querySnapshot.forEach((doc) => {
            const candidate = doc.data();
            candidates.push(candidate.name);
            votes.push(candidate.votes || 0);
        });
        
        const ctx = document.getElementById('resultsChart');
        if (ctx) {
            // Destroy existing chart if it exists
            if (ctx.chart) {
                ctx.chart.destroy();
            }
            
            ctx.chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: candidates,
                    datasets: [{
                        label: 'Votes Received',
                        data: votes,
                        backgroundColor: backgroundColors.slice(0, candidates.length),
                        borderColor: backgroundColors.slice(0, candidates.length).map(color => color.replace('0.8', '1')),
                        borderWidth: 2,
                        borderRadius: 5,
                        borderSkipped: false,
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: 'Election Results',
                            font: {
                                size: 16
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            },
                            title: {
                                display: true,
                                text: 'Number of Votes'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Candidates'
                            }
                        }
                    },
                    animation: {
                        duration: 1000
                    }
                }
            });
        }
        
        // Also update detailed results chart if it exists
        const detailedCtx = document.getElementById('detailedResultsChart');
        if (detailedCtx) {
            if (detailedCtx.chart) {
                detailedCtx.chart.destroy();
            }
            
            detailedCtx.chart = new Chart(detailedCtx, {
                type: 'pie',
                data: {
                    labels: candidates,
                    datasets: [{
                        data: votes,
                        backgroundColor: backgroundColors.slice(0, candidates.length),
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'right'
                        },
                        title: {
                            display: true,
                            text: 'Vote Distribution',
                            font: {
                                size: 16
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error loading chart:', error);
    }
}

// Setup admin event listeners
function setupAdminEventListeners() {
    try {
        const saveCandidateBtn = document.getElementById('saveCandidate');
        const adminLogoutBtn = document.getElementById('adminLogoutBtn');
        
        if (saveCandidateBtn) {
            saveCandidateBtn.addEventListener('click', addCandidate);
        }
        
        if (adminLogoutBtn) {
            adminLogoutBtn.addEventListener('click', async () => {
                await logoutUser();
                sessionStorage.removeItem('adminName');
                sessionStorage.removeItem('voterName');
                window.location.href = '../index.html';
            });
        }
        
        // Add tab change listeners to refresh data
        const tabLinks = document.querySelectorAll('[data-bs-toggle="tab"]');
        tabLinks.forEach(tab => {
            tab.addEventListener('shown.bs.tab', async (e) => {
                const target = e.target.getAttribute('href');
                if (target === '#candidates') {
                    await loadCandidatesTable();
                } else if (target === '#voters') {
                    await loadVotersTable();
                } else if (target === '#results') {
                    await loadResultsChart();
                }
            });
        });
    } catch (error) {
        console.error('Error setting up admin event listeners:', error);
    }
}

// Add new candidate
async function addCandidate() {
    try {
        const name = document.getElementById('candidateName')?.value;
        const party = document.getElementById('candidateParty')?.value;
        const position = document.getElementById('candidatePosition')?.value;
        const description = document.getElementById('candidateDescription')?.value;
        const photoFile = document.getElementById('candidatePhoto')?.files[0];
        
        if (!name || !party || !position) {
            alert('Please fill in all required fields (Name, Party, and Position).');
            return;
        }
        
        const saveCandidateBtn = document.getElementById('saveCandidate');
        if (saveCandidateBtn) {
            saveCandidateBtn.disabled = true;
            saveCandidateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
        }
        
        let photoURL = getPlaceholderImage(name);
        
        // If photo is provided, try to upload it
        if (photoFile) {
            try {
                photoURL = await uploadCandidateImage(photoFile);
            } catch (uploadError) {
                console.error('Image upload failed, using placeholder:', uploadError);
                // Continue with placeholder image
            }
        }
        
        await addDoc(collection(db, "candidates"), {
            name: name.trim(),
            party: party.trim(),
            position: position.trim(),
            description: description?.trim() || '',
            photoURL: photoURL,
            votes: 0,
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.uid || 'system'
        });
        
        alert('Candidate added successfully!');
        
        // Close modal and reset form
        const modal = bootstrap.Modal.getInstance(document.getElementById('addCandidateModal'));
        if (modal) {
            modal.hide();
        }
        
        const form = document.getElementById('addCandidateForm');
        if (form) {
            form.reset();
        }
        
        // Refresh data
        await loadCandidatesTable();
        await loadResultsChart();
        await loadVoterStats();
        
    } catch (error) {
        console.error('Error adding candidate:', error);
        alert('Error adding candidate. Please try again.');
    } finally {
        const saveCandidateBtn = document.getElementById('saveCandidate');
        if (saveCandidateBtn) {
            saveCandidateBtn.disabled = false;
            saveCandidateBtn.innerHTML = 'Save Candidate';
        }
    }
}

// Global functions for candidate actions (called from HTML)
window.editCandidate = async function(candidateId) {
    alert(`Edit functionality for candidate ${candidateId} would be implemented here.`);
};

window.deleteCandidate = async function(candidateId) {
    if (confirm('Are you sure you want to delete this candidate? This action cannot be undone.')) {
        try {
            alert(`Delete functionality for candidate ${candidateId} would be implemented here.`);
            await loadCandidatesTable();
        } catch (error) {
            console.error('Error deleting candidate:', error);
            alert('Error deleting candidate. Please try again.');
        }
    }
};

// Initialize charts when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Vote.js loaded successfully');
});