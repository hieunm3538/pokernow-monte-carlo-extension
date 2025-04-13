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

    // Inject pot odds UI box
    var html = "<div class='pot-odds-container'>Pot odds:&nbsp;<span class='pot-odds-value'>&mdash;</span></div>";
    jQuery(".table").prepend(jQuery(html));

    // Inject stack total UI box
    var html = "<div class='chip-count-container'>Chip count:&nbsp;<span class='chip-count-value'>&mdash;</span></div>";
    jQuery(".table").prepend(jQuery(html));

    // Inject win UI box
    var html = "<div class='win-container'>Wins:&nbsp;<span class='win-value'>&mdash;</span></div>";
    jQuery(".table").prepend(jQuery(html));

    // Inject ties UI box
    var html = "<div class='tie-container'>Ties:&nbsp;<span class='tie-value'>&mdash;</span></div>";
    jQuery(".table").prepend(jQuery(html));

    // Inject hands UI box
    var html = "<div class='hands-container'>&nbsp;<span class='hands-value'>&mdash;</span></div>";
    jQuery(".table").prepend(jQuery(html));

    // Initiate observers
    var targetNode = jQuery(".table")[0];

    // Options for the observer (which mutations to observe)
    const config = {characterData: true, attributes: true, childList: true, subtree: true};

    // Callback function to execute when mutations are observed
    var callback = function (mutationsList, observer) {
        for (var mutation of mutationsList) {

            // Skip non-element nodes
            if (
                !mutation.target.getAttribute
                || !mutation.target.getAttribute('class')
            ) {
                continue
            }

            var c = mutation.target.getAttribute('class');

            if (c.match(/decision\-current|flipped/)) {
                updatePotOdds();
            }

            if (c.match(/flipped/)) {
                updateWinPercent();
            }
        }
    };

    // Create an observer instance linked to the callback function
    var observer = new MutationObserver(callback);

    // Start observing the target node for configured mutations
    observer.observe(targetNode, config);

    if (DEBUG) {
        console.log("...setup done.");
    }
};

// Do the main thing
var updatePotOdds = function () {

    jQuery(".pot-odds-value").html("&mdash;");

    // Extract current pot size
    var potTotal = parseInt(jQuery(".table-pot-size").text());

    // Extract current bets into array
    var currentBets =
        jQuery(".table-player p.table-player-bet-value")
            .toArray()
            .map(function (e) {
                return parseFloat(e.innerText.replace(/check/i, "0"));
            });

    // Sum up all current bets on the table, including current player
    var currentBetsTotal = currentBets.reduce((a, b) => a + b, 0);

    // Find out largest current bet
    var largestCurrentBet = Math.max(...currentBets);

    // Locate current player and extract bet size
    var currentPlayer = jQuery(".decision-current").first();
    var currentPlayerBetUI = currentPlayer.find("p.table-player-bet-value");
    var currentPlayerBet = 0 + (
        currentPlayerBetUI
        && parseFloat(currentPlayerBetUI.text().replace(/check/i, "0") || 0)
    );

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
    var stackTotals = jQuery(".table-player-stack").toArray().reduce((a, b) => a + parseInt(b.innerText), 0);
    var chipCount = stackTotals + potTotal + currentBetsTotal;
    jQuery(".chip-count-value").html(chipCount);
};

