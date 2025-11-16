// Firebase imports
import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

import {
    getDatabase,
    ref,
    onValue,
    push,
    set,
    remove,
    get,
    update
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    updatePassword
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyDmJpMD7iQSZ_Jtr-mHEYIP4dVRli-Ym8Y",
    authDomain: "ogwxbet.firebaseapp.com",
    databaseURL: "https://ogwxbet-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "ogwxbet",
    storageBucket: "ogwxbet.firebasestorage.app",
    messagingSenderId: "350350599882",
    appId: "1:350350599882:web:cf13802474026f08687633"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const eventsRef = ref(db, "events");
const eventLogRef = ref(db, "eventLog");
const accountsRef = ref(db, "accounts");

// ============================================================================
// NEW: REALTIME LISTENER FOR DELETED ACCOUNT AUTO-LOGOUT
// ============================================================================
onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const uid = user.uid;
    const accSnap = await get(ref(db, `accounts/${uid}`));

    if (!accSnap.exists()) return;
    const acc = accSnap.val();

    if (acc.deleted === true) {
        await signOut(auth);
        location.reload();
    }
});

// ============================================================================
// EVENTS DATA SUBSCRIPTION
// ============================================================================
window.eventKeyMap = {};

window.saveEventToFirebase = function (eventObj) {
    const newRef = push(eventsRef);
    set(newRef, eventObj);
};

onValue(eventsRef, snapshot => {
    const events = [];
    const idToKey = {};

    snapshot.forEach(childSnap => {
        const ev = childSnap.val() || {};
        ev._key = childSnap.key;
        events.push(ev);
        if (ev.id) idToKey[ev.id] = childSnap.key;
    });

    window.latestEvents = events;
    window.eventKeyMap = idToKey;

    if (window.displayFirebaseEvents) {
        window.displayFirebaseEvents(events);
    }
});

// ============================================================================
// EVENT LOG SUBSCRIPTION
// ============================================================================
onValue(eventLogRef, snapshot => {
    const logs = [];
    snapshot.forEach(childSnap => {
        const entry = childSnap.val() || {};
        entry._key = childSnap.key;
        logs.push(entry);
    });
    window.eventLogEntries = logs;
    if (window.renderEventLog) {
        window.renderEventLog();
    }
});

