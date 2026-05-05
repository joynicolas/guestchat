// chat.js — main chat orchestration

// ============================================================
// AUTH GUARD
// ============================================================
const me = getCurrentUser();
if (!me) {
  window.location.href = 'index.html';
}

// ============================================================
// STATE
// ============================================================
let currentRoom = { type: 'global', peer: null };
// type: 'global' | 'private'
// peer: username (only for private)

let messages = [];
let messageChannel = null;
let recentChats = new Set();
let unreadCounts = {}; // peer -> count
let allUsersCache = new Map(); // username -> { username, last_seen }

// ============================================================
// DOM
// ============================================================
const $ = (id) => document.getElementById(id);
const messagesArea = $('messages-area');
const messageInput = $('message-input');
const sendBtn = $('send-btn');
const chatTitle = $('chat-title');
const chatSub = $('chat-sub');
const chatAvatar = $('chat-avatar');
const onlineList = $('online-users');
const onlineCount = $('online-count');
const recentList = $('recent-chats');
const searchInput = $('search-input');
const searchClear = $('search-clear');
const searchResults = $('search-results');
const searchLabel = $('search-label');
const recentLabel = $('recent-label');
const globalRoomBtn = $('global-room-btn');
const logoutBtn = $('logout-btn');
const fileInput = $('file-input');
const uploadBtn = $('upload-btn');
const uploadPreview = $('upload-preview');
const uploadFilename = $('upload-filename');
const uploadCancel = $('upload-cancel');
const uploadProgress = $('upload-progress');
const uploadProgressBar = $('upload-progress-bar');
const uploadProgressText = $('upload-progress-text');
const lightbox = $('lightbox');
const lightboxContent = $('lightbox-content');
const lightboxClose = $('lightbox-close');

// Mobile UI
const menuBtn = $('menu-btn');
const backBtn = $('back-btn');
const sidebarEl = document.querySelector('.sidebar');
const sidebarOverlay = $('sidebar-overlay');

const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

function openSidebar() {
  sidebarEl.classList.add('open');
  sidebarOverlay.classList.add('visible');
}
function closeSidebar() {
  sidebarEl.classList.remove('open');
  sidebarOverlay.classList.remove('visible');
}
function updateMobileNav() {
  if (!isMobile()) {
    backBtn.style.display = 'none';
    menuBtn.style.display = '';
    return;
  }
  // In private chat → show back arrow instead of hamburger
  if (currentRoom.type === 'private') {
    menuBtn.style.display = 'none';
    backBtn.style.display = 'flex';
  } else {
    backBtn.style.display = 'none';
    menuBtn.style.display = 'flex';
  }
}

// ============================================================
// INIT
// ============================================================
function init() {
  $('my-username').textContent = me;
  $('my-avatar').textContent = me[0];

  PresenceManager.onChange(renderOnlineUsers);
  PresenceManager.start(me);

  loadRecentChats();
  switchToGlobal();
  subscribeToMessages();

  bindEvents();
  updateMobileNav();
}

// ============================================================
// MESSAGE FETCHING
// ============================================================
async function loadMessages() {
  let query = supabaseClient
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(200);

  if (currentRoom.type === 'global') {
    query = query.is('recipient_username', null);
  } else {
    // Private: messages where (me<->peer) in either direction
    query = query.or(
      `and(sender_username.eq.${me},recipient_username.eq.${currentRoom.peer}),` +
      `and(sender_username.eq.${currentRoom.peer},recipient_username.eq.${me})`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error('load messages failed', error);
    return;
  }
  messages = data || [];
  renderMessages();
}

// ============================================================
// REALTIME SUBSCRIPTION (single channel for all messages)
// ============================================================
function subscribeToMessages() {
  messageChannel = supabaseClient
    .channel('messages-stream')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages' },
      handleRealtimeMessage
    )
    .subscribe();
}

function handleRealtimeMessage(payload) {
  const evt = payload.eventType;
  const row = payload.new || payload.old;

  if (evt === 'INSERT') {
    onNewMessage(payload.new);
  } else if (evt === 'UPDATE') {
    onUpdatedMessage(payload.new);
  }
}

function onNewMessage(msg) {
  // Decide if this message belongs in the currently open room
  const inCurrent =
    (currentRoom.type === 'global' && msg.recipient_username === null) ||
    (currentRoom.type === 'private' &&
      ((msg.sender_username === me && msg.recipient_username === currentRoom.peer) ||
        (msg.sender_username === currentRoom.peer && msg.recipient_username === me)));

  if (inCurrent) {
    messages.push(msg);
    renderMessages();
    return;
  }

  // Not in current room — if it's a private message TO me, mark unread
  if (msg.recipient_username === me && msg.sender_username !== me) {
    const peer = msg.sender_username;
    unreadCounts[peer] = (unreadCounts[peer] || 0) + 1;
    recentChats.add(peer);
    saveRecentChats();
    renderRecentChats();
  }
}

