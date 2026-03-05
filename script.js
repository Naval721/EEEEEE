// ======================================================
//  Nexus Stream — Main Script (Shaka Player + DRM)
// ======================================================

// Stream source — HLS (no DRM)
// Encoded at runtime to prevent simple scraping
const _E_URL = 'aHR0cHM6Ly9ncmFuZC1zLXYwMDEuZmFnZ290c3BvcnRzLnR2L291dC92MS81Njk4MGYxNzQ1YThhZDE0NmE4YjRhNTFmOWVmN2ExOS9taXgtc3RyZWFtLm0zdTg=';

const STREAM_URL = atob(_E_URL);

const LOAD_TIMEOUT_MS = 25000;
const AUTO_RETRY_DELAY_MS = 5000;
const MAX_RETRIES = 15;

// ── DOM Refs ─────────────────────────────────────────
const videoContainer = document.querySelector('[data-shaka-player-container]');
const video = document.getElementById('player');
const loader = document.getElementById('stream-loader');
const errorBox = document.getElementById('stream-error');
const errorMsg = document.getElementById('stream-error-msg');
const countdown = document.getElementById('retry-countdown');
const offlineBanner = document.getElementById('offline-banner');

let shakaPlayer = null;
let loadTimer = null;
let autoRetryTimer = null;
let countdownTimer = null;
let retryCount = 0;

// ── Load Timer ───────────────────────────────────────
function startLoadTimer() {
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => {
        console.warn('[NexusStream] Load timeout — retrying...');
        retryStream();
    }, LOAD_TIMEOUT_MS);
}

// ── Retry ────────────────────────────────────────────
async function retryStream() {
    if (!navigator.onLine) {
        return;
    }
    clearAutoRetry();
    retryCount++;

    if (retryCount > MAX_RETRIES) {
        console.warn('[NexusStream] Max retries reached, hard refreshing page to recover stream...');
        location.reload(); // Force page refresh to totally fix the stuck player
        return;
    }

    startLoadTimer();

    try {
        if (shakaPlayer) {
            await shakaPlayer.unload();
            await new Promise(r => setTimeout(r, 1000)); // Sleep 1s before restarting cleanly
        }
        await loadStream();
    } catch (e) {
        console.warn('[NexusStream] Retry attempt failed:', e);
    }
}

function scheduleAutoRetry() {
    clearAutoRetry();
    if (retryCount >= MAX_RETRIES) { if (countdown) countdown.textContent = ''; return; }

    let remaining = Math.round(AUTO_RETRY_DELAY_MS / 1000);
    if (countdown) countdown.textContent = `Auto-retrying in ${remaining}s…`;

    countdownTimer = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            if (countdown) countdown.textContent = `Auto-retrying in ${remaining}s…`;
        } else {
            clearInterval(countdownTimer);
            if (countdown) countdown.textContent = '';
        }
    }, 1000);

    autoRetryTimer = setTimeout(retryStream, AUTO_RETRY_DELAY_MS);
}

function clearAutoRetry() {
    clearTimeout(autoRetryTimer);
    autoRetryTimer = null;
    clearCountdown();
}

function clearCountdown() {
    clearInterval(countdownTimer);
    countdownTimer = null;
    if (countdown) countdown.textContent = '';
}

// ── Error Messages ───────────────────────────────────
function friendlyError(e) {
    if (!e) return 'An unknown error occurred.';
    const code = e.code || (e.detail && e.detail.code);
    if (!navigator.onLine) return 'You are offline. Stream paused.';
    if (code === 1001) return 'Network request failed. Check your connection.';
    if (code === 1002) return 'Stream URL could not be reached.';
    if (code === 3016) return 'DRM license error. Stream may be encrypted.';
    if (code === 4000) return 'Stream format not supported by this browser.';
    if (code === 6008 || code === 6007) return 'Playback error. Retrying…';
    return `Stream error (code ${code || 'unknown'}). Retrying…`;
}

