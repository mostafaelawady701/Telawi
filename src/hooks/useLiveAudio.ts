import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../firebase';

export function useLiveAudio(roomId: string | undefined, user: any, isHost: boolean) {
  const [isLive, setIsLive] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [activeUsers, setActiveUsers] = useState<any[]>([]); 
  
  const channelRef = useRef<any>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const isLiveRef = useRef(false);

  useEffect(() => {
    isLiveRef.current = isLive;
  }, [isLive]);

  // Handle cleanup of a specific peer
  const cleanupPeer = useCallback((userId: string) => {
    const pc = peersRef.current.get(userId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
      peersRef.current.delete(userId);
    }
    pendingCandidatesRef.current.delete(userId);
    setRemoteStreams(prev => {
      if (!prev.has(userId)) return prev;
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  const createPeerConnection = useCallback((targetUserId: string) => {
    // Cleanup existing if any
    cleanupPeer(targetUserId);

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10,
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'webrtc_signaling',
          payload: { 
            type: 'ice-candidate', 
            target: targetUserId, 
            sender: user.uid, 
            data: { candidate: event.candidate } 
          }
        });
      }
    };
    
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'failed' || state === 'disconnected') {
        console.warn(`ICE connection ${state} for ${targetUserId}.`);
        if (state === 'failed' && isLiveRef.current && isHost) {
          console.log(`Retrying connection to ${targetUserId}...`);
          setTimeout(() => {
            if (isLiveRef.current && channelRef.current?.presenceState()[targetUserId]) {
              initiateCall(targetUserId);
            }
          }, 3000);
        }
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.set(targetUserId, event.streams[0]);
        return next;
      });
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    peersRef.current.set(targetUserId, pc);
    return pc;
  }, [user.uid, isHost, cleanupPeer]);

  const initiateCall = useCallback(async (targetUserId: string) => {
    if (targetUserId === user.uid) return;
    try {
      const pc = createPeerConnection(targetUserId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      channelRef.current?.send({
        type: 'broadcast',
        event: 'webrtc_signaling',
        payload: { type: 'offer', target: targetUserId, sender: user.uid, data: { sdp: offer } }
      });
    } catch (err) {
      console.error("Failed to initiate call:", err);
    }
  }, [user.uid, createPeerConnection]);

  useEffect(() => {
    if (!roomId || !user?.uid) return;

    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: { key: user.uid },
        broadcast: { ack: false }
      }
    });

    channelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users: any[] = [];
      Object.keys(state).forEach(key => {
        if (state[key][0]) users.push(state[key][0]);
      });
      setActiveUsers(users);
    });

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      if (key === user.uid) return;
      console.log('User joined:', newPresences[0]?.name || key);
      if (isLiveRef.current && isHost) {
        initiateCall(key);
      }
    });

    channel.on('presence', { event: 'leave' }, ({ key }) => {
      console.log('User left:', key);
      cleanupPeer(key);
    });

    channel.on('broadcast', { event: 'webrtc_signaling' }, async ({ payload }) => {
      const { type, target, sender, data } = payload;
      
      if (target !== user.uid && target !== '*') return;
      if (sender === user.uid) return;

      try {
        if (type === 'offer') {
          const pc = createPeerConnection(sender);
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          
          // Add any pending candidates
          const pending = pendingCandidatesRef.current.get(sender) || [];
          for (const cand of pending) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.error);
          }
          pendingCandidatesRef.current.delete(sender);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          channel.send({
            type: 'broadcast',
            event: 'webrtc_signaling',
            payload: { type: 'answer', target: sender, sender: user.uid, data: { sdp: answer } }
          });
        } 
        else if (type === 'answer') {
          const pc = peersRef.current.get(sender);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            const pending = pendingCandidatesRef.current.get(sender) || [];
            for (const cand of pending) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.error);
            }
            pendingCandidatesRef.current.delete(sender);
          }
        } 
        else if (type === 'ice-candidate') {
          const pc = peersRef.current.get(sender);
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => {
              if (pc.signalingState !== 'closed') console.error("Error adding ice candidate:", e);
            });
          } else {
            // Queue candidate
            const pending = pendingCandidatesRef.current.get(sender) || [];
            pending.push(data.candidate);
            pendingCandidatesRef.current.set(sender, pending);
          }
        }
        else if (type === 'request-connection') {
          if (isLiveRef.current && isHost) initiateCall(sender);
        }
        else if (type === 'toggle-live') {
          setIsLive(data.isLive);
          if (!data.isLive) {
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
            peersRef.current.forEach(pc => pc.close());
            peersRef.current.clear();
            setRemoteStreams(new Map());
          }
        }
      } catch (err) {
        console.error("Signaling error:", err);
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({ 
          uid: user.uid, 
          name: user.displayName || 'قارئ', 
          photoURL: user.photoURL,
          isHost,
          isReady: false,
          joinedAt: new Date().toISOString()
        });
      }
    });

    return () => {
      channel.unsubscribe();
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
      localStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [roomId, user.uid, user.displayName, user.photoURL, isHost, initiateCall, cleanupPeer, createPeerConnection]);

  const updatePresence = async (metadata: any) => {
    if (channelRef.current) {
      await channelRef.current.track({
        uid: user.uid,
        name: user.displayName,
        photoURL: user.photoURL,
        isHost,
        ...metadata
      });
    }
  };

  const startLive = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      localStreamRef.current = stream;
      setIsLive(true);
      
      channelRef.current?.send({
        type: 'broadcast',
        event: 'webrtc_signaling',
        payload: { type: 'toggle-live', target: '*', sender: user.uid, data: { isLive: true } }
      });

      // Map presence to uid list
      const state = channelRef.current?.presenceState() || {};
      Object.keys(state).forEach(id => {
        if (id !== user.uid) initiateCall(id);
      });
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopLive = (broadcast = true) => {
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    setIsLive(false);
    
    if (broadcast) {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'webrtc_signaling',
        payload: { type: 'toggle-live', target: '*', sender: user.uid, data: { isLive: false } }
      });
    }

    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
    setRemoteStreams(new Map());
  };

  const joinLive = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      localStreamRef.current = stream;
      setIsLive(true);
      
      channelRef.current?.send({
        type: 'broadcast',
        event: 'webrtc_signaling',
        payload: { type: 'request-connection', target: '*', sender: user.uid, data: {} }
      });
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  return { isLive, startLive, stopLive, joinLive, remoteStreams, activeUsers, updatePresence };
}
