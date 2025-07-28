// Firebase Configuration
// Get configuration from environment variables injected by server
const getEnvVar = (name) => {
    // Try to get from window object (will be set by server)
    return window[name] || "";
};

// const firebaseConfig = {
//     apiKey: "AIzaSyCK24mOBx3hpjSD8KD5Qk8nvUkhZVksMgM",
//     authDomain: "education-5c6dc.firebaseapp.com",
//     projectId: "education-5c6dc",
//     storageBucket: "education-5c6dc.firebasestorage.app",
//     messagingSenderId: "805733379650",
//     appId: "1:805733379650:web:7ea94e29a6b13ccb3bc7db",
//     measurementId: "G-CKBFXLVBJN",
//     databaseURL: "https://education-5c6dc-default-rtdb.firebaseio.com/"
// };

const firebaseConfig = {
  apiKey: "AIzaSyDVANOKviR4hZFjSti3r3zk1p0hXbqbewk",
  authDomain: "campus-connect-559a3.firebaseapp.com",
  projectId: "campus-connect-559a3",
  storageBucket: "campus-connect-559a3.firebasestorage.app",
  messagingSenderId: "63602342770",
  appId: "1:63602342770:web:d8a05827fc407e81407beb",
  measurementId: "G-S35RQ9S5J4"
};

// Initialize Firebase
let app;
let auth;
let db;
let rtdb;

try {
    // Initialize Firebase App
    app = firebase.initializeApp(firebaseConfig);
    
    // Initialize Firebase services
    auth = firebase.auth();
    db = firebase.firestore();
    rtdb = firebase.database();
    
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Error initializing Firebase:', error);
    // Show user-friendly error message
    showNotification('Failed to initialize Firebase. Please check your configuration.', 'error');
}

// Firestore collections references
const collections = {
    users: 'users',
    studyRooms: 'study-rooms',
    clubs: 'clubs',
    events: 'events',
    tutors: 'tutors',
    sessions: 'tutoring-sessions',
    messages: 'messages'
};

// Real-time database references
const rtdbRefs = {
    activeRooms: 'active-rooms',
    roomParticipants: 'room-participants',
    messages: 'messages'
};

// Utility function to show notifications
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#fed7d7' : type === 'success' ? '#c6f6d5' : '#bee3f8'};
        color: ${type === 'error' ? '#c53030' : type === 'success' ? '#276749' : '#2b6cb0'};
        padding: 12px 16px;
        border-radius: 6px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        max-width: 300px;
        word-wrap: break-word;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Export for use in other files
window.firebaseConfig = {
    app,
    auth,
    db,
    rtdb,
    collections,
    rtdbRefs,
    showNotification
};