// ── Shaka Player Init ────────────────────────────────
async function loadStream() {
    clearTimeout(loadTimer);
    startLoadTimer();

    shakaPlayer.configure({
        streaming: {
            bufferingGoal: 12,
            rebufferingGoal: 2,
            bufferBehind: 30,
            lowLatencyMode: false,
            ignoreTextStreamFailures: true,
            stallEnabled: true,
            stallThreshold: 1,
            jumpLargeGaps: true,
            retryParameters: {
                maxAttempts: 10,
                baseDelay: 1000,
                backoffFactor: 1.5,
                fuzzFactor: 0.3,
                timeout: 15000
            }
        },
        manifest: {
            retryParameters: {
                maxAttempts: 10,
                baseDelay: 1000,
                backoffFactor: 1.5,
                fuzzFactor: 0.3,
                timeout: 15000
            }
        },
        abr: {
            enabled: true,
            defaultBandwidthEstimate: 2000000,
            switchInterval: 4,
            bandwidthUpgradeTarget: 0.85,
            bandwidthDowngradeTarget: 0.95
        }
    });

    // Strip Referer header so the CDN doesn't block segment requests
    shakaPlayer.getNetworkingEngine().registerRequestFilter((type, request) => {
        delete request.headers['Referer'];
        request.headers['Origin'] = '';
    });

    try {
        await shakaPlayer.load(STREAM_URL);
        clearTimeout(loadTimer);
        retryCount = 0;

        // Autoplay muted (required by browser policy) — unmute on first user interaction
        video.muted = true;
        video.play().catch(() => { });
        document.addEventListener('click', () => {
            video.muted = false;
            video.play().catch(() => { });
        }, { once: true });
    } catch (e) {
        console.error('[NexusStream] Stream loading failed:', e);
        retryStream();
    }
}

async function initPlayer() {
    shaka.polyfill.installAll();

    if (!shaka.Player.isBrowserSupported()) {
        showError('Your browser does not support this stream format. Try Chrome or Edge.');
        return;
    }

    // Get the auto-initialized UI from the video container
    const ui = videoContainer['ui'];

    if (ui) {
        const controls = ui.getControls();
        shakaPlayer = controls.getPlayer();

        // Initialize Shaka UI Overlay for added features (quality, fullscreen, etc.)
        ui.configure({
            controlPanelElements: [
                'play_pause',
                'time_and_duration',
                'spacer',
                'mute',
                'volume',
                'fullscreen',
                'quality'
            ]
        });
    } else {
        // Fallback if UI wasn't auto-attached
        shakaPlayer = new shaka.Player(video);
        const fbUi = new shaka.ui.Overlay(shakaPlayer, videoContainer, video);
        fbUi.configure({
            controlPanelElements: [
                'play_pause',
                'time_and_duration',
                'spacer',
                'mute',
                'volume',
                'fullscreen',
                'quality'
            ]
        });
    }

    // Player-level error handler for automatic recovery bounds
    shakaPlayer.addEventListener('error', (e) => {
        clearTimeout(loadTimer);
        if (e.detail && e.detail.severity === shaka.util.Error.Severity.CRITICAL) {
            console.error('[NexusStream] Critical error detected, stream crashed. Recovering via retryStream().', e.detail);
            retryStream(); // Immediately auto-recover instead of staying stuck
        } else {
            console.warn('[NexusStream] Non-critical Shaka error:', e.detail);
        }
    });

    try {
        await loadStream();

        // ── Watchdog: recovers from genuine freezes without false-triggering on buffering ──
        let lastTime = 0;
        let frozenCount = 0;   // counts 5s ticks where time didn't advance AND video is NOT buffering
        let stallCount = 0;    // counts 5s ticks where time didn't advance AND video IS buffering

        setInterval(() => {
            if (!video || !shakaPlayer) return;

            const currentTime = video.currentTime;
            const isBuffering = video.readyState < 3;   // HAVE_FUTURE_DATA = 3
            const isPlaying = !video.paused && !video.ended;
            const timeAdvanced = currentTime !== lastTime;

            if (isPlaying) {
                if (timeAdvanced) {
                    // ✅ Playing normally — reset all counters
                    frozenCount = 0;
                    stallCount = 0;

                    // Drift check: jump to live edge if too far behind
                    const seekRange = shakaPlayer.seekRange();
                    if (seekRange && shakaPlayer.isLive() && (seekRange.end - currentTime > 30)) {
                        console.warn('[NexusStream] Drifted > 30s behind live edge. Jumping forward.');
                        video.currentTime = seekRange.end - 3;
                    }
                } else if (isBuffering) {
                    // ⏳ Buffering (network slow) — give it time, but retry after 60s
                    stallCount++;
                    console.log(`[NexusStream] Buffering... (${stallCount * 5}s)`);
                    if (stallCount >= 12) {  // 60 seconds of buffering
                        console.warn('[NexusStream] Buffering > 60s — reloading stream manifest.');
                        stallCount = 0;
                        retryStream();
                    }
                } else {
                    // 🔴 Time not advancing, NOT buffering = genuinely frozen
                    frozenCount++;
                    console.warn(`[NexusStream] Stream frozen (${frozenCount * 5}s)`);
                    if (frozenCount >= 4) {  // 20 seconds frozen with no buffer
                        console.warn('[NexusStream] Stream frozen 20s — hard reloading page.');
                        location.reload();
                    }
                }
            }

            lastTime = currentTime;
        }, 5000);

    } catch (e) {
        clearTimeout(loadTimer);
        console.error('[NexusStream] Init load failed:', e);
        retryStream();
    }
}

