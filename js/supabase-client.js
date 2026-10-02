/* Connection only: no login, data queries, or changes to existing page behavior. */
(() => {
  'use strict';
  const config = window.KBC_SUPABASE_CONFIG;
  if (!config || !config.publishableKey.startsWith('sb_publishable_')) {
    console.error('KBC Supabase: browser publishable configuration is missing.');
    return;
  }
  if (!window.supabase?.createClient) {
    console.error('KBC Supabase: client library could not be loaded.');
    return;
  }
  window.kbcSupabase = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  // Explicit read-only connectivity check; does not create users or read student data.
  window.checkKbcSupabaseConnection = async () => {
    const response = await fetch(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.publishableKey }, cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Supabase connection check failed (HTTP ${response.status}).`);
    await response.json();
    return { connected: true, status: response.status };
  };
})();
