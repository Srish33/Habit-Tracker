// ================= STATE CONFIGURATION =================
let state = {
    habits: [],
    selectedDate: '', // YYYY-MM-DD
    currentDetailHabitId: null,
    currentMainMonth: null, // Date object representing the month showing on main calendar
    currentDetailMonth: null // Date object representing the month showing on detail calendar
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ================= DATE HELPERS =================
function formatDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function parseDateStr(dateStr) {
    const parts = dateStr.split('-');
    // Parse as local time to avoid timezone offsets
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDisplayDate(dateStr) {
    const date = parseDateStr(dateStr);
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function getDayOfWeekIndex(dateStr) {
    return parseDateStr(dateStr).getDay();
}

// ================= LOCAL STORAGE & DYNAMIC SEEDING =================
function loadState() {
    const stored = localStorage.getItem('habitflow_state');
    const todayStr = formatDate(new Date());
    
    if (stored) {
        state = JSON.parse(stored);
        // Ensure date objects are initialized
        state.selectedDate = state.selectedDate || todayStr;
        state.currentMainMonth = parseDateStr(state.selectedDate);
        state.currentDetailMonth = parseDateStr(state.selectedDate);
    } else {
        // First-time load: Seed beautiful sample habits relative to today
        state.habits = initializeSampleData();
        state.selectedDate = todayStr;
        state.currentMainMonth = new Date();
        state.currentDetailMonth = new Date();
        saveState();
    }
}

function saveState() {
    localStorage.setItem('habitflow_state', JSON.stringify({
        habits: state.habits,
        selectedDate: state.selectedDate
    }));
}

function initializeSampleData() {
    const today = new Date();
    const sampleHabits = [
        {
            id: 'sample_meditation',
            name: 'Morning Meditation',
            description: 'Sit in silence, focus on breathing, and observe thoughts without judgment.',
            days: [1, 2, 3, 4, 5], // Mon-Fri
            time: '07:30',
            completedDates: []
        },
        {
            id: 'sample_reading',
            name: 'Read 10 Pages',
            description: 'Read at least 10 pages of a non-fiction or educational book.',
            days: [0, 1, 2, 3, 4, 5, 6], // Daily
            time: '21:30',
            completedDates: []
        },
        {
            id: 'sample_workout',
            name: 'Gym Workout',
            description: 'Strength training routine focusing on progressive overload.',
            days: [1, 3, 5], // Mon, Wed, Fri
            time: '18:00',
            completedDates: []
        }
    ];

    // Populate past completions dynamically to demonstrate streaks and calendar dots
    for (let i = 0; i < 20; i++) {
        const checkDate = new Date();
        checkDate.setDate(today.getDate() - i);
        const dateStr = formatDate(checkDate);
        const dayOfWeek = checkDate.getDay();

        // 1. Meditation (Mon-Fri) - Completed on ~80% of scheduled days
        if ([1, 2, 3, 4, 5].includes(dayOfWeek)) {
            // Keep streak alive by forcing today & yesterday completed if they are weekdays
            if (i <= 1 || Math.random() > 0.25) {
                sampleHabits[0].completedDates.push(dateStr);
            }
        }

        // 2. Reading (Daily) - Completed almost daily
        if (i <= 3 || Math.random() > 0.15) {
            sampleHabits[1].completedDates.push(dateStr);
        }

        // 3. Gym Workout (Mon, Wed, Fri) - Completed on ~70% of scheduled days
        if ([1, 3, 5].includes(dayOfWeek)) {
            if (Math.random() > 0.3) {
                sampleHabits[2].completedDates.push(dateStr);
            }
        }
    }

    return sampleHabits;
}

// ================= STREAK CALCULATOR =================
function calculateStreak(completedDates, scheduledDays) {
    if (!completedDates.length || !scheduledDays.length) return 0;
    
    const datesSet = new Set(completedDates);
    let streak = 0;
    
    // Start checking backward from today
    let checkDate = new Date();
    let todayStr = formatDate(checkDate);
    
    // Helper to check if a Date object is scheduled for the habit
    const isScheduled = (dateObj) => scheduledDays.includes(dateObj.getDay());

    // If today is a scheduled day but not completed, check if yesterday was completed to keep streak alive.
    // Otherwise, if yesterday was scheduled but not completed, streak is broken.
    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    let yesterdayStr = formatDate(yesterday);
    
    let startFrom = checkDate;
    
    if (isScheduled(checkDate)) {
        if (!datesSet.has(todayStr)) {
            // Today is scheduled but incomplete. Check if yesterday was completed.
            if (isScheduled(yesterday) && !datesSet.has(yesterdayStr)) {
                return 0; // Streak is broken
            }
            startFrom = yesterday; // Start counting from yesterday
        }
    } else {
        // Today is not scheduled. Start checking from yesterday.
        if (isScheduled(yesterday) && !datesSet.has(yesterdayStr)) {
            // Yesterday was scheduled but not completed. Check days before.
            // Let's roll back startFrom to yesterday.
            startFrom = yesterday;
        } else {
            startFrom = yesterday;
        }
    }
    
    // Trace back day by day
    let currentDate = new Date(startFrom.getTime());
    let safetyCounter = 0; // Prevent infinite loops
    
    while (safetyCounter < 365) {
        safetyCounter++;
        const dateStr = formatDate(currentDate);
        
        if (isScheduled(currentDate)) {
            if (datesSet.has(dateStr)) {
                streak++;
            } else {
                // Scheduled day missed! Streak ends here.
                break;
            }
        }
        // Roll back 1 day
        currentDate.setDate(currentDate.getDate() - 1);
    }
    
    return streak;
}

// ================= UI RENDERING ENGINE =================

// 1. Render Main Monthly Calendar
function renderMainCalendar() {
    const calendarContainer = document.getElementById('main-calendar-days');
    if (!calendarContainer) return;
    calendarContainer.innerHTML = '';

    const year = state.currentMainMonth.getFullYear();
    const month = state.currentMainMonth.getMonth();

    // Display title
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('main-month-year').textContent = `${monthNames[month]} ${year}`;

    // Get first day of month and total days
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Map Sunday (0) to index 6, Monday (1) to index 0, etc.
    const adjustedStartOffset = (firstDayIndex === 0) ? 6 : firstDayIndex - 1;

    // Render spacer elements for preceding days
    for (let i = 0; i < adjustedStartOffset; i++) {
        const spacer = document.createElement('div');
        spacer.className = 'calendar-day-empty';
        calendarContainer.appendChild(spacer);
    }

    // Render active day buttons
    const todayStr = formatDate(new Date());
    for (let d = 1; d <= totalDays; d++) {
        const currentDayDate = new Date(year, month, d);
        const dateStr = formatDate(currentDayDate);
        const dayOfWeek = currentDayDate.getDay();

        const btn = document.createElement('button');
        btn.className = 'calendar-day-btn';
        if (dateStr === state.selectedDate) btn.classList.add('selected');
        if (dateStr === todayStr) btn.classList.add('today');
        
        btn.innerHTML = `<span class="day-num">${d}</span>`;

        // Render mini scheduled/completion dots
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

        btn.addEventListener('click', () => {
            state.selectedDate = dateStr;
            renderMainCalendar();
            renderSelectedDateHabits();
        });

        calendarContainer.appendChild(btn);
    }
}

// 2. Render Today's Habits Checklist
function renderTodayHabits() {
    const container = document.getElementById('todays-habits');
    if (!container) return;
    container.innerHTML = '';

    const todayDate = new Date();
    const todayStr = formatDate(todayDate);
    const todayDay = todayDate.getDay();

    const todaysHabits = state.habits.filter(h => h.days.includes(todayDay));

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

        // Click on info navigates to details screen
        card.querySelector('.habit-info-clickable').addEventListener('click', () => {
            showHabitDetails(habit.id);
        });

        // Click on Toggle button marks complete/incomplete
        card.querySelector('.btn-toggle-done').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleHabitCompletion(habit.id, todayStr);
        });

        container.appendChild(card);
    });

    lucide.createIcons();
}

