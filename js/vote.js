// js/vote.js - FIXED VERSION
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
import { getVoterData, updateVoteStatus, isAdmin } from './auth.js';
import { uploadCandidateImage, getPlaceholderImage } from './image-upload.js';

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
                if (voterData.data.hasVoted) {
                    alert('You have already voted in this election.');
                    window.location.href = '../index.html';
                    return;
                }
                
                document.getElementById('voterName').textContent = `Welcome, ${voterData.data.fullName}`;
                await loadCandidates();
            }
        } else {
            window.location.href = 'login.html';
        }
    });
    
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
        
        document.querySelectorAll('.vote-candidate').forEach(button => {
            button.addEventListener('click', (e) => {
                selectedCandidate = e.target.getAttribute('data-candidate-id');
                showVerificationModal();
            });
        });
        
    } catch (error) {
        console.error('Error loading candidates:', error);
        document.getElementById('candidatesList').innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-danger">
                    <h5>Error loading candidates</h5>
                    <p>Please try refreshing the page.</p>
                </div>
            </div>
        `;
    }
}

// Show verification modal
function showVerificationModal() {
    const modal = new bootstrap.Modal(document.getElementById('verificationModal'));
    modal.show();
    
    document.querySelectorAll('.step-number').forEach(step => {
        step.classList.remove('step-active');
    });
    document.getElementById('confirmVote').disabled = true;
    
    document.getElementById('verifyFaceVote').onclick = verifyFaceForVote;
    document.getElementById('verifyBiometricVote').onclick = verifyBiometricForVote;
    document.getElementById('confirmVote').onclick = castVote;
}

// Verify face for voting
async function verifyFaceForVote() {
    const faceStep = document.querySelector('.verification-step:nth-child(1) .step-number');
    
    try {
        alert('Face verification would happen here. For demo, simulating success.');
        faceStep.classList.add('step-active');
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
        alert('Biometric verification would happen here. For demo, simulating success.');
        biometricStep.classList.add('step-active');
        checkAllVerifications();
    } catch (error) {
        console.error('Error during biometric verification:', error);
        alert('Error during biometric verification. Please try again.');
    }
}

// Check if all verifications are complete
function checkAllVerifications() {
    const activeSteps = document.querySelectorAll('.step-active').length;
    if (activeSteps === 2) {
        document.getElementById('confirmVote').disabled = false;
    }
}

// Cast the final vote
async function castVote() {
    try {
        const candidateRef = doc(db, "candidates", selectedCandidate);
        await updateDoc(candidateRef, {
            votes: increment(1)
        });
        
        await updateVoteStatus(currentUser.uid);
        
        await setDoc(doc(db, "votes", `${currentUser.uid}_${Date.now()}`), {
            voterId: currentUser.uid,
            candidateId: selectedCandidate,
            timestamp: new Date().toISOString()
        });
        
        bootstrap.Modal.getInstance(document.getElementById('verificationModal')).hide();
        alert('Your vote has been successfully cast! Thank you for participating.');
        window.location.href = '../index.html';
        
    } catch (error) {
        console.error('Error casting vote:', error);
        alert('Error casting vote. Please try again.');
    }
}

// Initialize admin dashboard
export async function initAdminDashboard() {
    // Show loading
    document.getElementById('authCheck').style.display = 'block';
    
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // For demo, we'll allow any authenticated user to access admin
            // In production, you should check if user is actually admin
            document.getElementById('authCheck').style.display = 'none';
            document.getElementById('adminContent').style.display = 'block';
            await loadAdminData();
            setupAdminEventListeners();
        } else {
            alert('Please login to access admin panel.');
            window.location.href = 'login.html';
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
    try {
        const votersSnapshot = await getDocs(collection(db, "voters"));
        const totalVoters = votersSnapshot.size;
        
        const votedVoters = votersSnapshot.docs.filter(doc => doc.data().hasVoted).length;
        
        document.getElementById('totalVoters').textContent = totalVoters;
        document.getElementById('votesCast').textContent = votedVoters;
        document.getElementById('remainingVoters').textContent = totalVoters - votedVoters;
        
        const candidatesSnapshot = await getDocs(collection(db, "candidates"));
        document.getElementById('totalCandidates').textContent = candidatesSnapshot.size;
    } catch (error) {
        console.error('Error loading voter stats:', error);
    }
}

// Load candidates for admin table
async function loadCandidatesTable() {
    try {
        const querySnapshot = await getDocs(collection(db, "candidates"));
        const tableBody = document.getElementById('candidatesTable');
        tableBody.innerHTML = '';
        
        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No candidates found</td></tr>';
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const candidate = doc.data();
            const photoURL = candidate.photoURL || getPlaceholderImage(candidate.name);
            
            tableBody.innerHTML += `
                <tr>
                    <td>
                        <img src="${photoURL}" 
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
    } catch (error) {
        console.error('Error loading candidates table:', error);
    }
}

// Load voters for admin table
async function loadVotersTable() {
    try {
        const querySnapshot = await getDocs(collection(db, "voters"));
        const tableBody = document.getElementById('votersTable');
        tableBody.innerHTML = '';
        
        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No voters found</td></tr>';
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const voter = doc.data();
            tableBody.innerHTML += `
                <tr>
                    <td>${voter.voterId || 'N/A'}</td>
                    <td>${voter.fullName}</td>
                    <td>${voter.email}</td>
                    <td>
                        <span class="badge ${voter.hasVoted ? 'bg-success' : 'bg-warning'}">
                            ${voter.hasVoted ? 'Voted' : 'Not Voted'}
                        </span>
                    </td>
                    <td>${voter.registrationDate ? new Date(voter.registrationDate).toLocaleDateString() : 'N/A'}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error loading voters table:', error);
    }
}

// Load results chart
async function loadResultsChart() {
    try {
        const querySnapshot = await getDocs(collection(db, "candidates"));
        const candidates = [];
        const votes = [];
        
        querySnapshot.forEach((doc) => {
            const candidate = doc.data();
            candidates.push(candidate.name);
            votes.push(candidate.votes || 0);
        });
        
        const ctx = document.getElementById('resultsChart');
        if (ctx) {
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
    } catch (error) {
        console.error('Error loading chart:', error);
    }
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
        let photoURL = getPlaceholderImage(name);
        
        // If photo is provided, try to upload it
        if (photoFile) {
            photoURL = await uploadCandidateImage(photoFile);
        }
        
        await addDoc(collection(db, "candidates"), {
            name,
            party,
            position,
            description,
            photoURL,
            votes: 0,
            createdAt: new Date().toISOString()
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