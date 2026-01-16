# 🎲 Dice Game

A fun and interactive dice matching game available as both a **Web Application** and a **Desktop Application**.

**Goal:** The dice roll automatically. Your goal is to wait until all 6 dice show the same number. The game tracks how many rolls it took to achieve a perfect match.

## 🌐 Live Demo

Play the web version online here:  
👉 **[https://nanic137.pythonanywhere.com](https://nanic137.pythonanywhere.com)**

## ✨ Features

### Web Version
- **Real-time Dice Rolling:** Visual simulation of rolling dice.
- **Global Leaderboard:** Compete with others for the lowest roll count.
- **Speed Controls:** Make the rolling faster or slower.
- **Responsive Design:** Works on desktop and mobile browsers.
- **Tech Stack:** Python (Flask), HTML, CSS, JavaScript, SQLite.

### Desktop Version
- **Pygame Interface:** Smooth graphical window.
- **Interactive Controls:** Adjust roll speed with on-screen buttons.
- **Tech Stack:** Python, Pygame.

## 🛠️ Installation & Setup

If you want to run the code locally on your machine, follow these steps.

### 1. Clone the Repository
```bash
git clone https://github.com/naniiic137/Dice_Game.git
cd Dice_Game
```

### 2. Install Dependencies
You need Python installed. Then run:
```bash
pip install flask pygame
```

### 3. Run the Web Game
To play the browser version locally:
```bash
python app.py
```
Open your browser and go to `http://127.0.0.1:5000`.

### 4. Run the Desktop Game
To play the Pygame version:
```bash
python main.py
```

## 📂 Project Structure

- `app.py` - The Flask backend server for the web game.
- `main.py` - The Pygame script for the desktop application.
- `templates/` - HTML files for the web interface.
- `static/` - CSS, JavaScript, and Image assets.
- `database.db` - SQLite database storing leaderboard scores.

---
*Created by Naniii*