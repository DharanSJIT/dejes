// Authentication Management
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.authStateChanged = this.authStateChanged.bind(this);
        this.init();
    }

    init() {
        // Listen for authentication state changes
        if (window.firebaseConfig && window.firebaseConfig.auth) {
            window.firebaseConfig.auth.onAuthStateChanged(this.authStateChanged);
        }

        // Setup login button
        const loginBtn = document.getElementById('google-login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', this.signInWithGoogle.bind(this));
        }

        // Setup logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.signOut.bind(this));
        }
    }

    async authStateChanged(user) {
        if (user) {
            // User is signed in
            this.currentUser = user;
            await this.handleUserSignIn(user);
        } else {
            // User is signed out
            this.currentUser = null;
            this.handleUserSignOut();
        }
    }

    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');
            
            const result = await window.firebaseConfig.auth.signInWithPopup(provider);
            console.log('Sign in successful:', result.user);
        } catch (error) {
            console.error('Error signing in with Google:', error);
            
            // Handle specific error cases
            if (error.code === 'auth/popup-closed-by-user') {
                window.firebaseConfig.showNotification('Sign in was cancelled.', 'info');
            } else if (error.code === 'auth/popup-blocked') {
                window.firebaseConfig.showNotification('Popup was blocked. Please allow popups for this site.', 'error');
            } else {
                window.firebaseConfig.showNotification('Failed to sign in. Please try again.', 'error');
            }
        }
    }

    async signOut() {
        try {
            await window.firebaseConfig.auth.signOut();
            console.log('Sign out successful');
        } catch (error) {
            console.error('Error signing out:', error);
            window.firebaseConfig.showNotification('Failed to sign out. Please try again.', 'error');
        }
    }

    async handleUserSignIn(user) {
        try {
            // Update user profile in Firestore
            await this.updateUserProfile(user);
            
            // Update UI with user information
            this.updateUserUI(user);
            
            // Show main application
            this.showMainApp();
            
            // Initialize dashboard
            if (window.dashboardManager) {
                window.dashboardManager.loadDashboard();
            }
            
            window.firebaseConfig.showNotification(`Welcome, ${user.displayName}!`, 'success');
        } catch (error) {
            console.error('Error handling user sign in:', error);
            window.firebaseConfig.showNotification('Error setting up your profile. Please try again.', 'error');
        }
    }

    handleUserSignOut() {
        // Show login screen
        this.showLoginScreen();
        
        // Clear any cached data
        this.clearUserData();
    }

    async updateUserProfile(user) {
        const userRef = window.firebaseConfig.db.collection(window.firebaseConfig.collections.users).doc(user.uid);
        
        const userData = {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            lastActive: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Check if user document exists
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            // New user - set default preferences
            userData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            userData.preferences = {
                subjects: [],
                studyTimes: [],
                studyStyle: 'collaborative'
            };
            userData.isTutor = false;
            userData.tutorProfile = null;
        }

        await userRef.set(userData, { merge: true });
        console.log('User profile updated successfully');
    }

    updateUserUI(user) {
        // Update avatar
        const avatarElements = document.querySelectorAll('#user-avatar, .user-avatar');
        avatarElements.forEach(avatar => {
            avatar.src = user.photoURL || 'https://via.placeholder.com/40x40?text=User';
            avatar.alt = user.displayName || 'User';
        });

        // Update name
        const nameElements = document.querySelectorAll('#user-name, #dashboard-user-name');
        nameElements.forEach(nameEl => {
            nameEl.textContent = user.displayName || 'User';
        });
    }

    showMainApp() {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
    }

    showLoginScreen() {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'none';
        document.getElementById('login-screen').style.display = 'block';
    }

    clearUserData() {
        // Clear any cached user data or reset application state
        console.log('Clearing user data...');
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    async getUserProfile(uid = null) {
        try {
            const userId = uid || this.currentUser?.uid;
            if (!userId) return null;

            const userDoc = await window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.users)
                .doc(userId)
                .get();

            return userDoc.exists ? userDoc.data() : null;
        } catch (error) {
            console.error('Error getting user profile:', error);
            return null;
        }
    }

    async updateUserPreferences(preferences) {
        try {
            if (!this.currentUser) {
                throw new Error('User not authenticated');
            }

            await window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.users)
                .doc(this.currentUser.uid)
                .update({
                    preferences: preferences,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

            window.firebaseConfig.showNotification('Preferences updated successfully!', 'success');
            return true;
        } catch (error) {
            console.error('Error updating user preferences:', error);
            window.firebaseConfig.showNotification('Failed to update preferences.', 'error');
            return false;
        }
    }
}

// Initialize authentication manager
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to be ready
    const initAuth = () => {
        if (window.firebaseConfig && window.firebaseConfig.auth) {
            window.authManager = new AuthManager();
        } else {
            // Retry after a short delay
            setTimeout(initAuth, 100);
        }
    };
    
    initAuth();
});
