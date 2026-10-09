(function () {
  var A = window.RSApp;

  function stat(icon, fa, label, real) {
    return '<div class="card stat-card">' +
      '<div class="icon-box ' + icon + '" style="width:52px;height:52px;font-size:1.2rem"><i class="fa-solid ' + fa + '"></i></div>' +
      '<div class="stat-info"><h4>' + real + "</h4><p>" + label + "</p></div></div>";
  }

  function showError(input, msg) {
    input.classList.add("input-error");
    var hint = input.closest(".field") ? input.closest(".field").querySelector(".hint") : null;
    if (hint) hint.textContent = msg;
  }

  var createForm = document.getElementById("createGroupForm");
  if (createForm) {
    var preview = document.getElementById("previewCode");
    var gName = document.getElementById("groupName");
    if (preview) preview.textContent = A.code(6);
    createForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("groupName");
      name.classList.remove("input-error");
      var hint = name.closest(".field").querySelector(".hint");
      if (hint) hint.textContent = "";
      if (name.value.trim().length < 3) { showError(name, "Group name needs at least 3 characters."); return; }
      var btn = createForm.querySelector("button[type=submit]");
      btn.disabled = true;
      A.createGroup({
        name: name.value.trim(),
        vehicle_type: document.getElementById("vehicleType").value,
        destination: document.getElementById("destination").value.trim()
      }).then(function (g) {
        A.toast("Group created! Share your code.", "success");
        window.location.replace("group-dashboard.html?id=" + encodeURIComponent(g.id));
      }).catch(function (err) {
        btn.disabled = false;
        A.toast(err.message || "Could not create group.", "error");
      });
    });
  }

  var joinForm = document.getElementById("joinGroupForm");
  if (joinForm) {
    joinForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = document.getElementById("joinCode");
      var btn = joinForm.querySelector("button[type=submit]");
      if (!input.value.trim()) { showError(input, "Enter the group code."); return; }
      btn.disabled = true;
      A.joinGroup(input.value.trim()).then(function (g) {
        A.toast("Welcome to " + g.name + "!", "success");
        window.location.replace("group-dashboard.html?id=" + encodeURIComponent(g.id));
      }).catch(function (err) {
        btn.disabled = false;
        showError(input, "");
        A.toast(err.message || "Could not join group.", "error");
      });
    });
  }

  var groupDash = document.getElementById("groupStats");
  if (groupDash) {
    A.requireAuth().then(function () {
      return A.getActiveGroup().then(function (g) {
        if (!g) return;
        A.setActiveGroupId(g.id);
        A.renderShell("group", "Group Dashboard", g.name);
        var manageLink = document.getElementById("manageLink");
        if (manageLink) manageLink.style.display = g.role === "admin" ? "" : "none";
        document.getElementById("groupName").textContent = g.name;
        document.getElementById("groupMeta").textContent = (g.vehicle_type || "Convoy") + " · created by " + A.escapeHtml(g.created_by_name || "You") + " · " + g.members_count + " members";
        document.getElementById("groupCode").value = g.code;
        var copyBtn = document.getElementById("copyBtn");
        var copyCodeBtn = document.getElementById("copyCodeBtn");
        function copy() {
          navigator.clipboard.writeText(g.code).then(function () { A.toast("Group code copied!", "success"); });
        }
        if (copyBtn) copyBtn.addEventListener("click", copy);
        if (copyCodeBtn) copyCodeBtn.addEventListener("click", copy);

        return Promise.all([A.fetchMembers(g.id), A.fetchMessages(g.id), A.fetchExpenses(g.id), A.fetchPhotos(g.id)]).then(function (r) {
          var members = r[0], msgs = r[1], exps = r[2], photos = r[3];
          var online = members.filter(function (m) { return A.memberOnline(m); });
          var total = exps.reduce(function (s, e) { return s + Number(e.amount); }, 0);
          document.getElementById("groupStats").innerHTML =
            stat("icon-indigo", "fa-users", "Members", members.length) +
            stat("icon-cyan", "fa-signal", "Online now", online.length) +
            stat("icon-green", "fa-comment", "Messages", msgs.length) +
            stat("icon-amber", "fa-wallet", "Trip expenses", A.money(total));
          var mc = document.getElementById("memberCount");
          if (mc) mc.innerHTML = '<span class="badge-dot pulse-dot"></span>' + members.length;

          var live = document.getElementById("membersList") || document.getElementById("liveNow");
          if (!members.length) live.innerHTML = '<div class="empty"><i class="fa-solid fa-users-slash"></i><h4>No members yet</h4></div>';
          else A.getUser().then(function (usr) {
            var meId = usr ? usr.id : "me";
            var sorted = members.slice().sort(function (a, b) {
              var ao = A.memberOnline(a) ? 0 : 1, bo = A.memberOnline(b) ? 0 : 1;
              if (ao !== bo) return ao - bo;
              return (a.full_name || "").localeCompare(b.full_name || "");
            });
            live.innerHTML = sorted.map(function (m) {
              var isMe = m.user_id === meId;
              var eff = A.memberOnline(m) ? m.status : "offline";
              var sub = m.email || "";
              if (m.role === "admin") sub = '<i class="fa-solid fa-shield-halved"></i> Admin' + (sub ? " · " + A.escapeHtml(sub) : "");
              return '<div class="member-row" style="padding:10px 8px">' +
                A.avatarHtml(m.full_name, "sm", m.user_id, A.memberOnline(m), m.avatar_url) +
                '<div class="minfo"><strong style="font-size:.88rem">' + A.escapeHtml(m.full_name) + (isMe ? ' <span class="small muted">(you)</span>' : "") + "</strong>" +
                '<span>' + sub + "</span></div>" +
                '<span class="badge ' + A.statusInfo(eff).badge + '"><i class="fa-solid ' + A.statusInfo(eff).icon + '" style="margin-right:5px"></i>' + A.statusInfo(eff).label + "</span>" +
              "</div>";
            }).join("");
          });

          var feed = document.getElementById("activityFeed");
          var items = [];
          msgs.slice(-4).forEach(function (m) { items.push({ t: m.created_at, icon: "fa-comment-dots", color: "icon-cyan", text: "<strong>" + A.escapeHtml(m.full_name) + "</strong> sent a message" }); });
          photos.slice(0, 4).forEach(function (p) { items.push({ t: p.created_at, icon: "fa-camera", color: "icon-pink", text: "<strong>" + A.escapeHtml(p.full_name) + "</strong> shared a photo" }); });
          exps.slice(0, 4).forEach(function (e) { items.push({ t: e.created_at, icon: "fa-wallet", color: "icon-amber", text: "<strong>" + A.escapeHtml(e.paid_by_name) + "</strong> logged " + A.money(e.amount) + " — " + A.escapeHtml(e.title) }); });
          items.sort(function (a, b) { return new Date(b.t) - new Date(a.t); });
          if (!items.length) feed.innerHTML = '<div class="empty"><i class="fa-solid fa-water"></i><h4>No activity yet</h4><p style="font-size:.85rem">Messages, photos and expenses will appear here.</p></div>';
          else feed.innerHTML = items.slice(0, 8).map(function (it) {
            return '<div style="display:flex;gap:12px;padding:10px 6px;border-bottom:1px solid var(--line)">' +
              '<div class="icon-box ' + it.color + '" style="width:34px;height:34px;font-size:.8rem"><i class="fa-solid ' + it.icon + '"></i></div>' +
              '<div style="flex:1;font-size:.87rem;color:var(--text-300)">' + it.text +
              '<div style="font-size:.72rem;color:var(--text-600)">' + A.timeAgo(it.t) + "</div></div>" +
            "</div>";
          }).join("");
        }).catch(function (err) {
          console.error("[group dashboard] load failed:", err);
          A.toast((err && err.message) || "Could not load group data.", "error");
        });
      });
    });
  }

  function memberRow(m, currentUserId, isAdmin) {    var dot = A.memberOnline(m) ? true : false;
    var eff = A.memberOnline(m) ? m.status : "offline";
    var isMe = m.user_id === currentUserId;
    var actions = "";
    if (isAdmin && !isMe) {
      actions = '<div class="flex gap-8">' +
        '<select class="select" style="width:auto;padding:7px 30px 7px 10px;font-size:.78rem" data-role="' + m.id + '" data-uid="' + m.user_id + '">' +
        '<option value="member"' + (m.role === "member" ? " selected" : "") + '>Member</option>' +
        '<option value="admin"' + (m.role === "admin" ? " selected" : "") + '>Admin</option>' +
        "</select>" +
        '<button class="btn btn-danger btn-sm" data-remove="' + m.user_id + '" data-name="' + A.escapeAttr(m.full_name) + '" title="Remove from group"><i class="fa-solid fa-user-slash"></i></button>' +
      "</div>";
    }
    return '<div class="member-row">' +
      A.avatarHtml(m.full_name, "", m.user_id, dot, m.avatar_url) +
      '<div class="minfo"><strong>' + A.escapeHtml(m.full_name) + (isMe ? ' <span class="small muted">(you)</span>' : "") + "</strong>" +
      '<span>' + A.escapeHtml(m.email || "") + "</span></div>" +
      '<span class="badge ' + A.statusInfo(eff).badge + '"><i class="fa-solid ' + A.statusInfo(eff).icon + '" style="margin-right:5px"></i>' + A.statusInfo(eff).label + "</span>" +
      (m.role === "admin" ? '<span class="role-pill role-admin">Admin</span>' : '<span class="role-pill role-member">Member</span>') +
      actions +
    "</div>";
  }

  function kickConfirm(name, uid, gid, row) {
    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.zIndex = "2200";
    overlay.innerHTML =
      '<div class="modal" style="width:min(400px,100%)">' +
        '<div class="modal-head"><h3><i class="fa-solid fa-user-slash" style="color:var(--danger)"></i> Remove member?</h3>' +
        '<button class="btn btn-icon btn-ghost" data-close="1" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
        '<div class="modal-body"><p style="font-size:.9rem;color:var(--text-300)">' +
        A.escapeHtml(name) + " will be removed from the group immediately. They can rejoin later with the group code.</p></div>" +
        '<div class="modal-foot"><button class="btn btn-outline" data-close="1">Cancel</button>' +
        '<button class="btn btn-danger" data-go="1"><i class="fa-solid fa-user-slash"></i> Remove member</button></div>' +
      "</div>";
    document.body.appendChild(overlay);
    function close() { overlay.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target.closest("[data-close]")) close();
    });
    overlay.querySelector("[data-go]").addEventListener("click", function () {
      var btn = this;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner spin"></i> Removing…';
      A.removeMember(gid, uid).then(function () {
        A.toast("Member removed.", "info");
        close();
        if (row) row.remove();
      }).catch(function (err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-user-slash"></i> Remove member';
        A.toast((err && err.message) || "Could not remove member.", "error");
      });
    });
  }

  function loadMemberList(listEl, opts) {
    A.getActiveGroup().then(function (g) {
      if (!g) { listEl.innerHTML = '<div class="empty"><i class="fa-solid fa-users-slash"></i><h4>No active group</h4></div>'; return; }
      return A.getUser().then(function (u) {
        return A.fetchMembers(g.id).then(function (members) {
          if (!members.length) {
            listEl.innerHTML = '<div class="empty"><i class="fa-solid fa-users"></i><h4>No members yet</h4><p style="font-size:.85rem">Share your code so the crew can join.</p></div>';
            return;
          }
          var me = members.find(function (m) { return m.user_id === (u ? u.id : "me"); });
          var isAdmin = me && me.role === "admin";
          listEl.innerHTML = members.map(function (m) {
            return memberRow(m, u ? u.id : "me", isAdmin);
          }).join("");

          if (isAdmin && opts && opts.manage) {
            listEl.querySelectorAll("[data-role]").forEach(function (sel) {
              sel.addEventListener("change", function () {
                var uid = sel.dataset.uid;
                A.updateMemberRole(g.id, uid, sel.value).then(function () {
                  A.toast("Role updated.", "success");
                });
              });
            });
            listEl.querySelectorAll("[data-remove]").forEach(function (btn) {
              btn.addEventListener("click", function () {
                var uid = btn.dataset.remove;
                var name = btn.dataset.name;
                var target = members.find(function (m) { return m.user_id === uid; });
                if (target && target.role === "admin") {
                  A.toast("Admins can't be removed — change their role to Member first.", "error");
                  return;
                }
                kickConfirm(name || "This member", uid, g.id, btn.closest(".member-row"));
              });
            });
          }
        });
      });
    });
  }

  var mgmtList = document.getElementById("membersManageList");
  if (mgmtList) {
    A.requireAuth().then(function () {
      A.renderShell("group", "Group Management");
      A.getActiveGroup().then(function (g) { if (g) A.renderShell("group", "Group Management", g.name); });
      loadMemberList(mgmtList, { manage: true });
    });
  }

  var statusList = document.getElementById("memberStatusList");
  var statusChips = document.getElementById("myStatusChips");

  function updateStatusStats(gid) {
    A.fetchMembers(gid).then(function (members) {
      var c = { online: 0, riding: 0, paused: 0, offline: 0 };
      members.forEach(function (m) {
        var s = A.memberOnline(m) ? m.status : "offline";
        if (s === "online" || s === "away") c.online++;
        else if (s === "riding") c.riding++;
        else if (s === "fueling" || s === "resting" || s === "eating" || s === "stopped") c.paused++;
        else if (s === "offline") c.offline++;
      });
      var stOnline = document.getElementById("stOnline");
      var stDriving = document.getElementById("stDriving");
      var stAway = document.getElementById("stAway");
      var stOffline = document.getElementById("stOffline");
      if (stOnline) stOnline.textContent = c.online;
      if (stDriving) stDriving.textContent = c.riding;
      if (stAway) stAway.textContent = c.paused;
      if (stOffline) stOffline.textContent = c.offline;
    });
  }

  function renderStatusChips(gid, uid) {
    if (!statusChips) return;
    A.fetchMembers(gid).then(function (members) {
      var me = members.find(function (m) { return m.user_id === uid; });
      var current = (me && me.status) || "online";
      var keys = ["riding", "fueling", "resting", "eating", "stopped", "online", "away", "offline"];
      statusChips.innerHTML = keys.map(function (k) {
        var info = A.statusInfo(k);
        return '<button type="button" class="status-chip' + (k === current ? " active" : "") + '" data-status="' + k + '">' +
          '<i class="fa-solid ' + info.icon + '"></i> ' + info.label + "</button>";
      }).join("");
      statusChips.querySelectorAll(".status-chip").forEach(function (chip) {
        chip.addEventListener("click", function () {
          var k = chip.dataset.status;
          if (k === current) return;
          A.updateMemberStatus(gid, uid, k).then(function () {
            current = k;
            statusChips.querySelectorAll(".status-chip").forEach(function (c) { c.classList.toggle("active", c.dataset.status === k); });
            A.toast("Status set to " + A.statusInfo(k).label + ".", "success");
            if (statusList) loadMemberList(statusList, { manage: false });
            updateStatusStats(gid);
          }).catch(function (err) {
            A.toast((err && err.message) || "Could not update status.", "error");
          });
        });
      });
    });
  }

  if (statusList) {
    A.requireAuth().then(function () {
      A.renderShell("status", "Member Status");
      A.getActiveGroup().then(function (g) {
        if (g) A.renderShell("status", "Member Status", g.name);
        if (!g) return;
        loadMemberList(statusList, { manage: false });
        updateStatusStats(g.id);
        A.getUser().then(function (u) {
          renderStatusChips(g.id, u ? u.id : "me");
        });
        setInterval(function () {
          loadMemberList(statusList, { manage: false });
          updateStatusStats(g.id);
        }, 8000);
      });
    });
  }

  var settingsForm = document.getElementById("groupSettingsForm");
  if (settingsForm) {
    A.requireAuth().then(function () {
      A.renderShell("settings", "Group Settings");
      A.getActiveGroup().then(function (g) {
        if (!g) return;
        A.renderShell("settings", "Group Settings", g.name);
        document.getElementById("sGroupName").value = g.name;
        document.getElementById("sVehicleType").value = g.vehicle_type || "Convoy";
        document.getElementById("sGroupCode").value = g.code;
        var role = document.getElementById("sMyRole");
        if (role) role.textContent = g.role === "admin" ? "Admin (full control)" : "Member (limited)";
        if (g.role !== "admin") {
          settingsForm.querySelector("button[type=submit]").disabled = true;
          A.toast("Only admins can change group settings.", "info");
        }
      });
    });
    settingsForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("sGroupName").value.trim();
      if (name.length < 3) { A.toast("Group name needs at least 3 characters.", "error"); return; }
      A.getActiveGroup().then(function (g) {
        if (!g) return;
        return A.updateGroup(g.id, { name: name, vehicle_type: document.getElementById("sVehicleType").value }).then(function () {
          A.toast("Settings saved.", "success");
        });
      });
    });
  }

  var regenBtn = document.getElementById("sRegenCode");
  if (regenBtn) {
    regenBtn.addEventListener("click", function () {
      var code = A.code(6);
      document.getElementById("sGroupCode").value = code;
      A.getActiveGroup().then(function (g) {
        if (!g) return;
        return A.updateGroup(g.id, { code: code }).then(function () {
          A.toast("New code generated: " + code, "info");
        });
      });
    });
  }

  var leaveBtn = document.getElementById("sLeaveGroup");
  if (leaveBtn) {
    leaveBtn.addEventListener("click", function () {
      A.getActiveGroup().then(function (g) {
        if (!g) return;
        return A.leaveGroup(g.id).then(function () {
          A.toast("You left " + g.name + ".", "info");
          setTimeout(function () { window.location.replace("home.html"); }, 900);
        });
      });
    });
  }
})();
