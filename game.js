// Firebase Configuration - REPLACE WITH YOUR WEBSITES SETUP VALUES
const firebaseConfig = {
    apiKey: "AIzaSyB5U5YaSWsB0nwPBfZoFFbM7EM4_WiZ45A",
    authDomain: "aryan-ludo.firebaseapp.com",
    databaseURL: "https://aryan-ludo-default-rtdb.firebaseio.com/",
    projectId: "aryan-ludo",
    storageBucket: "aryan-ludo.firebasestorage.app",
    messagingSenderId: "826375754084",
    appId: "1:826375754084:web:11a74b9ca1dbd659ab2a71
};

// Initialize Firebase if configs are filled
let db = null;
if(firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
}

// Game State Configuration
const colors = ['red', 'green', 'yellow', 'blue'];
let activePlayers = ['red', 'green', 'yellow', 'blue'];
let playerMode = 'pass-play'; // 'pass-play' or 'vs-bot'
let currentTurnIndex = 0;
let currentRollValue = null;
let hasRolled = false;

// Track Mapping for 15x15 Board Cells
const cellMapping = {};

// Track Coordinate Path Arrays for Token Navigation
function generateBoardGrid() {
    const board = document.getElementById('ludo-board');
    
    for (let r = 1; r <= 15; r++) {
        for (let c = 1; c <= 15; c++) {
            // Skip Home Zones and Center Zones
            if (r <= 6 && c <= 6) continue;
            if (r <= 6 && c >= 10) continue;
            if (r >= 10 && c <= 6) continue;
            if (r >= 10 && c >= 10) continue;
            if (r >= 7 && r <= 9 && c >= 7 && c <= 9) continue;
            
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.style.gridArea = `${r} / ${c} / ${r+1} / ${c+1}`;
            cell.dataset.row = r;
            cell.dataset.col = c;
            
            // Design specific colored paths & safe spaces
            if (r === 2 && c === 8) cell.classList.add('green-path', 'safe-star');
            else if (r === 8 && c === 2) cell.classList.add('red-path', 'safe-star');
            else if (r === 14 && c === 8) cell.classList.add('blue-path', 'safe-star');
            else if (r === 8 && c === 14) cell.classList.add('yellow-path', 'safe-star');
            
            // Safe Home run arrows
            else if (r === 8 && c > 1 && c <= 6) cell.classList.add('red-path');
            else if (c === 8 && r > 1 && r <= 6) cell.classList.add('green-path');
            else if (r === 8 && c >= 10 && c < 15) cell.classList.add('yellow-path');
            else if (c === 8 && r >= 10 && r < 15) cell.classList.add('blue-path');
            
            // General Safe cells (Stars)
            if((r===3 && c===7) || (r===7 && c===13) || (r===13 && c===9) || (r===9 && c===3)) {
                cell.classList.add('safe-star');
            }
            
            board.appendChild(cell);
        }
    }
}

// Token State Management
const tokensState = {
    red: [ { pos: -1 }, { pos: -1 }, { pos: -1 }, { pos: -1 } ],
    green: [ { pos: -1 }, { pos: -1 }, { pos: -1 }, { pos: -1 } ],
    yellow: [ { pos: -1 }, { pos: -1 }, { pos: -1 }, { pos: -1 } ],
    blue: [ { pos: -1 }, { pos: -1 }, { pos: -1 }, { pos: -1 } ]
};

// Listen to Command Controller from Firebase Database
let riggedRollData = {};
if (db) {
    db.ref('riggedRolls').on('value', (snapshot) => {
        riggedRollData = snapshot.val() || {};
    });
}

// System initialization
document.addEventListener("DOMContentLoaded", () => {
    generateBoardGrid();
    setupEvents();
    renderTokens();
});

function setupEvents() {
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    document.getElementById('dice-container').addEventListener('click', handleDiceRoll);
    document.getElementById('restart-btn').addEventListener('click', () => {
        location.reload();
    });
}

function startGame() {
    const count = parseInt(document.getElementById('player-count').value);
    playerMode = document.getElementById('game-mode').value;
    
    if (count === 2) activePlayers = ['red', 'yellow'];
    else if (count === 3) activePlayers = ['red', 'green', 'yellow'];
    else activePlayers = ['red', 'green', 'yellow', 'blue'];
    
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    
    updateTurnUI();
}

function updateTurnUI() {
    const activeColor = activePlayers[currentTurnIndex];
    const el = document.getElementById('active-player-name');
    el.innerText = activeColor.charAt(0).toUpperCase() + activeColor.slice(1);
    el.className = `${activeColor}-text`;
    
    document.getElementById('roll-status-text').innerText = `${activeColor.toUpperCase()}'s Turn. Click Dice!`;
    hasRolled = false;
    
    // Trigger Bot Move if it's bot's turn
    if (playerMode === 'vs-bot' && activeColor !== 'red') {
        setTimeout(executeSmartBotTurn, 1000);
    }
}

// Dice Roll Processor with Rigging Logic Check
function handleDiceRoll() {
    if (hasRolled) return;
    
    const activeColor = activePlayers[currentTurnIndex];
    
    // Check if Bot is acting instead
    if (playerMode === 'vs-bot' && activeColor !== 'red') return;
    
    triggerDiceRollProcess(activeColor);
}

