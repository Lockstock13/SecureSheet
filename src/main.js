import './style.css';
import { loadGoogleScripts, authenticate, revokeAccess, hasValidToken, downloadSync, uploadSync, silentReconnect, restoreToken, ensureSpreadsheetReady } from './gapi.js';

const currentPath = (() => {
    const path = window.location.pathname.replace(/\/+$/, '');
    return path === '' ? '/' : path;
})();

const isPagePath = (slug) => currentPath === `/${slug}` || currentPath.endsWith(`/${slug}.html`);

// 1. Dummy Database Defaults
const defaultDB = [
    {
        id: 'ENTRY-7729-DELTA',
        account_name: 'Amazon Web Services',
        username: 'admin_root_cluster',
        password: 'SUPER_SECRET_PASSWORD_123!',
        url: 'console.aws.amazon.com/iam/home',
        category: 'Work',
        notes: 'Production environment access. Requires MFA token from Yubikey #04. Rotated every 90 days. Next rotation: 2024-08-15. Contact DevSecOps for emergency override.',
        icon: 'language',
        color: 'on-surface-variant'
    },
    {
        id: 'ENTRY-1142-ALPHA',
        account_name: 'Chase Manhattan',
        username: 'u_financial_lead',
        password: 'my_bank_password_456',
        url: 'chase.com',
        category: 'Finance',
        notes: 'Corporate banking portal. Do not use from public Wi-Fi.',
        icon: 'account_balance',
        color: 'primary'
    },
    {
        id: 'ENTRY-9931-BETA',
        account_name: 'GitHub Enterprise',
        username: 'dev_ops_root',
        password: 'ghp_developer_token_789',
        url: 'github.com',
        category: 'Work',
        notes: 'Organization root account. Token expires in 30 days.',
        icon: 'work',
        color: 'tertiary'
    },
    {
        id: 'ENTRY-4412-GAMMA',
        account_name: 'LinkedIn Corp',
        username: 'm_anderson_pro',
        password: 'social_network_pass',
        url: 'linkedin.com',
        category: 'Social',
        notes: 'Professional networking account.',
        icon: 'share',
        color: 'secondary'
    },
    {
        id: 'ENTRY-8854-EPSILON',
        account_name: 'DigitalOcean',
        username: 'droplet_master',
        password: 'server_key_000',
        url: 'digitalocean.com',
        category: 'Work',
        notes: 'Cloud hosting provider. Billed to corporate card ending in 4412.',
        icon: 'terminal',
        color: 'primary'
    }
];

// Persistent localStorage Simulation
let DB = [];
const savedData = localStorage.getItem('vault_db');
if (savedData) {
    try {
        DB = JSON.parse(savedData);
    } catch(e) {
        DB = [...defaultDB];
    }
} else {
    DB = [...defaultDB];
    localStorage.setItem('vault_db', JSON.stringify(DB));
}

let syncTimeout = null;
const saveDB = () => {
    localStorage.setItem('vault_db', JSON.stringify(DB));
    // Mark pending upload so we can flush after navigation (e.g., /add redirects immediately).
    localStorage.setItem('securesheet_pending_upload', 'true');
    
    // Background Google Sync trigger if online
    if (window.gapi && gapi.client && gapi.client.getToken() !== null && localStorage.getItem('securesheet_spreadsheet_id')) {
        clearTimeout(syncTimeout);
        syncTimeout = setTimeout(async () => {
            console.log("Auto-uploading to Google Sheets...");
            const success = await uploadSync(DB);
            if(success) {
                localStorage.setItem('securesheet_last_sync', Date.now().toString());
                let count = parseInt(localStorage.getItem('securesheet_sync_count') || '0');
                localStorage.setItem('securesheet_sync_count', (count + 1).toString());
                localStorage.removeItem('securesheet_pending_upload');
                console.log("Auto-upload complete.");
            }
        }, 1500); // debounce 1.5s
    }
};

// Web Crypto SHA-256 Helper for Master Password
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

