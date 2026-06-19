const DB_PATH = "data/artists.json";

let artists = [];
let hints = [];
let selectedGuessArtist = null;

// selections for non-numeric guess attributes (include/exclude)
let selectedGuessSelections = { genre: null, members: null, gender: null, country: null, debut: null, popularity: null };

const COUNTRY_CONTINENT = {
  AM: "ASIA", AR: "SOUTH_AMERICA", AU: "OCEANIA", BB: "NORTH_AMERICA", BE: "EUROPE",
  BR: "SOUTH_AMERICA", CA: "NORTH_AMERICA", CD: "AFRICA", CL: "SOUTH_AMERICA", CO: "SOUTH_AMERICA",
  DE: "EUROPE", DK: "EUROPE", DZ: "AFRICA", ES: "EUROPE", FR: "EUROPE", PL: "EUROPE",
  GB: "EUROPE", GH: "AFRICA", MA: "AFRICA", HR: "EUROPE", HT: "NORTH_AMERICA", ID: "ASIA",
  IE: "EUROPE", IS: "EUROPE", IT: "EUROPE", JM: "NORTH_AMERICA", JP: "ASIA",
  KG: "ASIA", KR: "ASIA", TH: "ASIA", CZ: "EUROPE", IL: "ASIA", MX: "NORTH_AMERICA", NG: "AFRICA", NL: "EUROPE",
  NO: "EUROPE", NP: "ASIA", NZ: "OCEANIA", PH: "ASIA", PK: "ASIA",
  PR: "NORTH_AMERICA", RO: "EUROPE", RU: "EUROPE", SE: "EUROPE", TR: "ASIA",
  TZ: "AFRICA", UA: "EUROPE", US: "NORTH_AMERICA", UY: "SOUTH_AMERICA", VE: "SOUTH_AMERICA",
  VN: "ASIA", ZA: "AFRICA", CL: "SOUTH_AMERICA", BR: "SOUTH_AMERICA", AR: "SOUTH_AMERICA"
};
function continentOf(code) {
  if (!code) return null;
  const c = String(code).trim().toUpperCase();
  return COUNTRY_CONTINENT[c] || null;
}

// guess arrows/flags state
const guessFlags = {
  debut: { enabled: false, up: false, down: false },
  popularity: { enabled: false, up: false, down: false },
};

const openHintBtn = document.getElementById("openHintCard");
const addHintBtn = document.getElementById("addHint");
const hintsContainer = document.getElementById("hintsContainer");

const resultsList = document.getElementById("resultsList");
const countEl = document.getElementById("count");
const bestMatchEl = document.getElementById("bestMatch");

const guessesContainer = document.getElementById("guessesContainer");
const addGuessBtn = document.getElementById("addGuessBtn");

// multiple guesses support
const MAX_GUESSES = 10;
let guesses = [];

function makeEmptyGuess() {
  return {
    id: String(Date.now()) + Math.random().toString(36).slice(2),
    artist: null,
    // 'created' no longer used for remove-button logic
    selections: { genre: null, members: null, gender: null, country: null, debut: null, popularity: null },
    flags: { debut: { enabled: false, up: false, down: false }, popularity: { enabled: false, up: false, down: false } }
  };
}

function createSelect(options, placeholder = "Select value") {
  const sel = document.createElement("select");
  sel.id = "hintValue";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = placeholder;
  ph.disabled = true;
  ph.selected = true;
  sel.appendChild(ph);
  options.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o;
    if (typeof o === "string" && /^[A-Za-z]{2}$/.test(o)) {
      opt.textContent = `${countryEmoji(o)} ${o}`;
    } else {
      opt.textContent = o;
    }
    sel.appendChild(opt);
  });
  return sel;
}

function createNumber() {
  const inp = document.createElement("input");
  inp.id = "hintValue";
  inp.type = "number";
  inp.min = "0";
  return inp;
}

/* helper: convert 2-letter country code (US, GB) to flag emoji */
function countryEmoji(code) {
  if (!code || typeof code !== "string") return "";
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "";
  const base = 0x1F1E6; // regional indicator symbol letter A
  return String.fromCodePoint(base + (c.charCodeAt(0) - 65)) +
         String.fromCodePoint(base + (c.charCodeAt(1) - 65));
}

function artistIconPath(name) {
  return "data/icons/" + name.replace(/ /g, "_") + ".jpg";
}

function updateGuessSummary(el, guess) {
  if (!el || !guess.artist) return;
  const attrs = [
    { k: "debut",      label: "Debut"   },
    { k: "popularity", label: "Pop"     },
    { k: "members",    label: "Members" },
    { k: "genre",      label: "Genre"   },
    { k: "country",    label: "Country" },
    { k: "gender",     label: "Gender"  },
  ];
  const namePill = `<span class="summary-pill state-name">${guess.artist.name}</span>`;
  const pills = attrs.map(({ k, label }) => {
    const sel = guess.selections[k];
    const flags = guess.flags && guess.flags[k];
    let cls = "", icon = "–";
    if (sel === "include" || sel === "exact") { cls = "state-check"; icon = "✓"; }
    else if (sel === "exclude" || sel === "not_continent" || sel === "far") {
      cls = "state-x"; icon = "✕";
      if (flags && flags.enabled) icon += flags.up ? "↑" : flags.down ? "↓" : "";
    } else if (sel === "near" || sel === "continent") {
      cls = "state-o"; icon = "○";
      if (flags && flags.enabled) icon += flags.up ? "↑" : flags.down ? "↓" : "";
    }
    return `<span class="summary-pill ${cls}">${label} <strong>${icon}</strong></span>`;
  }).join("");
  el.innerHTML = namePill + pills;
}


function renderHintValueInput() {
  valueContainer.innerHTML = "";
  const type = fieldSelect.value;
  if (!type) return;
  if (["Genre","Gender","CountryCode","Members"].includes(type)) {
    const prop = mapTypeToProp(type);
    const options = Array.from(new Set(artists.map(a => a[prop]))).filter(Boolean).sort();
    if (options.length) valueContainer.appendChild(createSelect(options));
    else valueContainer.textContent = "No values";
  } else {
    valueContainer.appendChild(createNumber());
  }
}

// Hints: dynamic cards (add / edit / remove)
function createHintTypeSelect(selected) {
  const sel = document.createElement("select");
  sel.className = "hint-field-select";
  ["", "Genre", "Gender", "CountryCode", "Members", "DebutYear", "Popularity"].forEach(opt => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt || "Select hint type";
    if (opt === selected) o.selected = true;
    sel.appendChild(o);
  });
  return sel;
}

function createHintValueInput(type, currentValue) {
  if (["Genre","Gender","CountryCode","Members"].includes(type)) {
    const prop = mapTypeToProp(type);
    const options = Array.from(new Set(artists.map(a => a[prop]))).filter(Boolean).sort();
    if (!options.length) {
      const span = document.createElement("span");
      span.textContent = "No values";
      return span;
    }
    const sel = createSelect(options);
    if (currentValue) sel.value = currentValue;
    return sel;
  } else {
    const num = createNumber();
    if (currentValue) num.value = currentValue;
    return num;
  }
}

