const DEBUG = false;

// Timer to ensure the host page is complete before we jam our shiz
var readyStateCheckInterval = setInterval(function () {
    if (document.readyState === "complete") {
        clearInterval(readyStateCheckInterval);

        if (DEBUG) {
            console.log("Beginning inject.js...");
        }

        setTimeout(function () {
            doSetup();
        }, 1000);
    }
}, 10);

// Setup, build output UI, and attach DOM observers
var doSetup = function () {
    // Ensure the table element exists
    var $table = jQuery(".table");

    if ($table.length === 0) {
        console.warn("No .table element found in the DOM. Aborting setup.");
        return;
    }

    // Inject pot odds UI box
    var html = "<div class='pot-odds-container'>Pot odds:&nbsp;<span class='pot-odds-value'>&mdash;</span></div>";
    $table.prepend(jQuery(html));

    // Inject stack total UI box
    html = "<div class='chip-count-container'>Chip count:&nbsp;<span class='chip-count-value'>&mdash;</span></div>";
    $table.prepend(jQuery(html));

    // Inject win UI box
    html = "<div class='win-container'>Wins:&nbsp;<span class='win-value'>&mdash;</span></div>";
    $table.prepend(jQuery(html));

    // Inject ties UI box
    html = "<div class='tie-container'>Ties:&nbsp;<span class='tie-value'>&mdash;</span></div>";
    $table.prepend(jQuery(html));

    // Inject hands UI box
    html = "<div class='hands-container'>&nbsp;<span class='hands-value'>&mdash;</span></div>";
    $table.prepend(jQuery(html));

    // Get the DOM node from jQuery object
    var targetNode = $table[0];

    // Options for the observer (which mutations to observe)
    const config = { characterData: true, attributes: true, childList: true, subtree: true };

    // Callback function to execute when mutations are observed
    var callback = function (mutationsList, observer) {
        for (var mutation of mutationsList) {
            // Skip non-element nodes
            if (
                !mutation.target.getAttribute ||
                !mutation.target.getAttribute('class')
            ) {
                continue;
            }

            var c = mutation.target.getAttribute('class');

            if (c.match(/decision\-current|flipped/)) {
                needPotOdds = true;
            }

            if (c.match(/flipped/)) {
                needWinPercent = true;
            }
        }

        scheduleUpdate();
    };

    // Create an observer instance linked to the callback function
    var observer = new MutationObserver(callback);

    // Start observing the target node for configured mutations
    observer.observe(targetNode, config);

    if (typeof DEBUG !== "undefined" && DEBUG) {
        console.log("...setup done.");
    }
};

var needPotOdds = false;
var needWinPercent = false;
var updateTimer = null;

var scheduleUpdate = function () {
    if (updateTimer !== null || !(needPotOdds || needWinPercent)) return;

    updateTimer = setTimeout(function () {
        updateTimer = null;
        var doPot = needPotOdds, doWin = needWinPercent;
        needPotOdds = needWinPercent = false;

        if (doPot) updatePotOdds();
        if (doWin) updateWinPercent();
    }, 50);
}

// Do the main thing
var updatePotOdds = function () {

    jQuery(".pot-odds-value").html("&mdash;");

    // Extract current pot size
    var potTotal = parseChips(jQuery(".table-pot-size .main-value").first().text());

    // Extract current bets into array
    var currentBets =
        jQuery(".table-player p.table-player-bet-value")
            .toArray()
            .map(function (e) {
                return parseChips(e.innerText);
            });

    // Sum up all current bets on the table, including current player
    var currentBetsTotal = currentBets.reduce((a, b) => a + b, 0);

    // Find out largest current bet
    var largestCurrentBet = Math.max(...currentBets);

    // Locate current player and extract bet size
    var currentPlayer = jQuery(".decision-current").first();
    var currentPlayerBetUI = currentPlayer.find("p.table-player-bet-value");
    var currentPlayerBet = parseChips(currentPlayerBetUI.first().text());

    // Update pot odds display if the current bet is smaller than the biggest bet on the table
    if (largestCurrentBet > 0 && largestCurrentBet > currentPlayerBet) {
        var amountToWin = potTotal + currentBetsTotal;
        var callToMake = largestCurrentBet - currentPlayerBet;
        var potOdds = '' + Math.round((callToMake / (amountToWin + callToMake) * 100.00)) + '%';

        jQuery(".pot-odds-value").html(potOdds);
    }

    if (DEBUG) {
        console.log("Pot: " + potTotal);
        console.log("Current bet total: " + currentBetsTotal);
        console.log("Largest current bet: " + largestCurrentBet);
        console.log("Current player bet: " + currentPlayerBet);
        console.log("Pot odds: " + potOdds);
    }

    // Display count of all chips on the table.
    // TODO: refactor this into a separate function, which daws current values from global variables.
    var stackTotals = jQuery(".table-player-stack").toArray().reduce((a, b) => a + parseChips(b.innerText), 0);
    var chipCount = stackTotals + potTotal + currentBetsTotal;
    jQuery(".chip-count-value").html(chipCount);
};

