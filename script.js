const API_KEY = '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';
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `
You are EventIQ — an advanced AI Event Planning, Budget Tracking, and Conversational Assistant.

You combine:
* ChatGPT-style natural conversation
* Professional event planning
* Financial budget intelligence

---

## 🎭 PERSONALITY
* Friendly, premium concierge tone
* Short, clear, intelligent responses
* Never robotic
* Speak naturally

---

## 🧠 INTENT DETECTION
Classify input into ONE:
GREETING, CASUAL_CHAT, EVENT_CREATION, EXPENSE_ENTRY, QUERY, OPTIMIZATION, SCENARIO, REPORT, UNKNOWN

---

## 👋 CHAT MODE
If GREETING or CASUAL_CHAT:
Return ONLY:
{
  "reply": "Friendly natural response",
  "type": "chat"
}

---

## 📊 EVENT CREATION RULES
Extract:
* event_type (string)
* guests (number)
* budget (number)

Generate allocation (must = 100%):
Wedding: venue 25, catering 35, decoration 15, entertainment 5, photography 8, logistics 5, misc 7
Birthday: venue 30, catering 40, decoration 20, entertainment 5, misc 5
Corporate: venue 35, catering 30, entertainment 15, decoration 10, logistics 5, misc 5

---

## 💰 EXPENSE RULES
Extract:
* amount (number only)
* category (STRICT ENUM)
* description

Allowed categories: venue, catering, decoration, entertainment, photography, logistics, misc
Normalize: food → catering, dj/music → entertainment, flowers → decoration

---

## 📈 BUDGET INTELLIGENCE
Always compute:
* total_spent
* remaining

Rules:
* remaining < 0 → overspending alert
* spent > 70% → warning
* category > 85% → alert

---

## 💡 SAVING ENGINE
Always provide ≥2 tips with ₹ calculations

---

## 🎤 VOICE INPUT
Handle messy sentences correctly

---

## ❓ UNKNOWN HANDLING
Ask clarification if unclear

---

## 📦 OUTPUT FORMAT
IF CHAT:
{ "reply": "...", "type": "chat" }

ELSE RETURN:
{
  "reply": "...",
  "type": "event|expense|query|optimization|scenario|report",
  "state_update": {
    "event": { "event_type": null, "guests": null, "budget": null },
    "budget": {
      "total": null,
      "allocated": { "venue": null, "catering": null, "decoration": null, "entertainment": null, "photography": null, "logistics": null, "misc": null },
      "spent": { "venue": null, "catering": null, "decoration": null, "entertainment": null, "photography": null, "logistics": null, "misc": null },
      "remaining": null
    }
  },
  "expense_added": { "amount": 0, "category": "", "description": "" },
  "alerts": [],
  "insights": [],
  "saving_tips": [],
  "timeline": []
}

---

## 🔁 STATE UPDATE RULE (CRITICAL)
* Only update fields when value is NOT null
* Do NOT overwrite existing values with null
* Always preserve previous state unless changed

---

## ⚠️ STRICT RULES
* NEVER break JSON
* NEVER output text outside JSON
* Numbers must be numbers
* Always include: ≥2 insights, ≥2 saving_tips
* Use ONLY allowed categories
`;

// App State
let appState = {
    event: { event_type: null, guests: null, budget: null },
    budget: { total: null, allocated: {}, spent: {}, remaining: null },
    alerts: []
};

let conversationHistory = [
    { role: "system", content: SYSTEM_PROMPT }
];

// DOM Elements
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.querySelector('.sidebar');
const newChatBtn = document.getElementById('new-chat-btn');

// Sidebar Panels
const eventStatePanel = document.getElementById('event-state-panel');
const budgetStatePanel = document.getElementById('budget-state-panel');
const alertsPanel = document.getElementById('alerts-panel');

// Auto-resize textarea
chatInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if (this.scrollHeight > 200) {
        this.style.overflowY = 'auto';
    } else {
        this.style.overflowY = 'hidden';
    }

    sendBtn.disabled = this.value.trim() === '';
});

// Handle Enter key (Shift+Enter for new line)
chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) {
            handleSend();
        }
    }
});

sendBtn.addEventListener('click', handleSend);

mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('active');
});

