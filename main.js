// =====================================================
// NEON DEFENDER - main.js
// Sort incoming update notifications: apply the real
// ones, ignore the fake ones, before the breach timer
// or the shield runs out.
// =====================================================

// ---------- core game values (shown in the HUD) ----------
const START_TIME = 45;      // starting seconds on the "time to breach" clock
let timer = START_TIME;     // seconds remaining
let integrity = 100;        // shield percentage (0 = breached)
let score = 0;              // player score

// ---------- notification data ----------
// type "real" = legitimate update (player should APPLY PATCH)
// type "fake" = malicious/suspicious (player should IGNORE)
const notifications = [
    {
        title: "Kernel Patch 1.4.0",
        desc: "Source: Trusted Core Dev | Size: 569MB",
        type: "real"
    },
    {
        title: "Critical Warning: RAM Full!",
        desc: "Click here to download more memory",
        type: "fake"
    },
    {
        title: "System Hotfix #97",
        desc: "Source: Unknown Server | Protocol: Insecure",
        type: "fake"
    },
    {
        title: "High CPU Usage Detected",
        desc: "Run PCCleaner to clear process threads",
        type: "real"
    },
    {
        title: "OS Software Update v11.4",
        desc: "Source: Central Distribution Server | Signed by Root Auth",
        type: "real"
    },
    {
        title: "Display Driver Update",
        desc: "Source: Hardware OEM Repository | Verified WHQL Signature",
        type: "real"
    },
    {
        title: "Backup Node Echo-4 Synced",
        desc: "Target: Remote Server [192.168.x.x] // Protocol: outbound-SSH",
        type: "fake"
    },
    {
        title: "Bandwidth Optimization Complete",
        desc: "Proxy routing active for all DNS requests through public-node-99",
        type: "fake"
    },
    {
        title: "BIOS Signature Match Detected",
        desc: "SHA-256 Hash Verified against Motherboard manufacturer cert",
        type: "real"
    },
    {
        title: "Security Patch from Microsoft OS",
        desc: "Source: trusted-update-node-01 // Verified Certificate",
        type: "fake"
    }
];

// ---------- game config (tweak these to change difficulty) ----------
const MAX_VISIBLE = 3;             // how many cards can be on screen at once
const TIME_BONUS = 3;              // seconds gained for a correct decision
const TIME_PENALTY = 5;            // seconds lost for a wrong decision
const INTEGRITY_HIT_MALWARE = 30;  // shield damage for applying a fake patch
const INTEGRITY_HIT_MISSED = 15;   // shield damage for ignoring a real update

// ---------- grab elements from index.html ----------
const feed = document.querySelector(".feed-container");   // where cards appear
const timerEl = document.querySelector(".timer-alert");   // countdown display
const shieldEl = document.querySelector(".hud-status .status-item:nth-child(2) div");  // shield %
const scoreEl = document.querySelector(".hud-status .status-item:nth-child(3) div");   // score
const logEl = document.querySelector(".terminal-log");    // sidebar terminal text
const threatEl = document.querySelector(".system-specs p:nth-child(2)");  // "THREAT LEVEL" line

// ---------- game state (reset every round in startGame) ----------
let queue = [];       // notifications still waiting to be shown
let active = 0;       // number of cards currently on screen
let resolved = 0;     // number of cards the player has decided on
let running = false;  // true while a round is in progress
let tickId = null;    // id of the 1-second timer interval

// ---------- helper functions ----------