var lastWinKey = null;

var updateWinPercent = function () {
    var key = readCards(".you-player .table-player-cards").join("") +"|" +
        readCards(".table-cards").join("") + "|" +
        jQuery(".table-player-stack").length + "|" +
        jQuery(".table-player.fold, .table-player .fold").length;
    if (key === lastWinKey) return;
    lastWinKey = key;

    jQuery(".win-value").html("&mdash;");
    jQuery(".tie-value").html("&mdash;");
    jQuery(".hands-value").html("High Card: - | Pair: - | Two Pair: - | Trips: - | Straight: - | Flush: - | Full House: - | Quads: - | Straight Flush: -")
    // Extract hand cards from the table-cards element
    var handCards = readCards(".you-player .table-player-cards");

    // Extract hand cards from the table-cards element
    var tableCards = readCards(".table-cards");

    if (handCards.length < 2) return;

    // Extract number of player
    var seats = jQuery(".table-player-stack").toArray().length - jQuery(".table-player.fold, .table-player .fold").toArray().length
    if (seats < 2) return;

    var equity = monteCarlo(handCards, tableCards, seats - 1, 8000)
    jQuery(".win-value").html(Math.round(10000 * equity.results.wins / equity.results.runs ) / 100 + '%');
    jQuery(".tie-value").html(Math.round(10000 * equity.results.ties / equity.results.runs ) / 100 + '%');
    var hands = equity.handOdds[0]
    jQuery(".hands-value").html("High Card: " + hands.hicard + " %" +
        " | Pair: " + hands.pair + " %" +
        " | Two Pair: " + hands.twopair + " %" +
        " | Trips: " + hands.trips + " %" +
        " | Straight: " + hands.straight + " %" +
        " | Flush: " + hands.flush + " %" +
        " <br> Full House: " + hands.FH + " %" +
        " | Quads: " + hands.quads + " %" +
        " | Straight Flush: " + hands.straightflush + " %"
    )


    if (DEBUG) {
        console.log("Hand Cards: " + handCards);
        console.log("Table Cards: " + tableCards);
    }
};

function parseChips(text) {
    var n = parseFloat(String(text || "").replace(/,/g,"").replace(/[^0-9.]/g,""));
    return isNaN(n) ? 0 : n;
}

function readCards(selector) {
    return jQuery(selector)
        .find(".card-container.flipped")
        .toArray()
        .map(function (el) {
            var value = jQuery(el).find(".card .value").first().text().trim();
            var suit = jQuery(el).find(".card .suit").last().text().trim();
            if (value == "10") value = "T";
            return value + suit;
        })
        .filter(function (c) { return /^[2-9TJQKA][cdhs]$/.test(c); });
}

// MONTE CARLO
const RANK_CHARS = "23456789TJOKA";
const SUIT_CHARS = "cdhs";
const HAND_TYPES = [
    'invalid hand', 'hicard', 'pair', 'twopair', 'trips',
    'straight', 'flush', 'FH', 'quads', 'straightflush'
]

function cardToInt(card) {
    return RANK_CHARS.indexOf(card[0]) * 4 + SUIT_CHARS.indexOf(card[1]);
}