function onUpdatedMessage(msg) {
  const idx = messages.findIndex(m => m.id === msg.id);
  if (idx >= 0) {
    messages[idx] = msg;
    renderMessages();
  }
}

// ============================================================
// RENDER MESSAGES
// ============================================================
function renderMessages() {
  const empty = $('empty-state');
  if (!messages.length) {
    if (empty) empty.style.display = 'flex';
    messagesArea.innerHTML = '';
    if (empty) messagesArea.appendChild(empty);
    return;
  }

  messagesArea.innerHTML = '';
  let lastDate = null;

  messages.forEach(msg => {
    const date = new Date(msg.created_at);
    const dateStr = formatDay(date);
    if (dateStr !== lastDate) {
      const div = document.createElement('div');
      div.className = 'day-divider';
      div.textContent = dateStr;
      messagesArea.appendChild(div);
      lastDate = dateStr;
    }
    messagesArea.appendChild(renderMessage(msg));
  });

  // Scroll to bottom
  requestAnimationFrame(() => {
    messagesArea.scrollTop = messagesArea.scrollHeight;
  });
}

function renderMessage(msg) {
  const wrap = document.createElement('div');
  wrap.className = 'msg' + (msg.sender_username === me ? ' mine' : '');
  wrap.dataset.id = msg.id;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = msg.sender_username[0].toUpperCase();

  const body = document.createElement('div');
  body.className = 'msg-body';

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  const author = document.createElement('span');
  author.className = 'msg-author';
  author.textContent = msg.sender_username === me ? 'you' : msg.sender_username;
  const time = document.createElement('span');
  time.className = 'msg-time';
  time.textContent = formatTime(new Date(msg.created_at));
  meta.appendChild(author);
  meta.appendChild(time);
  body.appendChild(meta);

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  if (msg.deleted) {
    bubble.innerHTML = '<span class="msg-deleted">message deleted</span>';
  } else if (msg.media_url) {
    bubble.classList.add('media-bubble');
    if (msg.media_type === 'image') {
      const img = document.createElement('img');
      img.src = msg.media_url;
      img.className = 'msg-media';
      img.loading = 'lazy';
      img.addEventListener('click', () => openLightbox(msg.media_url, 'image'));
      bubble.appendChild(img);
    } else if (msg.media_type === 'video') {
      const vid = document.createElement('video');
      vid.src = msg.media_url;
      vid.className = 'msg-media';
      vid.controls = true;
      vid.preload = 'metadata';
      bubble.appendChild(vid);
    }
    if (msg.content) {
      const cap = document.createElement('div');
      cap.className = 'msg-caption';
      cap.textContent = msg.content;
      bubble.appendChild(cap);
    }
  } else {
    bubble.textContent = msg.content || '';
  }

  // Actions: only my own non-deleted messages can be deleted
  if (msg.sender_username === me && !msg.deleted) {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    const delBtn = document.createElement('button');
    delBtn.className = 'msg-action-btn';
    delBtn.textContent = 'delete';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteMessage(msg);
    });
    actions.appendChild(delBtn);
    bubble.appendChild(actions);
  }

  body.appendChild(bubble);
  wrap.appendChild(avatar);
  wrap.appendChild(body);

  // Click on user's name in global to open private
  if (currentRoom.type === 'global' && msg.sender_username !== me) {
    author.style.cursor = 'pointer';
    author.style.textDecoration = 'underline';
    author.style.textDecorationStyle = 'dotted';
    author.addEventListener('click', () => switchToPrivate(msg.sender_username));
  }

  return wrap;
}