newChatBtn.addEventListener('click', () => {
    // Reset state
    appState = {
        event: { event_type: null, guests: null, budget: null },
        budget: { total: null, allocated: {}, spent: {}, remaining: null },
        alerts: []
    };
    conversationHistory = [{ role: "system", content: SYSTEM_PROMPT }];

    // Clear UI
    chatMessages.innerHTML = `
        <div class="message assistant">
            <div class="message-avatar">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            <div class="message-content">
                <p>Hi! I'm <strong>EventIQ</strong>, your elite AI Event Planning and Budget Assistant. Are we planning a wedding, a corporate gala, a birthday, or something else? Tell me a bit about what you have in mind!</p>
            </div>
        </div>
    `;
    updateSidebar();
});

async function handleSend() {
    const text = chatInput.value.trim();
    if (!text) return;

    // Reset input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;

    // Add User Message to UI and History
    appendMessage('user', text);
    conversationHistory.push({ role: "user", content: text });

    // Show Loading
    const loadingId = appendLoading();

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama3-70b-8192',
                messages: conversationHistory,
                temperature: 0.7,
                response_format: { type: "json_object" } // Groq supports JSON mode for llama3
            })
        });

        if (!response.ok) {
            throw new Error('API Request Failed');
        }

        const data = await response.json();
        const assistantReplyText = data.choices[0].message.content;

        // Add to history
        conversationHistory.push({ role: "assistant", content: assistantReplyText });

        // Remove loading
        document.getElementById(loadingId).remove();

        // Process response
        processAssistantResponse(assistantReplyText);

    } catch (error) {
        console.error(error);
        document.getElementById(loadingId).remove();
        appendMessage('assistant', "I'm having trouble connecting right now. Please try again.");
    }
}

