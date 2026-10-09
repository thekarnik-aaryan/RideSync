(function () {
  var A = window.RSApp;
  var groupId = null;
  var currentUser = null;
  var filter = "all";
  var pendingFile = null;
  var pendingUrl = null;
  var pendingType = "image";
  var modalMode = "upload";
  var currentItem = null;

  var uploadBtn = document.getElementById("uploadBtn");
  var input = document.getElementById("photoInput");
  var modal = document.getElementById("photoModal");

  function isVideo(url) {
    return /^data:video\//i.test(url || "") || /\.(mp4|mov|webm|m4v|ogg)(\?.*)?$/i.test(url || "");
  }

  function fileNameFromUrl(url) {
    try {
      var u = new URL(url);
      var name = u.pathname.split("/").pop();
      return decodeURIComponent(name) || "ridesync-media";
    } catch (e) {
      return "ridesync-media";
    }
  }

  function downloadUrl(url, filename) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("Could not fetch file.");
      return res.blob();
    }).then(function (blob) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    });
  }

  function visual(p) {
    if (!p.url) {
      return '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:3rem;background:linear-gradient(135deg,' + (p.color || "#6366f1") + ',' + (p.color ? p.color + "cc" : "#22d3ee") + ')">' + (p.emoji || "📸") + "</div>";
    }
    if (isVideo(p.url)) {
      return '<video muted preload="metadata" playsinline><source src="' + A.escapeHtml(p.url) + '"></video>';
    }
    return '<img src="' + A.escapeHtml(p.url) + '" alt="">';
  }

  function tile(p) {
    var mine = p.user_id === (currentUser ? currentUser.id : "me");
    var mediaIcon = isVideo(p.url) ? ' <i class="fa-solid fa-circle-play" style="position:absolute;top:8px;left:40px;color:rgba(255,255,255,.85);font-size:1rem"></i>' : "";
    return '<div class="photo-tile" data-id="' + p.id + '">' + visual(p) + mediaIcon +
      '<div class="photo-cap"><span>' + A.escapeHtml(p.caption || "No caption") + "</span>" +
      '<span class="u">' + A.escapeHtml(p.full_name || "Member") + " · " + A.timeAgo(p.created_at) + "</span></div>" +
      '<button class="btn btn-icon photo-dl" data-dl="' + p.id + '" title="Download" style="font-size:.8rem;padding:8px 10px"><i class="fa-solid fa-download"></i></button>' +
      (mine ? '<button class="btn btn-icon" data-del="' + p.id + '" style="position:absolute;top:8px;right:8px;background:rgba(4,8,18,.6);color:#fca5a5;font-size:.8rem;padding:8px;z-index:2"><i class="fa-solid fa-trash"></i></button>' : "") +
    "</div>";
  }

  function load() {
    A.requireAuth().then(function (u) {
      currentUser = u;
      return A.getActiveGroup().then(function (g) {
        if (!g) return;
        groupId = g.id;
        A.setActiveGroupId(g.id);
        A.renderShell("photos", "Photo Drive", g.name);
        return render();
      });
    });
  }

  function render() {
    return A.fetchPhotos(groupId).then(function (photos) {
      var grid = document.getElementById("photoGrid");
      document.getElementById("photoCount").textContent = photos.length + " photo" + (photos.length === 1 ? "" : "s");
      if (!photos.length) {
        grid.innerHTML = '<div class="empty" style="grid-column:1/-1;padding:70px 20px"><i class="fa-solid fa-images"></i><h4>No photos yet</h4><p style="font-size:.85rem">Be the first to share a moment from the road.</p><button class="btn btn-primary btn-sm mt-16" id="emptyUpload"><i class="fa-solid fa-upload"></i> Upload first photo</button></div>';
        var emptyBtn = document.getElementById("emptyUpload");
        if (emptyBtn) emptyBtn.addEventListener("click", function () { if (uploadBtn) uploadBtn.click(); });
        return;
      }
      var visible = filter === "mine"
        ? photos.filter(function (p) { return p.user_id === (currentUser ? currentUser.id : "me"); })
        : photos;
      grid.innerHTML = visible.map(tile).join("") || '<div class="empty" style="grid-column:1/-1"><i class="fa-solid fa-user-slash"></i><h4>You have not shared any photos</h4></div>';

      grid.querySelectorAll("[data-del]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          A.deletePhoto(groupId, btn.dataset.del).then(function () { A.toast("Photo removed.", "info"); render(); });
        });
      });
      grid.querySelectorAll("[data-dl]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var ph = visible.find(function (p) { return p.id === btn.dataset.dl; });
          if (!ph || !ph.url) return;
          A.toast("Downloading…", "info");
          downloadUrl(ph.url, fileNameFromUrl(ph.url)).catch(function () {
            window.open(ph.url, "_blank");
          });
        });
      });
      grid.querySelectorAll(".photo-tile").forEach(function (t) {
        t.addEventListener("click", function (e) {
          if (e.target.closest("[data-del]") || e.target.closest("[data-dl]")) return;
          var ph = visible.find(function (p) { return p.id === t.dataset.id; });
          if (ph) openItem(ph);
        });
      });
    });
  }

  function showMedia(src, isVid, title, mode) {
    var img = document.getElementById("photoPreview");
    var vid = document.getElementById("photoPreviewVideo");
    vid.pause();
    if (isVid) {
      img.style.display = "none";
      vid.style.display = "block";
      vid.src = src || "";
      vid.load();
    } else {
      vid.style.display = "none";
      img.style.display = "block";
      img.src = src || "";
    }
    document.getElementById("photoModalTitle").textContent = title;
    var field = document.getElementById("captionField");
    var confirmBtn = document.getElementById("photoConfirm");
    var cancelBtn = document.getElementById("photoCancel");
    if (mode === "upload") {
      field.style.display = "";
      confirmBtn.style.display = "";
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to drive';
      cancelBtn.textContent = "Cancel";
    } else {
      field.style.display = "none";
      confirmBtn.style.display = "none";
      cancelBtn.textContent = "Close";
    }
    modal.classList.remove("hidden");
  }

  function openItem(p) {
    currentItem = p;
    modalMode = "view";
    var label = isVideo(p.url) ? "Video" : "Photo";
    var title = p.caption ? p.caption : label;
    showMedia(p.url || "", isVideo(p.url), title, "view");
  }

  function closeModal() {
    modal.classList.add("hidden");
    var vid = document.getElementById("photoPreviewVideo");
    vid.pause();
    vid.src = "";
    document.getElementById("photoPreview").src = "";
    pendingFile = null;
    pendingUrl = null;
    currentItem = null;
    modalMode = "upload";
  }

  function handleFile(file) {
    if (!file) return;
    var isImage = file.type.startsWith("image/");
    var isVideoType = file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v|ogg)$/i.test(file.name);
    if (!isImage && !isVideoType) {
      A.toast("Please choose a photo or video file.", "error");
      return;
    }
    pendingFile = file;
    pendingType = isImage ? "image" : "video";
    var reader = new FileReader();
    reader.onload = function (ev) {
      pendingUrl = ev.target.result;
      currentItem = null;
      modalMode = "upload";
      document.getElementById("captionInput2").value = "";
      showMedia(pendingUrl, pendingType === "video", (pendingType === "video" ? "Video preview" : "Photo preview"), "upload");
    };
    reader.readAsDataURL(file);
  }

  if (uploadBtn) uploadBtn.addEventListener("click", function () { input.click(); });
  if (input) input.addEventListener("change", function () { handleFile(input.files[0]); });
  var close = document.getElementById("photoModalClose");
  if (close) close.addEventListener("click", closeModal);
  var cancel = document.getElementById("photoCancel");
  if (cancel) cancel.addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) closeModal();
  });
  var dlBtn = document.getElementById("photoDownload");
  if (dlBtn) {
    dlBtn.addEventListener("click", function () {
      var src, name;
      if (modalMode === "view") {
        if (!currentItem || !currentItem.url) { A.toast("Nothing to download.", "info"); return; }
        src = currentItem.url;
        name = fileNameFromUrl(src);
      } else {
        if (!pendingUrl) { A.toast("Nothing to download.", "info"); return; }
        src = pendingUrl;
        name = pendingFile ? pendingFile.name : "ridesync-media";
      }
      A.toast("Downloading…", "info");
      downloadUrl(src, name).catch(function () {
        window.open(src, "_blank");
      });
    });
  }
  var confirmBtn = document.getElementById("photoConfirm");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", function () {
      if (!pendingFile) return;
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner spin"></i> Uploading…';
      A.uploadPhoto(groupId, pendingFile, document.getElementById("captionInput2").value.trim(), pendingUrl).then(function () {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to drive';
        closeModal();
        A.toast("Added to the drive!", "success");
        return render();
      }).catch(function (err) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to drive';
        A.toast(err.message || "Upload failed.", "error");
      });
    });
  }

  document.querySelectorAll("[data-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("[data-filter]").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      filter = btn.dataset.filter;
      render();
    });
  });

  load();
})();