var updateWinPercent = function () {
    jQuery(".win-value").html("&mdash;");
    jQuery(".tie-value").html("&mdash;");
    jQuery(".hands-value").html("High Card: - | Pair: - | Two Pair: - | Trips: - | Straight: - | Flush: - | Full House: - | Quads: - | Straight Flush: -")
    // Extract hand cards from the table-cards element
    var handCards = formatString(jQuery(".you-player .table-player-cards").text().trim());

    // Extract hand cards from the table-cards element
    var tableCards = formatString(jQuery(".table-cards").text().trim());

    // Extract number of player
    var seats = jQuery(".table-player-stack").toArray().length - jQuery(".table-player .fold").toArray().length

    var equity = monteCarlo(handCards, tableCards, seats - 1, [], 8000)
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

function formatString(input) {
    input = input.replaceAll("10", "T")
    let result = [];

    // Loop through the string in chunks of 3
    for (let i = 0; i < input.length; i += 3) {
        result.push(input.slice(i, i + 3).slice(0, 2));  // Push substrings of size 3
    }

    return result;
}

// MONTE CARLO
function monteCarlo(hand,board,numberOpponents,opponentLags,runs) {
    let numberPlayers = numberOpponents + 1;

    // if not specified, assume full ranges (100% LAG) for each opponent
    if (!opponentLags) {
        var opponentsLags = [];
    }
    for (i = 0; i < numberOpponents; i++) {
        if (!opponentLags[i] || opponentLags[i] <= 0 || opponentLags[i] > 1) {
            opponentLags[i] = 1;
        }
    }

    //Initialize results object
    let results = {
        wins:0,
        ties:0,
        losses:0,
        runs:0
    };

    //initialize full deck with int or str cards to match hand input type
    if (typeof hand[0] === 'string') {
        var deck = ['As','2s','3s','4s','5s','6s','7s','8s','9s','Ts','Js','Qs','Ks','Ac','2c','3c','4c','5c','6c','7c','8c','9c','Tc','Jc','Qc','Kc','Ah','2h','3h','4h','5h','6h','7h','8h','9h','Th','Jh','Qh','Kh','Ad','2d','3d','4d','5d','6d','7d','8d','9d','Td','Jd','Qd','Kd'];
    }
    else {
        var deck = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52];
    }

    //Remove hand and board cards from the deck
    deck.splice(deck.indexOf(hand[0]),1);
    deck.splice(deck.indexOf(hand[1]),1);
    for (i = 0; i < board.length; i++) {
        deck.splice(deck.indexOf(board[i]),1);
    }

    let handValues = [
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
    ];

    let hands = [
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
    ];

    //Monte Carlo Loop
    for (runNum = 0; runNum < runs; runNum++) {

        //(Re)set arrays
        let mcDeck = deck.slice();
        let mcBoard = board.slice();

        //For each opponent, draw two cards from the deck
        for ( i = 1; i <= numberOpponents; i++ ) {
            hands[i][runNum] = [randCard(mcDeck),randCard(mcDeck)];
        }

        //For each unfilled board card, draw a card from the deck
        for ( i = board.length; i < 5; i++ ) {
            mcBoard.push(randCard(mcDeck));
        }

        //evaluate the value (rank) of each 7 card hand, store the values in handValues[]
        handValues[0][runNum] = rankHand(hand.concat(mcBoard)).value;
        for ( i = 1; i <= numberOpponents; i++ ) {
            handValues[i][runNum] = rankHand(hands[i][runNum].concat(mcBoard)).value;
        }
    }

    //Pre-eval logic for ranges
    let cutoff = [];
    orderedHandValues = [];
    for (i = 1; i <= numberOpponents; i++) {
        orderedHandValues[i] = handValues[i].slice();
        orderedHandValues[i].sort(function(a, b) {
            return a - b;
        });
        cutoff[i] = orderedHandValues[i][Math.floor(runs * (1 - opponentLags[i - 1]))];
    }

    //Trim impossibilities, based on players' tightness
    trimmedValues = [
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
    ];
    trimmedHands = [
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
    ];

    for (runNum = 0; runNum < handValues[0].length; runNum++) {
        for (opp = 1; opp <= numberOpponents; opp++) {
            if (handValues[opp][runNum] < cutoff[opp]) {
                break;
            }
            if (opp === numberOpponents) {
                for (i = 0; i <= numberOpponents; i++) {
                    trimmedValues[i].push(handValues[i][runNum]);
                    if(i > 0) {
                        trimmedHands[i].push(hands[i][runNum]);
                    }
                }
            }
        }
    }

    let handTypes = [
        'invalid hand',
        'hicard',
        'pair',
        'twopair',
        'trips',
        'straight',
        'flush',
        'FH',
        'quads',
        'straightflush'
    ];

    let probableHands = [];
    let possibleHandTypes = [];

    for (runNum = 0; runNum < trimmedValues[0].length; runNum++) {
        for (i = 0; i <= numberOpponents; i++) {
            if (!possibleHandTypes[i]) {
                possibleHandTypes[i] = [];
            }
            possibleHandTypes[i].push(handTypes[Math.floor(trimmedValues[i][runNum] / 1000000)]);
        }
    }

    for (player in possibleHandTypes) {
        handTypesCounts = {};
        possibleHandTypes[player].forEach((el) => {
            handTypesCounts[el] = handTypesCounts[el] ? (handTypesCounts[el] += 1) : 1;
        });
        probableHands[player] = handTypesCounts;
    }

    let handOdds = [];

    for (player in probableHands) {
        handOdds[player] = {
            hicard:Math.floor( 100 * probableHands[player].hicard / trimmedValues[0].length || 0),
            pair:Math.floor( 100 * probableHands[player].pair / trimmedValues[0].length || 0),
            twopair:Math.floor( 100 * probableHands[player].twopair / trimmedValues[0].length || 0),
            trips:Math.floor( 100 * probableHands[player].trips / trimmedValues[0].length || 0),
            straight:Math.floor( 100 * probableHands[player].straight / trimmedValues[0].length || 0),
            flush:Math.floor( 100 * probableHands[player].flush / trimmedValues[0].length || 0),
            FH:Math.floor( 100 * probableHands[player].FH / trimmedValues[0].length || 0),
            quads:Math.floor( 100 * probableHands[player].quads / trimmedValues[0].length || 0),
            straightflush:Math.floor( 100 * probableHands[player].straightflush / trimmedValues[0].length || 0),
        };
    }

    //Eval loop: determine won/lost/tied, and increment results object
    for (runNum = 0; runNum < trimmedValues[0].length; runNum++, results.runs++) {
        let isTied = false;
        for (i = 1; i <= numberOpponents; i++) {
            if ( trimmedValues[0][runNum] < trimmedValues[i][runNum] ) {
                results.losses++;
                break;
            }
            else if (trimmedValues[0][runNum] === trimmedValues[i][runNum]) {
                isTied = true;
            }
            if (i === numberOpponents) {
                if (isTied) {
                    results.ties++;
                }
                else {
                    results.wins++;
                }
            }
        }
    }
    //catch case where players are impossibly tight
    if (trimmedValues[0].length === 0) {
        results.runs = 1;
    }

    //Output expected win/tie/loss rates
    console.log('------------------------------------------------');
    console.log('Hand: ' + hand);
    console.log('Board: ' + board + ', ' + numberOpponents + ' opponents, ' + runs + ' runs');
    console.log('won: ' + Math.round( 10000 * results.wins / results.runs ) / 100 + '%');
    console.log('tied: ' + Math.round( 10000 * results.ties / results.runs ) / 100 + '%');
    console.log('lost: ' + Math.round( 10000 * results.losses / results.runs )  / 100 + '%');
    console.log('------------------------------------------------');

    //return the wins/ties/losses/runs results object
    return {
        results:results,
        handOdds:handOdds
    };
}

