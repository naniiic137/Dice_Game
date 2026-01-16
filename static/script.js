let rollCount = 0;
let rollInterval = 100;
let isRolling = true;
let timer = null;

const diceElements = document.querySelectorAll('.dice');
const counterElement = document.getElementById('counter');
const modal = document.getElementById('modal');
const finalScoreElement = document.getElementById('final-score');
const nameInput = document.getElementById('player-name');
const submitBtn = document.getElementById('submit-score-btn');
const restartBtn = document.getElementById('restart-btn');

function updateLeaderboard() {
    fetch('/leaderboard')
        .then(response => response.json())
        .then(data => {
            const list = document.getElementById('leaderboard-list');
            list.innerHTML = '';
            data.forEach(entry => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${entry.name}</span> <span>${entry.score}</span>`;
                list.appendChild(li);
            });
        });
}

function rollDice() {
    if (!isRolling) return;

    rollCount++;
    counterElement.textContent = rollCount;

    const values = [];
    diceElements.forEach(img => {
        // Generate random number 1-6
        const val = Math.floor(Math.random() * 6) + 1;
        values.push(val);
        img.src = `/static/images/d${val}.png`;
    });

    // Check if all dice are the same (Set size is 1)
    const allSame = values.every(v => v === values[0]);
    
    if (allSame) {
        stopGame();
    } else {
        // Continue rolling
        timer = setTimeout(rollDice, rollInterval);
    }
}

function stopGame() {
    isRolling = false;
    clearTimeout(timer);
    finalScoreElement.textContent = rollCount;
    modal.style.display = 'block';
}

document.getElementById('faster-btn').addEventListener('click', () => {
    rollInterval = Math.max(10, rollInterval - 20);
});

document.getElementById('slower-btn').addEventListener('click', () => {
    rollInterval += 20;
});

submitBtn.addEventListener('click', () => {
    const name = nameInput.value;
    if (!name) return alert("Please enter a name");

    fetch('/submit_score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, score: rollCount })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            modal.style.display = 'none';
            updateLeaderboard();
            // Reload page to restart or implement reset logic here
            location.reload(); 
        }
    });
});

// Initialize
updateLeaderboard();
rollDice();