// auth.js — handles guest login & first-time signup

// If already logged in, skip straight to chat
if (getCurrentUser()) {
  window.location.href = 'chat.html';
}

const form = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const pinInput = document.getElementById('pin');
const submitBtn = document.getElementById('submit-btn');
const statusMsg = document.getElementById('status-msg');

function setStatus(text, type = 'info') {
  statusMsg.textContent = text;
  statusMsg.className = 'status-msg ' + type;
}

// Only allow digits in pin field
pinInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
});

// Trim whitespace from username, keep only allowed chars
usernameInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = usernameInput.value.trim().toLowerCase();
  const pin = pinInput.value.trim();

  if (username.length < 3) {
    setStatus('username must be at least 3 characters', 'error');
    return;
  }
  if (!/^\d{6}$/.test(pin)) {
    setStatus('pin must be exactly 6 digits', 'error');
    return;
  }

  submitBtn.disabled = true;
  setStatus('checking...', 'info');

  try {
    // Look up the user
    const { data: existing, error: lookupErr } = await supabaseClient
      .from('users')
      .select('username, pin')
      .eq('username', username)
      .maybeSingle();

    if (lookupErr) throw lookupErr;

    if (existing) {
      // User exists — verify pin
      if (existing.pin === pin) {
        setStatus('welcome back, ' + username, 'success');
        setCurrentUser(username);
        setTimeout(() => window.location.href = 'chat.html', 400);
      } else {
        setStatus('wrong pin for that name', 'error');
        submitBtn.disabled = false;
      }
    } else {
      // New user — create the account
      const { error: insertErr } = await supabaseClient
        .from('users')
        .insert([{ username, pin }]);

      if (insertErr) {
        // Race condition: someone else just took this name
        if (insertErr.code === '23505') {
          setStatus('that name was just taken, try another', 'error');
        } else {
          throw insertErr;
        }
        submitBtn.disabled = false;
        return;
      }

      setStatus('account created — entering...', 'success');
      setCurrentUser(username);
      setTimeout(() => window.location.href = 'chat.html', 500);
    }
  } catch (err) {
    console.error(err);
    setStatus('something went wrong: ' + err.message, 'error');
    submitBtn.disabled = false;
  }
});
