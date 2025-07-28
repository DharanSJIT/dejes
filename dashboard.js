// Dashboard Management
class DashboardManager {
    constructor() {
        this.dashboardData = {
            activeRooms: [],
            upcomingEvents: [],
            recommendedPeers: [],
            tutoringSessions: []
        };
        this.listeners = [];
        this.init();
    }

    init() {
        // Dashboard will be loaded when user signs in
    }

    async loadDashboard() {
        try {
            const user = window.authManager.getCurrentUser();
            if (!user) return;

            // Load all dashboard sections
            await Promise.all([
                this.loadActiveRooms(),
                this.loadUpcomingEvents(),
                this.loadRecommendedPeers(),
                this.loadTutoringSessions()
            ]);

        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }

    async loadActiveRooms() {
        try {
            if (!window.firebaseConfig.db) return;

            // Listen for active study rooms
            const roomsQuery = window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.studyRooms)
                .where('isActive', '==', true)
                .orderBy('createdAt', 'desc')
                .limit(5);

            const unsubscribe = roomsQuery.onSnapshot((snapshot) => {
                this.dashboardData.activeRooms = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.renderActiveRooms();
            }, (error) => {
                console.error('Error loading active rooms:', error);
                this.renderEmptyActiveRooms();
            });

            this.listeners.push(unsubscribe);

        } catch (error) {
            console.error('Error setting up active rooms listener:', error);
            this.renderEmptyActiveRooms();
        }
    }

    async loadUpcomingEvents() {
        try {
            if (!window.firebaseConfig.db) return;

            const user = window.authManager.getCurrentUser();
            if (!user) return;

            // Get user's clubs first
            const userClubsSnapshot = await window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.clubs)
                .where('members', 'array-contains', user.uid)
                .get();

            const userClubIds = userClubsSnapshot.docs.map(doc => doc.id);

            if (userClubIds.length === 0) {
                this.renderEmptyUpcomingEvents();
                return;
            }

            // Listen for events from user's clubs
            const now = new Date();
            const eventsQuery = window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.events)
                .where('clubId', 'in', userClubIds.slice(0, 10)) // Firestore 'in' limit
                .where('date', '>=', now)
                .orderBy('date', 'asc')
                .limit(5);

            const unsubscribe = eventsQuery.onSnapshot((snapshot) => {
                this.dashboardData.upcomingEvents = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.renderUpcomingEvents();
            }, (error) => {
                console.error('Error loading upcoming events:', error);
                this.renderEmptyUpcomingEvents();
            });

