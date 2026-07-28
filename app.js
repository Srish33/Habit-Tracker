// ================= APPLICATION STATE CONFIGURATION =================
// Global reactive state object storing active habits array, selected date, screen tracking, and calendar month viewers
let state = {
    habits: [],                // Array holding all habit objects { id, name, description, days, time, completedDates }
    selectedDate: '',          // Currently focused date string formatted as 'YYYY-MM-DD'
    currentDetailHabitId: null,// Holds the ID of the habit currently displayed on the Detail View screen
    currentMainMonth: null,    // Date object representing the month displayed on the main dashboard calendar
    currentDetailMonth: null   // Date object representing the month displayed on the detail completion heatmap calendar
};

// Day name lookup arrays for display formatting and index mapping (0 = Sunday, 1 = Monday, etc.)
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ================= DATE UTILITY HELPERS =================

/**
 * Formats a JavaScript Date object into a standardized ISO date string 'YYYY-MM-DD'.
 * Uses local time components to prevent timezone shift issues.
 * @param {Date} date - JS Date object
 * @returns {string} Standardized date string 'YYYY-MM-DD'
 */
function formatDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parses a 'YYYY-MM-DD' date string into a local JavaScript Date object without UTC timezone offsets.
 * @param {string} dateStr - Date string in 'YYYY-MM-DD' format
 * @returns {Date} Localized JS Date object
 */