// ============================================================
// SEND
// ============================================================
async function sendMessage() {
  const text = messageInput.value.trim();
  const file = UploadManager.pendingFile;

  if (!text && !file) return;

  sendBtn.disabled = true;

  let mediaInfo = null;
  if (file) {
    try {
      uploadProgress.style.display = 'flex';
      uploadProgressText.textContent = 'uploading...';
      uploadProgressBar.style.setProperty('--progress', '20%');
      mediaInfo = await UploadManager.upload(file, me, (pct) => {
        uploadProgressBar.style.setProperty('--progress', pct + '%');
      });
      uploadProgress.style.display = 'none';
    } catch (err) {
      uploadProgress.style.display = 'none';
      alert('upload failed: ' + err.message);
      sendBtn.disabled = false;
      return;
    }
  }

  const row = {
    sender_username: me,
    recipient_username: currentRoom.type === 'private' ? currentRoom.peer : null,
    content: text || null,
    media_url: mediaInfo ? mediaInfo.url : null,
    media_type: mediaInfo ? mediaInfo.type : null
  };

  const { error } = await supabaseClient.from('messages').insert([row]);

  if (error) {
    alert('send failed: ' + error.message);
  } else {
    messageInput.value = '';
    autoResize();
    clearPendingFile();
    if (currentRoom.type === 'private') {
      recentChats.add(currentRoom.peer);
      saveRecentChats();
      renderRecentChats();
    }
  }
  sendBtn.disabled = false;
  messageInput.focus();
}

// ============================================================
// DELETE
// ============================================================
async function deleteMessage(msg) {
  if (!confirm('delete this message?')) return;

  // If media, also delete from storage
  if (msg.media_url) {
    const path = UploadManager.extractPath(msg.media_url);
    if (path) {
      try { await UploadManager.delete(path); } catch (e) { console.warn('media delete failed', e); }
    }
  }

  const { error } = await supabaseClient
    .from('messages')
    .update({ deleted: true, content: null, media_url: null, media_type: null })
    .eq('id', msg.id)
    .eq('sender_username', me); // safety: only own messages

  if (error) alert('delete failed: ' + error.message);
}

// ============================================================
// ROOM SWITCHING
// ============================================================
function switchToGlobal() {
  currentRoom = { type: 'global', peer: null };
  chatTitle.textContent = 'global chatroom';
  chatSub.textContent = "everyone's here";
  chatAvatar.textContent = '◉';
  globalRoomBtn.classList.add('active');
  document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
  closeSidebar();
  updateMobileNav();
  loadMessages();
}

function switchToPrivate(peer) {
  if (peer === me) return;
  currentRoom = { type: 'private', peer };
  chatTitle.textContent = peer;
  chatSub.textContent = PresenceManager.isOnline(peer) ? 'online' : 'offline — they\'ll see your messages later';
  chatAvatar.textContent = peer[0].toUpperCase();
  globalRoomBtn.classList.remove('active');

  // Clear unread for this peer
  delete unreadCounts[peer];
  recentChats.add(peer);
  saveRecentChats();
  renderRecentChats();
  renderOnlineUsers(PresenceManager.getOnline());
  renderSearchResults(); // re-mark active

  // Highlight in lists
  document.querySelectorAll('.user-item').forEach(el => {
    el.classList.toggle('active', el.dataset.username === peer);
  });

  closeSidebar();
  updateMobileNav();
  loadMessages();
}

// ============================================================
// ONLINE USERS RENDER
// ============================================================
function renderOnlineUsers(users) {
  const others = users.filter(u => u !== me);
  onlineCount.textContent = others.length;

  if (!others.length) {
    onlineList.innerHTML = '<li class="empty-list">no one else online</li>';
    return;
  }

  onlineList.innerHTML = '';
  others.forEach(u => {
    onlineList.appendChild(makeUserItem(u, true));
  });

  // Refresh status sub-text if we're in a private chat
  if (currentRoom.type === 'private') {
    chatSub.textContent = PresenceManager.isOnline(currentRoom.peer)
      ? 'online'
      : 'offline — they\'ll see your messages later';
  }
}

function makeUserItem(username, online) {
  const li = document.createElement('li');
  li.className = 'user-item';
  li.dataset.username = username;
  if (currentRoom.type === 'private' && currentRoom.peer === username) {
    li.classList.add('active');
  }

  const av = document.createElement('div');
  av.className = 'user-avatar' + (online ? ' online' : '');
  av.textContent = username[0].toUpperCase();

  const name = document.createElement('div');
  name.className = 'user-name';
  name.textContent = username;

  li.appendChild(av);
  li.appendChild(name);

  const count = unreadCounts[username];
  if (count) {
    const badge = document.createElement('div');
    badge.className = 'unread-badge';
    badge.textContent = count > 9 ? '9+' : count;
    li.appendChild(badge);
  }

  li.addEventListener('click', () => switchToPrivate(username));
  return li;
}

