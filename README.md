# Odds calculator for PokerNow.club

This Chrome Extension adds a real-time pot odds calculator to the display, showing pot odds for every decision (yours and other players), plus an optional Monte Carlo simulation for winrate estimation.

This repository is a combination of several repos, [pokernow-pot-odds-extension](https://github.com/originalpete/pokernow-pot-odds-extension) and [holdem-monte-carlo-evaluator](https://github.com/mercertom/holdem-monte-carlo-evaluator).

## Pod odds calculation

[From Wikipedia](https://en.wikipedia.org/wiki/Pot_odds):

> In poker, pot odds are the ratio of the current size of the pot to the cost of a contemplated call. Pot odds are often compared to the probability of winning a hand with a future card in order to estimate the call's expected value.

You can use pot odds to help you decide whether to call, raise or fold, by comparing the pot odds to the odds of making your hand.

## Win rate evaluator

Poker odds calculate the chances of you holding a winning hand.
Win/tie/loss evaluator for known hands versus unknown opponent hands, using a poker hand evaluation and Monte-Carlo simulation for all possible hand in a set of limited runs.

## How does it work?

Once you've installed the Chrome extension, you'll see a small "Pot odds" box appear at all times. The odds are expressed as a fraction of `1.0`. 

You'll also see a line describe win/tie/loss rate in middle of the table, based on your cards.

![Screenshot](https://github.com/hieunm3538/pokernow-monte-carlo-extension/blob/main/docs/img.png)
