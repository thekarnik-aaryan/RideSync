(function () {
  var RS = window.RS;
  var DB = RS.DB;
  var IS_DEMO = RS.IS_DEMO;
  var fb = RS.fb;

  var APP = {};

  APP.friendlyError = function (err) {
    if (!err || !err.code) return (err && err.message) || "Something went wrong.";
    var map = {
      "auth/email-already-in-use": "An account with that email already exists.",
      "auth/invalid-email": "That email address isn't valid.",
      "auth/user-not-found": "No account found with that email.",
      "auth/wrong-password": "Incorrect password. Try again.",
      "auth/invalid-credential": "Incorrect email or password. Double-check and try again.",
      "auth/weak-password": "Password should be at least 6 characters.",
      "auth/too-many-requests": "Too many attempts. Please wait and try again.",
      "auth/popup-closed-by-user": "Google sign-in was cancelled.",
      "auth/operation-not-allowed": "That sign-in method isn't enabled. Check Authentication providers in Firebase.",
      "auth/unauthorized-domain": "This domain isn't whitelisted for Google sign-in. Add it in Firebase Console → Authentication → Sign-in method.",
      "auth/account-exists-with-different-credential": "An account already exists with this email. Sign in with your password instead.",
      "auth/cancelled-popup-request": "Google sign-in was cancelled."
    };
    return map[err.code] || err.message || "Something went wrong.";
  };

  APP.STATUS = {
    online: { label: "Online", icon: "fa-circle-check", badge: "badge-green" },
    riding: { label: "Riding", icon: "fa-motorcycle", badge: "badge-cyan" },
    fueling: { label: "Fueling", icon: "fa-gas-pump", badge: "badge-amber" },
    resting: { label: "Resting", icon: "fa-mug-hot", badge: "badge-blue" },
    eating: { label: "Eating", icon: "fa-utensils", badge: "badge-blue" },
    stopped: { label: "Stopped", icon: "fa-circle-stop", badge: "badge-red" },
    away: { label: "Away", icon: "fa-user-clock", badge: "badge-gray" },
    offline: { label: "Offline", icon: "fa-power-off", badge: "badge-gray" }
  };
  APP.normalizeStatus = function (s) {
    if (s === "driving") return "riding";
    return APP.STATUS[s] ? s : null;
  };
  APP.statusInfo = function (s) {
    var k = APP.normalizeStatus(s);
    return APP.STATUS[k] || { label: s || "Online", icon: "fa-circle", badge: "badge-gray" };
  };

  APP.escapeHtml = function (str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  APP.escapeAttr = APP.escapeHtml;

  APP.initials = function (name) {
    if (!name) return "?";
    return name.trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase();
  };

  APP.roleTag = function (m) {
    return m && m.role === "admin" ? ' <span class="role-pill role-admin">Admin</span>' : "";
  };

  APP.avatarColor = function (seed) {
    var palettes = ["linear-gradient(135deg,#6366f1,#22d3ee)", "linear-gradient(135deg,#8b5cf6,#f472b6)", "linear-gradient(135deg,#0ea5e9,#34d399)", "linear-gradient(135deg,#f97316,#f43f5e)", "linear-gradient(135deg,#10b981,#22d3ee)", "linear-gradient(135deg,#a855f7,#6366f1)"];
    var h = 0;
    for (var i = 0; i < String(seed).length; i++) h = (h * 31 + String(seed).charCodeAt(i)) % 997;
    return palettes[h % palettes.length];
  };

  APP.avatarHtml = function (name, size, userId, online, avatarUrl) {
    size = size || "";
    var dot = online === true ? " avatar-online" : (online === false ? " avatar-away" : "");
    if (avatarUrl) return '<div class="avatar ' + size + dot + '"><img src="' + APP.escapeHtml(avatarUrl) + '" alt=""></div>';
    return '<div class="avatar ' + size + dot + '" style="background:' + APP.avatarColor(name) + '">' + APP.escapeHtml(APP.initials(name)) + "</div>";
  };

  APP.formatTime = function (t) {
    if (!t) return "";
    var d = new Date(t);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };
  APP.formatDate = function (t) {
    if (!t) return "";
    var d = new Date(t);
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };
  APP.timeAgo = function (t) {
    if (!t) return "";
    var s = Math.floor((Date.now() - new Date(t).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  };
  APP.money = function (n) {
    var v = Number(n) || 0;
    return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  APP.code = function (len) {
    len = len || 6;
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var out = "";
    for (var i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  };
  APP.capitalize = function (s) {
    return s ? s[0].toUpperCase() + s.slice(1) : s;
  };

  APP.toast = function (message, type) {
    type = type || "success";
    var wrap = document.querySelector(".toast-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "toast-wrap";
      document.body.appendChild(wrap);
    }
    var icons = { success: "fa-circle-check", error: "fa-circle-xmark", info: "fa-circle-info" };
    var t = document.createElement("div");
    t.className = "toast toast-" + type;
    t.innerHTML = '<i class="fa-solid ' + (icons[type] || icons.info) + '"></i><div>' + APP.escapeHtml(message) + "</div>";
    wrap.appendChild(t);
    setTimeout(function () {
      t.classList.add("out");
      setTimeout(function () { t.remove(); }, 320);
    }, 3400);
  };

  var authReady = IS_DEMO ? Promise.resolve() : new Promise(function (resolve) {
    fb.auth().onAuthStateChanged(function (u) { authUser = u; resolve(); });
  });
  var authUser = null;

  var presenceTimer = null;
  APP.startPresence = function () {
    if (IS_DEMO || presenceTimer) return;
    var beat = function () {
      APP.getUser().then(function (u) {
        if (!u) return;
        fb.firestore().collection("presence").doc(u.id).set({ online: true, last_seen: Date.now() }, { merge: true }).catch(function () {});
      });
    };
    beat();
    presenceTimer = setInterval(beat, 30000);
    window.addEventListener("pagehide", function () {
      APP.getUser().then(function (u) {
        if (!u) return;
        fb.firestore().collection("presence").doc(u.id).set({ online: false, last_seen: Date.now() }, { merge: true }).catch(function () {});
      });
    });
  };
  authReady.then(function () { if (!IS_DEMO && authUser) APP.startPresence(); });

  APP.memberOnline = function (m) {
    if (!m) return false;
    if (m.status === "offline") return false;
    if (IS_DEMO) return true;
    var t = m.last_seen || 0;
    if (!t) return false;
    return Date.now() - t < 90000;
  };

  APP.getUser = function () {
    if (IS_DEMO) return Promise.resolve(DB.get("session", null));
    return authReady.then(function () {
      var u = authUser;
      if (!u) return null;
      return { id: u.uid, email: u.email, full_name: (u.displayName || (u.email || "").split("@")[0]) };
    });
  };

  APP.getProfile = function () {
    if (!IS_DEMO) {
      return APP.getUser().then(function (u) {
        if (!u) return null;
        var db = fb.firestore();
        var ref = db.collection("profiles").doc(u.id);
        return ref.get().then(function (snap) {
          if (snap.exists) return Object.assign({ id: u.id }, snap.data());
          var data = {
            full_name: u.full_name || (u.email || "").split("@")[0],
            email: u.email || "",
            created_at: new Date().toISOString(),
            emergency_contacts: []
          };
          return ref.set(data).then(function () { data.id = u.id; return data; });
        });
      });
    }
    var s = DB.get("session", null);
    if (!s) return Promise.resolve(null);
    var u = DB.get("users", []).find(function (x) { return x.id === s.id; });
    return Promise.resolve(u || null);
  };

  APP.requireAuth = function () {
    return APP.getUser().then(function (u) {
      if (!u) {
        window.location.replace("login.html");
        return null;
      }
      return u;
    });
  };

  var NAV = [
    { id: "home", label: "Dashboard", href: "home.html", icon: "fa-solid fa-house", section: "main" },
    { id: "group", label: "Group Dashboard", href: "group-dashboard.html", icon: "fa-solid fa-users", section: "main" },
    { id: "map", label: "Map & Navigation", href: "map.html", icon: "fa-solid fa-map-location-dot", section: "main" },
    { id: "status", label: "Member Status", href: "member-status.html", icon: "fa-solid fa-user-check", section: "main" },
    { id: "manage", label: "Manage Members", href: "group-management.html", icon: "fa-solid fa-user-shield", section: "main" },
    { id: "chat", label: "Group Chat", href: "chat.html", icon: "fa-solid fa-comments", section: "main" },
    { id: "photos", label: "Photo Drive", href: "photo-drive.html", icon: "fa-solid fa-camera", section: "main" },
    { id: "expenses", label: "Expenses", href: "expenses.html", icon: "fa-solid fa-wallet", section: "main" },
    { id: "emergency", label: "SOS Emergency", href: "emergency.html", icon: "fa-solid fa-tower-broadcast", section: "safety", danger: true },
    { id: "contacts", label: "Emergency Contacts", href: "contacts.html", icon: "fa-solid fa-address-book", section: "safety" },
    { id: "profile", label: "Profile", href: "profile.html", icon: "fa-solid fa-user", section: "account" },
    { id: "settings", label: "Group Settings", href: "settings.html", icon: "fa-solid fa-gear", section: "account" }
  ];

  APP.renderShell = function (active, title, subtitle) {
    document.body.classList.add("rs-app");
    var root = document.getElementById("sidebar-root");
    var top = document.getElementById("topbar-root");
    var sections = { main: "Ride", safety: "Safety", account: "Account" };
    var navHtml = "";
    var cur = null;
    for (var s in sections) {
      navHtml += '<div class="nav-group-label">' + sections[s] + "</div>";
      NAV.forEach(function (item) {
        if (item.section !== s) return;
        var cls = item.id === active ? " active" : "";
        if (item.danger) cls += " danger";
        navHtml += '<a class="side-link' + cls + '" href="' + item.href + '">' +
          '<i class="' + item.icon + '"></i>' + item.label + "</a>";
      });
    }
    root.innerHTML =
      '<aside class="sidebar" id="sidebar">' +
        '<a class="sidebar-brand" href="home.html"><img src="assets/images/logo.svg" alt="RideSync"><span>RideSync</span></a>' +
        '<nav class="side-nav">' + navHtml + "</nav>" +
        '<div class="sidebar-foot"><div class="sidebar-user" id="sideUser">' +
          '<div class="avatar skeleton" style="width:40px;height:40px"></div>' +
          '<div class="sidebar-user-info"><strong class="skeleton" style="height:12px;width:90px;display:block"></strong>' +
          '<span class="skeleton" style="height:10px;width:60px;display:block;margin-top:6px"></span></div></div></div>' +
      "</aside>" +
      '<div class="sidebar-overlay" id="sidebarOverlay"></div>';

    top.className = "topbar";
    top.innerHTML =
      '<button class="menu-toggle" id="menuToggle" aria-label="Menu"><span class="ham"></span><span class="ham"></span><span class="ham"></span></button>' +
      '<div class="topbar-title">' + APP.escapeHtml(title || "RideSync") +
      (subtitle ? " <span>&middot; " + APP.escapeHtml(subtitle) + "</span>" : "") + "</div>" +
      '<div class="topbar-spacer"></div>' +
      '<div class="topbar-search"><i class="fa-solid fa-magnifying-glass"></i><input type="text" placeholder="Search groups, members..."></div>' +
      '<button class="topbar-btn" id="helpBtn" title="Help"><i class="fa-regular fa-circle-question"></i></button>' +
      '<button class="topbar-btn" id="notifBtn" title="Alerts"><i class="fa-regular fa-bell"></i><span class="notif-dot" style="display:none"></span></button>';

    var bnRoot = document.getElementById("bottomnav-root");
    if (!bnRoot) {
      bnRoot = document.createElement("div");
      bnRoot.id = "bottomnav-root";
      document.body.appendChild(bnRoot);
    }
    var tabs = [
      { id: "home", label: "Home", href: "home.html", icon: "fa-solid fa-house" },
      { id: "map", label: "Map", href: "map.html", icon: "fa-solid fa-map-location-dot" },
      null,
      { id: "chat", label: "Chat", href: "chat.html", icon: "fa-solid fa-comments" },
      { id: "status", label: "Status", href: "member-status.html", icon: "fa-solid fa-user-check" }
    ];
    var bnHtml = '<nav class="bottom-nav" id="bottomNav">';
    tabs.forEach(function (t) {
      if (!t) {
        bnHtml += '<a class="bn-sos' + (active === "emergency" ? " active" : "") + '" href="emergency.html" aria-label="SOS">' +
          '<i class="fa-solid fa-tower-broadcast"></i><span>SOS</span></a>';
        return;
      }
      bnHtml += '<a class="bn-item' + (t.id === active ? " active" : "") + '" href="' + t.href + '">' +
        '<i class="' + t.icon + '"></i><span>' + t.label + "</span></a>";
    });
    bnHtml += "</nav>";
    bnRoot.innerHTML = bnHtml;

    APP.initNotifications();
    APP.watchSOS();

    APP.getActiveGroup().then(function (g) {
      var mgmtLink = root.querySelector('a[href="group-management.html"]');
      if (mgmtLink) mgmtLink.style.display = g && g.role === "admin" ? "" : "none";
    }).catch(function () {});

    var menu = document.getElementById("menuToggle");
    var overlay = document.getElementById("sidebarOverlay");
    var sidebar = document.getElementById("sidebar");
    var wrap = document.body;
    function updateToggle() {
      var wide = window.innerWidth > 900;
      var collapsed = wrap && wrap.classList.contains("sidebar-collapsed");
      if (menu) menu.classList.toggle("open", wide ? collapsed : sidebar.classList.contains("open"));
    }
    function closeMenu() { sidebar.classList.remove("open"); overlay.classList.remove("show"); updateToggle(); }
    if (menu && wrap) menu.addEventListener("click", function () {
      if (window.innerWidth > 900) {
        wrap.classList.toggle("sidebar-collapsed");
        if (wrap.classList.contains("sidebar-collapsed")) localStorage.setItem("rs_sidebar_collapsed", "1");
        else localStorage.removeItem("rs_sidebar_collapsed");
      } else {
        sidebar.classList.toggle("open");
        overlay.classList.toggle("show");
      }
      updateToggle();
    });
    if (overlay) overlay.addEventListener("click", closeMenu);
    if (wrap && localStorage.getItem("rs_sidebar_collapsed") === "1" && window.innerWidth > 900) {
      wrap.classList.add("sidebar-collapsed");
      updateToggle();
    }

    var helpBtn = document.getElementById("helpBtn");
    if (helpBtn) helpBtn.addEventListener("click", function () {
      APP.toast("RideSync help: pick a page from the sidebar to get started.", "info");
    });

    APP.getProfile().then(function (u) {
      var box = document.getElementById("sideUser");
      if (!u) return;
      box.innerHTML = APP.avatarHtml(u.full_name, "sm", u.id, true, u.avatar_url) +
        '<div class="sidebar-user-info"><strong>' + APP.escapeHtml(u.full_name) + "</strong>" +
        '<span>' + APP.escapeHtml((u.email || "").split("@")[0]) + "</span></div>" +
        '<button class="btn btn-icon btn-ghost" id="logoutBtn" title="Sign out"><i class="fa-solid fa-right-from-bracket"></i></button>';
      var lo = document.getElementById("logoutBtn");
      if (lo) lo.addEventListener("click", APP.logout);
    });
    return APP;
  };

  APP.loadGoogleMaps = function () {
    if (window.google && window.google.maps) return Promise.resolve(window.google.maps);
    var key = (RS.cfg && RS.cfg.GOOGLE_MAPS_KEY) || "";
    if (!key) return Promise.reject(new Error("No Google Maps API key configured."));
    if (APP._gmLoading) return APP._gmLoading;
    APP._gmLoading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) + "&loading=async&callback=__rsGoogleReady";
      window.__rsGoogleReady = function () { resolve(window.google.maps); };
      s.onerror = function () {
        APP._gmLoading = null;
        reject(new Error("Could not load Google Maps. Check your API key and network."));
      };
      document.head.appendChild(s);
    });
    return APP._gmLoading;
  };

  APP.logout = function () {
    if (!IS_DEMO) {
      fb.auth().signOut().then(function () { window.location.replace("login.html"); });
    } else {
      DB.remove("session");
      window.location.replace("login.html");
    }
  };

  APP.getActiveGroupId = function () {
    return DB.get("group_cache", null);
  };
  APP.setActiveGroupId = function (id) {
    DB.set("group_cache", id);
  };

  var healDone = {};
  APP.fetchGroups = function () {
    if (!IS_DEMO) {
      return APP.getUser().then(function (u) {
        if (!u) return [];
        var db = fb.firestore();
        return db.collection("memberships").where("uid", "==", u.id).get().then(function (snap) {
          var rows = snap.docs.map(function (d) { return d.data(); });
          var gids = rows.map(function (r) { return r.gid; });
          if (!gids.length) return [];
          return Promise.all(gids.map(function (gid) {
            return Promise.all([
              db.collection("groups").doc(gid).get(),
              db.collection("memberships").where("gid", "==", gid).get()
            ]).then(function (res) {
              var gsnap = res[0];
              if (!gsnap.exists) return null;
              var gr = gsnap.data();
              gr.id = gid;
              gr.members_count = res[1].size;
              var membership = rows.find(function (r) { return r.gid === gid; }) || {};
              gr.role = membership.role || (gr.created_by === u.id ? "admin" : "member");
              if (!membership.role && gr.created_by === u.id && !healDone[gid]) {
                healDone[gid] = true;
                db.collection("memberships").doc(u.id + "_" + gid).set({ role: "admin" }, { merge: true }).catch(function () {});
              }
              return db.collection("profiles").doc(gr.created_by).get().then(function (p) {
                gr.created_by_name = (p.exists && p.data().full_name) || "You";
                return gr;
              });
            });
          })).then(function (groups) {
            return groups.filter(function (g) { return g; });
          });
        });
      });
    }
    var groups = DB.get("groups", []);
    var members = DB.get("members", []);
    var users = DB.get("users", []);
      var me = DB.get("session", null);
      return Promise.resolve(groups.map(function (g) {
        g.members_count = members.filter(function (m) { return m.group_id === g.id; }).length;
        var myRole = (members.find(function (m) { return m.group_id === g.id && m.user_id === (me ? me.id : "me"); }) || {}).role;
        g.role = myRole || (g.created_by === (me ? me.id : "me") ? "admin" : "member");
        g.created_by_name = (users.find(function (u) { return u.id === g.created_by; }) || {}).full_name || "You";
        return g;
      }));
  };

  APP.getGroup = function (id) {
    return APP.fetchGroups().then(function (groups) {
      return groups.find(function (g) { return g.id === id; }) || null;
    });
  };

  APP.getActiveGroup = function () {
    var urlId = null;
    try { urlId = new URLSearchParams(window.location.search).get("id"); } catch (e) {}
    var id = urlId || APP.getActiveGroupId();
    if (!id) return APP.fetchGroups().then(function (g) { return g[0] || null; });
    return APP.getGroup(id).then(function (g) {
      if (g) return g;
      if (urlId) return null;
      return APP.fetchGroups().then(function (gs) { return gs[0] || null; });
    });
  };

  APP.createGroup = function (payload) {
    if (!IS_DEMO) {
      return APP.getUser().then(function (u) {
        if (!u) {
          window.location.replace("login.html");
          return Promise.reject(new Error("Please sign in first."));
        }
        var db = fb.firestore();
        var code = payload.code || APP.code(6);
        var gid = db.collection("groups").doc().id;
        var now = new Date().toISOString();
        return db.runTransaction(function (tx) {
          var codeRef = db.collection("group_codes").doc(code);
          return tx.get(codeRef).then(function (snap) {
            if (snap.exists) throw new Error("That code is already in use. Try again.");
            tx.set(db.collection("groups").doc(gid), {
              name: payload.name,
              code: code,
              vehicle_type: payload.vehicle_type || "Convoy",
              created_by: u.id,
              created_at: now
            });
            tx.set(codeRef, { gid: gid, created_at: now });
            tx.set(db.collection("memberships").doc(u.id + "_" + gid), { uid: u.id, gid: gid, role: "admin", status: "online", joined_at: now });
          });
        }).then(function () {
          DB.set("group_cache", gid);
          return { id: gid, name: payload.name, code: code, vehicle_type: payload.vehicle_type || "Convoy", created_by: u.id, created_at: now, members_count: 1, role: "admin", created_by_name: (u.full_name || "You") };
        });
      });
    }
    var code = payload.code || APP.code(6);
    var g = {
      id: DB.uid("g"),
      name: payload.name,
      code: code,
      vehicle_type: payload.vehicle_type || "Convoy",
      created_by: "me",
      created_at: new Date().toISOString()
    };
    var groups = DB.get("groups", []);
    groups.push(g);
    DB.set("groups", groups);
    var members = DB.get("members", []);
    members.push({ id: DB.uid("gm"), group_id: g.id, user_id: "me", role: "admin", status: "online", joined_at: g.created_at });
    DB.set("members", members);
    DB.set("group_cache", g.id);
    return Promise.resolve(g);
  };

  APP.updateGroup = function (id, updates) {
    if (!IS_DEMO) {
      var db = fb.firestore();
      return db.collection("groups").doc(id).get().then(function (snap) {
        if (!snap.exists) throw new Error("Group not found.");
        var old = snap.data();
        var next = {};
        Object.keys(updates).forEach(function (k) { if (updates[k] !== undefined) next[k] = updates[k]; });
        var codeChanged = next.code && next.code !== old.code;
        if (!codeChanged) return db.collection("groups").doc(id).update(next);
        return db.runTransaction(function (tx) {
          var codeRef = db.collection("group_codes").doc(next.code);
          return tx.get(codeRef).then(function (s2) {
            if (s2.exists) throw new Error("That code is already in use.");
            tx.set(codeRef, { gid: id, created_at: new Date().toISOString() });
            if (old.code) tx.delete(db.collection("group_codes").doc(old.code));
            tx.update(db.collection("groups").doc(id), next);
          });
        });
      });
    }
    var groups = DB.get("groups", []);
    var target = groups.find(function (x) { return x.id === id; });
    if (target) {
      Object.assign(target, updates);
      DB.set("groups", groups);
    }
    return Promise.resolve({});
  };

  APP.uuid = function () {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  APP.joinGroup = function (code) {
    if (!IS_DEMO) {
      return APP.getUser().then(function (u) {
        if (!u) {
          window.location.replace("login.html");
          return Promise.reject(new Error("Please sign in first."));
        }
        var db = fb.firestore();
        var c = String(code).trim().toUpperCase();
        return db.collection("group_codes").doc(c).get().then(function (snap) {
          if (!snap.exists) throw new Error("No group found with that code.");
          var gid = snap.data().gid;
          var mref = db.collection("memberships").doc(u.id + "_" + gid);
          return mref.set({ uid: u.id, gid: gid, role: "member", status: "online", joined_at: new Date().toISOString() }, { merge: true }).then(function () {
            return db.collection("groups").doc(gid).get().then(function (g) {
              if (!g.exists) throw new Error("Group not found.");
              var gr = g.data();
              gr.id = gid;
              gr.role = "member";
              gr.members_count = 0;
              return db.collection("profiles").doc(gr.created_by).get().then(function (p) {
                gr.created_by_name = (p.exists && p.data().full_name) || "You";
                return gr;
              });
            });
          });
        });
      });
    }
    var groups = DB.get("groups", []);
    var g = groups.find(function (x) { return x.code === code.trim().toUpperCase(); });
    if (!g) return Promise.reject(new Error("No group found with that code."));
    var members = DB.get("members", []);
    if (members.some(function (m) { return m.group_id === g.id && m.user_id === "me"; })) {
      return Promise.reject(new Error("You are already in this group."));
    }
    members.push({ id: DB.uid("gm"), group_id: g.id, user_id: "me", role: "member", status: "online", joined_at: new Date().toISOString() });
    DB.set("members", members);
    DB.set("group_cache", g.id);
    return Promise.resolve(g);
  };

  APP.leaveGroup = function (groupId) {
    if (!IS_DEMO) {
      return APP.getUser().then(function (u) {
        return fb.firestore().collection("memberships").doc(u.id + "_" + groupId).delete().then(function () {
          DB.set("group_cache", null);
        });
      });
    }
    var members = DB.get("members", []);
    DB.set("members", members.filter(function (m) { return !(m.group_id === groupId && m.user_id === "me"); }));
    DB.set("group_cache", null);
    return Promise.resolve({});
  };

  APP.fetchMembers = function (groupId) {
    if (!IS_DEMO) {
      var db = fb.firestore();
      return db.collection("groups").doc(groupId).get().then(function (gsnap) {
        var createdBy = gsnap.exists ? gsnap.data().created_by : null;
        return db.collection("memberships").where("gid", "==", groupId).get().then(function (snap) {
          var rows = snap.docs.map(function (d) { return d.data(); });
          return Promise.all(rows.map(function (r) {
            return db.collection("profiles").doc(r.uid).get().then(function (p) {
              var prof = p.exists ? p.data() : {};
              return {
                id: r.uid + "_" + groupId, user_id: r.uid, role: r.role, status: APP.normalizeStatus(r.status) || "online",
                full_name: prof.full_name || "Member", email: prof.email || "", avatar_url: prof.avatar_url || null
              };
            });
          }));
        }).then(function (members) {
          return Promise.all(members.map(function (m) {
            return db.collection("presence").doc(m.user_id).get().then(function (p) {
              var d = p.exists ? p.data() : {};
              m.last_seen = d.last_seen || 0;
              return m;
            });
          })).then(function () {
            return ensureAdmin(members, createdBy);
          });
        });
      });
    }
    var members = DB.get("members", []).filter(function (m) { return m.group_id === groupId; });
    var users = DB.get("users", []);
    return Promise.resolve(members.map(function (m) {
      var u = users.find(function (x) { return x.id === m.user_id; }) || {};
      return { id: m.id, user_id: m.user_id, role: m.role, status: APP.normalizeStatus(m.status) || "online", full_name: u.full_name || "Member", email: u.email || "", avatar_url: u.avatar_url || null };
    })).then(function (list) {
      var g = DB.get("groups", []).find(function (x) { return x.id === groupId; });
      return ensureAdmin(list, g ? g.created_by : null);
    });
  };

  function ensureAdmin(members, createdBy) {
    if (!createdBy) return members;
    var hasAdmin = members.some(function (m) { return m.role === "admin"; });
    if (!hasAdmin) members.forEach(function (m) { if (m.user_id === createdBy) m.role = "admin"; });
    return members;
  }

  APP.updateMemberStatus = function (groupId, userId, status) {
    if (!IS_DEMO) {
      return fb.firestore().collection("memberships").doc(userId + "_" + groupId).update({ status: status });
    }
    var members = DB.get("members", []);
    var m = members.find(function (x) { return x.group_id === groupId && x.user_id === userId; });
    if (m) { m.status = status; DB.set("members", members); }
    return Promise.resolve({});
  };

  APP.updateMemberRole = function (groupId, userId, role) {
    if (!IS_DEMO) {
      return fb.firestore().collection("memberships").doc(userId + "_" + groupId).update({ role: role });
    }
    var members = DB.get("members", []);
    var m = members.find(function (x) { return x.group_id === groupId && x.user_id === userId; });
    if (m) { m.role = role; DB.set("members", members); }
    return Promise.resolve({});
  };

  APP.removeMember = function (groupId, userId) {
    if (!IS_DEMO) {
      return fb.firestore().collection("memberships").doc(userId + "_" + groupId).delete();
    }
    var members = DB.get("members", []);
    DB.set("members", members.filter(function (m) { return !(m.group_id === groupId && m.user_id === userId); }));
    return Promise.resolve({});
  };

  APP.fetchMessages = function (groupId) {
    if (!IS_DEMO) {
      return fb.firestore().collection("groups").doc(groupId).collection("messages").orderBy("created_at", "asc").get().then(function (snap) {
        return snap.docs.map(function (d) {
          var m = d.data();
          return { id: d.id, user_id: m.uid, content: m.content, created_at: m.created_at, full_name: m.user_name || "Member", avatar_url: m.avatar_url || null };
        });
      });
    }
    var msgs = DB.get("messages", []).filter(function (m) { return m.group_id === groupId; });
    var users = DB.get("users", []);
    return Promise.resolve(msgs.map(function (m) {
      var u = users.find(function (x) { return x.id === m.user_id; }) || {};
      return { id: m.id, user_id: m.user_id, content: m.content, created_at: m.created_at, full_name: u.full_name || "Member", avatar_url: u.avatar_url || null };
    }));
  };

  APP.sendMessage = function (groupId, content) {
    if (!IS_DEMO) {
      return APP.getUser().then(function (u) {
        var data = { uid: u.id, content: content, created_at: new Date().toISOString(), user_name: u.full_name || "Member", avatar_url: u.avatar_url || null };
        return fb.firestore().collection("groups").doc(groupId).collection("messages").add(data).then(function (ref) {
          data.id = ref.id;
          return data;
        });
      });
    }
    var m = { id: DB.uid("msg"), group_id: groupId, user_id: "me", content: content, created_at: Date.now() };
    var msgs = DB.get("messages", []);
    msgs.push(m);
    DB.set("messages", msgs);
    return Promise.resolve(m);
  };

  APP.fetchPhotos = function (groupId) {
    if (!IS_DEMO) {
      return fb.firestore().collection("groups").doc(groupId).collection("photos").orderBy("created_at", "desc").get().then(function (snap) {
        return snap.docs.map(function (d) {
          var p = d.data();
          return { id: d.id, user_id: p.uid, url: p.url, caption: p.caption, created_at: p.created_at, full_name: p.user_name || "Member" };
        });
      });
    }
    var photos = DB.get("photos", []).filter(function (p) { return p.group_id === groupId; }).reverse();
    var users = DB.get("users", []);
    return Promise.resolve(photos.map(function (p) {
      var u = users.find(function (x) { return x.id === p.user_id; }) || {};
      return { id: p.id, user_id: p.user_id, url: p.url, caption: p.caption, created_at: p.created_at, full_name: u.full_name || "Member", color: p.color, emoji: p.emoji };
    }));
  };

  function cloudUpload(file, folder) {
    var cld = (window.RS_CONFIG && window.RS_CONFIG.CLOUDINARY) || {};
    var cloud = cld.cloudName || "";
    var preset = cld.uploadPreset || "";
    if (!cloud || cloud.indexOf("YOUR_") === 0 || !preset || preset.indexOf("YOUR_") === 0) {
      return Promise.reject(new Error("Photo upload isn't configured yet. Add your Cloudinary cloud name and unsigned upload preset to config.js."));
    }
    var url = "https://api.cloudinary.com/v1_1/" + encodeURIComponent(cloud) + "/auto/upload";
    var fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", preset);
    fd.append("folder", "ridesync/" + folder);
    return fetch(url, { method: "POST", body: fd }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error((data && data.error && data.error.message) || "Upload failed (" + res.status + ").");
        if (!data.secure_url) throw new Error("Upload succeeded, but no public URL was returned.");
        return data.secure_url;
      });
    });
  }

  APP.uploadPhoto = function (groupId, file, caption, objectUrl) {
    if (!IS_DEMO) {
      return APP.getUser().then(function (u) {
        return cloudUpload(file, groupId).then(function (url) {
          return fb.firestore().collection("groups").doc(groupId).collection("photos").add({
            uid: u.id, url: url, caption: caption || "",
            media_type: (file.type.indexOf("video/") === 0) ? "video" : "image",
            created_at: new Date().toISOString(), user_name: u.full_name || "Member"
          });
        });
      });
    }
    var p = {
      id: DB.uid("ph"), group_id: groupId, user_id: "me",
      url: objectUrl || null, caption: caption || "",
      created_at: Date.now(), color: "#22d3ee", emoji: "🚗"
    };
    var photos = DB.get("photos", []);
    photos.push(p);
    DB.set("photos", photos);
    return Promise.resolve({});
  };

  APP.uploadAvatar = function (file) {
    if (IS_DEMO) return Promise.reject(new Error("Avatar upload needs a live account."));
    return APP.getUser().then(function (u) {
      return cloudUpload(file, "avatars").then(function (url) {
        return fb.firestore().collection("profiles").doc(u.id).set({ avatar_url: url }, { merge: true }).then(function () {
          return url;
        });
      });
    });
  };

  APP.deletePhoto = function (groupId, id) {
    if (!IS_DEMO) {
      return fb.firestore().collection("groups").doc(groupId).collection("photos").doc(id).delete();
    }
    DB.set("photos", DB.get("photos", []).filter(function (p) { return p.id !== id; }));
    return Promise.resolve({});
  };

  APP.fetchExpenses = function (groupId) {
    if (!IS_DEMO) {
      return fb.firestore().collection("groups").doc(groupId).collection("expenses").orderBy("created_at", "desc").get().then(function (snap) {
        return snap.docs.map(function (d) {
          var e = d.data();
          return { id: d.id, title: e.title, amount: e.amount, category: e.category, split: e.split, created_at: e.created_at, paid_by: e.uid, paid_by_name: e.user_name || "Member" };
        });
      });
    }
    var exps = DB.get("expenses", []).filter(function (e) { return e.group_id === groupId; }).reverse();
    var users = DB.get("users", []);
    return Promise.resolve(exps.map(function (e) {
      var u = users.find(function (x) { return x.id === e.paid_by; }) || {};
      return { id: e.id, title: e.title, amount: e.amount, category: e.category, split: e.split, created_at: e.created_at, paid_by: e.paid_by, paid_by_name: u.full_name || "Member" };
    }));
  };

  APP.addExpense = function (groupId, payload) {
    if (!IS_DEMO) {
      return APP.getUser().then(function (u) {
        return fb.firestore().collection("groups").doc(groupId).collection("expenses").add({
          uid: u.id, title: payload.title, amount: Number(payload.amount), category: payload.category || "Other", split: payload.split || "equally", created_at: new Date().toISOString(), user_name: u.full_name || "Member"
        });
      });
    }
    var e = { id: DB.uid("exp"), group_id: groupId, paid_by: "me", title: payload.title, amount: Number(payload.amount), category: payload.category || "Other", split: payload.split || "equally", created_at: Date.now() };
    var exps = DB.get("expenses", []);
    exps.push(e);
    DB.set("expenses", exps);
    return Promise.resolve({});
  };

  APP.deleteExpense = function (groupId, id) {
    if (!IS_DEMO) {
      return fb.firestore().collection("groups").doc(groupId).collection("expenses").doc(id).delete();
    }
    DB.set("expenses", DB.get("expenses", []).filter(function (e) { return e.id !== id; }));
    return Promise.resolve({});
  };

  APP.fetchContacts = function () {
    if (!IS_DEMO) {
      return APP.getUser().then(function (u) {
        if (!u) return [];
        return fb.firestore().collection("profiles").doc(u.id).get().then(function (snap) {
          return (snap.exists && snap.data().emergency_contacts) || [];
        });
      });
    }
    return Promise.resolve(DB.get("contacts", []));
  };

  APP.saveContacts = function (contacts) {
    if (!IS_DEMO) {
      return APP.getUser().then(function (u) {
        return fb.firestore().collection("profiles").doc(u.id).set({ emergency_contacts: contacts }, { merge: true });
      });
    }
    DB.set("contacts", contacts);
    return Promise.resolve({});
  };

  APP.fetchLocations = function (groupId) {
    if (!IS_DEMO) {
      return fb.firestore().collection("locations").where("gid", "==", groupId).get().then(function (snap) {
        return snap.docs.map(function (d) {
          var l = d.data();
          l.id = d.id;
          l.user_id = l.uid || l.user_id;
          return l;
        });
      });
    }
    return Promise.resolve(DB.get("locations", []).filter(function (l) { return l.group_id === groupId; }));
  };

  APP.updateLocation = function (groupId, lat, lng) {
    if (!IS_DEMO) {
      return APP.getUser().then(function (u) {
        return fb.firestore().collection("locations").doc(groupId + "_" + u.id).set({
          gid: groupId, uid: u.id, lat: lat, lng: lng, updated_at: new Date().toISOString()
        }, { merge: true });
      });
    }
    var locs = DB.get("locations", []);
    var l = locs.find(function (x) { return x.group_id === groupId && x.user_id === "me"; });
    if (l) { l.lat = lat; l.lng = lng; l.updated_at = Date.now(); }
    else { locs.push({ user_id: "me", group_id: groupId, lat: lat, lng: lng, updated_at: Date.now() }); }
    DB.set("locations", locs);
    return Promise.resolve({});
  };

  APP.sendSOS = function (payload) {
    if (!IS_DEMO) {
      return APP.getUser().then(function (u) {
        return fb.firestore().collection("groups").doc(payload.group_id).collection("alerts").add({
          uid: u.id, user_name: (u.full_name || "Member"), type: payload.type, message: payload.message || "",
          lat: payload.lat || null, lng: payload.lng || null, created_at: new Date().toISOString()
        });
      });
    }
    var a = { id: DB.uid("alert"), group_id: payload.group_id, user_id: "me", type: payload.type, message: payload.message || "", lat: payload.lat || null, lng: payload.lng || null, created_at: Date.now(), resolved: false };
    var alerts = DB.get("alerts", []);
    alerts.push(a);
    DB.set("alerts", alerts);
    return Promise.resolve({});
  };

  APP.fetchAlerts = function (groupId) {
    if (!IS_DEMO) {
      return fb.firestore().collection("groups").doc(groupId).collection("alerts").orderBy("created_at", "desc").get().then(function (snap) {
        return snap.docs.map(function (d) {
          var a = d.data();
          return { id: d.id, user_id: a.uid, type: a.type, message: a.message || "", lat: a.lat || null, lng: a.lng || null, created_at: a.created_at, full_name: a.user_name || "Member" };
        });
      });
    }
    var alerts = DB.get("alerts", []).filter(function (a) { return a.group_id === groupId; }).reverse();
    var users = DB.get("users", []);
    return Promise.resolve(alerts.map(function (a) {
      var u = users.find(function (x) { return x.id === a.user_id; }) || {};
      return { id: a.id, user_id: a.user_id, type: a.type, message: a.message || "", lat: a.lat || null, lng: a.lng || null, created_at: a.created_at, full_name: u.full_name || "Member" };
    }));
  };

  APP.clearAlerts = function (groupId) {
    if (!IS_DEMO) {
      return fb.firestore().collection("groups").doc(groupId).collection("alerts").get().then(function (snap) {
        return Promise.all(snap.docs.map(function (d) { return d.ref.delete(); }));
      });
    }
    DB.set("alerts", DB.get("alerts", []).filter(function (a) { return a.group_id !== groupId; }));
    return Promise.resolve({});
  };

  var notifTimer = null;
  APP.initNotifications = function () {
    var btn = document.getElementById("notifBtn");
    if (!btn) return;
    if (notifTimer) clearInterval(notifTimer);

    var panel = document.getElementById("notifPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "notifPanel";
      panel.className = "notif-panel";
      document.body.appendChild(panel);
    }
    var dot = btn.querySelector(".notif-dot");
    var count = document.createElement("span");
    count.className = "notif-count";
    count.style.display = "none";
    btn.appendChild(count);

    var seen = Number(DB.get("notif_seen", 0) || 0);
    var popMark = Number(DB.get("notif_pop", 0) || 0);
    var firstRun = true;
    function nts(v) {
      if (!v) return 0;
      if (typeof v === "number") return v;
      var t = Date.parse(v);
      return isNaN(t) ? 0 : t;
    }
    function load() {
      APP.getActiveGroup().then(function (g) {
        if (!g) return;
        return Promise.all([
          APP.fetchMessages(g.id),
          APP.fetchPhotos(g.id),
          APP.fetchExpenses(g.id),
          APP.fetchAlerts(g.id),
          IS_DEMO ? Promise.resolve([]) : fb.firestore().collection("routes").doc(g.id).get().then(function (d) { return d.exists ? [d.data()] : []; })
        ]).then(function (r) {
          var items = [];
          r[0].forEach(function (m) { items.push({ ts: nts(m.created_at), icon: "fa-comment-dots", color: "icon-cyan", href: "chat.html", text: "<strong>" + APP.escapeHtml(m.full_name) + "</strong> sent a message: " + APP.escapeHtml((m.content || "").slice(0, 80)) }); });
          r[1].forEach(function (p) { items.push({ ts: nts(p.created_at), icon: "fa-camera", color: "icon-pink", href: "photos.html", text: "<strong>" + APP.escapeHtml(p.full_name) + "</strong> shared a photo" }); });
          r[2].forEach(function (e) { items.push({ ts: nts(e.created_at), icon: "fa-wallet", color: "icon-amber", href: "expenses.html", text: "<strong>" + APP.escapeHtml(e.paid_by_name) + "</strong> logged " + APP.money(e.amount) + " — " + APP.escapeHtml(e.title) }); });
          r[3].forEach(function (a) { items.push({ ts: nts(a.created_at), icon: "fa-siren", color: "icon-red", href: "emergency.html", text: "<strong>" + APP.escapeHtml(a.full_name) + "</strong> sent " + (a.type === "mechanical" ? "a mechanical SOS" : "an SOS alert") }); });
          r[4].forEach(function (rt) {
            if (rt.status === "active") items.push({ ts: nts(rt.updated_at), icon: "fa-map-location-dot", color: "icon-indigo", href: "map.html", text: "<strong>" + APP.escapeHtml(rt.navigator_name || "Someone") + "</strong> started navigating" });
          });

          items = items.filter(function (it) { return it.ts; }).sort(function (a, b) { return b.ts - a.ts; }).slice(0, 12);
          var unread = items.filter(function (it) { return it.ts > seen; }).length;
          dot.style.display = unread ? "block" : "none";
          count.textContent = unread > 99 ? "99+" : unread;
          count.style.display = unread ? "flex" : "none";

          if (firstRun) {
            firstRun = false;
            popMark = items.length ? items[0].ts : Date.now();
            DB.set("notif_pop", popMark);
          }
          var fresh = items.filter(function (it) { return it.ts > popMark && it.ts > seen; }).slice(0, 1);
          if (fresh.length) {
            popMark = Math.max(popMark, fresh[0].ts);
            DB.set("notif_pop", popMark);
            APP.activityPopup(fresh[0]);
          }
          panel.innerHTML =
            '<div class="notif-head"><strong>Group activity</strong><span>' + APP.escapeHtml(g.name) + "</span></div>" +
            (items.length ? items.map(function (it) {
              return '<a class="notif-item' + (it.ts > seen ? " unread" : "") + '" href="' + it.href + '">' +
                '<div class="icon-box ' + it.color + '" style="width:34px;height:34px;font-size:.8rem"><i class="fa-solid ' + it.icon + '"></i></div>' +
                '<div style="min-width:0"><div style="font-size:.83rem;color:var(--text-200);line-height:1.35">' + it.text + "</div>" +
                '<div style="font-size:.7rem;color:var(--text-600);margin-top:2px">' + APP.timeAgo(it.ts) + "</div></div></a>";
            }).join("") :
            '<div class="notif-empty"><i class="fa-solid fa-bell-slash"></i>No group activity yet</div>');
        });
      }).catch(function () {});
    }
    load();
    notifTimer = setInterval(load, 15000);

    btn.addEventListener("click", function () {
      var open = panel.classList.toggle("open");
      if (open) {
        seen = Date.now();
        DB.set("notif_seen", seen);
        dot.style.display = "none";
        count.style.display = "none";
        panel.querySelectorAll(".notif-item.unread").forEach(function (el) { el.classList.remove("unread"); });
      }
    });
    document.addEventListener("click", function (e) {
      if (!btn.contains(e.target) && !panel.contains(e.target)) panel.classList.remove("open");
    });
  };

  APP.activityPopup = function (it) {
    if (!it) return;
    var wrap = document.getElementById("activityToastWrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "activityToastWrap";
      document.body.appendChild(wrap);
    }
    var t = document.createElement("a");
    t.className = "activity-toast";
    t.href = it.href;
    t.innerHTML =
      '<div class="icon-box ' + it.color + '" style="width:36px;height:36px;font-size:.85rem"><i class="fa-solid ' + it.icon + '"></i></div>' +
      '<div style="flex:1;min-width:0"><div style="font-size:.86rem;color:var(--text-200);line-height:1.35">' + it.text + "</div>" +
      '<div style="font-size:.7rem;color:var(--text-600);margin-top:2px">' + APP.timeAgo(it.ts) + "</div></div>" +
      '<button class="activity-toast-close" title="Dismiss"><i class="fa-solid fa-xmark"></i></button>';
    wrap.appendChild(t);
    setTimeout(function () { t.classList.add("show"); }, 20);
    var close = t.querySelector(".activity-toast-close");
    if (close) close.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); dismiss(t); });
    setTimeout(function () { dismiss(t); }, 6000);
    function dismiss(el) {
      el.classList.remove("show");
      setTimeout(function () { if (el.parentNode) el.remove(); }, 320);
    }
  };

  var sosWatcher = null;
  var sosGroup = null;
  var sosPoll = null;

  APP.watchSOS = function () {
    APP.getActiveGroup().then(function (g) {
      if (!g || sosGroup === g.id) return;
      sosGroup = g.id;
      if (sosWatcher) { sosWatcher(); sosWatcher = null; }
      if (sosPoll) { clearInterval(sosPoll); sosPoll = null; }
      if (IS_DEMO) { demoWatchSOS(g.id); return; }
      var lastSeen = Number(DB.get("sos_last_" + g.id, 0) || 0);
      fb.firestore().collection("groups").doc(g.id).collection("alerts")
        .orderBy("created_at", "desc").limit(1).get().then(function (snap) {
          if (snap.size) {
            var t = Date.parse(snap.docs[0].data().created_at);
            if (!isNaN(t) && t > lastSeen) { lastSeen = t; DB.set("sos_last_" + g.id, t); }
          }
        }).catch(function () {});
      sosWatcher = fb.firestore().collection("groups").doc(g.id).collection("alerts")
        .orderBy("created_at", "desc").limit(5)
        .onSnapshot(function (snap) {
          snap.docChanges().forEach(function (ch) {
            if (ch.type !== "added") return;
            var a = ch.doc.data();
            var t = Date.parse(a.created_at);
            if (isNaN(t) || t <= lastSeen) return;
            lastSeen = t;
            DB.set("sos_last_" + g.id, lastSeen);
            APP.getUser().then(function (u) {
              if (!u || u.id === a.uid) return;
              APP.showSOSPopup({ uid: a.uid, type: a.type, message: a.message || "", lat: a.lat, lng: a.lng, created_at: a.created_at, name: a.user_name });
            }).catch(function () {});
          });
        }, function () {});
    }).catch(function () {});
  };

  function demoWatchSOS(gid) {
    var seen = {};
    DB.get("alerts", []).filter(function (a) { return a.group_id === gid; }).forEach(function (a) { seen[a.id] = true; });
    sosPoll = setInterval(function () {
      var users = DB.get("users", []);
      DB.get("alerts", []).filter(function (a) { return a.group_id === gid && !seen[a.id]; }).forEach(function (a) {
        seen[a.id] = true;
        if (a.user_id === "me") return;
        var u = users.find(function (x) { return x.id === a.user_id; }) || {};
        APP.showSOSPopup({ uid: a.user_id, type: a.type, message: a.message || "", lat: a.lat, lng: a.lng, created_at: a.created_at, name: u.full_name });
      });
    }, 3000);
  }

  APP.showSOSPopup = function (a) {
    var existing = document.getElementById("sosPopup");
    if (existing) existing.remove();
    var type = a.type === "mechanical" ? "a mechanical SOS" : "an SOS alert";
    var when = APP.timeAgo(a.created_at) || "just now";
    var loc = (a.lat != null && a.lng != null)
      ? '<a class="sos-loc" href="https://www.google.com/maps?q=' + a.lat + "," + a.lng + '" target="_blank" rel="noopener"><i class="fa-solid fa-location-dot"></i> ' + Number(a.lat).toFixed(4) + ", " + Number(a.lng).toFixed(4) + '</a>'
      : '<span class="sos-loc muted"><i class="fa-solid fa-location-dot"></i> Location unavailable</span>';
    var overlay = document.createElement("div");
    overlay.id = "sosPopup";
    overlay.className = "modal-overlay";
    overlay.innerHTML =
      '<div class="modal sos-modal">' +
        '<div class="modal-head"><h3><i class="fa-solid fa-siren" style="color:#f43f5e;margin-right:8px"></i>SOS Alert</h3>' +
          '<button class="modal-close" id="sosClose" style="background:none;border:none;color:var(--text-600);font-size:1.1rem;cursor:pointer;padding:4px 8px"><i class="fa-solid fa-xmark"></i></button></div>' +
        '<div class="modal-body">' +
          '<div style="display:flex;gap:12px;align-items:flex-start">' +
            '<div class="icon-box icon-red" style="width:42px;height:42px;font-size:1.05rem;flex:none"><i class="fa-solid fa-triangle-exclamation"></i></div>' +
            '<div style="min-width:0">' +
              '<div style="font-size:1rem;font-weight:600;color:#fff">' + APP.escapeHtml(a.name || "A member") + " sent " + type + "</div>" +
              (a.message ? '<div style="font-size:.85rem;color:var(--text-300);margin-top:4px">"' + APP.escapeHtml(a.message) + '"</div>' : "") +
              '<div style="font-size:.78rem;color:var(--text-600);margin-top:6px"><i class="fa-solid fa-clock"></i> ' + when + "</div>" +
            '</div>' +
          '</div>' +
          '<div style="margin-top:14px;padding:12px 14px;background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.25);border-radius:14px;font-size:.85rem;color:var(--text-200)">' + loc + "</div>" +
        '</div>' +
        '<div class="modal-foot">' +
          '<a class="btn btn-ghost" href="emergency.html">View alerts</a>' +
          '<a class="btn btn-accent" href="map.html"><i class="fa-solid fa-map-location-dot"></i> Open group map</a>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    function close() { overlay.remove(); document.removeEventListener("keydown", onEsc); }
    function onEsc(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onEsc);
    overlay.addEventListener("click", function (e) { if (e.target === overlay || e.target.id === "sosClose") close(); });
  };

  APP.uploadProfile = function (updates) {
    if (!IS_DEMO) {
      return APP.getUser().then(function (u) {
        return fb.firestore().collection("profiles").doc(u.id).set(updates, { merge: true });
      });
    }
    var users = DB.get("users", []);
    var me = users.find(function (x) { return x.id === "me"; });
    if (me) {
      Object.assign(me, updates);
      DB.set("users", users);
      var s = DB.get("session", null);
      if (s) { s.full_name = me.full_name; s.email = me.email; DB.set("session", s); }
    }
    return Promise.resolve({});
  };

  window.RSApp = APP;
  APP.DB = DB;
})();
