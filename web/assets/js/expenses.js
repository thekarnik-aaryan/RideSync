(function () {
  var A = window.RSApp;
  var groupId = null;
  var me = null;
  var cat = "all";
  var catColors = { Fuel: "icon-cyan", Food: "icon-pink", Tolls: "icon-amber", Lodging: "icon-indigo", Other: "icon-gray" };
  var catIcon = { Fuel: "fa-gas-pump", Food: "fa-utensils", Tolls: "fa-route", Lodging: "fa-bed", Other: "fa-receipt" };

  function render() {
    if (!groupId) return;
    A.fetchExpenses(groupId).then(function (exps) {
      var list = document.getElementById("expenseList");
      var visible = cat === "all" ? exps : exps.filter(function (e) { return e.category === cat; });
      var total = exps.reduce(function (s, e) { return s + Number(e.amount); }, 0);
      var mine = exps.filter(function (e) { return e.paid_by === (me ? me.id : "me"); }).reduce(function (s, e) { return s + Number(e.amount); }, 0);
      var count = Math.max(1, (document.querySelectorAll("#chatMemberList .chat-member").length) || 5);
      A.fetchMembers(groupId).then(function (members) {
        count = members.length || 1;
        document.getElementById("expenseStats").innerHTML =
          stat("icon-indigo", "fa-coins", "Total spent", A.money(total)) +
          stat("icon-amber", "fa-scale-balanced", "Per person (equal split)", A.money(total / count)) +
          stat("icon-green", "fa-arrow-trend-down", "You've paid", A.money(mine)) +
          stat("icon-cyan", "fa-receipt", "Trip entries", exps.length);

        if (!visible.length) {
          list.innerHTML = '<div class="empty"><i class="fa-solid fa-receipt"></i><h4>No expenses logged</h4><p style="font-size:.85rem">Add fuel, food or tolls to start tracking.</p></div>';
          return;
        }
        list.innerHTML = visible.map(function (e) {
          var mineRow = e.paid_by === (me ? me.id : "me");
          return '<div class="expense-item">' +
            '<div class="icon-box ' + (catColors[e.category] || "icon-gray") + '" style="width:40px;height:40px;font-size:.9rem"><i class="fa-solid ' + (catIcon[e.category] || "fa-receipt") + '"></i></div>' +
            '<div class="expense-desc"><strong>' + A.escapeHtml(e.title) + "</strong>" +
            '<span>' + A.escapeHtml(e.paid_by_name) + " paid · split " + A.escapeHtml(e.split) + "</span></div>" +
            '<div style="text-align:right"><div class="expense-amount">' + A.money(e.amount) + "</div>" +
            '<button class="btn btn-ghost btn-sm" data-del="' + e.id + '" style="color:#fca5a5"><i class="fa-solid fa-trash"></i> Delete</button></div>' +
          "</div>";
        }).join("");
        list.querySelectorAll("[data-del]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            A.deleteExpense(groupId, btn.dataset.del).then(function () { A.toast("Expense deleted.", "info"); render(); }).catch(function (err) { A.toast(err.message || "Delete failed.", "error"); });
          });
        });
      });
    });
  }

  function stat(icon, fa, label, real) {
    return '<div class="card stat-card"><div class="icon-box ' + icon + '" style="width:44px;height:44px"><i class="fa-solid ' + fa + '"></i></div>' +
      '<div class="stat-info"><h4 style="font-size:1.2rem">' + real + "</h4><p>" + label + "</p></div></div>";
  }

  function load() {
    A.requireAuth().then(function (u) {
      me = u;
      return A.getActiveGroup().then(function (g) {
        if (!g) return;
        groupId = g.id;
        A.setActiveGroupId(g.id);
        A.renderShell("expenses", "Expenses", g.name);
        render();
      });
    });
  }

  var modal = document.getElementById("expenseModal");
  var addBtn = document.getElementById("addExpenseBtn");
  if (addBtn) {
    addBtn.addEventListener("click", function () {
      document.getElementById("eTitle").value = "";
      document.getElementById("eAmount").value = "";
      document.getElementById("eCategory").value = "Fuel";
      document.getElementById("eSplit").value = "equally";
      modal.classList.remove("hidden");
      document.getElementById("eTitle").focus();
    });
  }
  var close = document.getElementById("expenseModalClose");
  if (close) close.addEventListener("click", function () { modal.classList.add("hidden"); });
  var cancel = document.getElementById("expenseCancel");
  if (cancel) cancel.addEventListener("click", function () { modal.classList.add("hidden"); });

  var form = document.getElementById("expenseForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var title = document.getElementById("eTitle").value.trim();
      var amount = parseFloat(document.getElementById("eAmount").value);
      if (!title) { A.toast("Add a description.", "error"); return; }
      if (!(amount > 0)) { A.toast("Enter a valid amount.", "error"); return; }
      A.addExpense(groupId, {
        title: title,
        amount: amount,
        category: document.getElementById("eCategory").value,
        split: document.getElementById("eSplit").value
      }).then(function () {
        modal.classList.add("hidden");
        A.toast("Expense added.", "success");
        render();
      });
    });
  }

  document.querySelectorAll("[data-cat]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("[data-cat]").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      cat = btn.dataset.cat;
      render();
    });
  });

  load();
})();
