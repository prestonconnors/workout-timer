document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const timerContainer = document.getElementById('timer-container');
    const totalTimeEl = document.getElementById('total-time');
    const exerciseNameEl = document.getElementById('exercise-name');
    const nextExerciseEl = document.getElementById('next-exercise');
    const currentTimerEl = document.getElementById('current-timer');
    const prevBtn = document.getElementById('prev-btn');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const playPauseIcon = playPauseBtn.querySelector('i');
    const nextBtn = document.getElementById('next-btn');
    const finishedScreen = document.getElementById('finished-screen');
    const countdownSound = document.getElementById('countdown-sound');

    // --- State Variables ---
    let routine = [];
    // let totalDuration = 0; // Less critical now we recalculate totalTimerValue
    let currentExerciseIndex = 0;
    let currentTimerValue = 0; // Represents the number currently displayed
    let totalTimerValue = 0;   // Represents total seconds remaining from current point
    let intervalId = null;
    let isPaused = true;
    let synth = window.speechSynthesis;
    let soundPlayedForCurrentInterval = false;
    // Add flag to prevent multiple simultaneous speaks or plays on rapid clicks
    let interactionLock = false;
    const INTERACTION_LOCK_TIMEOUT = 300; // milliseconds to wait

    // --- Helper Functions ---
    function formatTime(seconds) {
        const nonNegativeSeconds = Math.max(0, seconds);
        if (isNaN(nonNegativeSeconds)) return "--:--";
        const mins = Math.floor(nonNegativeSeconds / 60);
        const secs = nonNegativeSeconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function formatCurrentTimer(seconds) {
         const displaySeconds = Math.max(1, seconds);
         if (isNaN(displaySeconds) || displaySeconds < 1) return "1";
         return String(displaySeconds);
    }

    function toTitleCase(str) {
        if (!str) return '';
        // Improved title casing to handle potential extra spaces or mixed cases better
        return str
             .toLowerCase() // Start with lowercase
             .split(/([\s/+-])/) // Split by delimiters, but keep them
             .map((part, index, arr) => {
                 // Handle specific words or start of string/after delimiter
                 if (part.startsWith('#')) return part; // Keep tags like # Leg
                 if (index === 0 || /[\s/+-]/.test(arr[index-1])) {
                    if(part.length > 0) return part.charAt(0).toUpperCase() + part.slice(1);
                 }
                 return part; // Return delimiter or subsequent parts of word as is (lowercase)
             }).join('');
    }


    function speak(text) {
        if (interactionLock) return; // Prevent action if locked
        interactionLock = true;
        setTimeout(() => { interactionLock = false; }, INTERACTION_LOCK_TIMEOUT);

        if (synth && text) {
            try {
                // Always cancel before speaking to prevent queue buildup
                synth.cancel();
                // Minimal cleanup, let TTS engine handle pronunciation nuances
                let cleanedText = text.replace(/#.*/, '').trim(); // Remove tags, trim whitespace
                 if (cleanedText === "") return; // Don't speak empty strings

                const utterance = new SpeechSynthesisUtterance(cleanedText);
                 // Optional: Language setting can sometimes improve pronunciation
                 // utterance.lang = 'en-US';
                synth.speak(utterance);
            } catch (error) {
                console.error("Speech synthesis error:", error); // Keep error logs
            }
        }
    }

     function playCountdownSound() {
         if (countdownSound && !soundPlayedForCurrentInterval) {
             // Don't lock sound play strictly, less critical than synth queueing
            countdownSound.volume = 0.7; // Consider making volume configurable
            countdownSound.currentTime = 0;
            countdownSound.play().then(() => {
                 soundPlayedForCurrentInterval = true;
            }).catch(error => {
                 // Log error, but don't crash - user might need interaction first
                 console.error("Audio playback error:", error);
             });
         }
     }

    // --- Core Logic Functions ---
    function updateUI() {
        if (currentExerciseIndex >= routine.length) return; // Exit if index is out of bounds

        const currentExercise = routine[currentExerciseIndex];
         // Handle case where routine structure might be incorrect (defensive coding)
         if (!currentExercise) {
             console.error(`Error: Could not get exercise data at index ${currentExerciseIndex}`);
             // Consider showing an error message on the UI or finishing workout
             finishWorkout();
             return;
         }

        const nextExercise = routine[currentExerciseIndex + 1];
        const currentExerciseName = currentExercise.name || 'Unnamed Exercise';
        const nextExerciseName = nextExercise ? (nextExercise.name || 'Unnamed Exercise') : 'Workout Finished';

        exerciseNameEl.textContent = toTitleCase(currentExerciseName);
        nextExerciseEl.textContent = nextExercise ? `Next: ${toTitleCase(nextExerciseName)}` : 'Finished!';

        currentTimerEl.textContent = formatCurrentTimer(currentTimerValue);
        totalTimeEl.textContent = formatTime(totalTimerValue);

        const lowerCaseName = currentExerciseName.toLowerCase();
        // Use includes() for partial matches like 'cool down stretch'
        if (lowerCaseName.includes('rest') || lowerCaseName.includes('warmup') || lowerCaseName.includes('cool down')) {
            timerContainer.classList.add('resting');
        } else {
            timerContainer.classList.remove('resting');
        }
    }

    function tick() {
        if (isPaused) return;
        if (totalTimerValue <= 0 && currentTimerValue <= 1) { // Stricter check for finish condition
            finishWorkout();
            return;
        }

         // Decrement total only if it's positive to prevent it going very negative
         if (totalTimerValue > 0) {
             totalTimerValue--;
         }

        // Check if current exercise interval is finishing
        if (currentTimerValue <= 1) {
            // Let nextExercise handle loading and timer reset
             nextExercise(false); // Auto-transition
        } else {
            // Still time left in this interval
            currentTimerValue--;
            if (currentTimerValue === 5) { // Play sound when display is about to show 5
                playCountdownSound();
            }
             // Update UI only if not transitioning immediately
            updateUI();
        }
    }


    function startTimer() {
        if (intervalId) clearInterval(intervalId); // Clear previous just in case
        if(!isPaused) {
            updateUI(); // Ensure UI is up-to-date when timer starts
            intervalId = setInterval(tick, 1000);
        }
    }

    function pauseTimer() {
        if (intervalId) clearInterval(intervalId);
        intervalId = null; // Important to nullify ID
    }

    function loadExercise(index) {
         if (index < 0) return; // Prevent going below zero
         // If trying to load beyond the last exercise, finish the workout
         if (index >= routine.length) {
             finishWorkout();
             return;
         }
         currentExerciseIndex = index;
         const exercise = routine[index];
          // Ensure exercise data is valid before proceeding
         if (!exercise || typeof exercise.length !== 'number') {
              console.error(`Invalid exercise data at index ${index}:`, exercise);
              finishWorkout(); // Fail gracefully
              return;
         }

         currentTimerValue = exercise.length; // This should be a pre-validated number
         soundPlayedForCurrentInterval = false;

         // Recalculate Total Remaining Time from current index onwards
         let recalculatedTotal = 0;
         for(let i = index; i < routine.length; i++){
             // Use the pre-validated length directly
             const len = routine[i]?.length;
              // Basic check, although data should be clean by now
             if (typeof len === 'number' && len >= 0) {
                recalculatedTotal += len;
             } else {
                  console.warn(`Warning: Invalid length encountered during total calculation at index ${i}`);
             }
         }
         totalTimerValue = recalculatedTotal;

         updateUI(); // Update display immediately

          // Speak only when playing OR on the very first load when paused
         if (!isPaused || (isPaused && index === 0)) {
            speak(exercise.name);
         }

         pauseTimer(); // Ensure no conflicting timers
         if (!isPaused) {
             startTimer(); // Restart if was playing
         }
    }

    function nextExercise(manualTrigger = true) {
        if (interactionLock && manualTrigger) return; // Prevent rapid clicks if manual
         // Check based on current index *before* calculating next
         if (currentExerciseIndex >= routine.length - 1) {
             finishWorkout(); // Already on last, finish
             return;
         }
         if (manualTrigger) { // Apply lock only for manual triggers
              interactionLock = true;
              setTimeout(() => { interactionLock = false; }, INTERACTION_LOCK_TIMEOUT);
         }
        const nextIndex = currentExerciseIndex + 1;
        loadExercise(nextIndex);
    }

    function prevExercise() {
        if (interactionLock) return; // Prevent rapid clicks
        interactionLock = true;
        setTimeout(() => { interactionLock = false; }, INTERACTION_LOCK_TIMEOUT);

        if (currentExerciseIndex <= 0) return; // Can't go before first
        const prevIndex = currentExerciseIndex - 1;
        loadExercise(prevIndex);
    }

    function playPauseToggle() {
        if (interactionLock) return;
        interactionLock = true;
        setTimeout(() => { interactionLock = false; }, INTERACTION_LOCK_TIMEOUT);

         isPaused = !isPaused;
         if (isPaused) {
             pauseTimer();
             playPauseIcon.classList.remove('fa-pause');
             playPauseIcon.classList.add('fa-play');
             playPauseBtn.setAttribute('aria-label', 'Play'); // Accessibility
             playPauseBtn.title = "Play";
             // Cancel synth speech when pausing
             if(synth && synth.speaking) synth.cancel();
             if (countdownSound) countdownSound.pause(); // Pause countdown sound
         } else {
             playPauseIcon.classList.remove('fa-play');
             playPauseIcon.classList.add('fa-pause');
              playPauseBtn.setAttribute('aria-label', 'Pause'); // Accessibility
             playPauseBtn.title = "Pause";
              // --- Audio Unlock Attempt ---
              // Needs user interaction, so try here on play toggle
             if (countdownSound && countdownSound.paused) {
                 const currentVol = countdownSound.volume;
                 countdownSound.volume = 0; // Play silently to unlock
                 countdownSound.play().then(() => {
                    countdownSound.pause(); // Pause immediately after unlocking
                    countdownSound.volume = currentVol; // Restore volume
                    // Start the actual timer *after* attempting audio unlock
                     startTimer();
                 }).catch(()=>{
                     // If unlock fails (e.g., browser restrictions), still start timer
                     console.warn("Audio unlock attempt failed or was interrupted.");
                      startTimer();
                 });
             } else {
                  // If sound wasn't paused (already unlocked), just start timer
                  startTimer();
             }
             // --- End Audio Unlock ---

             // Speak name ONLY if resuming AT THE START of an interval
             if (currentTimerValue === routine[currentExerciseIndex]?.length) {
                  speak(routine[currentExerciseIndex]?.name);
             }

             // Avoid synth.resume(), it's unreliable. Let speak() handle new announcements.
         }
     }


    function finishWorkout() {
        // Prevent finishing multiple times
        if (timerContainer.style.display === 'none') return;

        pauseTimer(); // Stop the interval
        isPaused = true; // Ensure state is correct
        // Cancel speech and sound explicitly
        if(synth && synth.speaking) synth.cancel();
        if (countdownSound) countdownSound.pause();

        speak("Workout Complete!"); // Announce completion

        timerContainer.style.display = 'none'; // Hide timer elements
        finishedScreen.style.display = 'flex'; // Show finished screen
        // Make sure intervalId is cleared
        intervalId = null;
    }


    // --- Initialization ---
    async function init() {
         try {
            // Basic Browser Feature Checks
             if (!('speechSynthesis' in window)) {
                console.warn("Speech Synthesis not supported in this browser.");
                // Optionally disable TTS features or inform user
             }
            if (!('Audio' in window)) {
                 console.warn("Web Audio not supported, sounds may not play.");
            }


            const response = await fetch(`/routine/${routineFilename}`);
            if (!response.ok) {
                // Provide more context for HTTP errors
                throw new Error(`Failed to load routine: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();

            // Validate incoming data structure before processing
            if (!data || !Array.isArray(data.exercises)) {
                 throw new Error("Invalid routine data structure received from server.");
            }

            routine = data.exercises.map(ex => {
                // Validate each exercise object during mapping
                 const lengthNum = Math.ceil(Number(ex.length));
                 if (typeof ex.name !== 'string' || ex.name.trim() === "" || isNaN(lengthNum) || lengthNum < 0) {
                      console.warn(`Invalid exercise data skipped: ${JSON.stringify(ex)}`);
                      return null; // Mark as invalid
                 }
                 return { ...ex, length: lengthNum };
             }).filter(ex => ex !== null); // Filter out any invalid ones marked as null


             if (routine.length === 0) {
                // If after filtering, routine is empty
                throw new Error("Routine is empty or contains no valid exercises.");
             }

             isPaused = true; // Ensure starting state is paused
             loadExercise(0); // Load the first valid exercise

             // Set initial button state correctly AFTER loadExercise
             playPauseIcon.classList.remove('fa-pause');
             playPauseIcon.classList.add('fa-play');
             playPauseBtn.setAttribute('aria-label', 'Play'); // Accessibility
             playPauseBtn.title = "Play";

         } catch (error) {
             console.error('Initialization failed:', error); // Log the error
             // Display a user-friendly error message on the screen
             timerContainer.innerHTML = `
                 <div style="color: #f44336; padding: 20px; text-align: center;">
                     <h1>Error</h1>
                     <p>Could not load the workout routine.</p>
                     <p style="font-size: 0.8em; margin-top: 10px;">${error.message}</p>
                     <a href="/" style="color: #fff; margin-top: 20px; display: inline-block; padding: 10px; background: #1565C0; border-radius: 5px; text-decoration: none;">Back to Routines</a>
                 </div>`;
             // Hide controls if load fails
             const controls = document.querySelector('.controls');
              if (controls) controls.style.display = 'none';
         }
    }


    // --- Event Listeners ---
    playPauseBtn.addEventListener('click', playPauseToggle);
    nextBtn.addEventListener('click', () => nextExercise(true));
    prevBtn.addEventListener('click', prevExercise);

    document.addEventListener('keydown', (e) => {
         // Ignore key presses if the finished screen is showing
         if (finishedScreen.style.display !== 'none') return;
         // Ignore if modifier keys are pressed (e.g., ctrl+space)
         if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

        switch (e.code || e.key) { // Use code for layout independence, key for older browser fallback
             case 'Space':
             case ' ': // Fallback for older browsers/key value
                 e.preventDefault(); // Prevent page scroll
                 playPauseToggle();
                 break;
             case 'ArrowRight':
                 nextExercise(true);
                 break;
             case 'ArrowLeft':
                 prevExercise();
                 break;
             // Add other keybindings if desired (e.g., 'N' for next, 'P' for prev)
        }
     });

    // --- Start the application ---
    init();

}); // End DOMContentLoaded