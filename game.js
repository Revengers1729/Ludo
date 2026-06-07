// Firebase Configuration - Apna original key replace mat karna, yahi rakhna
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
} catch (error) {
    console.error("Firebase Error:", error);
}

const colors = ['red', 'green', 'yellow', 'blue'];
let activePlayers = ['red', 'green', 'yellow', 'blue'];
let playerMode = 'pass-play';
let currentTurnIndex = 0;
let currentRollValue = null;
let hasRolled = false;

// ----------------------------------------------------
// THE REAL LUDO TRACK MATHEMATICS (Coordinates)
// ----------------------------------------------------
// Exact 52 steps of the outer board ring
const mainTrack = [
    {r:7,c:2},{r:7,c:3},{r:7,c:4},{r:7,c:5},{r:7,c:6}, 
    {r:6,c:7},{r:5,c:7},{r:4,c:7},{r:3,c:7},{r:2,c:7},{r:1,c:7},
    {r:1,c:8},{r:1,c:9}, 
    {r:2,c:9},{r:3,c:9},{r:4,c:9},{r:5,c:9},{r:6,c:9}, 
    {r:7,c:10},{r:7,c:11},{r:7,c:12},{r:7,c:13},{r:7,c:14},{r:7,c:15},
    {r:8,c:15},{r:9,c:15}, 
    {r:9,c:14},{r:9,c:13},{r:9,c:12},{r:9,c:11},{r:9,c:10}, 
    {r:10,c:9},{r:11,c:9},{r:12,c:9},{r:13,c:9},{r:14,c:9},{r:15,c:9},
    {r:15,c:8},{r:15,c:7}, 
    {r:14,c:7},{r:13,c:7},{r:12,c:7},{r:11,c:7},{r:10,c:7}, 
    {r:9,c:6},{r:9,c:5},{r:9,c:4},{r:9,c:3},{r:9,c:2},{r:9,c:1},
    {r:8,c:1},{r:7,c:1}
];

const startOffsets = { red: 0, green: 13, yellow: 26, blue: 39 };
const safeZones = [0, 8, 13, 21, 26, 34, 39, 47];

const homeTracks = {
    red: [{r:8,c:2},{r:8,c:3},{r:8,c:4},{r:8,c:5},{r:8,c:6}],
    green: [{r:2,c:8},{r:3,c:8},{r:4,c:8},{r:5,c:8},{r:6,c:8}],
    yellow: [{r:8,c:14},{r:8,c:13},{r:8,c:12},{r:8,c:11},{r:8,c:10}],
    blue: [{r:14,c:8},{r:13,c:8},{r:12,c:8},{r:11,c:8},{r:10,c:8}]
};

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
    });
}

document.addEventListener("DOMContentLoaded", () => {
    generateBoardGrid();
    setupEvents();
    renderTokens();
});

// YEH FUNCTION BOARD KO MATHEMATICS KE HISAAB SE EXACT PAINT KAREGA
function generateBoardGrid() {
    const board = document.getElementById('ludo-board');
    if (!board) return;
    
    // Clear dynamic cells if re-run
    document.querySelectorAll('.cell').forEach(e => e.remove());

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
            
            // EXACT Start Cells & Star Visuals
            if (r === 7 && c === 2) cell.classList.add('red-path', 'safe-star');
            else if (r === 2 && c === 9) cell.classList.add('green-path', 'safe-star');
            else if (r === 14 && c === 7) cell.classList.add('blue-path', 'safe-star');
            else if (r === 9 && c === 14) cell.classList.add('yellow-path', 'safe-star');
            
            // EXACT Home Stretches
            else if (r === 8 && c > 1 && c <= 6) cell.classList.add('red-path');
            else if (c === 8 && r > 1 && r <= 6) cell.classList.add('green-path');
            else if (r === 8 && c >= 10 && c < 15) cell.classList.add('yellow-path');
            else if (c === 8 && r >= 10 && r < 15) cell.classList.add('blue-path');
            
            // EXACT Other Safe Stars
            else if((r===3 && c===7) || (r===7 && c===13) || (r===13 && c===9) || (r===9 && c===3)) {
                cell.classList.add('safe-star');
            }
            
            board.appendChild(cell);
        }
    }
}

