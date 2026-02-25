const welcomeMessage = "> SECURE TERMINAL v3.14.159 // Enter credentials to proceed...";

// ── Health-check polling ──────────────────────────────────────────────────────
const PING_URL = 'http://localhost:12410/api/Ping';
const PING_INTERVAL = 15000; // 15 s

function applyPingStatus(state, label) {
    const indicator = document.getElementById('statusIndicator');
    const statusLabel = document.getElementById('statusLabel');
    if (!indicator || !statusLabel) return;

    indicator.classList.remove('status--ready', 'status--not-ready', 'status--not-live');
    indicator.classList.add(`status--${state}`);
    statusLabel.textContent = label;
}

async function checkPingStatus() {
    try {
        const res = await fetch(PING_URL, {
            method: 'GET',
            headers: { 'accept': '*/*' },
            signal: AbortSignal.timeout(5000)
        });

        if (res.ok) {
            const data = await res.json();
            const s = (data.status || '').toLowerCase();
            if (s === 'alive' || s === 'ready') {
                applyPingStatus('ready', 'SYSTEM READY');
            } else {
                applyPingStatus('not-ready', 'SYSTEM NOT READY');
            }
        } else {
            applyPingStatus('not-ready', 'SYSTEM NOT READY');
        }
    } catch {
        applyPingStatus('not-live', 'SYSTEM OFFLINE');
    }
}

checkPingStatus();
let pingIntervalId = setInterval(checkPingStatus, PING_INTERVAL);

function setHealthMonitoring(enabled) {
    if (enabled) {
        if (!pingIntervalId) {
            checkPingStatus();
            pingIntervalId = setInterval(checkPingStatus, PING_INTERVAL);
        }
    } else {
        clearInterval(pingIntervalId);
        pingIntervalId = null;
        const indicator = document.getElementById('statusIndicator');
        const label = document.getElementById('statusLabel');
        if (indicator) indicator.classList.remove('status--ready', 'status--not-ready', 'status--not-live');
        if (label) label.textContent = 'MONITORING OFF';
    }
}
// ─────────────────────────────────────────────────────────────────────────────

// Typing Animation
function typeText(element, text, speed = 50) {
    let i = 0;
    const cursor = document.getElementById('cursor');

    return new Promise((resolve) => {
        const timer = setInterval(() => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
            } else {
                clearInterval(timer);
                if (cursor) cursor.style.display = 'none';
                resolve();
            }
        }, speed);
    });
}

// Update Timestamp
function updateTimestamp() {
    const timestampElement = document.getElementById('timestamp');
    const statusTimestampElement = document.getElementById('statusTimestamp');
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeString = `${hours}:${minutes}:${seconds}`;

    if (timestampElement) {
        timestampElement.textContent = timeString;
    }
    if (statusTimestampElement) {
        statusTimestampElement.textContent = timeString;
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
    // Start timestamp
    updateTimestamp();
    setInterval(updateTimestamp, 1000);

    // Type welcome message
    await new Promise(resolve => setTimeout(resolve, 800));
    const welcomeText = document.getElementById('welcomeText');
    await typeText(welcomeText, welcomeMessage, 30);

    // Focus password field after typing animation completes
    const pwd = document.getElementById('password');
    if (pwd) pwd.focus();
});

// Form Handling
const loginForm = document.getElementById('loginContainer');
const loginBtn = document.getElementById('loginBtn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

loginBtn.addEventListener('click', handleLogin);

// Allow Enter key to submit
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') passwordInput.focus();
});

passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
});

function handleLogin() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        showError('All fields required');
        return;
    }

    // Add loading state
    document.body.classList.add('loading');
    loginBtn.textContent = 'ACCESSING...';

    // Call .NET backend API
    fetch('http://localhost:12410/api/Login', {
        method: 'POST',
        headers: {
            'accept': '*/*',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username: username,
            password: password
        })
    })
    .then(response => {
        if (!response.ok) {
            // Handle authentication failure
            if (response.status === 401 || response.status === 403) {
                throw new Error('INVALID_CREDENTIALS');
            }
            // Handle server errors
            if (response.status >= 500) {
                throw new Error('SERVER_ERROR');
            }
            // Handle other errors
            throw new Error('REQUEST_FAILED');
        }
        return response.json();
    })
    .then(data => {
        document.body.classList.remove('loading');
        loginBtn.textContent = 'INITIALIZE';

        console.log('Login successful:', data);

        // Store token if needed
        if (data.token) {
            localStorage.setItem('authToken', data.token);
        }

        showSuccess('ACCESS GRANTED');

        // Show toolbar and hide login form after short delay
        setTimeout(() => {
            document.querySelector('.terminal-output').style.display = 'none';
            loginForm.style.display = 'none';
            document.getElementById('toolbar').style.display = 'flex';
            document.querySelector('.container').classList.add('expanded');
            document.body.style.alignItems = 'stretch';
            document.body.style.justifyContent = 'stretch';

            // Update status bar with username
            const statusMessage = document.getElementById('statusMessage');
            if (statusMessage && data.user) {
                statusMessage.textContent = `Welcome, ${data.user.username}`;
            }

            // Reset form
            usernameInput.value = '';
            passwordInput.value = '';
        }, 1500);
    })
    .catch(error => {
        document.body.classList.remove('loading');
        loginBtn.textContent = 'INITIALIZE';
        console.error('Login error:', error);

        // Show specific error messages based on error type
        if (error.message === 'INVALID_CREDENTIALS') {
            showError('Invalid username or password');
        } else if (error.message === 'SERVER_ERROR') {
            showError('Server error. Please try again later');
        } else if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
            showError('Cannot connect to server. Please check if the service is running');
        } else {
            showError('Login failed. Please try again');
        }
    });
}

