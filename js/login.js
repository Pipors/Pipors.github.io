const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Redirect to app if already logged in
_supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) window.location.href = 'index.html';
});

document.getElementById('btn-login').addEventListener('click', async () => {
  const btn = document.getElementById('btn-login');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-pass').value.trim();
  const errorEl = document.getElementById('login-error');
  
  if (!email || !password) {
    errorEl.textContent = "Please enter both email and password.";
    errorEl.style.display = 'block';
    return;
  }

  btn.textContent = 'Signing in...';
  errorEl.style.display = 'none';

  const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
  
  if (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = 'block';
    btn.textContent = 'Sign In';
  } else {
    window.location.href = 'index.html';
  }
});

// Handle enter key submit
document.addEventListener('keypress', function (e) {
  if (e.key === 'Enter') {
    document.getElementById('btn-login').click();
  }
});