// Stimulate runs random deals. Opps hold random cards (full range).
function monteCarlo(hand, board, numberOpponents, runs) {
    const known = hand.concat(board).map(cardToInt);
    const boardLen = board.length;
    const needBoard = 5 - boardLen;
    const perRun = numberOpponents * 2 + needBoard;

    // Remaining deck
    const deck = new Uint8Array(52 - known.length);
    for (let c = 0, n = 0; c < 52; c++) {
        if (known.indexOf(c) === -1) deck[n++] = c;
    }

    // Reused 7-card buffer
    const buf = new Uint8Array(7);
    for (let i = 0; i < boardLen; i++) buf[2 + i] = known[2 + i];
    const h0 = known[0], h1 = known[1];

    const typeCounts = new Array(10).fill(0);
    let wins = 0, ties = 0, losses = 0;

    for (let run = 0; run < runs; run++) {
        for (let k = 0; k < perRun; k++) {
            const j = k + Math.floor(Math.random() * (deck.length - k));
            const t = deck[k]; deck[k] = deck[j]; deck[j] = t;
        }
        for (let b = 0; b < needBoard; b++) buf[2 + boardLen + b] = deck[b];

        buf[0] = h0; buf[1] = h1;
        const heroValue = evaluate7(buf);
        typeCounts[(heroValue / 1000000) | 0]++;

        let lost = false, tied = false;
        for (let o = 0; o < numberOpponents; o++) {
            buf[0] = deck[needBoard + 2*o];
            buf[1] = deck[needBoard + 2*o + 1];
            const v = evaluate7(buf);
            if (v > heroValue) {lost = true; break; }
            if (v === heroValue) tied = true;
        }
        if (lost) losses++;
        else if (tied) ties++;
        else wins++;
    }

    const handOdds = {};
    for (let t = 1; t < HAND_TYPES.length; t++) {
        handOdds[HAND_TYPES[t]] = Math.floor(100 * typeCounts[t] / runs);
    }

    return {
        results: {wins: wins, ties: ties, losses: losses, runs: runs},
        handOdds: [handOdds]
    };
}

// POKER EVAL
const rankCount = new Int8Array(13);
const suitCount = new Int8Array(4);
const suitMask = new Int16Array(4);

function topRanks(mask, n) {
    let score = 0;
    for (let r = 12; r >= 0 && n > 0; r--) {
        if (mask & (1 << r)) { score = score * 13 + r; n--; }
    }
    return score;
}

function straightHigh(mask) {
    const m = (mask << 1) | (mask >> 12);
    for (let p = 13; p >= 4; p--) {
        if (((m >> (p -4)) & 31) === 31) return p - 1;
    }
    return -1;
}

function evaluate7(cards) {
    for (let i = 0; i < 13; i++) rankCount[i] = 0;
    for (let i = 0; i < 4; i++) { suitCount[i] = 0; suitMask[i] = 0; }
    let rankMask = 0;
    for (let i = 0; i < 7; i++) {
        const c = cards[i], r = c >> 2, s = c & 3;
        rankCount[r]++; suitCount[s]++; suitMask[s] |= 1 << r; rankMask |= 1 << r;
    }

    let flushMask = 0;
    for (let s = 0; s < 4; s++) {
        if (suitCount[s] >= 5) flushMask = suitMask[s];
    }
    if (flushMask) {
        const sf = straightHigh(flushMask);
        if (sf >= 0) return 9000000 + sf;
    }

    let quad = -1, t1 = -1, pr = -1, p1 = -1, p2 = -1;
    for (let r = 12; r >= 0; r--) {
        const n = rankCount[r];
        if (n === 4) {
            if (quad < 0) quad = r;
        } else if (n === 3) {
            if (t1 < 0) t1 = r;
            else if (pr < 0) pr = r;
        } else if (n === 2) {
            if (pr < 0) pr = r;
            if (p1 < 0) p1 = r;
            else if (p2 < 0) p2 = r;
        }
    }

    if (quad >= 0) return 8000000 + quad * 13 + topRanks(rankMask & ~(1 << quad), 1);
    if (t1 >= 0 && pr >= 0) return 7000000 + t1 * 13 + pr;
    if (flushMask) return 6000000 + topRanks(flushMask, 5);

    const st = straightHigh(rankMask);
    if (st >= 0) return 5000000 + st;

    if (t1 >= 0) return 4000000 + t1 * 169 + topRanks(rankMask & ~(1 << t1), 2);
    if (p2 >= 0) {
        return 3000000 + (p1 * 13 + p2) * 13 + topRanks(rankMask & ~(1 << p1) & ~(1 << p2), 1);
    }
    if (p1 >= 0) {
        return 2000000 + p1 * 2917 + topRanks(rankMask & ~(1 << p1), 3);
    }

    return 1000000 + topRanks(rankMask, 5);
}
