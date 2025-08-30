'use client';

import React, { useEffect, useRef, useState } from 'react';

export function SimpleCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('initializing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initCamera = async () => {
      console.log('SimpleCamera: Starting...');
      try {
        // Simple camera request - no constraints
        console.log('SimpleCamera: Requesting basic camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        
        console.log('SimpleCamera: Got stream with tracks:', stream.getVideoTracks().map(t => t.label));
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          console.log('SimpleCamera: Video playing');
          setStatus('active');
        }
      } catch (err) {
        console.error('SimpleCamera: Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to access camera');
        setStatus('error');
      }
    };

    initCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  if (status === 'error') {
    return (
      <div className="w-full h-full bg-red-100 flex items-center justify-center">
        <div className="text-center p-4">
          <p className="text-red-600 font-semibold">Camera Error</p>
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (status === 'initializing') {
    return (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-white">Starting simple camera...</p>
        </div>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-cover"
      playsInline
      muted
      autoPlay
    />
  );
}