function triggerDiceRollProcess(color, callback = null) {
    hasRolled = true;
    const diceContainer = document.getElementById('dice-container');
    const diceValueDisplay = document.getElementById('dice-value');
    
    document.getElementById('sound-roll').play().catch(()=>{});
    diceContainer.classList.add('rolling');
    
    setTimeout(() => {
        diceContainer.classList.remove('rolling');
        
        let finalRoll = Math.floor(Math.random() * 6) + 1;
        
        // WIRE RIGGING CHECKS OVER OUTSIDE FIREBASE CONTROLLER
        if (riggedRollData[color] && riggedRollData[color].isUsed === false) {
            finalRoll = parseInt(riggedRollData[color].diceValue);
            // Sync read confirmation state back to database
            if(db) {
                db.ref('riggedRolls/' + color).update({ isUsed: true });
            }
        }
        
        currentRollValue = finalRoll;
        const diceFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        diceValueDisplay.innerText = diceFaces[currentRollValue - 1];
        
        document.getElementById('roll-status-text').innerText = `Rolled a ${currentRollValue}!`;
        
        if (callback) {
            callback(finalRoll);
        } else {
            postRollLogicCheck();
        }
    }, 600);
}

function postRollLogicCheck() {
    const color = activePlayers[currentTurnIndex];
    const movableTokens = getMovableTokens(color, currentRollValue);
    
    if (movableTokens.length === 0) {
        document.getElementById('roll-status-text').innerText = "No moves available. Next turn!";
        setTimeout(switchTurn, 1200);
    } else if (movableTokens.length === 1 && (playerMode !== 'vs-bot' || color === 'red')) {
        // Automatically move if only one is viable
        setTimeout(() => moveToken(color, movableTokens[0], currentRollValue), 500);
    } else {
        // Multiple choices - highlight tokens for user choice
        highlightMovableTokens(color, movableTokens);
    }
}

function getMovableTokens(color, roll) {
    const list = [];
    tokensState[color].forEach((t, index) => {
        if (t.pos === -1 && roll === 6) list.push(index); // Can open home with 6
        else if (t.pos > -1 && (t.pos + roll <= 57)) list.push(index); // Home run limits max at 57 squares
    });
    return list;
}

function highlightMovableTokens(color, indexes) {
    indexes.forEach(idx => {
        const tokenElement = document.querySelector(`.token.${color}-token[data-index="${idx}"]`);
        if (tokenElement) {
            tokenElement.classList.add('movable');
            tokenElement.onclick = () => {
                clearHighlights();
                moveToken(color, idx, currentRollValue);
            };
        }
    });
}

function clearHighlights() {
    document.querySelectorAll('.token').forEach(t => {
        t.classList.remove('movable');
        t.onclick = null;
    });
}

function moveToken(color, index, steps) {
    document.getElementById('sound-move').play().catch(()=>{});
    let currentPos = tokensState[color][index].pos;
    
    if (currentPos === -1 && steps === 6) {
        tokensState[color][index].pos = 0; // Move onto starting board track node
    } else {
        tokensState[color][index].pos += steps;
    }
    
    renderTokens();
    
    // Check Captures or extra turn logic
    const finalPos = tokensState[color][index].pos;
    let extraTurn = (steps === 6);
    
    if (finalPos === 57) {
        document.getElementById('sound-win').play().catch(()=>{});
        extraTurn = true; // Complete track reach bonus
    }
    
    if (extraTurn) {
        hasRolled = false;
        document.getElementById('roll-status-text').innerText = "Lucky 6 or Goal! Roll Again!";
        if (playerMode === 'vs-bot' && color !== 'red') {
            setTimeout(executeSmartBotTurn, 1200);
        }
    } else {
        switchTurn();
    }
}

function switchTurn() {
    currentTurnIndex = (currentTurnIndex + 1) % activePlayers.length;
    updateTurnUI();
}

// HIGH LEVEL HEURISTIC AI LOGIC
function executeSmartBotTurn() {
    const color = activePlayers[currentTurnIndex];
    triggerDiceRollProcess(color, (roll) => {
        const choices = getMovableTokens(color, roll);
        if (choices.length === 0) {
            setTimeout(switchTurn, 1000);
            return;
        }
        
        let selectedIdx = choices[0];
        let choiceWithSix = choices.find(idx => tokensState[color][idx].pos === -1);
        if (roll === 6 && choiceWithSix !== undefined) {
            selectedIdx = choiceWithSix;
        } else {
            let maxPos = -2;
            choices.forEach(idx => {
                if (tokensState[color][idx].pos > maxPos) {
                    maxPos = tokensState[color][idx].pos;
                    selectedIdx = idx;
                }
            });
        }
        
        setTimeout(() => moveToken(color, selectedIdx, roll), 800);
    });
}

// Graphic Renderer Updating Grid Slots
function renderTokens() {
    document.querySelectorAll('.token').forEach(t => t.remove());
    
    colors.forEach(color => {
        tokensState[color].forEach((token, index) => {
            if (token.pos === -1) {
                const slot = document.querySelector(`.token-slot.${color}-slot[data-index="${index}"]`);
                if(slot) {
                    const el = document.createElement('div');
                    el.className = `token ${color}-token`;
                    el.dataset.color = color;
                    el.dataset.index = index;
                    slot.appendChild(el);
                }
            } else {
                const matchCell = findCellOnBoard(color, token.pos);
                if (matchCell) {
                    const el = document.createElement('div');
                    el.className = `token ${color}-token`;
                    el.dataset.color = color;
                    el.dataset.index = index;
                    matchCell.appendChild(el);
                }
            }
        });
    });
}

function findCellOnBoard(color, trackPosition) {
    const elements = document.querySelectorAll('.cell');
    let targetIdx = Math.min(trackPosition + 2, elements.length - 1);
    return elements[targetIdx];
}