// Social Login Handlers
const socialButtons = document.querySelectorAll('.btn-social');
socialButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const provider = btn.dataset.provider;
        handleSocialLogin(provider);
    });
});

function handleSocialLogin(provider) {
    console.log(`Social login attempt: ${provider}`);
    showSuccess(`Connecting to ${provider.toUpperCase()}...`);

    // In a real app, this would redirect to OAuth flow
    setTimeout(() => {
        console.log(`${provider} authentication flow would start here`);
    }, 1000);
}

// Notification System
function showError(message) {
    const notification = createNotification(message, 'error');
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 3000);
}

function showSuccess(message) {
    const notification = createNotification(message, 'success');
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 3000);
}

function createNotification(message, type) {
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? 'rgba(255, 51, 102, 0.9)' : 'rgba(0, 255, 0, 0.9)'};
        color: ${type === 'error' ? '#fff' : '#0a0e27'};
        padding: 15px 25px;
        border-radius: 4px;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 1px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    div.textContent = message;

    return div;
}

// Input Focus Effects
const inputs = document.querySelectorAll('input[type="text"], input[type="password"]');
inputs.forEach(input => {
    input.addEventListener('focus', function() {
        this.parentElement.style.transform = 'translateX(3px)';
        this.parentElement.style.transition = 'transform 0.2s ease';
    });

    input.addEventListener('blur', function() {
        this.parentElement.style.transform = 'translateX(0)';
    });
});

// Easter Egg: Konami Code
let konamiCode = [];
const konamiPattern = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

document.addEventListener('keydown', (e) => {
    konamiCode.push(e.key);
    konamiCode = konamiCode.slice(-10);

    if (konamiCode.join(',') === konamiPattern.join(',')) {
        activateMatrixMode();
    }
});

function activateMatrixMode() {
    const terminalWindow = document.querySelector('.terminal-window');
    terminalWindow.style.transition = 'all 0.5s ease';
    terminalWindow.style.borderColor = '#00ff00';

    // Flash effect
    let flashCount = 0;
    const flashInterval = setInterval(() => {
        terminalWindow.style.boxShadow = flashCount % 2 === 0
            ? '0 0 40px rgba(0, 255, 0, 0.8)'
            : '0 0 40px rgba(0, 255, 249, 0.2)';
        flashCount++;

        if (flashCount > 6) {
            clearInterval(flashInterval);
            terminalWindow.style.borderColor = 'var(--color-primary)';
            terminalWindow.style.boxShadow = '';
        }
    }, 200);

    showSuccess('MATRIX MODE ACTIVATED');
}

// Toolbar Button Handlers
document.addEventListener('DOMContentLoaded', () => {
    const homeBtn = document.getElementById('homeBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const helpBtn = document.getElementById('helpBtn');
    const gamesBtn = document.getElementById('gamesBtn');
    const footballBtn = document.getElementById('footballBtn');

    if (homeBtn) {
        homeBtn.addEventListener('click', () => { hidePanels(); });
    }

    if (footballBtn) {
        footballBtn.addEventListener('click', () => { showFootballPanel(); });
    }

    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', () => { hidePanels(); });
    }

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => { showSettingsPanel(); });
    }

    if (gamesBtn) {
        gamesBtn.addEventListener('click', () => { showGamesPanel(); });
    }

    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            console.log('Help clicked');
            document.getElementById('helpModal').style.display = 'flex';
        });
    }

    // Help Modal Close Button
    const closeHelpModal = document.getElementById('closeHelpModal');
    if (closeHelpModal) {
        closeHelpModal.addEventListener('click', () => {
            document.getElementById('helpModal').style.display = 'none';
        });
    }

    // Close modal when clicking overlay
    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
        helpModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                helpModal.style.display = 'none';
            }
        });
    }

    // Registration Modal Handlers
    const createAccountLink = document.getElementById('createAccountLink');
    const registerModal = document.getElementById('registerModal');
    const closeRegisterModal = document.getElementById('closeRegisterModal');

    if (createAccountLink) {
        createAccountLink.addEventListener('click', (e) => {
            e.preventDefault();
            registerModal.style.display = 'flex';
        });
    }

    if (closeRegisterModal) {
        closeRegisterModal.addEventListener('click', () => {
            registerModal.style.display = 'none';
        });
    }

    if (registerModal) {
        registerModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                registerModal.style.display = 'none';
            }
        });
    }

    // Registration Form Handler
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegistration);
    }
});

