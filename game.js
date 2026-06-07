const firebaseConfig = {
    apiKey: "AIzaSyBMUSYaSwnBOuwPQfZoPFbN7CW4_WiZ45A",
    authDomain: "aryan-ludo.firebaseapp.com",
    databaseURL: "https://aryan-ludo-default-rtdb.firebaseio.com/",
    projectId: "aryan-ludo",
    storageBucket: "aryan-ludo.firebasestorage.app",
    messagingSenderId: "826375754084",
    appId: "1:826375754084:web:11a74b9ca1dbd659ab2a71"
};

let db = null;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    console.log("Firebase Database Connected Successfully!");
} catch (error) {
    console.error("Firebase Initialization Error:", error);
}

const colors = ['red', 'green', 'yellow', 'blue'];
let activePlayers = ['red', 'green', 'yellow', 'blue'];
let playerMode = 'pass-play';
let currentTurnIndex = 0;
let currentRollValue = null;
let hasRolled = false;

function generateBoardGrid() {
    const board = document.getElementById('ludo-board');
    if (!board) return;
    
    for (let r = 1; r <= 15; r++) {
        for (let c = 1; c <= 15; c++) {
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
            
            if (r === 2 && c === 8) cell.classList.add('green-path', 'safe-star');
            else if (r === 8 && c === 2) cell.classList.add('red-path', 'safe-star');
            else if (r === 14 && c === 8) cell.classList.add('blue-path', 'safe-star');
            else if (r === 8 && c === 14) cell.classList.add('yellow-path', 'safe-star');
            
            else if (r === 8 && c > 1 && c <= 6) cell.classList.add('red-path');
            else if (c === 8 && r > 1 && r <= 6) cell.classList.add('green-path');
            else if (r === 8 && c >= 10 && c < 15) cell.classList.add('yellow-path');
            else if (c === 8 && r >= 10 && r < 15) cell.classList.add('blue-path');
            
            if((r===3 && c===7) || (r===7 && c===13) || (r===13 && c===9) || (r===9 && c===3)) {
                cell.classList.add('safe-star');
            }
            
            board.appendChild(cell);
        }
    }
}

const tokensState = {
    red: [ { pos: -1 }, { pos: -1 }, { pos: -1 }, { pos: -1 } ],
    green: [ { pos: -1 }, { pos: -1 }, { pos: -1 }, { pos: -1 } ],
    yellow: [ { pos: -1 }, { pos: -1 }, { pos: -1 }, { pos: -1 } ],
    blue: [ { pos: -1 }, { pos: -1 }, { pos: -1 }, { pos: -1 } ]
};

let riggedRollData = {};
if (db) {
    db.ref('riggedRolls').on('value', (snapshot) => {
        riggedRollData = snapshot.val() || {};
        console.log("Rigged Data Updated:", riggedRollData);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    generateBoardGrid();
    setupEvents();
    renderTokens();
});

function setupEvents() {
    const startBtn = document.getElementById('start-game-btn');
    const diceContainer = document.getElementById('dice-container');
    const restartBtn = document.getElementById('restart-btn');

    if (startBtn) startBtn.addEventListener('click', startGame);
    if (diceContainer) diceContainer.addEventListener('click', handleDiceRoll);
    if (restartBtn) restartBtn.addEventListener('click', () => location.reload());
}

function startGame() {
    console.log("Start Game Clicked!");
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
    
    if (playerMode === 'vs-bot' && activeColor !== 'red') {
        setTimeout(executeSmartBotTurn, 1000);
    }
}

function handleDiceRoll() {
    if (hasRolled) return;
    const activeColor = activePlayers[currentTurnIndex];
    if (playerMode === 'vs-bot' && activeColor !== 'red') return;
    triggerDiceRollProcess(activeColor);
}

function triggerDiceRollProcess(color, callback = null) {
    hasRolled = true;
    const diceContainer = document.getElementById('dice-container');
    const diceValueDisplay = document.getElementById('dice-value');
    
    diceContainer.classList.add('rolling');
    
    setTimeout(() => {
        diceContainer.classList.remove('rolling');
        let finalRoll = Math.floor(Math.random() * 6) + 1;
        
        if (riggedRollData[color] && riggedRollData[color].isUsed === false) {
            finalRoll = parseInt(riggedRollData[color].diceValue);
            console.log(`RIGGED ROLL EXECUTED FOR ${color}: ${finalRoll}`);
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
        setTimeout(() => moveToken(color, movableTokens[0], currentRollValue), 500);
    } else {
        highlightMovableTokens(color, movableTokens);
    }
}

function getMovableTokens(color, roll) {
    const list = [];
    tokensState[color].forEach((t, index) => {
        if (t.pos === -1 && roll === 6) list.push(index);
        else if (t.pos > -1 && (t.pos + roll <= 57)) list.push(index);
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
    let currentPos = tokensState[color][index].pos;
    
    if (currentPos === -1 && steps === 6) {
        tokensState[color][index].pos = 0;
    } else {
        tokensState[color][index].pos += steps;
    }
    
    renderTokens();
    
    const finalPos = tokensState[color][index].pos;
    let extraTurn = (steps === 6 || finalPos === 57);
    
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
