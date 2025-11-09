// Voting functionality
import { auth, db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    doc, 
    updateDoc, 
    increment,
    getDoc,
    setDoc,
    query,
    where
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getVoterData, updateVoteStatus } from './auth.js';
import { verifyFace } from './face.js';

let currentUser = null;
let selectedCandidate = null;

// Initialize voting page
export async function initVotingPage() {
    // Check authentication
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            const voterData = await getVoterData(user.uid);
            
            if (voterData.success) {
                // Check if user has already voted
                if (voterData.data.hasVoted) {
                    alert('You have already voted in this election.');
                    window.location.href = '../index.html';
                    return;
                }
                
                // Display voter name
                document.getElementById('voterName').textContent = `Welcome, ${voterData.data.fullName}`;
                
                // Load candidates
                await loadCandidates();
            }
        } else {
            // Redirect to login if not authenticated
            window.location.href = 'login.html';
        }
    });
    
    // Set up logout button
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await auth.signOut();
        window.location.href = '../index.html';
    });
}

// Load candidates from Firestore
async function loadCandidates() {
    try {
        const querySnapshot = await getDocs(collection(db, "candidates"));
        const candidatesList = document.getElementById('candidatesList');
        candidatesList.innerHTML = '';
        
        querySnapshot.forEach((doc) => {
            const candidate = doc.data();
            const candidateId = doc.id;
            
            const candidateCard = `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card candidate-card">
                        <img src="${candidate.photoURL || '../assets/images/default-candidate.jpg'}" 
                             class="card-img-top candidate-img" alt="${candidate.name}">
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
        alert('Error loading candidates. Please try again.');
    }
}

// Show verification modal
function showVerificationModal() {
    const modal = new bootstrap.Modal(document.getElementById('verificationModal'));
    modal.show();
    
    // Reset verification steps
    document.querySelectorAll('.step-number').forEach(step => {
        step.classList.remove('step-active');
    });
    document.getElementById('confirmVote').disabled = true;
    
    // Set up verification buttons
    document.getElementById('verifyFaceVote').addEventListener('click', verifyFaceForVote);
    document.getElementById('verifyBiometricVote').addEventListener('click', verifyBiometricForVote);
    document.getElementById('confirmVote').addEventListener('click', castVote);
}

// Verify face for voting
async function verifyFaceForVote() {
    const faceStep = document.querySelector('.verification-step:nth-child(1) .step-number');
    
    try {
        // Get stored face data for current user
        const voterData = await getVoterData(currentUser.uid);
        
        if (voterData.success && voterData.data.faceData) {
            const faceVerified = await verifyFace(voterData.data.faceData);
            
            if (faceVerified) {
                faceStep.classList.add('step-active');
                checkAllVerifications();
                alert('Face verification successful!');
            } else {
                alert('Face verification failed. Please try again.');
            }
        } else {
            alert('No face data found. Please complete face registration first.');
        }
    } catch (error) {
        console.error('Error during face verification:', error);
        alert('Error during face verification. Please try again.');
    }
}

// Verify biometric for voting
async function verifyBiometricForVote() {
    const biometricStep = document.querySelector('.verification-step:nth-child(2) .step-number');
    
    try {
        // This would integrate with your biometric verification function
        const biometricVerified = await authenticateBiometric();
        
        if (biometricVerified) {
            biometricStep.classList.add('step-active');
            checkAllVerifications();
            alert('Biometric verification successful!');
        } else {
            alert('Biometric verification failed. Please try again.');
        }
    } catch (error) {
        console.error('Error during biometric verification:', error);
        alert('Error during biometric verification. Please try again.');
    }
}

// Check if all verifications are complete
function checkAllVerifications() {
    const activeSteps = document.querySelectorAll('.step-active').length;
    if (activeSteps === 2) { // Both face and biometric verified
        document.getElementById('confirmVote').disabled = false;
    }
}

// Cast the final vote
async function castVote() {
    try {
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
            timestamp: new Date().toISOString()
        });
        
        // Close modal and show success message
        bootstrap.Modal.getInstance(document.getElementById('verificationModal')).hide();
        alert('Your vote has been successfully cast! Thank you for participating.');
        
        // Redirect to home page
        window.location.href = '../index.html';
        
    } catch (error) {
        console.error('Error casting vote:', error);
        alert('Error casting vote. Please try again.');
    }
}

// Initialize admin dashboard
export async function initAdminDashboard() {
    // Check if user is admin
    auth.onAuthStateChanged(async (user) => {
        if (user && await isAdmin(user.uid)) {
            await loadAdminData();
            setupAdminEventListeners();
        } else {
            alert('Access denied. Admin privileges required.');
            window.location.href = '../index.html';
        }
    });
}

// Load admin data
async function loadAdminData() {
    await loadVoterStats();
    await loadCandidatesTable();
    await loadVotersTable();
    await loadResultsChart();
}

// Load voter statistics
async function loadVoterStats() {
    const votersSnapshot = await getDocs(collection(db, "voters"));
    const totalVoters = votersSnapshot.size;
    
    const votedVoters = votersSnapshot.docs.filter(doc => doc.data().hasVoted).length;
    
    document.getElementById('totalVoters').textContent = totalVoters;
    document.getElementById('votesCast').textContent = votedVoters;
    document.getElementById('remainingVoters').textContent = totalVoters - votedVoters;
    
    const candidatesSnapshot = await getDocs(collection(db, "candidates"));
    document.getElementById('totalCandidates').textContent = candidatesSnapshot.size;
}

// Load candidates for admin table
async function loadCandidatesTable() {
    const querySnapshot = await getDocs(collection(db, "candidates"));
    const tableBody = document.getElementById('candidatesTable');
    tableBody.innerHTML = '';
    
    querySnapshot.forEach((doc) => {
        const candidate = doc.data();
        tableBody.innerHTML += `
            <tr>
                <td>
                    <img src="${candidate.photoURL || '../assets/images/default-candidate.jpg'}" 
                         alt="${candidate.name}" width="50" height="50" style="object-fit: cover; border-radius: 50%;">
                </td>
                <td>${candidate.name}</td>
                <td>${candidate.party}</td>
                <td>${candidate.position}</td>
                <td>${candidate.votes || 0}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary">Edit</button>
                    <button class="btn btn-sm btn-outline-danger">Delete</button>
                </td>
            </tr>
        `;
    });
}

// Load voters for admin table
async function loadVotersTable() {
    const querySnapshot = await getDocs(collection(db, "voters"));
    const tableBody = document.getElementById('votersTable');
    tableBody.innerHTML = '';
    
    querySnapshot.forEach((doc) => {
        const voter = doc.data();
        tableBody.innerHTML += `
            <tr>
                <td>${voter.voterId}</td>
                <td>${voter.fullName}</td>
                <td>${voter.email}</td>
                <td>
                    <span class="badge ${voter.hasVoted ? 'bg-success' : 'bg-warning'}">
                        ${voter.hasVoted ? 'Voted' : 'Not Voted'}
                    </span>
                </td>
                <td>${new Date(voter.registrationDate).toLocaleDateString()}</td>
            </tr>
        `;
    });
}

// Load results chart
async function loadResultsChart() {
    const querySnapshot = await getDocs(collection(db, "candidates"));
    const candidates = [];
    const votes = [];
    
    querySnapshot.forEach((doc) => {
        const candidate = doc.data();
        candidates.push(candidate.name);
        votes.push(candidate.votes || 0);
    });
    
    const ctx = document.getElementById('resultsChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: candidates,
            datasets: [{
                label: 'Votes',
                data: votes,
                backgroundColor: [
                    '#3498db', '#e74c3c', '#2ecc71', '#f39c12', 
                    '#9b59b6', '#1abc9c', '#34495e', '#d35400'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Check if user is admin (you'll need to implement this)
async function isAdmin(userId) {
    // This would check if the user has admin privileges
    // For now, return true for demonstration
    return true;
}

// Setup admin event listeners
function setupAdminEventListeners() {
    document.getElementById('saveCandidate').addEventListener('click', addCandidate);
    document.getElementById('adminLogoutBtn').addEventListener('click', () => {
        auth.signOut();
        window.location.href = '../index.html';
    });
}

// Add new candidate
async function addCandidate() {
    const name = document.getElementById('candidateName').value;
    const party = document.getElementById('candidateParty').value;
    const position = document.getElementById('candidatePosition').value;
    const description = document.getElementById('candidateDescription').value;
    const photoFile = document.getElementById('candidatePhoto').files[0];
    
    if (!name || !party || !position) {
        alert('Please fill in all required fields.');
        return;
    }
    
    try {
        let photoURL = '';
        
        // If photo is provided, upload it (you'll need to implement this)
        if (photoFile) {
            // Upload logic would go here
            photoURL = '../assets/images/default-candidate.jpg'; // Placeholder
        }
        
        await setDoc(doc(collection(db, "candidates")), {
            name,
            party,
            position,
            description,
            photoURL,
            votes: 0
        });
        
        alert('Candidate added successfully!');
        bootstrap.Modal.getInstance(document.getElementById('addCandidateModal')).hide();
        document.getElementById('addCandidateForm').reset();
        await loadCandidatesTable();
        await loadResultsChart();
        
    } catch (error) {
        console.error('Error adding candidate:', error);
        alert('Error adding candidate. Please try again.');
    }
}