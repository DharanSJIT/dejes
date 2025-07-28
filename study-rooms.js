// Study Rooms Management
class StudyRoomsManager {
    constructor() {
        this.currentRoom = null;
        this.roomsListener = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadStudyRooms();
    }

    setupEventListeners() {
        // Create room button
        const createRoomBtn = document.getElementById('create-room-btn');
        if (createRoomBtn) {
            createRoomBtn.addEventListener('click', () => this.showCreateRoomModal());
        }

        // Create room form
        const createRoomForm = document.getElementById('create-room-form');
        if (createRoomForm) {
            createRoomForm.addEventListener('submit', (e) => this.handleCreateRoom(e));
        }

        // Chat functionality
        const sendMessageBtn = document.getElementById('send-message-btn');
        const messageInput = document.getElementById('message-input');
        
        if (sendMessageBtn) {
            sendMessageBtn.addEventListener('click', () => this.sendChatMessage());
        }

        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendChatMessage();
                }
            });
        }
    }

    async loadStudyRooms() {
        try {
            if (!window.firebaseConfig.db) return;

            const roomsGrid = document.getElementById('rooms-grid');
            if (!roomsGrid) return;

            // Listen for real-time updates
            this.roomsListener = window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.studyRooms)
                .where('isActive', '==', true)
                .orderBy('createdAt', 'desc')
                .onSnapshot((snapshot) => {
                    this.renderStudyRooms(snapshot.docs);
                }, (error) => {
                    console.error('Error loading study rooms:', error);
                    roomsGrid.innerHTML = '<div class="empty-state">Failed to load study rooms.</div>';
                });

        } catch (error) {
            console.error('Error setting up study rooms listener:', error);
        }
    }

    renderStudyRooms(roomDocs) {
        const roomsGrid = document.getElementById('rooms-grid');
        if (!roomsGrid) return;

        if (roomDocs.length === 0) {
            roomsGrid.innerHTML = `
                <div class="empty-state">
                    <h3>No active study rooms</h3>
                    <p>Be the first to create a study room!</p>
                </div>
            `;
            return;
        }

        roomsGrid.innerHTML = roomDocs.map(doc => {
            const room = doc.data();
            const roomId = doc.id;
            
            return this.createRoomCardHTML(roomId, room);
        }).join('');

        // Add event listeners to join buttons
        roomsGrid.querySelectorAll('.join-room-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roomId = e.target.getAttribute('data-room-id');
                this.joinStudyRoom(roomId);
            });
        });
    }

    createRoomCardHTML(roomId, room) {
        const participantCount = room.participants?.length || 0;
        const maxParticipants = room.maxParticipants || 6;
        const isRoomFull = participantCount >= maxParticipants;
        
        return `
            <div class="room-card">
                <div class="room-header">
                    <div>
                        <h3 class="room-title">${this.escapeHtml(room.name)}</h3>
                        <span class="room-subject">${this.escapeHtml(room.subject)}</span>
                    </div>
                </div>
                <p class="room-description">${this.escapeHtml(room.description || 'No description provided')}</p>
                <div class="room-footer">
                    <div class="room-participants">
                        <i data-feather="users"></i>
                        <span>${participantCount}/${maxParticipants}</span>
                    </div>
                    <button class="join-room-btn" 
                            data-room-id="${roomId}" 
                            ${isRoomFull ? 'disabled' : ''}>
                        ${isRoomFull ? 'Room Full' : 'Join Room'}
                    </button>
                </div>
            </div>
        `;
    }

    showCreateRoomModal() {
        const modal = document.getElementById('create-room-modal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    async handleCreateRoom(e) {
        e.preventDefault();
        
        const user = window.authManager.getCurrentUser();
        if (!user) {
            window.firebaseConfig.showNotification('Please sign in to create a room.', 'error');
            return;
        }

        const formData = new FormData(e.target);
        const roomData = {
            name: formData.get('room-name') || document.getElementById('room-name').value,
            subject: formData.get('room-subject') || document.getElementById('room-subject').value,
            description: formData.get('room-description') || document.getElementById('room-description').value,
            maxParticipants: parseInt(formData.get('room-capacity') || document.getElementById('room-capacity').value),
            createdBy: user.uid,
            createdByName: user.displayName,
            participants: [user.uid],
            isActive: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            const docRef = await window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.studyRooms)
                .add(roomData);

            console.log('Room created successfully:', docRef.id);
            
            // Close modal
            this.closeModal('create-room-modal');
            
            // Reset form
            e.target.reset();
            
            // Join the created room
            await this.joinStudyRoom(docRef.id);
            
            window.firebaseConfig.showNotification('Room created successfully!', 'success');
            
        } catch (error) {
            console.error('Error creating room:', error);
            window.firebaseConfig.showNotification('Failed to create room. Please try again.', 'error');
        }
    }

    async joinStudyRoom(roomId) {
        try {
            const user = window.authManager.getCurrentUser();
            if (!user) {
                window.firebaseConfig.showNotification('Please sign in to join a room.', 'error');
                return;
            }

            // Get room data
            const roomDoc = await window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.studyRooms)
                .doc(roomId)
                .get();

            if (!roomDoc.exists) {
                window.firebaseConfig.showNotification('Room not found.', 'error');
                return;
            }

            const roomData = roomDoc.data();
            
            // Check if room is full
            const currentParticipants = roomData.participants || [];
            if (currentParticipants.length >= roomData.maxParticipants) {
                window.firebaseConfig.showNotification('Room is full.', 'error');
                return;
            }

            // Add user to room participants if not already there
            if (!currentParticipants.includes(user.uid)) {
                await window.firebaseConfig.db
                    .collection(window.firebaseConfig.collections.studyRooms)
                    .doc(roomId)
                    .update({
                        participants: firebase.firestore.FieldValue.arrayUnion(user.uid)
                    });
            }

            // Set current room
            this.currentRoom = roomId;
            
            // Show video chat modal
            this.showVideoChat(roomId, roomData.name);
            
            // Join WebRTC room
            if (window.webrtcManager) {
                await window.webrtcManager.joinRoom(roomId);
            }
            
            // Setup chat
            this.setupRoomChat(roomId);
            
        } catch (error) {
            console.error('Error joining room:', error);
            window.firebaseConfig.showNotification('Failed to join room. Please try again.', 'error');
        }
    }

    showVideoChat(roomId, roomName) {
        const modal = document.getElementById('video-chat-modal');
        const roomNameEl = document.getElementById('chat-room-name');
        
        if (modal) {
            modal.classList.add('show');
        }
        
        if (roomNameEl) {
            roomNameEl.textContent = roomName;
        }
    }

    async setupRoomChat(roomId) {
        if (!window.firebaseConfig.rtdb) return;

        const messagesRef = window.firebaseConfig.rtdb.ref(`${window.firebaseConfig.rtdbRefs.messages}/${roomId}`);
        const chatMessages = document.getElementById('chat-messages');
        
        if (!chatMessages) return;

        // Listen for new messages
        messagesRef.limitToLast(50).on('child_added', (snapshot) => {
            const message = snapshot.val();
            this.displayChatMessage(message);
        });

        // Clear chat when leaving
        messagesRef.on('child_removed', (snapshot) => {
            const messageId = snapshot.key;
            const messageEl = document.getElementById(`message-${messageId}`);
            if (messageEl) {
                messageEl.remove();
            }
        });
    }

    displayChatMessage(message) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message';
        messageEl.id = `message-${message.id}`;
        messageEl.innerHTML = `
            <div class="sender">${this.escapeHtml(message.senderName)}</div>
            <div class="content">${this.escapeHtml(message.content)}</div>
        `;

        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async sendChatMessage() {
        const messageInput = document.getElementById('message-input');
        if (!messageInput || !this.currentRoom) return;

        const content = messageInput.value.trim();
        if (!content) return;

        const user = window.authManager.getCurrentUser();
        if (!user) return;

        try {
            const messagesRef = window.firebaseConfig.rtdb.ref(`${window.firebaseConfig.rtdbRefs.messages}/${this.currentRoom}`);
            
            await messagesRef.push({
                id: Date.now().toString(),
                senderId: user.uid,
                senderName: user.displayName,
                content: content,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });

            messageInput.value = '';
        } catch (error) {
            console.error('Error sending message:', error);
            window.firebaseConfig.showNotification('Failed to send message.', 'error');
        }
    }

    async leaveCurrentRoom() {
        if (!this.currentRoom) return;

        try {
            const user = window.authManager.getCurrentUser();
            if (!user) return;

            // Remove user from room participants
            await window.firebaseConfig.db
                .collection(window.firebaseConfig.collections.studyRooms)
                .doc(this.currentRoom)
                .update({
                    participants: firebase.firestore.FieldValue.arrayRemove(user.uid)
                });

            // Leave WebRTC room
            if (window.webrtcManager) {
                await window.webrtcManager.leaveRoom();
            }

            this.currentRoom = null;
            
        } catch (error) {
            console.error('Error leaving room:', error);
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
        if (this.roomsListener) {
            this.roomsListener();
        }
    }
}

// Initialize study rooms manager
document.addEventListener('DOMContentLoaded', () => {
    window.studyRoomsManager = new StudyRoomsManager();
});
