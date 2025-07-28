// Main Application Controller
class VirtualCampusApp {
    constructor() {
        this.currentView = 'dashboard';
        this.isInitialized = false;
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupModalHandlers();
        this.setupGlobalEventListeners();
        this.hideLoadingScreen();
    }

    setupNavigation() {
        // Navigation buttons
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.getAttribute('data-view');
                if (view) {
                    this.showView(view);
                }
            });
        });
    }

    setupModalHandlers() {
        // Generic modal close handlers
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('show');
            }
        });

        // Close button handlers
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.classList.remove('show');
                }
            });
        });

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal.show');
                if (openModal) {
                    openModal.classList.remove('show');
                }
            }
        });
    }

    setupGlobalEventListeners() {
        // Window resize handler for responsive adjustments
        window.addEventListener('resize', this.handleResize.bind(this));

        // Handle beforeunload to clean up connections
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

        // Handle visibility change to manage real-time connections
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }

    showView(viewName) {
        // Update navigation active state
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeNavBtn = document.querySelector(`[data-view="${viewName}"]`);
        if (activeNavBtn) {
            activeNavBtn.classList.add('active');
        }

        // Update view content
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
            this.currentView = viewName;
            
            // Trigger view-specific initialization
            this.initializeView(viewName);
        }
    }

    initializeView(viewName) {
        switch (viewName) {
            case 'dashboard':
                if (window.dashboardManager) {
                    window.dashboardManager.loadDashboard();
                }
                break;
            case 'study-rooms':
                if (window.studyRoomsManager) {
                    window.studyRoomsManager.loadStudyRooms();
                }
                break;
            case 'matching':
                if (window.matchingManager) {
                    window.matchingManager.findMatches();
                }
                break;
            case 'clubs':
                if (window.clubsManager) {
                    window.clubsManager.loadClubs();
                    window.clubsManager.loadEvents();
                }
                break;
            case 'tutoring':
                if (window.tutoringManager) {
                    window.tutoringManager.loadTutors();
                    window.tutoringManager.loadUserSessions();
                }
                break;
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 1000);
        }
    }

    handleResize() {
        // Handle responsive layout adjustments
        if (window.innerWidth <= 768) {
            this.adjustMobileLayout();
        } else {
            this.adjustDesktopLayout();
        }
    }

    adjustMobileLayout() {
        // Mobile-specific adjustments
        const videoGrid = document.getElementById('video-grid');
        if (videoGrid && this.currentView === 'study-rooms') {
            videoGrid.style.gridTemplateColumns = '1fr';
        }
    }

    adjustDesktopLayout() {
        // Desktop-specific adjustments
        const videoGrid = document.getElementById('video-grid');
        if (videoGrid && this.currentView === 'study-rooms') {
            videoGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
        }
    }

    handleBeforeUnload() {
        // Clean up connections before page unload
        if (window.studyRoomsManager && window.studyRoomsManager.currentRoom) {
            window.studyRoomsManager.leaveCurrentRoom();
        }
        
        if (window.webrtcManager) {
            window.webrtcManager.leaveRoom();
        }
    }

    handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden - reduce activity
            this.pauseRealTimeUpdates();
        } else {
            // Page is visible - resume activity
            this.resumeRealTimeUpdates();
        }
    }

    pauseRealTimeUpdates() {
        // Reduce real-time update frequency when page is not visible
        console.log('Pausing real-time updates');
    }

    resumeRealTimeUpdates() {
        // Resume normal real-time update frequency
        console.log('Resuming real-time updates');
        
        // Refresh current view data
        this.initializeView(this.currentView);
    }

    // Utility methods
    showNotification(message, type = 'info') {
        if (window.firebaseConfig && window.firebaseConfig.showNotification) {
            window.firebaseConfig.showNotification(message, type);
        }
    }

    formatDate(date) {
        if (!date) return '';
        
        if (date.toDate) {
            date = date.toDate();
        }
        
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    formatTimeAgo(date) {
        if (!date) return '';
        
        if (date.toDate) {
            date = date.toDate();
        }
        
        const now = new Date();
        const diffInMs = now - date;
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);
        
        if (diffInMinutes < 1) {
            return 'just now';
        } else if (diffInMinutes < 60) {
            return `${diffInMinutes}m ago`;
        } else if (diffInHours < 24) {
            return `${diffInHours}h ago`;
        } else {
            return `${diffInDays}d ago`;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global utility functions
window.showView = function(viewName) {
    if (window.virtualCampusApp) {
        window.virtualCampusApp.showView(viewName);
    }
};

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Feather icons
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
    
    // Initialize main application
    window.virtualCampusApp = new VirtualCampusApp();
    
    console.log('Virtual Campus Platform initialized');
});

// Handle page visibility for better performance
document.addEventListener('visibilitychange', () => {
    if (window.virtualCampusApp) {
        window.virtualCampusApp.handleVisibilityChange();
    }
});

