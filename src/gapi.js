const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets';
const DISCOVERY_DOCS = [
    'https://sheets.googleapis.com/$discovery/rest?version=v4',
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
];
const FOLDER_TITLE = 'SecureSheet';
const SHEET_TITLE = 'SecureSheet_Database';
const SHEET_TAB = 'Vault';
const HEADER_ROW = [["id", "account_name", "username", "password", "pin", "url", "category", "notes", "color", "icon"]];

let tokenClient;
let gapiInited = false;
let gisInited = false;
let folderId = localStorage.getItem('securesheet_drive_folder_id') || null;
let spreadsheetId = localStorage.getItem('securesheet_spreadsheet_id') || null;

const persistFolderId = (id) => {
    folderId = id;
    if (id) {
        localStorage.setItem('securesheet_drive_folder_id', id);
    } else {
        localStorage.removeItem('securesheet_drive_folder_id');
    }
};

const persistSpreadsheetId = (id) => {
    spreadsheetId = id;
    if (id) {
        localStorage.setItem('securesheet_spreadsheet_id', id);
    } else {
        localStorage.removeItem('securesheet_spreadsheet_id');
    }
};

export const loadGoogleScripts = (onReadyCallback) => {
    if (gapiInited && gisInited) {
        if(onReadyCallback) onReadyCallback();
        return;
    }

    const checkReady = () => {
        if (gapiInited && gisInited && onReadyCallback) onReadyCallback();
    };

    // Load GAPI
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = () => {
        gapi.load('client', async () => {
            await gapi.client.init({
                discoveryDocs: DISCOVERY_DOCS,
            });
            gapiInited = true;
            checkReady();
        });
    };
    document.body.appendChild(gapiScript);

    // Load GSI (Google Identity Services)
    const gsiScript = document.createElement('script');
    gsiScript.src = 'https://accounts.google.com/gsi/client';
    gsiScript.async = true;
    gsiScript.defer = true;
    gsiScript.onload = () => {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // defined dynamically later
        });
        gisInited = true;
        checkReady();
    };
    document.body.appendChild(gsiScript);
};

export const hasValidToken = () => {
    return !!gapi.client.getToken();
};

export const authenticate = (onSuccess, onError) => {
    if (!tokenClient) return;
    
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            if(onError) onError(resp);
            throw (resp);
        }
        // Persist token to sessionStorage so it survives page navigation
        const token = gapi.client.getToken();
        if (token) sessionStorage.setItem('gapi_token', JSON.stringify(token));
        
        await setupSpreadsheet();
        if(onSuccess) onSuccess();
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        tokenClient.requestAccessToken({prompt: ''});
    }
};

// Restore token from sessionStorage (survives page navigation within same tab)
export const restoreToken = () => {
    const saved = sessionStorage.getItem('gapi_token');
    if (saved && gapi && gapi.client) {
        try {
            const token = JSON.parse(saved);
            gapi.client.setToken(token);
            console.log('[AutoSync] Token restored from session.');
            return true;
        } catch(e) {
            sessionStorage.removeItem('gapi_token');
        }
    }
    return false;
};

// Silent reconnect — tries to get a token without popup
// Works only if user has previously granted consent
export const silentReconnect = (onSuccess, onFail) => {
    if (!tokenClient) { if(onFail) onFail(); return; }
    
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            if(onFail) onFail();
            return;
        }
        try { await setupSpreadsheet(); } catch(e) {}
        if(onSuccess) onSuccess();
    };

    tokenClient.error_callback = (err) => {
        if(onFail) onFail();
    };

    tokenClient.requestAccessToken({prompt: ''});
};

export const revokeAccess = () => {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {
            gapi.client.setToken('');
            persistFolderId(null);
            persistSpreadsheetId(null);
            console.log('Access revoked');
        });
    }
};

const ensureHeaderRow = async (id) => {
    await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: id,
        range: `${SHEET_TAB}!A1:J1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: HEADER_ROW }
    });
};

const lookupDriveFile = async (query) => {
    try {
        if (!gapi.client.drive?.files?.list) return null;

        const response = await gapi.client.drive.files.list({
            pageSize: 10,
            fields: 'files(id,name,createdTime,parents)',
            orderBy: 'createdTime desc',
            q: query
        });

        return response.result.files?.[0] || null;
    } catch (e) {
        console.warn('Drive lookup skipped; falling back to spreadsheet creation.', e);
        return null;
    }
};

const ensureDriveFolder = async () => {
    if (folderId) return folderId;

    const existingFolder = await lookupDriveFile(
        `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_TITLE}' and trashed=false`
    );

    if (existingFolder?.id) {
        persistFolderId(existingFolder.id);
        return existingFolder.id;
    }

    if (!gapi.client.drive?.files?.create) return null;

    const createResp = await gapi.client.drive.files.create({
        resource: {
            name: FOLDER_TITLE,
            mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id,name'
    });

    const newFolderId = createResp.result.id;
    persistFolderId(newFolderId);
    return newFolderId;
};

