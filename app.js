let log = JSON.parse(localStorage.getItem("gta6_groq_rap_sheet") || "[]");

const apiKeyInput = document.getElementById("apiKey");
const jurisdictionSelect = document.getElementById("jurisdiction");
const actionInput = document.getElementById("actionInput");
const logBtn = document.getElementById("logBtn");
const copyBtn = document.getElementById("copyBtn");
const resetBtn = document.getElementById("resetBtn");
const saveKeyBtn = document.getElementById("saveKeyBtn");
const errBox = document.getElementById("errBox");
const logList = document.getElementById("logList");

apiKeyInput.value = localStorage.getItem("groq_api_key") || "";
const savedJur = localStorage.getItem("gta6_jurisdiction");
if (savedJur) jurisdictionSelect.value = savedJur;

saveKeyBtn.addEventListener("click", function () {
  localStorage.setItem("groq_api_key", apiKeyInput.value.trim());
  alert("Groq API key saved locally in this browser.");
});

jurisdictionSelect.addEventListener("change", function () {
  localStorage.setItem("gta6_jurisdiction", jurisdictionSelect.value);
});

function buildSystemPrompt(jurisdiction) {
  return [
    "You are a prosecutor grading actions committed by Jordan in GTA 6 under " + jurisdiction + ".",
    "Convert the user's description into realistic criminal charges from " + jurisdiction + ".",
    "Return ONLY valid JSON matching this exact schema:",
    '{"charges":[{"charge":"Official Charge Name","statute":"Exact Code Citation","fine":10000,"years":20,"capital":false}]}',
    "Rules:",
    "- Break multi-part actions into individual criminal counts.",
    "- fine must be a number in USD (0 if no fine).",
    "- years must be a number representing max prison/jail years (0 if no jail time; 99 for life).",
    "- capital must be true ONLY for capital felony offenses eligible for maximum capital punishment under " + jurisdiction + "."
  ].join("\n");
}

async function logAction() {
  const key = apiKeyInput.value.trim();
  const text = actionInput.value.trim();
  const jurisdiction = jurisdictionSelect.value;

  errBox.textContent = "";
  if (!key) {
    errBox.textContent = "Please paste your Groq API key first.";
    return;
  }
  if (!text) return;

  logBtn.disabled = true;
  logBtn.textContent = "Charging...";

  try {
    const res = await fetch("https://api.groq.com/openai/v1", {
      method: "POST",
      mode: "cors",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          { role: "system", content: buildSystemPrompt(jurisdiction) },
          { role: "user", content: text }
        ]
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error((data.error && data.error.message) || ("HTTP " + res.status));
    }

    const firstChoice = data.choices && data.choices.shift();
    const content = firstChoice && firstChoice.message && firstChoice.message.content;
    if (!content) {
      throw new Error("Empty response from Groq.");
    }

    const parsed = JSON.parse(content);
    const tag = jurisdiction.startsWith("Texas") ? "TEXAS" : "LEONIDA";
    (parsed.charges || []).forEach(function (c) {
      log.unshift(Object.assign({ raw: text, tag: tag }, c));
    });
    actionInput.value = "";
    saveAndRender();
  } catch (err) {
    errBox.textContent = "Error: " + err.message;
  } finally {
    logBtn.disabled = false;
    logBtn.textContent = "Log Crime";
  }
}

logBtn.addEventListener("click", logAction);

actionInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") logAction();
});

copyBtn.addEventListener("click", function () {
  if (!log.length) {
    alert("Log at least one crime first!");
    return;
  }
  const fines = log.reduce(function (sum, c) { return sum + (Number(c.fine) || 0); }, 0);
  const years = log.reduce(function (sum, c) { return sum + (Number(c.years) || 0); }, 0);
  const hasCapital = log.some(function (c) { return c.capital === true; });
  const latest = log.at(0);

  const summary = "🚨 JORDAN'S RAP SHEET (" + log.length + " charges) | Latest: " + latest.charge + " (" + latest.statute + ") | Total Fines: $" + fines.toLocaleString() + " | Prison: " + years.toFixed(1) + " yrs" + (hasCapital ? " | ⚖️ CAPITAL FELONY" : "");

  navigator.clipboard.writeText(summary).then(function () {
    const old = copyBtn.textContent;
    copyBtn.textContent = "Copied!";
    setTimeout(function () { copyBtn.textContent = old; }, 1500);
  });
});

resetBtn.addEventListener("click", function () {
  if (confirm("Clear Jordan's entire rap sheet?")) {
    log = [];
    saveAndRender();
  }
});

logList.addEventListener("click", function (e) {
  if (e.target.classList.contains("del")) {
    const idx = Number(e.target.getAttribute("data-idx"));
    log.splice(idx, 1);
    saveAndRender();
  }
});

function saveAndRender() {
  localStorage.setItem("gta6_groq_rap_sheet", JSON.stringify(log));
  const fines = log.reduce(function (sum, c) { return sum + (Number(c.fine) || 0); }, 0);
  const years = log.reduce(function (sum, c) { return sum + (Number(c.years) || 0); }, 0);
  const hasCapital = log.some(function (c) { return c.capital === true; });

  document.getElementById("totalFines").textContent = "$" + fines.toLocaleString();
  document.getElementById("totalJail").textContent = years.toFixed(1) + " yrs";
  document.getElementById("sentenceStatus").textContent = hasCapital ? "CAPITAL SENTENCE" : (years > 0 ? "Prison" : "Free");

  logList.innerHTML = log.map(function (item, idx) {
    const capBadge = item.capital ? '<div><span class="badge capital">CAPITAL FELONY</span></div>' : '';
    const jailText = item.years > 0 ? (item.years + " yrs jail") : "No jail";
    return [
      '<div class="charge-item">',
      '  <div>',
      '    <strong>' + item.charge + '</strong>',
      '    <div style="font-size:0.85rem; color:#94a3b8;">"' + item.raw + '"</div>',
      '    <span class="badge">' + (item.tag || "TEXAS") + '</span>',
      '    <span class="badge">' + (item.statute || "PENAL CODE") + '</span>',
      '  </div>',
      '  <div style="text-align:right; white-space:nowrap;">',
      '    <div><strong>$' + Number(item.fine).toLocaleString() + '</strong></div>',
      '    <div style="font-size:0.85rem; color:#cbd5e1;">' + jailText + '</div>',
      '    ' + capBadge,
      '    <button type="button" class="del" data-idx="' + idx + '">Remove</button>',
      '  </div>',
      '</div>'
    ].join("\n");
  }).join("");
}

saveAndRender();