// ── Offline / Online ─────────────────────────────────
window.addEventListener('offline', () => {
    if (offlineBanner) offlineBanner.style.display = 'block';
    clearAutoRetry();
    showError('You are offline. Stream paused — reconnect to resume.');
});

window.addEventListener('online', () => {
    if (offlineBanner) offlineBanner.style.display = 'none';
    retryStream();
});

// ── Tab Visibility ───────────────────────────────────
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (navigator.onLine && video.paused) {
            // Attempt auto-resume
            video.play().catch(() => { });
        }
    }
});

// ── Global Errors ────────────────────────────────────
window.addEventListener('error', (e) => {
    console.error('[NexusStream] Global JS error:', e.message, e);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('[NexusStream] Unhandled promise rejection:', e.reason);
});

// ── Boot ─────────────────────────────────────────────
document.addEventListener('shaka-ui-loaded', () => {
    if (!navigator.onLine) {
        showError('No internet connection detected. Please check your network.');
    } else {
        initPlayer();
    }
});

document.addEventListener('shaka-ui-load-failed', () => {
    showError('Failed to load video player components.');
});

// ── Audio Boost ──────────────────────────────────────
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

// ── Ad Refresh ───────────────────────────────────────
function initAdRefresh() {
    // Refresh ads every 5 minutes (300,000 ms)
    setInterval(() => {
        const adContainers = document.querySelectorAll('.adsterra-container');
        adContainers.forEach(container => {
            // To force ad scripts to re-execute, we have to detach and re-attach the script tags
            const content = container.innerHTML;
            container.innerHTML = '';

            // Allow DOM to clear, then re-insert to trigger script loading again
            setTimeout(() => {
                // We use document fragment approach if there are scripts, because innerHTML doesn't execute <script>
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = content;

                Array.from(tempDiv.childNodes).forEach(node => {
                    if (node.tagName && node.tagName.toLowerCase() === 'script') {
                        // Recreate script element to force browser to run it again
                        const newScript = document.createElement('script');
                        Array.from(node.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                        newScript.textContent = node.textContent;
                        container.appendChild(newScript);
                    } else {
                        container.appendChild(node.cloneNode(true));
                    }
                });
            }, 50);
        });
        console.log('[NexusStream] Ad placements automatically refreshed.');
    }, 300000); // 300,000 ms = 5 minutes
}

// Start watching for Ad refresh
initAdRefresh();
