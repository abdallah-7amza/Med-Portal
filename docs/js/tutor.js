document.addEventListener('DOMContentLoaded', function() {
    // --- 1. HTML Injection & Element Setup ---
    const fab = document.createElement('button');
    fab.className = 'ai-tutor-fab';
    fab.innerHTML = '<i class="fa-solid fa-brain"></i>';
    fab.title = 'Open AI Tutor';
    const apiModal = document.createElement('div');
    apiModal.id = 'api-key-modal';
    apiModal.className = 'tutor-modal-overlay';
    apiModal.innerHTML = `
        <div class="tutor-modal-content api-modal">
            <h2>AI Tutor Setup</h2>
            <p>Please enter your Gemini API Key. You can get one from Google AI Studio.</p>
            <input type="password" id="api-key-input" placeholder="Enter your API Key">
            <button id="validate-api-key-btn">Validate & Save Key</button>
            <div id="api-validation-message"></div>
        </div>
    `;
    const chatWindow = document.createElement('div');
    chatWindow.id = 'chat-window';
    chatWindow.className = 'chat-window';
    chatWindow.innerHTML = `
        <div class="chat-header">
            <h3>AI Tutor</h3>
            <div>
                <span id="api-status" class="api-status">❌</span>
                <button id="close-chat-btn" title="Close">X</button>
            </div>
        </div>
        <div class="chat-area" id="chat-area">
            <div class="chat-bubble ai-bubble">Hello! I am ready to help. How can I assist you?</div>
        </div>
        <div class="chat-input-area">
            <div class="quick-actions" id="quick-actions">
                <button class="quick-action-btn" data-prompt="Summarize the following content concisely.">Summarize</button>
                <button class="quick-action-btn" data-prompt="Explain the following content in a simple way.">Explain</button>
                <button class="quick-action-btn" data-prompt="Based on the content, ask me one multiple-choice question.">Quiz Me</button>
                <button class="quick-action-btn" data-prompt="Explain the content using the Feynman Technique.">Feynman Technique</button>
            </div>
            <div class="input-wrapper">
                <input type="text" id="chat-input" placeholder="Ask a question...">
                <button id="chat-send-btn" title="Send"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
        </div>
    `;
    document.body.appendChild(fab);
    document.body.appendChild(apiModal);
    document.body.appendChild(chatWindow);

    // --- 2. Get References and setup state ---
    const apiKeyModal = document.getElementById('api-key-modal');
    const chatWin = document.getElementById('chat-window');
    const apiStatus = document.getElementById('api-status');
    const chatArea = document.getElementById('chat-area');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const quickActionsContainer = document.getElementById('quick-actions');
    const GEMINI_API_KEY_STORAGE = 'gemini_api_key';
    let chatHistory = [];
    
    // --- 3. Core Logic: API Key & Initialization ---
    function initializeTutor() {
        const savedApiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE);
        if (savedApiKey) {
            apiStatus.textContent = '✅';
            chatWin.classList.toggle('visible');
        } else {
            apiKeyModal.classList.add('visible');
        }
    }
    
    async function validateAndSaveApiKey() {
        const apiKey = document.getElementById('api-key-input').value.trim();
        const validationMsg = document.getElementById('api-validation-message');
        if (!apiKey) {
            validationMsg.textContent = '❌ Please enter a key.';
            return;
        }
        validationMsg.textContent = 'Validating...';

        try {
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    model: "gemini-2.5-flash",
                    contents: [{ parts: [{ text: "Hello" }] }] 
                })
            });
            if (!response.ok) {
                const errorBody = await response.json();
                console.error("API Validation Error:", errorBody);
                throw new Error(errorBody.error.message || `HTTP error! status: ${response.status}`);
            }
            localStorage.setItem(GEMINI_API_KEY_STORAGE, apiKey);
            validationMsg.textContent = '✅ API connected successfully!';
            setTimeout(() => {
                apiKeyModal.classList.remove('visible');
                initializeTutor();
            }, 1000);
        } catch (error) {
            console.error(error);
            validationMsg.textContent = `❌ ${error.message}`;
        }
    }

    // --- 4. Context Awareness ---
    function getPageContext() {
        let context = "No specific context found.";
        const path = window.location.pathname;
        if (path.includes('lesson.html')) {
            context = document.getElementById('content-container')?.innerText;
        } else if (path.includes('quiz.html')) {
            const question = document.getElementById('question-stem')?.innerText;
            const options = Array.from(document.querySelectorAll('#options-container .option'))
                                 .map(opt => opt.innerText.trim());
            const explanationContainer = document.getElementById('explanation-container');
            let explanationText = '';
            if (explanationContainer && explanationContainer.offsetParent !== null) {
                explanationText = explanationContainer.innerText.trim();
            }
            if (question) {
                context = `The current quiz question is: "${question}". The available options are: [${options.join('; ')}]`;
                if (explanationText) {
                    context += `\nThe official explanation provided is: "${explanationText}"`;
                }
            }
        } else if (path.includes('flashcards.html')) {
            const front = document.getElementById('card-front-content')?.innerText;
            const back = document.getElementById('card-back-content')?.innerText;
            context = `Flashcard - Front: ${front}\nBack: ${back}`;
        }
        return context;
    }

    // --- 5. Main AI Interaction Function (using fetch) ---
    async function sendMessageToAI(prompt) {
        const apiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE);
        if (!apiKey) {
            addMessageToChat("API Key not found. Please set it up first.", 'ai');
            return;
        }
        const thinkingBubble = addMessageToChat("Thinking...", 'ai');
        const pageContext = getPageContext();
        chatHistory.push({ role: "user", parts: [{ text: `${prompt}\n\nContext:\n${pageContext}` }] });
        const systemInstruction = {
            role: "system",
            parts: [{ text: "Behavior Rules: You are an expert medical tutor. Your role is to explain, connect ideas, and answer with clear clinical logic. ALWAYS explain in English and use markdown for formatting (e.g., **bold**, *italics*, lists). If the user asks for Arabic, you MUST explain in Arabic but KEEP all medical terms in English without translation." }]
        };
        const payload = {
            model: "gemini-2.5-flash",   // ✅ تحديث الموديل
            contents: chatHistory,
            systemInstruction: systemInstruction
        };
        try {
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                 const errorBody = await response.json();
                 throw new Error(errorBody.error.message);
            }
            const result = await response.json();
            const aiResponse = result.candidates[0].content.parts[0].text;
            
            if (typeof marked !== 'undefined') {
                thinkingBubble.innerHTML = marked.parse(aiResponse);
            } else {
                thinkingBubble.textContent = aiResponse;
            }
            
            chatHistory.push({ role: "model", parts: [{ text: aiResponse }] });
        } catch (error) {
            console.error("Error communicating with Gemini:", error);
            thinkingBubble.textContent = `Sorry, an error occurred: ${error.message}`;
            chatHistory.pop();
        }
    }

    // --- 6. Event Listeners ---
    fab.addEventListener('click', initializeTutor);
    document.getElementById('validate-api-key-btn').addEventListener('click', validateAndSaveApiKey);
    document.getElementById('close-chat-btn').addEventListener('click', () => {
        chatWin.classList.remove('visible');
        chatHistory = [];
    });
    sendBtn.addEventListener('click', () => {
        const userInput = chatInput.value.trim();
        if (userInput) {
            addMessageToChat(userInput, 'user');
            sendMessageToAI(userInput);
            chatInput.value = '';
        }
    });
    chatInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') sendBtn.click(); });
    quickActionsContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('quick-action-btn')) {
            const prompt = event.target.dataset.prompt;
            sendMessageToAI(prompt);
        }
    });

    // --- 7. Helper Functions ---
    function addMessageToChat(message, sender) {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${sender === 'user' ? 'user-bubble' : 'ai-bubble'}`;
        
        if (sender === 'user') {
            bubble.textContent = message;
        } else {
            bubble.innerHTML = message;
        }
        
        chatArea.appendChild(bubble);
        chatArea.scrollTop = chatArea.scrollHeight;
        return bubble;
    }
});
