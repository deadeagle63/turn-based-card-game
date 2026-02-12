# Turn based card game
Built with React, XState, React-Router-Dom and Tailwind CSS.

## How To Run
To run the project locally, follow these steps:
### Install dependencies and start the development server:
```bash
npm i
npm run dev
```
Open the app in your [browser](http://localhost:5173)

# How To Play
## Features
### Resumeability
The game state is saved to local storage, allowing players to resume their game after refreshing the page or closing the browser.

## Rules
- The game is played until the timer reaches 0 or the draw pile is empty.
- If the `Draw Pile` is empty, and someone reaches a empty hand, they win the game.
- If the timer reaches 0, the player with the lowest total hand value wins.
- 
### Auto Play

The game will auto play if,
- Only one valid card exists in the player's hand, or - The player has no valid cards to play and must draw from the deck. 

### Selection Mode
The game allows the player to multiplay cards if no autoplay is available, if they desire they can play as many possible
cards a chain allows for e.g. if the player has two 7s, they can play both at the same time.

It also allows players to chain to different suites to optimize their flow e.g 
```js
// Top card in play pile = 7&clubs;
// given the player hand below
["7&hearts;", "3&clubs;", "3&spades;", "3&diams;", "7&diams;"] 
// player can play
// 7&hearts; -> 7&diams; - > 3&diams; - > 3&clubs; - > 3&spades;
// which instantly clears their held cards 
```