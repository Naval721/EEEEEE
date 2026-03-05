// ======================================================
//  Nexus Stream — Main Script (Shaka Player + DRM)
// ======================================================

// Stream source — DASH MPD with ClearKey DRM
// Automatically decoded at runtime to prevent simple scraping
const _E_URL = 'aHR0cHM6Ly9vdHRlLmxpdmUuZmx5Lnd3LmFpdi1jZG4ubmV0L3Npbi1uaXRyby9saXZlL2NsaWVudHMvZGFzaC9lbmMvZWNwNnhpZGM1ZC9vdXQvdjEvYjhhOTQ2NzdjNTZlNDQxMWFlZjdlY2MyNDMxY2VjMGEvY2VuYy5tcGQ=';
const _E_KID = 'MGMxY2IzZTk1MTRkZGRkNzU4OTZhN2Y2MGEwM2RlY2I=';
const _E_KVAL = 'OTYzZmIxNzVmNzA3NjljOGQ1NmZjNDRjODQzODA4YjM=';

const STREAM_URL = atob(_E_URL);
const DRM_KEY_ID = atob(_E_KID);
const DRM_KEY_VAL = atob(_E_KVAL);

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
        showError(
            retryCount < MAX_RETRIES
                ? 'Stream is taking too long to respond. Retrying automatically…'
                : 'Stream unavailable. Check your connection and try again.'
        );
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
        drm: {
            clearKeys: {
                [DRM_KEY_ID]: DRM_KEY_VAL
            }
        },
        streaming: {
            bufferingGoal: 45,         // Safe buffer size
            rebufferingGoal: 5,        // Ensure solid download before resuming
            bufferBehind: 30,          // Keep some memory 
            lowLatencyMode: false,
            ignoreTextStreamFailures: true,
            alwaysStreamText: false,
            stallEnabled: true,
            stallThreshold: 2,         // Safe stall threshold 
            jumpLargeGaps: true,
            retryParameters: {
                maxAttempts: 10,       // Resilient fetching
                baseDelay: 1000,
                backoffFactor: 1.5,
                fuzzFactor: 0.3,
                timeout: 10000         // Stable timeout to prevent false connection failures
            }
        },
        manifest: {
            dash: {
                autoCorrectDrift: true,
                defaultPresentationDelay: 20 // Keep proper distance from live edge to avoid 404 chunks
            },
            retryParameters: {
                maxAttempts: 10,
                baseDelay: 1000,
                backoffFactor: 1.5,
                fuzzFactor: 0.3,
                timeout: 10000
            }
        },
        abr: {
            enabled: true,
            defaultBandwidthEstimate: 1500000, // 1.5 Mbps default
            switchInterval: 2,                 // Evaluate every 2s
            bandwidthUpgradeTarget: 0.85,
            bandwidthDowngradeTarget: 0.95
        }
    });

    try {
        await shakaPlayer.load(STREAM_URL);
        clearTimeout(loadTimer);
        retryCount = 0;

        // Ensure seamless autoplay and recovery
        video.muted = false; // Attempt to start unmuted
        video.play().catch((err) => {
            console.warn('[NexusStream] Playback rejected by browser:', err);
            // Fallback to muted playback so the stream starts without pausing
            video.muted = true;
            video.play().catch(() => { });
            // Unmute upon first user interaction
            document.addEventListener('click', () => {
                video.muted = false;
            }, { once: true });
        });
    } catch (e) {
        console.error('[NexusStream] Stream loading failed:', e);
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

        // Active Safeguard Watchdog: prevents indefinite freezing on long streams
        let lastTime = -1;
        let stalledCount = 0;
        let idleTime = 0;

        setInterval(() => {
            if (!video || !shakaPlayer) return;

            // Track if stream is paused or stuck completely
            if (video.paused || video.currentTime === lastTime) {
                idleTime += 5;
                if (idleTime >= 30) {
                    console.warn('[NexusStream] Stream paused or not working for 30s. Auto-reloading page...');
                    location.reload();
                    return;
                }
            } else {
                idleTime = 0;
            }

            if (video.paused) return;

            // Check if playhead is stuck
            if (video.currentTime === lastTime && video.readyState < 3) {
                stalledCount++;
                // If stuck buffering for ~15 seconds (3 checks of 5s)
                if (stalledCount >= 3) {
                    console.warn('[NexusStream] Deep stall detected over a long session. MPD may be stale. Executing hard soft-reboot of stream...');
                    stalledCount = 0;
                    retryStream(); // Actively restarts Shaka internals and fetches a fresh MPD manifest
                }
            } else {
                lastTime = video.currentTime;
                stalledCount = 0;

                // Drift detection: if we somehow slip far behind the live edge, catch up automatically
                const seekRange = shakaPlayer.seekRange();
                if (seekRange && shakaPlayer.isLive() && (seekRange.end - video.currentTime > 20)) {
                    console.warn('[NexusStream] Stream drifted too far behind live. Skipping forward to catch up.');
                    video.currentTime = seekRange.end - 5;
                }
            }
        }, 5000);

    } catch (e) {
        clearTimeout(loadTimer);
        console.error('[NexusStream] Init load failed:', e);
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
