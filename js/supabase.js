// Creates the single Supabase client. Only the PUBLIC anon key is ever used here.
// Values come from /env.js, which the local server builds from .env.
(() => {
  'use strict';

  const env = window.__ENV || {};
  const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];
  let url = String(env.SUPABASE_URL || '').trim();
  const anonKey = String(env.SUPABASE_ANON_KEY || '').trim();
  let configError = '';
  let client = null;

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    configError = 'The Supabase library did not load. Check your internet connection (it loads from a CDN) and refresh.';
  } else if (!url || !anonKey) {
    configError = 'Supabase is not configured. Copy .env.example to .env, add the anon key from `supabase status`, then restart the server.';
  } else {
    try {
      const target = new URL(url);
      // Testing from a phone: "127.0.0.1" would point at the phone itself, so use the computer's address.
      if (LOCAL_HOSTS.includes(target.hostname) && location.hostname && !LOCAL_HOSTS.includes(location.hostname)) {
        target.hostname = location.hostname;
        url = target.toString().replace(/\/$/, '');
      }
      client = window.supabase.createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
    } catch (error) {
      configError = `Could not start the Supabase client (check SUPABASE_URL in .env): ${error.message}`;
    }
  }

  function friendlyError(error, options = {}) {
    if (!error) return new Error('Something went wrong.');
    const message = String(error.message || '');
    const code = String(error.code || '');
    let text = message || 'Something went wrong.';
    let sessionExpired = false;

    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      text = 'Cannot reach local Supabase. Make sure Docker Desktop is running and `supabase start` has finished.';
    } else if (/invalid login credentials/i.test(message)) {
      text = 'Incorrect email or password.';
    } else if (/already registered|user_already_exists/i.test(`${message} ${code}`)) {
      text = 'That email address is already registered.';
    } else if (code === 'PGRST301' || /jwt expired|invalid jwt/i.test(message)) {
      text = 'Your session expired. Please log in again.';
      sessionExpired = true;
    } else if (code === '23505') {
      text = options.duplicate || 'A matching record already exists.';
    } else if (code === '23514') {
      text = 'One of the values is not allowed. Please check the form and try again.';
    } else if (code === '23503') {
      text = 'This record is linked to other data and cannot be changed that way.';
    } else if (code === '42501' || /row-level security|permission denied/i.test(message)) {
      text = 'You do not have permission to do that.';
    } else if (code === '22P02' || code === '22003') {
      text = 'One of the submitted values is invalid.';
    }

    const result = new Error(text);
    result.code = code;
    result.sessionExpired = sessionExpired;
    return result;
  }

  window.CJude = {
    configError,
    url,
    friendlyError,
    client() {
      if (!client) throw new Error(configError || 'Supabase is not available.');
      return client;
    }
  };
})();
