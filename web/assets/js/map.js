(function () {
  var A = window.RSApp;
  var map = null;
  var markers = {};
  var groupId = null;
  var meId = null;
  var live = false;
  var watchId = null;
  var centeredOnMe = false;
  var base = { lat: 33.685, lng: -84.302 };
  var useGMaps = false;
  var useML = false;
  var gm = null;
  var infoWin = null;
  var mlStyle = "normal";

  var ML_LIBERTY = "https://tiles.openfreemap.org/styles/liberty";

  function mlRasterStyle(url, attr) {
    return {
      version: 8,
      sources: { base: { type: "raster", tiles: [url], tileSize: 256, attribution: attr } },
      layers: [{ id: "base", type: "raster", source: "base" }]
    };
  }
  var ML_SAT = mlRasterStyle(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    '&copy; Esri, Maxar, Earthstar Geographics'
  );

  var gmDark = [
    { elementType: "geometry", stylers: [{ color: "#0f1420" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0f1420" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8ea0b8" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a2233" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#aebecd" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#232d41" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b1626" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#182338" }] }
  ];

  function geoError(err) {
    var msg = "Could not get your location. Make sure location access is allowed for this site.";
    if (err && err.code === 1) msg = "Location permission denied. Allow location access for this site to share it.";
    if (err && err.code === 3) msg = "Location request timed out. Check your connection and try again.";
    A.toast(msg, "error");
  }

  function mlPinEl(name, me) {
    var el = document.createElement("div");
    el.className = "map-member-pin" + (me ? " me" : "");
    if (me) {
      el.innerHTML = '<span class="map-live-dot"></span>';
    } else {
      el.textContent = name;
    }
    return el;
  }

  function gIcon(color) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">' +
      '<circle cx="16" cy="16" r="11" fill="' + color + '" stroke="#ffffff" stroke-width="2.5"/></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function setView(lat, lng, zoom) {
    if (!map) return;
    if (useGMaps) {
      map.setCenter({ lat: lat, lng: lng });
      map.setZoom(zoom);
    } else {
      map.setCenter([lng, lat]);
      map.setZoom(zoom);
    }
  }

  function markerPos(mk) {
    if (useGMaps) {
      var p = mk.getPosition();
      return { lat: p.lat(), lng: p.lng() };
    }
    var ll = mk.getLngLat();
    return { lat: ll.lat, lng: ll.lng };
  }

  function setMarkerPos(mk, lat, lng) {
    if (useGMaps) mk.setPosition({ lat: lat, lng: lng });
    else mk.setLngLat([lng, lat]);
  }

  function openMarkerPopup(mk, full, status) {
    if (useGMaps) {
      infoWin.setContent("<strong>" + full + "</strong><br><span style='color:#8ea0b8'>" + status + "</span>");
      infoWin.open(map, mk);
    } else {
      mk.togglePopup();
    }
  }

  function init() {
    if (!document.getElementById("map")) return;
    A.requireAuth().then(function (u) {
      if (u) meId = u.id;
      return A.getActiveGroup().then(function (g) {
        if (!g) return;
        groupId = g.id;
        A.setActiveGroupId(g.id);
        A.renderShell("map", "Live Map", g.name);
        document.getElementById("mapSub").textContent = g.name + " · live member positions";

        A.loadGoogleMaps().then(function (gmap) {
          useGMaps = true;
          gm = gmap;
          initGMap();
          ready();
        }).catch(function () {
          if (typeof maplibregl === "undefined") {
            document.getElementById("map").innerHTML =
              '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-300);font-size:.9rem;gap:10px">' +
              '<i class="fa-solid fa-triangle-exclamation"></i> Could not load a map. Check your connection and refresh.</div>';
            return;
          }
          useML = true;
          initMLMap();
          ready();
        });
      });
    });
  }

  function initGMap() {
    map = new gm.Map(document.getElementById("map"), {
      center: base,
      zoom: 12,
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: { position: gm.ControlPosition.BOTTOM_RIGHT },
      styles: gmDark
    });
    infoWin = new gm.InfoWindow();
  }

  function initMLMap() {
    map = new maplibregl.Map({
      container: "map",
      style: ML_LIBERTY,
      center: [base.lng, base.lat],
      zoom: 12
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  }

  function ready() {
    loadLocations();
    setInterval(loadLocations, 8000);
    if (!A.IS_DEMO && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function (pos) {
        if (!centeredOnMe) setView(pos.coords.latitude, pos.coords.longitude, 13);
      }, function () {}, { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 });
    }
  }

  function loadLocations() {
    if (!groupId) return;
    A.fetchMembers(groupId).then(function (members) {
      return A.fetchLocations(groupId).then(function (locs) {
        var online = members.filter(function (m) { return m.status !== "offline"; });
        document.getElementById("mapOnline").innerHTML = '<span class="badge-dot pulse-dot"></span>' + online.length;
        renderPins(members, locs);
        var liveLocs = locs.filter(function (l) { return l.lat; });
        if (liveLocs.length) {
          var speeds = liveLocs.filter(function (l) { return l.speed > 0; }).map(function (l) { return l.speed; });
          var avg = speeds.length ? Math.round(speeds.reduce(function (a, b) { return a + b; }, 0) / speeds.length) : 0;
          document.getElementById("rsSpeed").textContent = avg ? avg + " km/h" : "--";
        }
        if (!centeredOnMe && markers[meId]) {
          centeredOnMe = true;
          var p = markerPos(markers[meId]);
          setView(p.lat, p.lng, 13);
        }
      });
    });
  }

  function renderPins(members, locs) {
    var users = {};
    members.forEach(function (m) { users[m.user_id] = m; });
    var pins = document.getElementById("memberPins");
    pins.innerHTML = "";
    locs.forEach(function (l) {
      if (!l.lat || !l.lng) return;
      var m = users[l.user_id] || {};
      var isMe = meId && l.user_id === meId;
      var key = l.user_id;
      var name = A.escapeHtml((m.full_name || "?").split(" ")[0]);
      var full = A.escapeHtml(m.full_name || "Member");
      var status = A.escapeHtml(A.statusInfo(m.status).label);

      if (!markers[key]) {
        if (useGMaps) {
          markers[key] = new gm.Marker({
            position: { lat: l.lat, lng: l.lng },
            map: map,
            icon: m.avatar_url
              ? { url: m.avatar_url, scaledSize: new gm.Size(34, 34), anchor: new gm.Point(17, 17) }
              : { url: gIcon(isMe ? "#22d3ee" : "#6366f1") },
            label: m.avatar_url ? null : { text: name.slice(0, 2), color: "#ffffff", fontSize: "10px", fontWeight: "700" },
            title: m.full_name || "Member"
          });
          markers[key].addListener("click", function () {
            openMarkerPopup(markers[key], full, status);
          });
        } else {
          markers[key] = new maplibregl.Marker({ element: mlPinEl(name, isMe, m.avatar_url) })
            .setLngLat([l.lng, l.lat])
            .addTo(map);
          markers[key].setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(
            "<strong>" + full + "</strong><br><span style='color:#8ea0b8'>" + status + "</span>"
          ));
          if (isMe) markers[key].togglePopup();
        }
      } else {
        setMarkerPos(markers[key], l.lat, l.lng);
      }

      var row = document.createElement("div");
      row.className = "member-pin";
      row.innerHTML = A.avatarHtml(m.full_name || "?", "sm", l.user_id, (m.status || "online") !== "offline", m.avatar_url) +
        '<div class="pin-info"><strong>' + full + A.roleTag(m) + (isMe ? " <span class='muted'>· you</span>" : "") + "</strong>" +
        '<span><i class="fa-solid fa-location-crosshairs"></i> ' + l.lat.toFixed(4) + ", " + l.lng.toFixed(4) + (l.speed ? " · " + Math.round(l.speed) + " km/h" : "") + "</span></div>" +
        '<span class="badge ' + (isMe ? "badge-cyan" : "badge-green") + '"><span class="badge-dot pulse-dot"></span>' + (m.status === "offline" ? "offline" : "live") + "</span>";
      pins.appendChild(row);
      row.addEventListener("click", function () {
        setView(l.lat, l.lng, 14);
        if (markers[key]) openMarkerPopup(markers[key], full, status);
      });
    });
  }

  function simulate() {
    if (!live || !groupId) return;
    A.fetchLocations(groupId).then(function (locs) {
      var locs2 = locs.slice();
      var me = locs2.find(function (l) { return l.user_id === meId; });
      if (!me) return;
      var nc = {
        lat: me.lat + (Math.random() - 0.5) * 0.004,
        lng: me.lng + (Math.random() - 0.5) * 0.004
      };
      me.lat = nc.lat; me.lng = nc.lng; me.speed = 50 + Math.random() * 40; me.updated_at = Date.now();
      A.DB.set("locations", locs2);
      if (markers[meId]) setMarkerPos(markers[meId], nc.lat, nc.lng);
      if (useGMaps) map.panTo({ lat: nc.lat, lng: nc.lng });
      else map.panTo([nc.lng, nc.lat], { duration: 1200 });
      loadLocations();
    });
  }

  function startLive() {
    if (navigator.geolocation && !A.IS_DEMO) {
      navigator.geolocation.getCurrentPosition(function (pos) {
        setView(pos.coords.latitude, pos.coords.longitude, 14);
        A.updateLocation(groupId, pos.coords.latitude, pos.coords.longitude).then(loadLocations);
      }, geoError, { enableHighAccuracy: true, timeout: 8000 });
      watchId = navigator.geolocation.watchPosition(function (pos) {
        A.updateLocation(groupId, pos.coords.latitude, pos.coords.longitude).then(loadLocations);
      }, geoError, { enableHighAccuracy: true });
    }
  }

  var liveBtn = document.getElementById("goLiveBtn");
  if (liveBtn) {
    liveBtn.addEventListener("click", function () {
      live = !live;
      if (live) {
        liveBtn.classList.replace("btn-success", "btn-danger");
        liveBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop sharing';
        A.toast("Sharing your live location with the group.", "success");
        if (A.IS_DEMO) simulate();
        else startLive();
      } else {
        liveBtn.classList.replace("btn-danger", "btn-success");
        liveBtn.innerHTML = '<i class="fa-solid fa-location-arrow"></i> Go live';
        if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
        A.toast("Location sharing paused.", "info");
      }
    });
  }

  var fitBtn = document.getElementById("fitBtn");
  if (fitBtn) {
    fitBtn.addEventListener("click", function () {
      var keys = Object.keys(markers);
      if (!keys.length) return;
      if (useGMaps) {
        var b = new gm.LatLngBounds();
        keys.forEach(function (k) { b.extend(markers[k].getPosition()); });
        map.fitBounds(b);
      } else {
        var mlb = new maplibregl.LngLatBounds();
        keys.forEach(function (k) { mlb.extend(markers[k].getLngLat()); });
        if (keys.length > 1) map.fitBounds(mlb, { padding: 50 });
        else map.setCenter(mlb.getCenter()).setZoom(14);
      }
    });
  }

  var locBtn = document.getElementById("locateBtn");
  if (locBtn) {
    locBtn.addEventListener("click", function () {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (pos) {
          setView(pos.coords.latitude, pos.coords.longitude, 14);
        }, geoError);
      } else {
        setView(base.lat, base.lng, 13);
      }
    });
  }

  var satBtn = document.getElementById("satelliteBtn");
  if (satBtn) {
    satBtn.addEventListener("click", function () {
      if (useGMaps) {
        map.setMapTypeId(map.getMapTypeId() === gm.MapTypeId.SATELLITE ? gm.MapTypeId.ROADMAP : gm.MapTypeId.SATELLITE);
      } else {
        mlStyle = mlStyle === "satellite" ? "normal" : "satellite";
        map.setStyle(mlStyle === "satellite" ? ML_SAT : ML_LIBERTY);
      }
    });
  }

  init();
})();
