// ======================================================
//  Nexus Stream — HLS.js Player
// ======================================================

// Stream source — HLS (no DRM)
// Encoded at runtime to prevent simple scraping
const _E_URL = 'aHR0cHM6Ly9hbWcwMTI2OS1hbWcwMTI2OWMxLXNwb3J0c3RyaWJhbC1lbWVhLTUyMDQucGxheW91dHMubm93LmFtYWdpLnR2L3BsYXlsaXN0L2FtZzAxMjY5LXdpbGxvd3R2ZmFzdC13aWxsb3dwbHVzLXNwb3J0c3RyaWJhbGVtZWEvcGxheWxpc3QubTN1OA==';
const STREAM_URL = atob(_E_URL);

const MAX_RETRIES = 15;
const RETRY_DELAY_MS = 5000;
const LOAD_TIMEOUT_MS = 30000;

// ── DOM Refs ─────────────────────────────────────────
const video = document.getElementById('player');
const offlineBanner = document.getElementById('offline-banner');

let hls = null;
let retryCount = 0;
let loadTimer = null;
let retryTimer = null;

// ── HLS Init ─────────────────────────────────────────
function initHls() {
    if (!Hls.isSupported()) {
        // Fallback: try native HLS (Safari)
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = STREAM_URL;
            video.addEventListener('loadedmetadata', () => video.play().catch(() => { }));
        } else {
            showPlayerError('HLS not supported in this browser. Try Chrome or Edge.');
        }
        return;
    }

    // Destroy existing instance if any
    if (hls) {
        hls.destroy();
        hls = null;
    }

    hls = new Hls({
        maxBufferLength: 20,      // Buffer up to 20s ahead
        maxMaxBufferLength: 30,
        liveSyncDurationCount: 3,    // Stay 3 segments behind live edge
        liveMaxLatencyDurationCount: 6,
        levelLoadingMaxRetry: 10,
        fragLoadingMaxRetry: 10,
        manifestLoadingMaxRetry: 10,
        levelLoadingRetryDelay: 500,
        fragLoadingRetryDelay: 500,
        manifestLoadingRetryDelay: 500,
        xhrSetup: function (xhr) {
            xhr.withCredentials = false;
        }
    });

    hls.loadSource(STREAM_URL);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[NexusStream] Manifest loaded — starting playback.');
        clearTimeout(loadTimer);
        retryCount = 0;

        video.muted = true;
        video.play().catch(() => { });
        // Unmute on first click
        document.addEventListener('click', () => {
            video.muted = false;
            video.play().catch(() => { });
        }, { once: true });
    });

    hls.on(Hls.Events.LEVEL_UPDATED, (_, data) => {
        // Update bitrate stat in sidebar
        const level = hls.levels[hls.currentLevel];
        if (level) {
            const bsStat = document.getElementById('bitrate-stat');
            const resStat = document.getElementById('res-stat');
            if (bsStat) bsStat.textContent = level.bitrate ? Math.round(level.bitrate / 1000) + ' kbps' : 'Auto';
            if (resStat) resStat.textContent = level.height ? level.height + 'p' : '--';
        }
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
        console.warn('[NexusStream] HLS error:', data.type, data.details, 'fatal:', data.fatal);
        if (data.fatal) {
            switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                    console.warn('[NexusStream] Network error — trying to recover...');
                    hls.startLoad();
                    scheduleRetry();
                    break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                    console.warn('[NexusStream] Media error — recovering...');
                    hls.recoverMediaError();
                    break;
                default:
                    console.error('[NexusStream] Unrecoverable error — reinitializing...');
                    scheduleRetry();
                    break;
            }
        }
    });

    // Load timeout guard
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => {
        console.warn('[NexusStream] Load timeout — retrying...');
        scheduleRetry();
    }, LOAD_TIMEOUT_MS);
}

// ── Retry ─────────────────────────────────────────────
function scheduleRetry() {
    clearTimeout(retryTimer);
    retryCount++;

    if (retryCount > MAX_RETRIES) {
        console.warn('[NexusStream] Max retries hit — reloading page.');
        location.reload();
        return;
    }

    console.log(`[NexusStream] Retry ${retryCount}/${MAX_RETRIES} in ${RETRY_DELAY_MS / 1000}s...`);
    retryTimer = setTimeout(initHls, RETRY_DELAY_MS);
}

