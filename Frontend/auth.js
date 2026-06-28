/**
 * Auth Guard - Protects all pages behind a session login.
 * Include this script at the TOP of every protected page (before other scripts).
 * Uses sessionStorage so the session expires when the browser tab/window is closed.
 */
(function () {
    const isAuthenticated = sessionStorage.getItem('stitch_auth') === 'true';
    const isLoginPage = window.location.pathname.endsWith('login.html');

    if (!isAuthenticated && !isLoginPage) {
        // Redirect to login, preserving the intended destination
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        window.location.replace('login.html?redirect=' + encodeURIComponent(currentPage));
    }
})();

/**
 * Logout utility – call from any page to end the session.
 */
function cerrarSesion() {
    sessionStorage.removeItem('stitch_auth');
    sessionStorage.removeItem('stitch_user');
    window.location.replace('login.html');
}
