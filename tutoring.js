// Peer Tutoring Management
class TutoringManager {
    constructor() {
        this.availableTutors = [];
        this.userSessions = [];
        this.userTutorProfile = null;
        this.tutorsListener = null;
        this.sessionsListener = null;
        this.currentTab = 'find-tutors';
        this.selectedTutor = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupTabNavigation();
        this.setupFilters();
        this.checkTutorStatus();
    }

    setupEventListeners() {
        // Become tutor button
        const becomeTutorBtn = document.getElementById('become-tutor-btn');
        if (becomeTutorBtn) {
            becomeTutorBtn.addEventListener('click', () => this.showBecomeTutorModal());
        }

        // Forms
        const becomeTutorForm = document.getElementById('become-tutor-form');
        if (becomeTutorForm) {
            becomeTutorForm.addEventListener('submit', (e) => this.handleBecomeTutor(e));
        }

        const bookSessionForm = document.getElementById('book-session-form');
        if (bookSessionForm) {
            bookSessionForm.addEventListener('submit', (e) => this.handleBookSession(e));
        }
    }

    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tutoring-tabs .tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    }

    setupFilters() {
        const subjectFilter = document.getElementById('subject-filter');
        const ratingFilter = document.getElementById('rating-filter');

        if (subjectFilter) {
            subjectFilter.addEventListener('change', () => this.filterTutors());
        }

        if (ratingFilter) {
            ratingFilter.addEventListener('change', () => this.filterTutors());
        }
    }

    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tutoring-tabs .tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Update active tab content
        document.querySelectorAll('.tutoring-content .tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const activeContent = document.getElementById(`${tabName}-tab`);
        if (activeContent) {
            activeContent.classList.add('active');
        }

        this.currentTab = tabName;
        this.loadTabContent(tabName);
    }

    loadTabContent(tabName) {
        switch (tabName) {
            case 'find-tutors':
                this.loadTutors();
                break;
            case 'my-sessions':
                this.loadUserSessions();
                break;
            case 'tutor-profile':
                this.loadTutorProfile();
                break;
        }
    }

    async checkTutorStatus() {
        try {
            const user = window.authManager.getCurrentUser();
            if (!user) return;

            const userProfile = await window.authManager.getUserProfile();
            if (userProfile && userProfile.isTutor) {
                this.userTutorProfile = userProfile.tutorProfile;
                this.updateBecomeTutorButton();
            }
        } catch (error) {
            console.error('Error checking tutor status:', error);
        }
    }

    updateBecomeTutorButton() {
        const btn = document.getElementById('become-tutor-btn');
        if (btn && this.userTutorProfile) {
            btn.innerHTML = '<i data-feather="edit"></i> Edit Tutor Profile';
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        }
    }

    async loadTutors() {
        try {
            if (!window.firebaseConfig.db) return;

            // Get all tutors
            const tutorsQuery = window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.users)
                .where('isTutor', '==', true)
                .orderBy('tutorProfile.rating', 'desc');

            this.tutorsListener = tutorsQuery.onSnapshot((snapshot) => {
                this.availableTutors = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(tutor => tutor.tutorProfile && tutor.tutorProfile.isActive !== false);
                
                this.filterTutors();
            }, (error) => {
                console.error('Error loading tutors:', error);
                this.showEmptyTutors();
            });

        } catch (error) {
            console.error('Error setting up tutors listener:', error);
            this.showEmptyTutors();
        }
    }

    filterTutors() {
        const subjectFilter = document.getElementById('subject-filter')?.value;
        const ratingFilter = document.getElementById('rating-filter')?.value;

        let filteredTutors = [...this.availableTutors];

        // Filter by subject
        if (subjectFilter) {
            filteredTutors = filteredTutors.filter(tutor =>
                tutor.tutorProfile.subjects?.includes(subjectFilter)
            );
        }

        // Filter by rating
        if (ratingFilter) {
            const minRating = parseFloat(ratingFilter);
            filteredTutors = filteredTutors.filter(tutor =>
                (tutor.tutorProfile.rating || 0) >= minRating
            );
        }

        this.renderTutors(filteredTutors);
    }

    renderTutors(tutors) {
        const container = document.getElementById('tutors-grid');
        if (!container) return;

        if (tutors.length === 0) {
            this.showEmptyTutors();
            return;
        }

        container.innerHTML = tutors.map(tutor => 
            this.createTutorCardHTML(tutor)
        ).join('');

        // Add event listeners
        container.querySelectorAll('.book-session-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tutorId = e.target.getAttribute('data-tutor-id');
                this.showBookSessionModal(tutorId);
            });
        });
    }

    createTutorCardHTML(tutor) {
        const profile = tutor.tutorProfile;
        const rating = profile.rating || 0;
        const reviewCount = profile.reviewCount || 0;
        const subjects = profile.subjects || [];
        
        return `
            <div class="tutor-card">
                <img src="${tutor.photoURL || 'https://via.placeholder.com/80x80?text=Tutor'}" 
                     alt="${this.escapeHtml(tutor.displayName)}" 
                     class="tutor-avatar">
                <h4 class="tutor-name">${this.escapeHtml(tutor.displayName)}</h4>
                <p class="tutor-subjects">${subjects.map(s => this.formatSubject(s)).join(', ')}</p>
                <div class="tutor-rating">
                    <span class="stars">${this.generateStars(rating)}</span>
                    <span>${rating.toFixed(1)} (${reviewCount} reviews)</span>
                </div>
                <div class="tutor-rate">$${profile.hourlyRate || 0}/hour</div>
                <button class="book-session-btn" data-tutor-id="${tutor.id}">
                    Book Session
                </button>
            </div>
        `;
    }

    async loadUserSessions() {
        try {
            const user = window.authManager.getCurrentUser();
            if (!user) {
                this.showEmptySessions();
                return;
            }

            if (!window.firebaseConfig.db) return;

            // Get user's tutoring sessions
            const sessionsQuery = window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.sessions)
                .where('studentId', '==', user.uid)
                .orderBy('date', 'desc');

            this.sessionsListener = sessionsQuery.onSnapshot((snapshot) => {
                this.userSessions = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.renderSessions();
            }, (error) => {
                console.error('Error loading sessions:', error);
                this.showEmptySessions();
            });

        } catch (error) {
            console.error('Error setting up sessions listener:', error);
            this.showEmptySessions();
        }
    }

    renderSessions() {
        const container = document.getElementById('sessions-list');
        if (!container) return;

        if (this.userSessions.length === 0) {
            this.showEmptySessions();
            return;
        }

        container.innerHTML = this.userSessions.map(session => 
            this.createSessionCardHTML(session)
        ).join('');
    }

    createSessionCardHTML(session) {
        const sessionDate = session.date.toDate ? session.date.toDate() : new Date(session.date);
        const now = new Date();
        const isPast = sessionDate < now;
        const status = session.status || (isPast ? 'completed' : 'upcoming');
        
        return `
            <div class="session-card">
                <div class="session-info">
                    <h4>Session with ${this.escapeHtml(session.tutorName)}</h4>
                    <div class="session-details">
                        <p><strong>Subject:</strong> ${this.formatSubject(session.subject)}</p>
                        <p><strong>Date:</strong> ${this.formatSessionDate(sessionDate)}</p>
                        <p><strong>Duration:</strong> ${session.duration} minutes</p>
                        ${session.notes ? `<p><strong>Notes:</strong> ${this.escapeHtml(session.notes)}</p>` : ''}
                    </div>
                </div>
                <div class="session-actions">
                    <span class="session-status ${status}">${this.formatStatus(status)}</span>
                </div>
            </div>
        `;
    }

    async loadTutorProfile() {
        const container = document.getElementById('tutor-profile-content');
        if (!container) return;

        if (!this.userTutorProfile) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Not a tutor yet</h3>
                    <p>Register as a tutor to start helping other students and earning money!</p>
                    <button class="primary-btn" onclick="window.tutoringManager.showBecomeTutorModal()">
                        Become a Tutor
                    </button>
                </div>
            `;
            return;
        }

        // Load tutor sessions and stats
        const user = window.authManager.getCurrentUser();
        if (!user) return;

        try {
            const tutorSessions = await window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.sessions)
                .where('tutorId', '==', user.uid)
                .orderBy('date', 'desc')
                .limit(10)
                .get();

            const sessions = tutorSessions.docs.map(doc => doc.data());
            const completedSessions = sessions.filter(s => s.status === 'completed').length;
            const totalEarnings = sessions
                .filter(s => s.status === 'completed')
                .reduce((sum, s) => sum + (s.totalCost || 0), 0);

            container.innerHTML = this.createTutorProfileHTML(completedSessions, totalEarnings, sessions);
            
        } catch (error) {
            console.error('Error loading tutor profile:', error);
            container.innerHTML = '<div class="empty-state">Error loading tutor profile.</div>';
        }
    }

    createTutorProfileHTML(completedSessions, totalEarnings, recentSessions) {
        const profile = this.userTutorProfile;
        
        return `
            <div class="tutor-profile-header">
                <h3>Your Tutor Profile</h3>
                <button class="secondary-btn" onclick="window.tutoringManager.showBecomeTutorModal()">
                    Edit Profile
                </button>
            </div>
            
            <div class="tutor-stats">
                <div class="stat-card">
                    <h4>Completed Sessions</h4>
                    <div class="stat-value">${completedSessions}</div>
                </div>
                <div class="stat-card">
                    <h4>Total Earnings</h4>
                    <div class="stat-value">$${totalEarnings.toFixed(2)}</div>
                </div>
                <div class="stat-card">
                    <h4>Rating</h4>
                    <div class="stat-value">${(profile.rating || 0).toFixed(1)}/5</div>
                </div>
                <div class="stat-card">
                    <h4>Hourly Rate</h4>
                    <div class="stat-value">$${profile.hourlyRate || 0}</div>
                </div>
            </div>

            <div class="tutor-profile-details">
                <h4>Subjects</h4>
                <p>${profile.subjects?.map(s => this.formatSubject(s)).join(', ') || 'None specified'}</p>
                
                <h4>Bio</h4>
                <p>${this.escapeHtml(profile.bio || 'No bio provided')}</p>
                
                <h4>Available Times</h4>
                <p>${profile.availableTimes?.map(t => this.formatAvailableTime(t)).join(', ') || 'Not specified'}</p>
            </div>

            <div class="recent-sessions">
                <h4>Recent Sessions</h4>
                ${recentSessions.length > 0 ? 
                    recentSessions.map(session => this.createSessionCardHTML(session)).join('') :
                    '<p>No sessions yet</p>'
                }
            </div>
        `;
    }

    showBecomeTutorModal() {
        const modal = document.getElementById('become-tutor-modal');
        if (!modal) return;

        // Populate form if editing existing profile
        if (this.userTutorProfile) {
            this.populateTutorForm();
        }

        modal.classList.add('show');
    }

    populateTutorForm() {
        const profile = this.userTutorProfile;
        
        // Populate subjects
        const subjectCheckboxes = document.querySelectorAll('#become-tutor-form input[type="checkbox"]');
        subjectCheckboxes.forEach(checkbox => {
            if (profile.subjects?.includes(checkbox.value)) {
                checkbox.checked = true;
            }
        });

        // Populate bio
        const bioField = document.getElementById('tutor-bio');
        if (bioField && profile.bio) {
            bioField.value = profile.bio;
        }

        // Populate hourly rate
        const rateField = document.getElementById('hourly-rate');
        if (rateField && profile.hourlyRate) {
            rateField.value = profile.hourlyRate;
        }

        // Populate available times
        const timeCheckboxes = document.querySelectorAll('#become-tutor-form input[type="checkbox"]');
        timeCheckboxes.forEach(checkbox => {
            if (profile.availableTimes?.includes(checkbox.value)) {
                checkbox.checked = true;
            }
        });
    }

    async handleBecomeTutor(e) {
        e.preventDefault();

        const user = window.authManager.getCurrentUser();
        if (!user) {
            window.firebaseConfig.showNotification('Please sign in to become a tutor.', 'error');
            return;
        }

        // Get selected subjects
        const subjects = [];
        const subjectCheckboxes = e.target.querySelectorAll('input[type="checkbox"][value="mathematics"], input[type="checkbox"][value="science"], input[type="checkbox"][value="english"], input[type="checkbox"][value="history"], input[type="checkbox"][value="computer-science"]');
        subjectCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                subjects.push(checkbox.value);
            }
        });

        // Get available times
        const availableTimes = [];
        const timeCheckboxes = e.target.querySelectorAll('input[type="checkbox"][value="morning"], input[type="checkbox"][value="afternoon"], input[type="checkbox"][value="evening"]');
        timeCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                availableTimes.push(checkbox.value);
            }
        });

        const bio = document.getElementById('tutor-bio').value;
        const hourlyRate = parseFloat(document.getElementById('hourly-rate').value) || 0;

        const tutorProfile = {
            subjects,
            bio,
            hourlyRate,
            availableTimes,
            rating: this.userTutorProfile?.rating || 0,
            reviewCount: this.userTutorProfile?.reviewCount || 0,
            isActive: true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            // Update user profile
            await window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.users)
                .doc(user.uid)
                .update({
                    isTutor: true,
                    tutorProfile: tutorProfile
                });

            this.userTutorProfile = tutorProfile;
            this.updateBecomeTutorButton();
            this.closeModal('become-tutor-modal');
            e.target.reset();
            
            window.firebaseConfig.showNotification('Tutor profile updated successfully!', 'success');
            
        } catch (error) {
            console.error('Error updating tutor profile:', error);
            window.firebaseConfig.showNotification('Failed to update tutor profile.', 'error');
        }
    }

    async showBookSessionModal(tutorId) {
        const tutor = this.availableTutors.find(t => t.id === tutorId);
        if (!tutor) return;

        this.selectedTutor = tutor;
        
        // Populate tutor info
        const tutorInfoContainer = document.getElementById('selected-tutor-info');
        if (tutorInfoContainer) {
            tutorInfoContainer.innerHTML = `
                <img src="${tutor.photoURL || 'https://via.placeholder.com/50x50?text=Tutor'}" 
                     alt="${this.escapeHtml(tutor.displayName)}">
                <div class="tutor-info-details">
                    <h4>${this.escapeHtml(tutor.displayName)}</h4>
                    <p>$${tutor.tutorProfile.hourlyRate}/hour</p>
                </div>
            `;
        }

        // Populate subjects dropdown
        const subjectSelect = document.getElementById('session-subject');
        if (subjectSelect && tutor.tutorProfile.subjects) {
            subjectSelect.innerHTML = '<option value="">Select Subject</option>';
            tutor.tutorProfile.subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject;
                option.textContent = this.formatSubject(subject);
                subjectSelect.appendChild(option);
            });
        }

        const modal = document.getElementById('book-session-modal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    async handleBookSession(e) {
        e.preventDefault();

        const user = window.authManager.getCurrentUser();
        if (!user || !this.selectedTutor) {
            window.firebaseConfig.showNotification('Error booking session.', 'error');
            return;
        }

        const subject = document.getElementById('session-subject').value;
        const dateTime = new Date(document.getElementById('session-date').value);
        const duration = parseInt(document.getElementById('session-duration').value);
        const notes = document.getElementById('session-notes').value;

        const sessionData = {
            studentId: user.uid,
            studentName: user.displayName,
            tutorId: this.selectedTutor.id,
            tutorName: this.selectedTutor.displayName,
            subject: subject,
            date: dateTime,
            duration: duration,
            notes: notes,
            hourlyRate: this.selectedTutor.tutorProfile.hourlyRate,
            totalCost: (this.selectedTutor.tutorProfile.hourlyRate * duration) / 60,
            status: 'upcoming',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            const docRef = await window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.sessions)
                .add(sessionData);

            console.log('Session booked successfully:', docRef.id);
            
            this.closeModal('book-session-modal');
            e.target.reset();
            this.selectedTutor = null;
            
            window.firebaseConfig.showNotification('Session booked successfully!', 'success');
            
        } catch (error) {
            console.error('Error booking session:', error);
            window.firebaseConfig.showNotification('Failed to book session.', 'error');
        }
    }

    generateStars(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        return '★'.repeat(fullStars) + 
               (hasHalfStar ? '☆' : '') + 
               '☆'.repeat(emptyStars);
    }

    formatSubject(subject) {
        return subject.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    formatAvailableTime(time) {
        const timeMap = {
            'morning': 'Morning (6AM-12PM)',
            'afternoon': 'Afternoon (12PM-6PM)',
            'evening': 'Evening (6PM-10PM)'
        };
        return timeMap[time] || time;
    }

    formatStatus(status) {
        return status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    formatSessionDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    showEmptyTutors() {
        const container = document.getElementById('tutors-grid');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No tutors found</h3>
                    <p>Try adjusting your filters or check back later.</p>
                </div>
            `;
        }
    }

    showEmptySessions() {
        const container = document.getElementById('sessions-list');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No sessions booked</h3>
                    <p>Book a session with a tutor to get started!</p>
                </div>
            `;
        }
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

    destroy() {
        if (this.tutorsListener) {
            this.tutorsListener();
        }
        if (this.sessionsListener) {
            this.sessionsListener();
        }
    }
}

// Initialize tutoring manager
document.addEventListener('DOMContentLoaded', () => {
    window.tutoringManager = new TutoringManager();
});