/* extracted helper: attach a value input into a provided container and wire auto-save */
function attachValueInput(valueWrap, type, currentValue, index) {
  valueWrap.innerHTML = "";
  if (!type) return;
  const input = createHintValueInput(type, currentValue || "");
  valueWrap.appendChild(input);

  const commit = (t, v) => {
    if (!v) return;
    if (typeof index === "number" && index >= 0) hints[index] = { type: t, value: v };
    else hints.push({ type: t, value: v });
    renderHints();
    applyFilters();
  };

  if (input.tagName === "SELECT") {
    input.addEventListener("change", () => commit(type, (input.value || "").trim()));
  } else {
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") commit(type, (input.value || "").trim());
    });
    input.addEventListener("blur", () => commit(type, (input.value || "").trim()));
  }
}

function createEditableHintDOM(hint, index) {
  const wrapper = document.createElement("div");
  wrapper.className = "hint-card";
  const header = document.createElement("div");
  header.className = "hint-card-header";
  header.innerHTML = `<span>Hint #${(typeof index === "number" && index >= 0) ? (index+1) : (hints.length+1)}</span>`;

  const rm = document.createElement("button");
  rm.className = "remove-hint-btn";
  rm.title = "Remove hint";
  rm.textContent = "✕";
  header.appendChild(rm);

  const body = document.createElement("div");
  body.className = "hint-card-body";
  const fieldWrap = document.createElement("div");
  fieldWrap.className = "hint-field";
  const valueWrap = document.createElement("div");
  valueWrap.className = "hint-value";

  const selType = createHintTypeSelect(hint?.type || "");
  fieldWrap.appendChild(selType);

// if editing an existing hint, show value immediately
  if (hint && hint.type) {
    attachValueInput(valueWrap, hint.type, hint.value, index);
  }

  // when type changes, attach value input (and auto-save when value chosen)
  selType.addEventListener("change", () => {
    const t = selType.value;
    attachValueInput(valueWrap, t, "", index);
  });

  // remove handler for editor (appears immediately)
  rm.addEventListener("click", () => {
    if (typeof index === "number" && index >= 0) {
      hints.splice(index, 1);
    }
    renderHints();
    applyFilters();
  });

  body.appendChild(fieldWrap);
  body.appendChild(valueWrap);

  wrapper.appendChild(header);
  wrapper.appendChild(body);
  return wrapper;
}

function createDisplayHintDOM(hint, index) {
  const wrapper = document.createElement("div");
  wrapper.className = "hint-card";

  const header = document.createElement("div");
  header.className = "hint-card-header";
  header.innerHTML = `<span>Hint #${index+1}</span>`;
  const rm = document.createElement("button");
  rm.className = "remove-hint-btn";
  rm.title = "Remove hint";
  rm.textContent = "✕";
  header.appendChild(rm);

  const body = document.createElement("div");
  body.className = "hint-card-body";
  const valueText = (hint.type === "CountryCode") ? `${countryEmoji(hint.value)} ${hint.value}` : hint.value;
  body.innerHTML = `
    <div class="hint-field"><strong>${hint.type}</strong></div>
    <div class="hint-value"><span class="small">${valueText}</span></div>
  `;

  rm.addEventListener("click", () => {
    hints.splice(index, 1);
    renderHints();
    applyFilters();
  });

  wrapper.appendChild(header);
  wrapper.appendChild(body);
  return wrapper;
}

function renderHints() {
  if (!hintsContainer) return;
  hintsContainer.innerHTML = "";
  hints.forEach((h, idx) => {
    if (h && h._unsaved) {
      hintsContainer.appendChild(createEditableHintDOM(null, idx));
    } else {
      hintsContainer.appendChild(createDisplayHintDOM(h, idx));
    }
  });

  Array.from(hintsContainer.querySelectorAll(".hint-card-header")).forEach((el, i) => {
    const span = el.querySelector("span");
    if (span) span.textContent = `Hint #${i+1}`;
    else el.textContent = `Hint #${i+1}`;
  });

  if (addHintBtn) addHintBtn.disabled = false;
}

function addNewHint() {
  // reserve a placeholder slot so the hint counter increments immediately
  const idx = hints.length;
  hints.push({ type: "", value: "", _unsaved: true });
  // re-render to update numbering, then replace the placeholder card with an editor
  renderHints();
  const existingCard = hintsContainer.querySelectorAll(".hint-card")[idx];
  const editor = createEditableHintDOM(null, idx);
  if (existingCard) existingCard.replaceWith(editor);
  else hintsContainer.appendChild(editor);
  // focus first field
  setTimeout(() => {
    const f = editor.querySelector("select");
    if (f) f.focus();
  }, 0);
}

function mapTypeToProp(type) {
  return {
    Genre: "genre",
    Gender: "gender",
    CountryCode: "country",
    Members: "members",
    DebutYear: "debut",
    Popularity: "popularity"
  }[type];
}

function mode(values) {
  if (!values.length) return [];
  const counts = values.reduce((m, v) => (m[v] = (m[v] || 0) + 1, m), {});
  let bestCount = 0;
  for (const c of Object.values(counts)) if (c > bestCount) bestCount = c;
  return Object.keys(counts).filter(k => counts[k] === bestCount).sort();
}

function computeBestMatch(list) {
  if (!list.length) return null;
  const avg = (arr) => Math.round(arr.reduce((s,v) => s + Number(v), 0) / arr.length);
  return {
    debut: avg(list.map(a => a.debut)),
    popularity: avg(list.map(a => a.popularity)),
    members: mode(list.map(a => a.members)),
    genre: mode(list.map(a => a.genre)),
    country: mode(list.map(a => a.country)),
    gender: mode(list.map(a => a.gender))
  };
}

function scoreNumeric(value, avg, span) {
  if (span <= 0) return value === avg ? 1 : 0;
  const delta = Math.abs(value - avg);
  const s = 1 - (delta / span);
  return Math.max(0, Math.min(1, s));
}

function findBestArtist(list, bm) {
  if (!bm || !list.length) return null;
  const debutVals = list.map(a => a.debut);
  const popVals = list.map(a => a.popularity);
  const debutSpan = Math.max(...debutVals) - Math.min(...debutVals) || 1;
  const popSpan = Math.max(...popVals) - Math.min(...popVals) || 1;

  let best = null;
  let bestScore = -1;
  for (const a of list) {
    const sd = scoreNumeric(a.debut, bm.debut, debutSpan);
    const sp = scoreNumeric(a.popularity, bm.popularity, popSpan);
    const sm = bm.members.includes(a.members) ? 1 : 0;
    const sg = bm.genre.includes(a.genre) ? 1 : 0;
    const sc = bm.country.includes(a.country) ? 1 : 0;
    const sgen = bm.gender.includes(a.gender) ? 1 : 0;
    const total = (sd + sp + sm + sg + sc + sgen) / 6;
    if (total > bestScore) { bestScore = total; best = { artist: a, score: total }; }
    else if (total === bestScore && best) {
      if (a.popularity > best.artist.popularity) best = { artist: a, score: total };
    }
  }
  return best ? best.artist : null;
}