            this.listeners.push(unsubscribe);

        } catch (error) {
            console.error('Error setting up upcoming events listener:', error);
            this.renderEmptyUpcomingEvents();
        }
    }

    async loadRecommendedPeers() {
        try {
            const user = window.authManager.getCurrentUser();
            if (!user) return;

            // Get user preferences
            const userProfile = await window.authManager.getUserProfile();
            if (!userProfile || !userProfile.preferences) {
                this.renderEmptyRecommendedPeers();
                return;
            }

            // Find users with similar preferences
            const usersSnapshot = await window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.users)
                .where('uid', '!=', user.uid)
                .limit(20)
                .get();

            const potentialMatches = [];
            const userPrefs = userProfile.preferences;

            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                if (userData.preferences) {
                    const compatibility = this.calculateCompatibility(userPrefs, userData.preferences);
                    if (compatibility > 30) { // At least 30% compatibility
                        potentialMatches.push({
                            ...userData,
                            compatibility
                        });
                    }
                }
            });

            // Sort by compatibility and take top 3
            potentialMatches.sort((a, b) => b.compatibility - a.compatibility);
            this.dashboardData.recommendedPeers = potentialMatches.slice(0, 3);
            
            this.renderRecommendedPeers();

        } catch (error) {
            console.error('Error loading recommended peers:', error);
            this.renderEmptyRecommendedPeers();
        }
    }

    async loadTutoringSessions() {
        try {
            if (!window.firebaseConfig.db) return;

            const user = window.authManager.getCurrentUser();
            if (!user) return;

            // Listen for user's tutoring sessions
            const now = new Date();
            const sessionsQuery = window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.sessions)
                .where('studentId', '==', user.uid)
                .where('date', '>=', now)
                .orderBy('date', 'asc')
                .limit(3);

            const unsubscribe = sessionsQuery.onSnapshot((snapshot) => {
                this.dashboardData.tutoringSessions = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.renderTutoringSessions();
            }, (error) => {
                console.error('Error loading tutoring sessions:', error);
                this.renderEmptyTutoringSessions();
            });

            this.listeners.push(unsubscribe);

        } catch (error) {
            console.error('Error setting up tutoring sessions listener:', error);
            this.renderEmptyTutoringSessions();
        }
    }

    renderActiveRooms() {
        const container = document.getElementById('active-rooms-list');
        if (!container) return;

        if (this.dashboardData.activeRooms.length === 0) {
            this.renderEmptyActiveRooms();
            return;
        }

        container.innerHTML = this.dashboardData.activeRooms.map(room => {
            const participantCount = room.participants?.length || 0;
            const maxParticipants = room.maxParticipants || 6;
            
            return `
                <div class="dashboard-item">
                    <div class="dashboard-item-info">
                        <h4>${this.escapeHtml(room.name)}</h4>
                        <p>${this.escapeHtml(room.subject)} • ${participantCount}/${maxParticipants} participants</p>
                    </div>
                    <button class="dashboard-item-action" onclick="window.studyRoomsManager?.joinStudyRoom('${room.id}')">
                        Join
                    </button>
                </div>
            `;
        }).join('');
    }

    renderUpcomingEvents() {
        const container = document.getElementById('upcoming-events-list');
        if (!container) return;

        if (this.dashboardData.upcomingEvents.length === 0) {
            this.renderEmptyUpcomingEvents();
            return;
        }

        container.innerHTML = this.dashboardData.upcomingEvents.map(event => {
            const eventDate = event.date.toDate ? event.date.toDate() : new Date(event.date);
            
            return `
                <div class="dashboard-item">
                    <div class="dashboard-item-info">
                        <h4>${this.escapeHtml(event.title)}</h4>
                        <p>${this.escapeHtml(event.clubName)} • ${this.formatEventTime(eventDate)}</p>
                    </div>
                    <button class="dashboard-item-action" onclick="window.clubsManager?.attendEvent('${event.id}')">
                        Attend
                    </button>
                </div>
            `;
        }).join('');
    }

    renderRecommendedPeers() {
        const container = document.getElementById('recommended-peers-list');
        if (!container) return;

        if (this.dashboardData.recommendedPeers.length === 0) {
            this.renderEmptyRecommendedPeers();
            return;
        }

        container.innerHTML = this.dashboardData.recommendedPeers.map(peer => {
            const commonSubjects = this.getCommonSubjects(peer);
            
            return `
                <div class="dashboard-item">
                    <div class="dashboard-item-info">
                        <h4>${this.escapeHtml(peer.displayName)}</h4>
                        <p>${commonSubjects} • ${peer.compatibility}% match</p>
                    </div>
                    <button class="dashboard-item-action" onclick="window.matchingManager?.connectWithUser('${peer.uid}')">
                        Connect
                    </button>
                </div>
            `;
        }).join('');
    }

    renderTutoringSessions() {
        const container = document.getElementById('tutoring-sessions-list');
        if (!container) return;

        if (this.dashboardData.tutoringSessions.length === 0) {
            this.renderEmptyTutoringSessions();
            return;
        }

        container.innerHTML = this.dashboardData.tutoringSessions.map(session => {
            const sessionDate = session.date.toDate ? session.date.toDate() : new Date(session.date);
            
            return `
                <div class="dashboard-item">
                    <div class="dashboard-item-info">
                        <h4>${this.escapeHtml(session.tutorName)}</h4>
                        <p>${this.formatSubject(session.subject)} • ${this.formatEventTime(sessionDate)}</p>
                    </div>
                    <button class="dashboard-item-action" onclick="window.tutoringManager?.switchTab('my-sessions')">
                        View
                    </button>
                </div>
            `;
        }).join('');
    }

    renderEmptyActiveRooms() {
        const container = document.getElementById('active-rooms-list');
        if (container) {
            container.innerHTML = '<div class="empty-state">No active study rooms</div>';
        }
    }

    renderEmptyUpcomingEvents() {
        const container = document.getElementById('upcoming-events-list');
        if (container) {
            container.innerHTML = '<div class="empty-state">No upcoming events</div>';
        }
    }

    renderEmptyRecommendedPeers() {
        const container = document.getElementById('recommended-peers-list');
        if (container) {
            container.innerHTML = '<div class="empty-state">Update your preferences to find study buddies</div>';
        }
    }

    renderEmptyTutoringSessions() {
        const container = document.getElementById('tutoring-sessions-list');
        if (container) {
            container.innerHTML = '<div class="empty-state">No upcoming tutoring sessions</div>';
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

    async getCommonSubjects(peer) {
        try {
            const user = window.authManager.getCurrentUser();
            if (!user) return '';

            const userProfile = await window.authManager.getUserProfile();
            if (!userProfile?.preferences?.subjects) return '';

            const userSubjects = userProfile.preferences.subjects;
            const peerSubjects = peer.preferences?.subjects || [];
            const common = this.getCommonItems(userSubjects, peerSubjects);
            
            if (common.length === 0) return 'Different interests';
            if (common.length === 1) return this.formatSubject(common[0]);
            return `${this.formatSubject(common[0])} +${common.length - 1} more`;
            
        } catch (error) {
            console.error('Error getting common subjects:', error);
            return '';
        }
    }

    formatEventTime(date) {
        const now = new Date();
        const diffInHours = Math.abs(date - now) / (1000 * 60 * 60);
        
        if (diffInHours < 24) {
            // Less than 24 hours - show time
            return new Intl.DateTimeFormat('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
        } else if (diffInHours < 168) { // Less than a week
            // Show day and time
            return new Intl.DateTimeFormat('en-US', {
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
        } else {
            // Show date
            return new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric'
            }).format(date);
        }
    }

    formatSubject(subject) {
        return subject.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy() {
        // Clean up all listeners
        this.listeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.listeners = [];
    }
}

// Initialize dashboard manager
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
});

