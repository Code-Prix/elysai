"use client";

import React, { useEffect, useRef } from "react";

interface VoiceVisualizerProps {
    isActive: boolean;
    isAgentSpeaking: boolean;
}

export function VoiceVisualizer({ isActive, isAgentSpeaking }: VoiceVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (!isActive) return;

        const initAudio = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                if (!audioContextRef.current) {
                    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                }

                const ctx = audioContextRef.current;
                analyserRef.current = ctx.createAnalyser();
                analyserRef.current.fftSize = 256;

                sourceRef.current = ctx.createMediaStreamSource(stream);
                sourceRef.current.connect(analyserRef.current);

                draw();
            } catch (err) {
                console.error("Error accessing microphone:", err);
            }
        };

        initAudio();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (sourceRef.current) {
                sourceRef.current.disconnect();
            }
            if (audioContextRef.current) {
                void audioContextRef.current.close();
                audioContextRef.current = null;
            }
        };
    }, [isActive]);

    const draw = () => {
        if (!canvasRef.current || !analyserRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const render = () => {
            animationFrameRef.current = requestAnimationFrame(render);

            // If agent is speaking, we simulate a waveform since we can't easily capture the output stream
            // If user is speaking (or silence), we use the mic input
            if (isAgentSpeaking) {
                // Simulate active waveform for agent
                for (let i = 0; i < bufferLength; i++) {
                    dataArray[i] = 128 + Math.sin(Date.now() * 0.01 + i * 0.1) * 50 + Math.random() * 30;
                }
            } else {
                analyserRef.current!.getByteFrequencyData(dataArray);
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const radius = 50; // Base radius of the circle

            // Create gradient
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
            gradient.addColorStop(0, "#10A37F"); // Green
            gradient.addColorStop(0.5, "#00C2FF"); // Cyan
            gradient.addColorStop(1, "#10A37F"); // Green

            ctx.lineWidth = 2;
            ctx.strokeStyle = gradient;
            ctx.lineCap = "round";

            // Draw mirrored waveform
            ctx.beginPath();

            const bars = 60; // Number of bars
            const step = Math.PI * 2 / bars;

            for (let i = 0; i < bars; i++) {
                // Map frequency data to bars
                // We use a subset of the frequency data (low to mid freqs) for better visuals
                const dataIndex = Math.floor((i / bars) * (bufferLength / 2));
                const value = dataArray[dataIndex] || 0;

                // Scale value for visual impact
                // If idle (low value), keep it small
                const scale = Math.max(value / 255, 0.1);
                const barHeight = scale * 100;

                const angle = i * step;

                // Inner point (on the circle)
                const x1 = centerX + Math.cos(angle) * radius;
                const y1 = centerY + Math.sin(angle) * radius;

                // Outer point (extending out)
                const x2 = centerX + Math.cos(angle) * (radius + barHeight);
                const y2 = centerY + Math.sin(angle) * (radius + barHeight);

                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
            }

            ctx.stroke();

            // Draw inner glow
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius - 5, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(16, 163, 127, 0.1)";
            ctx.fill();
        };

        render();
    };

    return (
        <div className="relative w-full h-64 flex items-center justify-center">
            <canvas
                ref={canvasRef}
                width={600}
                height={400}
                className="w-full h-full max-w-2xl"
            />
            {/* Fallback/Overlay for aesthetic */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className={`w-32 h-32 rounded-full bg-gradient-to-r from-[#10A37F] to-[#00C2FF] opacity-10 blur-3xl transition-opacity duration-500 ${isActive ? "opacity-20" : "opacity-0"}`} />
            </div>
        </div>
    );
}