function renderBestMatch(list) {
  const bm = computeBestMatch(list);
  bestMatchEl.innerHTML = "";
  if (!bm) {
    bestMatchEl.innerHTML = `<li class="small">No best match (no results)</li>`;
    return null;
  }
  const bestArtist = findBestArtist(list, bm);
  const li = document.createElement("li");
  if (bestArtist) {
    const bmImg = document.createElement("img");
    bmImg.src = artistIconPath(bestArtist.name);
    bmImg.className = "result-artist-img";
    bmImg.alt = "";
    bmImg.addEventListener("error", () => { bmImg.style.display = "none"; });
    const left = document.createElement("div");
    left.className = "result-artist-info";
    left.innerHTML = `<div><strong class="${bestArtist.updated ? 'artist-updated' : 'artist-not-updated'}">${bestArtist.name}</strong></div>
      <div class="small"> ${bestArtist.debut} • ${bestArtist.genre} • ${bestArtist.members} • ${bestArtist.country} • ${bestArtist.gender} • Popularity ${bestArtist.popularity}</div>`;
    const addBtn = document.createElement("button");
    addBtn.className = "btn-add add-from-match";
    addBtn.title = "Add as guess";
    addBtn.textContent = "+";
    addBtn.addEventListener("click", () => addGuessFromArtist(bestArtist));
    li.appendChild(bmImg);
    li.appendChild(left);
    li.appendChild(addBtn);
  } else {
    li.innerHTML = `<div class="small">No candidate found</div>`;
  }
  bestMatchEl.appendChild(li);

  return bestArtist || null;
}

/* -------- Guess UI -------- */
function searchArtists(q) {
  if (!q) return [];
  const t = q.trim().toLowerCase();
  return artists.filter(a => (a.name || "").toLowerCase().includes(t)).slice(0, 8);
}

function selectGuessArtist(a) {
  selectedGuessArtist = a;
  // reset selections/arrows when choosing a new guess
  selectedGuessSelections = { genre: null, members: null, gender: null, country: null, debut: null, popularity: null };
  guessFlags.debut = { enabled: false, up: false, down: false };
  guessFlags.popularity = { enabled: false, up: false, down: false };

  guessInput.value = a.name;
  guessInput.disabled = true;
  searchResults.hidden = true;
  if (removeGuessBtn) {
    removeGuessBtn.hidden = false;
    removeGuessBtn.onclick = () => removeGuess();
  }
  renderGuessCard();
}

function removeGuess() {
  selectedGuessArtist = null;
  selectedGuessSelections = { genre: null, members: null, gender: null, country: null, debut: null, popularity: null };
  guessFlags.debut = { enabled: false, up: false, down: false };
  guessFlags.popularity = { enabled: false, up: false, down: false };
  guessInput.value = "";
  guessInput.disabled = false;
  if (removeGuessBtn) removeGuessBtn.hidden = true;
  renderGuessCard();
  applyFilters();
  guessInput.focus();
}

function renderGuessCard() {
  if (!selectedGuessArtist) { guessCard.hidden = true; return; }
  guessCard.hidden = false;
  guessName.textContent = selectedGuessArtist.name;
  // attributes: DEBUT, POPULARITY, MEMBERS, GENRE, COUNTRY, GENDER
  const attrs = [
    { k: "debut", label: "Debut", v: selectedGuessArtist.debut ?? "—" },
    { k: "popularity", label: "Popularity", v: selectedGuessArtist.popularity ?? "—" },
    { k: "members", label: "Members", v: selectedGuessArtist.members || "—" },
    { k: "genre", label: "Genre", v: selectedGuessArtist.genre || "—" },
    { k: "country", label: "Country", v: selectedGuessArtist.country || "—" },
    { k: "gender", label: "Gender", v: selectedGuessArtist.gender || "—" },
  ];
  guessAttrs.innerHTML = "";
  attrs.forEach(attr => {
    const box = document.createElement("div");
    box.className = "attr-box";

    // create buttons area
    const checkBtn = `<button class="btn-check" data-kind="check" title="match">✓</button>`;
    const xBtn = `<button class="btn-x" data-kind="x" title="no">✕</button>`;
    const oBtn = `<button class="btn-o" data-kind="o" title="partial">○</button>`;

    // arrows only for numeric attributes: debut and popularity
    let arrowsHtml = "";
    if (attr.k === "debut" || attr.k === "popularity") {
      const flags = guessFlags[attr.k];
      const upActive = flags.up ? "data-active='1'" : "";
      const downActive = flags.down ? "data-active='1'" : "";
      const disabled = !flags.enabled ? "disabled" : "";
      if (attr.k === "debut") {
        arrowsHtml = `
          <button class="btn-arrow btn-up" data-arrow="up" ${upActive} ${disabled} title="newer/more">▲</button>
          <button class="btn-arrow btn-down" data-arrow="down" ${downActive} ${disabled} title="older/less">▼</button>
        `;
      } else { // popularity
        arrowsHtml = `
          <button class="btn-arrow btn-up" data-arrow="up" ${upActive} ${disabled} title="lower/less">▲</button>
          <button class="btn-arrow btn-down" data-arrow="down" ${downActive} ${disabled} title="higher/more">▼</button>
        `;
      }
    }

    // omit 'o' for genre, members and gender (only check / exclude)
    const buttonsHtml = (attr.k === "genre" || attr.k === "members" || attr.k === "gender")
      ? `${checkBtn}${xBtn}`
      : `${checkBtn}${xBtn}${oBtn}`;

    box.innerHTML = `<div>
        <div class="attr-label">${attr.label}</div>
        <div class="attr-value">${attr.v}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="attr-buttons">${buttonsHtml}</div>
        <div class="attr-arrows">${arrowsHtml}</div>
      </div>`;

    // attach handlers
    const btns = box.querySelectorAll(".attr-buttons button");
    btns.forEach(btn => {
      btn.addEventListener("click", () => {
        const kind = btn.getAttribute("data-kind");

        // visual active state for this attr's buttons
        btns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // set light-shaded state on the whole attr box
        box.classList.remove("state-check", "state-x", "state-o");
        if (kind === "check") box.classList.add("state-check");
        else if (kind === "x") box.classList.add("state-x");
        else if (kind === "o") box.classList.add("state-o");

        // numeric attrs: enable/disable arrows as before
        if (attr.k === "debut" || attr.k === "popularity") {
          if (kind === "check") {
            selectedGuessSelections[attr.k] = "exact";
            guessFlags[attr.k].enabled = false;
            guessFlags[attr.k].up = false;
            guessFlags[attr.k].down = false;
          } else {
            // x or o -> not exact
            selectedGuessSelections[attr.k] = null;
            guessFlags[attr.k].enabled = true;
            // keep previous up/down state for o/x (user toggles arrows)
          }
          updateGuessCardArrows(attr.k);
          applyFilters();
          return;
        }

        // genre / members / gender: check => include, x => exclude
        if (attr.k === "genre" || attr.k === "members" || attr.k === "gender") {
          if (kind === "check") selectedGuessSelections[attr.k] = "include";
          else if (kind === "x") selectedGuessSelections[attr.k] = "exclude";
          applyFilters();
          return;
        }

        // country: check => same country, o => same continent, x => different continent
        if (attr.k === "country") {
          if (kind === "check") selectedGuessSelections.country = "exact";
          else if (kind === "o") selectedGuessSelections.country = "continent";
          else if (kind === "x") selectedGuessSelections.country = "not_continent";
          applyFilters();
          return;
        }

        // other non-numeric attrs (country/gender) still only set visual state for now
      });
    });

    // arrows handlers (if present)
    const upBtn = box.querySelector(".btn-up");
    const downBtn = box.querySelector(".btn-down");
    if (upBtn) {
      upBtn.addEventListener("click", () => {
        if (!guessFlags[attr.k].enabled) return;
        guessFlags[attr.k].up = !guessFlags[attr.k].up;
        if (guessFlags[attr.k].up) guessFlags[attr.k].down = false;
        updateGuessCardArrows(attr.k);
        applyFilters();
      });
    }
    if (downBtn) {
      downBtn.addEventListener("click", () => {
        if (!guessFlags[attr.k].enabled) return;
        guessFlags[attr.k].down = !guessFlags[attr.k].down;
        if (guessFlags[attr.k].down) guessFlags[attr.k].up = false;
        updateGuessCardArrows(attr.k);
        applyFilters();
      });
    }

    // set initial active state for genre/members if previously selected
    if (attr.k === "genre" || attr.k === "members" || attr.k === "gender") {
      const sel = selectedGuessSelections[attr.k];
      if (sel) {
        const target = box.querySelector(sel === "include" ? ".btn-check" : ".btn-x");
        if (target) target.classList.add("active");
      }
    }

    guessAttrs.appendChild(box);
  });
}