// ============================================================================
// DOM READY
// ============================================================================
document.addEventListener('DOMContentLoaded', function () {

    const loginPage = document.getElementById('login-page');
    const dashboardPage = document.getElementById('dashboard-page');
    const accountCreationSection = document.getElementById('account-creation');
    const loginSection = document.getElementById('login-section');
    const statusMessage = document.getElementById('status-message');
    const loginStatus = document.getElementById('login-status');
    const adminNav = document.getElementById('admin-nav');
    const moderatorBadge = document.getElementById('moderator-badge');

    const createAccountBtn = document.getElementById('create-account-btn');
    const loginBtn = document.getElementById('login-btn');
    const showRegisterBtn = document.getElementById('show-register-btn');
    const showLoginBtn = document.getElementById('show-login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const changeTokenBtn = document.getElementById('change-token-btn');
    const toggleTokenBtn = document.getElementById('toggle-token');
    const addEventBtn = document.getElementById('add-event-btn');
    const clearEventLogBtn = document.getElementById('clear-event-log-btn');
    const tokenStatus = document.getElementById('token-status');
    const eventLogStatus = document.getElementById('event-log-status');

    // ========================================================================
    // POPUP SYSTEM (UNCHANGED)
    // ========================================================================
    const popupOverlay = document.getElementById('popup-overlay');
    const popupTitle = document.getElementById('popup-title');
    const popupMessage = document.getElementById('popup-message');
    const popupInput = document.getElementById('popup-input');
    const popupButtons = document.getElementById('popup-buttons');

    let currentUserUid = null;
    let currentAccount = null;

    function closePopup() {
        if (!popupOverlay) return;
        popupOverlay.classList.remove('active');
        setTimeout(() => popupOverlay.classList.add('hidden'), 200);
    }

    function showPopup(options) {
        return new Promise(resolve => {
            if (!popupOverlay) return resolve(null);

            const {
                title = "Message",
                message = "",
                showInput = false,
                inputDefault = "",
                buttons = []
            } = options || {};

            popupTitle.textContent = title;
            popupMessage.textContent = message;

            if (showInput) {
                popupInput.classList.remove('hidden');
                popupInput.value = inputDefault || "";
                popupInput.focus();
            } else {
                popupInput.classList.add('hidden');
                popupInput.value = "";
            }

            popupButtons.innerHTML = "";
            buttons.forEach(btn => {
                const el = document.createElement('button');
                el.textContent = btn.text || "OK";
                el.classList.add('popup-btn');
                if (btn.type) el.classList.add(btn.type);

                el.addEventListener('click', () => {
                    closePopup();
                    resolve({
                        button: btn.value,
                        input: popupInput.value
                    });
                });

                popupButtons.appendChild(el);
            });

            popupOverlay.classList.remove('hidden');
            requestAnimationFrame(() => popupOverlay.classList.add('active'));
        });
    }

    function showMessagePopup(title, message, buttonText = "OK") {
        return showPopup({
            title,
            message,
            showInput: false,
            buttons: [{ text: buttonText, value: true, type: "confirm" }]
        });
    }

    async function showConfirmPopup(title, message, confirmText = "Confirm", cancelText = "Cancel") {
        const r = await showPopup({
            title,
            message,
            buttons: [
                { text: cancelText, value: false, type: "cancel" },
                { text: confirmText, value: true, type: "confirm" }
            ]
        });
        return r && r.button === true;
    }

    async function showInputPopup(title, message, v = "", confirmText = "Save", cancelText = "Cancel") {
        const r = await showPopup({
            title,
            message,
            showInput: true,
            inputDefault: v,
            buttons: [
                { text: cancelText, value: "cancel", type: "cancel" },
                { text: confirmText, value: "ok", type: "confirm" }
            ]
        });
        if (!r || r.button !== "ok") return null;
        return r.input;
    }

    async function showChoicePopup(title, message, choices, cancelText = "Cancel") {
        const buttons = choices.map(c => ({
            text: c.label,
            value: c.value,
            type: "confirm"
        }));
        buttons.push({ text: cancelText, value: null, type: "cancel" });

        const r = await showPopup({
            title,
            message,
            showInput: false,
            buttons
        });

        return r ? r.button : null;
    }

    // ========================================================================
    // AUTH STATE CHECK
    // ========================================================================
    checkLoginStatus();
    function checkLoginStatus() {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                loginPage.classList.remove('hidden');
                dashboardPage.classList.add('hidden');
                return;
            }

            const uid = user.uid;
            currentUserUid = uid;

            const accRef = ref(db, `accounts/${uid}`);
            const accSnap = await get(accRef);
            if (!accSnap.exists()) {
                await signOut(auth);
                return;
            }

            const acc = accSnap.val();
            currentAccount = acc;

            if (acc.deleted === true) {
                await signOut(auth);
                return;
            }

            loginPage.classList.add('hidden');
            dashboardPage.classList.remove('hidden');

            document.getElementById('account-username').textContent = acc.username || "Unknown";
            document.getElementById('account-created').textContent = acc.creationDate || "Unknown";
            document.getElementById('account-reputation').textContent = acc.reputation ?? "0";
            document.getElementById('account-token').textContent = acc.token || "None";

            if (acc.isModerator === true) {
                adminNav.classList.remove('hidden');
                moderatorBadge.classList.remove('hidden');
            } else {
                adminNav.classList.add('hidden');
                moderatorBadge.classList.add('hidden');
            }

            loadPredictions();
        });
    }

    // ========================================================================
    // ACCOUNT CREATION
    // ========================================================================
    createAccountBtn.addEventListener('click', async () => {
        const username = document.getElementById('register-username').value.trim();
        const webhook = document.getElementById('register-webhook').value.trim();

        if (!username || !webhook) {
            showMessagePopup("Error", "Please enter a username and webhook.");
            return;
        }

        const token = generateToken();
        const email = `${username}@ogwxbet.local`;
        const password = token;

        try {
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCred.user.uid;

            const accountData = {
                username,
                webhook,
                token,
                reputation: 0,
                isModerator: false,
                creationDate: new Date().toLocaleString(),
                predictions: {},
                deleted: false
            };

            await set(ref(db, `accounts/${uid}`), accountData);

            document.getElementById('account-username').textContent = username;
            document.getElementById('account-created').textContent = accountData.creationDate;
            document.getElementById('account-reputation').textContent = "0";
            document.getElementById('account-token').textContent = token;

            sendWebhook(webhook, `Your OGW Xbet account has been created!\nUsername: ${username}\nToken: ${token}`);

            showMessagePopup("Account Created", "Your account has been created and your token was sent to your webhook.");

            loginPage.classList.add('hidden');
            dashboardPage.classList.remove('hidden');

        } catch (err) {
            showMessagePopup("Error", "Account creation failed: " + err.message);
        }
    });

    // ========================================================================
    // LOGIN
    // ========================================================================
    loginBtn.addEventListener('click', async () => {
        const username = document.getElementById('login-username').value.trim();
        const token = document.getElementById('login-token').value.trim();

        if (!username || !token) {
            showMessagePopup("Error", "Please enter your username and token.");
            return;
        }

        const email = `${username}@ogwxbet.local`;
        const password = token;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            const user = auth.currentUser;
            const uid = user.uid;

            const accSnap = await get(ref(db, `accounts/${uid}`));
            if (!accSnap.exists()) {
                await signOut(auth);
                showMessagePopup("Error", "Account not found.");
                return;
            }

            const acc = accSnap.val();

            if (acc.deleted === true) {
                await signOut(auth);
                showMessagePopup("Account Deleted", "This account was deleted by a moderator.");
                return;
            }

            currentUserUid = uid;
            currentAccount = acc;

            loginPage.classList.add('hidden');
            dashboardPage.classList.remove('hidden');

            document.getElementById('account-username').textContent = acc.username;
            document.getElementById('account-created').textContent = acc.creationDate;
            document.getElementById('account-reputation').textContent = acc.reputation;
            document.getElementById('account-token').textContent = acc.token;

            if (acc.isModerator === true) {
                adminNav.classList.remove('hidden');
                moderatorBadge.classList.remove('hidden');
            } else {
                adminNav.classList.add('hidden');
                moderatorBadge.classList.add('hidden');
            }

            loadPredictions();

        } catch (err) {
            showMessagePopup("Error", "Login failed: " + err.message);
        }
    });

    // ========================================================================
    // LOGOUT
    // ========================================================================
    logoutBtn.addEventListener('click', async () => {
        const confirm = await showConfirmPopup("Logout", "Are you sure you want to log out?");
        if (!confirm) return;
        await signOut(auth);
        location.reload();
    });

    // ========================================================================
    // TOKEN TOGGLE
    // ========================================================================
    toggleTokenBtn.addEventListener('click', () => {
        const el = document.getElementById('account-token');
        if (el.classList.contains('blurred')) {
            el.classList.remove('blurred');
            toggleTokenBtn.textContent = "Hide Token";
        } else {
            el.classList.add('blurred');
            toggleTokenBtn.textContent = "Show Token";
        }
    });

    // ========================================================================
    // TOKEN REGENERATION
    // ========================================================================
    changeTokenBtn.addEventListener('click', async () => {
        const choice = await showChoicePopup(
            "Regenerate Token",
            "Choose how to send the new token:",
            [
                { label: "Use existing Webhook", value: "same" },
                { label: "Use a new Webhook", value: "new" }
            ]
        );

        if (!choice) return;

        let newWebhook = currentAccount.webhook;
        if (choice === "new") {
            const w = await showInputPopup("New Webhook", "Enter a new webhook URL:", currentAccount.webhook);
            if (!w) return;
            newWebhook = w.trim();
        }

        const newToken = generateToken();
        const email = `${currentAccount.username}@ogwxbet.local`;

        try {
            await updatePassword(auth.currentUser, newToken);
            await update(ref(db, `accounts/${currentUserUid}`), {
                token: newToken,
                webhook: newWebhook
            });

            document.getElementById('account-token').textContent = newToken;

            sendWebhook(newWebhook, `Your OGW Xbet token has been regenerated!\nUsername: ${currentAccount.username}\nNew Token: ${newToken}`);

            showMessagePopup("Token Updated", "Your token has been successfully regenerated.");

        } catch (err) {
            showMessagePopup("Error", "Failed to update token: " + err.message);
        }
    });

    // ========================================================================
    // PREDICTIONS
    // ========================================================================
    function loadPredictions() {
        const list = document.getElementById('prediction-list');
        list.innerHTML = "";

        if (!currentAccount || !currentAccount.predictions) return;

        Object.values(currentAccount.predictions).forEach(p => {
            const li = document.createElement('li');
            li.textContent = `${p.eventTitle} — ${p.choice} — ${p.result || "Pending"}`;
            list.appendChild(li);
        });
    }

    window.savePrediction = async function (eventObj, choice) {
        if (!currentUserUid) return;

        const predId = "pred_" + Date.now();
        const pred = {
            eventId: eventObj.id,
            eventTitle: eventObj.title,
            choice,
            result: "Pending"
        };

        await update(ref(db, `accounts/${currentUserUid}/predictions/${predId}`), pred);

        const snap = await get(ref(db, `accounts/${currentUserUid}`));
        currentAccount = snap.val();
        loadPredictions();
    };

    // ========================================================================
    // CREATE EVENT (MOD ONLY — UNCHANGED)
    // ========================================================================
    addEventBtn.addEventListener('click', async () => {
        if (!currentAccount || !currentAccount.isModerator) {
            showMessagePopup("Error", "Only moderators can create events.");
            return;
        }

        const title = await showInputPopup("Create Event", "Enter event title:");
        if (!title) return;

        const teamA = await showInputPopup("Team A", "Enter the name of Team A:");
        if (!teamA) return;

        const teamB = await showInputPopup("Team B", "Enter the name of Team B:");
        if (!teamB) return;

        const category = await showChoicePopup("Category", "Select event category:", [
            { label: "Upcoming", value: "upcoming" },
            { label: "Active", value: "active" }
        ]);

        if (!category) return;

        const ev = {
            id: "event_" + Date.now(),
            title,
            teamA,
            teamB,
            category,
            createdBy: currentAccount.username,
            timestamp: Date.now()
        };

        saveEventToFirebase(ev);
        showMessagePopup("Event Created", "The event has been created successfully.");
    });

    // ========================================================================
    // EVENT DISPLAY (UNCHANGED)
    // ============================================================================
    window.displayFirebaseEvents = function (events) {
        const upcomingList = document.getElementById('upcoming-events');
        const activeList = document.getElementById('active-events');
        const endedList = document.getElementById('ended-events');

        upcomingList.innerHTML = "";
        activeList.innerHTML = "";
        endedList.innerHTML = "";

        events.forEach(ev => {
            const li = document.createElement('li');
            li.classList.add('event-item');

            const title = document.createElement('span');
            title.textContent = `${ev.title} (${ev.teamA} vs ${ev.teamB})`;
            li.appendChild(title);

            const predictBtnA = document.createElement('button');
            predictBtnA.textContent = `Predict ${ev.teamA}`;
            predictBtnA.classList.add('predict-btn');
            predictBtnA.addEventListener('click', () => window.savePrediction(ev, ev.teamA));
            li.appendChild(predictBtnA);

            const predictBtnB = document.createElement('button');
            predictBtnB.textContent = `Predict ${ev.teamB}`;
            predictBtnB.classList.add('predict-btn');
            predictBtnB.addEventListener('click', () => window.savePrediction(ev, ev.teamB));
            li.appendChild(predictBtnB);

            if (currentAccount && currentAccount.isModerator) {
                const menuBtn = document.createElement('button');
                menuBtn.textContent = "⋮";
                menuBtn.classList.add('menu-btn');
                menuBtn.addEventListener('click', () => openEventMenu(ev));
                li.appendChild(menuBtn);
            }

            if (ev.category === "upcoming") upcomingList.appendChild(li);
            else if (ev.category === "active") activeList.appendChild(li);
            else endedList.appendChild(li);
        });
    };

    // ========================================================================
    // EVENT MENU FOR MODERATORS
    // ========================================================================
    async function openEventMenu(ev) {
        const choice = await showChoicePopup(
            "Event Options",
            `Manage event: ${ev.title}`,
            [
                { label: "Move Event", value: "move" },
                { label: "Edit Event", value: "edit" },
                { label: "End Event", value: "end" }
            ]
        );

        if (!choice) return;

        if (choice === "move") moveEvent(ev);
        if (choice === "edit") editEvent(ev);
        if (choice === "end") endEvent(ev);
    }

    async function moveEvent(ev) {
        const category = await showChoicePopup(
            "Move Event",
            "Choose new category:",
            [
                { label: "Upcoming", value: "upcoming" },
                { label: "Active", value: "active" },
                { label: "Ended", value: "ended" }
            ]
        );

        if (!category) return;

        const key = window.eventKeyMap[ev.id];
        if (!key) return;

        await update(ref(db, `events/${key}`), { category });
        showMessagePopup("Success", "Event moved.");
    }

    async function editEvent(ev) {
        const newTitle = await showInputPopup("Edit Title", "Enter new title:", ev.title);
        if (!newTitle) return;

        const newA = await showInputPopup("Edit Team A", "Enter name for Team A:", ev.teamA);
        if (!newA) return;

        const newB = await showInputPopup("Edit Team B", "Enter name for Team B:", ev.teamB);
        if (!newB) return;

        const key = window.eventKeyMap[ev.id];
        if (!key) return;

        await update(ref(db, `events/${key}`), {
            title: newTitle,
            teamA: newA,
            teamB: newB
        });

        showMessagePopup("Success", "Event updated.");
    }

    async function endEvent(ev) {
        const winner = await showChoicePopup(
            "End Event",
            "Select the winner:",
            [
                { label: ev.teamA, value: ev.teamA },
                { label: ev.teamB, value: ev.teamB }
            ]
        );

        if (!winner) return;

        const key = window.eventKeyMap[ev.id];
        if (!key) return;

        await logEvent(ev, winner);
        await remove(ref(db, `events/${key}`));

        await updatePredictions(ev, winner);

        showMessagePopup("Event Ended", `Winner: ${winner}`);
    }

    async function logEvent(ev, winner) {
        const logEntry = {
            id: ev.id,
            title: ev.title,
            teamA: ev.teamA,
            teamB: ev.teamB,
            winner,
            endedBy: currentAccount.username,
            timestamp: Date.now()
        };

        await push(eventLogRef, logEntry);
    }

    async function updatePredictions(ev, winner) {
        const allAccSnap = await get(accountsRef);
        if (!allAccSnap.exists()) return;

        const all = allAccSnap.val();
        for (const uid in all) {
            const acc = all[uid];
            if (!acc.predictions) continue;

            let changed = false;

            for (const pid in acc.predictions) {
                const p = acc.predictions[pid];
                if (p.eventId === ev.id) {
                    p.result = p.choice === winner ? "Correct" : "Wrong";
                    changed = true;

                    if (p.choice === winner) acc.reputation = (acc.reputation || 0) + 1;
                    else acc.reputation = (acc.reputation || 0) - 0.5;
                }
            }

            if (changed) {
                await update(ref(db, `accounts/${uid}`), {
                    predictions: acc.predictions,
                    reputation: acc.reputation
                });
            }
        }

        if (auth.currentUser) {
            const snap = await get(ref(db, `accounts/${auth.currentUser.uid}`));
            if (snap.exists()) {
                currentAccount = snap.val();
                loadPredictions();
                document.getElementById('account-reputation').textContent = currentAccount.reputation;
            }
        }
    }

    // ========================================================================
    // EVENT LOG RENDER
    // ========================================================================
    window.renderEventLog = function () {
        const logContainer = document.getElementById('event-log-container');
        if (!logContainer) return;

        logContainer.innerHTML = "";

        window.eventLogEntries.forEach(entry => {
            const div = document.createElement('div');
            div.classList.add('log-entry');

            div.innerHTML = `
                <strong>${entry.title}</strong><br>
                Winner: ${entry.winner}<br>
                Ended By: ${entry.endedBy}<br>
                Time: ${new Date(entry.timestamp).toLocaleString()}
            `;

            logContainer.appendChild(div);
        });
    };

    clearEventLogBtn.addEventListener('click', async () => {
        if (!currentAccount || !currentAccount.isModerator) return;

        const confirm = await showConfirmPopup("Clear Log", "This will erase all history. Continue?");
        if (!confirm) return;

        await remove(eventLogRef);
        showMessagePopup("Cleared", "Event log cleared.");
    });

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================
    function generateToken() {
        return Math.random().toString(36).substring(2, 10);
    }

    function sendWebhook(url, content) {
        fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ content })
        });
    }

}); // DOMContentLoaded end
// ============================================================================
// ADMIN — LOAD ALL ACCOUNTS (ACTIVE + DELETED)
// ============================================================================
function loadAllAccountsForAdmin() {
    if (!currentAccount || !currentAccount.isModerator) return;

    onValue(accountsRef, snapshot => {
        if (!snapshot.exists()) return;

        const all = snapshot.val();
        const active = [];
        const deleted = [];

        for (const uid in all) {
            const acc = all[uid];
            if (acc.deleted) deleted.push({ uid, ...acc });
            else active.push({ uid, ...acc });
        }

        renderAdminAccounts(active, deleted);
    });
}