document.addEventListener('DOMContentLoaded', async () => {

    // --- GATEKEEPER ROUTING ---
    const isLockedPath = isPagePath('lock');
    const isUnlocked = sessionStorage.getItem('securesheet_unlocked') === 'true';
    
    if (!isUnlocked && !isLockedPath) {
        window.location.href = '/lock';
        return; // Halt execution
    }

    // --- LOCK SCREEN LOGIC (lock) ---
    if (isLockedPath) {
        const storedHash = localStorage.getItem('securesheet_master_hash');
        const isRegistration = (storedHash === null);

        const sub = document.getElementById('lock-subtitle');
        const lStatus = document.getElementById('lock-status');
        const lLabel = document.getElementById('lock-input-label');
        const pwdInput = document.getElementById('lock-pwd');
        const cfmGroup = document.getElementById('lock-confirm-group');
        const cfmInput = document.getElementById('lock-pwd-confirm');
        const btn = document.getElementById('lock-btn');
        const err = document.getElementById('lock-error');

        if (isRegistration) {
            sub.textContent = "INITIALIZING NEW VAULT";
            lStatus.className = "w-2 h-2 rounded-full bg-primary animate-pulse";
            lLabel.textContent = "CREATE MASTER PASSWORD";
            cfmGroup.classList.remove('hidden');
            cfmGroup.classList.add('flex');
            btn.innerHTML = `<span class="material-symbols-outlined text-[16px]">how_to_reg</span><span>Initialize Vault</span>`;
        } else {
            sub.textContent = "AWAITING AUTHORIZATION";
        }

        const resetBtn = document.getElementById('lock-reset');
        if (resetBtn && !isRegistration) {
            resetBtn.classList.remove('hidden');
            resetBtn.addEventListener('click', () => {
                const confirmReset = confirm("RESET LOCK PROTOCOL?\n\nThis will remove the current Master Password. Your vault data will NOT be deleted, but you will be asked to create a NEW Master Password immediately.\n\nProceed?");
                if (confirmReset) {
                    localStorage.removeItem('securesheet_master_hash');
                    location.reload();
                }
            });
        }

        const handleAuth = async () => {
            err.classList.add('hidden');
            const val1 = pwdInput.value;
            
            if (!val1) return;

            if (isRegistration) {
                const val2 = cfmInput.value;
                if (val1 !== val2) {
                    err.textContent = "PASSWORDS DO NOT MATCH!";
                    err.classList.remove('hidden');
                    return;
                }
                const hash = await sha256(val1);
                localStorage.setItem('securesheet_master_hash', hash);
                sessionStorage.setItem('securesheet_unlocked', 'true');
                window.location.href = '/';
            } else {
                const checkHash = await sha256(val1);
                if (checkHash === storedHash) {
                    sessionStorage.setItem('securesheet_unlocked', 'true');
                    window.location.href = '/';
                } else {
                    err.textContent = "ACCESS DENIED. INVALID HASH.";
                    err.classList.remove('hidden');
                    pwdInput.value = '';
                }
            }
        };

        btn.addEventListener('click', handleAuth);
        pwdInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') { if(isRegistration) cfmInput.focus(); else handleAuth(); } });
        cfmInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') handleAuth(); });

        return; // Don't run the rest of the app logic!
    }

    // --- GLOBAL TOP BAR LOGOUT BUTTON ---
    const lockButtons = document.querySelectorAll('.btn-lock-app');
    lockButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            sessionStorage.removeItem('securesheet_unlocked');
            window.location.href = '/lock';
        });
    });

    // --- GLOBAL SYNC STATUS (runs on EVERY page) ---
    const savedSheetId = localStorage.getItem('securesheet_spreadsheet_id');
    const flushPendingUploadIfNeeded = async () => {
        const pending = localStorage.getItem('securesheet_pending_upload') === 'true';
        if (!pending) return;

        const sheetId = localStorage.getItem('securesheet_spreadsheet_id');
        const hasToken = hasValidToken();
        if (!sheetId || !hasToken) return;

        try {
            console.log('[AutoSync] Pending upload detected. Flushing to Google Sheets...');
            const ok = await uploadSync(DB);
            if (ok) {
                localStorage.setItem('securesheet_last_sync', Date.now().toString());
                let count = parseInt(localStorage.getItem('securesheet_sync_count') || '0');
                localStorage.setItem('securesheet_sync_count', (count + 1).toString());
                localStorage.removeItem('securesheet_pending_upload');
                console.log('[AutoSync] Pending upload flushed.');
            }
        } catch (e) {
            console.warn('[AutoSync] Pending flush failed.', e);
        }
    };
    
    const updateSyncIndicators = () => {
        const dots = document.querySelectorAll('.sync-indicator');
        let isConnected = false;
        try { isConnected = window.gapi && gapi.client && gapi.client.getToken() !== null; } catch(e) {}
        
        dots.forEach(el => {
            if (isConnected) {
                el.className = 'sync-indicator w-2 h-2 rounded-full bg-green-400 animate-pulse';
                el.title = 'Google Sheets: Connected';
            } else if (savedSheetId) {
                el.className = 'sync-indicator w-2 h-2 rounded-full bg-yellow-500';
                el.title = 'Google Sheets: Disconnected (open Sync to reconnect)';
            } else {
                el.className = 'sync-indicator w-2 h-2 rounded-full bg-[#424754]';
                el.title = 'Google Sheets: Not Setup';
            }
        });
    };

    // Load Google scripts globally + restore token from session
    if (savedSheetId) {
        loadGoogleScripts(() => {
            // Try to restore token saved from previous page navigation
            const restored = restoreToken();
            if (restored) {
                console.log('[AutoSync] Token restored! Auto-sync is active.');
                // If we navigated away quickly (e.g., /add -> /), flush pending changes now.
                flushPendingUploadIfNeeded();
            } else {
                console.log('[AutoSync] No saved token. Connect via Sync page.');
            }
            updateSyncIndicators();
        });
    }

    // Poll indicator every 2s
    setInterval(updateSyncIndicators, 2000);
    updateSyncIndicators();


    // --- NAVIGATION BRIDGING (Global) ---
    function bridge(element, url) {
        if (!element || element.hasAttribute('data-linked')) return;
        element.setAttribute('data-linked', 'true');
        element.style.cursor = 'pointer';
        if (element.tagName.toLowerCase() === 'a') element.removeAttribute('href');
        element.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = url;
        });
    }

    const topNavItems = document.querySelectorAll('header *');
    topNavItems.forEach(item => {
        const text = item.textContent.trim().toLowerCase();
        if (text === 'vault') bridge(item, '/');
        else if (text === 'generator') bridge(item, '/generator');
        else if (text === 'sync') bridge(item, '/sync');
    });

    const bottomNavItems = document.querySelectorAll('nav > *');
    bottomNavItems.forEach(item => {
        const text = item.textContent.trim().toLowerCase();
        if (text.includes('vault')) bridge(item, '/');
        else if (text.includes('generator')) bridge(item, '/generator');
        else if (text.includes('sync')) bridge(item, '/sync');
    });

    // --- VAULT LIST (index.html) ---
    const vaultContainer = document.getElementById('vault-entries');
    if (vaultContainer) {
        let activeCategory = 'All';
        let searchQuery = '';

        const renderVault = () => {
            vaultContainer.innerHTML = '';
            
            // 1. Filter by category
            let filteredDB = activeCategory === 'All' ? DB : DB.filter(item => item.category === activeCategory);
            
            // 2. Filter by search query
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                filteredDB = filteredDB.filter(item => 
                    item.account_name.toLowerCase().includes(q) || 
                    (item.url && item.url.toLowerCase().includes(q)) ||
                    item.username.toLowerCase().includes(q)
                );
            }

            if (filteredDB.length === 0) {
                vaultContainer.innerHTML = `<div class="p-4 text-center text-on-surface-variant font-label text-sm uppercase bg-surface-container-high border-l-2 border-primary">No credentials found for [${activeCategory}] ${searchQuery ? 'matching "' + searchQuery + '"' : ''}</div>`;
                return;
            }

            filteredDB.forEach(entry => {
                // Dynamic weak password detection
                const isWeak = !entry.password || entry.password.length < 8 || 
                    !/[A-Z]/.test(entry.password) || !/[0-9]/.test(entry.password) || !/[^A-Za-z0-9]/.test(entry.password);
                const borderClass = isWeak ? 'border-r-2 border-r-error' : '';
                const warningTag = isWeak ? `<div class="px-2 py-0.5 bg-error/10 text-error text-[8px] font-bold uppercase tracking-widest rounded-sm mr-2">Weak PWD</div>` : '';

                const html = `
                <div class="group flex items-center justify-between bg-surface-container-high p-3 hover:bg-surface-container-highest transition-all duration-150 cursor-pointer ${borderClass}" data-id="${entry.id}">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-surface-container-lowest flex items-center justify-center border border-outline-variant/10">
                            <span class="material-symbols-outlined text-${entry.color}" data-icon="${entry.icon}">${entry.icon}</span>
                        </div>
                        <div>
                            <h3 class="text-sm font-bold font-headline text-on-surface leading-none mb-1">${entry.account_name}</h3>
                            <p class="text-[10px] font-label text-on-surface-variant">${entry.url} • <span class="text-primary-container">${entry.username}</span></p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        ${warningTag}
                        <span class="material-symbols-outlined text-on-surface-variant text-sm hover:text-primary action-btn" title="Copy">content_copy</span>
                        <span class="material-symbols-outlined text-on-surface-variant text-sm hover:text-primary action-btn" title="Open Link">open_in_new</span>
                    </div>
                </div>
                `;
                const div = document.createElement('div');
                div.innerHTML = html.trim();
                const node = div.firstChild;

                node.addEventListener('click', (e) => {
                    if (e.target.classList.contains('action-btn')) {
                        if (e.target.textContent === 'content_copy') {
                            navigator.clipboard.writeText(entry.password);
                            const orig = e.target.textContent;
                            e.target.textContent = 'check';
                            e.target.classList.add('text-primary');
                            setTimeout(() => {
                                e.target.textContent = orig;
                                e.target.classList.remove('text-primary');
                            }, 1000);
                        } else if(e.target.textContent === 'open_in_new') {
                             window.open(entry.url.includes('http') ? entry.url : 'https://' + entry.url, '_blank');
                        }
                        return;
                    }
                    window.location.href = `/details?id=${entry.id}`;
                });
                
                vaultContainer.appendChild(node);
            });
        };

        const categoryButtons = document.querySelectorAll('.flex-wrap.gap-2 > button');
        categoryButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                categoryButtons.forEach(b => {
                    b.className = "px-3 py-1 bg-surface-container-high text-on-surface-variant text-[10px] font-bold font-['Space_Grotesk'] uppercase tracking-widest rounded-sm hover:bg-surface-container-highest transition-colors";
                });
                btn.className = "px-3 py-1 bg-primary-container text-on-primary-container text-[10px] font-bold font-['Space_Grotesk'] uppercase tracking-widest rounded-sm";
                
                activeCategory = btn.textContent.trim();
                renderVault();
            });
        });

        const searchInput = document.getElementById('vault-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.trim();
                renderVault();
            });
        }

        // --- DASHBOARD STATS DYNAMIC CALCULATION ---
        const updateStats = () => {
            // "Total count" is already updating totalStat earlier, let's centralize.
            const statsCards = document.querySelectorAll('section.grid .bg-surface-container-high .text-xl');
            if (statsCards.length >= 4) {
                const totalEl = statsCards[0];
                const weakEl = statsCards[1];
                const healthEl = statsCards[2];
                const syncEl = statsCards[3];

                totalEl.textContent = DB.length.toString();

                let weakCount = 0;
                DB.forEach(entry => {
                    if (!entry.password) weakCount++;
                    else if (entry.password.length < 8) weakCount++;
                    else if (!/[A-Z]/.test(entry.password) || !/[0-9]/.test(entry.password) || !/[^A-Za-z0-9]/.test(entry.password)) weakCount++;
                });

                weakEl.textContent = weakCount.toString().padStart(2, '0');
                
                let health = 100;
                if(DB.length > 0) {
                    health = Math.round(((DB.length - weakCount) / DB.length) * 100);
                }
                healthEl.textContent = health + '%';

                // We change color of health purely based on strict bounds
                healthEl.className = `text-xl font-bold font-['Manrope'] ${health < 50 ? 'text-error' : (health < 80 ? 'text-tertiary' : 'text-primary')}`;

                if (window.gapi && localStorage.getItem('securesheet_spreadsheet_id')) {
                    syncEl.textContent = "LIVE";
                    syncEl.className = "text-xl font-bold font-['Manrope'] text-primary";
                } else {
                    syncEl.textContent = "OFF";
                    syncEl.className = "text-xl font-bold font-['Manrope'] text-on-surface-variant";
                }
            }
        };

        updateStats();
        // Hook updateStats so when API initializes it reflects LIVE state later
        setInterval(updateStats, 2000);

        // --- Fix #6-9: Dynamic footer ---
        const updateFooter = () => {
            const fSync = document.getElementById('footer-last-sync');
            const fConn = document.getElementById('footer-conn-status');
            if (fSync) {
                const ts = localStorage.getItem('securesheet_last_sync');
                if (ts) {
                    const d = new Date(parseInt(ts));
                    fSync.textContent = 'Last Sync: ' + d.toLocaleString();
                }
            }
            if (fConn) {
                const sid = localStorage.getItem('securesheet_spreadsheet_id');
                fConn.textContent = sid ? 'Connection: Google Sheets Linked' : 'Connection: Offline';
            }
        };
        updateFooter();
        setInterval(updateFooter, 3000); 

        // Initial render
        renderVault();
    }

    // --- ADD ENTRY PAGE (add) ---
    const isAddPage = isPagePath('add');
    if (isAddPage) {
        const saveBtn = document.getElementById('btn-save-entry');
        const togglePwdBtn = document.getElementById('toggle-pwd-btn');
        const togglePinBtn = document.getElementById('toggle-pin-btn');
        const pwdInput = document.getElementById('add-password');
        const pinInput = document.getElementById('add-pin');
        
        if(togglePwdBtn) {
            let show = false;
            togglePwdBtn.addEventListener('click', () => {
                show = !show;
                pwdInput.type = show ? 'text' : 'password';
                togglePwdBtn.textContent = show ? 'visibility_off' : 'visibility';
            });
        }

        if(togglePinBtn) {
            let showPin = false;
            togglePinBtn.addEventListener('click', () => {
                showPin = !showPin;
                pinInput.type = showPin ? 'text' : 'password';
                togglePinBtn.textContent = showPin ? 'visibility_off' : 'visibility';
            });
        }

        // Catch Generator password if passing through
        const urlParams = new URLSearchParams(window.location.search);
        const prefillPwd = urlParams.get('pwd');
        if (prefillPwd) {
            pwdInput.value = prefillPwd;
            pwdInput.type = 'text'; // Make it visible initially
            if(togglePwdBtn) togglePwdBtn.textContent = 'visibility_off';
        }

        // Catch Edit Mode
        const editId = urlParams.get('edit');
        if (editId) {
            const entryToEdit = DB.find(i => i.id === editId);
            if (entryToEdit) {
                document.querySelector('span.text-xs.font-black').textContent = 'EDIT ENTRY';
                saveBtn.textContent = 'SAVE CHANGES';
                document.getElementById('add-account-name').value = entryToEdit.account_name;
                document.getElementById('add-category').value = entryToEdit.category;
                document.getElementById('add-url').value = entryToEdit.url || '';
                document.getElementById('add-username').value = entryToEdit.username;
                pwdInput.value = entryToEdit.password;
                if (pinInput && entryToEdit.pin) pinInput.value = entryToEdit.pin;
                document.getElementById('add-notes').value = entryToEdit.notes || '';
            }
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const account = document.getElementById('add-account-name').value.trim();
                const category = document.getElementById('add-category').value;
                const url = document.getElementById('add-url').value.trim();
                const username = document.getElementById('add-username').value.trim();
                const password = pwdInput.value;
                const pin = pinInput ? pinInput.value : '';
                const notes = document.getElementById('add-notes').value.trim();

                if (!account || !username || !password) {
                    alert("Please fill all required fields (Site Name, Username, Password)");
                    return;
                }
                
                // Guess icon and color
                const iconMap = { 'Finance': 'account_balance', 'Work': 'work', 'Social': 'share', 'Other': 'vpn_key' };
                const colorMap = { 'Finance': 'primary', 'Work': 'tertiary', 'Social': 'secondary', 'Other': 'on-surface-variant' };

                if (editId) {
                    // Update existing
                    const idx = DB.findIndex(i => i.id === editId);
                    if (idx !== -1) {
                        DB[idx] = {
                            ...DB[idx],
                            account_name: account,
                            username: username,
                            password: password,
                            pin: pin,
                            url: url,
                            category: category,
                            notes: notes,
                            icon: iconMap[category] || 'vpn_key',
                            color: colorMap[category] || 'primary'
                        };
                    }
                } else {
                    // Create new
                    const newId = 'ENTRY-' + Math.floor(1000 + Math.random() * 9000) + '-NEW';
                    const newEntry = {
                        id: newId,
                        account_name: account,
                        username: username,
                        password: password,
                        pin: pin,
                        url: url,
                        category: category,
                        notes: notes,
                        icon: iconMap[category] || 'vpn_key',
                        color: colorMap[category] || 'primary'
                    };
                    DB.push(newEntry);
                }

                saveDB();

                // Redirect to Dashboard
                window.location.href = '/';
            });
        }
    }

    // --- DETAILS PAGE (details) ---
    const isDetailsPage = isPagePath('details');
    if (isDetailsPage) {
        const urlParams = new URLSearchParams(window.location.search);
        let currentId = urlParams.get('id');
        
        // Fallback for direct testing without clicking
        if (!currentId) currentId = 'ENTRY-7729-DELTA';
        
        const entry = DB.find(i => i.id === currentId);

        if (entry) {
            const breadcrumbEl = document.getElementById('det-breadcrumb');
            if(breadcrumbEl) breadcrumbEl.textContent = entry.account_name;

            document.getElementById('det-account-name').textContent = entry.account_name;
            document.getElementById('det-id').textContent = 'ID: ' + entry.id;
            document.getElementById('det-site-name').textContent = entry.account_name;
            document.getElementById('det-url').textContent = entry.url || 'N/A';
            
            const linkUrl = document.getElementById('det-link-url');
            if(entry.url && entry.url.length > 0) {
                 linkUrl.href = entry.url.includes('http') ? entry.url : 'https://' + entry.url;
            } else {
                 linkUrl.style.display = 'none';
            }
            
            document.getElementById('det-username').textContent = entry.username;
            
            const pwdEl = document.getElementById('det-password');
            pwdEl.setAttribute('data-password', entry.password);
            pwdEl.textContent = '••••••••••••••••';

            const pinEl = document.getElementById('det-pin');
            if (pinEl) {
                const thePin = entry.pin || '';
                pinEl.setAttribute('data-pin', thePin);
                pinEl.textContent = thePin ? '••••' : 'NONE';
            }

            document.getElementById('det-notes').textContent = entry.notes || 'No notes available.';

            // Simple Password Toggle logic
            const toggleBtn = document.getElementById('det-toggle-password');
            if(toggleBtn) {
                let show = false;
                toggleBtn.addEventListener('click', () => {
                    show = !show;
                    pwdEl.textContent = show ? entry.password : '••••••••••••••••';
                    toggleBtn.textContent = show ? 'visibility_off' : 'visibility';
                });
            }

            // Simple PIN Toggle logic
            const togglePinBtn = document.getElementById('det-toggle-pin');
            if(togglePinBtn && entry.pin) {
                let showPin = false;
                togglePinBtn.addEventListener('click', () => {
                    showPin = !showPin;
                    pinEl.textContent = showPin ? entry.pin : '••••';
                    togglePinBtn.textContent = showPin ? 'visibility_off' : 'visibility';
                });
            }

            // Copy logic
            const attachCopy = (btnId, textToCopy) => {
                const btn = document.getElementById(btnId);
                if(btn) {
                    btn.addEventListener('click', () => {
                        navigator.clipboard.writeText(textToCopy);
                        const orig = btn.textContent;
                        btn.textContent = 'check';
                        btn.classList.add('text-primary');
                        setTimeout(() => {
                            btn.textContent = orig;
                            btn.classList.remove('text-primary');
                        }, 1000);
                    });
                }
            }
            attachCopy('det-copy-site', entry.account_name);
            attachCopy('det-copy-username', entry.username);
            attachCopy('det-copy-password', entry.password);
            if(entry.pin) attachCopy('det-copy-pin', entry.pin);

            // Action Buttons
            const btnEdit = document.getElementById('det-btn-edit');
            const btnDelete = document.getElementById('det-btn-delete');

            if(btnEdit) {
                btnEdit.addEventListener('click', () => {
                    window.location.href = `/add?edit=${entry.id}`;
                });
            }

            if(btnDelete) {
                btnDelete.addEventListener('click', () => {
                    const confirmDel = confirm(`Are you absolutely sure you want to delete [${entry.account_name}]? This action cannot be reversed.`);
                    if(confirmDel) {
                        DB = DB.filter(i => i.id !== entry.id);
                        saveDB();
                        window.location.href = '/';
                    }
                });
            }

            // --- Fix #2: Dynamic Password Strength Bar ---
            const strengthBar = document.getElementById('det-strength-bar');
            const strengthPct = document.getElementById('det-strength-pct');
            if (strengthBar && strengthPct && entry.password) {
                let score = 0;
                const pwd = entry.password;
                if (pwd.length >= 8) score += 20;
                if (pwd.length >= 12) score += 10;
                if (pwd.length >= 16) score += 10;
                if (/[A-Z]/.test(pwd)) score += 15;
                if (/[a-z]/.test(pwd)) score += 10;
                if (/[0-9]/.test(pwd)) score += 15;
                if (/[^A-Za-z0-9]/.test(pwd)) score += 20;
                score = Math.min(score, 100);
                
                strengthBar.style.width = score + '%';
                strengthPct.textContent = score + '%';
                
                if (score < 40) {
                    strengthBar.className = 'h-full bg-error';
                    strengthPct.className = 'font-label text-[10px] text-error';
                } else if (score < 70) {
                    strengthBar.className = 'h-full bg-tertiary';
                    strengthPct.className = 'font-label text-[10px] text-tertiary';
                } else {
                    strengthBar.className = 'h-full bg-primary';
                    strengthPct.className = 'font-label text-[10px] text-primary';
                }
            }

            // --- Fix #3: Dynamic Sync Status ---
            const syncDot = document.getElementById('det-sync-dot');
            const syncLabel = document.getElementById('det-sync-label');
            if (syncDot && syncLabel) {
                const sheetId = localStorage.getItem('securesheet_spreadsheet_id');
                const lastSync = localStorage.getItem('securesheet_last_sync');
                if (sheetId && lastSync) {
                    syncDot.className = 'w-1.5 h-1.5 bg-primary rounded-full';
                    syncLabel.textContent = 'SYNCED';
                    syncLabel.className = 'font-label text-[10px] text-primary';
                } else if (sheetId) {
                    syncDot.className = 'w-1.5 h-1.5 bg-tertiary rounded-full';
                    syncLabel.textContent = 'CONNECTED';
                    syncLabel.className = 'font-label text-[10px] text-tertiary';
                } else {
                    syncDot.className = 'w-1.5 h-1.5 bg-outline rounded-full';
                    syncLabel.textContent = 'LOCAL ONLY';
                    syncLabel.className = 'font-label text-[10px] text-on-surface-variant';
                }
            }

        } else {
            // Document not found
            document.getElementById('det-account-name').textContent = 'RECORD NOT FOUND';
        }
    }

    // --- GENERATOR PAGE (generator) ---
    const isGeneratorPage = isPagePath('generator');
    if (isGeneratorPage) {
        const outEl = document.getElementById('gen-output');
        const lengthInput = document.getElementById('gen-length');
        const lengthVal = document.getElementById('gen-length-val');
        const btnRegen = document.getElementById('gen-regen');
        const btnCopy = document.getElementById('gen-copy');
        const btnStore = document.getElementById('gen-store');
        
        // Toggles
        const tUpper = document.getElementById('gen-toggle-upper');
        const tNum = document.getElementById('gen-toggle-num');
        const tSym = document.getElementById('gen-toggle-sym');
        const tSan = document.getElementById('gen-toggle-san');

        const toggleState = (el) => {
            const isActive = el.getAttribute('data-active') === 'true';
            const newState = !isActive;
            el.setAttribute('data-active', newState);
            
            const bg = el.querySelector('.toggle-bg');
            const knob = el.querySelector('.toggle-knob');
            
            if (newState) {
                bg.className = "toggle-bg w-10 h-5 bg-primary-container flex items-center justify-end px-1 rounded-sm transition-colors";
                knob.className = "toggle-knob w-3 h-3 bg-on-primary-container transition-transform";
            } else {
                bg.className = "toggle-bg w-10 h-5 bg-surface-container-highest flex items-center justify-start px-1 rounded-sm transition-colors";
                knob.className = "toggle-knob w-3 h-3 bg-outline transition-transform";
            }
            generatePassword();
        };

        [tUpper, tNum, tSym, tSan].forEach(t => {
            if(t) t.addEventListener('click', () => toggleState(t));
        });

        const generatePassword = () => {
            let length = parseInt(lengthInput.value);
            lengthVal.textContent = length;
            
            const useUpper = tUpper.getAttribute('data-active') === 'true';
            const useNum = tNum.getAttribute('data-active') === 'true';
            const useSym = tSym.getAttribute('data-active') === 'true';
            const useSan = tSan.getAttribute('data-active') === 'true';

            let charset = "abcdefghijklmnopqrstuvwxyz";
            if (useUpper) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            if (useNum) charset += "0123456789";
            if (useSym) charset += "!@#$%^&*()_+~|}{[]:;?><,./-=";
            
            if (useSan) {
                const ambiguous = "il1Lo0O";
                charset = charset.split('').filter(c => !ambiguous.includes(c)).join('');
            }
            
            if (charset.length === 0) charset = "abcdefghijklmnopqrstuvwxyz";

            let pwd = "";
            for (let i = 0, n = charset.length; i < length; ++i) {
                pwd += charset.charAt(Math.floor(Math.random() * n));
            }
            outEl.textContent = pwd;

            // --- Fix #10: Dynamic Entropy & Crack Time ---
            const entropyEl = document.getElementById('gen-entropy');
            const crackEl = document.getElementById('gen-crack-time');
            if (entropyEl && crackEl) {
                const charsetSize = charset.length;
                const entropy = Math.round(length * Math.log2(charsetSize) * 10) / 10;
                entropyEl.textContent = entropy.toFixed(1) + ' Bits';
                
                // Assuming 10 billion guesses/second (modern GPU attack)
                const totalCombinations = Math.pow(charsetSize, length);
                const secondsToCrack = totalCombinations / 10e9;
                
                if (secondsToCrack < 1) crackEl.textContent = 'Instant';
                else if (secondsToCrack < 60) crackEl.textContent = Math.round(secondsToCrack) + 's';
                else if (secondsToCrack < 3600) crackEl.textContent = Math.round(secondsToCrack / 60) + ' Min';
                else if (secondsToCrack < 86400) crackEl.textContent = Math.round(secondsToCrack / 3600) + ' Hours';
                else if (secondsToCrack < 31536000) crackEl.textContent = Math.round(secondsToCrack / 86400) + ' Days';
                else if (secondsToCrack < 31536000 * 1000) crackEl.textContent = Math.round(secondsToCrack / 31536000) + ' Years';
                else if (secondsToCrack < 31536000 * 1e6) crackEl.textContent = (secondsToCrack / 31536000 / 1000).toFixed(0) + 'K Years';
                else if (secondsToCrack < 31536000 * 1e9) crackEl.textContent = (secondsToCrack / 31536000 / 1e6).toFixed(0) + 'M Years';
                else crackEl.textContent = '∞ (Heat Death)';
            }
        };

        if (lengthInput) {
            lengthInput.addEventListener('input', generatePassword);
            btnRegen.addEventListener('click', generatePassword);
            
            btnCopy.addEventListener('click', () => {
                navigator.clipboard.writeText(outEl.textContent);
                const icon = document.getElementById('gen-copy-icon');
                if (icon) {
                    icon.textContent = 'check';
                    setTimeout(() => icon.textContent = 'content_copy', 1000);
                }
            });

            btnStore.addEventListener('click', () => {
                // When "Store" is clicked, we can redirect to add
                // and pass the newly generated password via query param.
                window.location.href = `/add?pwd=${encodeURIComponent(outEl.textContent)}`;
            });

            generatePassword(); // Initial run
        }
    }

    // --- SYNC PAGE (sync) ---
    const isSyncPage = isPagePath('sync');
    if (isSyncPage) {
        const btnConnect = document.getElementById('btn-sync-connect');
        const btnForce = document.getElementById('btn-sync-force');
        const btnRevoke = document.getElementById('btn-sync-revoke');
        const statusDot = document.getElementById('sync-status-dot');
        const statusTxt = document.getElementById('sync-status-txt');
        const statusHint = document.getElementById('sync-status-hint');
        const sheetName = document.getElementById('sync-sheet-name');
        const logsBox = document.getElementById('sync-logs');

        const log = (msg, level="INFO") => {
            const time = new Date().toLocaleTimeString('en-US', {hour12:false});
            let color = 'text-primary-container';
            if(level === 'WARN') color = 'text-tertiary';
            if(level === 'ERROR') color = 'text-error';
            
            logsBox.innerHTML = `<p>[${time}] <span class="${color}">${level}</span> ${msg}</p>` + logsBox.innerHTML;
        };

        const checkApiStatusUI = () => {
            const sheetId = localStorage.getItem('securesheet_spreadsheet_id');
            const hasToken = hasValidToken();
            
            if (hasToken && sheetId) {
                statusDot.className = 'w-2 h-2 bg-primary animate-pulse';
                statusTxt.textContent = 'Google Sync Active';
                if (statusHint) statusHint.textContent = 'Changes are saved locally and auto-synced to Google Sheets after edits.';
                sheetName.textContent = `SecureSheet_Database (ID: ${sheetId.substring(0,6)}...)`;
                sheetName.classList.remove('text-outline-variant');
                sheetName.classList.add('text-on-surface');
                
                btnConnect.style.display = 'none';
                btnForce.classList.remove('hidden');
                btnForce.textContent = 'SYNC NOW';
                
                btnRevoke.classList.remove('opacity-50', 'pointer-events-none');
            } else {
                statusDot.className = 'w-2 h-2 bg-error animate-pulse';
                statusTxt.textContent = 'Cloud Backup Not Connected';
                if (statusHint) statusHint.textContent = 'Unlock with your master password first, then connect Google once to enable backup and multi-device sync.';
                sheetName.textContent = 'No sheet linked';
                sheetName.classList.add('text-outline-variant');
                sheetName.classList.remove('text-on-surface');
                
                btnConnect.style.display = 'flex';
                btnForce.classList.add('hidden');
                
                btnRevoke.classList.add('opacity-50', 'pointer-events-none');
            }
        };

        const updateTelemetryReadout = () => {
            const elLast = document.getElementById('tel-last-sync');
            const elCount = document.getElementById('tel-sync-count');
            const elSize = document.getElementById('tel-vault-size');

            if (elLast) {
                const ts = localStorage.getItem('securesheet_last_sync');
                if (ts) {
                    const date = new Date(parseInt(ts));
                    elLast.textContent = date.toLocaleDateString() + ' // ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                }
            }
            if (elCount) {
                const cycles = localStorage.getItem('securesheet_sync_count') || '0';
                elCount.textContent = parseInt(cycles).toLocaleString();
            }
            if (elSize) {
                const size = new Blob([JSON.stringify(DB)]).size;
                elSize.textContent = size > 1024 ? (size / 1024).toFixed(2) + ' KB' : size + ' B';
            }
        };

        const registerSyncCycle = () => {
            localStorage.setItem('securesheet_last_sync', Date.now().toString());
            let count = parseInt(localStorage.getItem('securesheet_sync_count') || '0');
            localStorage.setItem('securesheet_sync_count', (count + 1).toString());
            updateTelemetryReadout();
        };

        // Initialize Google Scripts explicitly for Sync Dashboard
        loadGoogleScripts(() => {
            log('Google sync engine ready.', 'INFO');
            checkApiStatusUI();
            updateTelemetryReadout();
            
            btnConnect.addEventListener('click', () => {
                log('Opening Google permission prompt...', 'INFO');
                authenticate(async () => {
                    log('Google account connected. SecureSheet storage ready.', 'INFO');
                    checkApiStatusUI();
                    
                    // Force a local hydration automatically initially
                    log('Checking Google Sheets for existing vault data...', 'INFO');
                    const remoteData = await downloadSync();
                    if(remoteData && remoteData.length > 0) {
                        DB = remoteData;
                        localStorage.setItem('vault_db', JSON.stringify(DB));
                        registerSyncCycle();
                        log(`Imported ${remoteData.length} records from Google Sheets.`, 'INFO');
                    } else if(remoteData && remoteData.length === 0) {
                        // Remote is empty, push local!
                        log(`Cloud sheet is empty. Uploading ${DB.length} local records now.`, 'INFO');
                        await uploadSync(DB);
                        registerSyncCycle();
                        log('Initial backup completed. Future edits will auto-sync.', 'INFO');
                    }
                }, (err) => {
                    log('Google connection was cancelled or failed.', 'ERROR');
                });
            });

            btnForce.addEventListener('click', async () => {
                const modePush = document.getElementById('sync-mode-push');
                const isPush = modePush && modePush.checked;

                btnForce.textContent = "SYNCING...";
                if (isPush) {
                    await ensureSpreadsheetReady();
                    log('Uploading the latest vault state to Google Sheets...', 'INFO');
                    const success = await uploadSync(DB);
                    if(success) {
                        registerSyncCycle();
                        log(`Sync complete. ${DB.length} rows updated in Google Sheets.`, 'INFO');
                    } else {
                        log('Sync failed while updating Google Sheets.', 'ERROR');
                    }
                } else {
                    await ensureSpreadsheetReady();
                    log('Downloading the latest cloud snapshot...', 'INFO');
                    const remoteData = await downloadSync();
                    if(remoteData && remoteData.length > 0) {
                        DB = remoteData;
                        localStorage.setItem('vault_db', JSON.stringify(DB));
                        registerSyncCycle();
                        log('Cloud restore complete. Local vault replaced with the latest sheet data.', 'INFO');
                    } else if (remoteData && remoteData.length === 0) {
                        log('Cloud sheet is reachable but currently empty. Local vault was left unchanged.', 'WARN');
                    } else {
                        log('Cloud restore failed.', 'ERROR');
                    }
                }
                btnForce.textContent = "SYNC NOW";
            });

            btnRevoke.addEventListener('click', () => {
                const conf = confirm("WARNING: This destroys connectivity. The remote sheet will remain in your drive but the app will go offline. Proceed?");
                if(conf) {
                    revokeAccess();
                    checkApiStatusUI();
                    log('Google access revoked. Vault stays local until you reconnect.', 'WARN');
                }
            });
        });
    } else {
        // Just silently load Google Scripts globally to allow background auto-saves
        loadGoogleScripts(() => {
            // Background idle
        });
    }

});

// --- SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('SW registered: ', registration);
        }).catch(registrationError => {
            console.log('SW registration failed: ', registrationError);
        });
    });
}