// helper to update arrows DOM state for given key
function updateGuessCardArrows(key) {
  // update all arrow buttons in guess card for key
  const boxes = guessAttrs.querySelectorAll(".attr-box");
  boxes.forEach(box => {
    const labelEl = box.querySelector(".attr-label");
    if (!labelEl) return;
    const label = labelEl.textContent.toLowerCase();
    if ((key === "debut" && label === "debut") || (key === "popularity" && label === "popularity")) {
      const up = box.querySelector(".btn-up");
      const down = box.querySelector(".btn-down");
      if (up) {
        up.disabled = !guessFlags[key].enabled;
        if (guessFlags[key].up) up.setAttribute("data-active", "1"); else up.removeAttribute("data-active");
      }
      if (down) {
        down.disabled = !guessFlags[key].enabled;
        if (guessFlags[key].down) down.setAttribute("data-active", "1"); else down.removeAttribute("data-active");
      }
    }
  });
}

// apply guess-based filters in addition to hints
function applyGuessFilters(list) {
  let out = list.slice();
  const excludeGuessedNames = new Set();

  // Apply non-numeric per-guess filters first (genre/members/gender/country/exact numeric)
  for (const guess of guesses) {
    if (!guess.artist) continue;
    const g = guess.artist;
    const sel = guess.selections;

    // If this guess has any "near" (yellow) marker for numeric attrs or "continent" for country,
    if (sel && (sel.debut === "near" || sel.popularity === "near" || sel.country === "continent")) {
      excludeGuessedNames.add(g.name);
    }

    // genre
    if (sel.genre === "include") out = out.filter(a => a.genre === g.genre);
    else if (sel.genre === "exclude") out = out.filter(a => a.genre !== g.genre);

    // members
    if (sel.members === "include") out = out.filter(a => a.members === g.members);
    else if (sel.members === "exclude") out = out.filter(a => a.members !== g.members);

    // gender
    if (sel.gender === "include") out = out.filter(a => a.gender === g.gender);
    else if (sel.gender === "exclude") out = out.filter(a => a.gender !== g.gender);

    // country (exact / continent / not_continent)
    if (sel.country === "exact") {
      out = out.filter(a => String(a.country).toUpperCase() === String(g.country).toUpperCase());
    } else if (sel.country === "continent") {
      const gc = continentOf(g.country);
      if (gc) {
        out = out.filter(a =>
          continentOf(a.country) === gc &&
          String(a.country).toUpperCase() !== String(g.country).toUpperCase()
        );
      } else {
        out = out.filter(() => false);
      }
    } else if (sel.country === "not_continent") {
      const gc = continentOf(g.country);
      if (gc) {
        out = out.filter(a => continentOf(a.country) !== gc);
      }
    }

    // numeric exacts applied as equality (still non‑range)
    if (sel.debut === "exact") out = out.filter(a => Number(a.debut) === Number(g.debut));
    if (sel.popularity === "exact") out = out.filter(a => Number(a.popularity) === Number(g.popularity));
  }

  // Build numeric intervals for debut and popularity from ALL guesses, then intersect them.
  const debutIntervals = [];
  const popIntervals = [];

  for (const guess of guesses) {
    if (!guess.artist) continue;
    const g = guess.artist;
    const sel = guess.selections || {};
    const flags = guess.flags || {};

    const gDebut = Number(g.debut);
    if (sel.debut === "exact" && !Number.isNaN(gDebut)) {
      debutIntervals.push({ low: gDebut, high: gDebut, lowExclusive: false, highExclusive: false });
    } else if (flags.debut && flags.debut.enabled && !Number.isNaN(gDebut)) {
      if (flags.debut.up) {
        if (sel.debut === "near") {
          // near+up => (g, g+5]
          debutIntervals.push({ low: gDebut, high: gDebut + 5, lowExclusive: true, highExclusive: false });
        } else {
          // far+up => > g+5 (strict)
          debutIntervals.push({ low: gDebut + 5, high: Infinity, lowExclusive: true, highExclusive: false });
        }
      } else if (flags.debut.down) {
        if (sel.debut === "near") {
          // near+down => [g-5, g)
          debutIntervals.push({ low: gDebut - 5, high: gDebut, lowExclusive: false, highExclusive: true });
        } else {
          // far+down => < g-5 (strict)
          debutIntervals.push({ low: -Infinity, high: gDebut - 5, lowExclusive: false, highExclusive: true });
        }
      }
    }

    const gPop = Number(g.popularity);
    if (sel.popularity === "exact" && !Number.isNaN(gPop)) {
      popIntervals.push({ low: gPop, high: gPop, lowExclusive: false, highExclusive: false });
    } else if (flags.popularity && flags.popularity.enabled && !Number.isNaN(gPop)) {
      if (flags.popularity.down) {
        if (sel.popularity === "near") {
          // near+down => [g, g+50]
          popIntervals.push({ low: gPop, high: gPop + 50, lowExclusive: false, highExclusive: false });
        } else {
          // far+down => > g+50
          popIntervals.push({ low: gPop + 50, high: Infinity, lowExclusive: true, highExclusive: false });
        }
      } else if (flags.popularity.up) {
        if (sel.popularity === "near") {
          // near+up => [g-50, g]
          popIntervals.push({ low: gPop - 50, high: gPop, lowExclusive: false, highExclusive: false });
        } else {
          // far+up => < g-50
          popIntervals.push({ low: -Infinity, high: gPop - 50, lowExclusive: false, highExclusive: true });
        }
      }
    }
  }

  function intersectIntervals(arr) {
    if (!arr || !arr.length) return { low: -Infinity, high: Infinity, lowExclusive: false, highExclusive: false };
    let low = -Infinity, high = Infinity, lowExclusive = false, highExclusive = false;
    for (const it of arr) {
      if (it.low > low) { low = it.low; lowExclusive = !!it.lowExclusive; }
      else if (it.low === low) { lowExclusive = lowExclusive || !!it.lowExclusive; }
      if (it.high < high) { high = it.high; highExclusive = !!it.highExclusive; }
      else if (it.high === high) { highExclusive = highExclusive || !!it.highExclusive; }
    }
    return { low, high, lowExclusive, highExclusive };
  }

  const debutInterval = intersectIntervals(debutIntervals);
  const popInterval = intersectIntervals(popIntervals);

  if (!(debutInterval.low === -Infinity && debutInterval.high === Infinity)) {
    out = out.filter(a => {
      const val = Number(a.debut);
      if (Number.isNaN(val)) return false;
      if (debutInterval.low !== -Infinity) {
        if (debutInterval.lowExclusive) { if (!(val > debutInterval.low)) return false; }
        else { if (!(val >= debutInterval.low)) return false; }
      }
      if (debutInterval.high !== Infinity) {
        if (debutInterval.highExclusive) { if (!(val < debutInterval.high)) return false; }
        else { if (!(val <= debutInterval.high)) return false; }
      }
      return true;
    });
  }

  if (!(popInterval.low === -Infinity && popInterval.high === Infinity)) {
    out = out.filter(a => {
      const val = Number(a.popularity);
      if (Number.isNaN(val)) return false;
      if (popInterval.low !== -Infinity) {
        if (popInterval.lowExclusive) { if (!(val > popInterval.low)) return false; }
        else { if (!(val >= popInterval.low)) return false; }
      }
      if (popInterval.high !== Infinity) {
        if (popInterval.highExclusive) { if (!(val < popInterval.high)) return false; }
        else { if (!(val <= popInterval.high)) return false; }
      }
      return true;
    });
  }

  // remove any guessed artists flagged for exclusion
  if (excludeGuessedNames.size) {
    out = out.filter(a => !excludeGuessedNames.has(a.name));
  }

  return out;
}

