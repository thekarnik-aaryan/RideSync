(function () {
  var A = window.RSApp;
  var map = null;
  var current = null;
  var base = { lat: 33.685, lng: -84.302 };
  var picked = { from: null, to: null };
  var debounceTimers = { from: null, to: null };
  var useGMaps = false;
  var useML = false;
  var gm = null;
  var gDirService = null;
  var gDirRenderer = null;
  var gLastRoute = null;
  var mlRouteCoords = null;
  var mlEndMarkers = [];
  var known = {
    "canyon": [33.91, -84.32],
    "lake": [33.59, -84.15],
    "falls": [34.21, -83.95],
    "coffee": [33.75, -84.39],
    "home": [base.lat, base.lng]
  };

  var ML_LIBERTY = "https://tiles.openfreemap.org/styles/liberty";

  var gmDark = [
    { elementType: "geometry", stylers: [{ color: "#0f1420" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0f1420" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8ea0b8" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a2233" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#aebecd" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#232d41" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b1626" }] }
  ];

  function geocode(query) {
    var clean = query.trim().toLowerCase().replace(/\s+/g, "");
    if (known[clean]) return Promise.resolve({ lat: known[clean][0], lng: known[clean][1], name: query });
    return fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(query.trim()))
      .then(function (res) { return res.json(); })
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

  function planRoute() {
    Promise.all([resolvePlace("from"), resolvePlace("to")]).then(function (res) {
      var from = res[0], to = res[1];
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
              polylineOptions: { strokeColor: "#22d3ee", strokeWeight: 6, strokeOpacity: 0.9 }
            });
          }
          gDirRenderer.setDirections(gLastRoute);
          if (gLastRoute && gLastRoute.routes[0]) map.fitBounds(gLastRoute.routes[0].bounds, { top: 40, right: 40, bottom: 40, left: 40 });
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

        current = { km: km, eta: etaMin };

        document.getElementById("navDist").textContent = fmt(km.toFixed(1));
        document.getElementById("navEta").textContent = etaMin + " min";
        var fromName = (from.name || fromInputName()).split(",")[0];
        var toName = (to.name || toInputName()).split(",")[0];
        document.getElementById("navSub").textContent = fromName + " → " + toName;

        if (!steps.length) {
          document.getElementById("turnList").innerHTML =
            '<div style="display:flex;gap:12px;padding:11px 6px;border-bottom:1px solid var(--line)">' +
            '<div class="icon-box icon-green" style="width:32px;height:32px;font-size:.72rem"><i class="fa-solid fa-flag-checkered"></i></div>' +
            '<div style="font-size:.87rem;color:var(--text-300)">You\'ve reached your destination 🎉</div></div>';
        } else {
          document.getElementById("turnList").innerHTML = steps.map(function (s, i) {
            var icon;
            var dist;
            if (useGMaps) {
              icon = maneuverIcon(gManeuverType(s.maneuver));
              dist = s.distance.text || "";
            } else {
              icon = maneuverIcon(s.maneuver.type);
              dist = fmt((s.distance / 1000).toFixed(2));
            }
            var text = cleanHtml(useGMaps ? (s.instructions || s.name || "") : (s.maneuver.instruction || s.name || ""));
            return '<div style="display:flex;gap:12px;padding:11px 6px;border-bottom:1px solid var(--line)">' +
              '<div class="icon-box ' + (i === 0 ? "icon-green" : "icon-cyan") + '" style="width:32px;height:32px;font-size:.72rem">' + icon + "</div>" +
              '<div style="font-size:.87rem;color:var(--text-300);flex:1">' + A.escapeHtml(text) +
              '<div style="font-size:.72rem;color:var(--text-600);margin-top:2px">' + dist + "</div></div></div>";
          }).join("");
        }
        A.toast("Route planned — " + fmt(km.toFixed(1)) + ", ~" + etaMin + " min.", "success");
      });
    }).catch(function (err) {
      A.toast(err.message || "Could not plan route.", "error");
    });
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
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": "#22d3ee",
          "line-width": 6,
          "line-opacity": 0.9,
          "line-dasharray": [0.3, 1.5]
        }
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
    fetch("https://nominatim.openstreetmap.org/search?format=json&limit=6&q=" + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
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
  }

  function init() {
    if (!document.getElementById("navMap")) return;
    A.requireAuth().then(function () {
      return A.getActiveGroup().then(function (g) {
        if (g) {
          A.setActiveGroupId(g.id);
          A.renderShell("navigation", "Navigation", g.name);
        } else {
          A.renderShell("navigation", "Navigation");
        }

        A.loadGoogleMaps().then(function (gmap) {
          useGMaps = true;
          gm = gmap;
          gDirService = new gm.DirectionsService();
          map = new gm.Map(document.getElementById("navMap"), {
            center: base,
            zoom: 13,
            disableDefaultUI: true,
            zoomControl: true,
            zoomControlOptions: { position: gm.ControlPosition.BOTTOM_RIGHT },
            styles: gmDark
          });
          boot();
        }).catch(function () {
          if (typeof maplibregl === "undefined") {
            document.getElementById("navMap").innerHTML =
              '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-300);font-size:.9rem;gap:10px">' +
              '<i class="fa-solid fa-triangle-exclamation"></i> Could not load a map. Check your connection and refresh.</div>';
            return;
          }
          useML = true;
          map = new maplibregl.Map({
            container: "navMap",
            style: ML_LIBERTY,
            center: [base.lng, base.lat],
            zoom: 13
          });
          map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
          boot();
        });
      });
    });
  }

  function boot() {
    document.getElementById("fromInput").value = "Current location";
    document.getElementById("fromInput").placeholder = "Current location";
    document.getElementById("toInput").placeholder = "Type a place to search…";
    setupAutocomplete("from");
    setupAutocomplete("to");
    if (!document.getElementById("toInput").value.trim()) {
      document.getElementById("toInput").value = "Red Rock Canyon";
    }
    planRoute();
  }

  var calcBtn = document.getElementById("calcBtn");
  if (calcBtn) {
    calcBtn.addEventListener("click", function () {
      planRoute();
    });
  }
  var swapBtn = document.getElementById("swapBtn");
  if (swapBtn) {
    swapBtn.addEventListener("click", function () {
      var f = document.getElementById("fromInput"), t = document.getElementById("toInput");
      var tmp = f.value; f.value = t.value; t.value = tmp;
      var tp = picked.from; picked.from = picked.to; picked.to = tp;
      planRoute();
    });
  }
  var fitBtn = document.getElementById("navFitBtn");
  if (fitBtn) {
    fitBtn.addEventListener("click", function () {
      if (useGMaps) {
        if (gLastRoute && gLastRoute.routes[0]) map.fitBounds(gLastRoute.routes[0].bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      } else if (mlRouteCoords) {
        var b = new maplibregl.LngLatBounds();
        mlRouteCoords.forEach(function (c) { b.extend(c); });
        map.fitBounds(b, { padding: 60 });
      }
    });
  }
  var startBtn = document.getElementById("startNavBtn");
  if (startBtn) {
    startBtn.addEventListener("click", function () {
      if (!current) { A.toast("Plan a route first.", "info"); return; }
      A.toast("Navigation started. Follow the route with your group!", "success");
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (pos) {
          if (useGMaps) {
            map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            map.setZoom(15);
          } else {
            map.setCenter([pos.coords.longitude, pos.coords.latitude]);
            map.setZoom(15);
          }
        }, function () {}, { enableHighAccuracy: true });
      }
    });
  }

  init();
})();
