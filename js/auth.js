// Authentication helpers built on Supabase Auth. Roles live in public.profiles.
(() => {
  'use strict';
  const C = window.CJude;
  const sb = () => C.client();
  // The UI calls the customer role "consumer".
  const ROLE_TO_UI = { customer: 'consumer', owner: 'owner' };
  let recoveryActive = new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';
  let recoveryCallback = null;

  if (!C.configError) {
    sb().auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveryActive = true;
        if (recoveryCallback) recoveryCallback();
      }
    });
  }

  async function loadProfile(userId) {
    const { data, error } = await sb().from('profiles').select('id, name, email, role').eq('id', userId).maybeSingle();
    if (error) throw C.friendlyError(error);
    if (!data) throw new Error('Your account profile was not found. Please contact the store owner.');
    return { id: data.id, name: data.name, email: data.email, role: ROLE_TO_UI[data.role] || 'consumer' };
  }

  window.CJude.auth = {
    isPasswordRecovery() { return recoveryActive; },

    onPasswordRecovery(callback) {
      recoveryCallback = callback;
      if (recoveryActive) callback();
    },

    async signUp({ name, email, password }) {
      const { data, error } = await sb().auth.signUp({ email, password, options: { data: { name } } });
      if (error) throw C.friendlyError(error);
      // Supabase returns a user with no identities when the email already exists (confirmations on).
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error('That email address is already registered.');
      }
      // The demo flow asks people to log in after signing up.
      if (data.session) await sb().auth.signOut();
    },

    async sendPasswordReset(email) {
      const { error } = await sb().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${window.location.pathname}`
      });
      if (error) throw C.friendlyError(error);
    },

    async updatePassword(password) {
      const { data, error } = await sb().auth.updateUser({ password });
      if (error) throw C.friendlyError(error);
      if (!data.user) throw new Error('Your password was not updated. Please request a new reset link.');
      const profile = await loadProfile(data.user.id);
      recoveryActive = false;
      window.history.replaceState(window.history.state, '', window.location.pathname);
      return profile;
    },

    async signIn(email, password) {
      const { data, error } = await sb().auth.signInWithPassword({ email, password });
      if (error) throw C.friendlyError(error);
      try {
        return await loadProfile(data.user.id);
      } catch (profileError) {
        await sb().auth.signOut();
        throw profileError;
      }
    },

    async restoreSession() {
      if (C.configError) return null;
      const { data, error } = await sb().auth.getSession();
      if (error || !data.session) return null;
      try {
        return await loadProfile(data.session.user.id);
      } catch {
        return null;
      }
    },

    async signOut() {
      const { error } = await sb().auth.signOut();
      if (error) throw C.friendlyError(error);
    },

    onSignedOut(callback) {
      if (C.configError) return;
      sb().auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') callback(); });
    }
  };
})();
