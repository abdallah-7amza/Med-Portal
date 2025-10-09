document.addEventListener('DOMContentLoaded', async function() {
    // --- 1. GET URL PARAMS AND DOM ELEMENTS ---
    const urlParams = new URLSearchParams(window.location.search);
    const path = urlParams.get('path') || '';
    const collectionId = urlParams.get('collection');
    // isLessonQuiz is no longer needed with the new structure
    const selectedUniId = localStorage.getItem('selectedUni');

    // ... (All existing DOM element variables)
    const siteTitleEl = document.getElementById('site-title');
    const questionCounter = document.getElementById('question-counter');
    const questionStem = document.getElementById('question-stem');
    const optionsContainer = document.getElementById('options-container');
    const explanationContainer = document.getElementById('explanation-container');
    const submitBtn = document.getElementById('submit-btn');
    const prevBtn = document.getElementById('prev-btn');
    const progressBar = document.getElementById('progress-bar');
    const quizInterface = document.getElementById('quiz-interface');
    const resultsScreen = document.getElementById('results-screen');
    const reviewScreen = document.getElementById('review-screen');
    const scoreDisplay = document.getElementById('score-display');
    const reviewBtn = document.getElementById('review-btn');
    const browseBtn = document.getElementById('browse-btn');
    const browseModal = document.getElementById('browse-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const browseList = document.getElementById('browse-list');
    const resetBtn = document.getElementById('reset-btn');

    // ## START SURGICAL ADDITION 1: New variables for Celebration Mode ##
    const celebrationToggle = document.getElementById('celebration-toggle');
    const CELEBRATION_KEY = 'celebrationModeEnabled';
    // ## END SURGICAL ADDITION 1 ##

    let currentQuestionIndex = 0;
    let userAnswers = [];
    let quizData = null;
    let storageKey = '';

    // --- 2. LOAD QUIZ DATA (MODIFIED FOR LAZY LOADING) ---
    try {
        if (!selectedUniId || !path || !collectionId) {
            throw new Error("Required parameters (University, Path, or Collection ID) are missing from the URL.");
        }

        // 💡 الخطوة 1: جلب ملف الفهرس الصغير فقط (للحصول على اسم الجامعة)
        const indexResponse = await fetch('./database.json');
        if (!indexResponse.ok) throw new Error("Could not load the site's database index.");
        const indexData = await indexResponse.json();
        const universityNode = indexData.tree[selectedUniId.toLowerCase()];
        if (!universityNode) throw new Error("Selected university not found in the database.");
        siteTitleEl.textContent = `${universityNode.name} Med Portal`;

        // 💡 الخطوة 2: بناء المسار المباشر لملف الاختبار بناءً على البارامترات
        // المسار الأساسي لملفات الاختبارات الجديدة (يجب أن يكون بالأحرف الصغيرة)
        const QUIZ_BASE_URL = './content/quizzes/';
        // إزالة / البداية من المسار وتحويله إلى أحرف صغيرة
        const relativePath = path.substring(1).toLowerCase();
        const quizId = collectionId.toLowerCase();

        // مثال: ./content/quizzes/nub/year5/pediatrics/cardiology/kaf.json
        const quizFileUrl = `${QUIZ_BASE_URL}${relativePath}/${quizId}.json`;

        // 💡 الخطوة 3: جلب ملف الاختبار المحدد مباشرة
        const quizResponse = await fetch(quizFileUrl);
        if (!quizResponse.ok) {
            throw new Error(`Quiz data file not found at ${quizFileUrl}. Check if the file exists and the path is correct.`);
        }
        quizData = await quizResponse.json();
        
        // تحديد مفتاح التخزين لضمان حفظ التقدم بشكل فريد
        storageKey = `quiz-progress-${selectedUniId}-${path}-${collectionId}`;

        if (!quizData || !quizData.questions) throw new Error('Quiz data is invalid or missing questions.');

        // ## START SURGICAL ADDITION 2: Call the new settings function ##
        setupSettings();
        // ## END SURGICAL ADDITION 2 ##

        populateBrowseModal();
        initializeQuiz();

    } catch (error) {
        showError(error.message);
    }

    // ## START SURGICAL ADDITION 3: The new settings function ##
    function setupSettings() {
        let isCelebrationEnabled = localStorage.getItem(CELEBRATION_KEY) === 'true';
        celebrationToggle.checked = isCelebrationEnabled;
        celebrationToggle.addEventListener('change', function() {
            localStorage.setItem(CELEBRATION_KEY, this.checked);
        });
    }
    // ## END SURGICAL ADDITION 3 ##


    // --- 3. ALL QUIZ FUNCTIONS (STABLE VERSION, NO CHANGES NEEDED HERE) ---
    function initializeQuiz() {
        const savedProgress = localStorage.getItem(storageKey);
        userAnswers = savedProgress ? JSON.parse(savedProgress) : new Array(quizData.questions.length).fill(null);
        let resumeIndex = userAnswers.findIndex(answer => answer === null);
        if (resumeIndex === -1) {
            showResults();
            return;
        }
        displayQuestion(resumeIndex);
    }

    function displayQuestion(index) {
        currentQuestionIndex = index;
        const question = quizData.questions[index];
        questionCounter.textContent = `Question ${index + 1} of ${quizData.questions.length}`;
        questionStem.textContent = question.stem;
        optionsContainer.innerHTML = '';
        optionsContainer.classList.remove('options-disabled');
        explanationContainer.style.display = 'none';
        question.options.forEach((option, i) => {
            const optionElement = document.createElement('div');
            optionElement.className = 'option';
            optionElement.innerHTML = `<input type="radio" name="answer" value="${i}" id="option-${i}"><label for="option-${i}">${option}</label>`;
            if (userAnswers[index] === i) {
                optionElement.querySelector('input').checked = true;
            }
            optionElement.addEventListener('click', () => selectOption(i));
            optionsContainer.appendChild(optionElement);
        });
        if (userAnswers[index] !== null) {
            showFeedback();
        }
        updateNavigation();
    }

    function selectOption(selectedIndex) {
        if (optionsContainer.classList.contains('options-disabled')) return;
        userAnswers[currentQuestionIndex] = selectedIndex;
        localStorage.setItem(storageKey, JSON.stringify(userAnswers));
        document.querySelector(`input[value='${selectedIndex}']`).checked = true;
        showFeedback();
        updateNavigation();
    }

    // ## START SURGICAL MODIFICATION 4: The updated feedback function ##
    function showFeedback() {
        optionsContainer.classList.add('options-disabled');
        const correctIndex = quizData.questions[currentQuestionIndex].correct;
        const explanationText = quizData.questions[currentQuestionIndex].explanation;
        const isCelebrationEnabled = localStorage.getItem(CELEBRATION_KEY) === 'true';
        if (userAnswers[currentQuestionIndex] === correctIndex && isCelebrationEnabled) {
            if (typeof Tone !== 'undefined') {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 }
                }).toDestination();
                synth.triggerAttackRelease("C6", "8n");
            }
            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 150,
                    spread: 80,
                    origin: { y: 0.6 }
                });
            }
        }
        document.querySelectorAll('.option').forEach((opt, i) => {
            if (i === correctIndex) opt.classList.add('correct');
            else if (userAnswers[currentQuestionIndex] === i) opt.classList.add('incorrect');
        });
        if (explanationText) {
            explanationContainer.innerHTML = `<strong>Explanation:</strong> ${explanationText}`;
            explanationContainer.style.display = 'block';
        }
    }
    // ## END SURGICAL MODIFICATION 4 ##

    function updateNavigation() {
        prevBtn.disabled = currentQuestionIndex === 0;
        submitBtn.disabled = userAnswers[currentQuestionIndex] === null;
        submitBtn.textContent = (currentQuestionIndex === quizData.questions.length - 1) ? 'Submit' : 'Next';
        updateProgressBar();
    }

    function updateProgressBar() {
        const progress = ((currentQuestionIndex + 1) / quizData.questions.length) * 100;
        progressBar.style.width = `${progress}%`;
    }

    function showResults() {
        let score = 0;
        quizData.questions.forEach((q, i) => {
            if (userAnswers[i] === q.correct) score++;
        });
        scoreDisplay.textContent = `You scored ${score} out of ${quizData.questions.length}`;
        quizInterface.style.display = 'none';
        resultsScreen.style.display = 'block';
    }

    function showReview() {
        resultsScreen.style.display = 'none';
        reviewScreen.style.display = 'block';
        reviewScreen.innerHTML = '<h2>Quiz Review</h2>';
        quizData.questions.forEach((question, index) => {
            const questionBlock = document.createElement('div');
            questionBlock.className = 'review-question-block';
            let optionsHTML = '';
            question.options.forEach((option, i) => {
                let className = 'option';
                if (i === question.correct) className += ' correct';
                else if (i === userAnswers[index]) className += ' incorrect';
                optionsHTML += `<div class="${className}">${option}</div>`;
            });
            questionBlock.innerHTML = `
                <h3>Q${index + 1}: ${question.stem}</h3>
                <div class="options-container">${optionsHTML}</div>
                ${question.explanation ? `<div class="review-explanation"><strong>Explanation:</strong> ${question.explanation}</div>` : ''}
            `;
            reviewScreen.appendChild(questionBlock);
        });
        const backBtn = document.createElement('button');
        backBtn.textContent = 'Back to Results';
        backBtn.className = 'button button-secondary';
        backBtn.onclick = () => {
            reviewScreen.style.display = 'none';
            resultsScreen.style.display = 'block';
        };
        reviewScreen.appendChild(backBtn);
    }

    function populateBrowseModal() {
        browseList.innerHTML = '';
        quizData.questions.forEach((question, index) => {
            const item = document.createElement('div');
            item.className = 'browse-item';
            let optionsHTML = '';
            question.options.forEach((optionText, i) => {
                let className = 'browse-option';
                if (i === question.correct) {
                    className += ' correct-answer';
                }
                optionsHTML += `<div class="${className}">${optionText}</div>`;
            });
            item.innerHTML = `
                <h3 class="browse-question">Q${index + 1}: ${question.stem}</h3>
                ${optionsHTML}
                <div class="browse-explanation">${question.explanation}</div>
            `;
            browseList.appendChild(item);
        });
    }

    function showError(message) {
        console.error("Quiz Error:", message);
        quizInterface.innerHTML = `<p style="color: red; text-align: center; font-weight: bold;">Error: ${message}</p>`;
    }

    // --- EVENT LISTENERS ---
    submitBtn.addEventListener('click', () => {
        if (currentQuestionIndex < quizData.questions.length - 1) {
            displayQuestion(currentQuestionIndex + 1);
        } else {
            showResults();
        }
    });
    prevBtn.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            displayQuestion(currentQuestionIndex - 1);
        }
    });
    reviewBtn.addEventListener('click', showReview);
    browseBtn.addEventListener('click', () => browseModal.classList.remove('hidden'));
    closeModalBtn.addEventListener('click', () => browseModal.classList.add('hidden'));
    browseModal.addEventListener('click', (e) => {
        if (e.target === browseModal) browseModal.classList.add('hidden');
    });
    resetBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to reset your progress for this quiz?")) {
            localStorage.removeItem(storageKey);
            window.location.reload();
        }
    });
});