// ============================================================================
// ADMIN — RENDER ACCOUNTS
// ============================================================================
function renderAdminAccounts(active, deleted) {
    const activeContainer = document.getElementById("admin-active-accounts");
    const deletedContainer = document.getElementById("admin-deleted-accounts");

    if (!activeContainer || !deletedContainer) return;

    activeContainer.innerHTML = "";
    deletedContainer.innerHTML = "";

    // ACTIVE ACCOUNTS
    active.forEach(acc => {
        const div = document.createElement("div");
        div.classList.add("admin-account-entry");

        div.innerHTML = `
            <span class="admin-account-name">${acc.username}</span>
            <button class="admin-delete-btn" data-uid="${acc.uid}">Delete</button>
        `;

        activeContainer.appendChild(div);
    });

    // DELETED ACCOUNTS
    deleted.forEach(acc => {
        const div = document.createElement("div");
        div.classList.add("admin-account-entry", "deleted-entry");

        div.innerHTML = `
            <span class="admin-account-name">${acc.username}</span>
            <button class="admin-restore-btn" data-uid="${acc.uid}">Restore</button>
        `;

        deletedContainer.appendChild(div);
    });

    bindAdminAccountButtons();
}

// ============================================================================
// ADMIN — BUTTON BINDING
// ============================================================================
function bindAdminAccountButtons() {
    // DELETE
    const delBtns = document.querySelectorAll(".admin-delete-btn");
    delBtns.forEach(btn => {
        btn.addEventListener("click", async () => {
            const uid = btn.getAttribute("data-uid");
            if (!uid) return;

            const ok = await showConfirmPopup("Delete Account", "Are you sure you want to delete this account?");
            if (!ok) return;

            await update(ref(db, `accounts/${uid}`), { deleted: true });
        });
    });

    // RESTORE
    const restoreBtns = document.querySelectorAll(".admin-restore-btn");
    restoreBtns.forEach(btn => {
        btn.addEventListener("click", async () => {
            const uid = btn.getAttribute("data-uid");
            if (!uid) return;

            const ok = await showConfirmPopup("Restore Account", "Restore this deleted account?");
            if (!ok) return;

            await update(ref(db, `accounts/${uid}`), { deleted: false });
        });
    });
}

