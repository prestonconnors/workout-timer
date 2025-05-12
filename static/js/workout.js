document.addEventListener('DOMContentLoaded', () => {
    // ... (DOM Elements and other state variables remain the same) ...
    let audioCtx; // For silent sound hack

    // --- Helper Functions ---
    // ... (formatTime, formatCurrentTimer, toTitleCase remain the same) ...

    function playSilentSoundHack() {
        if (typeof (window.AudioContext || window.webkitAudioContext) === "undefined") {
            console.warn("Web Audio API not supported, cannot attempt silent sound hack.");
            return;
        }
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        // If context is suspended, it needs to be resumed by a user gesture.
        // This hack is unlikely to work if context is suspended initially.
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(err => console.warn("AudioContext resume failed:", err));
        }

        // Create a very short silent buffer
        const buffer = audioCtx.createBuffer(1, 1, 22050); // 1 frame ~1/22050 seconds
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start();
        // console.log("Attempted silent sound hack to release audio focus."); // For debugging
        // The source will stop automatically after playing its buffer.
    }


    function speak(text) {
        if (interactionLock && text !== "Workout Complete!") return;
        interactionLock = true;
        let lockReleaseTimeout = setTimeout(() => { interactionLock = false; }, INTERACTION_LOCK_TIMEOUT * 2);

        if (synth && text) {
            try {
                synth.cancel();
                let cleanedText = text.replace(/#.*/, '').trim();
                if (cleanedText === "") { interactionLock=false; clearTimeout(lockReleaseTimeout); return; }
                const utterance = new SpeechSynthesisUtterance(cleanedText);

                utterance.onend = () => {
                    interactionLock = false; clearTimeout(lockReleaseTimeout);
                    // playSilentSoundHack(); // Call the hack AFTER speech has ended
                };
                utterance.onerror = (event) => {
                    console.warn("TTS Utterance Warning/Error:", event.error);
                    interactionLock = false; clearTimeout(lockReleaseTimeout);
                    // playSilentSoundHack(); // Also try on error just in case
                };
                synth.speak(utterance);
            } catch (error) { console.error("TTS err:", error); interactionLock=false; clearTimeout(lockReleaseTimeout); }
        } else {
             interactionLock=false; clearTimeout(lockReleaseTimeout);
        }
    }

    // ... (playCountdownSound, updateUI, tick, startTimer, pauseTimer, loadExercise, nextExercise, prevExercise, playPauseToggle, finishWorkout, init, event listeners remain the same as the previous fully multi-line production version) ...
    // Make sure to use the version where all helper functions and core logic are multi-line.

    // --- Core Logic Functions (Ensure these are multi-line from previous safe version) ---
    function updateUI() { if(currentExerciseIndex>=routine.length)return;const c=routine[currentExerciseIndex];if(!c)return finishWorkout();const n=routine[currentExerciseIndex+1];const cn=c.name||'Unnamed';const nn=(n?(n.name||'Unnamed'):'Finished');exerciseNameEl.textContent=toTitleCase(cn);nextExerciseEl.textContent=n?`Next: ${toTitleCase(nn)}`:'Finished!';currentTimerEl.textContent=formatCurrentTimer(currentTimerValue);totalTimeEl.textContent=formatTime(totalTimerValue);const lcn=cn.toLowerCase();timerContainer.classList.toggle('resting',lcn==='intro'||lcn==='outro'||lcn.includes('rest')||lcn.includes('warmup')||lcn.includes('cool down')); }
    function tick() { if(isPaused)return;if(totalTimerValue<=0&¤tTimerValue<=1)return finishWorkout();if(totalTimerValue>0)totalTimerValue--;if(currentTimerValue<=1)nextExercise(false);else{currentTimerValue--;if(currentTimerValue===5)playCountdownSound();updateUI();}}
    function startTimer() { if(intervalId)clearInterval(intervalId);if(!isPaused){updateUI();intervalId=setInterval(tick,1000);}}
    function pauseTimer() { if(intervalId)clearInterval(intervalId);intervalId=null;}
    function loadExercise(idx){if(idx<0||idx>=routine.length)return finishWorkout();currentExerciseIndex=idx;const ex=routine[idx];if(!ex||typeof ex.length!=='number')return finishWorkout();currentTimerValue=ex.length;soundPlayedForCurrentInterval=false;let rT=0;for(let i=idx;i<routine.length;i++){const l=routine[i]?.length;if(typeof l==='number'&&l>=0)rT+=l;}totalTimerValue=rT;updateUI();speak(ex.name);pauseTimer();if(!isPaused)startTimer();}
    function nextExercise(m=true){if(m){if(interactionLock)return;interactionLock=true;setTimeout(()=>{interactionLock=false;},INTERACTION_LOCK_TIMEOUT);}if(currentExerciseIndex>=routine.length-1)return finishWorkout();loadExercise(currentExerciseIndex+1);}
    function prevExercise(){if(interactionLock)return;interactionLock=true;setTimeout(()=>{interactionLock=false;},INTERACTION_LOCK_TIMEOUT);if(currentExerciseIndex<=0)return;loadExercise(currentExerciseIndex-1);}
    function playPauseToggle(){if(isPaused){if(interactionLock)return;interactionLock=true;}let lockReleaseTimeout;if(isPaused)lockReleaseTimeout=setTimeout(()=>{interactionLock=false;},INTERACTION_LOCK_TIMEOUT*2);isPaused=!isPaused;if(isPaused){if(lockReleaseTimeout)clearTimeout(lockReleaseTimeout);interactionLock=false;pauseTimer();playPauseIcon.classList.replace('fa-pause','fa-play');playPauseBtn.setAttribute('aria-label','Play');playPauseBtn.title="Play";if(synth&&synth.speaking)synth.cancel();if(countdownSound)countdownSound.pause();}else{playPauseIcon.classList.replace('fa-play','fa-pause');playPauseBtn.setAttribute('aria-label','Pause');playPauseBtn.title="Pause";let sUP=Promise.resolve();if(countdownSound&&countdownSound.paused){sUP=new Promise(r=>{const cV=countdownSound.volume;countdownSound.volume=0;countdownSound.play().then(()=>{countdownSound.pause();countdownSound.volume=cV;r();}).catch(()=>{console.warn("Audio ctx unlock fail(PP)");r();});});}sUP.then(()=>{if(lockReleaseTimeout)clearTimeout(lockReleaseTimeout);interactionLock=false;startTimer();if(currentTimerValue===routine[currentExerciseIndex]?.length)speak(routine[currentExerciseIndex]?.name);});}}
    function finishWorkout(){if(timerContainer.style.display==='none')return;pauseTimer();isPaused=true;if(synth&&synth.speaking)synth.cancel();if(countdownSound)countdownSound.pause();if(timerContainer.style.display!=='none')speak("Workout Complete!");timerContainer.style.display='none';finishedScreen.style.display='flex';intervalId=null;}
    async function init(){try{const apiUrl=`${routineApiUrlBase}${routineFilename}`;const r=await fetch(apiUrl);if(!r.ok)throw new Error(`Fetch ${r.status}`);const d=await r.json();if(!d||!Array.isArray(d.exercises))throw new Error("Invalid data.");let oE=d.exercises.map(e=>{const l=Math.ceil(Number(e.length));return(typeof e.name==='string'&&e.name.trim()!==""&&!isNaN(l)&&l>=0)?{...e,length:l}:null;}).filter(e=>e!==null);routine=[];if(introDuration>0)routine.push({name:"Intro",length:introDuration,type:"intro"});routine.push(...oE);if(outroDuration>0)routine.push({name:"Outro",length:outroDuration,type:"outro"});if(routine.length===0)throw new Error("Routine empty.");isPaused=true;loadExercise(0);playPauseIcon.classList.replace('fa-pause','fa-play');playPauseBtn.setAttribute('aria-label','Play');playPauseBtn.title="Play";if(autoplayPromptEl&&beginWorkoutButtonEl){autoplayPromptEl.style.display='flex';requestAnimationFrame(()=>{autoplayPromptEl.classList.add('visible');});const hS=()=>{autoplayPromptEl.classList.remove('visible');setTimeout(()=>{autoplayPromptEl.style.display='none';if(isPaused)playPauseToggle();},300);beginWorkoutButtonEl.removeEventListener('click',hS);autoplayPromptEl.removeEventListener('click',hTO);};const hTO=(e)=>{if(e.target===autoplayPromptEl)hS();};beginWorkoutButtonEl.addEventListener('click',hS,{once:true});autoplayPromptEl.addEventListener('click',hTO);}else{console.warn("Prompt missing.");}}catch(e){console.error('Init fail:',e);timerContainer.innerHTML=`<div style="color:#d32f2f;background:#ffcdd2;padding:20px;text-align:center;border:1px solid #d32f2f;"><h1>Error</h1><p>${e.message||"Could not load."}</p><a href="/" style="color:#fff;margin-top:15px;display:inline-block;padding:10px 15px;background:#1976d2;text-decoration:none;">Back</a></div>`;const cD=document.querySelector('.controls');if(cD)cD.style.display='none';if(autoplayPromptEl)autoplayPromptEl.style.display='none';}}
    playPauseBtn.addEventListener('click',playPauseToggle);nextBtn.addEventListener('click',()=>nextExercise(true));prevBtn.addEventListener('click',prevExercise);
    document.addEventListener('keydown',(e)=>{if(finishedScreen.style.display!=='none'||(e.ctrlKey||e.altKey||e.metaKey||e.shiftKey))return;switch(e.code||e.key){case'Space':case' ':e.preventDefault();playPauseToggle();break;case'ArrowRight':nextExercise(true);break;case'ArrowLeft':prevExercise();break;}});
    init();
});