// 3. Render Habits for Selected Date
function renderSelectedDateHabits() {
    const container = document.getElementById('selected-date-habits');
    const title = document.getElementById('selected-date-title');
    if (!container || !title) return;
    container.innerHTML = '';

    title.textContent = `Scheduled on ${formatDisplayDate(state.selectedDate)}`;

    const selectedDateObj = parseDateStr(state.selectedDate);
    const dayOfWeek = selectedDateObj.getDay();

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

    scheduledHabits.forEach(habit => {
        const isCompleted = habit.completedDates.includes(state.selectedDate);
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

        // Click on info goes to detail screen
        card.querySelector('.habit-info-clickable').addEventListener('click', () => {
            showHabitDetails(habit.id);
        });

        // Click on toggle done
        card.querySelector('.btn-toggle-done').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleHabitCompletion(habit.id, state.selectedDate);
        });

        container.appendChild(card);
    });

    lucide.createIcons();
}

// 4. Toggle Completion state (Done / Not Done)
function toggleHabitCompletion(habitId, dateStr) {
    const habit = state.habits.find(h => h.id === habitId);
    if (!habit) return;

    const index = habit.completedDates.indexOf(dateStr);
    if (index > -1) {
        habit.completedDates.splice(index, 1); // Mark Not Done
    } else {
        habit.completedDates.push(dateStr); // Mark Done
    }

    saveState();
    
    // Re-render UI segments
    renderMainCalendar();
    renderTodayHabits();
    renderSelectedDateHabits();
    
    if (state.currentDetailHabitId === habitId) {
        renderDetailCalendar();
        updateDetailStats(habit);
    }
}

