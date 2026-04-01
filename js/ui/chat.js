// js/ui/chat.js - In-game chat drawer

let chatDrawer = null;
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
    if (chatDrawer) {
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
    if (!chatDrawer) createDrawer();
    isOpen = !isOpen;
    chatDrawer.classList.toggle('open', isOpen);
    if (chatDrawer._backdrop) chatDrawer._backdrop.classList.toggle('open', isOpen);
    if (isOpen) {
        unreadCount = 0;
        updateBadge();
        scrollToBottom();
    }
}

export function destroyChat() {
    if (chatDrawer?._backdrop) chatDrawer._backdrop.remove();
    if (chatDrawer) { chatDrawer.remove(); chatDrawer = null; }
    messages = [];
    isOpen = false;
    unreadCount = 0;
}

function createDrawer() {
    // Backdrop for click-outside-to-close
    const backdrop = document.createElement('div');
    backdrop.className = 'chat-backdrop';
    backdrop.addEventListener('click', toggleChat);
    document.body.appendChild(backdrop);

    chatDrawer = document.createElement('div');
    chatDrawer.className = 'chat-drawer';
    chatDrawer._backdrop = backdrop;
    chatDrawer.innerHTML = `
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
    document.body.appendChild(chatDrawer);

    chatDrawer.querySelector('.chat-close').addEventListener('click', toggleChat);

    const input = chatDrawer.querySelector('.chat-input');
    const sendBtn = chatDrawer.querySelector('.chat-send');

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
    const container = chatDrawer?.querySelector('#chat-messages');
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
    const container = chatDrawer?.querySelector('#chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
}

function updateBadge() {
    const badge = document.querySelector('.chat-badge');
    if (badge) {
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? '' : 'none';
    }
}
