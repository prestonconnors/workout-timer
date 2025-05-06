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
    const autoplayPromptEl = document.getElementById('autoplay-prompt');
    const beginWorkoutButtonEl = document.getElementById('begin-workout-button');

    // --- State Variables ---
    let routine = [];
    let currentExerciseIndex = 0;
    let currentTimerValue = 0;
    let totalTimerValue = 0;
    let intervalId = null;
    let isPaused = true;
    let synth = window.speechSynthesis;
    let soundPlayedForCurrentInterval = false;
    let interactionLock = false;
    const INTERACTION_LOCK_TIMEOUT = 300;

    // --- Helper Functions (All Multi-Line Now) ---
    function formatTime(seconds) {
        const nonNegativeSeconds = Math.max(0, seconds);
        if (isNaN(nonNegativeSeconds)) {
             return "--:--";
        }
        const mins = Math.floor(nonNegativeSeconds / 60);
        const secs = nonNegativeSeconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function formatCurrentTimer(seconds) {
        const displaySeconds = Math.max(1, seconds);
        if (isNaN(displaySeconds) || displaySeconds < 1) {
            return "1";
        }
        return String(displaySeconds);
    }

    function toTitleCase(str) {
        if (!str) {
            return '';
        }
        return str.toLowerCase().split(/[\s/+-]+/)
            .map(word => {
                if (word.startsWith('#')) return word;
                if (word.length > 0) return word.charAt(0).toUpperCase() + word.slice(1);
                return "";
            })
            .join(' ');
    }

    function speak(text) {
        // Interaction lock handled by callers (nextExercise, prevExercise, playPauseToggle)
        if (synth && text) {
            try {
                synth.cancel();
                let cleanedText = text.replace(/#.*/, '').trim();
                if (cleanedText === "") { return; }
                const utterance = new SpeechSynthesisUtterance(cleanedText);
                utterance.onend = () => { interactionLock = false; }; // Release lock from caller
                utterance.onerror = (event) => {
                    console.warn("TTS Utterance Warning/Error:", event.error); // Only warn
                    interactionLock = false; // Release lock from caller
                };
                 // Fallback timeout to ensure lock is released
                 setTimeout(() => { if(interactionLock) interactionLock = false; }, INTERACTION_LOCK_TIMEOUT * 2);

                synth.speak(utterance);
            } catch (error) {
                 console.error("Speak function error:", error);
                 interactionLock = false; // Release lock from caller
             }
        } else {
             // Release lock if synth unavailable or text empty
             // Ensures lock is released if calling code set it and this fails early
            setTimeout(() => { interactionLock = false; }, 50);
        }
    }


    function playCountdownSound() {
         if (countdownSound && !soundPlayedForCurrentInterval) {
            countdownSound.volume = 0.7;
            countdownSound.currentTime = 0;
            // Use a Promise to handle potential playback errors
            const playPromise = countdownSound.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                     soundPlayedForCurrentInterval = true;
                }).catch(error => {
                     // Log error but don't crash - could be browser policy
                     console.error("Audio playback error (countdown):", error);
                 });
            } else {
                // Fallback for older browsers that don't return a Promise from play()
                 soundPlayedForCurrentInterval = true; // Assume it worked, less robust error handling
            }
         }
     }


    // --- Core Logic Functions (All Multi-Line) ---
    function updateUI() {
        if (currentExerciseIndex >= routine.length) return;
        const currentExercise = routine[currentExerciseIndex];
        if (!currentExercise) { console.error(`Bad data at index ${currentExerciseIndex}`); return finishWorkout();}
        const nextExercise = routine[currentExerciseIndex + 1];
        const currentExerciseName = currentExercise.name || 'Unnamed';
        const nextExerciseName = nextExercise ? (nextExercise.name || 'Unnamed') : 'Finished';
        exerciseNameEl.textContent = toTitleCase(currentExerciseName);
        nextExerciseEl.textContent = nextExercise ? `Next: ${toTitleCase(nextExerciseName)}` : 'Finished!';
        currentTimerEl.textContent = formatCurrentTimer(currentTimerValue);
        totalTimeEl.textContent = formatTime(totalTimerValue);
        const lcn = currentExerciseName.toLowerCase();
        timerContainer.classList.toggle('resting',lcn==='intro'||lcn==='outro'||lcn.includes('rest')||lcn.includes('warmup')||lcn.includes('cool down'));
    }

    function tick() {
        if (isPaused) return;
        if (totalTimerValue <= 0 && currentTimerValue <= 1) return finishWorkout();
        if (totalTimerValue > 0) totalTimerValue--;
        if (currentTimerValue <= 1) {
            nextExercise(false); // Auto-advance
        } else {
            currentTimerValue--;
            if (currentTimerValue === 5) playCountdownSound();
            updateUI();
        }
    }

    function startTimer() {
        if (intervalId) clearInterval(intervalId);
        if (!isPaused) {
            updateUI(); // Update immediately on start
            intervalId = setInterval(tick, 1000);
        }
    }

    function pauseTimer() {
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
    }

    function loadExercise(index) {
        if (index < 0 || index >= routine.length) return finishWorkout();
        currentExerciseIndex = index;
        const exercise = routine[index];
        if (!exercise || typeof exercise.length !== 'number') { console.error(`Invalid ex data ${index}`); return finishWorkout(); }
        currentTimerValue = exercise.length;
        soundPlayedForCurrentInterval = false;
        let recalculatedTotal = 0;
        for (let i = index; i < routine.length; i++) { const len = routine[i]?.length; if (typeof len === 'number' && len >= 0) recalculatedTotal += len; }
        totalTimerValue = recalculatedTotal;
        updateUI();
        speak(exercise.name); // Speak name every time a new exercise loads
        pauseTimer(); // Clear old timer
        if (!isPaused) startTimer(); // Start new if playing
    }

    function nextExercise(manualTrigger = true) {
        if (manualTrigger) { if (interactionLock) return; interactionLock = true; setTimeout(()=>{interactionLock = false;}, INTERACTION_LOCK_TIMEOUT); }
        if (currentExerciseIndex >= routine.length - 1) return finishWorkout();
        loadExercise(currentExerciseIndex + 1);
    }

    function prevExercise() { // Always manual
        if (interactionLock) return; interactionLock = true; setTimeout(()=>{interactionLock = false;}, INTERACTION_LOCK_TIMEOUT);
        if (currentExerciseIndex <= 0) return;
        loadExercise(currentExerciseIndex - 1);
    }

    function playPauseToggle() { // Multi-line for safety
        if (isPaused) { if (interactionLock) return; interactionLock = true; /* Set lock on initiating Play */}
        isPaused = !isPaused; // Toggle state
        if (isPaused) { // Pausing
            pauseTimer(); playPauseIcon.classList.replace('fa-pause', 'fa-play');
            playPauseBtn.setAttribute('aria-label','Play'); playPauseBtn.title="Play";
            if (synth && synth.speaking) synth.cancel(); if (countdownSound) countdownSound.pause();
            interactionLock = false; // Release lock immediately on Pause
        } else { // Playing
            playPauseIcon.classList.replace('fa-play', 'fa-pause');
            playPauseBtn.setAttribute('aria-label','Pause'); playPauseBtn.title="Pause";
            let sUP = Promise.resolve();
            if (countdownSound && countdownSound.paused) { // Try to unlock audio context
                sUP = new Promise(r=>{ const cV = countdownSound.volume; countdownSound.volume = 0; countdownSound.play().then(()=>{countdownSound.pause(); countdownSound.volume=cV; r(); }).catch(()=>{console.warn("Audio ctx unlock fail(PP)"); r(); }); });
            }
            sUP.then(() => { // After unlock attempt
                interactionLock = false; // Release lock *before* timer/speech
                startTimer(); // Start timer interval
                // Speak only if starting interval fresh
                if (currentTimerValue === routine[currentExerciseIndex]?.length) speak(routine[currentExerciseIndex]?.name);
            });
        }
    }

    function finishWorkout() { // Multi-line for safety
        if (timerContainer.style.display === 'none') return; pauseTimer(); isPaused=true;
        if(synth && synth.speaking) synth.cancel(); if(countdownSound) countdownSound.pause();
        if(timerContainer.style.display !== 'none') speak("Workout Complete!");
        timerContainer.style.display = 'none'; finishedScreen.style.display = 'flex'; intervalId = null;
    }

    async function init() { // Multi-line init with Tap to Begin prompt
        try {
            const apiUrl = `${routineApiUrlBase}${routineFilename}`; const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`Fetch fail: ${response.status}`); const data = await response.json();
            if (!data || !Array.isArray(data.exercises)) throw new Error("Invalid data.");
            let originalExercises=data.exercises.map(ex=>{const l=Math.ceil(Number(ex.length)); return(typeof ex.name==='string'&&ex.name.trim()!==""&&!isNaN(l)&&l>=0)?{...ex,length:l}:null;}).filter(e=>e!==null);
            routine=[]; if(introDuration>0)routine.push({name:"Intro",length:introDuration,type:"intro"}); routine.push(...originalExercises); if(outroDuration>0)routine.push({name:"Outro",length:outroDuration,type:"outro"});
            if(routine.length===0)throw new Error("Routine empty.");
            isPaused=true; loadExercise(0); // Initial load speaks first exercise
            playPauseIcon.classList.replace('fa-pause','fa-play'); playPauseBtn.setAttribute('aria-label','Play'); playPauseBtn.title="Play";
            if(autoplayPromptEl && beginWorkoutButtonEl){ // Show prompt logic
                 autoplayPromptEl.style.display='flex'; requestAnimationFrame(()=>{autoplayPromptEl.classList.add('visible');});
                 const handleStart=()=>{ autoplayPromptEl.classList.remove('visible'); setTimeout(()=>{autoplayPromptEl.style.display='none';if(isPaused)playPauseToggle();},300); beginWorkoutButtonEl.removeEventListener('click',handleStart); autoplayPromptEl.removeEventListener('click',handleTapOverlay); };
                 const handleTapOverlay=(e)=>{if(e.target===autoplayPromptEl)handleStart();};
                 beginWorkoutButtonEl.addEventListener('click',handleStart,{once:true}); autoplayPromptEl.addEventListener('click',handleTapOverlay);
            } else { console.warn("Prompt elements missing."); }
        } catch (error) { // Init Error handling
            console.error('Init fail:', error);
            timerContainer.innerHTML=`<div style="color:#d32f2f;background:#ffcdd2;padding:20px;text-align:center;border:1px solid #d32f2f;"><h1>Error</h1><p>${error.message||"Could not load."}</p><a href="/" style="color:#fff;margin-top:15px;display:inline-block;padding:10px 15px;background:#1976d2;text-decoration:none;">Back</a></div>`;
            const cD=document.querySelector('.controls'); if(cD)cD.style.display='none'; if(autoplayPromptEl)autoplayPromptEl.style.display='none';
        }
    }

    // --- Event Listeners ---
    playPauseBtn.addEventListener('click', playPauseToggle);
    nextBtn.addEventListener('click', () => nextExercise(true));
    prevBtn.addEventListener('click', prevExercise);
    document.addEventListener('keydown', (e) => { // Keep safe multi-line switch
        if (finishedScreen.style.display !== 'none' || (e.ctrlKey||e.altKey||e.metaKey||e.shiftKey)) return;
        switch(e.code || e.key){
            case'Space':case' ': e.preventDefault(); playPauseToggle(); break;
            case'ArrowRight': nextExercise(true); break;
            case'ArrowLeft': prevExercise(); break;
        }
    });

    // --- Start ---
    init();
}); // End DOMContentLoaded