// 5. Navigate to Habit Detail Screen
function showHabitDetails(habitId) {
    const habit = state.habits.find(h => h.id === habitId);
    if (!habit) return;

    state.currentDetailHabitId = habitId;
    state.currentDetailMonth = parseDateStr(state.selectedDate); // Sync detail calendar month

    // Switch screen visibility
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('detail-screen').classList.remove('hidden');

    // Render details
    document.getElementById('detail-habit-name').textContent = habit.name;
    document.getElementById('detail-habit-desc').textContent = habit.description || "No description provided.";
    
    // Render schedule summary
    const daysStr = habit.days.map(d => DAY_SHORT_NAMES[d]).join(', ');
    document.getElementById('detail-habit-schedule').textContent = `Scheduled on: ${daysStr} at ${formatTime(habit.time)}`;

    // Render stats & detail calendar heatmap
    updateDetailStats(habit);
    renderDetailCalendar();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Update stats boxes on Detail View
function updateDetailStats(habit) {
    const streak = calculateStreak(habit.completedDates, habit.days);
    const total = habit.completedDates.length;

    document.getElementById('stat-streak').textContent = streak;
    document.getElementById('stat-total').textContent = total;
}

// Render Habit Heatmap Calendar
function renderDetailCalendar() {
    const calendarContainer = document.getElementById('detail-calendar-days');
    const habit = state.habits.find(h => h.id === state.currentDetailHabitId);
    if (!calendarContainer || !habit) return;
    
    calendarContainer.innerHTML = '';

    const year = state.currentDetailMonth.getFullYear();
    const month = state.currentDetailMonth.getMonth();

    // Display title
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('detail-month-year').textContent = `${monthNames[month]} ${year}`;

    // Get offsets
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const adjustedStartOffset = (firstDayIndex === 0) ? 6 : firstDayIndex - 1;

    // Spacers
    for (let i = 0; i < adjustedStartOffset; i++) {
        const spacer = document.createElement('div');
        spacer.className = 'calendar-day-empty';
        calendarContainer.appendChild(spacer);
    }

    const todayStr = formatDate(new Date());
    
    for (let d = 1; d <= totalDays; d++) {
        const currentDayDate = new Date(year, month, d);
        const dateStr = formatDate(currentDayDate);
        const dayOfWeek = currentDayDate.getDay();
        const isScheduled = habit.days.includes(dayOfWeek);

        const btn = document.createElement('button');
        btn.className = 'calendar-day-btn';
        if (dateStr === todayStr) btn.classList.add('today');
        
        // Highlight in sage-green if completed
        const isDone = habit.completedDates.includes(dateStr);
        if (isDone) btn.classList.add('completed');
        
        btn.innerHTML = `<span class="day-num">${d}</span>`;

        // If scheduled but not completed, render a tiny gray dot
        if (isScheduled && !isDone) {
            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'calendar-day-dots';
            const dot = document.createElement('div');
            dot.className = 'calendar-dot';
            dotsContainer.appendChild(dot);
            btn.appendChild(dotsContainer);
        }

        // Clicking a day in detail calendar toggles completion for that day!
        // But only if the habit is scheduled for that weekday
        if (isScheduled) {
            btn.addEventListener('click', () => {
                toggleHabitCompletion(habit.id, dateStr);
            });
        } else {
            // If not scheduled, click doesn't do anything or just alerts
            btn.style.opacity = '0.5';
            btn.style.cursor = 'default';
        }

        calendarContainer.appendChild(btn);
    }
}

// 6. Navigation back to Dashboard
function goBackToDashboard() {
    state.currentDetailHabitId = null;
    document.getElementById('detail-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    
    renderMainCalendar();
    renderTodayHabits();
    renderSelectedDateHabits();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================= DIALOG / FORM HANDLERS =================
function openAddHabitModal() {
    document.getElementById('modal-title').textContent = 'Create New Habit';
    document.getElementById('habit-id').value = '';
    document.getElementById('habit-form').reset();
    
    // Clear custom checkbox button states (default all to true/checked)
    const dayCheckboxes = document.querySelectorAll('.day-checkbox');
    dayCheckboxes.forEach(cb => cb.checked = true);

    // Set current time as default or standard morning time
    document.getElementById('habit-time').value = '08:00';

    document.getElementById('habit-modal').classList.remove('hidden');
}

function openEditHabitModal() {
    const habit = state.habits.find(h => h.id === state.currentDetailHabitId);
    if (!habit) return;

    document.getElementById('modal-title').textContent = 'Edit Habit';
    document.getElementById('habit-id').value = habit.id;
    document.getElementById('habit-name').value = habit.name;
    document.getElementById('habit-desc').value = habit.description;
    document.getElementById('habit-time').value = habit.time;

    // Set day checkbox states
    const dayCheckboxes = document.querySelectorAll('.day-checkbox');
    dayCheckboxes.forEach(cb => {
        cb.checked = habit.days.includes(parseInt(cb.value));
    });

    document.getElementById('habit-modal').classList.remove('hidden');
}

function closeHabitModal() {
    document.getElementById('habit-modal').classList.add('hidden');
}

function handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('habit-id').value;
    const name = document.getElementById('habit-name').value.trim();
    const description = document.getElementById('habit-desc').value.trim();
    const time = document.getElementById('habit-time').value;

    // Get checked days
    const dayCheckboxes = document.querySelectorAll('.day-checkbox:checked');
    const days = Array.from(dayCheckboxes).map(cb => parseInt(cb.value));

    if (days.length === 0) {
        alert('Please select at least one day of the week for this habit.');
        return;
    }

    if (id) {
        // Edit Mode
        const habit = state.habits.find(h => h.id === id);
        if (habit) {
            habit.name = name;
            habit.description = description;
            habit.days = days;
            habit.time = time;
        }
    } else {
        // Create Mode
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
    
    // Update active screens
    if (state.currentDetailHabitId) {
        showHabitDetails(state.currentDetailHabitId);
    } else {
        renderMainCalendar();
        renderTodayHabits();
        renderSelectedDateHabits();
    }
}

// 7. Delete Habit
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

// ================= UTILITY HELPERS =================
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    let h = parseInt(hours);
    const m = minutes;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; // index 0 represents 12
    return `${h}:${m} ${ampm}`;
}

// ================= EVENT LISTENERS SETUP =================
document.addEventListener('DOMContentLoaded', () => {
    // Initial State load
    loadState();

    // Render dashboard views
    renderMainCalendar();
    renderTodayHabits();
    renderSelectedDateHabits();

    // Floating Action Button
    document.getElementById('add-habit-fab').addEventListener('click', openAddHabitModal);
    
    // Modal buttons
    document.getElementById('modal-close-btn').addEventListener('click', closeHabitModal);
    document.getElementById('cancel-habit-btn').addEventListener('click', closeHabitModal);
    document.getElementById('habit-form').addEventListener('submit', handleFormSubmit);

    // Main calendar controls
    document.getElementById('main-prev-month').addEventListener('click', () => {
        state.currentMainMonth.setMonth(state.currentMainMonth.getMonth() - 1);
        renderMainCalendar();
    });
    document.getElementById('main-next-month').addEventListener('click', () => {
        state.currentMainMonth.setMonth(state.currentMainMonth.getMonth() + 1);
        renderMainCalendar();
    });

    // Back to dashboard
    document.getElementById('detail-back-btn').addEventListener('click', goBackToDashboard);

    // Detail Action buttons
    document.getElementById('edit-habit-btn').addEventListener('click', openEditHabitModal);
    document.getElementById('delete-habit-btn').addEventListener('click', handleDeleteHabit);

    // Detail calendar controls
    document.getElementById('detail-prev-month').addEventListener('click', () => {
        state.currentDetailMonth.setMonth(state.currentDetailMonth.getMonth() - 1);
        renderDetailCalendar();
    });
    document.getElementById('detail-next-month').addEventListener('click', () => {
        state.currentDetailMonth.setMonth(state.currentDetailMonth.getMonth() + 1);
        renderDetailCalendar();
    });

    // Initialize Lucide icons
    lucide.createIcons();
});
