// Check if it's a new day to reset the counter
const today = new Date().toDateString();
const lastDate = localStorage.getItem('lastDate');

if (lastDate !== today) {
    localStorage.removeItem('rollCount');
    localStorage.removeItem('gameFinished');
    localStorage.setItem('lastDate', today);
}

let rollCount = localStorage.getItem('rollCount') ? parseInt(localStorage.getItem('rollCount')) : 0;
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

// Edit tokens for scores submitted from this browser: { "<score id>": "<token>" }.
// The server only stores a hash of each token, so only this browser can rename its scores.
function getEditTokens() {
    try {
        return JSON.parse(localStorage.getItem('editTokens')) || {};
    } catch (e) {
        return {};
    }
}

function saveEditToken(id, token) {
    const tokens = getEditTokens();
    tokens[id] = token;
    localStorage.setItem('editTokens', JSON.stringify(tokens));
}

function updateLeaderboard() {
    const tokens = getEditTokens();
    fetch('/leaderboard')
        .then(response => response.json())
        .then(data => {
            const list = document.getElementById('leaderboard-list');
            list.replaceChildren();
            data.forEach(entry => {
                // Build the row with textContent only: player names are user input
                // and must never be parsed as HTML.
                const li = document.createElement('li');
                const nameCell = document.createElement('span');
                nameCell.textContent = entry.name;

                if (tokens[entry.id]) {
                    const editBtn = document.createElement('button');
                    editBtn.type = 'button';
                    editBtn.className = 'edit-btn';
                    editBtn.dataset.id = String(entry.id);
                    editBtn.title = 'Rename';
                    editBtn.setAttribute('aria-label', 'Rename your score');
                    editBtn.textContent = '✎';
                    nameCell.append(' ', editBtn);
                }

                const scoreCell = document.createElement('span');
                scoreCell.textContent = String(entry.score);

                li.append(nameCell, scoreCell);
                list.appendChild(li);
            });
        })
        .catch(error => console.error('Could not load leaderboard:', error));
}

function rollDice() {
    if (!isRolling) return;

    rollCount++;
    counterElement.textContent = rollCount;
    localStorage.setItem('rollCount', rollCount);

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
    localStorage.setItem('gameFinished', 'true');
}

document.getElementById('faster-btn').addEventListener('click', () => {
    rollInterval = Math.max(10, rollInterval - 20);
});

document.getElementById('slower-btn').addEventListener('click', () => {
    rollInterval += 20;
});

submitBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) return alert("Please enter a name");
    if (name.length > 20) return alert("Name must be 20 characters or fewer");

    fetch('/submit_score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, score: rollCount })
    })
    .then(res => res.json().then(data => {
        if (!res.ok) {
            throw new Error(data.message || 'Network response was not ok');
        }
        return data;
    }))
    .then(data => {
        if (data.status === 'success') {
            saveEditToken(data.id, data.edit_token);
            localStorage.removeItem('rollCount');
            localStorage.removeItem('gameFinished');
            modal.style.display = 'none';
            updateLeaderboard();
            // Reload page to restart or implement reset logic here
            location.reload(); 
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert("There was an error saving your score: " + error.message);
    });
});

// Event listener for renaming your own scores in the leaderboard
document.getElementById('leaderboard-list').addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-btn')) {
        const id = e.target.dataset.id;
        const token = getEditTokens()[id];
        if (!token) return;
        const newName = prompt("Enter new name (max 20 characters):");

        if (newName && newName.trim()) {
            fetch('/update_name', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: Number(id), name: newName.trim(), edit_token: token })
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') updateLeaderboard();
                else alert(data.message || "Could not rename this score.");
            })
            .catch(() => alert("Could not rename this score."));
        }
    }
});

// Initialize
updateLeaderboard();

if (localStorage.getItem('gameFinished') === 'true') {
    isRolling = false;
    counterElement.textContent = rollCount;
    finalScoreElement.textContent = rollCount;
    modal.style.display = 'block';
} else {
    counterElement.textContent = rollCount;
    rollDice();
}