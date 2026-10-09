(function () {
  var A = window.RSApp;

  var sosBtn = document.getElementById("sosHold");
  if (sosBtn) {
    var pressTimer = null;
    var pressStart = 0;
    var sosType = "mechanical";

    document.querySelectorAll("[data-sos-type]").forEach(function (tab) {
      tab.addEventListener("click", function () {
        document.querySelectorAll("[data-sos-type]").forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        sosType = tab.dataset.sosType;
      });
    });

    function fireSOS() {
      A.getActiveGroup().then(function (g) {
        var status = document.getElementById("sosStatus");
        status.innerHTML = '<div class="alert alert-danger"><i class="fa-solid fa-siren"></i><div><strong>SOS alert sent to ' + (g ? g.name : "your group") + "!</strong><br><span style='font-size:.82rem'>Your live location was attached. Contacts are being notified.</span></div></div>";
        var loc = null;
        if (navigator.geolocation && !A.IS_DEMO) {
          try {
            loc = { lat: null, lng: null };
            navigator.geolocation.getCurrentPosition(function (p) {
              loc.lat = p.coords.latitude;
              loc.lng = p.coords.longitude;
              send(loc);
            }, function () { send(loc); }, { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 });
            return;
          } catch (e) { /* fall through */ }
        }
        send(loc);
        function send(l) {
          A.sendSOS({ group_id: g ? g.id : null, type: sosType, message: "SOS " + sosType + " alert triggered", lat: l ? l.lat : null, lng: l ? l.lng : null }).then(function () {
            A.toast("SOS alert sent to your crew and contacts.", "success");
            loadAlerts();
          });
        }
      });
    }

    sosBtn.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      pressStart = Date.now();
      sosBtn.style.transform = "scale(.96)";
      pressTimer = setTimeout(fireSOS, 3000);
    });
    sosBtn.addEventListener("pointerup", function () {
      clearTimeout(pressTimer);
      sosBtn.style.transform = "";
    });
    sosBtn.addEventListener("pointerleave", function () {
      clearTimeout(pressTimer);
      sosBtn.style.transform = "";
    });
  }

  function loadAlerts() {
    var list = document.getElementById("alertsList");
    if (!list) return;
    A.getActiveGroup().then(function (g) {
      if (!g) {
        list.innerHTML = '<div class="empty"><i class="fa-solid fa-users-slash"></i><h4>No active group</h4></div>';
        return;
      }
      return A.fetchAlerts(g.id).then(function (alerts) {
        if (!alerts.length) {
          list.innerHTML = '<div class="empty"><i class="fa-solid fa-bell-slash"></i><h4>No alerts yet</h4><p style="font-size:.85rem">Your sent alerts will show up here.</p></div>';
          return;
        }
        list.innerHTML = alerts.slice(0, 10).map(function (a) {
          return '<div class="member-row">' +
            '<div class="icon-box icon-red" style="width:36px;height:36px;font-size:.85rem"><i class="fa-solid fa-siren"></i></div>' +
            '<div class="minfo"><strong style="font-size:.88rem">' + A.capitalize(a.type || "SOS") + " alert sent</strong>" +
            '<span>' + A.escapeHtml(a.message || "") + (a.lat ? " · " + a.lat.toFixed(3) + ", " + a.lng.toFixed(3) : "") + "</span></div>" +
            '<span class="badge badge-green"><span class="badge-dot pulse-dot"></span>' + A.timeAgo(a.created_at || Date.now()) + "</span>" +
          "</div>";
        }).join("");
      });
    });
  }

  var clearBtn = document.getElementById("clearAlerts");
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      A.getActiveGroup().then(function (g) {
        if (!g) { A.toast("No active group.", "error"); return; }
        A.clearAlerts(g.id).then(function () {
          loadAlerts();
          A.toast("Alert history cleared.", "info");
        }).catch(function (err) {
          A.toast((err && err.message) || "Could not clear alerts.", "error");
        });
      });
    });
  }

  var contactsList = document.getElementById("contactsList");
  if (contactsList) {
    A.requireAuth().then(function () {
      A.renderShell("contacts", "Emergency Contacts");
      loadContacts();
    });
  }

  if (sosBtn && !contactsList) {
    A.requireAuth().then(function () {
      A.renderShell("emergency", "SOS Emergency");
      loadAlerts();
    });
  }

  function loadContacts() {
    A.fetchContacts().then(function (contacts) {
      var count = document.getElementById("contactCount");
      count.textContent = contacts.length;
      if (!contacts.length) {
        contactsList.innerHTML = '<div class="empty"><i class="fa-solid fa-address-card"></i><h4>No contacts saved</h4><p style="font-size:.85rem">Add people to notify during an emergency.</p></div>';
        return;
      }
      contactsList.innerHTML = contacts.map(function (c) {
        return '<div class="contact-row" data-id="' + c.id + '">' +
          A.avatarHtml(c.name, "", c.name, c.is_emergency) +
          '<div class="cinfo"><strong>' + A.escapeHtml(c.name) + (c.is_emergency ? ' <span class="badge badge-red" style="margin-left:6px"><i class="fa-solid fa-bolt"></i> Emergency</span>' : "") + "</strong>" +
          '<span><i class="fa-solid fa-phone"></i> ' + A.escapeHtml(c.phone) + " · " + A.escapeHtml(c.relation) + "</span></div>" +
          '<button class="btn btn-icon btn-ghost" data-edit="' + c.id + '" title="Edit"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn btn-icon btn-ghost" data-del="' + c.id + '" title="Remove" style="color:#fca5a5"><i class="fa-solid fa-trash"></i></button>' +
        "</div>";
      }).join("");
      contactsList.querySelectorAll("[data-del]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.dataset.del;
          A.fetchContacts().then(function (cs) {
            return A.saveContacts(cs.filter(function (c) { return c.id !== id; })).then(function () {
              A.toast("Contact removed.", "info");
              loadContacts();
            });
          });
        });
      });
      contactsList.querySelectorAll("[data-edit]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.dataset.edit;
          A.fetchContacts().then(function (cs) {
            var c = cs.find(function (x) { return x.id === id; });
            if (c) openContactModal(c);
          });
        });
      });
    });
  }

  var modal = document.getElementById("contactModal");
  var editId = null;
  function openContactModal(c) {
    editId = c ? c.id : null;
    document.getElementById("contactModalTitle").textContent = c ? "Edit contact" : "Add contact";
    document.getElementById("cName").value = c ? c.name : "";
    document.getElementById("cPhone").value = c ? c.phone : "";
    document.getElementById("cRelation").value = c ? c.relation : "Family";
    document.getElementById("cEmergency").checked = c ? !!c.is_emergency : true;
    modal.classList.remove("hidden");
  }
  var addBtn = document.getElementById("addContactBtn");
  if (addBtn) addBtn.addEventListener("click", function () { openContactModal(null); });
  var closeBtn = document.getElementById("contactModalClose");
  if (closeBtn) closeBtn.addEventListener("click", function () { modal.classList.add("hidden"); });
  var cancelBtn = document.getElementById("contactCancel");
  if (cancelBtn) cancelBtn.addEventListener("click", function () { modal.classList.add("hidden"); });
  var form = document.getElementById("contactForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("cName").value.trim();
      var phone = document.getElementById("cPhone").value.trim();
      if (!name || !phone) { A.toast("Name and phone are required.", "error"); return; }
      A.fetchContacts().then(function (cs) {
        var updated;
        if (editId) {
          updated = cs.map(function (c) {
            return c.id === editId ? { id: c.id, name: name, phone: phone, relation: document.getElementById("cRelation").value, is_emergency: document.getElementById("cEmergency").checked } : c;
          });
        } else {
          cs.push({ id: A.DB.uid("ct"), name: name, phone: phone, relation: document.getElementById("cRelation").value, is_emergency: document.getElementById("cEmergency").checked });
          updated = cs;
        }
        return A.saveContacts(updated).then(function () {
          modal.classList.add("hidden");
          A.toast(editId ? "Contact updated." : "Contact added.", "success");
          loadContacts();
        });
      });
    });
  }

  if (sosBtn || document.getElementById("contactsList")) loadAlerts();
})();
