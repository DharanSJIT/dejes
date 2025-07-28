// Study Group Matching System
class MatchingManager {
    constructor() {
        this.userPreferences = null;
        this.potentialMatches = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadUserPreferences();
        this.findMatches();
    }

    setupEventListeners() {
        // Update preferences button
        const updatePreferencesBtn = document.getElementById('update-preferences-btn');
        if (updatePreferencesBtn) {
            updatePreferencesBtn.addEventListener('click', () => this.showPreferencesModal());
        }

        // Preferences form
        const preferencesForm = document.getElementById('preferences-form');
        if (preferencesForm) {
            preferencesForm.addEventListener('submit', (e) => this.handleUpdatePreferences(e));
        }
    }

    async loadUserPreferences() {
        try {
            const user = window.authManager.getCurrentUser();
            if (!user) return;

            const userProfile = await window.authManager.getUserProfile();
            if (userProfile && userProfile.preferences) {
                this.userPreferences = userProfile.preferences;
                this.displayUserPreferences();
            } else {
                this.showEmptyPreferences();
            }
        } catch (error) {
            console.error('Error loading user preferences:', error);
        }
    }

    displayUserPreferences() {
        const preferencesContainer = document.getElementById('user-preferences');
        if (!preferencesContainer || !this.userPreferences) return;

        const { subjects, studyTimes, studyStyle } = this.userPreferences;

        preferencesContainer.innerHTML = `
            <div class="preference-item">
                <div class="preference-label">Subjects</div>
                <div class="preference-value">
                    ${Array.isArray(subjects) && subjects.length > 0 
                        ? subjects.map(s => this.formatSubject(s)).join(', ')
                        : 'Not specified'
                    }
                </div>
            </div>
            <div class="preference-item">
                <div class="preference-label">Study Times</div>
                <div class="preference-value">
                    ${Array.isArray(studyTimes) && studyTimes.length > 0 
                        ? studyTimes.map(t => this.formatStudyTime(t)).join(', ')
                        : 'Not specified'
                    }
                </div>
            </div>
            <div class="preference-item">
                <div class="preference-label">Study Style</div>
                <div class="preference-value">${this.formatStudyStyle(studyStyle || 'collaborative')}</div>
            </div>
        `;
    }

    showEmptyPreferences() {
        const preferencesContainer = document.getElementById('user-preferences');
        if (!preferencesContainer) return;

        preferencesContainer.innerHTML = `
            <div class="empty-state">
                <p>No preferences set. Update your preferences to find better study matches!</p>
            </div>
        `;
    }

    showPreferencesModal() {
        const modal = document.getElementById('preferences-modal');
        if (!modal) return;

        // Populate form with current preferences
        this.populatePreferencesForm();
        modal.classList.add('show');
    }

    populatePreferencesForm() {
        if (!this.userPreferences) return;

        const { subjects, studyTimes, studyStyle } = this.userPreferences;

        // Populate subjects checkboxes
        const subjectCheckboxes = document.querySelectorAll('#preferences-form input[type="checkbox"]');
        subjectCheckboxes.forEach(checkbox => {
            if (subjects && subjects.includes(checkbox.value)) {
                checkbox.checked = true;
            }
        });

        // Populate study times checkboxes
        const timeCheckboxes = document.querySelectorAll('#preferences-form input[type="checkbox"]');
        timeCheckboxes.forEach(checkbox => {
            if (studyTimes && studyTimes.includes(checkbox.value)) {
                checkbox.checked = true;
            }
        });

        // Populate study style
        const studyStyleSelect = document.getElementById('study-style');
        if (studyStyleSelect && studyStyle) {
            studyStyleSelect.value = studyStyle;
        }
    }

