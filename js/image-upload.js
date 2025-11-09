// js/image-upload.js
export async function uploadCandidateImage(file) {
    const apiKey = '4fd2a80371a7e9e7203e0e0454cb61ff'; // We'll get this free
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        if (data.success) {
            return data.data.url;
        } else {
            throw new Error('Image upload failed');
        }
    } catch (error) {
        console.error('Image upload error:', error);
        // Return a placeholder image if upload fails
        return 'https://via.placeholder.com/300x200/3498db/ffffff?text=Candidate+Photo';
    }
}

// Free placeholder function (no API key needed)
export function getPlaceholderImage(name) {
    const colors = ['3498db', 'e74c3c', '2ecc71', 'f39c12', '9b59b6'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    return `https://via.placeholder.com/300x200/${color}/ffffff?text=${encodeURIComponent(name)}`;
}