// Handle Registration
function handleRegistration(e) {
    e.preventDefault();

    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const firstName = document.getElementById('regFirstName').value.trim();
    const lastName = document.getElementById('regLastName').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const confirmPassword = document.getElementById('regConfirmPassword').value.trim();

    // Validate passwords match
    if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
    }

    // Validate password strength (optional)
    if (password.length < 6) {
        showError('Password must be at least 6 characters');
        return;
    }

    const registerBtn = document.getElementById('registerBtn');
    registerBtn.textContent = 'CREATING...';
    registerBtn.disabled = true;

    // Call registration API
    fetch('http://localhost:12410/api/User/account', {
        method: 'POST',
        headers: {
            'accept': '*/*',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username: username,
            password: password,
            email: email,
            firstName: firstName,
            lastName: lastName
        })
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 409) {
                throw new Error('USER_EXISTS');
            }
            if (response.status >= 500) {
                throw new Error('SERVER_ERROR');
            }
            throw new Error('REGISTRATION_FAILED');
        }
        return response.json();
    })
    .then(data => {
        registerBtn.textContent = 'CREATE ACCOUNT';
        registerBtn.disabled = false;

        console.log('Registration successful:', data);
        showSuccess('Account created successfully! Please login.');

        // Close modal and reset form
        setTimeout(() => {
            document.getElementById('registerModal').style.display = 'none';
            document.getElementById('registerForm').reset();
        }, 1500);
    })
    .catch(error => {
        registerBtn.textContent = 'CREATE ACCOUNT';
        registerBtn.disabled = false;

        console.error('Registration error:', error);

        if (error.message === 'USER_EXISTS') {
            showError('Username or email already exists');
        } else if (error.message === 'SERVER_ERROR') {
            showError('Server error. Please try again later');
        } else if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
            showError('Cannot connect to server. Please check if the service is running');
        } else {
            showError('Registration failed. Please try again');
        }
    });
}

// Glitch effect on random elements
setInterval(() => {
    if (Math.random() > 0.95) {
        const glitchElements = document.querySelectorAll('.terminal-window label, .ascii-art');
        const randomElement = glitchElements[Math.floor(Math.random() * glitchElements.length)];

        randomElement.style.animation = 'glitch-1 0.1s ease';
        setTimeout(() => {
            randomElement.style.animation = '';
        }, 100);
    }
}, 3000);

// ── Panel management ──────────────────────────────────────────────────────────
function showGamesPanel() {
    hideSettingsPanel();
    hideFootballPanel();
    document.getElementById('gamesPanel').style.display = 'flex';
    if (tttBoard.every(c => !c)) resetTtt();
    else renderTttBoard();
}

function hideGamesPanel() {
    document.getElementById('gamesPanel').style.display = 'none';
}

function showFootballPanel() {
    hideGamesPanel();
    hideSettingsPanel();
    document.getElementById('footballPanel').style.display = 'flex';
    loadFootballCountries();
}

function hideFootballPanel() {
    document.getElementById('footballPanel').style.display = 'none';
}

function showSettingsPanel() {
    hideGamesPanel();
    hideFootballPanel();
    document.getElementById('settingsPanel').style.display = 'flex';
}

function hideSettingsPanel() {
    document.getElementById('settingsPanel').style.display = 'none';
}

function hidePanels() {
    hideGamesPanel();
    hideSettingsPanel();
    hideFootballPanel();
}

