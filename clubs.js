// Clubs and Events Management
class ClubsManager {
    constructor() {
        this.userClubs = [];
        this.allClubs = [];
        this.upcomingEvents = [];
        this.clubsListener = null;
        this.eventsListener = null;
        this.currentTab = 'my-clubs';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupTabNavigation();
    }

    setupEventListeners() {
        // Create club button
        const createClubBtn = document.getElementById('create-club-btn');
        if (createClubBtn) {
            createClubBtn.addEventListener('click', () => this.showCreateClubModal());
        }

        // Create event button
        const createEventBtn = document.getElementById('create-event-btn');
        if (createEventBtn) {
            createEventBtn.addEventListener('click', () => this.showCreateEventModal());
        }

        // Create club form
        const createClubForm = document.getElementById('create-club-form');
        if (createClubForm) {
            createClubForm.addEventListener('submit', (e) => this.handleCreateClub(e));
        }

        // Create event form
        const createEventForm = document.getElementById('create-event-form');
        if (createEventForm) {
            createEventForm.addEventListener('submit', (e) => this.handleCreateEvent(e));
        }
    }

    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.clubs-tabs .tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.clubs-tabs .tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Update active tab content
        document.querySelectorAll('.clubs-content .tab-content').forEach(content => {
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
            case 'my-clubs':
                this.loadUserClubs();
                break;
            case 'all-clubs':
                this.loadAllClubs();
                break;
            case 'events':
                this.loadEvents();
                break;
        }
    }

    async loadClubs() {
        this.loadUserClubs();
        this.loadAllClubs();
    }