/* -------- Filters / Results -------- */

function applyFilters() {
  let out = artists.slice();

  for (const h of hints) {
    if (!h) continue;
    if (h._unsaved) continue;      // skip reserved/unsaved slots
    if (!h.type || (h.value === "" || h.value == null)) continue; // skip incomplete hints

    const prop = mapTypeToProp(h.type);
    if (prop === "debut" || prop === "popularity") {
      const n = Number(h.value);
      out = out.filter(a => Number(a[prop]) === n);
    } else {
      out = out.filter(a => a[prop] === h.value);
    }
  }

  // apply guess arrows filters on top of normal hints
  out = applyGuessFilters(out);

  // If there are no hints and no active guesses, show only best match and no matches list
  const anyActiveGuess = guesses.some(g => g.artist);
  if (hints.filter(h => h && !h._unsaved && h.type && h.value).length === 0 && !anyActiveGuess) {
    const bestArtist = renderBestMatch(artists); // compute from full DB
    renderResults([], bestArtist);
    return;
  }

  const bestArtist = renderBestMatch(out);
  renderResults(out, bestArtist);
}

/* existing helper renders (hintsContainer is the canonical container for hint cards) */
function renderHints() {
  if (!hintsContainer) return;
  hintsContainer.innerHTML = "";
  hints.forEach((h, idx) => {
    if (h && h._unsaved) {
      hintsContainer.appendChild(createEditableHintDOM(null, idx));
    } else {
      hintsContainer.appendChild(createDisplayHintDOM(h, idx));
    }
  });

  Array.from(hintsContainer.querySelectorAll(".hint-card-header")).forEach((el, i) => {
    const span = el.querySelector("span");
    if (span) span.textContent = `Hint #${i+1}`;
    else el.textContent = `Hint #${i+1}`;
  });

  if (addHintBtn) addHintBtn.disabled = false;
}

function renderResults(list, bestArtist) {
  resultsList.innerHTML = "";
  countEl.textContent = String(list.length);
  if (list.length === 0) {
    if (hints.length === 0 && !selectedGuessArtist) {
      resultsList.innerHTML = "<li class='small'>No matches yet, add a hint or guess to start.</li>";
    } else {
      resultsList.innerHTML = "<li class='small'>No matches</li>";
    }
    return;
  }

  const added = new Set();

  // If there's a bestArtist, render it first in the matches list (and mark it as added)
  if (bestArtist) {
    const li = document.createElement("li");
    const rImg = document.createElement("img");
    rImg.src = artistIconPath(bestArtist.name);
    rImg.className = "result-artist-img";
    rImg.alt = "";
    rImg.addEventListener("error", () => { rImg.style.display = "none"; });
    const left = document.createElement("div");
    left.className = "result-artist-info";
    left.innerHTML = `<div><strong class="${bestArtist.updated ? 'artist-updated' : 'artist-not-updated'}">${bestArtist.name}</strong> <span class="small">(${bestArtist.debut})</span></div>
      <div class="small">${bestArtist.genre} • ${bestArtist.members} • ${bestArtist.country} • ${bestArtist.gender} • Popularity ${bestArtist.popularity}</div>`;
    const addBtn = document.createElement("button");
    addBtn.className = "btn-add add-from-match";
    addBtn.title = "Add as guess";
    addBtn.textContent = "+";
    addBtn.addEventListener("click", () => addGuessFromArtist(bestArtist));
    li.appendChild(rImg);
    li.appendChild(left);
    li.appendChild(addBtn);
    resultsList.appendChild(li);
    added.add(bestArtist.name);
  }

  // render the rest, skipping any already added (including bestArtist)
  list.forEach(a => {
    if (added.has(a.name)) return;
    const li = document.createElement("li");
    const rImg2 = document.createElement("img");
    rImg2.src = artistIconPath(a.name);
    rImg2.className = "result-artist-img";
    rImg2.alt = "";
    rImg2.addEventListener("error", () => { rImg2.style.display = "none"; });
    const left = document.createElement("div");
    left.className = "result-artist-info";
    left.innerHTML = `<div><strong class="${a.updated ? 'artist-updated' : 'artist-not-updated'}">${a.name}</strong> <span class="small">(${a.debut})</span></div>
      <div class="small">${a.genre} • ${a.members} • ${a.country} • ${a.gender} • Popularity ${a.popularity}</div>`;
    const addBtn = document.createElement("button");
    addBtn.className = "btn-add add-from-match";
    addBtn.title = "Add as guess";
    addBtn.textContent = "+";
    addBtn.addEventListener("click", () => addGuessFromArtist(a));
    li.appendChild(rImg2);
    li.appendChild(left);
    li.appendChild(addBtn);
    resultsList.appendChild(li);
    added.add(a.name);
  });
}

