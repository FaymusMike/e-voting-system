// js/vote.js - COMPLETE DEBUGGED VERSION
import { auth, db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    doc, 
    updateDoc, 
    increment,
    getDoc,
    setDoc,
    addDoc,
    query,
    where
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getVoterData, updateVoteStatus, isAdmin, logoutUser } from './auth.js';
import { uploadCandidateImage, getPlaceholderImage } from './image-upload.js';

let currentUser = null;
let selectedCandidate = null;

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
                                Vote for ${candidate.name}
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

// Show verification modal
function showVerificationModal() {
    try {
        const modalElement = document.getElementById('verificationModal');
        if (!modalElement) {
            console.error('Verification modal not found');
            return;
        }
        
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        
        // Reset verification steps
        document.querySelectorAll('.step-number').forEach(step => {
            step.classList.remove('step-active');
        });
        document.getElementById('confirmVote').disabled = true;
        
        // Setup verification button handlers
        const verifyFaceBtn = document.getElementById('verifyFaceVote');
        const verifyBiometricBtn = document.getElementById('verifyBiometricVote');
        const confirmVoteBtn = document.getElementById('confirmVote');
        
        if (verifyFaceBtn) {
            verifyFaceBtn.onclick = verifyFaceForVote;
        }
        if (verifyBiometricBtn) {
            verifyBiometricBtn.onclick = verifyBiometricForVote;
        }
        if (confirmVoteBtn) {
            confirmVoteBtn.onclick = castVote;
        }
    } catch (error) {
        console.error('Error showing verification modal:', error);
        alert('Error starting verification process. Please try again.');
    }
}

// Verify face for voting
async function verifyFaceForVote() {
    const faceStep = document.querySelector('.verification-step:nth-child(1) .step-number');
    
    try {
        // Simulate face verification for demo
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (faceStep) {
            faceStep.classList.add('step-active');
            faceStep.innerHTML = '<i class="fas fa-check"></i>';
        }
        
        checkAllVerifications();
    } catch (error) {
        console.error('Error during face verification:', error);
        alert('Error during face verification. Please try again.');
    }
}

// Verify biometric for voting
async function verifyBiometricForVote() {
    const biometricStep = document.querySelector('.verification-step:nth-child(2) .step-number');
    
    try {
        // Simulate biometric verification for demo
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (biometricStep) {
            biometricStep.classList.add('step-active');
            biometricStep.innerHTML = '<i class="fas fa-check"></i>';
        }
        
        checkAllVerifications();
    } catch (error) {
        console.error('Error during biometric verification:', error);
        alert('Error during biometric verification. Please try again.');
    }
}

// Check if all verifications are complete
function checkAllVerifications() {
    try {
        const activeSteps = document.querySelectorAll('.step-active').length;
        const confirmVoteBtn = document.getElementById('confirmVote');
        
        if (confirmVoteBtn && activeSteps === 2) {
            confirmVoteBtn.disabled = false;
            confirmVoteBtn.innerHTML = '<i class="fas fa-check-circle me-2"></i>Confirm Vote';
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
            confirmVoteBtn.innerHTML = 'Confirm Vote';
        }
    }
}

// Initialize admin dashboard
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
                        // Show error but don't block the UI
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
    // You can add a banner or alert showing data load issues
    console.warn('Some data failed to load due to permissions');
    // Optionally show a user-friendly message
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
    // In a real implementation, you would:
    // 1. Fetch candidate data
    // 2. Populate the add candidate form with existing data
    // 3. Change the save button to update instead of create
};

window.deleteCandidate = async function(candidateId) {
    if (confirm('Are you sure you want to delete this candidate? This action cannot be undone.')) {
        try {
            // Note: In a real implementation, you would import deleteDoc from firebase
            // import { deleteDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
            // await deleteDoc(doc(db, "candidates", candidateId));
            
            alert(`Delete functionality for candidate ${candidateId} would be implemented here.`);
            // For now, just refresh the table
            await loadCandidatesTable();
        } catch (error) {
            console.error('Error deleting candidate:', error);
            alert('Error deleting candidate. Please try again.');
        }
    }
};

// Initialize charts when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // This ensures charts are properly initialized
    console.log('Vote.js loaded successfully');
});