function parseDateStr(dateStr) {
    const parts = dateStr.split('-');
    // Month in JS Date constructor is 0-indexed (0 = Jan, 11 = Dec), so subtract 1 from parts[1]
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

/**
 * Converts a 'YYYY-MM-DD' string into a friendly localized display string (e.g. "Mon, Jul 20, 2026").
 * @param {string} dateStr - Date string in 'YYYY-MM-DD' format
 * @returns {string} Human-readable formatted date string
 */
function formatDisplayDate(dateStr) {
    const date = parseDateStr(dateStr);
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Retrieves the day-of-week index (0 for Sun, 1 for Mon, ..., 6 for Sat) from a date string.
 * @param {string} dateStr - Date string in 'YYYY-MM-DD' format
 * @returns {number} Index representing day of week (0..6)
 */
function getDayOfWeekIndex(dateStr) {
    return parseDateStr(dateStr).getDay();
}

// ================= LOCAL STORAGE & DEMO SEEDING =================

/**
 * Loads habit application state from browser localStorage ('habitflow_state').
 * If no previous data exists, initializes realistic demonstration data relative to today.
 */
function loadState() {
    const stored = localStorage.getItem('habitflow_state');
    const todayStr = formatDate(new Date());
    
    if (stored) {
        // Parse existing saved state from localStorage
        state = JSON.parse(stored);
    } else {
        // First-time visit: Seed sample habits with completion history relative to current date
        state.habits = initializeSampleData();
    }
    
    // Always force selected date and month calendars to today's date on launch
    state.selectedDate = todayStr;
    state.currentMainMonth = new Date();
    state.currentDetailMonth = new Date();
    saveState();
}

/**
 * Persists current state habits array and selected date to browser localStorage.
 */
function saveState() {
    localStorage.setItem('habitflow_state', JSON.stringify({
        habits: state.habits,
        selectedDate: state.selectedDate
    }));
}

/**
 * Generates sample habits with dynamically generated past completion history
 * to demonstrate calendar dots, streaks, and heatmap analytics out of the box.
 * @returns {Array} List of habit objects
 */
function initializeSampleData() {
    const today = new Date();
    const sampleHabits = [
        {
            id: 'sample_meditation',
            name: 'Morning Meditation',
            description: 'Sit in silence, focus on breathing, and observe thoughts without judgment.',
            days: [1, 2, 3, 4, 5], // Mon-Fri scheduled
            time: '07:30',
            completedDates: []
        },
        {
            id: 'sample_reading',
            name: 'Read 10 Pages',
            description: 'Read at least 10 pages of a non-fiction or educational book.',
            days: [0, 1, 2, 3, 4, 5, 6], // Daily scheduled
            time: '21:30',
            completedDates: []
        },
        {
            id: 'sample_workout',
            name: 'Gym Workout',
            description: 'Strength training routine focusing on progressive overload.',
            days: [1, 3, 5], // Mon, Wed, Fri scheduled
            time: '18:00',
            completedDates: []
        }
    ];

    // Populate the past 20 days dynamically with realistic completion records
    for (let i = 0; i < 20; i++) {
        const checkDate = new Date();
        checkDate.setDate(today.getDate() - i);
        const dateStr = formatDate(checkDate);
        const dayOfWeek = checkDate.getDay();

        // 1. Morning Meditation (Mon-Fri) - Completed ~80% of scheduled days
        if ([1, 2, 3, 4, 5].includes(dayOfWeek)) {
            if (i <= 1 || Math.random() > 0.25) {
                sampleHabits[0].completedDates.push(dateStr);
            }
        }

        // 2. Read 10 Pages (Daily) - Completed ~85% of days
        if (i <= 3 || Math.random() > 0.15) {
            sampleHabits[1].completedDates.push(dateStr);
        }

        // 3. Gym Workout (Mon, Wed, Fri) - Completed ~70% of scheduled days
        if ([1, 3, 5].includes(dayOfWeek)) {
            if (Math.random() > 0.3) {
                sampleHabits[2].completedDates.push(dateStr);
            }
        }
    }

    return sampleHabits;
}

// ================= STREAK CALCULATION ALGORITHM =================

/**
 * Calculates current active streak length (consecutive scheduled days completed).
 * Correctly accounts for non-scheduled days (doesn't break streak on un-scheduled days)
 * and allows grace period for today's incomplete habit if yesterday was completed.
 * @param {Array<string>} completedDates - Array of completed 'YYYY-MM-DD' date strings
 * @param {Array<number>} scheduledDays - Array of scheduled weekday numbers (0 = Sun .. 6 = Sat)
 * @returns {number} Active streak count in days
 */
function calculateStreak(completedDates, scheduledDays) {
    if (!completedDates.length || !scheduledDays.length) return 0;
    
    // Fast O(1) set lookup for completion dates
    const datesSet = new Set(completedDates);
    let streak = 0;
    
    let checkDate = new Date();
    let todayStr = formatDate(checkDate);
    
    // Helper closure checking if a given date falls on a scheduled weekday
    const isScheduled = (dateObj) => scheduledDays.includes(dateObj.getDay());

    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    let yesterdayStr = formatDate(yesterday);
    
    let startFrom = checkDate;
    
    // Evaluate starting anchor point for streak counter
    if (isScheduled(checkDate)) {
        if (!datesSet.has(todayStr)) {
            // Today is scheduled but not yet completed. Check if yesterday was completed to keep streak alive.
            if (isScheduled(yesterday) && !datesSet.has(yesterdayStr)) {
                return 0; // Missed yesterday and today -> streak is broken
            }
            startFrom = yesterday; // Start counting backward from yesterday
        }
    } else {
        // Today is not a scheduled day for this habit -> check from yesterday
        if (isScheduled(yesterday) && !datesSet.has(yesterdayStr)) {
            startFrom = yesterday;
        } else {
            startFrom = yesterday;
        }
    }
    
    // Trace backward day by day through past dates
    let currentDate = new Date(startFrom.getTime());
    let safetyCounter = 0; // Safeguard against infinite loops
    
    while (safetyCounter < 365) {
        safetyCounter++;
        const dateStr = formatDate(currentDate);
        
        if (isScheduled(currentDate)) {
            if (datesSet.has(dateStr)) {
                streak++; // Scheduled day was completed -> increment streak
            } else {
                break; // Scheduled day was missed -> streak ends
            }
        }
        // Move back 1 day in calendar history
        currentDate.setDate(currentDate.getDate() - 1);
    }
    
    return streak;
}

// ================= UI RENDERING ENGINE =================

/**
 * 1. Renders Main Monthly Progress Calendar grid on the Dashboard screen.
 * Displays weekday headers, aligns 1st of month with empty spacer slots,
 * renders day buttons, highlights today & selected date, and draws habit completion dots.
 */
function renderMainCalendar() {
    const calendarContainer = document.getElementById('main-calendar-days');
    if (!calendarContainer) return;
    calendarContainer.innerHTML = ''; // Clear previous month content

    const year = state.currentMainMonth.getFullYear();
    const month = state.currentMainMonth.getMonth();

    // Display title header (e.g. "July 2026")
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('main-month-year').textContent = `${monthNames[month]} ${year}`;

    // Get 1st day of month weekday (0 = Sun) and total number of days in target month
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Adjust offset so Monday = 0, Tuesday = 1, ..., Sunday = 6
    const adjustedStartOffset = (firstDayIndex === 0) ? 6 : firstDayIndex - 1;

    // Render empty spacer elements for days prior to 1st of month
    for (let i = 0; i < adjustedStartOffset; i++) {
        const spacer = document.createElement('div');
        spacer.className = 'calendar-day-empty';
        calendarContainer.appendChild(spacer);
    }

    // Render active calendar day buttons for each day in the month
    const todayStr = formatDate(new Date());
    for (let d = 1; d <= totalDays; d++) {
        const currentDayDate = new Date(year, month, d);
        const dateStr = formatDate(currentDayDate);
        const dayOfWeek = currentDayDate.getDay();

        // Create interactive day button element
        const btn = document.createElement('button');
        btn.className = 'calendar-day-btn';
        if (dateStr === state.selectedDate) btn.classList.add('selected');
        if (dateStr === todayStr) btn.classList.add('today');
        
        btn.innerHTML = `<span class="day-num">${d}</span>`;

        // Filter habits scheduled for this day of week and render mini indicator dots
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'calendar-day-dots';
        
        const scheduledHabits = state.habits.filter(h => h.days.includes(dayOfWeek));
        scheduledHabits.forEach(habit => {
            const dot = document.createElement('div');
            const isDone = habit.completedDates.includes(dateStr);
            dot.className = `calendar-dot ${isDone ? 'completed' : ''}`;
            dotsContainer.appendChild(dot);
        });

        if (scheduledHabits.length > 0) {
            btn.appendChild(dotsContainer);
        }

        // Click handler: Set selected date and update calendar/habit views
        btn.addEventListener('click', () => {
            state.selectedDate = dateStr;
            renderMainCalendar();
            renderSelectedDateHabits();
        });

        calendarContainer.appendChild(btn);
    }
}

/**
 * 2. Renders "Today's Focus" checklist on the Dashboard.
 * Displays interactive habit cards for habits scheduled for today's weekday.
 */
function renderTodayHabits() {
    const container = document.getElementById('todays-habits');
    if (!container) return;
    container.innerHTML = '';

    const todayDate = new Date();
    const todayStr = formatDate(todayDate);
    const todayDay = todayDate.getDay();

    // Filter habits scheduled for today
    const todaysHabits = state.habits.filter(h => h.days.includes(todayDay));

    // Render empty state if no habits scheduled for today
    if (todaysHabits.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-lucide="smile"></i>
                <p>No habits scheduled for today.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    // Build habit card for each scheduled habit
    todaysHabits.forEach(habit => {
        const isCompleted = habit.completedDates.includes(todayStr);
        const card = document.createElement('div');
        card.className = 'neomorphic-flat habit-card';
        
        card.innerHTML = `
            <div class="habit-info-clickable">
                <span class="habit-name">${escapeHTML(habit.name)}</span>
                <span class="habit-time-badge">
                    <i data-lucide="clock"></i> ${formatTime(habit.time)}
                </span>
            </div>
            <button class="btn-toggle-done ${isCompleted ? 'done' : ''}" data-id="${habit.id}">
                ${isCompleted ? 'Done' : 'Not Done'}
            </button>
        `;

        // Click on habit title/info navigates to habit detail view screen
        card.querySelector('.habit-info-clickable').addEventListener('click', () => {
            showHabitDetails(habit.id);
        });

        // Click on toggle button toggles completion status for today
        card.querySelector('.btn-toggle-done').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevents triggering card click navigation
            toggleHabitCompletion(habit.id, todayStr);
        });

        container.appendChild(card);
    });

    lucide.createIcons(); // Initialize Lucide SVG icons
}

/**
 * 3. Renders Habits checklist for the user's currently selected calendar date.
 */
function renderSelectedDateHabits() {
    const container = document.getElementById('selected-date-habits');
    const title = document.getElementById('selected-date-title');
    const section = document.getElementById('selected-date-section');
    if (!container || !title) return;
    container.innerHTML = '';

    const todayStr = formatDate(new Date());
    
    // Hide selected-date card-section when viewing today's date to avoid duplication
    if (state.selectedDate === todayStr) {
        if (section) section.classList.add('hidden');
        return;
    } else {
        if (section) section.classList.remove('hidden');
    }

    // Update section title header with selected date string
    title.textContent = `Scheduled on ${formatDisplayDate(state.selectedDate)}`;

    const selectedDateObj = parseDateStr(state.selectedDate);
    const dayOfWeek = selectedDateObj.getDay();

    // Filter habits scheduled for selected date's weekday
    const scheduledHabits = state.habits.filter(h => h.days.includes(dayOfWeek));

    if (scheduledHabits.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-lucide="calendar-days"></i>
                <p>No habits scheduled for this day.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    const isFuture = state.selectedDate > todayStr;

    scheduledHabits.forEach(habit => {
        const isCompleted = habit.completedDates.includes(state.selectedDate);
        const card = document.createElement('div');
        card.className = 'neomorphic-flat habit-card';
        
        let toggleBtnClass = `btn-toggle-done ${isCompleted ? 'done' : ''}`;
        if (isFuture) toggleBtnClass += ' disabled-future-date';

        card.innerHTML = `
            <div class="habit-info-clickable">
                <span class="habit-name">${escapeHTML(habit.name)}</span>
                <span class="habit-time-badge">
                    <i data-lucide="clock"></i> ${formatTime(habit.time)}
                </span>
            </div>
            <button class="${toggleBtnClass}" ${isFuture ? 'disabled' : ''} data-id="${habit.id}">
                ${isCompleted ? 'Done' : 'Not Done'}
            </button>
        `;

        // Click on info navigates to detail view
        card.querySelector('.habit-info-clickable').addEventListener('click', () => {
            showHabitDetails(habit.id);
        });

        // Click on toggle button updates completion state for selected date
        card.querySelector('.btn-toggle-done').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleHabitCompletion(habit.id, state.selectedDate);
        });

        container.appendChild(card);
    });

    lucide.createIcons();
}