// Game sidebar navigation
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.game-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.game-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            // Future games: swap visible .game-container here
        });
    });

    document.getElementById('tttReset')?.addEventListener('click', resetTtt);

    document.getElementById('healthToggle')?.addEventListener('change', e => {
        setHealthMonitoring(e.target.checked);
    });

    // Board click via event delegation
    document.getElementById('tttBoard')?.addEventListener('click', e => {
        const cell = e.target.closest('.ttt-cell');
        if (!cell || cell.classList.contains('taken') || !tttGameActive) return;
        handleTttMove(parseInt(cell.dataset.index));
    });

    // Football cascading dropdowns
    document.getElementById('countrySelect')?.addEventListener('change', async e => {
        clearStandings();
        hideRoundsTabBtn();
        currentSeasonId = null;
        await populateLeagueSelect(e.target.value);
        renderFootballContent();
    });
    document.getElementById('leagueSelect')?.addEventListener('change', async e => {
        clearStandings();
        hideRoundsTabBtn();
        currentSeasonId = null;
        await populateSeasonSelect(e.target.value);
        renderFootballContent();
    });
    document.getElementById('seasonSelect')?.addEventListener('change', async e => {
        renderFootballContent();
        if (e.target.value) {
            currentSeasonId = parseInt(e.target.value);
            currentRound = 1;
            document.getElementById('roundNumber').textContent = '1';
            document.getElementById('gamesContainer').innerHTML = '';
            selectedGame = null;
            await loadStandings(e.target.value);
            showRoundsTabBtn();
        } else {
            currentSeasonId = null;
            clearStandings();
            hideRoundsTabBtn();
        }
    });

    // Football tab buttons
    document.getElementById('tabBtnInfo')?.addEventListener('click', () => {
        switchFootballTab('info');
    });
    document.getElementById('tabBtnRounds')?.addEventListener('click', e => {
        if (e.target.id === 'closeRoundsTabBtn' || e.target.closest('#closeRoundsTabBtn')) return;
        switchFootballTab('rounds');
        if (currentSeasonId) loadGames(currentSeasonId, currentRound);
    });
    document.getElementById('closeRoundsTabBtn')?.addEventListener('click', e => {
        e.stopPropagation();
        switchFootballTab('info');
    });
    document.getElementById('tabBtnMatches')?.addEventListener('click', () => {
        switchFootballTab('matches');
    });

    document.getElementById('saveMatchesBtn')?.addEventListener('click', saveMatchesToFile);
    document.getElementById('loadMatchesBtn')?.addEventListener('click', () => {
        document.getElementById('loadMatchesInput').click();
    });
    document.getElementById('loadMatchesInput')?.addEventListener('change', e => {
        if (e.target.files[0]) loadMatchesFromFile(e.target.files[0]);
        e.target.value = '';
    });

    // Round navigation
    document.getElementById('roundPrevBtn')?.addEventListener('click', () => {
        if (currentRound <= 1 || !currentSeasonId) return;
        currentRound--;
        document.getElementById('roundNumber').textContent = currentRound;
        loadGames(currentSeasonId, currentRound);
    });
    document.getElementById('roundNextBtn')?.addEventListener('click', () => {
        if (!currentSeasonId) return;
        currentRound++;
        document.getElementById('roundNumber').textContent = currentRound;
        loadGames(currentSeasonId, currentRound);
    });
});

// ── Tic-Tac-Toe (human = X, computer = O) ────────────────────────────────────
let tttBoard = Array(9).fill('');
let tttHumanTurn = true;   // false while computer is "thinking"
let tttGameActive = true;

const TTT_WIN_PATTERNS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function renderTttBoard() {
    const boardEl = document.getElementById('tttBoard');
    if (!boardEl) return;
    boardEl.innerHTML = '';
    tttBoard.forEach((val, i) => {
        const cell = document.createElement('div');
        cell.className = 'ttt-cell' + (val ? ` taken ${val.toLowerCase()}` : '');
        cell.dataset.index = i;
        cell.textContent = val;
        boardEl.appendChild(cell);
    });
}

function handleTttMove(idx) {
    if (tttBoard[idx] || !tttGameActive || !tttHumanTurn) return;

    // Human plays X
    tttBoard[idx] = 'X';
    renderTttBoard();

    const winPattern = checkTttWin();
    if (winPattern) {
        highlightTttWin(winPattern);
        setTttStatus('YOU WIN!', 'var(--color-primary)');
        tttGameActive = false;
        return;
    }
    if (tttBoard.every(c => c)) {
        setTttStatus('DRAW — NO WINNER', 'var(--color-text-dim)');
        tttGameActive = false;
        return;
    }

    // Computer's turn
    tttHumanTurn = false;
    setTttStatus('COMPUTING...', 'var(--color-secondary)');

    setTimeout(() => {
        if (!tttGameActive) return;

        const move = getBestMove(tttBoard.slice());
        tttBoard[move] = 'O';
        renderTttBoard();

        const compWin = checkTttWin();
        if (compWin) {
            highlightTttWin(compWin);
            setTttStatus('COMPUTER WINS!', 'var(--color-secondary)');
            tttGameActive = false;
        } else if (tttBoard.every(c => c)) {
            setTttStatus('DRAW — NO WINNER', 'var(--color-text-dim)');
            tttGameActive = false;
        } else {
            tttHumanTurn = true;
            setTttStatus('YOUR TURN (X)', 'var(--color-primary)');
        }
    }, 380);
}

