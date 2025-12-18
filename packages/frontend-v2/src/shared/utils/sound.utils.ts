// Classe utilitária para gerar efeitos sonoros usando Web Audio API
class SoundManager {
    private ctx: AudioContext | null = null;
    private isMuted: boolean = false;

    constructor() {
        // Inicializar contexto de áudio apenas na interação do usuário
        try {
            const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        } catch (e) {
            console.error('Web Audio API não suportada');
        }
    }

    private init() {
        if (!this.ctx) {
            const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    public toggleMute() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    }

    // Som de Giro (Ruído mecânico / Tictictic)
    public playSpin() {
        if (this.isMuted || !this.ctx) return;
        this.init();

        const oscillator = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(100, this.ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        oscillator.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        oscillator.start();
        oscillator.stop(this.ctx.currentTime + 0.1);
    }

    // Som de Vitória (Arpejo)
    public playWin() {
        if (this.isMuted || !this.ctx) return;
        this.init();

        const now = this.ctx.currentTime;

        // Notas: C4, E4, G4, C5 (Dó Maior)
        const notes = [261.63, 329.63, 392.00, 523.25, 523.25, 523.25];

        notes.forEach((freq, i) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();

            osc.type = i === notes.length - 1 ? 'square' : 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);

            gain.gain.setValueAtTime(0, now + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.1, now + i * 0.1 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);

            osc.connect(gain);
            gain.connect(this.ctx!.destination);

            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
        });
    }

    // Som de Moeda (Insert Coin)
    public playCoin() {
        if (this.isMuted || !this.ctx) return;
        this.init();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(1500, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    // Som de Jackpot (Mais longo e vibrante)
    public playJackpot() {
        if (this.isMuted || !this.ctx) return;
        this.init();

        const now = this.ctx.currentTime;
        // Sequência rápida
        for (let i = 0; i < 10; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200 + (i * 50), now + i * 0.1);
            gain.gain.setValueAtTime(0.1, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.1);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.1);
        }
    }

    // Som de Erro (Buzzer)
    public playError() {
        if (this.isMuted || !this.ctx) return;
        this.init();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.3);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }
}

export const soundManager = new SoundManager();