// ── Watchdog ──────────────────────────────────────────
function startWatchdog() {
    let lastTime = 0;
    let frozenCount = 0;
    let stallCount = 0;

    setInterval(() => {
        if (!video) return;

        const currentTime = video.currentTime;
        const isBuffering = video.readyState < 3;
        const isPlaying = !video.paused && !video.ended;
        const timeAdvanced = currentTime !== lastTime;

        if (isPlaying) {
            if (timeAdvanced) {
                frozenCount = 0;
                stallCount = 0;
            } else if (isBuffering) {
                stallCount++;
                console.log(`[NexusStream] Buffering... (${stallCount * 5}s)`);
                if (stallCount >= 12) {  // 60s of buffering
                    console.warn('[NexusStream] Buffering > 60s — retrying stream.');
                    stallCount = 0;
                    initHls();
                }
            } else {
                frozenCount++;
                console.warn(`[NexusStream] Stream frozen (${frozenCount * 5}s)`);
                if (frozenCount >= 4) {  // 20s frozen
                    console.warn('[NexusStream] Stream frozen 20s — reloading page.');
                    location.reload();
                }
            }
        }

        lastTime = currentTime;
    }, 5000);
}

// ── Error Overlay ──────────────────────────────────────
function showPlayerError(msg) {
    const container = document.getElementById('player-container');
    if (!container) return;
    container.innerHTML = `
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
            justify-content:center;background:#0a0a0f;color:#fff;font-family:Outfit,sans-serif;gap:12px;">
            <svg width="48" height="48" fill="none" stroke="#7c3aed" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p style="font-size:0.95rem;color:#a0a0b0;text-align:center;max-width:280px;">${msg}</p>
        </div>`;
}

// ── Offline / Online ──────────────────────────────────
window.addEventListener('offline', () => {
    if (offlineBanner) offlineBanner.style.display = 'block';
    if (hls) hls.stopLoad();
});
window.addEventListener('online', () => {
    if (offlineBanner) offlineBanner.style.display = 'none';
    initHls();
});

// ── Tab Visibility ────────────────────────────────────
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (navigator.onLine && video.paused) {
            video.play().catch(() => { });
        }
    }
});

// ── Audio Boost ───────────────────────────────────────
let audioCtx = null;
let gainNode = null;
let boostActive = false;

function toggleAudioBoost() {
    const btn = document.getElementById('btn-audio-boost');
    const status = document.getElementById('audio-enhancement-status');

    if (!audioCtx && video) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            gainNode = audioCtx.createGain();
            const src = audioCtx.createMediaElementSource(video);
            src.connect(gainNode);
            gainNode.connect(audioCtx.destination);
        } catch (e) {
            console.warn('[NexusStream] Audio boost unavailable:', e);
        }
    }

    boostActive = !boostActive;
    if (gainNode) gainNode.gain.value = boostActive ? 2.0 : 1.0;

    if (btn) {
        btn.classList.toggle('active', boostActive);
        btn.textContent = boostActive ? 'Disable Audio Boost' : 'Enable Audio Boost';
    }
    if (status) {
        status.textContent = boostActive ? '🔊 Boosted (+6dB)' : 'Standard Audio';
        status.style.color = boostActive ? 'var(--accent)' : 'var(--text-secondary)';
    }
}

// ── Ad Refresh ────────────────────────────────────────
function initAdRefresh() {
    setInterval(() => {
        document.querySelectorAll('.adsterra-container').forEach(container => {
            const content = container.innerHTML;
            container.innerHTML = '';
            setTimeout(() => {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = content;
                Array.from(tempDiv.childNodes).forEach(node => {
                    if (node.tagName && node.tagName.toLowerCase() === 'script') {
                        const s = document.createElement('script');
                        Array.from(node.attributes).forEach(a => s.setAttribute(a.name, a.value));
                        s.textContent = node.textContent;
                        container.appendChild(s);
                    } else {
                        container.appendChild(node.cloneNode(true));
                    }
                });
            }, 50);
        });
        console.log('[NexusStream] Ads refreshed.');
    }, 300000);
}

// ── Boot ──────────────────────────────────────────────
if (!navigator.onLine) {
    showPlayerError('No internet connection. Please check your network.');
} else {
    initHls();
    startWatchdog();
}
initAdRefresh();
