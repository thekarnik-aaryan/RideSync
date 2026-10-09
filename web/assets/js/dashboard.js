(function () {
  var A = window.RSApp;

  function groupCard(g) {
    var lastActive = A.timeAgo(g.created_at);
    return '<div class="card" style="padding:18px;margin-bottom:14px">' +
      '<div class="flex-between" style="flex-wrap:wrap;gap:10px">' +
        '<div class="flex gap-12">' +
          '<div class="icon-box icon-indigo" style="width:46px;height:46px;font-size:1.1rem"><i class="fa-solid fa-users"></i></div>' +
          '<div>' +
            '<strong style="font-size:.98rem;font-family:var(--font-head)">' + A.escapeHtml(g.name) + "</strong>" +
            '<div style="font-size:.78rem;color:var(--text-600);margin-top:2px">' +
              g.members_count + " members · code <span style='font-family:monospace;color:#a5b4fc'>" + A.escapeHtml(g.code) + "</span>" +
            "</div>" +
          "</div>" +
        "</div>" +
        '<div class="flex gap-8">' +
          '<a href="group-dashboard.html?id=' + encodeURIComponent(g.id) + '" class="btn btn-outline btn-sm">Open</a>' +
          '<a href="map.html?id=' + encodeURIComponent(g.id) + '" class="btn btn-sm" style="background:rgba(34,211,238,.12);border:1px solid rgba(34,211,238,.35);color:#67e8f9">Live map</a>' +
        "</div>" +
      "</div>" +
    "</div>";
  }

  function load() {
    A.requireAuth().then(function (u) {
      A.renderShell("home", "Dashboard");
      if (u) document.getElementById("userName").textContent = (u.full_name || "rider").split(" ")[0];
      return A.fetchGroups();
    }).then(function (groups) {
      var count = document.getElementById("groupCount");
      var list = document.getElementById("groupsList");
      count.textContent = groups.length + " group" + (groups.length === 1 ? "" : "s");
      loadStats(null, groups.length);

      if (!groups.length) {
        list.innerHTML = '<div class="empty">' +
          '<i class="fa-solid fa-people-group"></i><h4>No groups yet</h4>' +
          '<p style="font-size:.85rem">Create your first convoy or join one with a code to get rolling.</p>' +
          '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px">' +
            '<a href="create-group.html" class="btn btn-primary btn-sm">Create group</a>' +
            '<a href="join-group.html" class="btn btn-outline btn-sm">Join group</a>' +
          "</div></div>";
      } else {
        list.innerHTML = groups.map(groupCard).join("");
        var first = groups[0];
        A.setActiveGroupId(first.id);
        var ride = document.getElementById("activeRide");
        ride.innerHTML =
          '<div class="flex gap-12" style="margin-bottom:14px">' +
            '<div class="icon-box icon-green" style="width:42px;height:42px"><i class="fa-solid fa-car-side"></i></div>' +
            '<div><strong style="font-size:.92rem">' + A.escapeHtml(first.name) + "</strong>" +
            '<div style="font-size:.78rem;color:var(--text-600)">' + first.members_count + " members · " + A.escapeHtml(first.vehicle_type || "Convoy") + "</div></div>" +
          "</div>" +
          '<a href="group-dashboard.html?id=' + encodeURIComponent(first.id) + '" class="btn btn-accent btn-block btn-sm">View group dashboard</a>';
        loadStats(first.id, groups.length);
      }
    }).catch(function (err) {
      console.error("[dashboard] load failed:", err);
      var list = document.getElementById("groupsList");
      if (list) {
        list.innerHTML = '<div class="empty"><i class="fa-solid fa-triangle-exclamation"></i><h4>Could not load your groups</h4>' +
          '<p style="font-size:.85rem">' + A.escapeHtml((err && err.message) || "Something went wrong. Check the console (F12).") + "</p></div>";
      }
    });
  }

  function loadStats(groupId, groupsCount) {
    if (!groupId) {
      var grid = document.getElementById("statsGrid");
      grid.innerHTML = stat("icon-indigo", "fa-users", "Active groups", groupsCount) +
        stat("icon-cyan", "fa-signal", "Members online", 0) +
        stat("icon-green", "fa-comment", "New messages", 0) +
        stat("icon-amber", "fa-wallet", "Spent this trip", A.money(0));
      return;
    }
    Promise.all([A.fetchMembers(groupId), A.fetchMessages(groupId), A.fetchExpenses(groupId)]).then(function (res) {
      var members = res[0], msgs = res[1], exps = res[2];
      var online = members.filter(function (m) { return A.memberOnline(m); }).length;
      var total = exps.reduce(function (s, e) { return s + Number(e.amount); }, 0);
      var grid = document.getElementById("statsGrid");
      grid.innerHTML =
        stat("icon-indigo", "fa-users", "Active groups", groupsCount) +
        stat("icon-cyan", "fa-signal", "Members online", online) +
        stat("icon-green", "fa-comment", "New messages", msgs.length) +
        stat("icon-amber", "fa-wallet", "Spent this trip", A.money(total));
    }).catch(function (err) {
      console.error("[dashboard] stats failed:", err);
    });
  }

  function stat(icon, fa, label, real) {
    return '<div class="card stat-card">' +
      '<div class="icon-box ' + icon + '" style="width:52px;height:52px;font-size:1.2rem"><i class="fa-solid ' + fa + '"></i></div>' +
      '<div class="stat-info"><h4>' + real + "</h4><p>" + label + "</p></div></div>";
  }

  if (document.getElementById("statsGrid")) load();
})();
