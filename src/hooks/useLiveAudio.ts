import { useEffect, useRef, useState } from 'react';
import { supabase } from '../firebase';

export function useLiveAudio(roomId: string | undefined, user: any, isHost: boolean) {
  const [isLive, setIsLive] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [activeUsers, setActiveUsers] = useState<any[]>([]); // Track who is in the room
  
  const channelRef = useRef<any>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const isLiveRef = useRef(false);

  useEffect(() => {
    isLiveRef.current = isLive;
  }, [isLive]);

  useEffect(() => {
    if (!roomId || !user) return;

    // 1. Initialize Supabase Channel for the specific room
    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: { key: user.uid },
        broadcast: { self: false }
      }
    });
    channelRef.current = channel;

    // 2. Handle Presence (Who is in the room)
    channel.on('presence', { event: 'sync' }, () => {
      const newState = channel.presenceState();
      const users: any[] = [];
      for (const id in newState) {
        // We get the first presence instance for each user
        users.push(newState[id][0]);
      }
      setActiveUsers(users);
    });

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('User joined:', newPresences[0].name);
      // Auto-connect WebRTC if live
      if (isLiveRef.current && isHost) {
        initiateCall(key);
      }
    });

    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log('User left:', leftPresences[0].name);
      // Cleanup peer connection
      const pc = peersRef.current.get(key);
      if (pc) {
        pc.close();
        peersRef.current.delete(key);
      }
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    });

    // 3. Handle WebRTC Signaling via Broadcast
    channel.on('broadcast', { event: 'webrtc_signaling' }, async (payload) => {
      const { type, target, sender, data } = payload.payload;
      
      // Ignore if not meant for us
      if (target !== user.uid) return;

      if (type === 'offer') {
        const pc = createPeerConnection(sender);
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
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
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } 
      else if (type === 'ice-candidate') {
        const pc = peersRef.current.get(sender);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => console.error("Error adding ice candidate:", e));
      }
      else if (type === 'request-connection') {
        if (isLiveRef.current && isHost) initiateCall(sender);
      }
      else if (type === 'toggle-live') {
        setIsLive(data.isLive);
        if (!data.isLive) stopLive(false); // Stop live but don't broadcast back
      }
    });

    // 4. Subscribe and track presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ 
          uid: user.uid, 
          name: user.displayName, 
          photoURL: user.photoURL,
          isHost,
          isReady: false, // Default state
          joinedAt: new Date().toISOString()
        });
      }
    });

    return () => {
      channel.unsubscribe();
      peersRef.current.forEach(pc => pc.close());
      localStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [roomId, user, isHost]); // Added isHost to deps

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

  const createPeerConnection = (targetUserId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
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
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.warn(`ICE connection failed for ${targetUserId}. Attempting reconnect...`);
        if (isLiveRef.current && isHost) {
          setTimeout(() => initiateCall(targetUserId), 2000);
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
  };

  const initiateCall = async (targetUserId: string) => {
    const pc = createPeerConnection(targetUserId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    channelRef.current?.send({
      type: 'broadcast',
      event: 'webrtc_signaling',
      payload: { type: 'offer', target: targetUserId, sender: user.uid, data: { sdp: offer } }
    });
  };

  const startLive = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setIsLive(true);
      
      // Notify everyone room is live
      channelRef.current?.send({
        type: 'broadcast',
        event: 'webrtc_signaling',
        payload: { type: 'toggle-live', target: '*', sender: user.uid, data: { isLive: true } }
      });

      // Initiate calls to all currently active users
      activeUsers.forEach(u => {
        if (u.uid !== user.uid) initiateCall(u.uid);
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setIsLive(true);
      
      // Ask host to connect to us
      channelRef.current?.send({
        type: 'broadcast',
        event: 'webrtc_signaling',
        payload: { type: 'request-connection', target: '*', sender: user.uid, data: {} }
      });
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  return { 
    isLive, 
    startLive, 
    stopLive, 
    joinLive, 
    remoteStreams, 
    activeUsers, 
    updatePresence 
  } as {
    isLive: boolean;
    startLive: () => Promise<void>;
    stopLive: (broadcast?: boolean) => void;
    joinLive: () => Promise<void>;
    remoteStreams: Map<string, MediaStream>;
    activeUsers: any[];
    updatePresence: (metadata: any) => Promise<void>;
  };
}
