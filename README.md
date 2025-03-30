# Odds calculator for PokerNow.club

This Chrome extension enhances your PokerNow.club experience by adding a real-time pot odds calculator and an optional Monte Carlo simulation for estimating your win rate. It displays pot odds for every decision—yours and other players’—right on the screen.

This tool combines features from two GitHub repositories: [pokernow-pot-odds-extension](https://github.com/originalpete/pokernow-pot-odds-extension) and [holdem-monte-carlo-evaluator](https://github.com/mercertom/holdem-monte-carlo-evaluator).

## Pod odds calculation

Pot odds, as explained on [Wikipedia](https://en.wikipedia.org/wiki/Pot_odds), represent the ratio between the current size of the pot and the cost of a potential call. 
In poker, this helps you determine if calling is worthwhile by comparing the pot odds to your chances of completing a winning hand with future cards. 
This calculation guides your decisions to call, raise, or fold.

## Win rate evaluator

The win rate feature estimates your chances of winning, tying, or losing a hand. 
It uses a Monte Carlo simulation—a method that runs multiple scenarios—to evaluate your known cards against the unknown hands of your opponents. 
This gives you a clearer picture of your hand’s strength.

## How does it work?

Once you've installed the Chrome extension, you'll see a small "Pot odds" box appear at top right side of the screen.
A win/tie percentage will be on the top left and rate of possible Poker hit will display in the center of the table, based on your current cards.
![Screenshot](https://github.com/hieunm3538/pokernow-monte-carlo-extension/blob/main/docs/img.png)
This extension simplifies poker decisions with real-time data, making it easier to play smarter!
