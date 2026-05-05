// Supabase configuration
// These keys are public-facing (anon key) — safe to expose in client-side code.
// Security is enforced via Row Level Security policies in Supabase.

const SUPABASE_URL = 'https://ujybfrqxbvzjxdywyaer.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqeWJmcnF4YnZ6anhkeXd5YWVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTc5NTcsImV4cCI6MjA5MzU3Mzk1N30.b-k1m08Jn_SKkjH2e64LBlpNoVgsY_9seUH5C4A7rEY';

// Initialize the Supabase client (loaded via CDN in HTML)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Get logged-in user (from sessionStorage — survives refreshes, clears on tab close)
function getCurrentUser() {
  const username = sessionStorage.getItem('chat_username');
  return username || null;
}

function setCurrentUser(username) {
  sessionStorage.setItem('chat_username', username);
}

function clearCurrentUser() {
  sessionStorage.removeItem('chat_username');
}