// ── Minimax AI ────────────────────────────────────────────────────────────────
function getBestMove(board) {
    let bestScore = -Infinity;
    let bestMove = -1;
    for (let i = 0; i < 9; i++) {
        if (!board[i]) {
            board[i] = 'O';
            const score = minimax(board, 0, false);
            board[i] = '';
            if (score > bestScore) { bestScore = score; bestMove = i; }
        }
    }
    return bestMove;
}

function minimax(board, depth, isMaximizing) {
    const winner = winnerFrom(board);
    if (winner === 'O') return 10 - depth;
    if (winner === 'X') return depth - 10;
    if (board.every(c => c)) return 0;

    if (isMaximizing) {
        let best = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (!board[i]) {
                board[i] = 'O';
                best = Math.max(best, minimax(board, depth + 1, false));
                board[i] = '';
            }
        }
        return best;
    } else {
        let best = Infinity;
        for (let i = 0; i < 9; i++) {
            if (!board[i]) {
                board[i] = 'X';
                best = Math.min(best, minimax(board, depth + 1, true));
                board[i] = '';
            }
        }
        return best;
    }
}

function winnerFrom(board) {
    for (const [a, b, c] of TTT_WIN_PATTERNS) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return null;
}
// ─────────────────────────────────────────────────────────────────────────────

function checkTttWin() {
    for (const [a, b, c] of TTT_WIN_PATTERNS) {
        if (tttBoard[a] && tttBoard[a] === tttBoard[b] && tttBoard[a] === tttBoard[c])
            return [a, b, c];
    }
    return null;
}

function highlightTttWin(pattern) {
    const cells = document.querySelectorAll('.ttt-cell');
    pattern.forEach(i => cells[i].classList.add('win-cell'));
}

function setTttStatus(text, color = 'var(--color-primary)') {
    const el = document.getElementById('tttStatus');
    if (!el) return;
    el.textContent = text;
    el.style.color = color;
}

