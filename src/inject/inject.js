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

    // Inject hands UI box
    html = "<div class='hands-container'>&nbsp;<span class='hands-value'>&mdash;</span></div>";
    $table.prepend(jQuery(html));

    // Inject win/tie/loss UI box
    html = "<div class='results-container'>Wins: &nbsp;<span class='win-value'>&mdash;</span>" +
        " | Ties: &nbsp;<span class='tie-value'>&mdash;</span>" +
        " | Losses: &nbsp;<span class='loss-value'>&mdash;</span></div>";
    $table.prepend(jQuery(html));

    // Inject verdict (EV), outs, position/SPR and bet sizing UI boxes
    html = "<div class='ev-container'>Verdict:&nbsp;<span class='ev-value'>&mdash;</span></div>";
    $table.prepend(jQuery(html));

    html = "<div class='outs-container'>Outs:&nbsp;<span class='outs-value'>&mdash;</span></div>";
    $table.prepend(jQuery(html));

    html = "<div class='position-container'>Position:&nbsp;<span class='position-value'>&mdash;</span></div>";
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
        updateInfoPanel()
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
var lastEquity = null;
var dealtSeats = [];
var dealtKey = null;

var updateWinPercent = function () {
    var handCards = readCards(".you-player .table-player-cards");
    var tableCards = readCards(".table-cards");
    var active = activePlayers();

    var key = handCards.join("") + "|" + tableCards.join("") + "|" + active.length + "|" + dealerSeat();
    if (key === lastWinKey) return;
    lastWinKey = key;
    lastEquity = null;

    jQuery(".win-value").html("&mdash;");
    jQuery(".tie-value").html("&mdash;");
    jQuery(".loss-value").html("&mdash;");
    jQuery(".outs-value").html("&mdash;");
    jQuery(".hands-value").html("High Card: - | Pair: - | Two Pair: - | Trips: - | Straight: - | Flush: - | Full House: - | Quads: - | Straight Flush: -")
    // Extract hand cards from the table-cards element
    var handCards = readCards(".you-player .table-player-cards");

    // Extract hand cards from the table-cards element
    var tableCards = readCards(".table-cards");

    if (handCards.length < 2) return;

    var you = jQuery(".you-player")[0];
    if (active.indexOf(you) === -1) return;

    var handKey = handCards.join("") + "|" + dealerSeat();
    if (handKey !== dealtKey) {
        dealtKey = handKey;
        dealtSeats = active.map(seatNumber);
    }

    var opponents = active.length - 1;
    if (opponents < 1) return;

    var outs = computeOuts(handCards, tableCards);
    if (outs) jQuery(".outs-value").html(formatOuts(outs, tableCards.length));

    var equity = monteCarlo(handCards, tableCards, opponents, 8000)
    lastEquity = (equity.results.wins + equity.results.ties / 2) / equity.results.runs;
    jQuery(".win-value").html(Math.round(10000 * equity.results.wins / equity.results.runs ) / 100 + '%');
    jQuery(".tie-value").html(Math.round(10000 * equity.results.ties / equity.results.runs ) / 100 + '%');
    jQuery(".loss-value").html(Math.round(10000 * equity.results.losses / equity.results.runs ) / 100 + '%');
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

// Players still in the hand: holding cards and not folded
function activePlayers() {
    return jQuery(".table-player").toArray().filter(function (el) {
        var $el = jQuery(el);
        return $el.find(".table-player-cards .card-container").length > 0 &&
            !$el.hasClass("fold") &&
            $el.find(".fold").length === 0;
    });
}

// Seat numbers follow the table-player-N / dealer-position-N classes
function seatNumber(el) {
    var m = /table-player-(\d+)/.exec(el.className);
    return m ? parseInt(m[1], 10) : null;
}

function dealerSeat(){
    var m = /dealer-position-(\d+)/.exec(jQuery(".dealer-button-ctn").attr("class") || "");
    return m ? parseInt(m[1], 10) : null;
}

// Assumes seat numbers run clockwise, i.e. in action order. Flip if positions look reversed.
const SEATS_ASCENDING= true;

const MIDDLE_POSITIONS= {
    1: ['CO'],
    2: ['HJ', 'CO'],
    3: ['LJ', 'HJ', 'CO'],
    4: ['UTG', 'LJ', 'HJ', 'CO'],
    5: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
    6: ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'],
    7: ['UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'LJ', 'HJ', 'CO']
};

function positionName(dealer, hero, seats) {
    if (dealer === null || seats.length < 2 || seats.indexOf(hero) === -1) return null;

    var order = seats.slice().sort(function (a, b) { return SEATS_ASCENDING ? a - b : b - a; });

    // Rotate so the button (or the closest seat before it) comes last
    var idx = -1;
    order.forEach(function (seat, i) {
        if (SEATS_ASCENDING ? seat <= dealer : seat >= dealer) idx = i;
    });
    if (idx === -1) idx = order.length - 1;
    order = order.slice(idx + 1).concat(order.slice(0, idx + 1));

    var n = order.length, h = order.indexOf(hero);
    if (n === 2) return h === 1 ? "BTN/SB" : "BB";
    if (h === n - 1) return "BTN";
    if (h === 0) return "SB";
    if (h === 1) return "BB";
    return (MIDDLE_POSITIONS[n - 3] || [])[h - 2] || null;
}

var pct = function (x){ return Math.round(x * 100) + "%"; };

// Verdict, position/SPR and bet sizing, all from our point of view
var updateInfoPanel = function (){
    var $verdict = jQuery(".ev-value").removeClass("ev-good ev-bad ev-meh").html("&mdash;");
    jQuery(".position-value").html("&mdash;");

    var $you = jQuery(".you-player");
    var active = activePlayers();
    if ($you.length === 0 || active.indexOf($you[0]) === -1) return;

    var potTotal = parseChips(jQuery(".table-pot-size .main-value").first().text());
    var bets = jQuery(".table-player p.table-player-bet-value").toArray().map(function (e) {
        return parseChips(e.innerText);
    });
    var pot = potTotal + bets.reduce((a, b) => a + b, 0);
    var largest = Math.max(0, ...bets);

    var heroBet = parseChips($you.find("p.table-player-bet-value").first().text());
    var heroStack = parseChips($you.find(".table-player-stack").text());

    // Amount we must add to call, capped by our stack (an uncallable excess comes back to the bettor)
    var toCall = largest - heroBet;
    var call = Math.min(toCall, heroStack);
    var potWon = pot - (toCall - call);

    // Verdict: compare our equity with the equity a call needs
    if (lastEquity !== null) {
        if (call <= 0) {
            $verdict.html("Free to check &middot; equity " + pct(lastEquity));
        } else {
            var need = call / (potWon + call);
            var edge = lastEquity - need;
            var ev = Math.round(lastEquity * potWon - (1 - lastEquity) * call);
            var label = edge > 0.03 ? "CALL +EV" : edge < -0.03 ? "FOLD -EV" : "MARGINAL";
            $verdict
                .addClass(edge > 0.03 ? "ev-good" : edge < -0.03 ? "ev-bad" : "ev-meh")
                .html(label + " &middot; equity " + pct(lastEquity) + " vs need " + pct(need) +
                    " &middot; EV " + (ev >= 0 ? "+" : "") + ev);
        }
    }

    // Position and stack-to-pot ratio (effective stack = ours vs the biggest stack still in)
    var position = positionName(dealerSeat(), seatNumber($you[0]), dealtSeats);
    var oppStacks = active.filter(function (el) { return el !== $you[0]; }).map(function (el) {
        return parseChips(jQuery(el).find(".table-player-stack").text());
    });
    var spr = "";
    if (pot > 0 && oppStacks.length > 0) {
        var value = Math.min(heroStack, Math.max(...oppStacks)) / pot;
        spr = " | SPR " + value.toFixed(1) + (value < 4 ? " (low)" : value < 10 ? " (medium)" : " (high)");
    }
    jQuery(".position-value").html((position || "?") + spr);
};

// MONTE CARLO
const RANK_CHARS = "23456789TJQKA";
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
        const heroValue = evaluateCards(buf, 7);
        typeCounts[(heroValue / 1000000) | 0]++;

        let lost = false, tied = false;
        for (let o = 0; o < numberOpponents; o++) {
            buf[0] = deck[needBoard + 2*o];
            buf[1] = deck[needBoard + 2*o + 1];
            const v = evaluateCards(buf, 7);
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

function evaluateCards(cards, n) {
    for (let i = 0; i < 13; i++) rankCount[i] = 0;
    for (let i = 0; i < 4; i++) { suitCount[i] = 0; suitMask[i] = 0; }
    let rankMask = 0;
    for (let i = 0; i < n; i++) {
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
        const cnt = rankCount[r];
        if (cnt === 4) {
            if (quad < 0) quad = r;
        } else if (cnt === 3) {
            if (t1 < 0) t1 = r;
            else if (pr < 0) pr = r;
        } else if (cnt === 2) {
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
        return 2000000 + p1 * 2197 + topRanks(rankMask & ~(1 << p1), 3);
    }

    return 1000000 + topRanks(rankMask, 5);
}

const OUT_NAMES = {
    2: 'Pair', 3: 'Two pair', 4: 'Trips', 5: 'Straight',
    6: 'Flush', 7: 'Full house', 8: 'Quads', 9: 'Straight flush'
};

function handType(cards) {
    const arr = Uint8Array.from(cards);
    return (evaluateCards(arr, arr.length) / 1000000) | 0;
}

// Unseen cards that improve our hand category, on the flop or turn.
// Cards that improve the board by itself (e.g. pair the board) don't count.
function computeOuts(hand, board){
    if (board.length < 3 || board.length > 4) return null;

    const mine = hand.concat(board).map(cardToInt);
    const shared = board.map(cardToInt);
    const current = handType(mine);

    const byType = {};
    let outs = 0;
    for (let c = number = 0; c < 52; c++) {
        if (mine.indexOf(c) !== -1) continue;
        const type = handType(mine.concat(c));
        if (type <= current || type <= handType(shared.concat(c))) continue;
        outs++;
        byType[type] = (byType[type] || 0) + 1;
    }
    return { outs: outs, byType: byType, unseen: 52 - mine.length };
}

function formatOuts(o, boardLen)  {
    if (o.outs === 0) return "none";

    const parts = Object.keys(o.byType).map(Number).sort((a, b) => b - a).map(function (t) {
        return OUT_NAMES[t] + " " + o.byType[t];
    });
    const miss = o.unseen - o.outs;
    const hit = boardLen === 3
        ? 1 - (miss / o.unseen) * ((miss - 1) / (o.unseen - 1))
        : o.outs / o.unseen;
    return o.outs + " (" + parts.join(", ") + ") &middot; " + pct(hit) + " by river";
}