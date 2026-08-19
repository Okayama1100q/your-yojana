// Chatbot state
let chatHistory = [];
let preferredLanguage = null;
let userState = null;

// DOM Elements
const messagesContainer = document.getElementById('messages-container');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const interactiveOptions = document.getElementById('interactive-options');
const mockStateSelect = document.getElementById('mock-state');
const mockLocationPermission = document.getElementById('mock-location-permission');
const resetSessionBtn = document.getElementById('reset-session-btn');
const changeLangShortcut = document.getElementById('change-lang-shortcut');

// Badge elements
const activeLangBadge = document.getElementById('active-lang-badge');
const activeStateBadge = document.getElementById('active-state-badge');

// Dev console elements
const requestPayloadView = document.getElementById('request-payload-view');
const responsePayloadView = document.getElementById('response-payload-view');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// API Key configuration (Must match backend expectations)
const API_KEY = "dummy-dev-key-for-local-testing"; // Note: Set appropriately if backend requires it. We will handle API key headers.

// ── Tab Management ──
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        button.classList.add('active');
        const tabId = button.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
    });
});

// ── UI Utilities ──
function appendMessage(role, content) {
    const row = document.createElement('div');
    row.classList.add('message-row');
    row.classList.add(role === 'user' ? 'user-row' : 'bot-row');

    const bubble = document.createElement('div');
    bubble.classList.add('message');
    bubble.classList.add(role === 'user' ? 'user-msg' : 'bot-msg');
    
    // Support basic line breaks for readability
    bubble.innerHTML = content.replace(/\n/g, '<br>');

    row.appendChild(bubble);
    messagesContainer.appendChild(row);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator-wrapper';
    indicator.classList.add('message-row', 'bot-row');

    const bubble = document.createElement('div');
    bubble.classList.add('message', 'bot-msg', 'typing-indicator');
    bubble.innerHTML = `
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
    `;

    indicator.appendChild(bubble);
    messagesContainer.appendChild(indicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator-wrapper');
    if (indicator) {
        indicator.remove();
    }
}

function renderOptions(options) {
    interactiveOptions.innerHTML = '';
    if (!options || options.length === 0) return;

    options.forEach(opt => {
        const chip = document.createElement('div');
        chip.classList.add('option-chip');
        
        // Add icons for visual cues
        if (opt.includes("🌐") || opt === "Change Language") {
            chip.innerHTML = `<i class="fa-solid fa-globe"></i> ${opt}`;
        } else if (opt.includes("location") || opt.includes("Location")) {
            chip.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> ${opt}`;
        } else {
            chip.innerHTML = opt;
        }

        chip.addEventListener('click', () => {
            handleOptionSelection(opt);
        });

        interactiveOptions.appendChild(chip);
    });
}

// Update state badges
function updateStateBadges() {
    if (preferredLanguage) {
        activeLangBadge.textContent = preferredLanguage;
        activeLangBadge.classList.remove('none');
    } else {
        activeLangBadge.textContent = "None";
        activeLangBadge.classList.add('none');
    }

    if (userState) {
        activeStateBadge.textContent = userState;
        activeStateBadge.classList.remove('none');
        mockStateSelect.value = userState;
    } else {
        activeStateBadge.textContent = "None";
        activeStateBadge.classList.add('none');
    }
}

// ── Core Communication ──
async function sendMessageToAPI(text) {
    showTypingIndicator();
    
    // Prepare API Key Header. In local dev, we will read ALLOWED_ORIGINS or set a mock key.
    // The backend CHATBOT_API_KEY env determines if an authorization key is required.
    const headers = {
        "Content-Type": "application/json",
        "X-Chatbot-API-Key": "yj_cb_c1c0c3b259fa09e14c5cc18505096425"
    };

    // Format chat history for API request
    const apiHistory = chatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        content: msg.content
    }));

    const payload = {
        message: text,
        history: apiHistory,
        userState: userState || undefined,
        preferredLanguage: preferredLanguage || undefined
    };

    requestPayloadView.textContent = JSON.stringify(payload, null, 2);

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        responsePayloadView.textContent = JSON.stringify(data, null, 2);
        
        removeTypingIndicator();

        if (data.success) {
            appendMessage('bot', data.response);
            
            // Save state returned from backend
            preferredLanguage = data.preferredLanguage || null;
            userState = data.userState || null;
            
            updateStateBadges();
            renderOptions(data.options);
            
            // Append bot response to chat history
            chatHistory.push({ role: 'user', content: text });
            chatHistory.push({ role: 'model', content: data.response });
        } else {
            appendMessage('bot', `Error: ${data.response}`);
        }

    } catch (error) {
        removeTypingIndicator();
        appendMessage('bot', "Connection error: Unable to contact the YOJANA AI server.");
        console.error("Fetch error:", error);
    }
}

// ── Interaction Logic ──
function handleOptionSelection(optionText) {
    // If the option is "Yes, share location" and permission is simulated, simulate GPS state detection
    if (optionText === "Yes, share location") {
        appendMessage('user', optionText);
        if (mockLocationPermission.checked) {
            // Pick a simulated state from the mock dropdown or use default Tamil Nadu
            let selectedSimulatedState = mockStateSelect.value || "Tamil Nadu";
            userState = selectedSimulatedState;
            updateStateBadges();
            
            appendMessage('bot', `📍 Simulated GPS Location: Permission Granted. Detected State: ${userState}`);
            sendMessageToAPI(userState);
        } else {
            sendMessageToAPI("No, choose language manually");
        }
        return;
    }

    if (optionText === "🌐 Change Language") {
        appendMessage('user', "Change Language");
        sendMessageToAPI("Change Language");
        return;
    }

    // Normal option text submission
    appendMessage('user', optionText);
    sendMessageToAPI(optionText);
}

// Reset chat window and session variables
function resetChat() {
    chatHistory = [];
    preferredLanguage = null;
    userState = mockStateSelect.value || null;
    
    messagesContainer.innerHTML = '';
    interactiveOptions.innerHTML = '';
    
    requestPayloadView.textContent = 'No request sent yet.';
    responsePayloadView.textContent = 'No response received yet.';
    
    updateStateBadges();
    
    appendMessage('bot', "Initializing YOJANA AI assistant...");
    
    // Send initial trigger message to start onboarding
    sendMessageToAPI("Hello");
}

// ── Event Handlers ──
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage('user', text);
    userInput.value = '';
    interactiveOptions.innerHTML = ''; // Clear options once user writes manual text
    
    sendMessageToAPI(text);
});

mockStateSelect.addEventListener('change', () => {
    userState = mockStateSelect.value || null;
    updateStateBadges();
    appendMessage('bot', `🔧 Mock profile/state updated: ${userState || "Unknown"}`);
});

resetSessionBtn.addEventListener('click', resetChat);

changeLangShortcut.addEventListener('click', () => {
    appendMessage('user', "Change Language");
    sendMessageToAPI("Change Language");
});

// Initialize on page load
window.addEventListener('load', () => {
    resetChat();
});