/* events */
if (openHintBtn) openHintBtn.addEventListener("click", addNewHint);

/* replace single-guess handlers with delegated handlers for multiple guess cards */
// delegated input handler: handles all .guess-input fields created dynamically
document.addEventListener("input", (e) => {
  if (!e.target.matches(".guess-input")) return;
  const input = e.target;
  const q = input.value || "";
  const wrapper = input.closest(".guess-item");
  if (!wrapper) return;
  const resultsEl = wrapper.querySelector(".search-results");
  const gid = wrapper.dataset.guessId;
  const guess = guesses.find(g => g.id === gid);
  renderLocalSearchResults(searchArtists(q), resultsEl, (artist) => {
    if (!guess) return;
    guess.artist = artist;
    guess.selections = { genre: null, members: null, gender: null, country: null, debut: null, popularity: null };
    guess.flags = { debut: { enabled: false, up: false, down: false }, popularity: { enabled: false, up: false, down: false } };
    input.value = artist.name;
    input.disabled = true;
    resultsEl.hidden = true;
    const removeBtn = wrapper.querySelector(".remove-guess-btn");
    if (removeBtn) removeBtn.hidden = false;
    const collapseBtn2 = wrapper.querySelector(".collapse-guess-btn");
    if (collapseBtn2) collapseBtn2.hidden = false;
    wrapper.classList.add("island");
    renderGuessCardFor(guess, wrapper);
    updateAddGuessVisibility();
    applyFilters();
  });
});

// click outside any .guess-search hides all result lists
document.addEventListener("click", (e) => {
  if (!e.target.closest(".guess-search")) {
    document.querySelectorAll(".search-results").forEach(el => el.hidden = true);
  }
});

// delegated input handler: handles all .guess-input fields created dynamically
document.addEventListener("input", (e) => {
  if (!e.target.matches(".guess-input")) return;
  const input = e.target;
  const q = input.value || "";
  const wrapper = input.closest(".guess-item");
  if (!wrapper) return;
  const resultsEl = wrapper.querySelector(".search-results");
  const gid = wrapper.dataset.guessId;
  const guess = guesses.find(g => g.id === gid);
  renderLocalSearchResults(searchArtists(q), resultsEl, (artist) => {
    if (!guess) return;
    guess.artist = artist;
    guess.selections = { genre: null, members: null, gender: null, country: null, debut: null, popularity: null };
    guess.flags = { debut: { enabled: false, up: false, down: false }, popularity: { enabled: false, up: false, down: false } };
    input.value = artist.name;
    input.disabled = true;
    resultsEl.hidden = true;
    const removeBtn = wrapper.querySelector(".remove-guess-btn");
    if (removeBtn) removeBtn.hidden = false;
    // put this guess item into a UI island
    wrapper.classList.add("island");
    renderGuessCardFor(guess, wrapper);
    updateAddGuessVisibility();
    applyFilters();
  });
});

/* AdSense / sidebar handling
*/

const ADSENSE_CLIENT = ""; // set after approval
const ADSENSE_SLOTS = { banner: "BANNER_SLOT_ID", box: "BOX_SLOT_ID" };

function injectAdSenseScript(client, cb) {
  if (!client) return cb && cb(false);
  if (window.adsbygoogle) return cb && cb(true);
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
  s.setAttribute("data-ad-client", client);
  s.onload = () => cb && cb(true);
  s.onerror = () => cb && cb(false);
  document.head.appendChild(s);
}

function renderAdSlot(containerId, slotId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = ""; // clear placeholder
  if (!ADSENSE_CLIENT || !slotId) {
    container.innerHTML = `<div class="ad-placeholder"></div>`;
    return;
  }
  const ins = document.createElement("ins");
  ins.className = "adsbygoogle";
  ins.style.display = "block";
  ins.setAttribute("data-ad-client", ADSENSE_CLIENT);
  ins.setAttribute("data-ad-slot", slotId);
  ins.setAttribute("data-ad-format", "auto");
  container.appendChild(ins);
  try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch(e) { /* ignore */ }
}

function renderSidebarAds() {
  injectAdSenseScript(ADSENSE_CLIENT, (ok) => {
    // if script loaded ok, push ad blocks; otherwise keep placeholders
    renderAdSlot("adBanner", ADSENSE_SLOTS.banner);
    renderAdSlot("adBox", ADSENSE_SLOTS.box);
  });
}

// call in init (after artists loaded)
async function init() {
  try {
    const r = await fetch(DB_PATH);
    if (!r.ok) throw new Error("failed to fetch artists.json");
    artists = await r.json();
  } catch (e) {
    resultsList.innerHTML = `<li class='small'>Error loading DB: ${e.message}</li>`;
    if (addHintBtn) addHintBtn.disabled = true;
    if (addGuessBtn) addGuessBtn.disabled = true;
    return;
  }
  renderHints();
  applyFilters();

  // ensure first guess input exists and wire Add Guess button
  if (guesses.length === 0 && typeof addNewGuess === "function") addNewGuess();
  updateAddGuessVisibility();
  if (addGuessBtn) addGuessBtn.addEventListener("click", addNewGuess);
  if (addHintBtn) addHintBtn.addEventListener("click", addNewHint);
  //renderSidebarAds();
}

// minimal multiple-guess helpers (create first Guess#1 and additional guesses)
function renderLocalSearchResults(list, resultsEl, onSelect) {
  resultsEl.innerHTML = "";
  if (!list.length) { resultsEl.hidden = true; return; }
  resultsEl.hidden = false;
  list.forEach(a => {
    const li = document.createElement("li");
    const img = document.createElement("img");
    img.src = artistIconPath(a.name);
    img.className = "search-result-img";
    img.alt = "";
    img.addEventListener("error", () => { img.style.display = "none"; });
    const span = document.createElement("span");
    span.textContent = a.name;
    li.appendChild(img);
    li.appendChild(span);
    li.addEventListener("click", () => onSelect(a));
    resultsEl.appendChild(li);
  });
}