// Returns a randomly ordered copy of an array (Fisher-Yates shuffle)
// so each round shows the notifications in a different order.
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Converts seconds into an MM:SS string, e.g. 45 -> "00:45".
function formatTime(s) {
    const m = Math.floor(s / 60);
    return String(m).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

// Adds a line to the sidebar terminal. Optional cls colors it
// (log-good = green, log-bad = pink). Only the last 10 lines are kept.
function log(text, cls) {
    const p = document.createElement("p");
    p.textContent = "> " + text;
    if (cls) p.className = cls;
    logEl.appendChild(p);
    while (logEl.children.length > 10) logEl.removeChild(logEl.firstChild);
}

// Refreshes the top HUD (timer, shield, score) and the threat level
// from the current values. Also swaps the shield color as it drops.
function updateHUD() {
    timerEl.textContent = formatTime(Math.max(0, timer));
    shieldEl.textContent = Math.max(0, integrity) + "%";
    scoreEl.textContent = String(score).padStart(4, "0");

    // green above 60%, yellow above 30%, pink below that
    shieldEl.classList.remove("shield-good", "shield-warn", "shield-bad");
    if (integrity > 60) shieldEl.classList.add("shield-good");
    else if (integrity > 30) shieldEl.classList.add("shield-warn");
    else shieldEl.classList.add("shield-bad");

    // threat level text gets worse as the shield weakens
    if (threatEl) {
        threatEl.textContent =
            "THREAT LEVEL: " + (integrity > 60 ? "ELEVATED" : integrity > 30 ? "HIGH" : "CRITICAL");
    }
}

// ---------- notification cards ----------

// Builds one notification card (title, description, and the two
// buttons) for a notification object and wires up the button clicks.
// No real/fake class is added, so the card doesn't give away the answer.
function createCard(n) {
    const card = document.createElement("div");
    card.className = "card";

    // left side: title + description
    const info = document.createElement("div");
    info.className = "card-info";
    const h3 = document.createElement("h3");
    h3.textContent = n.title;
    const p = document.createElement("p");
    p.textContent = n.desc;
    info.append(h3, p);

    // right side: APPLY PATCH / IGNORE buttons
    const actions = document.createElement("div");
    actions.className = "card-actions";
    const patch = document.createElement("button");
    patch.className = "btn-patch";
    patch.textContent = "APPLY PATCH";
    const dismiss = document.createElement("button");
    dismiss.className = "btn-dismiss";
    dismiss.textContent = "IGNORE";
    actions.append(patch, dismiss);

    card.append(info, actions);

    // true = player applied the patch, false = player ignored it
    patch.addEventListener("click", () => decide(card, n, true));
    dismiss.addEventListener("click", () => decide(card, n, false));
    return card;
}

// Takes the next notification from the queue and puts its card in the
// feed, as long as a round is running and there's room on screen.
function spawnCard() {
    if (!running || queue.length === 0 || active >= MAX_VISIBLE) return;
    const n = queue.shift();
    feed.appendChild(createCard(n));
    active++;
    log("Incoming: " + n.title);
}

// Keeps the feed topped up to MAX_VISIBLE cards.
function fillFeed() {
    while (active < MAX_VISIBLE && queue.length > 0) spawnCard();
}

// ---------- player decisions ----------

// Called when the player clicks a button on a card.
// applied = true if they clicked APPLY PATCH, false if IGNORE.
// Decides if it was right, updates score/time/shield, then removes the card.
function decide(card, n, applied) {
    // ignore clicks if the game is over or this card was already handled
    if (!running || card.dataset.done) return;
    card.dataset.done = "1";
    card.querySelectorAll("button").forEach(b => (b.disabled = true));

    // correct = applied a real update OR ignored a fake one
    const correct = (n.type === "real") === applied;

    if (correct) {
        // reward: points and extra time
        score += 100;
        timer += TIME_BONUS;
        card.classList.add("card-correct");
        log(applied ? "Patch verified & applied: " + n.title
                    : "Threat blocked: " + n.title, "log-good");
    } else {
        // punishment: lose points and time (score never goes below 0)
        score = Math.max(0, score - 50);
        timer -= TIME_PENALTY;
        card.classList.add("card-wrong");
        if (applied) {
            // installed a fake patch = malware, bigger shield damage
            integrity -= INTEGRITY_HIT_MALWARE;
            log("MALWARE INSTALLED: " + n.title, "log-bad");
        } else {
            // skipped a legitimate update = smaller shield damage
            integrity -= INTEGRITY_HIT_MISSED;
            log("Legit update ignored: " + n.title, "log-bad");
        }
    }

    resolved++;
    active--;
    updateHUD();

    // let the green/red flash show briefly, then remove the card
    // and either finish the game or bring in the next notification
    setTimeout(() => {
        card.remove();
        if (!running) return;
        if (resolved >= notifications.length) endGame(true);
        else fillFeed();
    }, 350);

    // check lose conditions right away
    if (integrity <= 0) endGame(false, "Shield integrity reached 0%.");
    else if (timer <= 0) endGame(false, "The breach timer ran out.");
}

// ---------- game flow ----------

// Runs once per second while playing: counts the timer down
// and ends the game if it hits zero.
function tick() {
    timer--;
    updateHUD();
    if (timer <= 0) endGame(false, "The breach timer ran out.");
}

// Builds and shows a full-screen message box (start, win, or lose screen)
// with a title, some lines of text, and one button that starts a new round.
function showOverlay(title, lines, buttonLabel) {
    // remove any overlay that's already showing
    const old = document.querySelector(".overlay");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.className = "overlay";
    const box = document.createElement("div");
    box.className = "overlay-box";

    const h = document.createElement("h2");
    h.textContent = title;
    box.appendChild(h);

    // one paragraph per line of text
    lines.forEach(t => {
        const p = document.createElement("p");
        p.textContent = t;
        box.appendChild(p);
    });

    // clicking the button closes the overlay and starts a fresh round
    const btn = document.createElement("button");
    btn.className = "btn-patch";
    btn.textContent = buttonLabel;
    btn.addEventListener("click", () => {
        overlay.remove();
        startGame();
    });
    box.appendChild(btn);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

// Resets everything and begins a new round.
function startGame() {
    clearInterval(tickId);   // make sure no old timer is still running

    // reset values
    timer = START_TIME;
    integrity = 100;
    score = 0;
    resolved = 0;
    active = 0;
    queue = shuffle(notifications);  // fresh random order
    running = true;

    // clear the screen and the terminal, then show the first cards
    feed.innerHTML = "";
    logEl.innerHTML = "";
    log("Initializing shield nodes...");
    log("Filter active. Awaiting input.");
    updateHUD();
    fillFeed();

    // start the countdown (tick runs every 1000 ms)
    tickId = setInterval(tick, 1000);
}

// Ends the round. won = true for a win, false for a loss;
// reason is the text shown on the lose screen.
function endGame(won, reason) {
    if (!running) return;    // prevents ending twice
    running = false;
    clearInterval(tickId);
    feed.querySelectorAll("button").forEach(b => (b.disabled = true));

    if (won) {
        // bonus points for leftover time and shield
        const bonus = Math.max(0, timer) * 10 + Math.max(0, integrity) * 5;
        score += bonus;
        updateHUD();
        log("All notifications processed. City secured.", "log-good");
        showOverlay("CITY SECURED", [
            "You sorted every update with " + integrity + "% shield integrity left.",
            "Final score: " + score + " (includes +" + bonus + " bonus)"
        ], "PLAY AGAIN");
    } else {
        updateHUD();
        log("BREACH DETECTED.", "log-bad");
        showOverlay("NETWORK BREACHED", [
            reason || "The shield has failed.",
            "Final score: " + score
        ], "TRY AGAIN");
    }
}

// ---------- startup ----------
// On page load: clear the demo cards from the HTML, draw the HUD,
// and show the start screen. The game begins when the player clicks START.
feed.innerHTML = "";
updateHUD();
showOverlay("NEON DEFENDER", [
    "Fake updates are trying to breach the grid.",
    "APPLY PATCH on legitimate updates. IGNORE the malicious ones.",
    "Correct calls buy you time. Mistakes cost time and shield integrity.",
    "Sort all " + notifications.length + " notifications before the breach."
], "START DEFENSE");
