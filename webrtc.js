// WebRTC Manager for Video/Audio Chat
class WebRTCManager {
    constructor() {
        this.localVideo = null;
        this.localStream = null;
        this.peerConnections = new Map();
        this.roomId = null;
        this.isVideoEnabled = true;
        this.isAudioEnabled = true;
        
        // STUN servers for NAT traversal
        this.pcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        this.init();
    }

    init() {
        this.localVideo = document.getElementById('local-video');
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Video/Audio toggle buttons
        const toggleVideoBtn = document.getElementById('toggle-video-btn');
        const toggleAudioBtn = document.getElementById('toggle-audio-btn');
        const leaveRoomBtn = document.getElementById('leave-room-btn');

        if (toggleVideoBtn) {
            toggleVideoBtn.addEventListener('click', () => this.toggleVideo());
        }

        if (toggleAudioBtn) {
            toggleAudioBtn.addEventListener('click', () => this.toggleAudio());
        }

        if (leaveRoomBtn) {
            leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        }
    }

    async joinRoom(roomId) {
        try {
            this.roomId = roomId;
            
            // Get user media
            await this.startLocalStream();
            
            // Listen for other participants
            this.listenForParticipants();
            
            // Add user to room participants
            await this.addToRoomParticipants();
            
            console.log('Successfully joined room:', roomId);
            return true;
        } catch (error) {
            console.error('Error joining room:', error);
            window.firebaseConfig.showNotification('Failed to join video chat.', 'error');
            return false;
        }
    }