const lookupExistingSpreadsheet = async (parentFolderId) => {
    const inFolderClause = parentFolderId ? ` and '${parentFolderId}' in parents` : '';
    return await lookupDriveFile(
        `mimeType='application/vnd.google-apps.spreadsheet' and name='${SHEET_TITLE}' and trashed=false${inFolderClause}`
    );
};

const createSpreadsheet = async () => {
    const createResp = await gapi.client.sheets.spreadsheets.create({
        resource: {
            properties: {
                title: SHEET_TITLE
            },
            sheets: [{
                properties: { title: SHEET_TAB }
            }]
        }
    });

    return createResp.result.spreadsheetId;
};

const ensureFileInFolder = async (fileId, parentFolderId) => {
    if (!fileId || !parentFolderId || !gapi.client.drive?.files?.get || !gapi.client.drive?.files?.update) {
        return;
    }

    const fileResp = await gapi.client.drive.files.get({
        fileId,
        fields: 'id,parents'
    });

    const parents = fileResp.result.parents || [];
    if (parents.includes(parentFolderId)) return;

    await gapi.client.drive.files.update({
        fileId,
        addParents: parentFolderId,
        removeParents: parents.join(','),
        fields: 'id,parents'
    });
};

// Setup Spreadsheet: reuse the user's existing SecureSheet file when possible, otherwise create it once.
const setupSpreadsheet = async () => {
    try {
        const activeFolderId = await ensureDriveFolder();

        if (!spreadsheetId) {
            const existingSheet = await lookupExistingSpreadsheet(activeFolderId);
            persistSpreadsheetId(existingSheet?.id || await createSpreadsheet());
        }

        if (activeFolderId) {
            await ensureFileInFolder(spreadsheetId, activeFolderId);
        }

        await ensureHeaderRow(spreadsheetId);
    } catch (e) {
        console.error("Setup sheet failed", e);
        throw e;
    }
};

export const ensureSpreadsheetReady = async () => {
    if (!spreadsheetId) {
        await setupSpreadsheet();
    }
    return spreadsheetId;
};

// Download from sheet to populate DB
export const downloadSync = async () => {
    if (!spreadsheetId) {
        await setupSpreadsheet();
    }
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${SHEET_TAB}!A2:J1000`,
        });
        
        const rows = response.result.values || [];
        // Map rows to objects
        return rows.map(row => ({
            id: row[0],
            account_name: row[1] || '',
            username: row[2] || '',
            password: row[3] || '',
            pin: row[4] || '',
            url: row[5] || '',
            category: row[6] || 'Other',
            notes: row[7] || '',
            color: row[8] || 'primary',
            icon: row[9] || 'vpn_key'
        }));
    } catch (e) {
        if (e?.status === 404) {
            persistFolderId(null);
            persistSpreadsheetId(null);
        }
        console.error("Download sync failed", e);
        return null;
    }
};

// Upload entire DB to sheet (Direct Vault Export style)
export const uploadSync = async (dbArray) => {
    if (!spreadsheetId) {
        await setupSpreadsheet();
    }
    try {
        // Clear existing data (below header)
        await gapi.client.sheets.spreadsheets.values.clear({
            spreadsheetId: spreadsheetId,
            range: `${SHEET_TAB}!A2:J1000`
        });

        if (dbArray.length === 0) return true;

        const rows = dbArray.map(en => [
            en.id, 
            en.account_name, 
            en.username, 
            en.password, 
            en.pin || '', 
            en.url || '', 
            en.category, 
            en.notes || '',
            en.color || 'primary',
            en.icon || 'vpn_key'
        ]);

        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: `${SHEET_TAB}!A2`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: rows }
        });
        return true;
    } catch (e) {
        if (e?.status === 404) {
            persistFolderId(null);
            persistSpreadsheetId(null);
        }
        console.error("Upload sync failed", e);
        return false;
    }
};
