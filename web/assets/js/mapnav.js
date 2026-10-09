(function () {
  var A = window.RSApp;
  var fb = window.RS.fb;
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
  var mlStyle = "light";
  var routeCurrent = null;
  var picked = { from: null, to: null };
  var debounceTimers = { from: null, to: null };
  var gDirService = null;
  var gDirRenderer = null;
  var gLastRoute = null;
  var mlRouteCoords = null;
  var mlEndMarkers = [];
  var dirReady = false;
  var navActive = false;
  var navWatchId = null;
  var trackId = null;
  var trackName = "";
  var lastRouteTs = 0;
  var routeFittedTs = 0;
  var gPoly = null;
  var gLegPoly = null;
  var gMeet = null;
  var mlMeet = null;
  var mlLegCoords = null;
  var routeFittedKey = "";
  var plannedFrom = null;
  var plannedTo = null;
  var navName = "You";
  var known = {
    "canyon": [33.91, -84.32],
    "lake": [33.59, -84.15],
    "falls": [34.21, -83.95],
    "coffee": [33.75, -84.39],
    "home": [base.lat, base.lng]
  };

  var ML_LIGHT = mlRasterStyle(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  );

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
  var ML_DARK = mlRasterStyle(
    "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
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

  function fmtTime(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) + ":" + ("0" + d.getSeconds()).slice(-2);
  }

  function haversineKm(a, b) {
    var R = 6371;
    var dLat = (b.lat - a.lat) * Math.PI / 180;
    var dLng = (b.lng - a.lng) * Math.PI / 180;
    var la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function centroid(pts) {
    var lat = 0, lng = 0;
    pts.forEach(function (p) { lat += p.lat; lng += p.lng; });
    return { lat: lat / pts.length, lng: lng / pts.length };
  }

  function reverseGeocode(lat, lng) {
    return fetch("https://nominatim.openstreetmap.org/reverse?format=json&lat=" + lat + "&lon=" + lng)
      .then(function (r) { return r.json(); })
      .then(function (j) { return j.display_name || "Meeting point"; })
      .catch(function () { return "Meeting point"; });
  }

  function tsOf(v) {
    if (!v) return 0;
    if (typeof v === "number") return v;
    var t = Date.parse(v);
    return isNaN(t) ? 0 : t;
  }

  function centerOnMe() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(function (pos) {
      setView(pos.coords.latitude, pos.coords.longitude, 15);
    }, function () {}, { enableHighAccuracy: true, timeout: 8000 });
  }

  function mlPinEl(name, me, avatarUrl) {
    var el = document.createElement("div");
    el.className = "map-member-pin" + (me ? " me" : "");
    if (avatarUrl) {
      el.innerHTML = '<img src="' + A.escapeHtml(avatarUrl) + '" alt="' + A.escapeHtml(name) + '">';
    } else if (me) {
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

  function renderMapStatusChips() {
    var box = document.getElementById("mapStatusChips");
    if (!box || !groupId || !meId) return;
    A.fetchMembers(groupId).then(function (members) {
      var me = members.find(function (m) { return m.user_id === meId; });
      var current = (me && me.status) || "online";
      var keys = ["riding", "fueling", "resting", "eating", "stopped", "online", "away", "offline"];
      box.innerHTML = keys.map(function (k) {
        var info = A.statusInfo(k);
        return '<button type="button" class="status-chip' + (k === current ? " active" : "") + '" data-status="' + k + '" title="' + info.label + '">' +
          '<i class="fa-solid ' + info.icon + '"></i>' + info.label + "</button>";
      }).join("");
      box.querySelectorAll(".status-chip").forEach(function (chip) {
        chip.addEventListener("click", function () {
          var k = chip.dataset.status;
          if (k === current) return;
          A.updateMemberStatus(groupId, meId, k).then(function () {
            current = k;
            box.querySelectorAll(".status-chip").forEach(function (c) { c.classList.toggle("active", c.dataset.status === k); });
            A.toast("Status set to " + A.statusInfo(k).label + ".", "success");
            loadLocations();
          }).catch(function (err) {
            A.toast((err && err.message) || "Could not update status.", "error");
          });
        });
      });
    });
  }

  function init() {
    if (!document.getElementById("map")) return;
    A.requireAuth().then(function (u) {
      if (u) meId = u.id;
      return A.getActiveGroup().then(function (g) {
        if (!g) return;
        groupId = g.id;
        A.setActiveGroupId(g.id);
        A.renderShell("map", "Map & Navigation", g.name);
        document.getElementById("mapSub").textContent = g.name + " · live member positions";
        renderMapStatusChips();

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
    }).catch(function () {});
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
    gDirService = new gm.DirectionsService();
  }

  function initMLMap() {
    var el = document.getElementById("map");
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.position = "absolute";
    el.style.inset = "0";
    map = new maplibregl.Map({
      container: el,
      style: ML_LIGHT,
      center: [base.lng, base.lat],
      zoom: 12
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    setTimeout(function () { if (map && map.resize) map.resize(); }, 200);
    setTimeout(function () { if (map && map.resize) map.resize(); }, 600);
    window.addEventListener("resize", function () { if (map && map.resize) map.resize(); });
  }

  function ready() {
    loadLocations();
    loadSharedRoute();
    setInterval(function () { loadLocations(); loadSharedRoute(); }, 8000);
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
        var online = members.filter(function (m) { return A.memberOnline(m); });
        document.getElementById("mapOnline").innerHTML = '<span class="badge-dot pulse-dot"></span>' + online.length;
        renderPins(members, locs);
        var liveLocs = locs.filter(function (l) { return l.lat; });
        if (liveLocs.length) {
          var speeds = liveLocs.filter(function (l) { return l.speed > 0; }).map(function (l) { return l.speed; });
          var avg = speeds.length ? Math.round(speeds.reduce(function (a, b) { return a + b; }, 0) / speeds.length) : 0;
          document.getElementById("rsSpeed").textContent = avg ? avg + " km/h" : "--";
        }
        if (trackId && markers[trackId]) {
          var tp = markerPos(markers[trackId]);
          setView(tp.lat, tp.lng, 15);
        } else if (navActive && markers[meId]) {
          var mp = markerPos(markers[meId]);
          setView(mp.lat, mp.lng, 15);
        } else if (!centeredOnMe && markers[meId]) {
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
      var siteNow = A.memberOnline(m);
      var status = A.escapeHtml(siteNow ? A.statusInfo(m.status).label : "Offline");

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
      row.className = "member-pin" + (trackId === l.user_id ? " tracking" : "");
      var age = l.updated_at ? Date.now() - tsOf(l.updated_at) : 999999;
      var siteNow = A.memberOnline(m);
      var liveNow = siteNow && age < 45000;
      var stInfo = A.statusInfo(siteNow ? m.status : "offline");
      var badgeCls = !siteNow ? "badge-muted" : (liveNow ? (isMe ? "badge-cyan" : "badge-green") : "badge-amber");
      row.innerHTML = A.avatarHtml(m.full_name || "?", "sm", l.user_id, siteNow, m.avatar_url) +
        '<div class="pin-info"><strong>' + full + A.roleTag(m) + (isMe ? " <span class='muted'>· you</span>" : "") + "</strong>" +
        '<span><i class="fa-solid fa-location-crosshairs"></i> ' + l.lat.toFixed(4) + ", " + l.lng.toFixed(4) +
        (l.speed ? " · " + Math.round(l.speed) + " km/h" : "") +
        (l.updated_at ? " · " + fmtTime(l.updated_at) : "") + "</span></div>" +
        '<span class="badge ' + badgeCls + '"><i class="fa-solid ' + stInfo.icon + '" style="margin-right:5px"></i>' + stInfo.label + "</span>" +
        '<button class="track-btn' + (trackId === l.user_id ? " active" : "") + '" data-uid="' + A.escapeHtml(l.user_id) + '" title="Track live"><i class="fa-solid fa-crosshairs"></i></button>';
      pins.appendChild(row);
      row.addEventListener("click", function () {
        setView(l.lat, l.lng, 14);
        if (markers[key]) openMarkerPopup(markers[key], full, status);
      });
      var trackBtn = row.querySelector(".track-btn");
      if (trackBtn) {
        trackBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          toggleTrack(l.user_id, full);
        });
      }
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

  function toggleLive() {
    live = !live;
    if (live) {
      goLiveBtn.classList.replace("btn-success", "btn-danger");
      goLiveBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop sharing';
      A.toast("Sharing your live location with the group.", "success");
      if (A.IS_DEMO) simulate();
      else startLive();
    } else {
      goLiveBtn.classList.replace("btn-danger", "btn-success");
      goLiveBtn.innerHTML = '<i class="fa-solid fa-location-arrow"></i> Go live';
      if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
      A.toast("Location sharing paused.", "info");
    }
  }

  function fitMarkers() {
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
  }

  function refreshTrackingUI() {
    document.querySelectorAll(".track-btn").forEach(function (b) {
      var on = trackId && b.dataset.uid === trackId;
      b.classList.toggle("active", on);
      b.closest(".member-pin").classList.toggle("tracking", on);
    });
    var bar = document.getElementById("mapTracking");
    var tn = document.getElementById("trackName");
    if (bar && tn) {
      if (trackId) { bar.style.display = "flex"; tn.textContent = trackName; }
      else bar.style.display = "none";
    }
  }

  function toggleTrack(uid, name) {
    if (trackId === uid) {
      trackId = null;
      trackName = "";
      A.toast("Stopped tracking.", "info");
    } else {
      trackId = uid;
      trackName = name || "member";
      A.toast("Tracking " + trackName + " live.", "success");
      if (markers[trackId]) {
        var tp = markerPos(markers[trackId]);
        setView(tp.lat, tp.lng, 15);
      }
    }
    refreshTrackingUI();
  }

  function fetchNominatim(q, limit) {
    var base = "https://nominatim.openstreetmap.org/search?format=json&limit=" + limit + "&accept-language=en-IN&";
    return fetch(base + "countrycodes=in&q=" + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (!rows || !rows.length) {
          return fetch(base + "q=" + encodeURIComponent(q))
            .then(function (r) { return r.json(); })
            .then(function (rows2) { return rows2 || []; });
        }
        return rows;
      });
  }

  function geocode(query) {
    var clean = query.trim().toLowerCase().replace(/\s+/g, "");
    if (known[clean]) return Promise.resolve({ lat: known[clean][0], lng: known[clean][1], name: query });
    return fetchNominatim(query.trim(), 1)
      .then(function (rows) {
        if (!rows || !rows.length) return Promise.reject(new Error("Couldn't find \"" + query.trim() + "\". Try a more specific place name."));
        return { lat: parseFloat(rows[0].lat), lng: parseFloat(rows[0].lon), name: rows[0].display_name };
      });
  }

  function currentLocation() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) return reject(new Error("Geolocation not supported."));
      navigator.geolocation.getCurrentPosition(function (pos) {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: "Your location" });
      }, function () { reject(new Error("Couldn't get your location. Allow location access for this site.")); }, { enableHighAccuracy: true, timeout: 8000 });
    });
  }

  function resolvePlace(key) {
    var input = document.getElementById(key + "Input");
    var q = (input.value || "").trim();
    if (picked[key]) return Promise.resolve(picked[key]);
    if (/^(current|here|my location|me|my position|gps|start|from|current location|my current location)$/i.test(q)) {
      if (key === "from") {
        return currentLocation().catch(function () {
          throw new Error("Couldn't get your location. Allow location access, or type your start address.");
        });
      }
      return Promise.reject(new Error("Enter a destination."));
    }
    if (!q) {
      if (key === "from") return currentLocation().catch(function () {
        throw new Error("Couldn't get your location. Allow location access, or type your start address.");
      });
      return Promise.reject(new Error("Enter a destination."));
    }
    return geocode(q);
  }

  function getRoute(from, to) {
    if (useGMaps) return googleRoute(from, to);
    return osrmRoute(from, to);
  }

  function osrmRoute(from, to) {
    var url = "https://router.project-osrm.org/route/v1/driving/" +
      from.lng + "," + from.lat + ";" + to.lng + "," + to.lat +
      "?overview=full&geometries=geojson&steps=true";
    return fetch(url).then(function (res) { return res.json(); }).then(function (data) {
      if (!data.routes || !data.routes.length) return Promise.reject(new Error("No route found between those places."));
      return data.routes[0];
    });
  }

  function googleRoute(from, to) {
    return new Promise(function (resolve, reject) {
      var request = {
        origin: { lat: from.lat, lng: from.lng },
        destination: { lat: to.lat, lng: to.lng },
        travelMode: gm.TravelMode.DRIVING,
        unitSystem: gm.UnitSystem.METRIC
      };
      gDirService.route(request, function (res, status) {
        if (status !== gm.DirectionsStatus.OK || !res.routes || !res.routes.length) {
          return reject(new Error("No route found between those places."));
        }
        gLastRoute = res;
        resolve(res.routes[0]);
      });
    });
  }

  function sanitizeForDB(data) {
    var out = {};
    Object.keys(data || {}).forEach(function (k) {
      var v = data[k];
      if (Array.isArray(v) && v.length && Array.isArray(v[0])) {
        out[k] = JSON.stringify(v);
      } else if (v && typeof v === "object") {
        out[k] = sanitizeForDB(v);
      } else {
        out[k] = v;
      }
    });
    return out;
  }

  function decodeGeo(v) {
    if (typeof v === "string") {
      try { return JSON.parse(v); } catch (e) { return null; }
    }
    return v;
  }

  function saveRouteToDB(data) {
    var clean = sanitizeForDB(data);
    if (A.IS_DEMO) {
      var routes = A.DB.get("routes") || {};
      routes[groupId] = clean;
      A.DB.set("routes", routes);
      return Promise.resolve();
    }
    return fb.firestore().collection("routes").doc(groupId).set(clean, { merge: true }).catch(function () {});
  }

  function loadSharedRoute() {
    if (!groupId) return;
    var p;
    if (A.IS_DEMO) {
      p = Promise.resolve((A.DB.get("routes") || {})[groupId] || null);
    } else {
      p = fb.firestore().collection("routes").doc(groupId).get().then(function (d) {
        return d.exists ? d.data() : null;
      }).catch(function () { return null; });
    }
    p.then(function (r) {
      if (!r || (!r.geojson && !r.convoy)) return;
      var last = r.updated_at || 0;
      if (last <= lastRouteTs) return;
      renderSharedRoute(r);
    });
  }

  function renderSharedRoute(r) {
    lastRouteTs = r.updated_at || Date.now();

    if (r.geojson) r.geojson = decodeGeo(r.geojson);
    if (r.convoy) {
      if (r.convoy.geojson) r.convoy.geojson = decodeGeo(r.convoy.geojson);
      if (r.legs) {
        Object.keys(r.legs).forEach(function (u) {
          if (r.legs[u] && r.legs[u].geojson) r.legs[u].geojson = decodeGeo(r.legs[u].geojson);
        });
      }
    }

    var startNavBtn = document.getElementById("startNavBtn");
    if (startNavBtn) startNavBtn.style.display = "block";

    var badge = document.getElementById("navLiveBadge");
    if (badge) {
      if (r.status === "active") {
        badge.style.display = "flex";
        badge.innerHTML = '<i class="fa-solid fa-circle-dot"></i> ' + A.escapeHtml(r.navigator_name || "Someone") + " is navigating now";
      } else {
        badge.style.display = "none";
      }
    }

    if (r.convoy && r.convoy.geojson) {
      routeCurrent = { km: r.convoy.km || 0, eta: r.convoy.eta || 0 };
      document.getElementById("navDist").textContent = fmt((r.convoy.km || 0).toFixed(1));
      document.getElementById("navEta").textContent = (r.convoy.eta || 0) + " min";
      document.getElementById("rsDistance").textContent = (r.convoy.km || 0).toFixed(1) + " km";
      document.getElementById("rsTime").textContent = (r.convoy.eta || 0) + " min";
      var meetName = (r.convoy.meet && r.convoy.meet.name) || "Meeting point";
      var toName = ((r.to && r.to.name) || "Destination").split(",")[0];
      document.getElementById("mapSub").textContent = "Meet at " + meetName.split(",")[0] + " → " + toName;

      document.getElementById("turnList").innerHTML = stepsRows(r.convoy.steps || [], useGMaps);

      drawConvoy(r.convoy.geojson, r.convoy.meet || null);
      var myLeg = (r.legs && r.legs[meId]) ? r.legs[meId] : null;
      if (myLeg && myLeg.geojson) drawLeg(myLeg.geojson);
      else clearLeg();

      var key = (r.convoy.meet ? r.convoy.meet.lat + "," + r.convoy.meet.lng : "") + "|" + r.convoy.geojson.length;
      if (key !== routeFittedKey) {
        routeFittedKey = key;
        fitConvoy();
      }
    } else if (r.geojson) {
      routeCurrent = { km: r.km || 0, eta: r.eta || 0 };
      document.getElementById("navDist").textContent = fmt((r.km || 0).toFixed(1));
      document.getElementById("navEta").textContent = (r.eta || 0) + " min";
      document.getElementById("rsDistance").textContent = (r.km || 0).toFixed(1) + " km";
      document.getElementById("rsTime").textContent = (r.eta || 0) + " min";
      var fromName = ((r.from && r.from.name) || "Start").split(",")[0];
      var toName2 = ((r.to && r.to.name) || "Destination").split(",")[0];
      document.getElementById("mapSub").textContent = fromName + " → " + toName2;

      document.getElementById("turnList").innerHTML = stepsRows(r.steps || [], useGMaps);

      if (useGMaps) {
        if (!gPoly) gPoly = new gm.Polyline({ map: map, strokeColor: "#1a73e8", strokeWeight: 7, strokeOpacity: 0.95 });
        gPoly.setPath(r.geojson.map(function (c) { return { lat: c[1], lng: c[0] }; }));
        mlRouteCoords = null;
      } else {
        mlRouteCoords = r.geojson;
        drawMLRoute(r.geojson);
      }
      clearLeg();
      clearMeet();

      if (!navActive && routeFittedTs !== lastRouteTs) {
        routeFittedTs = lastRouteTs;
        fitRouteBounds();
      }
    }
  }

  function fitRouteBounds() {
    if (!map) return;
    if (useGMaps && gPoly && gPoly.getPath().getLength()) {
      var b = new gm.LatLngBounds();
      gPoly.getPath().forEach(function (p) { b.extend(p); });
      map.fitBounds(b, { top: 60, right: 40, bottom: 40, left: 40 });
    } else if (mlRouteCoords) {
      var mb = new maplibregl.LngLatBounds();
      mlRouteCoords.forEach(function (c) { mb.extend(c); });
      map.fitBounds(mb, { padding: 60 });
    }
  }

  function stepsRows(steps, useGMaps) {
    if (!steps || !steps.length) {
      return '<div style="display:flex;gap:12px;padding:11px 6px;border-bottom:1px solid var(--line)">' +
        '<div class="icon-box icon-green" style="width:32px;height:32px;font-size:.72rem"><i class="fa-solid fa-flag-checkered"></i></div>' +
        '<div style="font-size:.87rem;color:var(--text-300)">You\'ve reached your destination 🎉</div></div>';
    }
    return steps.map(function (s, i) {
      var icon, dist, text;
      if (s.t) { icon = maneuverIcon(s.t); dist = s.d; text = s.x; }
      else if (useGMaps) { icon = maneuverIcon(gManeuverType(s.maneuver)); dist = s.distance.text || ""; text = cleanHtml(s.instructions || s.name || ""); }
      else { icon = maneuverIcon(s.maneuver.type); dist = fmt((s.distance / 1000).toFixed(2)); text = cleanHtml(s.maneuver.instruction || s.name || ""); }
      return '<div style="display:flex;gap:12px;padding:11px 6px;border-bottom:1px solid var(--line)">' +
        '<div class="icon-box ' + (i === 0 ? "icon-green" : "icon-cyan") + '" style="width:32px;height:32px;font-size:.72rem">' + icon + "</div>" +
        '<div style="font-size:.87rem;color:var(--text-300);flex:1">' + A.escapeHtml(text) +
        '<div style="font-size:.72rem;color:var(--text-600);margin-top:2px">' + dist + "</div></div></div>";
    }).join("");
  }

  function planRoute() {
    Promise.all([resolvePlace("from"), resolvePlace("to")]).then(function (res) {
      var from = res[0], to = res[1];
      plannedFrom = { lat: from.lat, lng: from.lng, name: from.name || fromInputName() };
      plannedTo = { lat: to.lat, lng: to.lng, name: to.name || toInputName() };
      return getRoute(from, to).then(function (route) {
        var km, etaMin, steps;

        if (useGMaps) {
          km = route.legs.reduce(function (a, l) { return a + l.distance.value; }, 0) / 1000;
          etaMin = Math.max(1, Math.round(route.legs.reduce(function (a, l) { return a + l.duration.value; }, 0) / 60));
          steps = [];
          route.legs.forEach(function (leg) {
            leg.steps.forEach(function (s) { steps.push(s); });
          });
          if (!gDirRenderer) {
            gDirRenderer = new gm.DirectionsRenderer({
              map: map,
              suppressMarkers: true,
              polylineOptions: { strokeColor: "#1a73e8", strokeWeight: 7, strokeOpacity: 0.95 }
            });
          }
          gDirRenderer.setDirections(gLastRoute);
          if (gLastRoute && gLastRoute.routes[0]) map.fitBounds(gLastRoute.routes[0].bounds, { top: 60, right: 40, bottom: 40, left: 40 });
        } else {
          var coords = route.geometry.coordinates;
          mlRouteCoords = coords;
          drawMLRoute(coords);

          km = route.distance / 1000;
          etaMin = Math.max(1, Math.round(km / 65 * 60));
          steps = [];
          route.legs.forEach(function (leg) {
            leg.steps.forEach(function (s) { steps.push(s); });
          });

          var b = new maplibregl.LngLatBounds();
          coords.forEach(function (c) { b.extend(c); });
          map.fitBounds(b, { padding: 60 });
        }

        routeCurrent = { km: km, eta: etaMin };

        document.getElementById("navDist").textContent = fmt(km.toFixed(1));
        document.getElementById("navEta").textContent = etaMin + " min";
        document.getElementById("rsDistance").textContent = km.toFixed(1) + " km";
        document.getElementById("rsTime").textContent = etaMin + " min";
        var startNavBtn = document.getElementById("startNavBtn");
        if (startNavBtn) startNavBtn.style.display = "block";
        var fromName = (from.name || fromInputName()).split(",")[0];
        var toName = (to.name || toInputName()).split(",")[0];
        document.getElementById("mapSub").textContent = fromName + " → " + toName;

        document.getElementById("turnList").innerHTML = stepsRows(steps, useGMaps);

        var coordsOut = useGMaps ? [] : route.geometry.coordinates;
        if (useGMaps) {
          route.legs.forEach(function (leg) {
            leg.steps.forEach(function (s) {
              (s.lat_lngs || []).forEach(function (ll) { coordsOut.push([ll.lng(), ll.lat()]); });
            });
          });
        }
        var sharedSteps = steps.map(function (s) {
          if (useGMaps) return { t: gManeuverType(s.maneuver), x: cleanHtml(s.instructions || s.name || ""), d: s.distance.text || "" };
          return { t: s.maneuver.type, x: cleanHtml(s.maneuver.instruction || s.name || ""), d: fmt((s.distance / 1000).toFixed(2)) };
        });
        var ts = Date.now();
        saveRouteToDB({
          gid: groupId,
          from: { lat: from.lat, lng: from.lng, name: from.name || fromInputName() },
          to: { lat: to.lat, lng: to.lng, name: to.name || toInputName() },
          km: km,
          eta: etaMin,
          steps: sharedSteps,
          geojson: coordsOut,
          status: "planned",
          navigator_name: "",
          updated_at: ts
        });
        lastRouteTs = ts;
        routeFittedTs = ts;

        A.toast("Route planned — " + fmt(km.toFixed(1)) + ", ~" + etaMin + " min.", "success");
      });
    }).catch(function (err) {
      A.toast(err.message || "Could not plan route.", "error");
    });
  }

  function parseRoute(route, from, to) {
    var km, etaMin, steps = [], coords;
    if (useGMaps) {
      km = route.legs.reduce(function (a, l) { return a + l.distance.value; }, 0) / 1000;
      etaMin = Math.max(1, Math.round(route.legs.reduce(function (a, l) { return a + l.duration.value; }, 0) / 60));
      route.legs.forEach(function (leg) { leg.steps.forEach(function (s) { steps.push(s); }); });
      coords = [];
      route.legs.forEach(function (leg) {
        leg.steps.forEach(function (s) {
          (s.lat_lngs || []).forEach(function (ll) { coords.push([ll.lng(), ll.lat()]); });
        });
      });
    } else {
      km = route.distance / 1000;
      etaMin = Math.max(1, Math.round(km / 65 * 60));
      route.legs.forEach(function (leg) { leg.steps.forEach(function (s) { steps.push(s); }); });
      coords = route.geometry.coordinates;
    }
    return {
      km: km,
      eta: etaMin,
      geojson: coords,
      steps: steps.map(function (s) {
        if (useGMaps) return { t: gManeuverType(s.maneuver), x: cleanHtml(s.instructions || s.name || ""), d: s.distance.text || "" };
        return { t: s.maneuver.type, x: cleanHtml(s.maneuver.instruction || s.name || ""), d: fmt((s.distance / 1000).toFixed(2)) };
      })
    };
  }

  function buildRoutes(jobs) {
    return Promise.all(jobs.map(function (j) {
      return getRoute(j.from, j.to).then(function (route) {
        return { key: j.key, route: parseRoute(route, j.from, j.to) };
      }).catch(function () { return { key: j.key, route: null }; });
    })).then(function (results) {
      return results.filter(function (r) { return r.route; });
    });
  }

  function startConvoy() {
    if (!groupId || !plannedTo || A.IS_DEMO) return;
    A.fetchMembers(groupId).then(function (members) {
      return A.fetchLocations(groupId).then(function (locs) {
        return { members: members, locs: locs };
      });
    }).then(function (ctx) {
      var byUid = {};
      ctx.members.forEach(function (m) { byUid[m.user_id] = m; });
      var pts = ctx.locs.filter(function (l) {
        var t = tsOf(l.updated_at);
        return l.lat && l.lng && t && (Date.now() - t < 120000);
      }).map(function (l) {
        return { uid: l.user_id, lat: l.lat, lng: l.lng, name: byUid[l.user_id] ? byUid[l.user_id].full_name : "Member" };
      });
      if (meId && !pts.some(function (p) { return p.uid === meId; }) && plannedFrom && plannedFrom.lat) {
        pts.push({ uid: meId, lat: plannedFrom.lat, lng: plannedFrom.lng, name: "You" });
      }
      if (pts.length < 2) return;

      var c = centroid(pts);
      var near = pts.filter(function (p) { return haversineKm(p, c) <= 15; });
      var group = near.length ? near : pts;
      var meet = centroid(group);
      var legs = {};
      pts.forEach(function (p) {
        legs[p.uid] = { from: { lat: p.lat, lng: p.lng, name: p.name }, direct: haversineKm(p, meet) > 15 };
      });

      var convoyFrom = { lat: meet.lat, lng: meet.lng, name: "Meeting point" };
      var jobs = [{ key: "convoy", from: convoyFrom, to: plannedTo }];
      pts.forEach(function (p) {
        var leg = legs[p.uid];
        jobs.push({ key: p.uid, from: { lat: p.lat, lng: p.lng, name: p.name }, to: leg.direct ? plannedTo : convoyFrom });
      });

      return reverseGeocode(meet.lat, meet.lng).then(function (meetName) {
        return buildRoutes(jobs).then(function (results) {
          var data = {
            gid: groupId,
            to: { lat: plannedTo.lat, lng: plannedTo.lng, name: plannedTo.name },
            status: "active",
            navigator_name: navName,
            updated_at: Date.now(),
            convoy: null,
            legs: null
          };
          results.forEach(function (r) {
            if (r.key === "convoy") {
              data.convoy = r.route;
              data.convoy.meet = { lat: meet.lat, lng: meet.lng, name: meetName };
            } else {
              if (!data.legs) data.legs = {};
              data.legs[r.key] = r.route;
              data.legs[r.key].direct = legs[r.key] ? legs[r.key].direct : false;
            }
          });
          if (!data.convoy) return;
          saveRouteToDB(data);
        });
      });
    }).catch(function () {});
  }

  function drawMLRoute(coords) {
    var geojson = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: coords }
    };
    if (map.getSource("route")) {
      map.getSource("route").setData(geojson);
    } else {
      map.addSource("route", { type: "geojson", data: geojson });
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#1d4ed8", "line-width": 11, "line-opacity": 0.4 }
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#3b82f6", "line-width": 7, "line-opacity": 0.95 }
      });
    }
    clearMLEndMarkers();
    addMLEnd(coords[0], "#34d399");
    addMLEnd(coords[coords.length - 1], "#f87171");
  }

  function clearMLEndMarkers() {
    mlEndMarkers.forEach(function (m) { m.remove(); });
    mlEndMarkers = [];
  }

  function addMLEnd(lnglat, color) {
    var el = document.createElement("div");
    el.style.cssText = "width:18px;height:18px;border-radius:50%;background:" + color + ";border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5)";
    var mk = new maplibregl.Marker({ element: el }).setLngLat(lnglat).addTo(map);
    mlEndMarkers.push(mk);
  }

  function drawConvoy(coords, meet) {
    if (useGMaps) {
      if (!gPoly) gPoly = new gm.Polyline({ map: map, strokeColor: "#1a73e8", strokeWeight: 7, strokeOpacity: 0.95 });
      gPoly.setPath(coords.map(function (c) { return { lat: c[1], lng: c[0] }; }));
    } else {
      mlRouteCoords = coords;
      drawMLRoute(coords);
    }
    setMeet(meet);
  }

  function drawLeg(coords) {
    if (useGMaps) {
      if (!gLegPoly) gLegPoly = new gm.Polyline({ map: map, strokeColor: "#22d3ee", strokeWeight: 5, strokeOpacity: 0.9 });
      gLegPoly.setPath(coords.map(function (c) { return { lat: c[1], lng: c[0] }; }));
    } else {
      mlLegCoords = coords;
      var geojson = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } };
      if (map.getSource("leg")) {
        map.getSource("leg").setData(geojson);
      } else {
        map.addSource("leg", { type: "geojson", data: geojson });
        map.addLayer({
          id: "leg-line", type: "line", source: "leg",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#22d3ee", "line-width": 5, "line-opacity": 0.9, "line-dasharray": [0.5, 1.2] }
        });
      }
    }
  }

  function clearLeg() {
    if (useGMaps) {
      if (gLegPoly) gLegPoly.setMap(null);
    } else if (map.getSource && map.getSource("leg")) {
      map.removeLayer("leg-line");
      map.removeSource("leg");
    }
    mlLegCoords = null;
  }

  function setMeet(m) {
    if (!m) return clearMeet();
    if (useGMaps) {
      if (gMeet) gMeet.setMap(null);
      gMeet = new gm.Marker({
        position: { lat: m.lat, lng: m.lng },
        map: map,
        icon: { url: gIcon("#f59e0b") },
        title: m.name || "Meeting point"
      });
      gMeet.addListener("click", function () {
        infoWin.setContent("<strong>Meet here</strong><br><span style='color:#8ea0b8'>" + A.escapeHtml(m.name || "") + "</span>");
        infoWin.open(map, gMeet);
      });
    } else {
      if (mlMeet) mlMeet.remove();
      var el = document.createElement("div");
      el.className = "map-meet-pin";
      el.innerHTML = '<i class="fa-solid fa-location-dot"></i>';
      var popup = new maplibregl.Popup({ offset: 14 }).setHTML(
        "<strong>Meet here</strong><br><span style='color:#8ea0b8'>" + A.escapeHtml(m.name || "") + "</span>"
      );
      mlMeet = new maplibregl.Marker({ element: el }).setLngLat([m.lng, m.lat]).setPopup(popup).addTo(map);
    }
  }

  function clearMeet() {
    if (useGMaps) {
      if (gMeet) gMeet.setMap(null);
    } else if (mlMeet) {
      mlMeet.remove();
    }
    gMeet = null;
    mlMeet = null;
  }

  function fitConvoy() {
    if (!map) return;
    if (useGMaps) {
      var b = new gm.LatLngBounds();
      if (gPoly && gPoly.getPath().getLength()) gPoly.getPath().forEach(function (p) { b.extend(p); });
      if (gLegPoly && gLegPoly.getPath().getLength()) gLegPoly.getPath().forEach(function (p) { b.extend(p); });
      if (gMeet) b.extend(gMeet.getPosition());
      if (b.getNorthEast()) map.fitBounds(b, { top: 60, right: 40, bottom: 40, left: 40 });
    } else {
      var mb = new maplibregl.LngLatBounds();
      if (mlRouteCoords) mlRouteCoords.forEach(function (c) { mb.extend(c); });
      if (mlLegCoords) mlLegCoords.forEach(function (c) { mb.extend(c); });
      map.fitBounds(mb, { padding: 60 });
    }
  }

  function cleanHtml(html) {
    var tmp = document.createElement("div");
    tmp.innerHTML = html || "";
    return tmp.textContent || "";
  }

  function fromInputName() { return (document.getElementById("fromInput").value || "Start").split(",")[0]; }
  function toInputName() { return (document.getElementById("toInput").value || "Destination").split(",")[0]; }

  function gManeuverType(m) {
    if (!m) return "continue";
    var t = m.toUpperCase().replace(/\s+/g, "_");
    var map = {
      "DEPART": "depart",
      "ARRIVE": "arrive",
      "TURN_LEFT": "turn left",
      "TURN_RIGHT": "turn right",
      "TURN_SLIGHT_LEFT": "turn slight left",
      "TURN_SLIGHT_RIGHT": "turn slight right",
      "TURN_SHARP_LEFT": "turn sharp left",
      "TURN_SHARP_RIGHT": "turn sharp right",
      "UTURN_LEFT": "turn sharp left",
      "UTURN_RIGHT": "turn sharp right",
      "STRAIGHT": "straight",
      "MERGE": "merge",
      "ROUNDABOUT_LEFT": "roundabout",
      "ROUNDABOUT_RIGHT": "roundabout",
      "KEEP_LEFT": "merge",
      "KEEP_RIGHT": "merge",
      "FORK_LEFT": "fork",
      "FORK_RIGHT": "fork",
      "RAMP_LEFT": "ramp",
      "RAMP_RIGHT": "ramp",
      "NAME_CHANGE": "continue"
    };
    return map[t] || "continue";
  }

  function maneuverIcon(type) {
    var icons = {
      depart: '<i class="fa-solid fa-play"></i>',
      arrive: '<i class="fa-solid fa-flag-checkered"></i>',
      "turn right": '<i class="fa-solid fa-arrow-turn-right"></i>',
      "turn left": '<i class="fa-solid fa-arrow-turn-left"></i>',
      "turn sharp right": '<i class="fa-solid fa-arrow-turn-up-right"></i>',
      "turn sharp left": '<i class="fa-solid fa-arrow-turn-up-left"></i>',
      "turn slight right": '<i class="fa-solid fa-arrow-turn-down-right"></i>',
      "turn slight left": '<i class="fa-solid fa-arrow-turn-down-left"></i>',
      "straight": '<i class="fa-solid fa-arrow-up"></i>',
      "merge": '<i class="fa-solid fa-code-merge"></i>',
      "roundabout": '<i class="fa-solid fa-rotate-right"></i>',
      "enter roundabout": '<i class="fa-solid fa-rotate-right"></i>',
      "exit roundabout": '<i class="fa-solid fa-rotate-right"></i>',
      "ramp": '<i class="fa-solid fa-arrow-right-to-bracket"></i>',
      "exit": '<i class="fa-solid fa-arrow-right-from-bracket"></i>',
      "fork": '<i class="fa-solid fa-code-fork"></i>',
      "end of road": '<i class="fa-solid fa-sign-hanging"></i>',
      "continue": '<i class="fa-solid fa-arrow-up"></i>'
    };
    return icons[type] || '<i class="fa-solid fa-arrow-right"></i>';
  }

  function fmt(v) { return Math.round(v * 10) / 10 + " km"; }

  function openDir() {
    var panel = document.getElementById("dirPanel");
    var toggle = document.getElementById("dirToggle");
    if (panel) panel.classList.add("open");
    if (toggle) toggle.classList.add("open");
    if (!dirReady) {
      dirReady = true;
      document.getElementById("fromInput").value = "Current location";
      document.getElementById("fromInput").placeholder = "Current location";
      setupAutocomplete("from");
      setupAutocomplete("to");
      if (!document.getElementById("toInput").value.trim()) {
        document.getElementById("toInput").placeholder = "Type a place to search…";
      }
    }
    setTimeout(function () { var i = document.getElementById("toInput"); if (i) i.focus(); }, 60);
  }

  function closeDir() {
    var panel = document.getElementById("dirPanel");
    var toggle = document.getElementById("dirToggle");
    if (panel) panel.classList.remove("open");
    if (toggle) toggle.classList.remove("open");
  }

  function setupAutocomplete(key) {
    var wrap = document.getElementById(key + "Wrap");
    var input = document.getElementById(key + "Input");
    var list = document.getElementById(key + "List");

    input.addEventListener("input", function () {
      clearTimeout(debounceTimers[key]);
      var q = input.value.trim();
      if (picked[key] && picked[key].name !== q) picked[key] = null;
      debounceTimers[key] = setTimeout(function () { search(key, q); }, 350);
    });

    input.addEventListener("focus", function () {
      var q = input.value.trim();
      if (!q) {
        if (key === "from") renderItems(key, [{ current: true, label: "Use my current location" }]);
      } else {
        search(key, q);
      }
    });

    input.addEventListener("keydown", function (e) {
      if (!list.classList.contains("open")) return;
      var items = Array.prototype.slice.call(list.querySelectorAll(".ac-item"));
      if (!items.length) return;
      var idx = items.indexOf(list.querySelector(".active"));
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(items, Math.min(items.length - 1, idx + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(items, Math.max(0, idx - 1));
      } else if (e.key === "Enter") {
        var sel = list.querySelector(".active");
        if (sel) { e.preventDefault(); select(key, items.indexOf(sel)); }
      } else if (e.key === "Escape") {
        closeList(key);
      }
    });

    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) closeList(key);
    });
  }

  function search(key, q) {
    if (!q) {
      if (key === "from") renderItems(key, [{ current: true, label: "Use my current location" }]);
      else closeList(key);
      return;
    }
    fetchNominatim(q, 6)
      .then(function (rows) {
        if (!rows || !rows.length) { closeList(key); return; }
        renderItems(key, rows.map(function (row) {
          return { label: row.display_name, lat: parseFloat(row.lat), lng: parseFloat(row.lon) };
        }));
      }).catch(function () { closeList(key); });
  }

  function renderItems(key, items) {
    var list = document.getElementById(key + "List");
    list.innerHTML = items.map(function (it, i) {
      var icon = it.current ? '<i class="fa-solid fa-location-crosshairs"></i>' : '<i class="fa-solid fa-map-pin"></i>';
      var parts = it.label.split(",");
      var name = parts[0];
      var sub = parts.slice(1).join(",").trim();
      return '<div class="ac-item' + (i === 0 ? " active" : "") + '" data-i="' + i + '"' +
        (it.current ? "" : ' data-lat="' + it.lat + '" data-lng="' + it.lng + '"') + ">" + icon +
        '<div style="min-width:0"><span style="display:block;color:var(--text-100);font-weight:600">' + A.escapeHtml(name) + "</span>" +
        (sub ? '<span style="font-size:.72rem;color:var(--text-600)">' + A.escapeHtml(sub) + "</span>" : "") + "</div></div>";
    }).join("");
    list.classList.add("open");
    list.parentElement.style.zIndex = "50";
    list.querySelectorAll(".ac-item").forEach(function (el) {
      el.addEventListener("click", function () { select(key, parseInt(el.dataset.i, 10)); });
      el.addEventListener("mousemove", function () { setActive(list.querySelectorAll(".ac-item"), parseInt(el.dataset.i, 10)); });
    });
  }

  function setActive(items, i) {
    items.forEach(function (el, x) { el.classList.toggle("active", x === i); });
  }

  function select(key, i) {
    var list = document.getElementById(key + "List");
    var items = list.querySelectorAll(".ac-item");
    var el = items[i];
    if (!el) return;
    closeList(key);
    var input = document.getElementById(key + "Input");
    if (el.dataset.lat) {
      var spans = el.querySelectorAll("span");
      var full = spans[0].textContent + (spans[1] ? ", " + spans[1].textContent : "");
      picked[key] = { lat: parseFloat(el.dataset.lat), lng: parseFloat(el.dataset.lng), name: full };
      input.value = full;
      return;
    }
    currentLocation().then(function (loc) {
      picked[key] = loc;
      input.value = "Current location";
    }).catch(function (err) { A.toast(err.message, "error"); });
  }

  function closeList(key) {
    var list = document.getElementById(key + "List");
    list.classList.remove("open");
    list.parentElement.style.zIndex = "";
  }

  var goLiveBtn = document.getElementById("goLiveBtn");
  if (goLiveBtn) goLiveBtn.addEventListener("click", toggleLive);

  var fitBtn = document.getElementById("fitBtn");
  if (fitBtn) fitBtn.addEventListener("click", fitMarkers);

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
        mlStyle = mlStyle === "satellite" ? "light" : "satellite";
        map.setStyle(mlStyle === "satellite" ? ML_SAT : ML_LIGHT);
      }
    });
  }

  var styleSwitch = document.getElementById("styleSwitch");
  if (styleSwitch) {
    styleSwitch.querySelectorAll(".btn-sm").forEach(function (b) {
      b.addEventListener("click", function () { setMapStyle(b.dataset.style); });
    });
  }

  function setMapStyle(mode) {
    mlStyle = mode;
    var sw = document.getElementById("styleSwitch");
    if (sw) {
      sw.querySelectorAll(".btn-sm").forEach(function (b) {
        b.classList.toggle("active", b.dataset.style === mode);
      });
    }
    if (useGMaps) {
      if (mode === "satellite") {
        map.setMapTypeId(gm.MapTypeId.SATELLITE);
      } else {
        map.setMapTypeId(gm.MapTypeId.ROADMAP);
        map.setOptions({ styles: mode === "dark" ? gmDark : [] });
      }
    } else if (map) {
      var style = mode === "satellite" ? ML_SAT : (mode === "dark" ? ML_DARK : ML_LIGHT);
      map.setStyle(style);
    }
  }

  var dirToggle = document.getElementById("dirToggle");
  if (dirToggle) dirToggle.addEventListener("click", openDir);
  var dirClose = document.getElementById("dirClose");
  if (dirClose) dirClose.addEventListener("click", closeDir);

  var calcBtn = document.getElementById("calcBtn");
  if (calcBtn) calcBtn.addEventListener("click", planRoute);

  var swapBtn = document.getElementById("swapBtn");
  if (swapBtn) {
    swapBtn.addEventListener("click", function () {
      var f = document.getElementById("fromInput"), t = document.getElementById("toInput");
      var tmp = f.value; f.value = t.value; t.value = tmp;
      var tp = picked.from; picked.from = picked.to; picked.to = tp;
      planRoute();
    });
  }

  var startNavBtn = document.getElementById("startNavBtn");
  if (startNavBtn) {
    startNavBtn.addEventListener("click", function () {
      if (!routeCurrent) { A.toast("Plan a route first.", "info"); return; }
      navActive = !navActive;
      if (navActive) {
        startNavBtn.classList.replace("btn-success", "btn-danger");
        startNavBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop navigation';
        closeDir();
        A.toast("Navigation started. Following you along the route.", "success");
        centerOnMe();
        A.getProfile().then(function (p) {
          navName = (p && p.full_name) || "You";
          saveRouteToDB({ gid: groupId, status: "active", navigator_name: navName, updated_at: Date.now() });
        });
        startConvoy();
        if (navigator.geolocation && !A.IS_DEMO) {
          navWatchId = navigator.geolocation.watchPosition(function (pos) {
            if (navActive && !trackId) setView(pos.coords.latitude, pos.coords.longitude, 15);
          }, function () {}, { enableHighAccuracy: true });
        }
      } else {
        startNavBtn.classList.replace("btn-danger", "btn-success");
        startNavBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start navigation';
        if (navWatchId != null && navigator.geolocation) navigator.geolocation.clearWatch(navWatchId);
        navWatchId = null;
        saveRouteToDB({ gid: groupId, status: "planned", navigator_name: "", updated_at: Date.now() });
        A.toast("Navigation ended.", "info");
      }
    });
  }

  var stopTrackBtn = document.getElementById("stopTrackBtn");
  if (stopTrackBtn) {
    stopTrackBtn.addEventListener("click", function () {
      trackId = null;
      trackName = "";
      refreshTrackingUI();
      A.toast("Stopped tracking.", "info");
    });
  }

  init();
})();
