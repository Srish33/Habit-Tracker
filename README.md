# HabitFlow 🌊

HabitFlow is a visually stunning, premium single-page web application designed to help users establish and track daily routines. Emphasizing a physical **Soft-UI Neomorphic Design**, the interface uses organic dual shadows, inset forms, and toggle behaviors to create a satisfying, tactile user experience without using harsh neon accents.

## ✨ Features

- **Monthly Progress Dashboard**: An interactive calendar indicating scheduled and completed habits directly on the grid using color-coded progress dots.
- **Physical Done/Not Done Toggles**: Buttons that physically transition to a pressed, desaturated sage-green state when marked **Done**, and bounce back to a raised state when marked **Not Done**.
- **Interactive Completion Heatmaps**: Clickable calendars in the habit detail view. Clicking a scheduled date instantly toggles completion history.
- **Dynamic Streak Tracker**: Calculates active, consecutive completion streaks dynamically based on your custom schedules.
- **Comprehensive CRUD Controls**: Easily add, edit, or delete habits using the inset weekday form and time selectors.
- **Offline Persistence**: Powered by standard `localStorage` so your statistics are saved locally and persist across page loads.
- **Zero Configuration**: Built with vanilla HTML5, CSS3, and JavaScript—no heavy npm build steps or frameworks needed.

## 🚀 Getting Started

### Prerequisites

You only need a web browser to run HabitFlow.

### Running Locally

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Srish33/Habit-Tracker.git
   cd Habit-Tracker
   ```

2. **Run a local static server**:
   You can serve the project using any lightweight static server:

   * **Using Node.js (`npx`)**:
     ```bash
     npx http-server -p 8080
     ```
   * **Using Python 3**:
     ```bash
     python -m http.server 8080
     ```

3. **Open in Browser**:
   Navigate to [http://localhost:8080](http://localhost:8080) to start tracking!

## 🎨 Design Philosophy

HabitFlow implements **Neomorphism** by combining:
- Soft background shades (`#e0e8f0`)
- Custom light shadows (`#ffffff`) and dark shadows (`#b5c3d0`)
- Desaturated accents (sage-green for successes, dusty rose for danger)
- Flexible CSS grid layouts that adapt beautifully across desktop and mobile browsers.