//Draw a random card from a deck array, remove it from the deck array, and return the card value
function randCard (deck) {
    var cardIndex = Math.floor(Math.random() * deck.length);
    var card = deck[cardIndex];
    deck.splice(cardIndex,1);
    return card;
}

// POKER EVAL
function rankHand(cards) {
    const RANKS = "23456789TJQKA";
    const SUITS = "cdhs";

    const handNames = [
        "high card", "one pair", "two pair", "three of a kind",
        "straight", "flush", "full house", "four of a kind",
        "straight flush"
    ];

    if (cards.length < 2) return null; // At least 2 cards required

    let ranks = cards.map(card => RANKS.indexOf(card[0])).sort((a, b) => b - a);
    let suits = cards.map(card => card[1]);

    let rankCounts = {};
    let suitCounts = {};

    for (let r of ranks) rankCounts[r] = (rankCounts[r] || 0) + 1;
    for (let s of suits) suitCounts[s] = (suitCounts[s] || 0) + 1;

    let isFlush = Object.values(suitCounts).some(count => count >= 5);
    let isStraight = false;
    let straightHigh = -1;

    let uniqueRanks = [...new Set(ranks)];
    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
        if (uniqueRanks[i] - uniqueRanks[i + 4] === 4) {
            isStraight = true;
            straightHigh = uniqueRanks[i];
        }
    }
    // Special straight case: A-2-3-4-5
    if ([12, 3, 2, 1, 0].every(r => uniqueRanks.includes(r))) {
        isStraight = true;
        straightHigh = 3;
    }

    // Check for Straight Flush
    if (isFlush) {
        let flushCards = cards.filter(card => suitCounts[card[1]] >= 5);
        let flushRanks = flushCards.map(card => RANKS.indexOf(card[0])).sort((a, b) => b - a);
        let uniqueFlushRanks = [...new Set(flushRanks)];

        for (let i = 0; i <= uniqueFlushRanks.length - 5; i++) {
            if (uniqueFlushRanks[i] - uniqueFlushRanks[i + 4] === 4) {
                return buildHand(9, uniqueFlushRanks[i], 9000000 + uniqueFlushRanks[i], "straight flush");
            }
        }
    }

    // Four of a Kind
    for (let r in rankCounts) {
        if (rankCounts[r] === 4) {
            return buildHand(8, r, 8000000 + r * 100 + ranks[0], "four of a kind");
        }
    }

    // Full House
    let three = null, pair = null;
    for (let r in rankCounts) {
        if (rankCounts[r] === 3) {
            if (three === null) {
                three = r;
            } else {
                pair = r;
            }
        }
        if (rankCounts[r] === 2) pair = r;
    }
    if (three !== null && pair !== null) {
        return buildHand(7, three, 7000000 + three * 100 + pair * 1, "full house");
    }

    // Flush
    if (isFlush) {
        return buildHand(6, ranks[0], 6000000 + ranks[0], "flush");
    }

    // Straight
    if (isStraight) {
        return buildHand(5, straightHigh, 5000000 + straightHigh, "straight");
    }

    // Three of a Kind
    if (three !== null) {
        return buildHand(4, three, 4000000 + three * 100 + ranks[0], "three of a kind");
    }

    // Two Pair
    let pairs = Object.keys(rankCounts).filter(r => rankCounts[r] === 2).map(Number);
    if (pairs.length >= 2) {
        pairs.sort((a, b) => b - a);
        return buildHand(3, pairs[0], 3000000 + pairs[0] * 100 + pairs[1], "two pair");
    }

    // One Pair
    if (pair !== null) {
        return buildHand(2, pair, 2000000 + pair * 100 + ranks[0], "one pair");
    }

    // High Card
    return buildHand(1, ranks[0], 1000000 + ranks[0], "high card");

    function buildHand(type, rank, value, name) {
        return {
            handType: type,
            handRank: rank,
            value: parseInt(value),
            handName: name
        };
    }
}