    async handleUpdatePreferences(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        
        // Get selected subjects
        const subjects = [];
        const subjectCheckboxes = e.target.querySelectorAll('input[type="checkbox"][value^="mathematics"], input[type="checkbox"][value^="science"], input[type="checkbox"][value^="english"], input[type="checkbox"][value^="history"], input[type="checkbox"][value^="computer-science"], input[type="checkbox"][value^="other"]');
        subjectCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                subjects.push(checkbox.value);
            }
        });

        // Get selected study times
        const studyTimes = [];
        const timeCheckboxes = e.target.querySelectorAll('input[type="checkbox"][value^="morning"], input[type="checkbox"][value^="afternoon"], input[type="checkbox"][value^="evening"], input[type="checkbox"][value^="late-night"]');
        timeCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                studyTimes.push(checkbox.value);
            }
        });

        const studyStyle = document.getElementById('study-style').value;

        const preferences = {
            subjects,
            studyTimes,
            studyStyle
        };

        try {
            const success = await window.authManager.updateUserPreferences(preferences);
            if (success) {
                this.userPreferences = preferences;
                this.displayUserPreferences();
                this.closeModal('preferences-modal');
                
                // Refresh matches
                await this.findMatches();
            }
        } catch (error) {
            console.error('Error updating preferences:', error);
        }
    }

    async findMatches() {
        try {
            const user = window.authManager.getCurrentUser();
            if (!user || !this.userPreferences) {
                this.showEmptyMatches();
                return;
            }

            // Get all users except current user
            const usersSnapshot = await window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.users)
                .where('uid', '!=', user.uid)
                .get();

            const potentialMatches = [];

            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                if (userData.preferences) {
                    const compatibility = this.calculateCompatibility(this.userPreferences, userData.preferences);
                    if (compatibility > 0) {
                        potentialMatches.push({
                            ...userData,
                            compatibility
                        });
                    }
                }
            });

            // Sort by compatibility score
            potentialMatches.sort((a, b) => b.compatibility - a.compatibility);
            
            // Take top 10 matches
            this.potentialMatches = potentialMatches.slice(0, 10);
            
            this.displayMatches();

        } catch (error) {
            console.error('Error finding matches:', error);
            this.showEmptyMatches();
        }
    }

    calculateCompatibility(userPrefs, otherPrefs) {
        let score = 0;
        let maxScore = 0;

        // Subject compatibility (40% weight)
        const subjectWeight = 40;
        const commonSubjects = this.getCommonItems(userPrefs.subjects || [], otherPrefs.subjects || []);
        const subjectScore = commonSubjects.length > 0 ? (commonSubjects.length / Math.max(userPrefs.subjects?.length || 1, otherPrefs.subjects?.length || 1)) * subjectWeight : 0;
        score += subjectScore;
        maxScore += subjectWeight;

        // Study time compatibility (30% weight)
        const timeWeight = 30;
        const commonTimes = this.getCommonItems(userPrefs.studyTimes || [], otherPrefs.studyTimes || []);
        const timeScore = commonTimes.length > 0 ? (commonTimes.length / Math.max(userPrefs.studyTimes?.length || 1, otherPrefs.studyTimes?.length || 1)) * timeWeight : 0;
        score += timeScore;
        maxScore += timeWeight;

        // Study style compatibility (30% weight)
        const styleWeight = 30;
        const styleScore = userPrefs.studyStyle === otherPrefs.studyStyle ? styleWeight : 0;
        score += styleScore;
        maxScore += styleWeight;

        return Math.round((score / maxScore) * 100);
    }

    getCommonItems(array1, array2) {
        return array1.filter(item => array2.includes(item));
    }

    displayMatches() {
        const matchesGrid = document.getElementById('matches-grid');
        if (!matchesGrid) return;

        if (this.potentialMatches.length === 0) {
            this.showEmptyMatches();
            return;
        }

        matchesGrid.innerHTML = this.potentialMatches.map(match => {
            return this.createMatchCardHTML(match);
        }).join('');

        // Add event listeners to connect buttons
        matchesGrid.querySelectorAll('.connect-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.getAttribute('data-user-id');
                this.connectWithUser(userId);
            });
        });
    }

    createMatchCardHTML(match) {
        return `
            <div class="match-card">
                <img src="${match.photoURL || 'https://via.placeholder.com/60x60?text=User'}" 
                     alt="${this.escapeHtml(match.displayName)}" 
                     class="match-avatar">
                <h4 class="match-name">${this.escapeHtml(match.displayName)}</h4>
                <p class="match-subjects">
                    ${match.preferences.subjects?.map(s => this.formatSubject(s)).join(', ') || 'No subjects listed'}
                </p>
                <span class="match-compatibility">${match.compatibility}% Match</span>
                <button class="connect-btn" data-user-id="${match.uid}">
                    Connect
                </button>
            </div>
        `;
    }

    showEmptyMatches() {
        const matchesGrid = document.getElementById('matches-grid');
        if (!matchesGrid) return;

        matchesGrid.innerHTML = `
            <div class="empty-state">
                <h3>No matches found</h3>
                <p>Update your preferences to find study buddies with similar interests!</p>
            </div>
        `;
    }

    async connectWithUser(userId) {
        try {
            const user = window.authManager.getCurrentUser();
            if (!user) {
                window.firebaseConfig.showNotification('Please sign in to connect with other users.', 'error');
                return;
            }

            // Get the other user's data
            const otherUserDoc = await window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.users)
                .doc(userId)
                .get();

            if (!otherUserDoc.exists) {
                window.firebaseConfig.showNotification('User not found.', 'error');
                return;
            }

            const otherUser = otherUserDoc.data();
            
            // For now, just show a notification
            // In a full implementation, you might create a connection request or start a chat
            window.firebaseConfig.showNotification(`Connection request sent to ${otherUser.displayName}!`, 'success');
            
        } catch (error) {
            console.error('Error connecting with user:', error);
            window.firebaseConfig.showNotification('Failed to send connection request.', 'error');
        }
    }

    formatSubject(subject) {
        return subject.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    formatStudyTime(time) {
        const timeMap = {
            'morning': 'Morning (6AM-12PM)',
            'afternoon': 'Afternoon (12PM-6PM)',
            'evening': 'Evening (6PM-10PM)',
            'late-night': 'Late Night (10PM-2AM)'
        };
        return timeMap[time] || time;
    }

    formatStudyStyle(style) {
        return style.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize matching manager
document.addEventListener('DOMContentLoaded', () => {
    window.matchingManager = new MatchingManager();
});
