// presence.js — tracks who's online via Supabase Realtime presence

const PresenceManager = (() => {
  let channel = null;
  let onlineUsers = new Set();
  let listeners = [];

  function start(username) {
    channel = supabaseClient.channel('online-users', {
      config: { presence: { key: username } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        onlineUsers = new Set(Object.keys(state));
        notify();
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        onlineUsers.add(key);
        notify();
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        onlineUsers.delete(key);
        notify();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            username,
            online_at: new Date().toISOString()
          });
        }
      });

    // Re-track on visibility change (helps with tab sleep)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && channel) {
        channel.track({ username, online_at: new Date().toISOString() });
      }
    });
  }

  function stop() {
    if (channel) {
      channel.untrack();
      supabaseClient.removeChannel(channel);
      channel = null;
    }
  }

  function getOnline() {
    return Array.from(onlineUsers);
  }

  function isOnline(username) {
    return onlineUsers.has(username);
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  function notify() {
    listeners.forEach(fn => fn(getOnline()));
  }

  return { start, stop, getOnline, isOnline, onChange };
})();
