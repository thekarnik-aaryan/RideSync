(function () {
  var cfg = window.RS_CONFIG || {};
  var fcfg = cfg.FIREBASE_CONFIG || {};
  var configured =
    fcfg.apiKey &&
    fcfg.apiKey.indexOf("YOUR_") !== 0 &&
    fcfg.projectId &&
    fcfg.projectId.indexOf("YOUR_") !== 0;

  var fb = null;
  if (configured && window.firebase && window.firebase.initializeApp) {
    try {
      fb = window.firebase.initializeApp(fcfg);
    } catch (e) {
      console.warn("Firebase init failed, using demo mode.", e);
      fb = null;
    }
  }

  var IS_DEMO = !fb;

  var DB = {
    key: function (k) { return "rs_" + k; },
    get: function (k, fallback) {
      try {
        var raw = localStorage.getItem(this.key(k));
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) { return fallback; }
    },
    set: function (k, v) {
      try { localStorage.setItem(this.key(k), JSON.stringify(v)); } catch (e) {}
    },
    remove: function (k) {
      try { localStorage.removeItem(this.key(k)); } catch (e) {}
    },
    uid: function (p) {
      return (p || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },
    seed: function () {
      var users = DB.get("users", null);
      if (users) return;
      var me = {
        id: "me",
        email: "demo@ridesync.app",
        password: "demo1234",
        full_name: "Alex Carter",
        phone: "+91 98765 43210",
        avatar_url: null,
        bio: "Weekend explorer & group organizer.",
        created_at: new Date(Date.now() - 90 * 864e5).toISOString()
      };
      var members = [
        { id: "m1", full_name: "Jordan Lee", email: "jordan@ridesync.app", avatar_url: null },
        { id: "m2", full_name: "Maya Patel", email: "maya@ridesync.app", avatar_url: null },
        { id: "m3", full_name: "Riley O'Brien", email: "riley@ridesync.app", avatar_url: null },
        { id: "m4", full_name: "Sam Rivera", email: "sam@ridesync.app", avatar_url: null }
      ];
      var group = {
        id: "g1",
        name: "Sunday Canyon Trip",
        code: "RIDE42",
        vehicle_type: "Convoy",
        created_by: "me",
        created_at: new Date(Date.now() - 30 * 864e5).toISOString()
      };
      DB.set("users", [me].concat(members));
      DB.set("groups", [group]);
      DB.set("members", [
        { id: "gm1", group_id: "g1", user_id: "me", role: "admin", status: "online", joined_at: group.created_at },
        { id: "gm2", group_id: "g1", user_id: "m1", role: "member", status: "online", joined_at: group.created_at },
        { id: "gm3", group_id: "g1", user_id: "m2", role: "member", status: "online", joined_at: group.created_at },
        { id: "gm4", group_id: "g1", user_id: "m3", role: "member", status: "riding", joined_at: group.created_at },
        { id: "gm5", group_id: "g1", user_id: "m4", role: "member", status: "offline", joined_at: group.created_at }
      ]);
      DB.set("locations", [
        { user_id: "me", group_id: "g1", lat: 33.685, lng: -84.302, heading: 0, speed: 0, updated_at: Date.now() },
        { user_id: "m1", group_id: "g1", lat: 33.702, lng: -84.298, heading: 42, speed: 62, updated_at: Date.now() },
        { user_id: "m2", group_id: "g1", lat: 33.674, lng: -84.316, heading: 15, speed: 55, updated_at: Date.now() },
        { user_id: "m3", group_id: "g1", lat: 33.691, lng: -84.278, heading: 84, speed: 70, updated_at: Date.now() },
        { user_id: "m4", group_id: "g1", lat: 33.71, lng: -84.33, heading: 30, speed: 0, updated_at: Date.now() }
      ]);
      DB.set("messages", [
        { id: DB.uid("msg"), group_id: "g1", user_id: "me", content: "Everyone set? Leaving the gas station in 5 mins 🚗", created_at: Date.now() - 32 * 6e4 },
        { id: DB.uid("msg"), group_id: "g1", user_id: "m2", content: "Ready when you are!", created_at: Date.now() - 30 * 6e4 },
        { id: DB.uid("msg"), group_id: "g1", user_id: "m1", content: "Rolling now, catching up on the highway.", created_at: Date.now() - 21 * 6e4 },
        { id: DB.uid("msg"), group_id: "g1", user_id: "m3", content: "Traffic's light this morning, we're making great time.", created_at: Date.now() - 9 * 6e4 }
      ]);
      DB.set("photos", [
        { id: DB.uid("ph"), group_id: "g1", user_id: "m2", caption: "Fuel stop! ⛽", created_at: Date.now() - 40 * 6e4, color: "#6366f1", emoji: "⛽" },
        { id: DB.uid("ph"), group_id: "g1", user_id: "me", caption: "Roll call complete", created_at: Date.now() - 25 * 6e4, color: "#22d3ee", emoji: "🚗" },
        { id: DB.uid("ph"), group_id: "g1", user_id: "m1", caption: "On the move!", created_at: Date.now() - 15 * 6e4, color: "#34d399", emoji: "🛣️" },
        { id: DB.uid("ph"), group_id: "g1", user_id: "m3", caption: "Check this view 🌄", created_at: Date.now() - 5 * 6e4, color: "#f472b6", emoji: "🌄" }
      ]);
      DB.set("expenses", [
        { id: DB.uid("exp"), group_id: "g1", title: "Fuel - Highway stop", amount: 48.5, paid_by: "me", category: "Fuel", split: "equally", created_at: Date.now() - 3 * 36e5 },
        { id: DB.uid("exp"), group_id: "g1", title: "Group toll passes", amount: 12.0, paid_by: "m1", category: "Tolls", split: "equally", created_at: Date.now() - 2 * 36e5 },
        { id: DB.uid("exp"), group_id: "g1", title: "Lunch run", amount: 64.25, paid_by: "m2", category: "Food", split: "equally", created_at: Date.now() - 36e5 }
      ]);
      DB.set("contacts", [
        { id: DB.uid("ct"), name: "Mom - Emergency", phone: "+91 98765 40101", relation: "Family", is_emergency: true },
        { id: DB.uid("ct"), name: "Roadside Assist", phone: "+91 98765 40999", relation: "Service", is_emergency: true },
        { id: DB.uid("ct"), name: "Hana Kim", phone: "+91 98765 40222", relation: "Friend", is_emergency: false }
      ]);
      DB.set("alerts", []);
      DB.set("group_cache", "g1");
      DB.set("onboarded", true);
    }
  };

  window.RS = {
    IS_DEMO: IS_DEMO,
    fb: fb,
    DB: DB,
    cfg: cfg
  };

  if (IS_DEMO && console) console.log("%cRideSync DEMO mode", "color:#22d3ee;font-weight:bold", "- add your Firebase config in assets/js/config.js to go live.");
})();