function resetTtt() {
    tttBoard = Array(9).fill('');
    tttHumanTurn = true;
    tttGameActive = true;
    setTttStatus('YOUR TURN (X)', 'var(--color-primary)');
    renderTttBoard();
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Football API ──────────────────────────────────────────────────────────────
const FOOTBALL_API_BASE = 'http://localhost:12410';
let footballCountries = [];
let countriesLoaded = false;

async function loadFootballCountries() {
    if (countriesLoaded) return;

    const select = document.getElementById('countrySelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- LOADING... --</option>';
    select.disabled = true;

    try {
        const res = await fetch(`${FOOTBALL_API_BASE}/api/Football/countries`, {
            headers: { 'accept': '*/*' }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        footballCountries = await res.json();

        select.innerHTML = '<option value="">-- Select Country --</option>';
        footballCountries.forEach(country => {
            const opt = document.createElement('option');
            opt.value = country.id;
            opt.textContent = country.name.toUpperCase();
            select.appendChild(opt);
        });
        countriesLoaded = true;
    } catch (err) {
        console.error('Failed to load countries:', err);
        select.innerHTML = '<option value="">-- ERROR LOADING --</option>';
        showError('Failed to load countries');
    } finally {
        select.disabled = false;
    }
}

let footballLeagues = [];
let footballSeasons = [];

async function populateLeagueSelect(countryId) {
    const leagueSelect = document.getElementById('leagueSelect');
    const seasonSelect = document.getElementById('seasonSelect');
    if (!leagueSelect || !seasonSelect) return;

    leagueSelect.innerHTML = '<option value="">-- Select League --</option>';
    leagueSelect.disabled = true;
    seasonSelect.innerHTML = '<option value="">-- Select Season --</option>';
    seasonSelect.disabled = true;
    footballLeagues = [];
    footballSeasons = [];

    if (!countryId) return;

    leagueSelect.innerHTML = '<option value="">-- LOADING... --</option>';

    try {
        const res = await fetch(`${FOOTBALL_API_BASE}/api/Football/countries/${countryId}/leagues`, {
            headers: { 'accept': '*/*' }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        footballLeagues = await res.json();

        leagueSelect.innerHTML = '<option value="">-- Select League --</option>';

        // Group by type: Leagues first, then Cups
        const groups = { League: [], Cup: [] };
        footballLeagues.forEach(l => {
            (groups[l.type] || (groups['Other'] = groups['Other'] || [])).push(l);
        });

        ['League', 'Cup'].forEach(type => {
            if (!groups[type]?.length) return;
            const group = document.createElement('optgroup');
            group.label = type === 'Cup' ? '── CUPS ──' : '── LEAGUES ──';
            groups[type].forEach(league => {
                const opt = document.createElement('option');
                opt.value = league.id;
                opt.textContent = league.name.toUpperCase();
                group.appendChild(opt);
            });
            leagueSelect.appendChild(group);
        });

        leagueSelect.disabled = false;
    } catch (err) {
        console.error('Failed to load leagues:', err);
        leagueSelect.innerHTML = '<option value="">-- ERROR LOADING --</option>';
        showError('Failed to load leagues');
    }
}

async function populateSeasonSelect(leagueId) {
    const seasonSelect = document.getElementById('seasonSelect');
    if (!seasonSelect) return;

    seasonSelect.innerHTML = '<option value="">-- Select Season --</option>';
    seasonSelect.disabled = true;
    footballSeasons = [];

    if (!leagueId) return;

    seasonSelect.innerHTML = '<option value="">-- LOADING... --</option>';

    try {
        const res = await fetch(`${FOOTBALL_API_BASE}/api/Football/leagues/${leagueId}/seasons`, {
            headers: { 'accept': '*/*' }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        footballSeasons = await res.json();

        seasonSelect.innerHTML = '<option value="">-- Select Season --</option>';
        footballSeasons.forEach(season => {
            const opt = document.createElement('option');
            opt.value = season.id;
            opt.textContent = season.isActive ? `${season.year} ★` : `${season.year}`;
            seasonSelect.appendChild(opt);
        });
        seasonSelect.disabled = false;
    } catch (err) {
        console.error('Failed to load seasons:', err);
        seasonSelect.innerHTML = '<option value="">-- ERROR LOADING --</option>';
        showError('Failed to load seasons');
    }
}

function renderFootballContent() {
    const container = document.getElementById('footballContent');
    if (!container) return;

    const countryId = parseInt(document.getElementById('countrySelect')?.value);
    const leagueValue = document.getElementById('leagueSelect')?.value;
    const seasonValue = document.getElementById('seasonSelect')?.value;

    if (!countryId) {
        container.innerHTML = '<div class="football-placeholder">SELECT A COUNTRY TO VIEW DETAILS</div>';
        return;
    }

    const country = footballCountries.find(c => c.id === countryId);
    if (!country) return;

    const leagueId = parseInt(leagueValue);
    const seasonId = parseInt(seasonValue);
    const league = footballLeagues.find(l => l.id === leagueId);
    const season = footballSeasons.find(s => s.id === seasonId);

    let html = '<div class="football-country-header">';
    if (country.flag) {
        html += `<img class="football-country-flag" src="${country.flag}" alt="${country.name} flag">`;
    }
    html += `<div class="football-country-name">${country.name.toUpperCase()}</div></div>`;

    html += '<div class="football-info">';

    if (country.code) {
        html += `
        <div class="football-info-row">
            <span class="football-info-label">CODE</span>
            <span class="football-info-value">${country.code}</span>
        </div>`;
    }

    if (league) {
        html += `
        <div class="football-info-row">
            <span class="football-info-label">LEAGUE</span>
            <span class="football-info-value football-info-league">`;
        if (league.logo) {
            html += `<img class="football-league-logo" src="${league.logo}" alt="${league.name}">`;
        }
        html += `${league.name.toUpperCase()}</span>
        </div>
        <div class="football-info-row">
            <span class="football-info-label">TYPE</span>
            <span class="football-info-value">${league.type.toUpperCase()}</span>
        </div>`;
    }

    if (season) {
        const start = new Date(season.start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const end   = new Date(season.end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        html += `
        <div class="football-info-row">
            <span class="football-info-label">SEASON</span>
            <span class="football-info-value">${season.year}${season.isActive ? ' ★' : ''}</span>
        </div>
        <div class="football-info-row">
            <span class="football-info-label">PERIOD</span>
            <span class="football-info-value">${start} → ${end}</span>
        </div>`;
    }

    html += '</div>';
    container.innerHTML = html;
}

// ── Football Rounds & Games ───────────────────────────────────────────────────
let currentSeasonId = null;
let currentRound = 1;
let selectedGames = [];   // accumulates { seasonId, teamHomeId, teamOutId, + display fields }

function showRoundsTabBtn() {
    const btn = document.getElementById('tabBtnRounds');
    if (btn) btn.style.display = '';
}

function hideRoundsTabBtn() {
    // Only navigate away from rounds tab if it's currently active
    const roundsPanel = document.getElementById('footballRoundsPanel');
    if (roundsPanel && roundsPanel.style.display !== 'none') switchFootballTab('info');
    const btn = document.getElementById('tabBtnRounds');
    if (btn) btn.style.display = 'none';
    currentRound = 1;
    const roundNum = document.getElementById('roundNumber');
    if (roundNum) roundNum.textContent = '1';
    const gc = document.getElementById('gamesContainer');
    if (gc) gc.innerHTML = '';
    // selectedGames intentionally NOT cleared — matches list persists
}

function switchFootballTab(tabName) {
    const panels = {
        info:    document.getElementById('footballContent'),
        rounds:  document.getElementById('footballRoundsPanel'),
        matches: document.getElementById('footballMatchesPanel'),
    };
    const tabs = {
        info:    document.getElementById('tabBtnInfo'),
        rounds:  document.getElementById('tabBtnRounds'),
        matches: document.getElementById('tabBtnMatches'),
    };

    Object.values(panels).forEach(p => { if (p) p.style.display = 'none'; });
    Object.values(tabs).forEach(t => { if (t) t.classList.remove('active'); });

    if (panels[tabName]) panels[tabName].style.display = 'flex';
    if (tabs[tabName])   tabs[tabName].classList.add('active');

    if (tabName === 'matches') renderMatchesPanel();
}

function updateMatchesBadge() {
    const badge = document.getElementById('matchesBadge');
    if (!badge) return;
    if (selectedGames.length > 0) {
        badge.textContent = selectedGames.length;
        badge.style.display = 'inline';
    } else {
        badge.style.display = 'none';
    }
}

function renderMatchesPanel() {
    const container = document.getElementById('matchesContainer');
    if (!container) return;

    if (!selectedGames.length) {
        container.innerHTML = '<div class="football-placeholder">NO GAMES SELECTED</div>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'games-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th colspan="2">HOME</th>
                <th>FT</th>
                <th colspan="2">AWAY</th>
                <th>RND</th>
                <th></th>
            </tr>
        </thead>
        <tbody></tbody>`;

    const tbody = table.querySelector('tbody');
    selectedGames.forEach((game, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'game-row';
        tr.innerHTML = `
            <td><img class="game-team-logo" src="${game.homeTeamLogo}" alt=""></td>
            <td>${game.homeTeamName.toUpperCase()}</td>
            <td class="game-score">${game.homeFullTimeScore}-${game.outFullTimeScore}</td>
            <td>${game.awayTeamName.toUpperCase()}</td>
            <td><img class="game-team-logo" src="${game.awayTeamLogo}" alt=""></td>
            <td class="game-status">${game.round}</td>
            <td><button class="match-remove-btn" title="Remove">×</button></td>`;

        tr.querySelector('.match-remove-btn').addEventListener('click', e => {
            e.stopPropagation();
            removeSelectedGame(idx);
        });

        tbody.appendChild(tr);
    });

    container.innerHTML = '';
    container.appendChild(table);
}

function removeSelectedGame(idx) {
    selectedGames.splice(idx, 1);
    renderMatchesPanel();
    updateMatchesBadge();
    // Refresh rounds view to un-highlight the removed game
    const roundsPanel = document.getElementById('footballRoundsPanel');
    if (roundsPanel && roundsPanel.style.display !== 'none' && currentSeasonId) {
        loadGames(currentSeasonId, currentRound);
    }
}

// ── Matches file save / load ──────────────────────────────────────────────────
function saveMatchesToFile() {
    if (!selectedGames.length) {
        showError('NO GAMES TO SAVE');
        return;
    }
    const blob = new Blob([JSON.stringify(selectedGames, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'matches.json';
    a.click();
    URL.revokeObjectURL(url);
    showSuccess('MATCHES SAVED');
}

function loadMatchesFromFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) throw new Error('Invalid format');
            selectedGames = data;
            renderMatchesPanel();
            updateMatchesBadge();
            showSuccess(`LOADED ${data.length} MATCH${data.length !== 1 ? 'ES' : ''}`);
        } catch {
            showError('INVALID FILE FORMAT');
        }
    };
    reader.readAsText(file);
}

async function loadGames(seasonId, round) {
    const container = document.getElementById('gamesContainer');
    const prevBtn   = document.getElementById('roundPrevBtn');
    const nextBtn   = document.getElementById('roundNextBtn');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:30px;letter-spacing:2px;color:var(--color-text-dim)">LOADING...</div>';
    if (prevBtn) prevBtn.disabled = round <= 1;
    if (nextBtn) nextBtn.disabled = false;

    try {
        const res = await fetch(`${FOOTBALL_API_BASE}/api/Football/seasons/${seasonId}/rounds/${round}/games`, {
            headers: { 'accept': '*/*' }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const games = await res.json();

        if (!games.length) {
            container.innerHTML = '<div style="text-align:center;padding:30px;letter-spacing:2px;color:var(--color-text-dim)">NO GAMES</div>';
            if (nextBtn) nextBtn.disabled = true;
            return;
        }

        const table = document.createElement('table');
        table.className = 'games-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th colspan="2">HOME</th>
                    <th>HT</th>
                    <th>FT</th>
                    <th colspan="2">AWAY</th>
                    <th></th>
                </tr>
            </thead>
            <tbody></tbody>`;

        const tbody = table.querySelector('tbody');
        games.forEach(game => {
            const tr = document.createElement('tr');
            tr.className = 'game-row';

            const alreadySelected = selectedGames.some(g =>
                g.seasonId   === seasonId &&
                g.teamHomeId === game.teamIdHome &&
                g.teamOutId  === game.teamIdOut);
            if (alreadySelected) tr.classList.add('selected');

            tr.innerHTML = `
                <td><img class="game-team-logo" src="${game.homeTeamLogo}" alt=""></td>
                <td>${game.homeTeamName.toUpperCase()}</td>
                <td class="game-score-ht">${game.homeHalfTimeScore}-${game.outHalfTimeScore}</td>
                <td class="game-score">${game.homeFullTimeScore}-${game.outFullTimeScore}</td>
                <td>${game.awayTeamName.toUpperCase()}</td>
                <td><img class="game-team-logo" src="${game.awayTeamLogo}" alt=""></td>
                <td class="game-status">${game.status}</td>`;

            tr.addEventListener('click', () => {
                const existingIdx = selectedGames.findIndex(g =>
                    g.seasonId   === seasonId &&
                    g.teamHomeId === game.teamIdHome &&
                    g.teamOutId  === game.teamIdOut);

                if (existingIdx >= 0) {
                    // Toggle off — remove from list
                    selectedGames.splice(existingIdx, 1);
                    tr.classList.remove('selected');
                } else {
                    // Toggle on — add to list
                    selectedGames.push({
                        seasonId,
                        teamHomeId:        game.teamIdHome,
                        teamOutId:         game.teamIdOut,
                        homeTeamName:      game.homeTeamName,
                        awayTeamName:      game.awayTeamName,
                        homeTeamLogo:      game.homeTeamLogo,
                        awayTeamLogo:      game.awayTeamLogo,
                        homeFullTimeScore: game.homeFullTimeScore,
                        outFullTimeScore:  game.outFullTimeScore,
                        round:             game.round
                    });
                    tr.classList.add('selected');
                }

                updateMatchesBadge();
                console.log('selectedGames:', selectedGames);
            });

            tbody.appendChild(tr);
        });

        container.innerHTML = '';
        container.appendChild(table);
    } catch (err) {
        console.error('Failed to load games:', err);
        container.innerHTML = '<div style="text-align:center;padding:30px;letter-spacing:2px;color:var(--color-secondary)">ERROR</div>';
        showError('Failed to load games');
    }
}
// ─────────────────────────────────────────────────────────────────────────────

function clearStandings() {
    const tbody = document.getElementById('footballTableBody');
    if (tbody) tbody.innerHTML = '';
}

async function loadStandings(seasonId) {
    const tbody = document.getElementById('footballTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;letter-spacing:2px;color:var(--color-text-dim)">LOADING...</td></tr>';

    try {
        const res = await fetch(`${FOOTBALL_API_BASE}/api/Football/seasons/${seasonId}/standings`, {
            headers: { 'accept': '*/*' }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const rows = await res.json();

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;letter-spacing:2px;color:var(--color-text-dim)">NO DATA</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        rows.forEach(row => {
            const tr = document.createElement('tr');
            const wins   = (row.winHome  || 0) + (row.winOut  || 0);
            const draws  = (row.drawHome || 0) + (row.drawOut || 0);
            const losses = (row.lossHome || 0) + (row.lossOut || 0);
            tr.innerHTML = `
                <td>${row.position}</td>
                <td>${row.teamName}</td>
                <td>${wins}</td>
                <td>${draws}</td>
                <td>${losses}</td>
                <td>${row.points}</td>`;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Failed to load standings:', err);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;letter-spacing:2px;color:var(--color-secondary)">ERROR</td></tr>';
        showError('Failed to load standings');
    }
}
// ─────────────────────────────────────────────────────────────────────────────
