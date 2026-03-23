const welcomeMessage = "> SECURE TERMINAL v3.14.159 // Enter credentials to proceed...";

// ── Server endpoint configuration ─────────────────────────────────────────────
const LOCAL_API_BASE  = 'http://localhost:12802';
const ACCESS_API_BASE = 'https://football-api.yosephhome.com';

// Reset to remote server on every page load; user can switch to local via Settings
localStorage.setItem('useLocalServer', 'false');

function getApiBase() {
    return localStorage.getItem('useLocalServer') === 'true' ? LOCAL_API_BASE : ACCESS_API_BASE;
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
function isTokenExpired() {
    const expiry = localStorage.getItem('authTokenExpiry');
    return expiry ? new Date() >= new Date(expiry) : false;
}

function handleUnauthorized() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authTokenExpiry');
    document.querySelector('.container')?.classList.remove('expanded');
    const toolbar = document.getElementById('toolbar');
    if (toolbar) toolbar.style.display = 'none';
    const termOut = document.querySelector('.terminal-output');
    if (termOut) termOut.style.display = '';
    const loginContainer = document.getElementById('loginContainer');
    if (loginContainer) loginContainer.style.display = '';
    try { hidePanels(); } catch {}
    showError('Session expired. Please log in again.');
}

async function apiFetch(url, options = {}) {
    if (isTokenExpired()) { handleUnauthorized(); throw new Error('UNAUTHORIZED'); }
    const token = localStorage.getItem('authToken');
    const headers = { ...(options.headers || {}) };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) { handleUnauthorized(); throw new Error('UNAUTHORIZED'); }
    return res;
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Health-check polling ──────────────────────────────────────────────────────
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
        const res = await fetch(getApiBase() + '/api/Ping', {
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

let pingIntervalId = null;
if (localStorage.getItem('healthMonitoring') !== 'false') {
    checkPingStatus();
    pingIntervalId = setInterval(checkPingStatus, PING_INTERVAL);
}

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
    fetch(getApiBase() + '/api/Login', {
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

        // Store token
        if (data.token) {
            localStorage.setItem('authToken', data.token);
            if (data.expiresAt) localStorage.setItem('authTokenExpiry', data.expiresAt);
        }

        showSuccess('ACCESS GRANTED');

        // Show toolbar and hide login form after short delay
        setTimeout(() => {
            document.querySelector('.terminal-output').style.display = 'none';
            loginForm.style.display = 'none';
            document.getElementById('toolbar').style.display = 'flex';
            document.querySelector('.container').classList.add('expanded');
            hidePanels();
            document.body.style.alignItems = 'stretch';
            document.body.style.justifyContent = 'stretch';
            document.body.style.height = '100vh';
            document.body.style.overflow = 'hidden';

            // Update status bar with username
            const statusMessage = document.getElementById('statusMessage');
            if (statusMessage) {
                statusMessage.textContent = `Welcome, ${username}`;
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
    const predictionsBtn = document.getElementById('predictionsBtn');
    const simulationsBtn = document.getElementById('simulationsBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const helpBtn = document.getElementById('helpBtn');

    if (homeBtn) {
        homeBtn.addEventListener('click', () => { hidePanels(); });
    }

    if (predictionsBtn) {
        predictionsBtn.addEventListener('click', () => { showFootballPanel(); });
    }

    if (simulationsBtn) {
        simulationsBtn.addEventListener('click', () => { showSimulationsPanel(); });
    }

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => { showSettingsPanel(); });
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
    fetch(getApiBase() + '/api/users', {
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
    hideSimulationsPanel();
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
    hideSimulationsPanel();
    document.getElementById('footballPanel').style.display = 'flex';
    loadFootballCountries();
}

function hideFootballPanel() {
    document.getElementById('footballPanel').style.display = 'none';
}

function showSimulationsPanel() {
    hideGamesPanel();
    hideFootballPanel();
    hideSettingsPanel();
    document.getElementById('simulationsPanel').style.display = 'flex';
    loadSimCountries();
}

function hideSimulationsPanel() {
    document.getElementById('simulationsPanel').style.display = 'none';
}

function showSettingsPanel() {
    hideGamesPanel();
    hideFootballPanel();
    hideSimulationsPanel();
    document.getElementById('settingsPanel').style.display = 'flex';
}

function hideSettingsPanel() {
    document.getElementById('settingsPanel').style.display = 'none';
}

function hidePanels() {
    hideGamesPanel();
    hideSettingsPanel();
    hideFootballPanel();
    hideSimulationsPanel();
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

    const healthToggle = document.getElementById('healthToggle');
    if (healthToggle) {
        healthToggle.checked = localStorage.getItem('healthMonitoring') !== 'false';
        healthToggle.addEventListener('change', e => {
            localStorage.setItem('healthMonitoring', e.target.checked);
            setHealthMonitoring(e.target.checked);
        });
    }

    const localServerToggle = document.getElementById('localServerToggle');
    if (localServerToggle) {
        localServerToggle.checked = localStorage.getItem('useLocalServer') === 'true';
        localServerToggle.addEventListener('change', e => {
            localStorage.setItem('useLocalServer', e.target.checked);
            checkPingStatus();
        });
    }

    const bestApproachesCount = document.getElementById('bestApproachesCount');
    if (bestApproachesCount) {
        const saved = localStorage.getItem('bestApproachesCount') ?? '5';
        bestApproachesCount.value = saved;
        bestApproachesCount.addEventListener('change', e => {
            localStorage.setItem('bestApproachesCount', e.target.value);
        });
    }

    loadWinner16Ids();

    const exportFileName = document.getElementById('exportFileName');
    if (exportFileName) {
        exportFileName.value = localStorage.getItem('exportFileName') ?? 'Winner16-{datetime}';
        exportFileName.addEventListener('change', e => {
            localStorage.setItem('exportFileName', e.target.value.trim() || 'Winner16-{datetime}');
        });
    }

    // Restore saved folder name in the read-only path field
    loadFolderHandle().then(handle => {
        if (handle) {
            const pathEl = document.getElementById('exportFolderPath');
            if (pathEl) pathEl.value = handle.name;
        }
    });

    document.getElementById('exportFolderBrowseBtn')?.addEventListener('click', async () => {
        if (!window.showDirectoryPicker) {
            showError('FOLDER PICKER NOT SUPPORTED IN THIS BROWSER');
            return;
        }
        try {
            const handle = await window.showDirectoryPicker({ mode: 'read' });
            await saveFolderHandle(handle);
            const pathEl = document.getElementById('exportFolderPath');
            if (pathEl) pathEl.value = handle.name;
            showSuccess('DEFAULT FOLDER SET');
        } catch (err) {
            if (err.name !== 'AbortError') showError('FOLDER SELECT FAILED');
        }
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
        clearSimulationPage();
        hideRoundsTabBtn();
        currentSeasonId = null;
        batchLastCountryId = null;
        updateCountryFavBtn(e.target.value);
        await populateLeagueSelect(e.target.value);
        renderFootballContent();
        loadBatchData();
    });

    // Favourites — country
    document.getElementById('countryFavBtn')?.addEventListener('click', () => {
        const sel = document.getElementById('countrySelect');
        if (!sel?.value) return;
        const id = String(sel.value);
        if (favCountries.has(id)) favCountries.delete(id); else favCountries.add(id);
        saveFavCountries();
        renderCountryOptions(sel);
    });
    document.getElementById('countryFavFilterBtn')?.addEventListener('click', e => {
        favCountriesOnly = !favCountriesOnly;
        e.currentTarget.classList.toggle('active', favCountriesOnly);
        const sel = document.getElementById('countrySelect');
        if (sel) renderCountryOptions(sel);
    });

    // Favourites — league
    document.getElementById('leagueFavBtn')?.addEventListener('click', () => {
        const sel = document.getElementById('leagueSelect');
        if (!sel?.value) return;
        const id = String(sel.value);
        if (favLeagues.has(id)) favLeagues.delete(id); else favLeagues.add(id);
        saveFavLeagues();
        renderLeagueOptions(sel);
    });
    document.getElementById('leagueFavFilterBtn')?.addEventListener('click', e => {
        favLeaguesOnly = !favLeaguesOnly;
        e.currentTarget.classList.toggle('active', favLeaguesOnly);
        const sel = document.getElementById('leagueSelect');
        if (sel) renderLeagueOptions(sel);
    });

    document.getElementById('leagueSelect')?.addEventListener('change', async e => {
        clearStandings();
        clearSimulationPage();
        hideRoundsTabBtn();
        currentSeasonId = null;
        updateLeagueFavBtn(e.target.value);
        await populateSeasonSelect(e.target.value);
        renderFootballContent();
    });
    document.getElementById('seasonSelect')?.addEventListener('change', async e => {
        clearSimulationPage();
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

    // Simulations cascading dropdowns
    document.getElementById('simCountrySelect')?.addEventListener('change', async e => {
        updateCountryFavBtn(e.target.value);
        await populateSimLeagueSelect(e.target.value);
    });

    // Favourites — sim country
    document.getElementById('simCountryFavBtn')?.addEventListener('click', () => {
        const sel = document.getElementById('simCountrySelect');
        if (!sel?.value) return;
        const id = String(sel.value);
        if (favCountries.has(id)) favCountries.delete(id); else favCountries.add(id);
        saveFavCountries();
        renderCountryOptions(sel);
    });
    document.getElementById('simCountryFavFilterBtn')?.addEventListener('click', e => {
        favCountriesOnly = !favCountriesOnly;
        e.currentTarget.classList.toggle('active', favCountriesOnly);
        const sel = document.getElementById('simCountrySelect');
        if (sel) renderCountryOptions(sel);
    });

    // Favourites — sim league
    document.getElementById('simLeagueFavBtn')?.addEventListener('click', () => {
        const sel = document.getElementById('simLeagueSelect');
        if (!sel?.value) return;
        const id = String(sel.value);
        if (favLeagues.has(id)) favLeagues.delete(id); else favLeagues.add(id);
        saveFavLeagues();
        const saved = footballLeagues;
        footballLeagues = simLeagues;
        renderLeagueOptions(sel);
        footballLeagues = saved;
    });
    document.getElementById('simLeagueFavFilterBtn')?.addEventListener('click', e => {
        favLeaguesOnly = !favLeaguesOnly;
        e.currentTarget.classList.toggle('active', favLeaguesOnly);
        const sel = document.getElementById('simLeagueSelect');
        if (sel) {
            const saved = footballLeagues;
            footballLeagues = simLeagues;
            renderLeagueOptions(sel);
            footballLeagues = saved;
        }
    });

    document.getElementById('simLeagueSelect')?.addEventListener('change', async e => {
        updateLeagueFavBtn(e.target.value);
        await populateSimSeasonSelect(e.target.value);
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

    document.getElementById('tabBtnApproaches')?.addEventListener('click', () => {
        switchFootballTab('approaches');
        loadApproachesTab();
    });
    document.getElementById('tabBtnSimulation')?.addEventListener('click', () => {
        switchFootballTab('simulation');
        loadSimulationApproaches();
        loadBatchData();
    });

    document.getElementById('simBatchLeaguesAll')?.addEventListener('click', () => setBatchCheckboxes('simBatchLeagueList', true));
    document.getElementById('simBatchLeaguesClear')?.addEventListener('click', () => setBatchCheckboxes('simBatchLeagueList', false));
    document.getElementById('simBatchSeasonsAll')?.addEventListener('click', () => setBatchCheckboxes('simBatchSeasonList', true));
    document.getElementById('simBatchSeasonsClear')?.addEventListener('click', () => setBatchCheckboxes('simBatchSeasonList', false));
    document.getElementById('simBatchApproachesAll')?.addEventListener('click', () => setBatchCheckboxes('simBatchApproachList', true));
    document.getElementById('simBatchApproachesClear')?.addEventListener('click', () => setBatchCheckboxes('simBatchApproachList', false));
    document.getElementById('tabBtnSimResults')?.addEventListener('click', () => {
        switchFootballTab('simResults');
        populateSimResultsApproachSelect();
    });
    document.getElementById('simRunBtn')?.addEventListener('click', runSimulation);
    document.getElementById('simSaveBtn')?.addEventListener('click', saveSimulationResults);
    document.getElementById('simRunAllBtn')?.addEventListener('click', runAllApproaches);
    document.getElementById('simCancelBtn')?.addEventListener('click', () => { runAllCancelled = true; });
    document.getElementById('simResultsLoadBtn')?.addEventListener('click', loadSavedSimulations);
    document.getElementById('simResultsDeleteBtn')?.addEventListener('click', deleteSimulationResults);

    document.getElementById('findSimilarBtn')?.addEventListener('click', findSimilarGames);
    document.getElementById('tabBtnSimilar')?.addEventListener('click', e => {
        if (e.target.id === 'closeSimilarTabBtn' || e.target.closest('#closeSimilarTabBtn')) return;
        switchFootballTab('similar');
    });
    document.getElementById('closeSimilarTabBtn')?.addEventListener('click', e => {
        e.stopPropagation();
        const tabBtn = document.getElementById('tabBtnSimilar');
        if (tabBtn) tabBtn.style.display = 'none';
        switchFootballTab('matches');
    });

    document.getElementById('predictGamesBtn')?.addEventListener('click', predictGames);
    document.getElementById('tabBtnPredict')?.addEventListener('click', e => {
        if (e.target.id === 'closePredictTabBtn' || e.target.closest('#closePredictTabBtn')) return;
        switchFootballTab('predict');
    });
    document.getElementById('closePredictTabBtn')?.addEventListener('click', e => {
        e.stopPropagation();
        const tabBtn = document.getElementById('tabBtnPredict');
        if (tabBtn) tabBtn.style.display = 'none';
        switchFootballTab('matches');
    });
    document.getElementById('tabBtnPredictFull')?.addEventListener('click', e => {
        if (e.target.id === 'closePredictFullTabBtn' || e.target.closest('#closePredictFullTabBtn')) return;
        switchFootballTab('predictFull');
    });
    document.getElementById('closePredictFullTabBtn')?.addEventListener('click', e => {
        e.stopPropagation();
        const tabBtn = document.getElementById('tabBtnPredictFull');
        if (tabBtn) tabBtn.style.display = 'none';
        switchFootballTab('matches');
    });

    // Football sidebar resizer
    (function() {
        const resizer  = document.getElementById('footballResizer');
        const sidebar  = resizer?.previousElementSibling;
        if (!resizer || !sidebar) return;

        let startX, startW;

        resizer.addEventListener('mousedown', e => {
            e.preventDefault();
            startX = e.clientX;
            startW = sidebar.getBoundingClientRect().width;
            resizer.classList.add('is-dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', e => {
            if (!resizer.classList.contains('is-dragging')) return;
            const delta = e.clientX - startX;
            const panel = sidebar.parentElement;
            const panelW = panel.getBoundingClientRect().width;
            const maxW = panelW * 0.7;
            const newW = Math.min(maxW, Math.max(160, startW + delta));
            sidebar.style.width = newW + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (!resizer.classList.contains('is-dragging')) return;
            resizer.classList.remove('is-dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        });
    })();

    // Simulation vertical resizer
    (function() {
        const resizer   = document.getElementById('simVResizer');
        const statusPane = document.getElementById('simStatusPane');
        if (!resizer || !statusPane) return;

        let startY, startH;

        resizer.addEventListener('mousedown', e => {
            e.preventDefault();
            startY = e.clientY;
            startH = statusPane.getBoundingClientRect().height;
            resizer.classList.add('is-dragging');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', e => {
            if (!resizer.classList.contains('is-dragging')) return;
            const delta = e.clientY - startY;
            const panel = statusPane.parentElement;
            const panelH = panel.getBoundingClientRect().height;
            const newH = Math.min(Math.max(startH + delta, 80), panelH - 120);
            statusPane.style.height = newH + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (!resizer.classList.contains('is-dragging')) return;
            resizer.classList.remove('is-dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        });
    })();

    document.getElementById('saveMatchesDbBtn')?.addEventListener('click', saveMatchesToDb);
    document.getElementById('loadMatchesDbBtn')?.addEventListener('click', loadMatchesFromDb);

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

    document.getElementById('roundClearBtn')?.addEventListener('click', () => {
        selectedGames.length = 0;
        updateMatchesBadge();
        // remove all dynamic inspection tabs and panels
        document.querySelectorAll('.dynamic-inspection-tab').forEach(t => t.remove());
        document.querySelectorAll('.dynamic-inspection-panel').forEach(p => p.remove());
        // deselect all game rows
        document.querySelectorAll('.game-row.selected').forEach(r => r.classList.remove('selected'));
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

// ── Approaches tab ────────────────────────────────────────────────────────────
async function loadApproachesTab() {
    const container = document.getElementById('approachesContainer');
    if (!container) return;
    container.innerHTML = '<div class="football-placeholder">LOADING...</div>';
    try {
        const res = await apiFetch(`${getApiBase()}/api/Prediction/approaches`, { headers: { 'accept': '*/*' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const approaches = await res.json();
        renderApproachesPanel(approaches);
    } catch (err) {
        container.innerHTML = `<div class="football-placeholder">ERROR: ${err.message}</div>`;
    }
}

function renderApproachesPanel(approaches) {
    const container = document.getElementById('approachesContainer');
    if (!container) return;

    const hasStats = approaches.some(a => a.accuracyRate != null);

    let html = `<table class="predict-table approaches-table">
        <thead>
            <tr>
                <th class="approaches-idx">#</th>
                <th class="approaches-name-header">NAME</th>
                ${hasStats ? `
                <th class="approaches-stat-header">ACCURACY</th>
                <th class="approaches-stat-header">CORRECT</th>
                <th class="approaches-stat-header">TOTAL</th>
                <th class="approaches-stat-header">AVG SCORE</th>` : ''}
            </tr>
        </thead>
        <tbody>`;

    approaches.forEach((a, i) => {
        const hasData = a.accuracyRate != null;
        const accuracy = hasData ? `${(a.accuracyRate * 100).toFixed(1)}%` : '—';
        const correct  = hasData ? a.correctPredictions : '—';
        const total    = hasData ? a.totalPredictions : '—';
        const avgScore = hasData ? a.averageSimulationScore?.toFixed(3) ?? '—' : '—';

        const accuracyCls = hasData
            ? (a.accuracyRate >= 0.5 ? 'approaches-stat--good' : a.accuracyRate >= 0.4 ? 'approaches-stat--mid' : 'approaches-stat--low')
            : '';

        html += `
        <tr class="predict-row approaches-row approaches-main-row" data-idx="${i}">
            <td class="predict-row-num">${a.index}</td>
            <td class="approaches-name">
                <span class="approaches-expand-btn" id="approaches-arrow-${i}">&#9654;</span>
                ${a.name.toUpperCase()}
            </td>
            ${hasStats ? `
            <td class="approaches-stat ${accuracyCls}">${accuracy}</td>
            <td class="approaches-stat">${correct}</td>
            <td class="approaches-stat">${total}</td>
            <td class="approaches-stat">${avgScore}</td>` : ''}
        </tr>
        <tr class="approaches-detail-row" id="approaches-detail-${i}" style="display:none">
            <td colspan="${hasStats ? 6 : 2}">
                <div class="approaches-detail-panel">
                    <div class="approaches-detail-section">
                        <span class="approaches-detail-label">DESCRIPTION</span>
                        <p class="approaches-detail-text">${a.description}</p>
                    </div>
                    <div class="approaches-detail-section">
                        <span class="approaches-detail-label">EXAMPLE</span>
                        <p class="approaches-detail-example">${a.example}</p>
                    </div>
                </div>
            </td>
        </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

    // Toggle expand on click
    container.querySelectorAll('.approaches-main-row').forEach(row => {
        row.addEventListener('click', () => {
            const idx = row.dataset.idx;
            const detail = document.getElementById(`approaches-detail-${idx}`);
            const btn = row.querySelector('.approaches-expand-btn');
            const open = detail.style.display !== 'none';
            detail.style.display = open ? 'none' : 'table-row';
            btn.innerHTML = open ? '&#9654;' : '&#9660;';
        });
    });
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Prediction API ────────────────────────────────────────────────────────────
let cachedApproaches = null;

async function loadPredictionApproaches() {
    if (cachedApproaches) return cachedApproaches;
    const res = await apiFetch(`${getApiBase()}/api/Prediction/approaches`, {
        headers: { 'accept': '*/*' }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    cachedApproaches = await res.json();
    return cachedApproaches;
}

async function loadBestPredictionApproaches() {
    const top = parseInt(localStorage.getItem('bestApproachesCount') ?? '5', 10);
    const allApproaches = await loadPredictionApproaches();
    if (top === 0) return allApproaches;
    const params = new URLSearchParams({ top });
    if (currentSeasonId) params.set('seasonId', currentSeasonId);
    const res = await apiFetch(`${getApiBase()}/api/Prediction/best-approaches?${params}`, {
        headers: { 'accept': '*/*' }
    });
    if (!res.ok) return allApproaches;
    const best = await res.json().catch(() => []);
    if (!best.length) return allApproaches;
    // Normalize: find each returned entry in allApproaches by index field (handles any field name variant)
    const indexSet = new Set(best.map(b => b.index ?? b.approachIndex ?? b.approach ?? b.id));
    const matched = allApproaches.filter(a => indexSet.has(a.index));
    return matched.length ? matched : allApproaches;
}

async function predictGames() {
    if (!selectedGames.length) {
        showError('NO GAMES SELECTED');
        return;
    }
    const btn = document.getElementById('predictGamesBtn');
    if (btn) { btn.textContent = '[ LOADING... ]'; btn.disabled = true; }

    try {
        console.log('[PREDICT] Fetching best approaches...');
        const approaches = await loadBestPredictionApproaches();
        console.log('[PREDICT] Best approaches:', approaches);

        const allPredictions = await Promise.all(
            selectedGames.map(game =>
                Promise.all(
                    approaches.map(async approach => {
                        const url = `${getApiBase()}/api/Prediction/predict?homeTeamId=${game.teamHomeId}&awayTeamId=${game.teamOutId}&seasonId=${game.seasonId}&round=${game.round}&approach=${approach.index}`;
                        console.log(`[PREDICT] Fetching: ${url}`);
                        try {
                            const r = await apiFetch(url, { headers: { 'accept': '*/*' } });
                            if (!r.ok) {
                                console.warn(`[PREDICT] HTTP ${r.status} for approach ${approach.index} (${approach.name}):`, await r.text().catch(() => ''));
                                return null;
                            }
                            const data = await r.json();
                            console.log(`[PREDICT] Result approach=${approach.index}:`, data);
                            return data;
                        } catch (fetchErr) {
                            console.error(`[PREDICT] Fetch error for approach ${approach.index}:`, fetchErr);
                            return null;
                        }
                    })
                )
            )
        );

        console.log('[PREDICT] All predictions:', allPredictions);
        renderPredictPanel(approaches, allPredictions);
        renderPredictFullPanel(approaches, allPredictions);
        const tabBtn = document.getElementById('tabBtnPredict');
        if (tabBtn) tabBtn.style.display = '';
        const tabBtnFull = document.getElementById('tabBtnPredictFull');
        if (tabBtnFull) tabBtnFull.style.display = '';
        switchFootballTab('predict');
    } catch (err) {
        showError('PREDICTION FAILED');
        console.error('[PREDICT] Caught error:', err);
    } finally {
        if (btn) { btn.textContent = '[ PREDICT GAMES ]'; btn.disabled = false; }
    }
}

function calcConsensus(approaches, gamePreds) {
    const votes = { '1': 0, 'X': 0, '2': 0 };
    let validCount = 0;
    approaches.forEach((_, ai) => {
        const pred = gamePreds[ai];
        if (!pred) return;
        const h = pred.homeWinProbability, d = pred.drawProbability, a = pred.awayWinProbability;
        if (pred.predictedResult == null && h == null && d == null && a == null) return;
        validCount++;
        const outcome = pred.predictedResult ?? (h >= d && h >= a ? '1' : d >= a ? 'X' : '2');
        votes[outcome]++;
    });
    if (validCount === 0) return { outcome: '?', votes, conflict: true };
    const max = Math.max(votes['1'], votes['X'], votes['2']);
    const winners = Object.entries(votes).filter(([, v]) => v === max);
    const conflict = winners.length > 1;
    return { outcome: conflict ? '~' : winners[0][0], votes, conflict };
}

function renderPredictPanel(approaches, allPredictions) {
    const container = document.getElementById('predictContainer');
    if (!container) return;

    if (!selectedGames.length) {
        container.innerHTML = '<div class="football-placeholder">NO GAMES TO PREDICT</div>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'predict-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
        <th class="predict-row-num-header">#</th>
        <th></th>
        <th>HOME</th>
        <th>AWAY</th>
        <th></th>
        <th class="predict-consensus-header">CONSENSUS</th>
        <th></th>
    </tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    selectedGames.forEach((game, idx) => {
        const gamePreds = allPredictions[idx];
        const consensus = calcConsensus(approaches, gamePreds);

        let consensusCls;
        if (consensus.conflict)        consensusCls = 'predict-cell--conflict';
        else if (consensus.outcome === '1') consensusCls = 'predict-cell--home';
        else if (consensus.outcome === 'X') consensusCls = 'predict-cell--draw';
        else                                consensusCls = 'predict-cell--away';

        const voteStr = `1·${consensus.votes['1']}  X·${consensus.votes['X']}  2·${consensus.votes['2']}`;

        // ── Main (collapsed) row ──────────────────────────────────────────
        const mainTr = document.createElement('tr');
        mainTr.className = 'predict-row predict-row--main';
        mainTr.innerHTML = `
            <td class="predict-row-num">${idx + 1}</td>
            <td><img class="game-team-logo" src="${game.homeTeamLogo}" alt=""></td>
            <td class="predict-team-name">${game.homeTeamName.toUpperCase()}</td>
            <td class="predict-team-name">${game.awayTeamName.toUpperCase()}</td>
            <td><img class="game-team-logo" src="${game.awayTeamLogo}" alt=""></td>
            <td class="predict-cell predict-consensus-cell ${consensusCls}">
                <span class="predict-outcome">${consensus.outcome}</span>
                <span class="predict-votes">${voteStr}</span>
            </td>
            <td class="predict-expand-btn" title="SHOW APPROACHES">&#9654;</td>`;

        // ── Detail (expanded) row ─────────────────────────────────────────
        const detailTr = document.createElement('tr');
        detailTr.className = 'predict-detail-row';
        detailTr.style.display = 'none';

        const detailRows = approaches.map((approach, ai) => {
            const pred = gamePreds[ai];
            if (!pred) return `
                <tr>
                    <td class="predict-approach-name" title="${approach.description}">${approach.name.toUpperCase()}</td>
                    <td class="predict-cell predict-cell--error">N/A</td>
                    <td class="predict-detail-probs">—</td>
                </tr>`;
            const h = pred.homeWinProbability, d = pred.drawProbability, a = pred.awayWinProbability;
            const outcome = pred.predictedResult ?? (h >= d && h >= a ? '1' : d >= a ? 'X' : '2');
            let cls;
            if (outcome === '1')      cls = 'predict-cell--home';
            else if (outcome === 'X') cls = 'predict-cell--draw';
            else                      cls = 'predict-cell--away';
            return `
                <tr>
                    <td class="predict-approach-name" title="${approach.description}">${approach.name.toUpperCase()}</td>
                    <td class="predict-cell ${cls}"><span class="predict-outcome">${outcome}</span></td>
                    <td class="predict-detail-probs">
                        <span class="${outcome === '1' ? 'predict-detail-prob--active' : ''}">1: ${(h * 100).toFixed(0)}%</span>
                        <span class="${outcome === 'X' ? 'predict-detail-prob--active' : ''}">X: ${(d * 100).toFixed(0)}%</span>
                        <span class="${outcome === '2' ? 'predict-detail-prob--active' : ''}">2: ${(a * 100).toFixed(0)}%</span>
                    </td>
                </tr>`;
        }).join('');

        detailTr.innerHTML = `<td colspan="7">
            <div class="predict-detail-panel">
                <table class="predict-detail-table">
                    <thead><tr>
                        <th>APPROACH</th>
                        <th>RESULT</th>
                        <th>PROBABILITIES</th>
                    </tr></thead>
                    <tbody>${detailRows}</tbody>
                </table>
            </div>
        </td>`;

        // ── Toggle on click ───────────────────────────────────────────────
        const expandBtn = mainTr.querySelector('.predict-expand-btn');
        mainTr.addEventListener('click', () => {
            const isOpen = detailTr.style.display !== 'none';
            detailTr.style.display = isOpen ? 'none' : '';
            mainTr.classList.toggle('predict-row--expanded', !isOpen);
            expandBtn.innerHTML = isOpen ? '&#9654;' : '&#9660;';
        });

        tbody.appendChild(mainTr);
        tbody.appendChild(detailTr);
    });

    table.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(table);
}

function renderPredictFullPanel(approaches, allPredictions) {
    const container = document.getElementById('predictFullContainer');
    if (!container) return;

    if (!selectedGames.length) {
        container.innerHTML = '<div class="football-placeholder">NO GAMES TO PREDICT</div>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'predict-table predict-full-table';

    const thead = document.createElement('thead');
    const headerCells = approaches.map(a =>
        `<th class="predict-approach-header" title="${a.description}">${a.name.toUpperCase()}</th>`
    ).join('');
    thead.innerHTML = `<tr><th class="predict-row-num-header">#</th>${headerCells}</tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    selectedGames.forEach((_, idx) => {
        const gamePreds = allPredictions[idx];
        const tr = document.createElement('tr');
        tr.className = 'predict-row';

        let cells = `<td class="predict-row-num">${idx + 1}</td>`;
        approaches.forEach((approach, ai) => {
            const pred = gamePreds[ai];
            if (!pred) {
                cells += `<td class="predict-cell predict-cell--error"><span class="predict-outcome">?</span></td>`;
                return;
            }
            const h = pred.homeWinProbability, d = pred.drawProbability, a = pred.awayWinProbability;
            const outcome = pred.predictedResult ?? (h >= d && h >= a ? '1' : d >= a ? 'X' : '2');
            let cls;
            if (outcome === '1')      cls = 'predict-cell--home';
            else if (outcome === 'X') cls = 'predict-cell--draw';
            else                      cls = 'predict-cell--away';
            cells += `<td class="predict-cell ${cls}"><span class="predict-outcome">${outcome}</span></td>`;
        });
        tr.innerHTML = cells;
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(table);
}

// ── Football API ──────────────────────────────────────────────────────────────
let footballCountries = [];
let countriesLoaded = false;

// ── Favourites ────────────────────────────────────────────────────────────────
const favCountries  = new Set(JSON.parse(localStorage.getItem('favCountries')  ?? '[]'));
const favLeagues    = new Set(JSON.parse(localStorage.getItem('favLeagues')    ?? '[]'));
let favCountriesOnly = false;
let favLeaguesOnly   = false;

function saveFavCountries() { localStorage.setItem('favCountries', JSON.stringify([...favCountries])); }
function saveFavLeagues()   { localStorage.setItem('favLeagues',   JSON.stringify([...favLeagues])); }

function updateCountryFavBtn(id) {
    for (const btnId of ['countryFavBtn', 'simCountryFavBtn']) {
        const btn = document.getElementById(btnId);
        if (!btn) continue;
        const isFav = id && favCountries.has(String(id));
        btn.disabled = !id;
        btn.textContent = isFav ? '★' : '☆';
        btn.classList.toggle('is-fav', !!isFav);
    }
}

function updateLeagueFavBtn(id) {
    for (const btnId of ['leagueFavBtn', 'simLeagueFavBtn']) {
        const btn = document.getElementById(btnId);
        if (!btn) continue;
        const isFav = id && favLeagues.has(String(id));
        btn.disabled = !id;
        btn.textContent = isFav ? '★' : '☆';
        btn.classList.toggle('is-fav', !!isFav);
    }
}

async function loadFootballCountries() {
    if (countriesLoaded) return;

    const select = document.getElementById('countrySelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- LOADING... --</option>';
    select.disabled = true;

    try {
        const res = await apiFetch(`${getApiBase()}/api/Football/countries`, {
            headers: { 'accept': '*/*' }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        footballCountries = await res.json();

        renderCountryOptions(select);
        countriesLoaded = true;
    } catch (err) {
        console.error('Failed to load countries:', err);
        select.innerHTML = '<option value="">-- ERROR LOADING --</option>';
        showError('Failed to load countries');
    } finally {
        select.disabled = false;
    }
}

function renderCountryOptions(select) {
    const prev = select.value;
    select.innerHTML = '<option value="">-- Select Country --</option>';
    const favList  = footballCountries.filter(c => favCountries.has(String(c.id)));
    const restList = footballCountries.filter(c => !favCountries.has(String(c.id)));

    if (favList.length) {
        const grp = document.createElement('optgroup');
        grp.label = '── FAVORITES ──';
        favList.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = '★ ' + c.name.toUpperCase();
            grp.appendChild(opt);
        });
        select.appendChild(grp);
    }

    if (!favCountriesOnly) {
        restList.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name.toUpperCase();
            select.appendChild(opt);
        });
    }

    if (prev) select.value = prev;
    updateCountryFavBtn(select.value);
}

function renderLeagueOptions(leagueSelect) {
    const prev = leagueSelect.value;
    leagueSelect.innerHTML = '<option value="">-- Select League --</option>';

    const groups = { League: [], Cup: [] };
    footballLeagues.forEach(l => {
        const bucket = groups[l.type] ?? (groups['Other'] = groups['Other'] ?? []);
        bucket.push(l);
    });

    ['League', 'Cup'].forEach(type => {
        if (!groups[type]?.length) return;
        const visibleItems = groups[type].filter(l =>
            !favLeaguesOnly || favLeagues.has(String(l.id))
        );
        if (!visibleItems.length) return;

        const favItems  = visibleItems.filter(l => favLeagues.has(String(l.id)));
        const restItems = visibleItems.filter(l => !favLeagues.has(String(l.id)));

        if (favItems.length) {
            const grp = document.createElement('optgroup');
            grp.label = (type === 'Cup' ? '── CUPS' : '── LEAGUES') + ' FAVORITES ──';
            favItems.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.id;
                opt.textContent = '★ ' + l.name.toUpperCase();
                grp.appendChild(opt);
            });
            leagueSelect.appendChild(grp);
        }

        if (restItems.length) {
            const grp = document.createElement('optgroup');
            grp.label = type === 'Cup' ? '── CUPS ──' : '── LEAGUES ──';
            restItems.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.id;
                opt.textContent = l.name.toUpperCase();
                grp.appendChild(opt);
            });
            leagueSelect.appendChild(grp);
        }
    });

    if (prev) leagueSelect.value = prev;
    updateLeagueFavBtn(leagueSelect.value);
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
        const res = await apiFetch(`${getApiBase()}/api/Football/countries/${countryId}/leagues`, {
            headers: { 'accept': '*/*' }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        footballLeagues = await res.json();

        renderLeagueOptions(leagueSelect);
        leagueSelect.disabled = false;
        updateLeagueFavBtn(leagueSelect.value);
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
        const res = await apiFetch(`${getApiBase()}/api/Football/leagues/${leagueId}/seasons`, {
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

// ── Simulations panel dropdowns ───────────────────────────────────────────────
let simLeagues = [];
let simSeasons = [];

async function loadSimCountries() {
    const select = document.getElementById('simCountrySelect');
    if (!select) return;

    if (!countriesLoaded) {
        select.innerHTML = '<option value="">-- LOADING... --</option>';
        select.disabled = true;
        try {
            const res = await apiFetch(`${getApiBase()}/api/Football/countries`, { headers: { 'accept': '*/*' } });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            footballCountries = await res.json();
            countriesLoaded = true;
        } catch (err) {
            console.error('Failed to load countries:', err);
            select.innerHTML = '<option value="">-- ERROR LOADING --</option>';
            showError('Failed to load countries');
            return;
        }
        select.disabled = false;
    }

    renderCountryOptions(select);
}

async function populateSimLeagueSelect(countryId) {
    const leagueSelect = document.getElementById('simLeagueSelect');
    const seasonSelect = document.getElementById('simSeasonSelect');
    if (!leagueSelect || !seasonSelect) return;

    leagueSelect.innerHTML = '<option value="">-- Select League --</option>';
    leagueSelect.disabled = true;
    seasonSelect.innerHTML = '<option value="">-- Select Season --</option>';
    seasonSelect.disabled = true;
    simLeagues = [];
    simSeasons = [];

    if (!countryId) return;

    leagueSelect.innerHTML = '<option value="">-- LOADING... --</option>';

    try {
        const res = await apiFetch(`${getApiBase()}/api/Football/countries/${countryId}/leagues`, { headers: { 'accept': '*/*' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        simLeagues = await res.json();

        const savedLeagues = footballLeagues;
        footballLeagues = simLeagues;
        renderLeagueOptions(leagueSelect);
        footballLeagues = savedLeagues;

        leagueSelect.disabled = false;
        updateLeagueFavBtn(leagueSelect.value);
    } catch (err) {
        console.error('Failed to load leagues:', err);
        leagueSelect.innerHTML = '<option value="">-- ERROR LOADING --</option>';
        showError('Failed to load leagues');
    }
}

async function populateSimSeasonSelect(leagueId) {
    const seasonSelect = document.getElementById('simSeasonSelect');
    if (!seasonSelect) return;

    seasonSelect.innerHTML = '<option value="">-- Select Season --</option>';
    seasonSelect.disabled = true;
    simSeasons = [];

    if (!leagueId) return;

    seasonSelect.innerHTML = '<option value="">-- LOADING... --</option>';

    try {
        const res = await apiFetch(`${getApiBase()}/api/Football/leagues/${leagueId}/seasons`, { headers: { 'accept': '*/*' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        simSeasons = await res.json();

        seasonSelect.innerHTML = '<option value="">-- Select Season --</option>';
        simSeasons.forEach(season => {
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
let selectedGames = [];       // accumulates { seasonId, teamHomeId, teamOutId, + display fields }
let matchesSelectedGame = null; // game focused in matches panel for similar-games lookup

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
        info:         document.getElementById('footballContent'),
        rounds:       document.getElementById('footballRoundsPanel'),
        matches:      document.getElementById('footballMatchesPanel'),
        predict:      document.getElementById('footballPredictPanel'),
        predictFull:  document.getElementById('footballPredictFullPanel'),
        similar:      document.getElementById('footballSimilarPanel'),
        approaches:   document.getElementById('footballApproachesPanel'),
        inspection:   document.getElementById('footballInspectionPanel'),
        simulation:   document.getElementById('footballSimulationPanel'),
        simResults:   document.getElementById('footballSimResultsPanel'),
    };
    const tabs = {
        info:         document.getElementById('tabBtnInfo'),
        rounds:       document.getElementById('tabBtnRounds'),
        matches:      document.getElementById('tabBtnMatches'),
        predict:      document.getElementById('tabBtnPredict'),
        predictFull:  document.getElementById('tabBtnPredictFull'),
        similar:      document.getElementById('tabBtnSimilar'),
        approaches:   document.getElementById('tabBtnApproaches'),
        inspection:   document.getElementById('tabBtnInspection'),
        simulation:   document.getElementById('tabBtnSimulation'),
        simResults:   document.getElementById('tabBtnSimResults'),
    };

    Object.values(panels).forEach(p => { if (p) p.style.display = 'none'; });
    Object.values(tabs).forEach(t => { if (t) t.classList.remove('active'); });

    // hide/deactivate all dynamic inspection tabs
    document.querySelectorAll('.dynamic-inspection-panel').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.dynamic-inspection-tab').forEach(t => t.classList.remove('active'));

    if (panels[tabName]) {
        panels[tabName].style.display = 'flex';
    } else {
        const dynPanel = document.getElementById('panel_' + tabName);
        if (dynPanel) dynPanel.style.display = 'flex';
    }
    if (tabs[tabName]) {
        tabs[tabName].classList.add('active');
    } else {
        const dynTab = document.getElementById('tabBtn_' + tabName);
        if (dynTab) dynTab.classList.add('active');
    }

    if (tabName === 'matches') renderMatchesPanel();
}

// ── Inspection ────────────────────────────────────────────────────────────────
let inspectedGame = null;

async function openInspection(game, seasonId) {
    inspectedGame = game;

    const tabId = `inspect_${game.teamIdHome}_${game.teamIdOut}_${game.round}`;

    // If tab already exists just switch to it
    if (document.getElementById('panel_' + tabId)) {
        switchFootballTab(tabId);
        return;
    }

    // Create tab button
    const tabsBar = document.querySelector('.football-tabs');
    const approachesBtn = document.getElementById('tabBtnApproaches');
    const tabBtn  = document.createElement('button');
    tabBtn.className  = 'football-tab-btn dynamic-inspection-tab';
    tabBtn.id         = 'tabBtn_' + tabId;
    const label = `${game.homeTeamName.toUpperCase().split(' ')[0]} vs ${game.awayTeamName.toUpperCase().split(' ')[0]}`;
    tabBtn.innerHTML  = `${label} <span class="football-tab-close" data-tabid="${tabId}">×</span>`;
    tabsBar.insertBefore(tabBtn, approachesBtn);

    // Create panel — sibling of .football-tabs inside .football-area
    const panelsHost = document.querySelector('.football-area');
    const panel = document.createElement('div');
    panel.className   = 'football-rounds-panel dynamic-inspection-panel';
    panel.id          = 'panel_' + tabId;
    panel.style.display = 'none';
    const container   = document.createElement('div');
    container.id      = 'container_' + tabId;
    container.innerHTML = '<div class="football-placeholder">LOADING INSPECTION...</div>';
    panel.appendChild(container);
    panelsHost.appendChild(panel);

    // Tab click — switch to this tab
    tabBtn.addEventListener('click', e => {
        if (e.target.dataset.tabid) return; // close btn handled below
        switchFootballTab(tabId);
    });

    // Close button — remove tab + panel, go back to rounds
    tabBtn.querySelector('[data-tabid]').addEventListener('click', e => {
        e.stopPropagation();
        tabBtn.remove();
        panel.remove();
        switchFootballTab('rounds');
    });

    // stay on rounds tab while inspection loads in background
    switchFootballTab('rounds');

    try {
        const approaches = await loadPredictionApproaches();

        const status = (game.status || '').toUpperCase();
        const finishedStatuses   = ['FT', 'AET', 'PEN', 'AWD', 'WO'];
        const inProgressStatuses = ['1H', 'HT', '2H', 'ET', 'BT', 'LIVE'];
        const finished     = finishedStatuses.some(s => status === s || status.includes(s));
        const hasScore     = finished || inProgressStatuses.some(s => status === s || status.includes(s));
        const hs = game.homeFullTimeScore, as_ = game.outFullTimeScore;
        const actualResult = finished ? (hs > as_ ? '1' : hs < as_ ? '2' : 'X') : null;

        const predictions = await Promise.all(
            approaches.map(approach =>
                apiFetch(`${getApiBase()}/api/Prediction/predict?homeTeamId=${game.teamIdHome}&awayTeamId=${game.teamIdOut}&seasonId=${seasonId}&round=${game.round}&approach=${approach.index}`, {
                    headers: { 'accept': '*/*' }
                })
                .then(r => r.ok ? r.json() : null)
                .catch(() => null)
            )
        );

        renderInspectionPanel(game, actualResult, hasScore, approaches, predictions, 'container_' + tabId);
    } catch (err) {
        const c = document.getElementById('container_' + tabId);
        if (c) c.innerHTML = `<div class="football-placeholder">ERROR: ${err.message}</div>`;
    }
}

function renderInspectionPanel(game, actualResult, hasScore, approaches, predictions, containerId = 'inspectionContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const finished = actualResult !== null;

    const ranked = approaches.map((approach, i) => {
        const pred = predictions[i];
        if (!pred) return { approach, pred: null, predicted: null, correct: false, confidence: 0 };
        const h = pred.homeWinProbability ?? 0, d = pred.drawProbability ?? 0, a = pred.awayWinProbability ?? 0;
        const predicted = pred.predictedResult ?? (h >= d && h >= a ? '1' : d >= a ? 'X' : '2');
        const correct = finished ? predicted === actualResult : false;
        const confidence = finished
            ? (actualResult === '1' ? h : actualResult === 'X' ? d : a)
            : Math.max(h, d, a);
        return { approach, pred, predicted, correct, confidence };
    });

    if (finished) {
        ranked.sort((a, b) => {
            if (a.correct !== b.correct) return (b.correct ? 1 : 0) - (a.correct ? 1 : 0);
            return (b.confidence || 0) - (a.confidence || 0);
        });
    }

    const ftScore = hasScore ? `${game.homeFullTimeScore}-${game.outFullTimeScore}` : '? - ?';
    const htScore = `${game.homeHalfTimeScore ?? '?'}-${game.outHalfTimeScore ?? '?'}`;

    // Header meta section
    let metaHtml = '';
    if (finished) {
        const correctCount = ranked.filter(r => r.correct).length;
        const bestApproach = ranked.find(r => r.correct);
        const resultCls = actualResult === '1' ? 'predict-cell--home' : actualResult === 'X' ? 'predict-cell--draw' : 'predict-cell--away';
        metaHtml = `
            <span class="inspection-result-badge predict-cell ${resultCls}">
                <span class="predict-outcome">RESULT: ${actualResult}</span>
            </span>
            <span class="inspection-accuracy">${correctCount}/${approaches.length} APPROACHES CORRECT</span>
            ${bestApproach
                ? `<span class="inspection-best">BEST MATCH: ${bestApproach.approach.name.toUpperCase()}</span>`
                : '<span class="inspection-best inspection-best--none">NO APPROACH MATCHED</span>'}`;
    } else {
        metaHtml = `<span class="inspection-accuracy inspection-not-finished">GAME NOT FINISHED — PREDICTIONS ONLY</span>`;
    }

    let html = `
    <div class="inspection-header">
        <div class="inspection-game">
            <img class="game-team-logo inspection-logo" src="${game.homeTeamLogo}" alt="">
            <span class="inspection-team-name">${game.homeTeamName.toUpperCase()}</span>
            <div class="inspection-score-block">
                <span class="inspection-score-ft">${ftScore}</span>
                ${(game.homeHalfTimeScore != null) ? `<span class="inspection-score-ht">(HT: ${htScore})</span>` : ''}
            </div>
            <span class="inspection-team-name">${game.awayTeamName.toUpperCase()}</span>
            <img class="game-team-logo inspection-logo" src="${game.awayTeamLogo}" alt="">
        </div>
        <div class="inspection-meta">${metaHtml}</div>
    </div>
    <table class="predict-table inspection-table">
        <thead>
            <tr>
                <th>#</th>
                <th class="predict-approach-header">APPROACH</th>
                <th>PREDICTION</th>
                <th class="inspection-prob-header">HOME 1</th>
                <th class="inspection-prob-header">DRAW X</th>
                <th class="inspection-prob-header">AWAY 2</th>
                ${finished ? '<th class="inspection-match-header">✓</th>' : ''}
            </tr>
        </thead>
        <tbody>`;

    ranked.forEach((entry, i) => {
        const { approach, pred, predicted, correct } = entry;
        if (!pred) {
            html += `
            <tr class="predict-row inspection-row">
                <td class="predict-row-num">${i + 1}</td>
                <td class="predict-approach-name" title="${approach.description}">${approach.name.toUpperCase()}</td>
                <td colspan="${finished ? 4 : 3}" class="predict-cell predict-cell--error">N/A</td>
                ${finished ? '<td class="inspection-match">—</td>' : ''}
            </tr>`;
            return;
        }
        const h = pred.homeWinProbability ?? 0, d = pred.drawProbability ?? 0, a = pred.awayWinProbability ?? 0;
        const predCls = predicted === '1' ? 'predict-cell--home' : predicted === 'X' ? 'predict-cell--draw' : 'predict-cell--away';
        const rowCls = finished ? (correct ? 'inspection-row--correct' : 'inspection-row--wrong') : '';
        html += `
        <tr class="predict-row inspection-row ${rowCls}">
            <td class="predict-row-num">${i + 1}</td>
            <td class="predict-approach-name" title="${approach.description}">${approach.name.toUpperCase()}</td>
            <td class="predict-cell ${predCls}"><span class="predict-outcome">${predicted}</span></td>
            <td class="inspection-prob ${finished && actualResult === '1' ? 'inspection-prob--actual' : ''}">${(h * 100).toFixed(1)}%</td>
            <td class="inspection-prob ${finished && actualResult === 'X' ? 'inspection-prob--actual' : ''}">${(d * 100).toFixed(1)}%</td>
            <td class="inspection-prob ${finished && actualResult === '2' ? 'inspection-prob--actual' : ''}">${(a * 100).toFixed(1)}%</td>
            ${finished ? `<td class="inspection-match ${correct ? 'inspection-match--correct' : 'inspection-match--wrong'}">${correct ? '✓' : '✗'}</td>` : ''}
        </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}
// ─────────────────────────────────────────────────────────────────────────────

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
        updateFindSimilarBtn();
        return;
    }

    const table = document.createElement('table');
    table.className = 'games-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>#</th>
                <th colspan="2">HOME</th>
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

        // Re-apply focus highlight if this game was previously selected
        if (matchesSelectedGame &&
            matchesSelectedGame.seasonId   === game.seasonId &&
            matchesSelectedGame.teamHomeId === game.teamHomeId &&
            matchesSelectedGame.teamOutId  === game.teamOutId) {
            tr.classList.add('match-focus');
        }

        tr.innerHTML = `
            <td class="game-id-cell">${game.gameId ?? ''}</td>
            <td><img class="game-team-logo" src="${game.homeTeamLogo}" alt=""></td>
            <td>${game.homeTeamName.toUpperCase()}</td>
            <td>${game.awayTeamName.toUpperCase()}</td>
            <td><img class="game-team-logo" src="${game.awayTeamLogo}" alt=""></td>
            <td class="game-status">${game.round}</td>
            <td><button class="match-remove-btn" title="Remove">×</button></td>`;

        tr.querySelector('.match-remove-btn').addEventListener('click', e => {
            e.stopPropagation();
            removeSelectedGame(idx);
        });

        tr.addEventListener('click', e => {
            if (e.target.closest('.match-remove-btn')) return;
            const isFocused = matchesSelectedGame &&
                matchesSelectedGame.seasonId   === game.seasonId &&
                matchesSelectedGame.teamHomeId === game.teamHomeId &&
                matchesSelectedGame.teamOutId  === game.teamOutId;
            tbody.querySelectorAll('.game-row').forEach(r => r.classList.remove('match-focus'));
            if (isFocused) {
                matchesSelectedGame = null;
            } else {
                matchesSelectedGame = game;
                tr.classList.add('match-focus');
            }
            updateFindSimilarBtn();
        });

        tbody.appendChild(tr);
    });

    container.innerHTML = '';
    container.appendChild(table);
    updateFindSimilarBtn();
}

function updateFindSimilarBtn() {
    const btn = document.getElementById('findSimilarBtn');
    if (btn) btn.disabled = !matchesSelectedGame;
}

function removeSelectedGame(idx) {
    const removed = selectedGames[idx];
    if (matchesSelectedGame &&
        matchesSelectedGame.seasonId   === removed.seasonId &&
        matchesSelectedGame.teamHomeId === removed.teamHomeId &&
        matchesSelectedGame.teamOutId  === removed.teamOutId) {
        matchesSelectedGame = null;
    }
    selectedGames.splice(idx, 1);
    renderMatchesPanel();
    updateMatchesBadge();
    // Refresh rounds view to un-highlight the removed game
    const roundsPanel = document.getElementById('footballRoundsPanel');
    if (roundsPanel && roundsPanel.style.display !== 'none' && currentSeasonId) {
        loadGames(currentSeasonId, currentRound);
    }
}

// ── Export folder handle (IndexedDB) ──────────────────────────────────────────
const FOLDER_DB_NAME = 'winner16-settings';
const FOLDER_STORE   = 'folderHandles';
const FOLDER_KEY     = 'exportFolder';

function openFolderDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(FOLDER_DB_NAME, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(FOLDER_STORE);
        req.onsuccess = e => resolve(e.target.result);
        req.onerror   = e => reject(e.target.error);
    });
}

async function saveFolderHandle(handle) {
    const db = await openFolderDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(FOLDER_STORE, 'readwrite');
        tx.objectStore(FOLDER_STORE).put(handle, FOLDER_KEY);
        tx.oncomplete = resolve;
        tx.onerror    = e => reject(e.target.error);
    });
}

async function loadFolderHandle() {
    try {
        const db = await openFolderDb();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(FOLDER_STORE, 'readonly');
            const req = tx.objectStore(FOLDER_STORE).get(FOLDER_KEY);
            req.onsuccess = e => resolve(e.target.result ?? null);
            req.onerror   = e => reject(e.target.error);
        });
    } catch {
        return null;
    }
}

async function getExportStartIn() {
    const handle = await loadFolderHandle();
    if (handle) {
        try {
            const perm = await handle.queryPermission({ mode: 'read' });
            if (perm === 'granted') return handle;
        } catch { /* ignore */ }
    }
    return 'downloads';
}


async function loadWinner16Ids() {
    const select = document.getElementById('winner16IdInput');
    if (!select) return;
    try {
        const res = await apiFetch(`${getApiBase()}/api/prediction/games/winner16-ids`, {
            headers: { 'accept': 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ids = await res.json();
        const current = select.value;
        select.innerHTML = '<option value="">-- WINNER16 ID --</option>';
        (Array.isArray(ids) ? ids : []).forEach(id => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = id;
            select.appendChild(opt);
        });
        if (current && [...select.options].some(o => o.value === current)) {
            select.value = current;
        }
    } catch (err) {
        console.warn('[loadWinner16Ids] failed:', err);
    }
}

async function saveMatchesToDb() {
    if (!selectedGames.length) {
        showError('NO GAMES TO SAVE');
        return;
    }
    const winner16Id = document.getElementById('winner16IdInput')?.value?.trim();
    if (!winner16Id) {
        showError('ENTER WINNER16 ID');
        return;
    }
    try {
        const res = await apiFetch(`${getApiBase()}/api/Prediction/games`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'accept': '*/*' },
            body: JSON.stringify(selectedGames.map((g, i) => ({
                seasonId:   g.seasonId,
                TeamHomeId: g.teamHomeId,
                TeamOutId:  g.teamOutId,
                round:      g.round,
                winner16Id: Number(winner16Id),
                gameId:     i + 1,
            }))),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        showSuccess('MATCHES SAVED TO DB');
    } catch (err) {
        showError('DB SAVE FAILED');
    }
}

async function loadMatchesFromDb() {
    const winner16Id = document.getElementById('winner16IdInput')?.value?.trim();
    if (!winner16Id) {
        showError('ENTER WINNER16 ID');
        return;
    }
    try {
        const res = await apiFetch(`${getApiBase()}/api/Prediction/games?winner16Id=${encodeURIComponent(winner16Id)}`, {
            headers: { 'accept': 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log('[loadMatchesFromDb] raw response:', data);
        const games = Array.isArray(data) ? data : (data.games ?? data.matches ?? data.data ?? []);
        if (!Array.isArray(games)) throw new Error('Invalid response');

        // Group by seasonId+round to batch-fetch team info
        const groupKeys = [...new Set(games.map(g => `${g.seasonId ?? g.SeasonId}_${g.round ?? g.Round}`))];
        const footballGamesCache = {};
        await Promise.all(groupKeys.map(async key => {
            const [seasonId, round] = key.split('_');
            try {
                const r = await apiFetch(`${getApiBase()}/api/Football/seasons/${seasonId}/rounds/${round}/games`, {
                    headers: { 'accept': '*/*' }
                });
                if (r.ok) footballGamesCache[key] = await r.json();
            } catch { /* leave cache empty for this key */ }
        }));

        selectedGames = games.map(g => {
            const seasonId  = g.seasonId  ?? g.SeasonId;
            const round     = g.round     ?? g.Round;
            const homeId    = g.teamHomeId ?? g.TeamHomeId;
            const outId     = g.teamOutId  ?? g.TeamOutId;
            const key       = `${seasonId}_${round}`;
            const match     = (footballGamesCache[key] ?? []).find(
                f => f.teamIdHome === homeId && f.teamIdOut === outId
            );
            return {
                gameId:            g.gameId   ?? g.GameId,
                seasonId,
                teamHomeId:        homeId,
                teamOutId:         outId,
                homeTeamName:      match?.homeTeamName  ?? g.homeTeamName  ?? g.HomeTeamName  ?? '',
                awayTeamName:      match?.awayTeamName  ?? g.awayTeamName  ?? g.AwayTeamName  ?? '',
                homeTeamLogo:      match?.homeTeamLogo  ?? g.homeTeamLogo  ?? g.HomeTeamLogo  ?? '',
                awayTeamLogo:      match?.awayTeamLogo  ?? g.awayTeamLogo  ?? g.AwayTeamLogo  ?? '',
                homeFullTimeScore: match?.homeFullTimeScore ?? g.homeFullTimeScore ?? g.HomeFullTimeScore,
                outFullTimeScore:  match?.outFullTimeScore  ?? g.outFullTimeScore  ?? g.OutFullTimeScore,
                round,
            };
        });
        selectedGames.sort((a, b) => (a.gameId ?? 0) - (b.gameId ?? 0));
        matchesSelectedGame = null;
        renderMatchesPanel();
        updateMatchesBadge();
        showSuccess(`LOADED ${games.length} MATCH${games.length !== 1 ? 'ES' : ''} FROM DB`);
    } catch (err) {
        showError('DB LOAD FAILED');
    }
}

// ── Similar Games ─────────────────────────────────────────────────────────────
async function findSimilarGames() {
    if (!matchesSelectedGame) {
        showError('SELECT A GAME FIRST');
        return;
    }
    const game = matchesSelectedGame;
    const btn = document.getElementById('findSimilarBtn');
    if (btn) { btn.textContent = '[ LOADING... ]'; btn.disabled = true; }

    try {
        const params = new URLSearchParams({
            seasonId:   game.seasonId,
            round:      game.round,
            homeTeamId: game.teamHomeId,
            awayTeamId: game.teamOutId,
            threshold:  10
        });
        const res = await apiFetch(`${getApiBase()}/api/Prediction/similar-games?${params}`, {
            headers: { 'accept': '*/*' }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const similarGames = await res.json();

        renderSimilarPanel(game, similarGames);
        const tabBtn = document.getElementById('tabBtnSimilar');
        if (tabBtn) tabBtn.style.display = '';
        switchFootballTab('similar');
    } catch (err) {
        showError('SIMILAR GAMES FETCH FAILED');
        console.error(err);
    } finally {
        if (btn) { btn.textContent = '[ FIND SIMILAR ]'; btn.disabled = !matchesSelectedGame; }
    }
}

function renderSimilarPanel(game, similarGames) {
    const container = document.getElementById('similarContainer');
    if (!container) return;

    const DISPLAY_LIMIT = 100;
    const total     = similarGames.length;
    const homeWins  = similarGames.filter(g => g.result === '1').length;
    const draws     = similarGames.filter(g => g.result === 'X').length;
    const awayWins  = similarGames.filter(g => g.result === '2').length;
    const pct       = n => total > 0 ? Math.round(n / total * 100) : 0;
    const hasScore  = game.homeFullTimeScore != null && game.outFullTimeScore != null;
    const scoreStr  = hasScore ? `${game.homeFullTimeScore} - ${game.outFullTimeScore}` : 'VS';
    const displayGames = similarGames.slice(0, DISPLAY_LIMIT);

    const rows = displayGames.map(g => {
        const resultLabel = g.result === '1' ? 'HOME WIN' : g.result === 'X' ? 'DRAW' : 'AWAY WIN';
        const resultClass = g.result === '1' ? 'result-home' : g.result === 'X' ? 'result-draw' : 'result-away';
        const simDots = '●'.repeat(Math.max(1, 11 - g.similarityScore));
        return `<tr class="game-row">
            <td>${g.seasonId}</td>
            <td class="game-status">${g.round}</td>
            <td class="game-score">${g.homeGoals}-${g.awayGoals}</td>
            <td><span class="similar-result ${resultClass}">${resultLabel}</span></td>
            <td class="similar-sim-dots" title="Similarity score: ${g.similarityScore}">${simDots}</td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div class="similar-game-card">
            <div class="similar-game-teams">
                <img class="game-team-logo" src="${game.homeTeamLogo}" alt="">
                <span class="similar-team-name">${game.homeTeamName.toUpperCase()}</span>
                <span class="similar-score">${scoreStr}</span>
                <span class="similar-team-name">${game.awayTeamName.toUpperCase()}</span>
                <img class="game-team-logo" src="${game.awayTeamLogo}" alt="">
            </div>
            <div class="similar-game-meta">ROUND ${game.round}</div>
        </div>
        <div class="similar-outcomes">
            <div class="similar-outcomes-label">OUTCOMES ACROSS ${total.toLocaleString()} SIMILAR GAMES</div>
            <div class="similar-outcome-row">
                <span class="similar-outcome-lbl">HOME WIN</span>
                <div class="similar-outcome-bar"><div class="similar-outcome-fill similar-fill--home" style="width:${pct(homeWins)}%"></div></div>
                <span class="similar-outcome-pct">${pct(homeWins)}%</span>
            </div>
            <div class="similar-outcome-row">
                <span class="similar-outcome-lbl">DRAW</span>
                <div class="similar-outcome-bar"><div class="similar-outcome-fill similar-fill--draw" style="width:${pct(draws)}%"></div></div>
                <span class="similar-outcome-pct">${pct(draws)}%</span>
            </div>
            <div class="similar-outcome-row">
                <span class="similar-outcome-lbl">AWAY WIN</span>
                <div class="similar-outcome-bar"><div class="similar-outcome-fill similar-fill--away" style="width:${pct(awayWins)}%"></div></div>
                <span class="similar-outcome-pct">${pct(awayWins)}%</span>
            </div>
        </div>
        <div class="similar-list-header">
            SHOWING TOP ${Math.min(DISPLAY_LIMIT, total).toLocaleString()} OF ${total.toLocaleString()} SIMILAR GAMES
        </div>
        <table class="games-table">
            <thead>
                <tr>
                    <th>SEASON</th>
                    <th>RND</th>
                    <th>SCORE</th>
                    <th>RESULT</th>
                    <th>SIMILARITY</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
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
        const res = await apiFetch(`${getApiBase()}/api/Football/seasons/${seasonId}/rounds/${round}/games`, {
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
                <td>${game.awayTeamName.toUpperCase()}</td>
                <td><img class="game-team-logo" src="${game.awayTeamLogo}" alt=""></td>
                <td class="game-status">${game.status}</td>`;

            tr.addEventListener('click', () => {
                const existingIdx = selectedGames.findIndex(g =>
                    g.seasonId   === seasonId &&
                    g.teamHomeId === game.teamIdHome &&
                    g.teamOutId  === game.teamIdOut);

                if (existingIdx >= 0) {
                    // Toggle off — remove from list, no inspection
                    selectedGames.splice(existingIdx, 1);
                    tr.classList.remove('selected');
                } else {
                    // Toggle on — add to list and open inspection tab
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
                    openInspection(game, seasonId);
                }

                updateMatchesBadge();
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

function clearSimulationPage() {
    const simContainer = document.getElementById('simulationContainer');
    if (simContainer) simContainer.innerHTML = '<div class="football-placeholder">SELECT AN APPROACH TO BEGIN SIMULATION</div>';
    const simResultsContainer = document.getElementById('simResultsContainer');
    if (simResultsContainer) simResultsContainer.innerHTML = '<div class="football-placeholder">SELECT FILTERS AND CLICK LOAD</div>';
    const simProgress = document.getElementById('simProgress');
    if (simProgress) simProgress.style.display = 'none';
    const batchLeagueList = document.getElementById('simBatchLeagueList');
    if (batchLeagueList) batchLeagueList.innerHTML = '<div class="sim-batch-placeholder">NO COUNTRY SELECTED</div>';
    const batchSeasonList = document.getElementById('simBatchSeasonList');
    if (batchSeasonList) batchSeasonList.innerHTML = '<div class="sim-batch-placeholder">SELECT LEAGUES FIRST</div>';
    batchLeaguesData = [];
}

async function loadStandings(seasonId) {
    const tbody = document.getElementById('footballTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;letter-spacing:2px;color:var(--color-text-dim)">LOADING...</td></tr>';

    try {
        const res = await apiFetch(`${getApiBase()}/api/Football/seasons/${seasonId}/standings`, {
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

// ── Simulation ────────────────────────────────────────────────────────────────
let simApproachesLoaded = false;
let lastSimulationResults = null; // { season, approachIndex, approachName, results[] }
let runAllCancelled = false;

// Batch selection state: array of { id, name, seasons: null | [{id, year}] }
let batchLeaguesData = [];
let batchLastCountryId = null;

function setBatchCheckboxes(listId, checked) {
    const list = document.getElementById(listId);
    if (!list) return;
    list.querySelectorAll('.sim-batch-check').forEach(cb => { cb.checked = checked; });
    if (listId === 'simBatchLeagueList') refreshBatchSeasons();
}

async function loadBatchData() {
    const countryId = document.getElementById('countrySelect')?.value;
    if (!countryId) return;

    // Load approaches into batch list (reuse cached data)
    try {
        const approaches = await loadPredictionApproaches();
        renderBatchApproachList(approaches);
    } catch (e) { /* silently ignore — approach list shows placeholder */ }

    // Only reload leagues if country changed
    if (countryId !== batchLastCountryId) {
        batchLastCountryId = countryId;
        batchLeaguesData = [];
        await loadBatchLeagues(countryId);
    }
}

async function loadBatchLeagues(countryId) {
    const list = document.getElementById('simBatchLeagueList');
    if (!list) return;
    list.innerHTML = '<div class="sim-batch-placeholder">LOADING...</div>';

    try {
        const res = await apiFetch(`${getApiBase()}/api/Football/countries/${countryId}/leagues`, { headers: { 'accept': '*/*' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const leagues = await res.json();
        batchLeaguesData = leagues.map(l => ({ id: l.id, name: l.name, seasons: null }));
        renderBatchLeagueList();
    } catch (e) {
        list.innerHTML = '<div class="sim-batch-placeholder">ERROR LOADING LEAGUES</div>';
    }
}

function renderBatchLeagueList() {
    const list = document.getElementById('simBatchLeagueList');
    if (!list) return;
    if (!batchLeaguesData.length) {
        list.innerHTML = '<div class="sim-batch-placeholder">NO LEAGUES FOUND</div>';
        return;
    }
    list.innerHTML = '';
    batchLeaguesData.forEach((league, idx) => {
        const label = document.createElement('label');
        label.className = 'sim-batch-item';
        label.innerHTML = `<input type="checkbox" class="sim-batch-check" data-idx="${idx}" checked> <span>${league.name.toUpperCase()}</span>`;
        label.querySelector('input').addEventListener('change', refreshBatchSeasons);
        list.appendChild(label);
    });
    refreshBatchSeasons();
}

async function refreshBatchSeasons() {
    const seasonList = document.getElementById('simBatchSeasonList');
    if (!seasonList) return;

    const selectedIndices = [...document.querySelectorAll('#simBatchLeagueList .sim-batch-check:checked')]
        .map(cb => parseInt(cb.dataset.idx))
        .filter(i => !isNaN(i));

    if (!selectedIndices.length) {
        seasonList.innerHTML = '<div class="sim-batch-placeholder">SELECT LEAGUES FIRST</div>';
        return;
    }

    seasonList.innerHTML = '<div class="sim-batch-placeholder">LOADING...</div>';

    const yearSet = new Set();
    for (const idx of selectedIndices) {
        const league = batchLeaguesData[idx];
        if (!league) continue;
        if (!league.seasons) {
            try {
                const res = await apiFetch(`${getApiBase()}/api/Football/leagues/${league.id}/seasons`, { headers: { 'accept': '*/*' } });
                league.seasons = res.ok ? (await res.json()).filter(s => !s.isActive) : [];
            } catch { league.seasons = []; }
        }
        league.seasons.forEach(s => yearSet.add(s.year));
    }

    const years = [...yearSet].sort((a, b) => b - a);
    if (!years.length) {
        seasonList.innerHTML = '<div class="sim-batch-placeholder">NO FINISHED SEASONS</div>';
        return;
    }
    seasonList.innerHTML = '';
    years.forEach(year => {
        const label = document.createElement('label');
        label.className = 'sim-batch-item';
        label.innerHTML = `<input type="checkbox" class="sim-batch-check sim-batch-season-check" data-year="${year}" checked> <span>${year}</span>`;
        seasonList.appendChild(label);
    });
}

function renderBatchApproachList(approaches) {
    const list = document.getElementById('simBatchApproachList');
    if (!list) return;
    if (!approaches.length) {
        list.innerHTML = '<div class="sim-batch-placeholder">NO APPROACHES</div>';
        return;
    }
    // Don't re-render if already populated with same count
    if (list.querySelectorAll('.sim-batch-check').length === approaches.length) return;
    list.innerHTML = '';
    approaches.forEach(a => {
        const label = document.createElement('label');
        label.className = 'sim-batch-item';
        label.title = a.description || '';
        label.innerHTML = `<input type="checkbox" class="sim-batch-check" data-index="${a.index}" checked> <span>${a.name.toUpperCase()}</span>`;
        list.appendChild(label);
    });
}

async function loadSimulationApproaches() {
    if (simApproachesLoaded) return;
    const select = document.getElementById('simApproachSelect');
    if (!select) return;

    select.disabled = true;
    select.innerHTML = '<option value="">-- Loading... --</option>';

    try {
        const approaches = await loadPredictionApproaches();
        select.innerHTML = '<option value="">-- Select Approach --</option>';
        approaches.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.index;
            opt.textContent = a.name.toUpperCase();
            if (a.description) opt.title = a.description;
            select.appendChild(opt);
        });
        simApproachesLoaded = true;
    } catch (err) {
        select.innerHTML = '<option value="">-- ERROR LOADING --</option>';
        showError('FAILED TO LOAD APPROACHES');
        console.error(err);
    } finally {
        select.disabled = false;
    }
}

async function runSimulation() {
    const seasonId = currentSeasonId;
    const approachIndex = document.getElementById('simApproachSelect')?.value;

    if (!seasonId) {
        showError('NO SEASON SELECTED — USE THE SIDEBAR');
        return;
    }
    if (approachIndex === '' || approachIndex == null) {
        showError('SELECT AN APPROACH FIRST');
        return;
    }

    const season = footballSeasons.find(s => s.id === seasonId);
    if (season?.isActive) {
        showError('SEASON IS STILL ACTIVE — SIMULATE ONLY ENDED SEASONS');
        return;
    }

    const btn = document.getElementById('simRunBtn');
    const container = document.getElementById('simulationContainer');
    const progress  = document.getElementById('simProgress');
    const progLabel = document.getElementById('simProgressLabel');
    const progStats = document.getElementById('simProgressStats');
    const progFill  = document.getElementById('simProgressFill');

    const saveBtn = document.getElementById('simSaveBtn');
    if (btn)     { btn.textContent = '[ RUNNING... ]'; btn.disabled = true; }
    if (saveBtn) saveBtn.disabled = true;
    container.innerHTML = '';
    if (progress) progress.style.display = '';
    if (progLabel) progLabel.textContent = 'INITIALIZING...';
    if (progStats) progStats.textContent = '';
    if (progFill)  progFill.style.width  = '0%';

    const ASSUMED_MAX_ROUNDS = 38;

    function updateProgress(round, correct, successful, failed) {
        const pct = Math.min((round / ASSUMED_MAX_ROUNDS) * 100, 95);
        if (progFill)  progFill.style.width = `${pct.toFixed(1)}%`;
        if (progLabel) progLabel.textContent = `SIMULATING ROUND ${round}...`;
        if (progStats && successful > 0) {
            const acc = ((correct / successful) * 100).toFixed(1);
            progStats.textContent = `${correct} / ${successful} CORRECT (${acc}%)${failed ? `  ·  ${failed} FAILED` : ''}`;
        }
    }

    const results = [];

    try {
        let round          = 1;
        let runningCorrect = 0;
        let runningTotal   = 0;
        let runningFailed  = 0;

        while (true) {
            updateProgress(round, runningCorrect, runningTotal - runningFailed, runningFailed);

            const res = await apiFetch(`${getApiBase()}/api/Football/seasons/${seasonId}/rounds/${round}/games`, {
                headers: { 'accept': '*/*' }
            });
            if (!res.ok) break;
            const games = await res.json();
            if (!games.length) break;

            const gameResults = await Promise.all(games.map(async game => {
                const hs  = game.homeFullTimeScore;
                const as_ = game.outFullTimeScore;
                if (hs == null || as_ == null) return null; // unfinished — skip entirely

                const actual = hs > as_ ? '1' : hs < as_ ? '2' : 'X';

                try {
                    const predRes = await fetch(
                        `${getApiBase()}/api/Prediction/predict?homeTeamId=${game.teamIdHome}&awayTeamId=${game.teamIdOut}&seasonId=${seasonId}&round=${round}&approach=${approachIndex}`,
                        { headers: { 'accept': '*/*' } }
                    );
                    if (!predRes.ok) {
                        console.warn(`[SIM] Predict failed — round=${round} home=${game.teamIdHome} away=${game.teamIdOut} status=${predRes.status}`);
                        return { apiError: true };
                    }
                    const pred = await predRes.json();
                    const h = pred.homeWinProbability, d = pred.drawProbability, a = pred.awayWinProbability;
                    const predicted = pred.predictedResult ?? (h >= d && h >= a ? '1' : d >= a ? 'X' : '2');
                    return { apiError: false, isCorrect: predicted === actual };
                } catch (err) {
                    console.warn(`[SIM] Predict error — round=${round} home=${game.teamIdHome} away=${game.teamIdOut}`, err);
                    return { apiError: true };
                }
            }));

            // null = unfinished game (not counted); { apiError } = finished game
            const finished = gameResults.filter(g => g !== null);
            const failed   = finished.filter(g => g.apiError).length;
            const correct  = finished.filter(g => !g.apiError && g.isCorrect).length;

            results.push({ round, total: finished.length, correct, failed });
            runningCorrect += correct;
            runningTotal   += finished.length;
            runningFailed  += failed;
            round++;
        }

        if (progFill)  progFill.style.width = '100%';
        if (progLabel) progLabel.textContent = 'COMPLETE';
        const finalSuccessful = runningTotal - runningFailed;
        if (progStats && finalSuccessful > 0) {
            const acc = ((runningCorrect / finalSuccessful) * 100).toFixed(1);
            progStats.textContent = `${runningCorrect} / ${finalSuccessful} CORRECT (${acc}%)${runningFailed ? `  ·  ${runningFailed} FAILED` : ''}`;
        }

        const approachName = document.getElementById('simApproachSelect')?.selectedOptions[0]?.textContent ?? '';
        lastSimulationResults = { season, approachIndex, approachName, results };

        setTimeout(() => {
            if (progress) progress.style.display = 'none';
            renderSimulationTable(season, results);
            if (saveBtn) saveBtn.disabled = false;
        }, 600);
    } catch (err) {
        if (progress) progress.style.display = 'none';
        container.innerHTML = '<div class="football-placeholder">SIMULATION ERROR</div>';
        showError('SIMULATION FAILED');
        console.error(err);
    } finally {
        if (btn) { btn.textContent = '[ RUN SIMULATION ]'; btn.disabled = false; }
    }
}

function buildSimulationChart(results) {
    const W = 560, H = 180;
    const pad = { top: 20, right: 20, bottom: 36, left: 46 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;
    const n = results.length;

    const pcts = results.map(r => {
        const successful = r.total - r.failed;
        return successful > 0 ? (r.correct / successful) * 100 : 0;
    });
    const xOf  = i => n > 1 ? (i / (n - 1)) * plotW : plotW / 2;
    const yOf  = v => plotH - (v / 100) * plotH;

    // Grid lines
    let grid = '';
    [0, 20, 40, 60, 71, 80, 85, 100].forEach(v => {
        const y = yOf(v);
        const isGood = v === 85, isMid = v === 71;
        const stroke = isGood ? 'rgba(0,255,0,0.35)' : isMid ? 'rgba(255,170,0,0.35)' : 'rgba(30,42,94,0.8)';
        const dash   = (isGood || isMid) ? '5,3' : '2,5';
        grid += `<line x1="0" y1="${y.toFixed(1)}" x2="${plotW}" y2="${y.toFixed(1)}"
                       stroke="${stroke}" stroke-width="0.8" stroke-dasharray="${dash}"/>`;
        grid += `<text x="-6" y="${(y + 4).toFixed(1)}" text-anchor="end"
                       font-family="IBM Plex Mono,monospace" font-size="8" fill="#606880">${v}%</text>`;
    });

    // X axis labels — skip labels if too crowded (show every nth)
    const labelStep = n > 30 ? 5 : n > 15 ? 2 : 1;
    let xLabels = '';
    results.forEach((r, i) => {
        if (i === 0 || i === n - 1 || (r.round % labelStep === 0)) {
            xLabels += `<text x="${xOf(i).toFixed(1)}" y="${(plotH + 16).toFixed(1)}"
                              text-anchor="middle" font-family="IBM Plex Mono,monospace"
                              font-size="8" fill="#606880">${r.round}</text>`;
        }
    });

    // Area path
    const ptStr = pcts.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p).toFixed(1)}`).join(' L ');
    const areaD = `M ${xOf(0).toFixed(1)},${yOf(pcts[0]).toFixed(1)} L ${ptStr} `
                + `L ${xOf(n - 1).toFixed(1)},${plotH} L ${xOf(0).toFixed(1)},${plotH} Z`;
    const lineD = `M ${ptStr}`;

    // Dots with per-point colours
    let dots = '';
    pcts.forEach((p, i) => {
        const cx = xOf(i).toFixed(1);
        const cy = yOf(p).toFixed(1);
        const col = p > 85 ? '#00ff00' : p >= 71 ? '#ffaa00' : '#ff3366';
        dots += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${col}" filter="url(#scGlow)">
                     <title>RND ${results[i].round}: ${p.toFixed(1)}%</title>
                 </circle>`;
    });

    return `<svg class="sim-chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        <defs>
            <filter id="scGlow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="2.5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <linearGradient id="scArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stop-color="#00fff9" stop-opacity="0.18"/>
                <stop offset="100%" stop-color="#00fff9" stop-opacity="0"/>
            </linearGradient>
        </defs>
        <g transform="translate(${pad.left},${pad.top})">
            ${grid}
            <line x1="0" y1="${plotH}" x2="${plotW}" y2="${plotH}" stroke="#1e2a5e" stroke-width="1"/>
            <line x1="0" y1="0"       x2="0"       y2="${plotH}" stroke="#1e2a5e" stroke-width="1"/>
            <path d="${areaD}" fill="url(#scArea)"/>
            <path d="${lineD}" fill="none" stroke="#00fff9" stroke-width="1.5" filter="url(#scGlow)" stroke-linejoin="round"/>
            ${dots}
            ${xLabels}
            <text x="${(plotW / 2).toFixed(1)}" y="${(plotH + 30).toFixed(1)}"
                  text-anchor="middle" font-family="IBM Plex Mono,monospace"
                  font-size="8" fill="#404860" letter-spacing="2">ROUND</text>
        </g>
    </svg>`;
}

function renderSimulationTable(season, results) {
    const container = document.getElementById('simulationContainer');
    if (!results.length) {
        container.innerHTML = '<div class="football-placeholder">NO FINISHED GAMES FOUND</div>';
        return;
    }

    const totalCorrect    = results.reduce((s, r) => s + r.correct, 0);
    const totalGames      = results.reduce((s, r) => s + r.total, 0);
    const totalFailed     = results.reduce((s, r) => s + r.failed, 0);
    const totalSuccessful = totalGames - totalFailed;
    const overallPct      = totalSuccessful > 0 ? ((totalCorrect / totalSuccessful) * 100).toFixed(1) : '0.0';

    function scoreCls(pct) {
        return parseFloat(pct) >  85 ? 'sim-score--good'
             : parseFloat(pct) >= 71 ? 'sim-score--mid'
             : 'sim-score--bad';
    }

    let tableHtml = `<table class="simulation-table">
        <thead>
            <tr>
                <th>SEASON</th>
                <th>ROUND</th>
                <th>TOTAL</th>
                <th>CORRECT</th>
                <th>FAILED</th>
                <th>SCORE</th>
            </tr>
        </thead>
        <tbody>`;

    results.forEach(r => {
        const successful = r.total - r.failed;
        const pct = successful > 0 ? ((r.correct / successful) * 100).toFixed(1) : '0.0';
        tableHtml += `<tr>
            <td>${season?.year ?? '—'}</td>
            <td>${r.round}</td>
            <td>${r.total}</td>
            <td>${r.correct}</td>
            <td class="${r.failed > 0 ? 'sim-score--bad' : ''}">${r.failed > 0 ? r.failed : '—'}</td>
            <td class="${scoreCls(pct)}">${pct}%</td>
        </tr>`;
    });

    tableHtml += `</tbody>
        <tfoot>
            <tr class="sim-total-row">
                <td colspan="2">TOTAL</td>
                <td>${totalGames}</td>
                <td>${totalCorrect}</td>
                <td class="${totalFailed > 0 ? 'sim-score--bad' : ''}">${totalFailed > 0 ? totalFailed : '—'}</td>
                <td class="${scoreCls(overallPct)}">${overallPct}%</td>
            </tr>
        </tfoot>
    </table>`;

    container.innerHTML =
        `<div class="sim-chart-wrap">${buildSimulationChart(results)}</div>` +
        `<div class="sim-table-wrap">${tableHtml}</div>`;
}

let simResultsApproachesLoaded = false;

async function populateSimResultsApproachSelect() {
    if (simResultsApproachesLoaded) return;
    const select = document.getElementById('simResultsApproachSelect');
    if (!select) return;
    try {
        const approaches = await loadPredictionApproaches();
        approaches.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.index;
            opt.textContent = a.name.toUpperCase();
            if (a.description) opt.title = a.description;
            select.appendChild(opt);
        });
        simResultsApproachesLoaded = true;
    } catch (err) {
        console.error('Failed to populate sim results approach select:', err);
    }
}

async function loadSavedSimulations() {
    const container = document.getElementById('simResultsContainer');
    const approachVal = document.getElementById('simResultsApproachSelect')?.value;
    const btn = document.getElementById('simResultsLoadBtn');

    if (btn) { btn.textContent = '[ LOADING... ]'; btn.disabled = true; }
    container.innerHTML = '<div class="football-placeholder">LOADING...</div>';

    try {
        const params = new URLSearchParams();
        if (approachVal !== '') params.set('approach', approachVal);
        if (currentSeasonId)   params.set('seasonId', currentSeasonId);

        const qs  = params.toString();
        const url = `${getApiBase()}/api/Prediction/simulation${qs ? '?' + qs : ''}`;
        const res = await apiFetch(url, { headers: { 'accept': '*/*' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();

        renderSavedSimulationsTable(data);
    } catch (err) {
        container.innerHTML = '<div class="football-placeholder">ERROR LOADING RESULTS</div>';
        showError('FAILED TO LOAD SIMULATION RESULTS');
        console.error(err);
    } finally {
        if (btn) { btn.textContent = '[ LOAD RESULTS ]'; btn.disabled = false; }
    }
}

async function deleteSimulationResults() {
    const approachVal = document.getElementById('simResultsApproachSelect')?.value;
    const btn = document.getElementById('simResultsDeleteBtn');

    if (approachVal === '') {
        showError('SELECT AN APPROACH TO DELETE');
        return;
    }

    if (!confirm('DELETE all saved simulation results for this approach? This cannot be undone.')) return;

    if (btn) { btn.textContent = '[ DELETING... ]'; btn.disabled = true; }

    try {
        const params = new URLSearchParams();
        params.set('approach', approachVal);
        if (currentSeasonId) params.set('seasonId', currentSeasonId);

        const url = `${getApiBase()}/api/Prediction/simulation?${params.toString()}`;
        const res = await apiFetch(url, { method: 'DELETE', headers: { 'accept': '*/*' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);

        showSuccess('SIMULATION RESULTS DELETED');
        await loadSavedSimulations();
    } catch (err) {
        showError('FAILED TO DELETE SIMULATION RESULTS');
        console.error(err);
    } finally {
        if (btn) { btn.textContent = '[ DELETE RESULTS ]'; btn.disabled = false; }
    }
}

function renderSavedSimulationsTable(data) {
    const container = document.getElementById('simResultsContainer');
    if (!data?.length) {
        container.innerHTML = '<div class="football-placeholder">NO SAVED RESULTS FOUND</div>';
        return;
    }

    const approaches = cachedApproaches || [];

    // Group by seasonId then approach for organised display
    const rows = data.map(r => {
        const season   = footballSeasons.find(s => s.id === r.seasonId);
        const approach = approaches.find(a => a.index === r.approach);
        const scorePct = (r.score * 100).toFixed(1);
        const cls      = parseFloat(scorePct) >  85 ? 'sim-score--good'
                       : parseFloat(scorePct) >= 71 ? 'sim-score--mid'
                       : 'sim-score--bad';
        return { seasonYear: season?.year ?? r.seasonId, approachName: approach?.name?.toUpperCase() ?? `#${r.approach}`, round: r.round, scorePct, cls };
    });

    // Sort by season → approach → round
    rows.sort((a, b) =>
        String(a.seasonYear).localeCompare(String(b.seasonYear)) ||
        a.approachName.localeCompare(b.approachName) ||
        a.round - b.round
    );

    let html = `<table class="simulation-table">
        <thead>
            <tr>
                <th>SEASON</th>
                <th>APPROACH</th>
                <th>ROUND</th>
                <th>SCORE</th>
            </tr>
        </thead>
        <tbody>`;

    rows.forEach(r => {
        html += `<tr>
            <td>${r.seasonYear}</td>
            <td>${r.approachName}</td>
            <td>${r.round}</td>
            <td class="${r.cls}">${r.scorePct}%</td>
        </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = `<div class="sim-table-wrap">${html}</div>`;
}

async function runAllApproaches() {
    runAllCancelled = false;

    const countryId = document.getElementById('countrySelect')?.value;
    if (!countryId) { showError('NO COUNTRY SELECTED — USE THE SIDEBAR'); return; }

    const allBtn    = document.getElementById('simRunAllBtn');
    const runBtn    = document.getElementById('simRunBtn');
    const saveBtn   = document.getElementById('simSaveBtn');
    const container = document.getElementById('simulationContainer');
    const titleEl   = document.getElementById('simAllTitle');

    const fillLeague   = document.getElementById('simAllFillLeague');
    const fillSeason   = document.getElementById('simAllFillSeason');
    const fillApproach = document.getElementById('simAllFillApproach');
    const fillTotal    = document.getElementById('simAllFillTotal');
    const infoLeague   = document.getElementById('simAllInfoLeague');
    const infoSeason   = document.getElementById('simAllInfoSeason');
    const infoApproach = document.getElementById('simAllInfoApproach');
    const infoTotal    = document.getElementById('simAllInfoTotal');

    const setFill = (el, pct) => { if (el) el.style.width = `${Math.min(pct, 100).toFixed(1)}%`; };
    const setInfo = (el, txt)  => { if (el) el.textContent = txt; };

    if (allBtn)  { allBtn.textContent = '[ RUNNING... ]'; allBtn.disabled = true; }
    if (runBtn)  runBtn.disabled  = true;
    if (saveBtn) saveBtn.disabled = true;

    container.innerHTML = '';
    // ── Resolve batch selections ──────────────────────────────────────────────
    const selectedLeagueIndices = [...document.querySelectorAll('#simBatchLeagueList .sim-batch-check:checked')]
        .map(cb => parseInt(cb.dataset.idx)).filter(i => !isNaN(i));
    const selectedSeasonYears = new Set(
        [...document.querySelectorAll('#simBatchSeasonList .sim-batch-check:checked')].map(cb => String(cb.dataset.year))
    );
    const selectedApproachIndices = new Set(
        [...document.querySelectorAll('#simBatchApproachList .sim-batch-check:checked')].map(cb => parseInt(cb.dataset.index))
    );

    if (!selectedLeagueIndices.length)   { showError('NO LEAGUES SELECTED — USE BATCH CONFIGURATION'); return; }
    if (!selectedSeasonYears.size)        { showError('NO SEASONS SELECTED — USE BATCH CONFIGURATION'); return; }
    if (!selectedApproachIndices.size)    { showError('NO APPROACHES SELECTED — USE BATCH CONFIGURATION'); return; }

    const cancelBtn = document.getElementById('simCancelBtn');
    if (cancelBtn) cancelBtn.style.display = '';
    [fillLeague, fillSeason, fillApproach, fillTotal].forEach(f => setFill(f, 0));
    [infoLeague, infoSeason, infoApproach, infoTotal].forEach(i => setInfo(i, '—'));
    if (titleEl) titleEl.textContent = 'BUILDING WORK LIST...';

    const ASSUMED_MAX_ROUNDS = 38;
    let roundsSaved = 0;
    let saveErrors  = 0;
    let seasonsDone = 0;

    try {
        const allApproaches = await loadPredictionApproaches();
        const approaches    = allApproaches.filter(a => selectedApproachIndices.has(a.index));
        const totalApproach = approaches.length;

        // ── Phase 1: build work list from batch-selected leagues & season years ─
        // { leagueId, leagueName, seasonId, seasonYear }
        const work = [];

        for (const idx of selectedLeagueIndices) {
            if (runAllCancelled) break;
            const league = batchLeaguesData[idx];
            if (!league) continue;
            if (titleEl) titleEl.textContent = `SCANNING: ${league.name.toUpperCase()}`;

            // Use cached seasons from batch UI if available, else fetch
            if (!league.seasons) {
                const res = await apiFetch(`${getApiBase()}/api/Football/leagues/${league.id}/seasons`, { headers: { 'accept': '*/*' } });
                league.seasons = res.ok ? (await res.json()).filter(s => !s.isActive) : [];
            }

            league.seasons
                .filter(s => selectedSeasonYears.has(String(s.year)))
                .forEach(s => work.push({ leagueId: league.id, leagueName: league.name, seasonId: s.id, seasonYear: s.year }));
        }

        if (runAllCancelled) { showCancelState(); return; }

        // ── Phase 2: group by league and run ─────────────────────────────────
        const byLeague = new Map();
        for (const w of work) {
            if (!byLeague.has(w.leagueId))
                byLeague.set(w.leagueId, { leagueName: w.leagueName, seasons: [] });
            byLeague.get(w.leagueId).seasons.push(w);
        }

        const totalLeagues  = byLeague.size;
        const totalSeasons  = work.length;
        const estimatedTotal = totalSeasons * totalApproach * ASSUMED_MAX_ROUNDS;

        if (titleEl) titleEl.textContent = 'RUNNING BATCH';

        let leaguesDone = 0;

        for (const [, { leagueName, seasons }] of byLeague) {
            if (runAllCancelled) break;
            leaguesDone++;
            setFill(fillLeague, (leaguesDone / totalLeagues) * 100);
            setInfo(infoLeague, `${leaguesDone}/${totalLeagues} — ${leagueName.toUpperCase()}`);

            setFill(fillSeason, 0);
            let seasonsInLeague = 0;

            for (const { seasonId, seasonYear } of seasons) {
                if (runAllCancelled) break;
                seasonsInLeague++;
                seasonsDone++;
                setFill(fillSeason, (seasonsInLeague / seasons.length) * 100);
                setInfo(infoSeason, `${seasonsInLeague}/${seasons.length} — ${seasonYear}`);

                setFill(fillApproach, 0);

                for (let ai = 0; ai < approaches.length; ai++) {
                    if (runAllCancelled) break;
                    const approach = approaches[ai];
                    setFill(fillApproach, (ai / totalApproach) * 100);
                    setInfo(infoApproach, `${ai + 1}/${totalApproach} — ${approach.name.toUpperCase()}`);

                    let round = 1;
                    while (!runAllCancelled) {
                        setFill(fillTotal, (roundsSaved / estimatedTotal) * 100);
                        setInfo(infoTotal,
                            `${roundsSaved} ROUNDS SAVED` +
                            (saveErrors ? ` · ${saveErrors} ERRORS` : ''));

                        const res = await fetch(
                            `${getApiBase()}/api/Football/seasons/${seasonId}/rounds/${round}/games`,
                            { headers: { 'accept': '*/*' } }
                        );
                        if (!res.ok) break;
                        const games = await res.json();
                        if (!games.length) break;

                        const gameResults = await Promise.all(games.map(async game => {
                            const hs  = game.homeFullTimeScore;
                            const as_ = game.outFullTimeScore;
                            if (hs == null || as_ == null) return null;
                            const actual = hs > as_ ? '1' : hs < as_ ? '2' : 'X';
                            try {
                                const predRes = await fetch(
                                    `${getApiBase()}/api/Prediction/predict?homeTeamId=${game.teamIdHome}&awayTeamId=${game.teamIdOut}&seasonId=${seasonId}&round=${round}&approach=${approach.index}`,
                                    { headers: { 'accept': '*/*' } }
                                );
                                if (!predRes.ok) {
                                    console.warn(`[RUN-ALL] Predict failed — season=${seasonId} round=${round} approach=${approach.index} home=${game.teamIdHome} away=${game.teamIdOut} status=${predRes.status}`);
                                    return { apiError: true };
                                }
                                const pred = await predRes.json();
                                const h = pred.homeWinProbability, d = pred.drawProbability, a = pred.awayWinProbability;
                                const predicted = pred.predictedResult ?? (h >= d && h >= a ? '1' : d >= a ? 'X' : '2');
                                return { apiError: false, isCorrect: predicted === actual };
                            } catch (err) {
                                console.warn(`[RUN-ALL] Predict error — season=${seasonId} round=${round} approach=${approach.index} home=${game.teamIdHome} away=${game.teamIdOut}`, err);
                                return { apiError: true };
                            }
                        }));

                        const finished   = gameResults.filter(g => g !== null);
                        const failed     = finished.filter(g => g.apiError).length;
                        const correct    = finished.filter(g => !g.apiError && g.isCorrect).length;
                        const successful = finished.length - failed;
                        const score      = successful > 0 ? correct / successful : 0;

                        try {
                            const saveRes = await fetch(
                                `${getApiBase()}/api/Prediction/simulation?seasonId=${seasonId}&round=${round}&approach=${approach.index}&score=${score}`,
                                { method: 'POST', headers: { 'accept': '*/*' } }
                            );
                            if (!saveRes.ok) throw new Error(`HTTP ${saveRes.status}`);
                            roundsSaved++;
                        } catch (err) {
                            console.warn(`[RUN-ALL] Save failed — season=${seasonId} round=${round} approach=${approach.index}`, err);
                            saveErrors++;
                        }

                        round++;
                    }

                    setFill(fillApproach, ((ai + 1) / totalApproach) * 100);
                }
            }
        }

        if (runAllCancelled) {
            showCancelState();
            return;
        }

        // ── Complete ──────────────────────────────────────────────────────────
        [fillLeague, fillSeason, fillApproach, fillTotal].forEach(f => setFill(f, 100));
        setInfo(infoTotal, `${roundsSaved} ROUNDS SAVED${saveErrors ? ` · ${saveErrors} ERRORS` : ''}`);
        if (titleEl) titleEl.textContent = `COMPLETE — ${leaguesDone} LEAGUES · ${seasonsDone} SEASONS · ${totalApproach} APPROACHES`;
        showSuccess('BATCH COMPLETE');

        setTimeout(() => {
            if (cancelBtn) cancelBtn.style.display = 'none';
            container.innerHTML = `<div class="football-placeholder">COMPLETE — ${roundsSaved} ROUNDS SAVED ACROSS ${seasonsDone} SEASONS</div>`;
        }, 2000);

    } catch (err) {
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (titleEl) titleEl.textContent = 'BATCH STATUS';
        container.innerHTML = '<div class="football-placeholder">ERROR</div>';
        showError('BATCH RUN FAILED');
        console.error(err);
    } finally {
        if (allBtn) { allBtn.textContent = '[ RUN BATCH ]'; allBtn.disabled = false; }
        if (runBtn) runBtn.disabled = false;
    }

    function showCancelState() {
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (titleEl) titleEl.textContent = 'CANCELLED';
        setInfo(infoTotal, `${roundsSaved} ROUNDS SAVED${saveErrors ? ` · ${saveErrors} ERRORS` : ''}`);
        container.innerHTML = `<div class="football-placeholder">CANCELLED — ${roundsSaved} ROUNDS SAVED BEFORE STOP</div>`;
    }
}

async function saveSimulationResults() {
    if (!lastSimulationResults) return;

    const { season, approachIndex, results } = lastSimulationResults;
    const seasonId = season?.id;
    if (!seasonId) { showError('NO SEASON DATA TO SAVE'); return; }

    const btn = document.getElementById('simSaveBtn');
    if (btn) { btn.textContent = '[ SAVING... ]'; btn.disabled = true; }

    try {
        await Promise.all(results.map(r => {
            const successful = r.total - r.failed;
            const score = successful > 0 ? r.correct / successful : 0;
            return fetch(
                `${getApiBase()}/api/Prediction/simulation?seasonId=${seasonId}&round=${r.round}&approach=${approachIndex}&score=${score}`,
                { method: 'POST', headers: { 'accept': '*/*' } }
            ).then(res => { if (!res.ok) throw new Error(`Round ${r.round}: HTTP ${res.status}`); });
        }));

        showSuccess('SIMULATION RESULTS SAVED');
    } catch (err) {
        showError('SAVE FAILED');
        console.error(err);
    } finally {
        if (btn) { btn.textContent = '[ SAVE RESULTS ]'; btn.disabled = false; }
    }
}
// ─────────────────────────────────────────────────────────────────────────────