function processAssistantResponse(rawText) {
    let parsedData = null;

    try {
        // Clean up markdown wrapping if present
        let cleanText = rawText.trim();
        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
        } else if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/```/g, '').trim();
        }
        parsedData = JSON.parse(cleanText);
    } catch (e) {
        console.error("Failed to parse JSON:", e, rawText);
        // Fallback if not valid JSON
        appendMessage('assistant', rawText);
        return;
    }

    // Update state based on response
    if (parsedData.state_update) {
        if (parsedData.state_update.event) {
            Object.keys(parsedData.state_update.event).forEach(key => {
                if (parsedData.state_update.event[key] !== null) {
                    appState.event[key] = parsedData.state_update.event[key];
                }
            });
        }
        if (parsedData.state_update.budget) {
            if (parsedData.state_update.budget.total !== null) appState.budget.total = parsedData.state_update.budget.total;
            if (parsedData.state_update.budget.remaining !== null) appState.budget.remaining = parsedData.state_update.budget.remaining;

            if (parsedData.state_update.budget.allocated) {
                Object.keys(parsedData.state_update.budget.allocated).forEach(key => {
                    if (parsedData.state_update.budget.allocated[key] !== null) {
                        appState.budget.allocated[key] = parsedData.state_update.budget.allocated[key];
                    }
                });
            }
            if (parsedData.state_update.budget.spent) {
                Object.keys(parsedData.state_update.budget.spent).forEach(key => {
                    if (parsedData.state_update.budget.spent[key] !== null) {
                        appState.budget.spent[key] = parsedData.state_update.budget.spent[key];
                    }
                });
            }
        }
    }

    if (parsedData.alerts && Array.isArray(parsedData.alerts)) {
        appState.alerts = parsedData.alerts;
    }

    // Update sidebar
    updateSidebar();

    // Render message in chat
    renderAssistantMessage(parsedData);
}

function renderAssistantMessage(data) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message assistant';

    let contentHtml = `<p class="preserve-ws">${data.reply || ""}</p>`;

    // If there's an expense update
    if (data.type === 'expense' && data.expense_added && data.expense_added.amount > 0) {
        const exp = data.expense_added;
        const cat = exp.category;
        const catSpent = (appState.budget.spent && appState.budget.spent[cat]) || 0;
        const catAlloc = (appState.budget.allocated && appState.budget.allocated[cat]) || 0;

        contentHtml += `
            <div class="expense-card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong><i class="fa-solid fa-check-circle" style="color:var(--success)"></i> Expense Added</strong>
                    <span style="font-size:16px; font-weight:700;">₹${exp.amount.toLocaleString()}</span>
                </div>
                <div style="font-size:13px; color:var(--text-secondary); margin-top:8px;">
                    Category: <strong>${cat}</strong> ${exp.description ? `(${exp.description})` : ''}
                </div>
                <div style="font-size:13px; color:var(--text-secondary); margin-top:4px;">
                    Category Spent: ₹${catSpent.toLocaleString()} / ₹${catAlloc.toLocaleString()}
                </div>
            </div>
        `;
    }

    // If there are insights or tips
    if ((data.insights && data.insights.length > 0) || (data.saving_tips && data.saving_tips.length > 0)) {
        contentHtml += `<div class="info-block">`;

        if (data.insights && data.insights.length > 0) {
            contentHtml += `<h4><i class="fa-solid fa-lightbulb" style="color:var(--warning)"></i> Insights</h4>`;
            contentHtml += `<ul class="insight-list">`;
            data.insights.forEach(insight => {
                contentHtml += `<li>${insight}</li>`;
            });
            contentHtml += `</ul>`;
        }

        if (data.saving_tips && data.saving_tips.length > 0) {
            contentHtml += `<h4 style="margin-top: 15px;"><i class="fa-solid fa-piggy-bank" style="color:var(--success)"></i> Saving Opportunities</h4>`;
            contentHtml += `<ul class="tips-list">`;
            data.saving_tips.forEach(tip => {
                contentHtml += `<li>${tip}</li>`;
            });
            contentHtml += `</ul>`;
        }

        contentHtml += `</div>`;
    }

    msgDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
        </div>
        <div class="message-content">
            ${contentHtml}
        </div>
    `;

    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    const avatarIcon = role === 'user' ? 'fa-user' : 'fa-wand-magic-sparkles';

    msgDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fa-solid ${avatarIcon}"></i>
        </div>
        <div class="message-content">
            <p class="preserve-ws">${text}</p>
        </div>
    `;

    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendLoading() {
    const id = 'loading-' + Date.now();
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message assistant';
    msgDiv.id = id;

    msgDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
        </div>
        <div class="message-content">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;

    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return id;
}

function updateSidebar() {
    // Event State
    if (appState.event && appState.event.event_type) {
        eventStatePanel.classList.remove('empty');
        eventStatePanel.innerHTML = `
            <div class="state-row">
                <span class="state-label">Type</span>
                <span class="state-value">${appState.event.event_type || '-'}</span>
            </div>
            <div class="state-row">
                <span class="state-label">Guests</span>
                <span class="state-value">${appState.event.guests || '-'}</span>
            </div>
        `;
    } else {
        eventStatePanel.classList.add('empty');
        eventStatePanel.innerHTML = `<p class="empty-text">No active event</p>`;
    }

    // Budget State
    if (appState.budget && appState.budget.total > 0) {
        budgetStatePanel.classList.remove('empty');

        const total = appState.budget.total || 0;
        const remaining = appState.budget.remaining !== null ? appState.budget.remaining : total;
        const spent = total - remaining;
        const percentSpent = Math.min(100, Math.max(0, (spent / total) * 100));

        let barClass = '';
        if (percentSpent > 90) barClass = 'danger';
        else if (percentSpent > 75) barClass = 'warning';

        budgetStatePanel.innerHTML = `
            <div class="state-row">
                <span class="state-label">Total</span>
                <span class="state-value" style="color:var(--success)">₹${total.toLocaleString()}</span>
            </div>
            <div class="state-row">
                <span class="state-label">Spent</span>
                <span class="state-value">₹${spent.toLocaleString()}</span>
            </div>
            <div class="budget-bar">
                <div class="budget-fill ${barClass}" style="width: ${percentSpent}%"></div>
            </div>
        `;
    } else {
        budgetStatePanel.classList.add('empty');
        budgetStatePanel.innerHTML = `<p class="empty-text">No budget set</p>`;
    }

    // Alerts
    if (appState.alerts && appState.alerts.length > 0) {
        alertsPanel.classList.remove('empty');
        let alertsHtml = '';
        appState.alerts.forEach(alert => {
            const isDanger = alert.includes('⚠️') || alert.toLowerCase().includes('overspent');
            alertsHtml += `<div class="alert-item ${isDanger ? 'danger' : ''}">${alert}</div>`;
        });
        alertsPanel.innerHTML = alertsHtml;
    } else {
        alertsPanel.classList.add('empty');
        alertsPanel.innerHTML = `<p class="empty-text">No alerts</p>`;
    }
}