/**
 * 4. Toggles habit completion state (Done <-> Not Done) for a specified date string.
 * Updates state array, saves to localStorage, and re-renders active UI views.
 * @param {string} habitId - Target habit identifier
 * @param {string} dateStr - Date string 'YYYY-MM-DD' to toggle
 */
function toggleHabitCompletion(habitId, dateStr) {
    const todayStr = formatDate(new Date());
    // Security check: Ignore logging completions for any dates in the future
    if (dateStr > todayStr) {
        return;
    }

    const habit = state.habits.find(h => h.id === habitId);
    if (!habit) return;

    const index = habit.completedDates.indexOf(dateStr);
    if (index > -1) {
        habit.completedDates.splice(index, 1); // Remove date -> mark Not Done
    } else {
        habit.completedDates.push(dateStr);   // Append date -> mark Done
    }

    saveState(); // Save changes to browser storage
    
    // Re-render UI components to reflect state update
    renderMainCalendar();
    renderTodayHabits();
    renderSelectedDateHabits();
    
    // If user is currently inspecting this habit on Detail View, update detail views
    if (state.currentDetailHabitId === habitId) {
        renderDetailCalendar();
        updateDetailStats(habit);
    }
}

/**
 * 5. Navigates view from Dashboard screen to Habit Detail screen for selected habit.
 * @param {string} habitId - Habit ID to display
 */
