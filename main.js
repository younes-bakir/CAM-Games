/* 
Younes Bakir
10/29/26
CAM Game
*/ 

// core game values
const START_TIME = 45;      
let timer = START_TIME;     
let integrity = 100;        
let score = 0;              

// notification data
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

// game config
const MAX_VISIBLE = 3;             
const TIME_BONUS = 2;              
const TIME_PENALTY = 8;            
const INTEGRITY_HIT_MALWARE = 35;  
const INTEGRITY_HIT_MISSED = 25;   

// grab elements from index.html
const feed = document.querySelector(".feed-container");   
const timerEl = document.querySelector(".timer-alert");   
const shieldEl = document.querySelector(".hud-status .status-item:nth-child(2) div");  
const scoreEl = document.querySelector(".hud-status .status-item:nth-child(3) div");   
const logEl = document.querySelector(".terminal-log");    
const threatEl = document.querySelector(".system-specs p:nth-child(2)");

// game state (startGame resets every round)
let queue = [];       // notifications to be shown
let active = 0;       // number of cards currently on screen
let resolved = 0;     // number of cards the player has decided on
let running = false;  // true while a round is in progress
let tickId = null;    // id of the 1-second timer interval

// returns a randomly ordered copy of an array
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Converts seconds into a mm:ss string, where mm = minutes and ss = seconds
function formatTime(s) {
    const m = Math.floor(s / 60);
    return String(m).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

// adds a line to the sidebar terminal
function log(text, cls) {
    const p = document.createElement("p");
    p.textContent = "> " + text;
    if (cls) p.className = cls;
    logEl.appendChild(p);
    while (logEl.children.length > 10) logEl.removeChild(logEl.firstChild);
}

// refreshes the top hud, threat level, and swaps shield color as it drops
function updateHUD() {
    timerEl.textContent = formatTime(Math.max(0, timer));
    shieldEl.textContent = Math.max(0, integrity) + "%";
    scoreEl.textContent = String(score).padStart(4, "0");

    // green above 60%, yellow above 30%, pink below 30
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

// notification cards------------------------------------------------------------------ 

// Builds one notif card for a notification object and instates button functionality
function createCard(n) {
    const card = document.createElement("div");
    card.className = "card";

    // title + desc on left
    const info = document.createElement("div");
    info.className = "card-info";
    const h3 = document.createElement("h3");
    h3.textContent = n.title;
    const p = document.createElement("p");
    p.textContent = n.desc;
    info.append(h3, p);

    // apply/ignore buttons on right
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

    patch.addEventListener("click", () => decide(card, n, true));
    dismiss.addEventListener("click", () => decide(card, n, false));
    return card;
}

// Takes the next notification from the queue and puts its card in the feed as long as round is active and there's room on screen
function spawnCard() {
    if (!running || queue.length === 0 || active >= MAX_VISIBLE) return;
    const n = queue.shift();
    feed.appendChild(createCard(n));
    active++;
    log("Incoming: " + n.title);
}

function fillFeed() {
    while (active < MAX_VISIBLE && queue.length > 0) spawnCard();
}

// player decisions---------------------------------------------------------------------

// called when the player clicks a button on a card.
function decide(card, n, applied) {
    // ignore clicks if the game is over or the specific card was already handled
    if (!running || card.dataset.done) return;
    card.dataset.done = "1";
    card.querySelectorAll("button").forEach(b => (b.disabled = true));

    // correct = applied a real update OR ignored a fake one
    const correct = (n.type === "real") === applied;

    // rewarded
    if (correct) {
        score += 100;
        timer += TIME_BONUS;
        card.classList.add("card-correct");
        log(applied ? "Patch verified & applied: " + n.title
                    : "Threat blocked: " + n.title, "log-good");
    // exiled
    } else {
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

    // green/red flash shows briefly then removes card, and either finish the game or bring the next notification
    setTimeout(() => {
        card.remove();
        if (!running) return;
        if (resolved >= notifications.length) endGame(true);
        else fillFeed();
    }, 350);

    // check lose conditions
    if (integrity <= 0) endGame(false, "Shield integrity reached 0%.");
    else if (timer <= 0) endGame(false, "The breach timer ran out.");
}

// game flow----------------------------------------------------------------------------------

// ends the game if timer hits 0
function tick() {
    timer--;
    updateHUD();
    if (timer <= 0) endGame(false, "The breach timer ran out.");
}

// builds and shows a start/win/lose screen
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

    lines.forEach(t => {
        const p = document.createElement("p");
        p.textContent = t;
        box.appendChild(p);
    });

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

// reset everything and begin a new round
function startGame() {
    clearInterval(tickId);   // makes sure no old timer is still running

    // reset values and shuffle card order
    timer = START_TIME;
    integrity = 100;
    score = 0;
    resolved = 0;
    active = 0;
    queue = shuffle(notifications);
    running = true;

    // clear the screen and the terminal, then show the first cards
    feed.innerHTML = "";
    logEl.innerHTML = "";
    log("Initializing shield nodes...");
    log("Filter active. Awaiting input.");
    updateHUD();
    fillFeed();

    // start the countdown
    tickId = setInterval(tick, 1000);
}

// ends round, reason is the text shown on the lose screen
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
