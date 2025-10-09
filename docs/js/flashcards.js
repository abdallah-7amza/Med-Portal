document.addEventListener('DOMContentLoaded', async function() {
    // --- 1. DOM Element Setup ---
    const deckTitleEl = document.getElementById('deck-title');
    const cardFrontContentEl = document.getElementById('card-front-content');
    const cardBackContentEl = document.getElementById('card-back-content');
    const flashcardEl = document.getElementById('flashcard');
    const counterEl = document.getElementById('flashcard-counter');
    const progressBarEl = document.getElementById('flashcard-progress-bar');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const flipBtn = document.getElementById('flip-btn');
    const siteTitleEl = document.getElementById('site-title');

    // --- 2. State Variables ---
    let mainDeck = [];
    let currentCardIndex = 0;
    let localStorageKey = '';

    // --- 3. Initialization (MODIFIED FOR LAZY LOADING) ---
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const path = urlParams.get('path');
        const collectionId = urlParams.get('collection');
        const selectedUniId = localStorage.getItem('selectedUni');

        if (!selectedUniId || !path || !collectionId) {
            throw new Error('Missing parameters (University, Path, or Collection ID).');
        }

        // 💡 الخطوة 1: جلب ملف الفهرس الصغير فقط (للحصول على اسم الجامعة)
        const indexResponse = await fetch('./database.json');
        if (!indexResponse.ok) throw new Error("Database index file not found.");
        const indexData = await indexResponse.json();
        const universityNode = indexData.tree[selectedUniId.toLowerCase()];
        if (!universityNode) throw new Error("Selected university not found.");
        siteTitleEl.textContent = `${universityNode.name} Med Portal`;

        // 💡 الخطوة 2: بناء المسار المباشر لملف البطاقات التعليمية
        const FLASHCARD_BASE_URL = './content/flashcards/';
        const relativePath = path.substring(1).toLowerCase();
        const deckId = collectionId.toLowerCase();
        
        // مثال: ./content/flashcards/nub/year5/obstetrics/revision/obstetrics.json
        const flashcardFileUrl = `${FLASHCARD_BASE_URL}${relativePath}/${deckId}.json`;

        // 💡 الخطوة 3: جلب ملف البطاقات المحدد مباشرة
        const deckResponse = await fetch(flashcardFileUrl);
        if (!deckResponse.ok) throw new Error(`Flashcard deck file not found at ${flashcardFileUrl}.`);
        const deckData = await deckResponse.json();

        if (!deckData || !deckData.cards || deckData.cards.length === 0) {
            throw new Error("Deck is empty or data structure is invalid.");
        }
        
        // استخدام البيانات التي تم جلبها مباشرة
        mainDeck = deckData.cards;
        deckTitleEl.textContent = deckData.title;
        
        localStorageKey = `flashcard-progress-${selectedUniId}-${path}-${collectionId}`;

        loadProgress();
        displayCard(currentCardIndex);

    } catch (error) {
        deckTitleEl.textContent = `Error: ${error.message}`;
        console.error("Flashcard Error:", error);
    }

    // --- 4. Core Functions (No changes needed here) ---
    function displayCard(index) {
        if (index >= mainDeck.length) {
            index = mainDeck.length - 1;
        }
        if (index < 0) index = 0; // Prevent negative index
        
        currentCardIndex = index;
        const card = mainDeck[currentCardIndex];

        flashcardEl.classList.remove('is-flipped');

        // Ensure card content exists before assigning
        cardFrontContentEl.textContent = card ? card.front : 'End of deck.';
        cardBackContentEl.textContent = card ? card.back : '';

        updateProgress(currentCardIndex, mainDeck.length);
        saveProgress();
    }

    function updateProgress(index, total) {
        counterEl.textContent = `${index + 1} / ${total}`;
        progressBarEl.style.width = `${((index + 1) / total) * 100}%`;
        prevBtn.disabled = index === 0;
        nextBtn.disabled = index === total - 1;
    }

    function saveProgress() {
        if (localStorageKey) {
            localStorage.setItem(localStorageKey, currentCardIndex);
        }
    }

    function loadProgress() {
        const savedIndex = localStorage.getItem(localStorageKey);
        if (savedIndex && parseInt(savedIndex, 10) < mainDeck.length) {
            currentCardIndex = parseInt(savedIndex, 10);
        } else {
            currentCardIndex = 0;
        }
    }

    // --- 5. Event Listeners (No changes needed here) ---
    flashcardEl.addEventListener('click', () => {
        flashcardEl.classList.toggle('is-flipped');
    });
    flipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        flashcardEl.classList.toggle('is-flipped');
    });

    prevBtn.addEventListener('click', () => {
        if (currentCardIndex > 0) {
            displayCard(currentCardIndex - 1);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentCardIndex < mainDeck.length - 1) {
            displayCard(currentCardIndex + 1);
        }
    });
});