function showHabitDetails(habitId) {
    const habit = state.habits.find(h => h.id === habitId);
    if (!habit) return;

    state.currentDetailHabitId = habitId;
    state.currentDetailMonth = parseDateStr(state.selectedDate); // Sync detail calendar month view

    // Switch screen visibility CSS classes
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('detail-screen').classList.remove('hidden');

    // Populate habit info fields
    document.getElementById('detail-habit-name').textContent = habit.name;
    document.getElementById('detail-habit-desc').textContent = habit.description || "No description provided.";
    
    // Format schedule text summary
    const daysStr = habit.days.map(d => DAY_SHORT_NAMES[d]).join(', ');
    document.getElementById('detail-habit-schedule').textContent = `Scheduled on: ${daysStr} at ${formatTime(habit.time)}`;

    // Calculate & render stats & heatmap calendar
    updateDetailStats(habit);
    renderDetailCalendar();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Updates streak count and total completion count stat cards on Detail View.
 * @param {Object} habit - Habit object
 */
function updateDetailStats(habit) {
    const streak = calculateStreak(habit.completedDates, habit.days);
    const total = habit.completedDates.length;

    document.getElementById('stat-streak').textContent = streak;
    document.getElementById('stat-total').textContent = total;
}

/**
 * Renders Habit Heatmap Calendar on Detail screen.
 * Displays days of target month with green completion state for completed dates.
 */
function renderDetailCalendar() {
    const calendarContainer = document.getElementById('detail-calendar-days');
    const habit = state.habits.find(h => h.id === state.currentDetailHabitId);
    if (!calendarContainer || !habit) return;
    
    calendarContainer.innerHTML = '';

    const year = state.currentDetailMonth.getFullYear();
    const month = state.currentDetailMonth.getMonth();

    // Display title header
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('detail-month-year').textContent = `${monthNames[month]} ${year}`;

    // Get offsets & day counts
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const adjustedStartOffset = (firstDayIndex === 0) ? 6 : firstDayIndex - 1;

    // Render spacer elements
    for (let i = 0; i < adjustedStartOffset; i++) {
        const spacer = document.createElement('div');
        spacer.className = 'calendar-day-empty';
        calendarContainer.appendChild(spacer);
    }

    const todayStr = formatDate(new Date());
    
    // Render detail calendar day buttons
    for (let d = 1; d <= totalDays; d++) {
        const currentDayDate = new Date(year, month, d);
        const dateStr = formatDate(currentDayDate);
        const dayOfWeek = currentDayDate.getDay();
        const isScheduled = habit.days.includes(dayOfWeek);
        const isFuture = dateStr > todayStr;

        const btn = document.createElement('button');
        btn.className = 'calendar-day-btn';
        if (dateStr === todayStr) btn.classList.add('today');
        
        // Green highlight if habit was completed on this date
        const isDone = habit.completedDates.includes(dateStr);
        if (isDone) btn.classList.add('completed');
        
        btn.innerHTML = `<span class="day-num">${d}</span>`;

        // Render dot indicator if scheduled but incomplete
        if (isScheduled && !isDone) {
            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'calendar-day-dots';
            const dot = document.createElement('div');
            dot.className = 'calendar-dot';
            dotsContainer.appendChild(dot);
            btn.appendChild(dotsContainer);
        }

        // Clicking a scheduled day in detail calendar toggles completion for that day
        // Future dates are unclickable and visually faded
        if (isScheduled && !isFuture) {
            btn.addEventListener('click', () => {
                toggleHabitCompletion(habit.id, dateStr);
            });
        } else {
            btn.classList.add('disabled-future-date');
        }

        calendarContainer.appendChild(btn);
    }
}

/**
 * 6. Returns navigation back to main Dashboard view.
 */
function goBackToDashboard() {
    state.currentDetailHabitId = null;
    document.getElementById('detail-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    
    renderMainCalendar();
    renderTodayHabits();
    renderSelectedDateHabits();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================= MODAL DIALOG & FORM HANDLERS =================

/**
 * Opens modal dialog configured for creating a new habit.
 */
function openAddHabitModal() {
    document.getElementById('modal-title').textContent = 'Create New Habit';
    document.getElementById('habit-id').value = '';
    document.getElementById('habit-form').reset();
    
    // Default all weekday checkboxes to checked
    const dayCheckboxes = document.querySelectorAll('.day-checkbox');
    dayCheckboxes.forEach(cb => cb.checked = true);

    // Set default target time to 08:00 AM
    document.getElementById('habit-time').value = '08:00';

    document.getElementById('habit-modal').classList.remove('hidden');
}

/**
 * Opens modal dialog configured for editing current habit details.
 */
function openEditHabitModal() {
    const habit = state.habits.find(h => h.id === state.currentDetailHabitId);
    if (!habit) return;

    document.getElementById('modal-title').textContent = 'Edit Habit';
    document.getElementById('habit-id').value = habit.id;
    document.getElementById('habit-name').value = habit.name;
    document.getElementById('habit-desc').value = habit.description;
    document.getElementById('habit-time').value = habit.time;

    // Check corresponding weekday checkboxes matching habit schedule
    const dayCheckboxes = document.querySelectorAll('.day-checkbox');
    dayCheckboxes.forEach(cb => {
        cb.checked = habit.days.includes(parseInt(cb.value));
    });

    document.getElementById('habit-modal').classList.remove('hidden');
}

/**
 * Closes habit modal dialog overlay.
 */
function closeHabitModal() {
    document.getElementById('habit-modal').classList.add('hidden');
}

/**
 * Handles habit modal form submit event (Create or Edit habit).
 * @param {Event} e - Form submit event
 */
function handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('habit-id').value;
    const name = document.getElementById('habit-name').value.trim();
    const description = document.getElementById('habit-desc').value.trim();
    const time = document.getElementById('habit-time').value;

    // Collect array of checked weekday numbers (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const dayCheckboxes = document.querySelectorAll('.day-checkbox:checked');
    const days = Array.from(dayCheckboxes).map(cb => parseInt(cb.value));

    // Validation: Require at least one active weekday
    if (days.length === 0) {
        alert('Please select at least one day of the week for this habit.');
        return;
    }

    if (id) {
        // Edit existing habit
        const habit = state.habits.find(h => h.id === id);
        if (habit) {
            habit.name = name;
            habit.description = description;
            habit.days = days;
            habit.time = time;
        }
    } else {
        // Create new habit object
        const newHabit = {
            id: 'habit_' + Date.now(),
            name: name,
            description: description,
            days: days,
            time: time,
            completedDates: []
        };
        state.habits.push(newHabit);
    }

    saveState();
    closeHabitModal();
    
    // Refresh active screen views
    if (state.currentDetailHabitId) {
        showHabitDetails(state.currentDetailHabitId);
    } else {
        renderMainCalendar();
        renderTodayHabits();
        renderSelectedDateHabits();
    }
}

/**
 * 7. Deletes currently viewed habit after user confirmation.
 */
function handleDeleteHabit() {
    const habit = state.habits.find(h => h.id === state.currentDetailHabitId);
    if (!habit) return;

    const confirmDelete = confirm(`Are you sure you want to delete "${habit.name}"? This will erase all completion records.`);
    if (confirmDelete) {
        state.habits = state.habits.filter(h => h.id !== state.currentDetailHabitId);
        saveState();
        goBackToDashboard();
    }
}

// ================= STRING & TIME UTILITIES =================

/**
 * Escapes HTML characters to prevent XSS injection attacks.
 * @param {string} str - Unsafe input string
 * @returns {string} Sanitized HTML string
 */
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

/**
 * Formats a 24-hour time string ("18:30") into a 12-hour AM/PM string ("6:30 PM").
 * @param {string} timeStr - Time string "HH:MM"
 * @returns {string} Formatted 12-hour string
 */
function formatTime(timeStr) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    let h = parseInt(hours);
    const m = minutes;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; // 0 index represents 12
    return `${h}:${m} ${ampm}`;
}

// ================= INITIALIZATION & EVENT LISTENERS SETUP =================

// ================= MECHANICAL HARDWARE THEME TOGGLE CONTROL =================
function initThemeControl() {
    const savedTheme = localStorage.getItem('habitflow_theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const lightBtn = document.getElementById('toggle-light-btn');
    const darkBtn = document.getElementById('toggle-dark-btn');
    
    let activeTheme = 'light';
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        activeTheme = 'dark';
    }
    
    // Apply initial state
    if (activeTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (lightBtn && darkBtn) {
            lightBtn.className = 'switch-btn extruded';
            darkBtn.className = 'switch-btn sunken';
        }
    } else {
        document.body.classList.remove('dark-mode');
        if (lightBtn && darkBtn) {
            lightBtn.className = 'switch-btn sunken';
            darkBtn.className = 'switch-btn extruded';
        }
    }
    
    // Wire up events
    if (lightBtn && darkBtn) {
        lightBtn.addEventListener('click', () => {
            document.body.classList.remove('dark-mode');
            lightBtn.className = 'switch-btn sunken';
            darkBtn.className = 'switch-btn extruded';
            localStorage.setItem('habitflow_theme', 'light');
        });
        
        darkBtn.addEventListener('click', () => {
            document.body.classList.add('dark-mode');
            lightBtn.className = 'switch-btn extruded';
            darkBtn.className = 'switch-btn sunken';
            localStorage.setItem('habitflow_theme', 'dark');
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Load state from localStorage or seed initial data
    loadState();
    
    // Initialize neomorphic theme mechanical switch
    initThemeControl();

    // Render initial dashboard views
    renderMainCalendar();
    renderTodayHabits();
    renderSelectedDateHabits();

    // Attach Floating Action Button event listener
    document.getElementById('add-habit-fab').addEventListener('click', openAddHabitModal);
    
    // Attach Modal controls and form submit listeners
    document.getElementById('modal-close-btn').addEventListener('click', closeHabitModal);
    document.getElementById('cancel-habit-btn').addEventListener('click', closeHabitModal);
    document.getElementById('habit-form').addEventListener('submit', handleFormSubmit);

    // Attach Main Calendar month navigation button listeners
    document.getElementById('main-prev-month').addEventListener('click', () => {
        state.currentMainMonth.setMonth(state.currentMainMonth.getMonth() - 1);
        renderMainCalendar();
    });
    document.getElementById('main-next-month').addEventListener('click', () => {
        state.currentMainMonth.setMonth(state.currentMainMonth.getMonth() + 1);
        renderMainCalendar();
    });

    // Attach Back to Dashboard navigation button listener
    document.getElementById('detail-back-btn').addEventListener('click', goBackToDashboard);

    // Attach Detail Screen action buttons (Edit & Delete) listeners
    document.getElementById('edit-habit-btn').addEventListener('click', openEditHabitModal);
    document.getElementById('delete-habit-btn').addEventListener('click', handleDeleteHabit);

    // Attach Detail Calendar month navigation listeners
    document.getElementById('detail-prev-month').addEventListener('click', () => {
        state.currentDetailMonth.setMonth(state.currentDetailMonth.getMonth() - 1);
        renderDetailCalendar();
    });
    document.getElementById('detail-next-month').addEventListener('click', () => {
        state.currentDetailMonth.setMonth(state.currentDetailMonth.getMonth() + 1);
        renderDetailCalendar();
    });

    // Render Lucide SVG icons across the DOM
    lucide.createIcons();
});

