"use client";

import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { useGameAudio } from '@/hooks/useGameAudio';

interface GameState {
    fuel: number;
    isAlive: boolean;
    lastUpdate: number;
}

export default function GameCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const stateRef = useRef<GameState>({
        fuel: 1800,
        isAlive: true,
        lastUpdate: Date.now()
    });

    // Audio handles drone/fire sound
    const { initAudio, updateAudio } = useGameAudio(); // We need to update this hook too

    const [isFeeding, setIsFeeding] = useState(false);

    useEffect(() => {
        const socket = io();
        socketRef.current = socket;

        socket.on('gameState', (data: GameState) => {
            stateRef.current = data;
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    // Feeding Loop
    useEffect(() => {
        if (!isFeeding) return;

        const interval = setInterval(() => {
            if (socketRef.current) {
                socketRef.current.emit('feed');
            }
        }, 100); // 10 times a second

        return () => clearInterval(interval);
    }, [isFeeding]);

    // Input Handling
    useEffect(() => {
        const startFeed = () => {
            initAudio();
            setIsFeeding(true);
        };
        const stopFeed = () => setIsFeeding(false);

        window.addEventListener('mousedown', startFeed);
        window.addEventListener('mouseup', stopFeed);
        window.addEventListener('touchstart', startFeed);
        window.addEventListener('touchend', stopFeed);

        return () => {
            window.removeEventListener('mousedown', startFeed);
            window.removeEventListener('mouseup', stopFeed);
            window.removeEventListener('touchstart', startFeed);
            window.removeEventListener('touchend', stopFeed);
        };
    }, []);

    // Flame Rendering
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        let animationId: number;
        let t = 0;
        let currentFeedFlux = 0;

        const render = () => {
            t += 0.1;
            const { fuel, isAlive } = stateRef.current;
            const width = canvas.width;
            const height = canvas.height;

            // Background
            ctx.fillStyle = '#111'; // Not pitch black, slight charcoal
            ctx.fillRect(0, 0, width, height);

            if (!isAlive && fuel <= 0) {
                ctx.fillStyle = '#fff';
                ctx.font = '24px serif';
                ctx.textAlign = 'center';
                ctx.fillText("The light has faded.", width / 2, height / 2);
                return;
            }

            // Calculate Flame Size based on Fuel (Scaled to 60%)
            const maxFuel = 3600;
            const fuelPercent = Math.min(fuel / maxFuel, 1);

            // Feeding Feedback (Smooth transition)
            // If feeding, target is 1.0, else 0.0
            const targetFeedFlux = isFeeding ? 1.0 : 0.0;
            // Simple lerp: current = current + (target - current) * 0.1
            // We store current flux in a ref or persistent variable outside render? 
            // We can capture it in a closure variable if we use a ref for it.
            // Let's use a Mutable Ref for animation state to avoid re-renders or closure staleness issues if we were using state.
            // But here 'render' is defined inside useEffect, so we need a persistent variable.
            // Let's add `feedFluxRef` at top.

            // (Self-correction: I can't add a ref in this replace block effectively if I don't replace the whole component body or use a wider range. 
            // I will use a local variable `currentFeedFlux` initialized outside the loop but I need it to persist across frames. 
            // The `render` function is defined INSIDE useEffect, so a variable `let currentFeedFlux = 0;` defined before `const render = ...` works perfectly.)

            // Update Flux
            currentFeedFlux += (targetFeedFlux - currentFeedFlux) * 0.1;

            // Apply Flux to Size: up to +80% size
            const boost = 1.0 + (currentFeedFlux * 0.8); // 1.0 to 1.8x

            // Base Flame
            const centerX = width / 2;
            const centerY = height / 2 + 100; // Lower half

            // Flame Logic (Simple layered circles moving up)
            // Fuel determines HEIGHT and WIDTH
            // Original: 100+300, 40+100
            // New (0.6x): 60+180, 24+60
            // Applied Boost
            const flameHeight = (60 + (fuelPercent * 180)) * boost;
            const flameWidth = (24 + (fuelPercent * 60)) * boost;

            // Update Audio
            updateAudio(fuel, maxFuel); // We could pass feeding state here for sound change too

            ctx.globalCompositeOperation = 'screen'; // Additive blending for glow

            // Draw multiple layers
            const count = 20;
            for (let i = 0; i < count; i++) {
                const p = i / count;

                // Wiggle
                const frequency = 0.2;
                const magnitude = (1 - p) * 20 + (fuelPercent * 10);
                const offset = Math.sin(t + p * 10) * magnitude * Math.sin(t * 0.5);

                const y = centerY - (p * flameHeight);
                const x = centerX + offset;

                const radius = (1 - p) * flameWidth * (0.8 + Math.sin(t * 2 + p) * 0.1);

                // Color: Center is white/yellow, Outer is red/orange/blue
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);

                if (p < 0.2) {
                    // Bottom: Blueish
                    gradient.addColorStop(0, 'rgba(50, 50, 255, 0.5)');
                    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                } else {
                    // Main: Orange/Yellow
                    gradient.addColorStop(0, `rgba(255, ${200 - p * 100}, 50, ${0.8 - p * 0.5})`);
                    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                }

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // Text Info (Subtle)
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';

            const minutes = Math.floor(fuel / 60);
            const seconds = Math.floor(fuel % 60);
            ctx.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, centerX, height - 50);

            animationId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="block touch-none cursor-pointer"
        />
    );
}