function setupEvents() {
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    document.getElementById('dice-container').addEventListener('click', handleDiceRoll);
    document.getElementById('restart-btn').addEventListener('click', () => location.reload());
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
        
        // Admin Controller Rigging Check
        if (riggedRollData[color] && riggedRollData[color].isUsed === false) {
            finalRoll = parseInt(riggedRollData[color].diceValue);
            if(db) db.ref('riggedRolls/' + color).update({ isUsed: true });
        }
        
        currentRollValue = finalRoll;
        const diceFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        diceValueDisplay.innerText = diceFaces[currentRollValue - 1];
        document.getElementById('roll-status-text').innerText = `Rolled a ${currentRollValue}!`;
        
        if (callback) callback(finalRoll);
        else postRollLogicCheck();
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
        else if (t.pos > -1 && (t.pos + roll <= 56)) list.push(index); 
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
        tokensState[color][index].pos = 0; // Got out of base
    } else {
        tokensState[color][index].pos += steps; // Move forward
    }
    
    let extraTurn = (steps === 6);
    const finalPos = tokensState[color][index].pos;
    
    // Goti Kaatna (Kill Logic)
    if (finalPos > 0 && finalPos <= 50) {
        let currentMainIndex = (startOffsets[color] + finalPos) % 52;
        if (!safeZones.includes(currentMainIndex)) {
            colors.forEach(oppColor => {
                if (oppColor !== color) {
                    tokensState[oppColor].forEach((oppToken, oppIdx) => {
                        if (oppToken.pos > -1 && oppToken.pos <= 50) {
                            let oppMainIndex = (startOffsets[oppColor] + oppToken.pos) % 52;
                            if (currentMainIndex === oppMainIndex) {
                                // Killed!
                                tokensState[oppColor][oppIdx].pos = -1;
                                extraTurn = true; 
                            }
                        }
                    });
                }
            });
        }
    }
    
    if (finalPos === 56) extraTurn = true; // Goal Reached
    
    renderTokens();
    
    if (extraTurn) {
        hasRolled = false;
        document.getElementById('roll-status-text').innerText = "Lucky 6 or Kill! Roll Again!";
        if (playerMode === 'vs-bot' && color !== 'red') setTimeout(executeSmartBotTurn, 1200);
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
    // Purani sabhi gotiyon ko mita do
    document.querySelectorAll('.token').forEach(t => t.remove());
    
    // Nayi positions par draw karo
    colors.forEach(color => {
        tokensState[color].forEach((token, index) => {
            if (token.pos === -1) {
                const slot = document.querySelector(`.token-slot.${color}-slot[data-index="${index}"]`);
                if(slot) createVisualToken(color, index, slot);
            } else {
                const matchCell = findCellOnBoard(color, token.pos);
                if (matchCell) createVisualToken(color, index, matchCell);
            }
        });
    });

    // OVERLAP FIX: Agar ek hi dibbe mein 2+ goti aayi hain, toh unko thoda side mein khiska do
    document.querySelectorAll('.cell').forEach(cell => {
        let tokensInCell = cell.querySelectorAll('.token');
        if(tokensInCell.length > 1) {
            tokensInCell.forEach((t, idx) => {
                t.style.transform = `translate(${idx * 4}px, ${idx * -4}px) scale(0.85)`;
            });
        }
    });
}

function createVisualToken(color, index, container) {
    const el = document.createElement('div');
    el.className = `token ${color}-token`;
    el.dataset.color = color;
    el.dataset.index = index;
    container.appendChild(el);
}

function findCellOnBoard(color, trackPosition) {
    if (trackPosition === 56) return null; // Center Goal mein chhup jayegi
    
    let targetCell = null;
    if (trackPosition <= 50) {
        let mainIndex = (startOffsets[color] + trackPosition) % 52;
        let coords = mainTrack[mainIndex];
        targetCell = document.querySelector(`.cell[data-row="${coords.r}"][data-col="${coords.c}"]`);
    } else {
        let homeIndex = trackPosition - 51;
        let coords = homeTracks[color][homeIndex];
        if(coords) targetCell = document.querySelector(`.cell[data-row="${coords.r}"][data-col="${coords.c}"]`);
    }
    return targetCell;
}