    async startLocalStream() {
        try {
            const constraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                }
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            if (this.localVideo) {
                this.localVideo.srcObject = this.localStream;
            }
            
            console.log('Local stream started successfully');
        } catch (error) {
            console.error('Error accessing media devices:', error);
            
            if (error.name === 'NotAllowedError') {
                window.firebaseConfig.showNotification('Camera/microphone access denied. Please allow access and try again.', 'error');
            } else if (error.name === 'NotFoundError') {
                window.firebaseConfig.showNotification('Camera or microphone not found.', 'error');
            } else {
                window.firebaseConfig.showNotification('Failed to access camera/microphone.', 'error');
            }
            throw error;
        }
    }

    async listenForParticipants() {
        if (!this.roomId || !window.firebaseConfig.rtdb) return;

        const participantsRef = window.firebaseConfig.rtdb.ref(`${window.firebaseConfig.rtdbRefs.roomParticipants}/${this.roomId}`);
        
        participantsRef.on('child_added', async (snapshot) => {
            const participantId = snapshot.key;
            const participantData = snapshot.val();
            
            // Don't connect to ourselves
            if (participantId === window.authManager.getCurrentUser()?.uid) {
                return;
            }
            
            console.log('New participant joined:', participantId);
            await this.createPeerConnection(participantId, true);
        });

        participantsRef.on('child_removed', (snapshot) => {
            const participantId = snapshot.key;
            console.log('Participant left:', participantId);
            this.removePeerConnection(participantId);
        });
    }

    async createPeerConnection(participantId, createOffer = false) {
        try {
            const peerConnection = new RTCPeerConnection(this.pcConfig);
            this.peerConnections.set(participantId, peerConnection);

            // Add local stream to peer connection
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, this.localStream);
                });
            }

            // Handle remote stream
            peerConnection.ontrack = (event) => {
                console.log('Received remote stream from:', participantId);
                this.addRemoteVideo(participantId, event.streams[0]);
            };

            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.sendIceCandidate(participantId, event.candidate);
                }
            };

            // Listen for signaling messages
            this.listenForSignalingMessages(participantId, peerConnection);

            if (createOffer) {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                this.sendSignalingMessage(participantId, { type: 'offer', offer: offer });
            }

        } catch (error) {
            console.error('Error creating peer connection:', error);
        }
    }

    async listenForSignalingMessages(participantId, peerConnection) {
        if (!window.firebaseConfig.rtdb) return;

        const messagesRef = window.firebaseConfig.rtdb.ref(`signaling/${this.roomId}/${window.authManager.getCurrentUser()?.uid}`);
        
        messagesRef.on('child_added', async (snapshot) => {
            const message = snapshot.val();
            
            if (message.from !== participantId) return;

            try {
                if (message.type === 'offer') {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    this.sendSignalingMessage(participantId, { type: 'answer', answer: answer });
                } else if (message.type === 'answer') {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
                } else if (message.type === 'ice-candidate') {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
                }

                // Remove processed message
                snapshot.ref.remove();
            } catch (error) {
                console.error('Error processing signaling message:', error);
            }
        });
    }

    sendSignalingMessage(participantId, message) {
        if (!window.firebaseConfig.rtdb || !this.roomId) return;

        const messagesRef = window.firebaseConfig.rtdb.ref(`signaling/${this.roomId}/${participantId}`);
        messagesRef.push({
            ...message,
            from: window.authManager.getCurrentUser()?.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    }

    sendIceCandidate(participantId, candidate) {
        this.sendSignalingMessage(participantId, {
            type: 'ice-candidate',
            candidate: candidate
        });
    }

    addRemoteVideo(participantId, stream) {
        const videoGrid = document.getElementById('video-grid');
        if (!videoGrid) return;

        // Remove existing video element if any
        const existingVideo = document.getElementById(`remote-video-${participantId}`);
        if (existingVideo) {
            existingVideo.remove();
        }

        // Create new video element
        const videoElement = document.createElement('video');
        videoElement.id = `remote-video-${participantId}`;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.srcObject = stream;
        
        videoGrid.appendChild(videoElement);
    }

    removePeerConnection(participantId) {
        // Close peer connection
        const peerConnection = this.peerConnections.get(participantId);
        if (peerConnection) {
            peerConnection.close();
            this.peerConnections.delete(participantId);
        }

        // Remove video element
        const videoElement = document.getElementById(`remote-video-${participantId}`);
        if (videoElement) {
            videoElement.remove();
        }
    }

    async addToRoomParticipants() {
        if (!window.firebaseConfig.rtdb || !this.roomId) return;

        const user = window.authManager.getCurrentUser();
        if (!user) return;

        const participantsRef = window.firebaseConfig.rtdb.ref(`${window.firebaseConfig.rtdbRefs.roomParticipants}/${this.roomId}/${user.uid}`);
        
        await participantsRef.set({
            displayName: user.displayName,
            photoURL: user.photoURL,
            joinedAt: firebase.database.ServerValue.TIMESTAMP
        });

        // Remove user when they disconnect
        participantsRef.onDisconnect().remove();
    }

    toggleVideo() {
        if (!this.localStream) return;

        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            this.isVideoEnabled = !this.isVideoEnabled;
            videoTrack.enabled = this.isVideoEnabled;
            
            const toggleBtn = document.getElementById('toggle-video-btn');
            if (toggleBtn) {
                const icon = toggleBtn.querySelector('i');
                if (icon) {
                    icon.setAttribute('data-feather', this.isVideoEnabled ? 'video' : 'video-off');
                    feather.replace();
                }
                toggleBtn.style.background = this.isVideoEnabled ? 'rgba(255, 255, 255, 0.2)' : '#e53e3e';
            }
        }
    }

    toggleAudio() {
        if (!this.localStream) return;

        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            this.isAudioEnabled = !this.isAudioEnabled;
            audioTrack.enabled = this.isAudioEnabled;
            
            const toggleBtn = document.getElementById('toggle-audio-btn');
            if (toggleBtn) {
                const icon = toggleBtn.querySelector('i');
                if (icon) {
                    icon.setAttribute('data-feather', this.isAudioEnabled ? 'mic' : 'mic-off');
                    feather.replace();
                }
                toggleBtn.style.background = this.isAudioEnabled ? 'rgba(255, 255, 255, 0.2)' : '#e53e3e';
            }
        }
    }

    async leaveRoom() {
        try {
            // Remove from participants
            if (window.firebaseConfig.rtdb && this.roomId) {
                const user = window.authManager.getCurrentUser();
                if (user) {
                    await window.firebaseConfig.rtdb.ref(`${window.firebaseConfig.rtdbRefs.roomParticipants}/${this.roomId}/${user.uid}`).remove();
                }
            }

            // Close all peer connections
            this.peerConnections.forEach((pc) => {
                pc.close();
            });
            this.peerConnections.clear();

            // Stop local stream
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    track.stop();
                });
                this.localStream = null;
            }

            // Clear video elements
            const videoGrid = document.getElementById('video-grid');
            if (videoGrid) {
                const remoteVideos = videoGrid.querySelectorAll('video:not(#local-video)');
                remoteVideos.forEach(video => video.remove());
            }

            // Reset local video
            if (this.localVideo) {
                this.localVideo.srcObject = null;
            }

            // Close video chat modal
            const modal = document.getElementById('video-chat-modal');
            if (modal) {
                modal.classList.remove('show');
            }

            this.roomId = null;
            console.log('Successfully left the room');
            
        } catch (error) {
            console.error('Error leaving room:', error);
        }
    }
}

// Initialize WebRTC manager
document.addEventListener('DOMContentLoaded', () => {
    window.webrtcManager = new WebRTCManager();
});
