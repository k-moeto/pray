import { useEffect, useRef } from 'react';

export function useGameAudio() {
    const audioCtxRef = useRef<AudioContext | null>(null);
    const masterGainRef = useRef<GainNode | null>(null);
    const oscillatorsRef = useRef<OscillatorNode[]>([]);
    const isStartedRef = useRef(false);

    const initAudio = () => {
        if (isStartedRef.current) return;

        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;

        const ctx = new Ctx();
        audioCtxRef.current = ctx;

        // Master Chain
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0.0; // Start silent, fade in
        masterGain.connect(ctx.destination);
        masterGainRef.current = masterGain;

        // Fade in
        masterGain.gain.setTargetAtTime(0.4, ctx.currentTime, 5);

        // Reverb-ish Delay
        const delay = ctx.createDelay();
        delay.delayTime.value = 0.3; // 300ms
        const delayFeedback = ctx.createGain();
        delayFeedback.gain.value = 0.4;

        const delayFilter = ctx.createBiquadFilter();
        delayFilter.type = 'lowpass';
        delayFilter.frequency.value = 1000;

        delay.connect(delayFeedback);
        delayFeedback.connect(delayFilter);
        delayFilter.connect(delay);
        delay.connect(masterGain);

        // Mysterious Chord (Minor 9th ish or Open 5ths)
        // Frequencies: Low drone + High shimmer
        // Base: C2 (65.41Hz) -> G2 -> C3 -> Eb3 -> G3
        // Let's go for something ambiguous: D minor add 9. D2, A2, F3, E3
        const freqs = [73.42, 110.00, 174.61, 220.00, 329.63]; // D2, A2, F3, A3, E4

        freqs.forEach(f => {
            const osc = ctx.createOscillator();
            osc.type = Math.random() > 0.5 ? 'sine' : 'triangle';
            osc.frequency.value = f;

            // Slight detune for "chorus" effect
            osc.detune.value = (Math.random() - 0.5) * 20;

            // Individual Gain/Pan
            const oscGain = ctx.createGain();
            oscGain.gain.value = 0.1 / freqs.length;

            const panner = ctx.createStereoPanner();
            panner.pan.value = (Math.random() - 0.5) * 0.8;

            osc.connect(oscGain);
            oscGain.connect(panner);
            panner.connect(masterGain);
            panner.connect(delay); // Send to reverb

            osc.start();
            oscillatorsRef.current.push(osc);

            // LFO for movement
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.1 + Math.random() * 0.2; // Slow
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 2.0; // +/- 2Hz vibrato
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            lfo.start();
        });

        isStartedRef.current = true;
        console.log('Ambience Started');
    };

    const updateAudio = (fuel: number, maxFuel: number) => {
        if (!audioCtxRef.current) return;
        // Maybe change volume or filter based on fuel?
        // For now, keep it constant "Mysterious" as requested.
    };

    return { initAudio, updateAudio };
}