function renderGuessCardFor(guess, wrapper) {
  const cardEl = wrapper.querySelector(".guess-card");
  const attrsGrid = wrapper.querySelector(".attrs-grid");
  const removeBtn = wrapper.querySelector(".remove-guess-btn");
  const collapseBtn = wrapper.querySelector(".collapse-guess-btn");
  const summaryEl = wrapper.querySelector(".guess-summary");
  const refreshSummary = () => updateGuessSummary(summaryEl, guess);
  if (!guess.artist) {
    if (cardEl) cardEl.hidden = true;
    if (removeBtn) removeBtn.hidden = true;
    if (collapseBtn) collapseBtn.hidden = true;
    return;
  }
  cardEl.hidden = false;
  if (removeBtn) removeBtn.hidden = false;
  if (collapseBtn) collapseBtn.hidden = false;

  // show artist thumbnail next to the search input
  const thumb = wrapper.querySelector(".guess-artist-thumb");
  if (thumb) {
    thumb.src = artistIconPath(guess.artist.name);
    thumb.hidden = false;
    thumb.onerror = () => { thumb.hidden = true; };
  }

  attrsGrid.innerHTML = "";

  // reordered attributes: DEBUT, POPULARITY, MEMBERS, GENRE, COUNTRY, GENDER
  const attrs = [
    { k: "debut", label: "Debut", v: guess.artist.debut ?? "—" },
    { k: "popularity", label: "Popularity", v: guess.artist.popularity ?? "—" },
    { k: "members", label: "Members", v: guess.artist.members || "—" },
    { k: "genre", label: "Genre", v: guess.artist.genre || "—" },
    { k: "country", label: "Country", v: guess.artist.country || "—" },
    { k: "gender", label: "Gender", v: guess.artist.gender || "—" },
  ];

  const updateArrows = (key) => {
    const box = Array.from(attrsGrid.querySelectorAll(".attr-box"))
      .find(b => b.querySelector(".attr-label")?.textContent.toLowerCase() === key);
    if (!box) return;
    const up = box.querySelector(".btn-up");
    const down = box.querySelector(".btn-down");
    const flags = guess.flags[key];
    if (up) {
      up.disabled = !flags.enabled;
      if (flags.up) up.setAttribute("data-active", "1"); else up.removeAttribute("data-active");
    }
    if (down) {
      down.disabled = !flags.enabled;
      if (flags.down) down.setAttribute("data-active", "1"); else down.removeAttribute("data-active");
    }
  };

  attrs.forEach(attr => {
    const box = document.createElement("div");
    box.className = "attr-box";

    const checkBtn = `<button class="btn-check" data-kind="check" title="match">✓</button>`;
    const xBtn = `<button class="btn-x" data-kind="x" title="no">✕</button>`;
    const oBtn = `<button class="btn-o" data-kind="o" title="partial">○</button>`;

    let arrowsHtml = "";
    if (attr.k === "debut" || attr.k === "popularity") {
      const flags = guess.flags[attr.k];
      const upActive = flags.up ? "data-active='1'" : "";
      const downActive = flags.down ? "data-active='1'" : "";
      const disabled = !flags.enabled ? "disabled" : "";
      arrowsHtml = `
        <button class="btn-arrow btn-up" data-arrow="up" ${upActive} ${disabled}>▲</button>
        <button class="btn-arrow btn-down" data-arrow="down" ${downActive} ${disabled}>▼</button>
      `;
    }

    const buttonsHtml = (attr.k === "genre" || attr.k === "members" || attr.k === "gender")
      ? `${checkBtn}${xBtn}`
      : `${checkBtn}${xBtn}${oBtn}`;

    box.innerHTML = `<div>
        <div class="attr-label">${attr.label}</div>
        <div class="attr-value">${attr.v}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="attr-buttons">${buttonsHtml}</div>
        <div class="attr-arrows">${arrowsHtml}</div>
      </div>`;

    // button handlers
    const btns = box.querySelectorAll(".attr-buttons button");
    btns.forEach(btn => {
      btn.addEventListener("click", () => {
        const kind = btn.getAttribute("data-kind");
        btns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        box.classList.remove("state-check", "state-x", "state-o");
        if (kind === "check") box.classList.add("state-check");
        else if (kind === "x") box.classList.add("state-x");
        else if (kind === "o") box.classList.add("state-o");

        // numeric attrs: distinguish "near" (o) vs "far" (x)
        if (attr.k === "debut" || attr.k === "popularity") {
          if (kind === "check") {
            guess.selections[attr.k] = "exact";
            guess.flags[attr.k].enabled = false;
            guess.flags[attr.k].up = false;
            guess.flags[attr.k].down = false;
          } else if (kind === "o") {
            // "near" = proximity / yellow: bounds within +/-5 (or 0..+5 for up)
            guess.selections[attr.k] = "near";
            guess.flags[attr.k].enabled = true;
          } else {
            // "far" = grey: outside the 5-year/50-pop window
            guess.selections[attr.k] = "far";
            guess.flags[attr.k].enabled = true;
          }
          updateArrows(attr.k);
          applyFilters();
          return;
        }

        // genre/members/gender
        if (attr.k === "genre" || attr.k === "members" || attr.k === "gender") {
          if (kind === "check") guess.selections[attr.k] = "include";
          else if (kind === "x") guess.selections[attr.k] = "exclude";
          applyFilters();
          return;
        }

        // country: check/o/x
        if (attr.k === "country") {
          if (kind === "check") guess.selections.country = "exact";
          else if (kind === "o") guess.selections.country = "continent";
          else if (kind === "x") guess.selections.country = "not_continent";
          applyFilters();
          return;
        }
      });
    });

    const upBtn = box.querySelector(".btn-up");
    const downBtn = box.querySelector(".btn-down");
    if (upBtn) {
      upBtn.addEventListener("click", () => {
        if (!guess.flags[attr.k].enabled) return;
        guess.flags[attr.k].up = !guess.flags[attr.k].up;
        if (guess.flags[attr.k].up) guess.flags[attr.k].down = false;
        updateArrows(attr.k);
        applyFilters();
      });
    }
    if (downBtn) {
      downBtn.addEventListener("click", () => {
        if (!guess.flags[attr.k].enabled) return;
        guess.flags[attr.k].down = !guess.flags[attr.k].down;
        if (guess.flags[attr.k].down) guess.flags[attr.k].up = false;
        updateArrows(attr.k);
        applyFilters();
      });
    }

    // restore previously selected visual state
    const sel = guess.selections[attr.k];
    if (sel === "include") {
      const t = box.querySelector(".btn-check");
      if (t) t.classList.add("active");
      box.classList.add("state-check");
    } else if (sel === "exclude") {
      const t = box.querySelector(".btn-x");
      if (t) t.classList.add("active");
      box.classList.add("state-x");
    } else if (sel === "exact") {
      const t = box.querySelector(".btn-check");
      if (t) t.classList.add("active");
      box.classList.add("state-check");
    } else if (guess.selections.country === "continent") {
      const t = box.querySelector(".btn-o");
      if (t) t.classList.add("active");
      box.classList.add("state-o");
    } else if (sel === "near") {
      const t = box.querySelector(".btn-o");
      if (t) t.classList.add("active");
      box.classList.add("state-o");
    } else if (sel === "far") {
      const t = box.querySelector(".btn-x");
      if (t) t.classList.add("active");
      box.classList.add("state-x");
    }

    attrsGrid.appendChild(box);
    // ensure arrows reflect flags
    if (attr.k === "debut" || attr.k === "popularity") updateArrows(attr.k);
  });

  // single delegated listener keeps summary in sync after any button/arrow click
  attrsGrid.addEventListener("click", () => { setTimeout(refreshSummary, 0); });
  refreshSummary();
}