// ============================================================================
// ADMIN TAB ACTIVATION LISTENER
// ============================================================================
document.getElementById("admin-nav").addEventListener("click", () => {
    if (!currentAccount || !currentAccount.isModerator) return;
    loadAllAccountsForAdmin();
});
// ============================================================================
// SIDEBAR NAVIGATION (UNCHANGED BUT ENSURES ADMIN TAB WORKS WITH NEW SYSTEM)
// ============================================================================
const sidebarButtons = document.querySelectorAll(".sidebar-btn");
const tabs = document.querySelectorAll(".tab");

sidebarButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-target");
        if (!target) return;

        tabs.forEach(tab => tab.classList.add("hidden"));
        document.getElementById(target).classList.remove("hidden");

        if (target === "admin-tab" && currentAccount && currentAccount.isModerator) {
            loadAllAccountsForAdmin();
        }
    });
});

// ============================================================================
// FORCE RELOAD ACCOUNT DATA WHEN AUTH USER CHANGES (SAFETY REFRESH)
// ============================================================================
onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const uid = user.uid;
    const accSnap = await get(ref(db, `accounts/${uid}`));

    if (!accSnap.exists()) {
        await signOut(auth);
        return;
    }

    const acc = accSnap.val();

    if (acc.deleted === true) {
        await signOut(auth);
        location.reload();
        return;
    }

    currentUserUid = uid;
    currentAccount = acc;
});

// ============================================================================
// FINAL SAFETY — AUTOLOAD EVENTS AND ACCOUNT DATA
// ============================================================================
if (typeof window.latestEvents !== "undefined" && window.displayFirebaseEvents) {
    window.displayFirebaseEvents(window.latestEvents);
}

setTimeout(() => {
    if (auth.currentUser && currentAccount && currentAccount.isModerator) {
        loadAllAccountsForAdmin();
    }
}, 500);

// END OF FILE
