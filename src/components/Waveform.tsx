import React, { useEffect, useRef, useState } from 'react';

export default function Waveform({ audioUrl, progress = 0 }: { audioUrl: string, progress?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[]>([]);

  useEffect(() => {
    const generateWaveform = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        
        const samples = 100;
        const blockSize = Math.floor(channelData.length / samples);
        const newPeaks = [];
        for (let i = 0; i < samples; i++) {
          let start = blockSize * i;
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[start + j]);
          }
          newPeaks.push(sum / blockSize);
        }
        
        const maxPeak = Math.max(...newPeaks);
        const normalizedPeaks = newPeaks.map(p => p / maxPeak);
        setPeaks(normalizedPeaks);
      } catch (error) {
        console.error("Error generating waveform:", error);
      }
    };
    generateWaveform();
  }, [audioUrl]);

  useEffect(() => {
    if (!canvasRef.current || peaks.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const barWidth = canvas.width / peaks.length;
    const barCount = peaks.length;

    peaks.forEach((peak, i) => {
      const barHeight = Math.max(2, peak * canvas.height); // min height 2px
      const x = i * barWidth;
      // Draw progress
      ctx.fillStyle = i < (progress / 100) * barCount ? '#10b981' : 'rgba(16, 185, 129, 0.2)'; // Emerald-500 or Emerald-500/20
      ctx.fillRect(x, Math.max(0, canvas.height - barHeight), barWidth - 2, Math.max(2, barHeight));
    });
  }, [peaks, progress]); // Added progress to dependencies

  return (
    <div className="w-full h-16 rounded-lg overflow-hidden relative flex items-center justify-center">
      {peaks.length === 0 ? (
        <span className="text-xs text-slate-400 animate-pulse">جاري تحليل الصوت...</span>
      ) : (
        <canvas
        ref={canvasRef}
        width={300}
        height={60}
        className="w-full h-full"
      />
      )}
    </div>
  );
}
