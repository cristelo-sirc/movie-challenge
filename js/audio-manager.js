/**
 * Audio Manager - Synthesized UI Sounds via Web Audio API
 * No external audio files needed - all sounds generated programmatically
 */

const AudioManager = (function () {
    'use strict';

    let audioContext = null;
    let isEnabled = true;
    let isInitialized = false;

    /**
     * Initialize AudioContext (must be called after user interaction)
     */
    function init() {
        if (isInitialized) return;

        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // iOS Safari: Resume immediately after user gesture
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

            // Play a silent buffer to fully unlock audio on iOS
            const silentBuffer = audioContext.createBuffer(1, 1, 22050);
            const source = audioContext.createBufferSource();
            source.buffer = silentBuffer;
            source.connect(audioContext.destination);
            source.start(0);

            isInitialized = true;
            console.log('Audio initialized successfully');
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
            isEnabled = false;
        }
    }

    /**
     * Ensure audio is ready (call before playing)
     */
    function ensureReady() {
        if (!audioContext) {
            init();
        }
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }

    /**
     * Resume audio context (required for mobile browsers)
     */
    function resume() {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }

    /**
     * Toggle audio on/off
     */
    function toggle() {
        isEnabled = !isEnabled;
        return isEnabled;
    }

    /**
     * Create a simple oscillator sound
     */
    function playTone(frequency, duration, type = 'sine', volume = 0.3) {
        if (!isEnabled) return;
        ensureReady();
        if (!audioContext) return;

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

        // Quick attack, smooth decay
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    }

    /**
     * Create noise burst (for whoosh effects)
     */
    function playNoise(duration, volume = 0.15) {
        if (!isEnabled) return;
        ensureReady();
        if (!audioContext) return;

        const bufferSize = audioContext.sampleRate * duration;
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }

        const noise = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();

        noise.buffer = buffer;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, audioContext.currentTime);

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioContext.destination);

        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

        noise.start();
    }

    // ===== Public Sound Effects =====

    /**
     * Swipe Right - "Seen" sound (happy ding)
     */
    function playSeenSound() {
        if (!isEnabled || !audioContext) return;

        // Pleasant ascending chord
        playTone(523, 0.15, 'sine', 0.25);  // C5
        setTimeout(() => playTone(659, 0.15, 'sine', 0.2), 50);  // E5
        setTimeout(() => playTone(784, 0.2, 'sine', 0.15), 100); // G5
    }

    /**
     * Swipe Left - "Haven't Seen" sound (soft thud)
     */
    function playSkipSound() {
        if (!isEnabled || !audioContext) return;

        // Low thump with noise
        playTone(120, 0.12, 'sine', 0.3);
        playNoise(0.08, 0.1);
    }

    /**
     * Undo sound (rewind effect)
     */
    function playUndoSound() {
        if (!isEnabled || !audioContext) return;

        // Quick descending sweep
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.15);

        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.15);
    }

    /**
     * Decade transition fanfare
     */
    function playDecadeTransition() {
        if (!isEnabled || !audioContext) return;

        // Ascending arpeggio
        const notes = [262, 330, 392, 523]; // C4, E4, G4, C5
        notes.forEach((freq, i) => {
            setTimeout(() => playTone(freq, 0.2, 'triangle', 0.2), i * 80);
        });
    }

    /**
     * Milestone celebration (longer, more elaborate)
     */
    function playMilestoneSound() {
        if (!isEnabled || !audioContext) return;

        // Victory fanfare
        const melody = [
            { freq: 392, delay: 0 },     // G4
            { freq: 392, delay: 150 },   // G4
            { freq: 392, delay: 300 },   // G4
            { freq: 523, delay: 450 },   // C5
            { freq: 659, delay: 700 },   // E5
            { freq: 784, delay: 900 },   // G5
        ];

        melody.forEach(note => {
            setTimeout(() => playTone(note.freq, 0.25, 'triangle', 0.2), note.delay);
        });
    }

    /**
     * Streak increment sound
     */
    function playStreakSound(streakCount) {
        if (!isEnabled || !audioContext) return;

        // Higher pitch for higher streaks
        const baseFreq = 400 + (streakCount * 50);
        playTone(Math.min(baseFreq, 1200), 0.1, 'sine', 0.2);
    }

    // Public API
    return {
        init,
        resume,
        toggle,
        isEnabled: () => isEnabled,
        playSeenSound,
        playSkipSound,
        playUndoSound,
        playDecadeTransition,
        playMilestoneSound,
        playStreakSound
    };
})();
