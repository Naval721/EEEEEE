// ==========================================
// Advanced Anti-Theft & Security Engine
// ==========================================

(function () {
    // 1. Frame Busting (Prevent embedding via iframe)
    if (window.top !== window.self) {
        window.top.location = window.self.location;
    }

    // 2. Disable Right Click Context Menu
    document.addEventListener('contextmenu', function (e) {
        e.preventDefault();
    }, false);

    // 3. Disable Keyboard Shortcuts (F12, Ctrl+Shift+I/J/C, Ctrl+U)
    document.addEventListener('keydown', function (e) {
        // F12
        if (e.key === 'F12' || e.keyCode === 123) {
            e.preventDefault();
            return false;
        }
        // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
            e.preventDefault();
            return false;
        }
        // Ctrl+U (View Source)
        if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
            e.preventDefault();
            return false;
        }
    });

    // 4. Disable Text Selection & Dragging globally
    document.addEventListener('selectstart', function (e) {
        e.preventDefault();
    });
    document.addEventListener('dragstart', function (e) {
        e.preventDefault();
    });

    // (Debugger trap removed as it breaks video stream in prod)

})();
