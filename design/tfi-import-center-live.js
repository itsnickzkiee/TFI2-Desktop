(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const moduleKeys = {
    "product-entry": "product_entry",
    "production-entry": "production_entry",
    "production-schedule": "production_schedule",
    "dmp-production": "dmp_production",
    "dmr-production": "dmr_production",
    "dmr-coding": "dmr_coding",
    "hourly-meat": "hourly_meat",
    "hourly-coding": "hourly_coding",
    "hourly-agri": "hourly_agri",
    "oee": "oee",
    "productivity": "productivity",
    "coding-dpr": "coding_dpr",
    "co-qa": "co_qa",
    "non-prod": "nonprod",
    "pr-monitoring": "pr_monitoring"
  };

  function notify(message) {
    if (typeof toast === "function") toast(message);
    else window.alert(message);
  }

  async function loadApprovedDestinations() {
    const select = $("target-module");
    if (!select) return;
    try {
      const response = await fetch("/api/import/destinations", {
        credentials: "same-origin",
        headers: { "Accept": "application/json" }
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load approved import destinations.");
      const allowed = new Map((payload.destinations || []).map(item => [item.module_key, item]));
      Array.from(select.options).forEach(option => {
        if (!option.value) return;
        const key = moduleKeys[option.value];
        const destination = key ? allowed.get(key) : null;
        if (!destination) {
          option.remove();
          return;
        }
        if (moduleMap[option.value]) {
          moduleMap[option.value].sheet = destination.source_sheet_title;
          moduleMap[option.value].sheetId = String(destination.source_sheet_id);
        }
        option.dataset.moduleKey = destination.module_key;
        if (destination.contract_status === "hold_pending_business_rule") {
          option.disabled = true;
          option.textContent = option.textContent.replace(/\s*[—-]\s*Mapping review required$/, "") + " — Mapping review required";
        }
      });
      if (select.value && (!moduleMap[select.value] || select.selectedOptions[0]?.disabled)) select.value = "";
      if (!select.value) {
        const firstEnabled = Array.from(select.options).findIndex((option, index) => index > 0 && !option.disabled);
        if (firstEnabled > 0) select.selectedIndex = firstEnabled;
      }
      if (typeof updateTarget === "function") updateTarget();
      if (!allowed.size) {
        select.disabled = true;
        notify("Your TFI role has no approved operational import destinations.");
      }
    } catch (error) {
      select.disabled = true;
      notify(error.message || "The import destination service is unavailable.");
    }
  }

  async function loadGoogleStatus() {
    const status = $("google-status");
    const account = $("google-account");
    const connect = $("google-connect-button");
    const disconnect = $("google-disconnect-button");
    try {
      const response = await fetch("/api/google-sheets/status", {
        credentials: "same-origin",
        headers: { "Accept": "application/json" }
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to check the Google connection.");
      window.googleSheetsConfigured = Boolean(payload.configured);
      window.googleSheetsConnected = Boolean(payload.connected);
      if (!payload.configured) {
        status.textContent = "Google connection setup required";
        account.textContent = "Add the Google OAuth client ID and secret to the local TFI .env file.";
        connect.disabled = true;
        connect.title = "Google OAuth credentials have not been configured on this computer.";
        disconnect.style.display = "none";
      } else if (payload.connected) {
        status.textContent = "Google Account connected";
        account.textContent = payload.email || "Authorized read-only connection";
        connect.disabled = false;
        connect.textContent = "Reconnect";
        connect.title = "Reconnect or authorize a different Google Account.";
        disconnect.style.display = "inline-flex";
      } else {
        status.textContent = "Google Account not connected";
        account.textContent = "Connect an account that can open the source spreadsheet.";
        connect.disabled = false;
        connect.textContent = "Connect Google Account";
        connect.title = "Authorize TFI to read the selected Google Sheets workbook.";
        disconnect.style.display = "none";
      }
      if (typeof updateContinueState === "function") updateContinueState();
    } catch (error) {
      window.googleSheetsConfigured = false;
      window.googleSheetsConnected = false;
      status.textContent = "Google connection unavailable";
      account.textContent = error.message || "Sign in to TFI again and retry.";
      connect.disabled = true;
      disconnect.style.display = "none";
      if (typeof updateContinueState === "function") updateContinueState();
    }
  }

  async function disconnectGoogle() {
    const button = $("google-disconnect-button");
    button.disabled = true;
    try {
      const response = await fetch("/api/google-sheets/disconnect", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: "{}"
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The Google connection could not be disconnected.");
      notify("Google Account disconnected from TFI.");
      await loadGoogleStatus();
    } catch (error) {
      notify(error.message || "The Google connection could not be disconnected.");
    } finally {
      button.disabled = false;
    }
  }

  function showOAuthReturnMessage() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("googleConnected") === "1") {
      notify("Google Account connected. Paste the source spreadsheet link to continue.");
    } else if (params.has("googleError")) {
      const reason = params.get("googleError");
      notify(reason === "access_denied"
        ? "Google authorization was cancelled. Connect the account to continue."
        : "Google authorization could not be completed. Check the connection settings and try again.");
    }
  }

  async function beginGoogleSheetImport(button, moduleSelect, moduleKey, target) {
    const url = $("sheet-url").value.trim();
    if (!window.googleSheetsConfigured) {
      notify("Google OAuth setup is required on this TFI computer before connecting an account.");
      return;
    }
    if (!window.googleSheetsConnected) {
      notify("Connect your Google Account before importing a spreadsheet.");
      return;
    }
    if (!/^https:\/\/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/[A-Za-z0-9_-]+/i.test(url)) {
      notify("Paste a valid Google Sheets URL.");
      $("sheet-url").focus();
      return;
    }

    const originalLabel = button.innerHTML;
    button.disabled = true;
    button.innerHTML = "Checking Google Sheet…";
    try {
      const response = await fetch("/api/import/batches", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          module_key: moduleKey,
          source_type: "google_sheets",
          spreadsheet_url: url
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The Google spreadsheet could not be submitted for scanning.");
      const batch = payload.batch;
      const source = payload.source || {};
      const query = new URLSearchParams({
        from: "import-center",
        batchId: batch.id,
        targetModule: moduleSelect.value,
        moduleKey,
        targetLabel: target.label,
        sourceWorksheet: batch.source_sheet_title,
        sourceSheetId: String(batch.source_sheet_id),
        sourceName: source.name || "Google Sheets workbook",
        sourceType: "google_sheets",
        sourceSize: ""
      });
      window.location.href = "scan-progress-worksheet-detection-preview.html?" + query.toString();
    } catch (error) {
      button.disabled = false;
      button.innerHTML = originalLabel;
      notify(error.message || "The Google Sheets import service could not be reached.");
    }
  }

  async function beginXlsxImport(button, moduleKey, file, moduleSelect, target) {
    if (!file) {
      notify("Select the source .xlsx workbook first.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      notify("Only .xlsx workbooks are accepted.");
      return;
    }
    if (file.size < 1 || file.size > 100 * 1024 * 1024) {
      notify("The workbook must be larger than 0 bytes and no larger than 100 MB.");
      return;
    }

    const form = new FormData();
    form.append("module_key", moduleKey);
    form.append("file", file, file.name);
    const originalLabel = button.innerHTML;
    button.disabled = true;
    button.innerHTML = "Uploading workbook…";
    try {
      const response = await fetch("/api/import/batches", {
        method: "POST",
        credentials: "same-origin",
        body: form,
        headers: { "Accept": "application/json" }
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The workbook could not be submitted for scanning.");
      const batch = payload.batch;
      const query = new URLSearchParams({
        from: "import-center",
        batchId: batch.id,
        targetModule: moduleSelect.value,
        moduleKey,
        targetLabel: target.label,
        sourceWorksheet: batch.source_sheet_title,
        sourceSheetId: String(batch.source_sheet_id),
        sourceName: file.name,
        sourceType: "xlsx",
        sourceSize: String(file.size)
      });
      window.location.href = "scan-progress-worksheet-detection-preview.html?" + query.toString();
    } catch (error) {
      button.disabled = false;
      button.innerHTML = originalLabel;
      notify(error.message || "The import service could not be reached.");
    }
  }

  async function beginUpload(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const button = $("continue-button");
    const moduleSelect = $("target-module");
    const fileInput = $("file-input");
    const option = moduleSelect && moduleSelect.selectedOptions[0];
    const moduleKey = option && option.dataset.moduleKey;
    const target = moduleMap[moduleSelect && moduleSelect.value];
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!moduleKey || !target || !option || option.disabled) {
      notify("Choose one approved destination module before continuing.");
      return;
    }
    if (typeof mode !== "undefined" && mode === "file") {
      await beginXlsxImport(button, moduleKey, file, moduleSelect, target);
      return;
    }
    await beginGoogleSheetImport(button, moduleSelect, moduleKey, target);
  }

  const continueButton = $("continue-button");
  if (continueButton) continueButton.addEventListener("click", beginUpload, true);
  const connectButton = $("google-connect-button");
  if (connectButton) connectButton.addEventListener("click", () => {
    if (!window.googleSheetsConfigured) {
      notify("Google OAuth setup is required. Add the OAuth client ID and secret to the local TFI .env file first.");
      return;
    }
    window.location.href = "/api/google-sheets/connect";
  });
  const disconnectButton = $("google-disconnect-button");
  if (disconnectButton) disconnectButton.addEventListener("click", disconnectGoogle);

  showOAuthReturnMessage();
  loadGoogleStatus();
  loadApprovedDestinations();
})();