    async loadUserClubs() {
        try {
            const user = window.authManager.getCurrentUser();
            if (!user) {
                this.showEmptyUserClubs();
                return;
            }

            if (!window.firebaseConfig.db) return;

            // Get user's clubs
            const userClubsQuery = window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.clubs)
                .where('members', 'array-contains', user.uid)
                .orderBy('createdAt', 'desc');

            this.clubsListener = userClubsQuery.onSnapshot((snapshot) => {
                this.userClubs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.renderUserClubs();
            }, (error) => {
                console.error('Error loading user clubs:', error);
                this.showEmptyUserClubs();
            });

        } catch (error) {
            console.error('Error setting up user clubs listener:', error);
            this.showEmptyUserClubs();
        }
    }

    async loadAllClubs() {
        try {
            if (!window.firebaseConfig.db) return;

            const allClubsQuery = window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.clubs)
                .orderBy('memberCount', 'desc')
                .limit(20);

            allClubsQuery.onSnapshot((snapshot) => {
                this.allClubs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.renderAllClubs();
            }, (error) => {
                console.error('Error loading all clubs:', error);
                this.showEmptyAllClubs();
            });

        } catch (error) {
            console.error('Error setting up all clubs listener:', error);
            this.showEmptyAllClubs();
        }
    }

    async loadEvents() {
        try {
            if (!window.firebaseConfig.db) return;

            const now = new Date();
            const eventsQuery = window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.events)
                .where('date', '>=', now)
                .orderBy('date', 'asc')
                .limit(20);

            this.eventsListener = eventsQuery.onSnapshot((snapshot) => {
                this.upcomingEvents = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.renderEvents();
            }, (error) => {
                console.error('Error loading events:', error);
                this.showEmptyEvents();
            });

        } catch (error) {
            console.error('Error setting up events listener:', error);
            this.showEmptyEvents();
        }
    }

    renderUserClubs() {
        const container = document.getElementById('my-clubs-grid');
        if (!container) return;

        if (this.userClubs.length === 0) {
            this.showEmptyUserClubs();
            return;
        }

        container.innerHTML = this.userClubs.map(club => 
            this.createClubCardHTML(club, true)
        ).join('');

        this.attachClubEventListeners(container);
    }

    renderAllClubs() {
        const container = document.getElementById('all-clubs-grid');
        if (!container) return;

        if (this.allClubs.length === 0) {
            this.showEmptyAllClubs();
            return;
        }

        const user = window.authManager.getCurrentUser();
        container.innerHTML = this.allClubs.map(club => {
            const isMember = user && club.members && club.members.includes(user.uid);
            return this.createClubCardHTML(club, isMember);
        }).join('');

        this.attachClubEventListeners(container);
    }

    renderEvents() {
        const container = document.getElementById('events-list');
        if (!container) return;

        if (this.upcomingEvents.length === 0) {
            this.showEmptyEvents();
            return;
        }

        container.innerHTML = this.upcomingEvents.map(event => 
            this.createEventCardHTML(event)
        ).join('');

        this.attachEventEventListeners(container);
    }

    createClubCardHTML(club, isMember) {
        const memberCount = club.memberCount || (club.members ? club.members.length : 0);
        
        return `
            <div class="club-card">
                <div class="club-header">
                    <div>
                        <h3 class="club-title">${this.escapeHtml(club.name)}</h3>
                        <span class="club-category">${this.escapeHtml(club.category)}</span>
                    </div>
                </div>
                <p class="club-description">${this.escapeHtml(club.description)}</p>
                <div class="club-footer">
                    <div class="club-members">
                        <i data-feather="users"></i>
                        <span>${memberCount} members</span>
                    </div>
                    <button class="join-club-btn ${isMember ? 'joined' : ''}" 
                            data-club-id="${club.id}"
                            ${isMember ? 'disabled' : ''}>
                        ${isMember ? 'Joined' : 'Join Club'}
                    </button>
                </div>
            </div>
        `;
    }

    createEventCardHTML(event) {
        const eventDate = event.date.toDate ? event.date.toDate() : new Date(event.date);
        
        return `
            <div class="event-card">
                <div class="event-info">
                    <h4>${this.escapeHtml(event.title)}</h4>
                    <div class="event-details">
                        <p><strong>Club:</strong> ${this.escapeHtml(event.clubName)}</p>
                        <p><strong>Date:</strong> ${this.formatEventDate(eventDate)}</p>
                        <p><strong>Type:</strong> ${this.escapeHtml(event.type)}</p>
                        ${event.description ? `<p>${this.escapeHtml(event.description)}</p>` : ''}
                    </div>
                </div>
                <div class="event-actions">
                    <button class="attend-btn" data-event-id="${event.id}">
                        Attend
                    </button>
                </div>
            </div>
        `;
    }

    attachClubEventListeners(container) {
        container.querySelectorAll('.join-club-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const clubId = e.target.getAttribute('data-club-id');
                this.joinClub(clubId);
            });
        });

        // Re-render Feather icons
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    attachEventEventListeners(container) {
        container.querySelectorAll('.attend-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const eventId = e.target.getAttribute('data-event-id');
                this.attendEvent(eventId);
            });
        });
    }

    showCreateClubModal() {
        const modal = document.getElementById('create-club-modal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    showCreateEventModal() {
        const modal = document.getElementById('create-event-modal');
        if (modal) {
            // Populate club dropdown
            this.populateClubDropdown();
            modal.classList.add('show');
        }
    }

    async populateClubDropdown() {
        const select = document.getElementById('event-club');
        if (!select) return;

        const user = window.authManager.getCurrentUser();
        if (!user) return;

        // Clear existing options (except the first one)
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }

        // Add user's clubs to dropdown
        this.userClubs.forEach(club => {
            const option = document.createElement('option');
            option.value = club.id;
            option.textContent = club.name;
            select.appendChild(option);
        });
    }

    async handleCreateClub(e) {
        e.preventDefault();

        const user = window.authManager.getCurrentUser();
        if (!user) {
            window.firebaseConfig.showNotification('Please sign in to create a club.', 'error');
            return;
        }

        const formData = new FormData(e.target);
        const clubData = {
            name: formData.get('club-name') || document.getElementById('club-name').value,
            description: formData.get('club-description') || document.getElementById('club-description').value,
            category: formData.get('club-category') || document.getElementById('club-category').value,
            createdBy: user.uid,
            createdByName: user.displayName,
            members: [user.uid],
            memberCount: 1,
            isActive: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            const docRef = await window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.clubs)
                .add(clubData);

            console.log('Club created successfully:', docRef.id);
            
            // Close modal and reset form
            this.closeModal('create-club-modal');
            e.target.reset();
            
            window.firebaseConfig.showNotification('Club created successfully!', 'success');
            
        } catch (error) {
            console.error('Error creating club:', error);
            window.firebaseConfig.showNotification('Failed to create club. Please try again.', 'error');
        }
    }

    async handleCreateEvent(e) {
        e.preventDefault();

        const user = window.authManager.getCurrentUser();
        if (!user) {
            window.firebaseConfig.showNotification('Please sign in to create an event.', 'error');
            return;
        }

        const clubId = document.getElementById('event-club').value;
        if (!clubId) {
            window.firebaseConfig.showNotification('Please select a club for the event.', 'error');
            return;
        }

        // Get club data
        const clubDoc = await window.firebaseConfig.db
            .collection(window.firebaseConfig.collections.clubs)
            .doc(clubId)
            .get();

        if (!clubDoc.exists) {
            window.firebaseConfig.showNotification('Selected club not found.', 'error');
            return;
        }

        const clubData = clubDoc.data();
        const eventDate = new Date(document.getElementById('event-date').value);

        const eventData = {
            title: document.getElementById('event-title').value,
            description: document.getElementById('event-description').value,
            date: eventDate,
            type: document.getElementById('event-type').value,
            clubId: clubId,
            clubName: clubData.name,
            createdBy: user.uid,
            createdByName: user.displayName,
            attendees: [user.uid],
            attendeeCount: 1,
            isActive: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            const docRef = await window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.events)
                .add(eventData);

            console.log('Event created successfully:', docRef.id);
            
            // Close modal and reset form
            this.closeModal('create-event-modal');
            e.target.reset();
            
            window.firebaseConfig.showNotification('Event created successfully!', 'success');
            
        } catch (error) {
            console.error('Error creating event:', error);
            window.firebaseConfig.showNotification('Failed to create event. Please try again.', 'error');
        }
    }

    async joinClub(clubId) {
        try {
            const user = window.authManager.getCurrentUser();
            if (!user) {
                window.firebaseConfig.showNotification('Please sign in to join a club.', 'error');
                return;
            }

            // Add user to club members and increment member count
            await window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.clubs)
                .doc(clubId)
                .update({
                    members: firebase.firestore.FieldValue.arrayUnion(user.uid),
                    memberCount: firebase.firestore.FieldValue.increment(1)
                });

            window.firebaseConfig.showNotification('Successfully joined the club!', 'success');
            
        } catch (error) {
            console.error('Error joining club:', error);
            window.firebaseConfig.showNotification('Failed to join club. Please try again.', 'error');
        }
    }

    async attendEvent(eventId) {
        try {
            const user = window.authManager.getCurrentUser();
            if (!user) {
                window.firebaseConfig.showNotification('Please sign in to attend an event.', 'error');
                return;
            }

            // Add user to event attendees
            await window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.events)
                .doc(eventId)
                .update({
                    attendees: firebase.firestore.FieldValue.arrayUnion(user.uid),
                    attendeeCount: firebase.firestore.FieldValue.increment(1)
                });

            window.firebaseConfig.showNotification('You are now attending this event!', 'success');
            
        } catch (error) {
            console.error('Error attending event:', error);
            window.firebaseConfig.showNotification('Failed to register for event. Please try again.', 'error');
        }
    }

    showEmptyUserClubs() {
        const container = document.getElementById('my-clubs-grid');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No clubs joined yet</h3>
                    <p>Join clubs to connect with like-minded students!</p>
                </div>
            `;
        }
    }

    showEmptyAllClubs() {
        const container = document.getElementById('all-clubs-grid');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No clubs available</h3>
                    <p>Be the first to create a club!</p>
                </div>
            `;
        }
    }

    showEmptyEvents() {
        const container = document.getElementById('events-list');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No upcoming events</h3>
                    <p>Create an event to bring your club together!</p>
                </div>
            `;
        }
    }

    formatEventDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
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
        if (this.clubsListener) {
            this.clubsListener();
        }
        if (this.eventsListener) {
            this.eventsListener();
        }
    }
}

// Initialize clubs manager
document.addEventListener('DOMContentLoaded', () => {
    window.clubsManager = new ClubsManager();
});

