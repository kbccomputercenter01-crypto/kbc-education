/* Real Supabase Auth + own-profile queries. Database policies enforce authorization. */
(() => {
  'use strict';
  const client = window.kbcSupabase;
  const rules = window.KBCAuthRules;
  const page = document.body.dataset.authPage;
  const requiredRole = document.body.dataset.requiredRole;
  const form = document.querySelector('[data-auth-form]');
  const status = document.querySelector('[data-auth-status]') || document.querySelector('[data-account-status]');
  const content = document.querySelector('[data-protected-content]');
  const gate = document.querySelector('[data-auth-gate]');
  const profileColumns = 'id,full_name,email,phone,role,created_at,updated_at';
  let identity = null;
  let busy = false;
  let revision = 0;
  let recoveryReady = window.kbcRecoveryReady;
  let resetCompleted = false;
  let initializing = true;

  const message = (text, error = false) => {
    if (!status) return;
    status.textContent = text;
    status.classList.toggle('auth-error', error);
  };
  const lock = () => {
    if (content) content.hidden = true;
    if (gate) gate.hidden = false;
  };
  const route = (file) => window.location.replace(new URL(file, window.location.href).href);
  const errorText = (error) => {
    if (error?.code === 'invalid_credentials') return 'Email or password is incorrect.';
    if (error?.code === 'email_not_confirmed') return 'Verify your email before signing in.';
    if (error?.status === 429 || error?.code?.includes('rate_limit')) return 'Too many attempts. Please wait before trying again.';
    if (error?.code === 'PGRST205' || error?.code === 'PGRST202') return 'The institute must finish the portal database setup before you can continue.';
    if (error?.code === '23505') return 'An account already exists. Try signing in or resetting your password.';
    return 'Unable to complete this request. Check your connection and try again, or contact KBC.';
  };
  const setBusy = (value) => {
    busy = value;
    if (form) {
      form.setAttribute('aria-busy', String(value));
      form.querySelector('button[type="submit"]').disabled = value || (page === 'reset' && !recoveryReady);
    }
  };
  const readIdentity = async () => {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) return null;
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    if (!userData.user || !userData.user.email_confirmed_at) {
      throw Object.assign(new Error('Email not confirmed'), { code: 'email_not_confirmed' });
    }
    const { data: profile, error } = await client.from('profiles').select(profileColumns).eq('id', userData.user.id).single();
    if (error) throw error;
    if (!profile || !['student', 'teacher', 'admin'].includes(profile.role)) throw new Error('Profile unavailable');
    return { user: userData.user, profile };
  };
  const updateNavigation = () => {
    document.querySelectorAll('[data-account-nav]').forEach((nav) => {
      nav.querySelectorAll('[data-signed-out-link]').forEach((link) => { link.hidden = !!identity; });
      const dashboard = nav.querySelector('[data-dashboard-link]');
      const logout = nav.querySelector('[data-logout]');
      const unavailable = nav.querySelector('[data-admin-unavailable]');
      const target = rules.dashboard(identity?.profile.role);
      dashboard.hidden = !target;
      if (target) dashboard.href = target;
      logout.hidden = !identity;
      if (unavailable) unavailable.hidden = !identity || !!target;
    });
  };
  const fillProfile = (profile, overwrite = false) => {
    document.querySelectorAll('[data-profile-name]').forEach((el) => { el.textContent = profile.full_name || 'Your profile'; });
    document.querySelectorAll('[data-profile-email]').forEach((el) => { el.textContent = profile.email; });
    document.querySelectorAll('[data-profile-phone]').forEach((el) => { el.textContent = profile.phone || 'Not provided'; });
    const edit = document.querySelector('[data-profile-form]');
    if (edit && (overwrite || edit.dataset.userId !== profile.id)) {
      edit.elements.namedItem('full_name').value = profile.full_name;
      edit.elements.namedItem('phone').value = profile.phone;
      edit.dataset.userId = profile.id;
    }
  };
  const refresh = async () => {
    const run = ++revision;
    try {
      const result = await readIdentity();
      if (run !== revision) return;
      identity = result;
      updateNavigation();
      if (requiredRole) {
        if (!identity) { lock(); route(`${requiredRole}-login.html?notice=session`); return; }
        if (identity.profile.role !== requiredRole) {
          lock();
          route(identity.profile.role === 'admin' ? 'student-login.html?notice=admin' : `${identity.profile.role}-login.html?notice=role`);
          return;
        }
        fillProfile(identity.profile);
        document.querySelector('[data-profile-fields]').disabled = false;
        if (gate) gate.hidden = true;
        content.hidden = false;
      } else if (['student-login', 'teacher-login', 'register'].includes(page) && identity) {
        const target = rules.dashboard(identity.profile.role);
        const selectedCourse = sessionStorage.getItem('kbc-selected-course');
        if (identity.profile.role === 'student' && ['ccc','dca','dfa','adca','c-plus','typing-master','prime-tally','tally-erp','dctt'].includes(selectedCourse)) route('enroll.html');
        else if (target) route(target);
        else message('This account has an admin role. The admin portal is not available in this phase.', true);
      }
    } catch (error) {
      if (run !== revision) return;
      lock();
      identity = null;
      updateNavigation();
      if (error?.status === 401 || error?.code === 'refresh_token_not_found' || error?.code === 'refresh_token_already_used') {
        await client.auth.signOut({ scope: 'local' });
        if (requiredRole) route(`${requiredRole}-login.html?notice=session`);
      } else message(errorText(error), true);
    }
  };
  const ensureSetup = async () => {
    const { data, error } = await client.rpc('kbc_auth_ready');
    if (error) throw error;
    if (data !== true) throw new Error('Portal unavailable');
  };
  const enableRecovery = () => {
    recoveryReady = true;
    if (page !== 'reset') return;
    form.hidden = false;
    setBusy(false);
    message('Your recovery link is verified. Choose a new password.');
  };

  if (!client || !rules) {
    lock();
    message('The sign-in service could not load. Check your connection and reload this page.', true);
    if (form) form.querySelector('button[type="submit"]').disabled = true;
    return;
  }
  if (form) form.querySelector('[data-auth-fields]').disabled = false;
  client.auth.onAuthStateChange((event) => {
    // Do not await Auth calls inside this callback (Supabase's session lock).
    if (event === 'PASSWORD_RECOVERY') enableRecovery();
    if (event === 'SIGNED_OUT') {
      identity = null;
      recoveryReady = false;
      revision++;
      updateNavigation();
      lock();
      if (page === 'reset') { form.hidden = true; if (!resetCompleted) message('Request a new recovery link to reset your password.'); }
      if (requiredRole) route(`${requiredRole}-login.html`);
    }
    if (!initializing && !busy && !['INITIAL_SESSION','PASSWORD_RECOVERY','SIGNED_OUT'].includes(event)) {
      setTimeout(refresh, 0);
    }
  });
  document.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    lock();
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      identity = null;
      updateNavigation();
      if (requiredRole) route(`${requiredRole}-login.html?notice=logout`);
    } catch { message('Unable to sign out. Please try again.', true); }
    finally { button.disabled = false; }
  }));
  document.querySelector('[data-auth-retry]')?.addEventListener('click', refresh);
  if (requiredRole) {
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    window.addEventListener('pageshow', (event) => { if (event.persisted) { lock(); refresh(); } });
    window.addEventListener('pagehide', lock);
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    message('');
    const field = (name) => form.elements.namedItem(name)?.value || '';
    const email = field('email').trim();
    if (!form.reportValidity()) return;
    setBusy(true);
    try {
      if (page === 'register') {
        const input = { fullName: field('full_name'), email, phone: field('phone'), password: field('password'), confirm: field('confirm') };
        const invalid = rules.registration(input);
        if (invalid) { message(invalid, true); return; }
        await ensureSetup();
        const { data, error } = await client.auth.signUp({ email, password: input.password,
          options: { emailRedirectTo: new URL('student-login.html', window.location.href).href,
            data: { full_name: input.fullName.trim(), phone: rules.normalizePhone(input.phone) } } });
        if (error) throw error;
        form.reset();
        if (data.session) await refresh();
        else message('Check your email to verify your account, then sign in. If you already registered, use Login or Forgot Password.');
      } else if (page === 'student-login' || page === 'teacher-login') {
        await ensureSetup();
        const { error } = await client.auth.signInWithPassword({ email, password: field('password') });
        if (error) throw error;
        form.elements.namedItem('password').value = '';
        await refresh();
      } else if (page === 'forgot') {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: new URL('reset-password.html', window.location.href).href
        });
        if (error) throw error;
        form.reset();
        message('If this address has an eligible account, you will receive a password reset email. Check your inbox and spam folder.');
      } else if (page === 'reset') {
        if (!recoveryReady) { message('Open a valid password recovery link from your email.', true); return; }
        if (!rules.strongPassword(field('password'))) { message('Use 12–128 characters, including uppercase, lowercase, and a number.', true); return; }
        if (field('password') !== field('confirm')) { message('Passwords do not match.', true); return; }
        const { data, error: userError } = await client.auth.getUser();
        if (userError || !data.user) throw userError || new Error('Recovery expired');
        const { error } = await client.auth.updateUser({ password: field('password') });
        if (error) throw error;
        resetCompleted = true;
        form.reset();
        form.hidden = true;
        recoveryReady = false;
        const { error: logoutError } = await client.auth.signOut({ scope: 'local' });
        message(logoutError ? 'Password changed. Please sign out and sign in again.' : 'Password changed. You can now sign in with your new password.');
      }
    } catch (error) {
      message(errorText(error), true);
    } finally {
      setBusy(false);
    }
  });

  const edit = document.querySelector('[data-profile-form]');
  edit?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const editStatus = edit.querySelector('[role="status"]');
    const name = edit.elements.namedItem('full_name').value.trim();
    const phone = edit.elements.namedItem('phone').value.trim();
    if (!name || name.length > 80 || !rules.validPhone(phone)) {
      editStatus.textContent = 'Enter your name and a phone number with 10 to 15 digits.';
      return;
    }
    const button = edit.querySelector('button');
    button.disabled = true;
    try {
      const current = await readIdentity();
      if (!current || current.profile.role !== requiredRole) { lock(); await refresh(); return; }
      const { data, error } = await client.from('profiles')
        .update({ full_name: name, phone: rules.normalizePhone(phone) })
        .eq('id', current.user.id).select(profileColumns).single();
      if (error) throw error;
      if (data.role !== requiredRole) { lock(); await refresh(); return; }
      identity = { ...current, profile: data };
      fillProfile(data, true);
      editStatus.textContent = 'Profile updated.';
    } catch (error) { editStatus.textContent = errorText(error); }
    finally { button.disabled = false; }
  });

  const notices = { session: 'Please sign in to continue.', logout: 'You have signed out.', role: 'Use the portal for your approved account role.', admin: 'The admin portal is not available in this phase.' };
  const notice = new URLSearchParams(window.location.search).get('notice');
  if (notices[notice]) message(notices[notice]);
  if (page === 'reset') {
    // Only a verified PASSWORD_RECOVERY event enables this form, never a query flag.
    message('Open the password recovery link from your email. Expired links require a new request.');
    if (window.kbcRecoveryReady) enableRecovery();
    client.auth.getSession().then(() => {
      initializing = false;
      if (window.kbcRecoveryReady) enableRecovery();
    }).catch(() => { message('Unable to verify the recovery session. Request a new link.', true); });
  } else {
    refresh().finally(() => { initializing = false; });
  }
})();
