"use client";

import React, { useEffect, useRef } from "react";

interface VoiceVisualizerProps {
    isActive: boolean;
    isAgentSpeaking: boolean;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    baseX: number;
    baseY: number;
}

export function VoiceVisualizer({ isActive, isAgentSpeaking }: VoiceVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | undefined>(undefined);
    const particlesRef = useRef<Particle[]>([]);

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

                initParticles();
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

    const initParticles = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const particles: Particle[] = [];
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const count = 100;

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 50 + 20;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2 + 1,
                color: Math.random() > 0.5 ? "#6366f1" : "#8b5cf6", // Indigo or Violet
                baseX: x,
                baseY: y
            });
        }
        particlesRef.current = particles;
    };

    const draw = () => {
        if (!canvasRef.current || !analyserRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const render = () => {
            animationFrameRef.current = requestAnimationFrame(render);

            // Get audio data
            if (isAgentSpeaking) {
                // Simulate smooth wave for agent
                const time = Date.now() * 0.002;
                for (let i = 0; i < bufferLength; i++) {
                    dataArray[i] = 100 + Math.sin(time + i * 0.1) * 50;
                }
            } else {
                analyserRef.current!.getByteFrequencyData(dataArray);
            }

            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;
            const energy = Math.max(average / 255, 0.1); // 0.1 to 1.0

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw particles
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            particlesRef.current.forEach((p, i) => {
                // Move particles based on energy
                const angle = Math.atan2(p.y - centerY, p.x - centerX);
                const dist = Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2));

                // Expansion force
                const targetDist = 50 + energy * 100 + Math.sin(Date.now() * 0.001 + i) * 20;
                const force = (targetDist - dist) * 0.05;

                p.vx += Math.cos(angle) * force;
                p.vy += Math.sin(angle) * force;

                // Damping
                p.vx *= 0.9;
                p.vy *= 0.9;

                p.x += p.vx;
                p.y += p.vy;

                // Draw
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * (1 + energy), 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = 0.6 + energy * 0.4;
                ctx.fill();

                // Connect lines if close
                particlesRef.current.forEach((p2, j) => {
                    if (i === j) return;
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const d = Math.sqrt(dx * dx + dy * dy);

                    if (d < 40) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = p.color;
                        ctx.globalAlpha = (1 - d / 40) * 0.3 * energy;
                        ctx.stroke();
                    }
                });
            });

            // Center Glow
            const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 100 * energy);
            gradient.addColorStop(0, "rgba(99, 102, 241, 0.2)");
            gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = gradient;
            ctx.globalAlpha = 1;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
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
        </div>
    );
}
