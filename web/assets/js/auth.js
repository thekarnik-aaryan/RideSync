(function () {
  var RS = window.RS;
  var DB = RS.DB;
  var IS_DEMO = RS.IS_DEMO;
  var fb = RS.fb;

  function setLoading(btn, loading) {
    if (!btn) return;
    var icon = btn.querySelector("i, svg");
    if (loading) {
      btn.dataset.orig = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner spin"></i> Please wait...';
      btn.disabled = true;
    } else {
      btn.innerHTML = btn.dataset.orig || btn.innerHTML;
      btn.disabled = false;
    }
  }

  function showError(input, msg) {
    input.classList.add("input-error");
    var hint = input.closest(".field") ? input.closest(".field").querySelector(".hint") : null;
    if (hint) hint.textContent = msg;
  }
  function clearError(input) {
    input.classList.remove("input-error");
  }

  function firebaseError(err) {
    var APP = window.RSApp;
    if (APP && APP.friendlyError) return APP.friendlyError(err);
    return (err && err.message) || "Something went wrong.";
  }

  function ensureProfile(u) {
    var db = fb.firestore();
    var uid = u.uid;
    return db.collection("profiles").doc(uid).get().then(function (snap) {
      if (snap.exists) {
        var existing = snap.data();
        return db.collection("profiles").doc(uid).set({
          full_name: u.displayName || existing.full_name || "",
          avatar_url: u.photoURL || existing.avatar_url || null
        }, { merge: true }).then(function () {
          return Object.assign({}, existing, { full_name: u.displayName || existing.full_name, avatar_url: u.photoURL || existing.avatar_url || null });
        });
      }
      var data = {
        full_name: u.displayName || (u.email || "").split("@")[0],
        email: u.email || "",
        avatar_url: u.photoURL || null,
        created_at: new Date().toISOString(),
        emergency_contacts: []
      };
      return db.collection("profiles").doc(uid).set(data).then(function () { return data; });
    });
  }

  var loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("email");
      var pass = document.getElementById("password");
      clearError(email); clearError(pass);
      var ok = true;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { showError(email, "Enter a valid email address."); ok = false; }
      if (!pass.value) { showError(pass, "Password is required."); ok = false; }
      if (!ok) return;

      var btn = loginForm.querySelector(".btn-submit");
      setLoading(btn, true);

      var attempt = function () {
        if (!IS_DEMO) {
          return fb.auth().signInWithEmailAndPassword(email.value.trim(), pass.value).then(function (res) {
            return ensureProfile(res.user);
          });
        }
        var users = DB.get("users", []);
        var u = users.find(function (x) { return x.email.toLowerCase() === email.value.trim().toLowerCase() && x.password === pass.value; });
        if (!u) return Promise.reject(new Error("Invalid email or password. Try the demo account below."));
        DB.set("session", { id: u.id, full_name: u.full_name, email: u.email });
        return Promise.resolve(u);
      };

      attempt().then(function () {
        window.location.replace("home.html");
      }).catch(function (err) {
        setLoading(btn, false);
        window.RSApp.toast(firebaseError(err), "error");
      });
    });
  }

  var googleInFlight = false;
  var googleTimer = null;
  function resetGoogle(btn) {
    googleInFlight = false;
    if (googleTimer) { clearTimeout(googleTimer); googleTimer = null; }
    if (btn) btn.disabled = false;
  }

  function googleSignIn(btn) {
    if (!btn) return;
    if (googleInFlight) return;
    var APP = window.RSApp;
    if (!fb || !fb.auth) {
      if (APP) APP.toast("Firebase isn't configured. Add your config in assets/js/config.js.", "error");
      return;
    }
    var authNs = (window.firebase && window.firebase.auth) || fb.auth;
    var GoogleProvider = authNs && authNs.GoogleAuthProvider;
    if (!GoogleProvider) {
      if (APP) APP.toast("Google sign-in isn't available right now. Try again in a moment.", "error");
      return;
    }
    var provider = new GoogleProvider();
    provider.addScope("email");
    provider.addScope("profile");
    googleInFlight = true;
    btn.disabled = true;
    if (APP) APP.toast("Opening Google sign-in…", "info");
    googleTimer = setTimeout(function () { resetGoogle(btn); }, 60000);
    try {
      fb.auth().signInWithPopup(provider).then(function (res) {
        resetGoogle(btn);
        return ensureProfile(res.user);
      }).then(function () {
        window.location.replace("home.html");
      }).catch(function (err) {
        resetGoogle(btn);
        var code = err && err.code;
        if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request" || code === "auth/operation-not-supported-in-this-environment") {
          return fb.auth().signInWithRedirect(provider).catch(function (e) {
            if (APP) APP.toast(firebaseError(e), "error");
          });
        }
        if (APP) APP.toast(firebaseError(err), "error");
      });
    } catch (err) {
      resetGoogle(btn);
      if (APP) APP.toast(firebaseError(err), "error");
    }
  }

  if (!IS_DEMO && fb && fb.auth) {
    fb.auth().getRedirectResult().then(function (result) {
      if (result && result.user) {
        return ensureProfile(result.user).then(function () {
          window.location.replace("home.html");
        });
      }
    }).catch(function (err) {
      var APP = window.RSApp;
      var code = err && err.code;
      if (code !== "auth/account-exists-with-different-credential" || !APP) return;
      APP.toast(firebaseError(err), "error");
    });
  }

  var googleBtns = document.querySelectorAll("#googleLoginBtn, #googleSignupBtn");
  if (IS_DEMO) {
    googleBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.RSApp.toast("Demo mode: enable Firebase to use Google sign-in.", "info");
      });
    });
  } else {
    googleBtns.forEach(function (btn) {
      btn.addEventListener("click", function () { googleSignIn(btn); });
    });
  }

  var signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("name");
      var email = document.getElementById("email");
      var pass = document.getElementById("password");
      var pass2 = document.getElementById("password2");
      var agree = document.getElementById("agree");
      [name, email, pass, pass2].forEach(clearError);
      var ok = true;
      if (name.value.trim().length < 2) { showError(name, "Please enter your full name."); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { showError(email, "Enter a valid email address."); ok = false; }
      if (pass.value.length < 8) { showError(pass, "Use at least 8 characters."); ok = false; }
      if (pass2.value !== pass.value) { showError(pass2, "Passwords do not match."); ok = false; }
      if (!agree.checked) { window.RSApp.toast("Please accept the Terms & Privacy Policy.", "error"); ok = false; }
      if (!ok) return;

      var btn = signupForm.querySelector(".btn-submit");
      setLoading(btn, true);

      var attempt = function () {
        if (!IS_DEMO) {
          return fb.auth().createUserWithEmailAndPassword(email.value.trim(), pass.value).then(function (res) {
            var u = res.user;
            return u.updateProfile({ displayName: name.value.trim() }).then(function () {
              return ensureProfile(u);
            });
          });
        }
        var users = DB.get("users", []);
        if (users.some(function (x) { return x.email.toLowerCase() === email.value.trim().toLowerCase(); })) {
          return Promise.reject(new Error("An account with that email already exists."));
        }
        var u = { id: DB.uid("u"), email: email.value.trim(), password: pass.value, full_name: name.value.trim(), created_at: new Date().toISOString() };
        users.push(u);
        DB.set("users", users);
        DB.set("session", { id: u.id, full_name: u.full_name, email: u.email });
        return Promise.resolve(u);
      };

      attempt().then(function () {
        window.location.replace("home.html");
      }).catch(function (err) {
        setLoading(btn, false);
        window.RSApp.toast(firebaseError(err), "error");
      });
    });
  }

  var toggleBtns = document.querySelectorAll("[data-toggle-password]");
  toggleBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = document.getElementById(btn.dataset.togglePassword);
      if (!input) return;
      var isPass = input.type === "password";
      input.type = isPass ? "text" : "password";
      btn.querySelector("i").className = isPass ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
    });
  });

  var memberDots = document.querySelectorAll(".member-dot");
  var riderTip = document.getElementById("riderTip");
  var selfMenu = document.getElementById("selfMenu");
  if (memberDots.length && (riderTip || selfMenu)) {
    function positionTip(el, dot, panel) {
      var pr = panel.getBoundingClientRect();
      var dr = dot.getBoundingClientRect();
      var x = Math.max(8, Math.min(dr.left - pr.left + dr.width / 2 - el.offsetWidth / 2, pr.width - el.offsetWidth - 8));
      var y = Math.max(8, dr.top - pr.top - el.offsetHeight - 14);
      el.style.left = x + "px";
      el.style.top = y + "px";
    }
    memberDots.forEach(function (g) {
      g.addEventListener("click", function (e) {
        e.stopPropagation();
        var panel = document.querySelector(".auth-visual");
        if (!panel) return;
        var isYou = g.classList.contains("you-dot");
        var el = isYou && selfMenu ? selfMenu : riderTip;
        if (!el) return;
        var name = g.getAttribute("data-name") || "Rider";
        var role = g.getAttribute("data-role") || "Member";
        var color = g.getAttribute("data-color") || "#22d3ee";
        var initials = name.split(/\s+/).map(function (w) { return w[0]; }).join("").toUpperCase().slice(0, 2);
        el.querySelector(".rt-avatar").textContent = initials;
        el.querySelector(".rt-avatar").style.background = color;
        el.querySelector(".rt-name").textContent = name;
        el.querySelector(".rt-role").textContent = role;
        if (!isYou) {
          el.querySelector(".rt-status").textContent = g.getAttribute("data-status") || "Online";
          el.querySelector(".rt-eta").textContent = g.getAttribute("data-eta") || "";
        }
        if (selfMenu) selfMenu.hidden = isYou ? false : true;
        if (riderTip) riderTip.hidden = isYou ? true : false;
        positionTip(el, g, panel);
      });
    });
    document.addEventListener("click", function (e) {
      if (riderTip && (!e.target.closest || !e.target.closest(".rider-tip"))) riderTip.hidden = true;
      if (selfMenu && (!e.target.closest || !e.target.closest(".self-menu"))) selfMenu.hidden = true;
    });
  }
})();
