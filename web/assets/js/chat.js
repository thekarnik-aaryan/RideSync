(function () {
  var A = window.RSApp;
  var groupId = null;
  var me = null;
  var pollTimer = null;

  function msgHtml(m) {
    var mine = m.user_id === (me ? me.id : "me");
    var date = new Date(m.created_at).toDateString();
    return '<div class="msg ' + (mine ? "own" : "other") + '">' +
      (mine ? "" : A.avatarHtml(m.full_name || "?", "sm", m.user_id, true, m.avatar_url)) +
      '<div><div class="bubble">' + A.escapeHtml(m.content) + "</div>" +
      '<div class="meta"><span>' + (mine ? "You" : A.escapeHtml(m.full_name || "Member")) + "</span><span>" + A.formatTime(m.created_at) + "</span></div></div>" +
    "</div>";
  }

  function render() {
    if (!groupId) return;
    A.fetchMessages(groupId).then(function (msgs) {
      var log = document.getElementById("chatLog");
      var lastDate = null;
      var html = "";
      msgs.forEach(function (m) {
        var d = new Date(m.created_at).toDateString();
        if (d !== lastDate) {
          lastDate = d;
          html += '<div class="chat-day">' + new Date(m.created_at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + "</div>";
        }
        html += msgHtml(m);
      });
      log.innerHTML = html || '<div class="empty"><i class="fa-solid fa-comments"></i><h4>Say hi to your crew!</h4><p style="font-size:.85rem">No messages yet in this group.</p></div>';
      log.scrollTop = log.scrollHeight;
    });
  }

  function renderMembers(members) {
    var list = document.getElementById("chatMemberList");
    var online = members.filter(function (m) { return A.memberOnline(m); });
    document.getElementById("chatOnlineInfo").textContent = online.length + " of " + members.length + " online";
    list.innerHTML = members.map(function (m) {
      return '<div class="chat-member">' + A.avatarHtml(m.full_name, "sm", m.user_id, A.memberOnline(m), m.avatar_url) +
        A.escapeHtml(m.full_name) + A.roleTag(m) + "</div>";
    }).join("");
  }

  function load() {
    A.requireAuth().then(function (u) {
      me = u;
      return A.getActiveGroup().then(function (g) {
        if (!g) return;
        groupId = g.id;
        A.setActiveGroupId(g.id);
        A.renderShell("chat", "Group Chat", g.name);
        document.getElementById("chatGroupName").textContent = g.name;
        render();
        A.fetchMembers(g.id).then(renderMembers);
        pollTimer = setInterval(function () { render(); }, 5000);
        setInterval(function () { A.fetchMembers(groupId).then(renderMembers); }, 8000);
      });
    });
  }

  var form = document.getElementById("chatForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = document.getElementById("chatInput");
      var text = input.value.trim();
      if (!text) return;
      A.sendMessage(groupId, text).then(function () {
        input.value = "";
        input.style.height = "auto";
        render();
      });
    });
    var ta = document.getElementById("chatInput");
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 110) + "px";
    });
  }

  if (window.visualViewport && window.matchMedia('(max-width:900px)').matches) {
    var chatLayout = document.querySelector('.chat-layout');
    if (chatLayout) {
      window.visualViewport.addEventListener('resize', function () {
        var input = document.getElementById('chatInput');
        var kb = window.innerHeight - window.visualViewport.height;
        if (kb > 50) {
          var vh = window.visualViewport.height;
          chatLayout.style.height = (vh - 56) + 'px';
          if (input) requestAnimationFrame(function () { input.scrollIntoView({ block: 'end', behavior: 'instant' }); });
        } else {
          chatLayout.style.height = '';
        }
      });
    }
  }

  load();
})();