// ensure there is an initial Guess#1 on load
if (guesses.length === 0) {
  const g = makeEmptyGuess();
  guesses.push(g);
  const el = createGuessDOM(g, 0);
  guessesContainer.appendChild(el);
  updateAddGuessVisibility();
}

// init flow: load artists, then init app (renders hints, etc.)
init();

function createGuessDOM(guess, index) {
  const wrapper = document.createElement("div");
  wrapper.className = "guess-item";
  wrapper.dataset.guessId = guess.id;
  wrapper.innerHTML = `
    <div class="guess-header">
      <h3>Guess #${index+1}</h3>
      <div class="guess-header-actions">
        <button class="collapse-guess-btn" title="Collapse" hidden>⌃</button>
        <button class="remove-guess-btn" title="Remove guess">✕</button>
      </div>
    </div>
    <div class="guess-search">
      <img class="guess-artist-thumb" hidden alt="" />
      <input class="guess-input" placeholder="Type to search artist..." autocomplete="off" />
      <ul class="search-results" hidden></ul>
    </div>
    <div class="guess-summary" hidden></div>
    <div class="guess-card" hidden>
      <div class="attrs-grid"></div>
    </div>
  `;
  // mark island if guess already has an artist
  if (guess.artist) wrapper.classList.add("island");

  const input = wrapper.querySelector(".guess-input");
  const resultsEl = wrapper.querySelector(".search-results");
  const removeBtn = wrapper.querySelector(".remove-guess-btn");
  const collapseBtn = wrapper.querySelector(".collapse-guess-btn");

  // show buttons only when an artist is selected
  removeBtn.hidden = !guess.artist;
  collapseBtn.hidden = !guess.artist;

  collapseBtn.addEventListener("click", () => {
    const isCollapsed = wrapper.classList.toggle("collapsed");
    collapseBtn.textContent = isCollapsed ? "⌄" : "⌃";
    collapseBtn.title = isCollapsed ? "Expand" : "Collapse";
  });

  // remove handler
  removeBtn.addEventListener("click", () => {
    // remove from model + DOM
    guesses = guesses.filter(g => g.id !== guess.id);
    wrapper.remove();

    // ensure there's an empty slot available when none exist
    const hasEmpty = guesses.some(g => !g.artist);
    if (!hasEmpty && guesses.length < MAX_GUESSES) {
      const empty = makeEmptyGuess();
      guesses.push(empty);
      const el = createGuessDOM(empty, guesses.length - 1);
      guessesContainer.appendChild(el);
    }

    // renumber headings
    Array.from(guessesContainer.querySelectorAll(".guess-item")).forEach((el, i) => {
      const h = el.querySelector("h3");
      if (h) h.textContent = `Guess #${i+1}`;
    });

    updateAddGuessVisibility();
    applyFilters();
  });

  // focus input for new guesses
  setTimeout(() => {
    if (input && !guess.artist) input.focus();
  }, 0);

  return wrapper;
}

function updateAddGuessVisibility() {
  if (!addGuessBtn) return;
  addGuessBtn.hidden = !(guesses.length >= 1 && guesses.length < MAX_GUESSES);
}

function addNewGuess() {
  if (guesses.length >= MAX_GUESSES) return;
  const g = makeEmptyGuess();
  g.created = true;
  guesses.push(g);
  const el = createGuessDOM(g, guesses.length - 1);
  guessesContainer.appendChild(el);
  const input = el.querySelector(".guess-input");
  if (input) input.focus();
  updateAddGuessVisibility();
}

// create a new guess pre-filled with an artist (called from match buttons)
function addGuessFromArtist(artist) {
  // try to reuse first empty guess (no artist) so we don't skip Guess #1
  const empty = guesses.find(g => !g.artist && !g.created);
  if (empty) {
    empty.artist = artist;
    empty.created = true;
    empty.selections = { genre: null, members: null, gender: null, country: null, debut: null, popularity: null };
    empty.flags = { debut: { enabled: false, up: false, down: false }, popularity: { enabled: false, up: false, down: false } };

    // update existing DOM for that guess
    const el = guessesContainer.querySelector(`[data-guess-id="${empty.id}"]`);
    if (el) {
      const input = el.querySelector(".guess-input");
      if (input) { input.value = artist.name; input.disabled = true; }
      el.classList.add("island");
      const removeBtn = el.querySelector(".remove-guess-btn");
      if (removeBtn) removeBtn.hidden = false;
      const collapseBtn3 = el.querySelector(".collapse-guess-btn");
      if (collapseBtn3) collapseBtn3.hidden = false;
      renderGuessCardFor(empty, el);

      // renumber headings
      Array.from(guessesContainer.querySelectorAll(".guess-item")).forEach((elm, i) => {
        const h = elm.querySelector("h3");
        if (h) h.textContent = `Guess #${i+1}`;
      });
      updateAddGuessVisibility();
      applyFilters();
    }
    return;
  }

  // no empty guess found -> create new (as before)
  if (guesses.length >= MAX_GUESSES) return;
  const g = makeEmptyGuess();
  g.artist = artist;
  g.selections = { genre: null, members: null, gender: null, country: null, debut: null, popularity: null };
  g.flags = { debut: { enabled: false, up: false, down: false }, popularity: { enabled: false, up: false, down: false } };
  guesses.push(g);
  const el = createGuessDOM(g, guesses.length - 1);
  el.classList.add("island");
  guessesContainer.appendChild(el);

  const input = el.querySelector(".guess-input");
  if (input) { input.value = artist.name; input.disabled = true; }
  const resultsEl = el.querySelector(".search-results");
  if (resultsEl) resultsEl.hidden = true;
  const removeBtn = el.querySelector(".remove-guess-btn");
  if (removeBtn) removeBtn.hidden = false;
  const collapseBtn4 = el.querySelector(".collapse-guess-btn");
  if (collapseBtn4) collapseBtn4.hidden = false;

  renderGuessCardFor(g, el);
  Array.from(guessesContainer.querySelectorAll(".guess-item")).forEach((elm, i) => {
    const h = elm.querySelector("h3");
    if (h) h.textContent = `Guess #${i+1}`;
  });
  updateAddGuessVisibility();
  applyFilters();
}