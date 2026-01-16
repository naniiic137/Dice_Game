import pygame
from random import randint
import os 

pygame.init()

W, H = 800, 600  # screen size

BACKGROUND_COLOR = (255, 255, 255)  # white


WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
GRAY = (200, 200, 200)

font = pygame.font.Font(None, 50)  # create font object
button_font = pygame.font.Font(None, 40)

# A more efficient way to load images into a list
dice_images = [pygame.image.load(os.path.join('images', f'd{i}.png')) for i in range(1, 7)]

screen = pygame.display.set_mode((W, H))  # create screen
pygame.display.set_caption("Dice Game")  # set window title

clock = pygame.time.Clock()  # create clock object

# --- Game State Variables ---
roll_count = 0
dice_values = [0, 0, 0, 0, 0, 0]  # Stores the index (0-5) for each of the 6 dice
rolling_active = True  # This will be set to False when all dice are the same
last_roll_time = 0
roll_interval = 100  # milliseconds (100ms = 0.1s, so 10 rolls per second)

# --- Buttons ---
faster_button = pygame.Rect(W // 2 - 150, 150, 140, 50)
slower_button = pygame.Rect(W // 2 + 10, 150, 140, 50)

running = True

while running:  # game loop
    for event in pygame.event.get():  # event loop
        if event.type == pygame.QUIT:  # check if user closed window 
            running = False  # set control variable to false to exit loop
        elif event.type == pygame.MOUSEBUTTONDOWN:
            if faster_button.collidepoint(event.pos):
                roll_interval = max(10, roll_interval - 20)  # Decrease interval (faster)
            elif slower_button.collidepoint(event.pos):
                roll_interval += 20  # Increase interval (slower)

    # --- Game Logic ---
    current_time = pygame.time.get_ticks()
    # Check if we should roll the dice based on the interval
    if rolling_active and current_time - last_roll_time > roll_interval:
        last_roll_time = current_time
        roll_count += 1
        # Roll the dice - generate 6 random numbers from 0 to 5
        dice_values = [randint(0, 5) for _ in range(6)]
        print(dice_values)

        # Check if all dice are the same. A set only contains unique elements.
        # If all are the same, the set length will be 1.
        if len(set(dice_values)) == 1:
            rolling_active = False

    # --- Drawing ---
    screen.fill(BACKGROUND_COLOR)  # fill screen with background color

    # Draw Buttons
    pygame.draw.rect(screen, GRAY, faster_button)
    pygame.draw.rect(screen, GRAY, slower_button)
    faster_text = button_font.render("Faster", True, BLACK)
    slower_text = button_font.render("Slower", True, BLACK)
    screen.blit(faster_text, faster_text.get_rect(center=faster_button.center))
    screen.blit(slower_text, slower_text.get_rect(center=slower_button.center))

    # Draw the dice based on the current dice_values
    for i, value in enumerate(dice_values):
        screen.blit(dice_images[value], (100 + i * 100, 250))

    # Update and draw the counter text
    text_surface = font.render(f'Counter: {roll_count}', True, RED)
    text_rect = text_surface.get_rect(center=(W // 2, H - 110))
    screen.blit(text_surface, text_rect)

    pygame.display.flip()  # update screen
    clock.tick(60)  # set game loop to 60 FPS

pygame.quit()  # quit pygame