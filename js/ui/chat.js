// js/ui/chat.js - In-game chat bubble window

let chatBubble = null;
let messages = [];
let onSend = null;
let isOpen = false;
let unreadCount = 0;

export function initChat(sendHandler) {
    onSend = sendHandler;
    messages = [];
    unreadCount = 0;
}

export function addMessage(msg) {
    messages.push(msg);
    if (chatBubble) {
        renderMessages();
        scrollToBottom();
    }
    if (!isOpen) {
        unreadCount++;
        updateBadge();
    }
}

export function getUnreadCount() { return unreadCount; }

export function toggleChat() {
    if (!chatBubble) createBubble();
    isOpen = !isOpen;
    chatBubble.classList.toggle('open', isOpen);
    if (chatBubble._backdrop) chatBubble._backdrop.classList.toggle('open', isOpen);
    if (isOpen) {
        unreadCount = 0;
        updateBadge();
        scrollToBottom();
        // Auto-focus input on desktop
        if (window.innerWidth > 1024) {
            setTimeout(() => {
                const input = chatBubble?.querySelector('.chat-input');
                if (input) input.focus();
            }, 150);
        }
    }
}

export function destroyChat() {
    if (chatBubble?._backdrop) chatBubble._backdrop.remove();
    if (chatBubble) { chatBubble.remove(); chatBubble = null; }
    messages = [];
    isOpen = false;
    unreadCount = 0;
}

function createBubble() {
    // Backdrop for click-outside-to-close
    const backdrop = document.createElement('div');
    backdrop.className = 'chat-backdrop';
    backdrop.addEventListener('click', toggleChat);
    document.body.appendChild(backdrop);

    chatBubble = document.createElement('div');
    chatBubble.className = 'chat-bubble';
    chatBubble._backdrop = backdrop;
    chatBubble.innerHTML = `
        <div class="chat-header">
            <span>Chat</span>
            <button class="chat-close">&times;</button>
        </div>
        <div class="chat-messages" id="chat-messages"></div>
        <div class="chat-input-bar">
            <input type="text" class="chat-input" placeholder="Message..." maxlength="500" autocomplete="off" style="font-size:16px;">
            <button class="chat-send">Send</button>
        </div>
    `;
    document.body.appendChild(chatBubble);

    chatBubble.querySelector('.chat-close').addEventListener('click', toggleChat);

    const input = chatBubble.querySelector('.chat-input');
    const sendBtn = chatBubble.querySelector('.chat-send');

    function send() {
        const text = input.value.trim();
        if (!text || !onSend) return;
        onSend(text);
        input.value = '';
    }

    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

    renderMessages();
}

function renderMessages() {
    const container = chatBubble?.querySelector('#chat-messages');
    if (!container) return;
    container.innerHTML = '';
    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'chat-msg';
        const name = document.createElement('span');
        name.className = 'chat-msg-name';
        name.textContent = msg.from;
        const text = document.createElement('span');
        text.className = 'chat-msg-text';
        text.textContent = msg.message;
        div.appendChild(name);
        div.appendChild(text);
        container.appendChild(div);
    });
}

function scrollToBottom() {
    const container = chatBubble?.querySelector('#chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
}

function updateBadge() {
    // Update all badge instances (header + floating tab)
    document.querySelectorAll('.chat-badge, .chat-float-badge').forEach(badge => {
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? '' : 'none';
    });
}