// ============================================================
// RECENT CHATS (localStorage)
// ============================================================
function loadRecentChats() {
  try {
    const stored = localStorage.getItem('recent_' + me);
    if (stored) {
      JSON.parse(stored).forEach(u => recentChats.add(u));
    }
  } catch (e) {}
  renderRecentChats();
}
function saveRecentChats() {
  localStorage.setItem('recent_' + me, JSON.stringify(Array.from(recentChats)));
}
function renderRecentChats() {
  const list = Array.from(recentChats).filter(u => u !== me);
  if (!list.length) {
    recentList.innerHTML = '<li class="empty-list">no recent chats yet</li>';
    return;
  }
  recentList.innerHTML = '';
  list.forEach(u => recentList.appendChild(makeUserItem(u, PresenceManager.isOnline(u))));
}

// ============================================================
// SEARCH
// ============================================================
let searchTimeout = null;
function onSearchInput() {
  const q = searchInput.value.trim().toLowerCase();
  searchClear.style.display = q ? 'block' : 'none';

  clearTimeout(searchTimeout);
  if (!q) {
    searchResults.innerHTML = '';
    searchLabel.style.display = 'none';
    recentLabel.style.display = 'flex';
    recentList.style.display = 'block';
    return;
  }

  searchTimeout = setTimeout(() => doSearch(q), 250);
}

async function doSearch(q) {
  searchLabel.style.display = 'flex';
  recentLabel.style.display = 'none';
  recentList.style.display = 'none';
  searchResults.innerHTML = '<li class="empty-list">searching...</li>';

  const { data, error } = await supabaseClient
    .from('users')
    .select('username')
    .ilike('username', `%${q}%`)
    .neq('username', me)
    .limit(20);

  if (error) {
    searchResults.innerHTML = '<li class="empty-list">search failed</li>';
    return;
  }

  if (!data.length) {
    searchResults.innerHTML = '<li class="empty-list">no users found</li>';
    return;
  }

  searchResults.innerHTML = '';
  data.forEach(u => {
    searchResults.appendChild(makeUserItem(u.username, PresenceManager.isOnline(u.username)));
  });
}

function renderSearchResults() {
  if (searchInput.value.trim()) doSearch(searchInput.value.trim().toLowerCase());
}

// ============================================================
// FILE UPLOAD UI
// ============================================================
function setPendingFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    alert('file too big — max 10 MB');
    return;
  }
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    alert('only images and videos');
    return;
  }
  UploadManager.pendingFile = file;
  uploadFilename.textContent = file.name;
  uploadPreview.style.display = 'flex';
}
function clearPendingFile() {
  UploadManager.pendingFile = null;
  uploadPreview.style.display = 'none';
  fileInput.value = '';
}

// ============================================================
// LIGHTBOX
// ============================================================
function openLightbox(url, type) {
  lightboxContent.innerHTML = '';
  if (type === 'image') {
    const img = document.createElement('img');
    img.src = url;
    lightboxContent.appendChild(img);
  } else {
    const vid = document.createElement('video');
    vid.src = url;
    vid.controls = true;
    vid.autoplay = true;
    lightboxContent.appendChild(vid);
  }
  lightbox.style.display = 'flex';
}
function closeLightbox() {
  lightbox.style.display = 'none';
  lightboxContent.innerHTML = '';
}

// ============================================================
// HELPERS
// ============================================================
function formatTime(d) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}
function formatDay(d) {
  const today = new Date();
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'today';
  if (d.toDateString() === y.toDateString()) return 'yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
function autoResize() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 140) + 'px';
}

// ============================================================
// EVENTS
// ============================================================
function bindEvents() {
  sendBtn.addEventListener('click', sendMessage);
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  messageInput.addEventListener('input', autoResize);

  globalRoomBtn.addEventListener('click', switchToGlobal);

  searchInput.addEventListener('input', onSearchInput);
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    onSearchInput();
  });

  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) setPendingFile(f);
  });
  uploadCancel.addEventListener('click', clearPendingFile);

  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.style.display !== 'none') closeLightbox();
  });

  logoutBtn.addEventListener('click', async () => {
    if (!confirm('log out?')) return;
    PresenceManager.stop();
    if (messageChannel) supabaseClient.removeChannel(messageChannel);
    clearCurrentUser();
    window.location.href = 'index.html';
  });

  // Mobile: hamburger opens sidebar
  menuBtn.addEventListener('click', openSidebar);

  // Mobile: back arrow goes from private chat → global
  backBtn.addEventListener('click', switchToGlobal);

  // Mobile: tap overlay to close sidebar
  sidebarOverlay.addEventListener('click', closeSidebar);

  // Update mobile nav on resize (e.g. rotation)
  window.addEventListener('resize', updateMobileNav);

  window.addEventListener('beforeunload', () => {
    PresenceManager.stop();
  });
}

// Go!
init();
