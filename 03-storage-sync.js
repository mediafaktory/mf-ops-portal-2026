// =========================================================================
    // 4. PERSISTENT DATABASE, INITIALIZATION & REAL-TIME MULTI-PC MERGE ENGINE
    // =========================================================================
    const DB_KEYS = {
      QUOTES: "mf_ops_saved_quotes_v4",
      PREBUILTS: "mf_ops_prebuilt_sets_v4",
      MASTER: "mf_ops_master_prices_v4",
      ENQUIRIES: "mf_ops_enquiries_v4",
      SERVICE: "mf_ops_service_tickets_v1",
      BUILDS: "mf_ops_build_orders_v1",
      REPORTS: "mf_ops_staff_reports_v1",
      USERS: "mf_ops_custom_users_v1",
      DELETED: "mf_ops_deleted_ids_v4",
      CLOUD_URL: "mf_ops_cloud_sync_url_v4",
      SHEET_URL: "mf_ops_sheet_sync_url_v4",
      SHEET_SECRET: "mf_ops_sheet_sync_secret_v4",
      OWNER_PREF: "mf_ops_preferred_owner_v4",
      WEEKLY_PB_AUDIT: "mf_ops_weekly_pb_audit_v1"
    };

    const DEFAULT_CLOUD_SYNC_URL = "https://pc-quote-bb378-default-rtdb.firebaseio.com/mf_ops.json";
    const PREVIOUS_SHEET_SYNC_URL = "https://script.google.com/macros/s/AKfycbwLm-iGOVblr8qY83rl4nk2xsqWN5mO5m3ED3Vh_PwfjyU5ET9VtqUnTdGirsdcFzyG/exec";
    const DEFAULT_SHEET_SYNC_URL = "https://script.google.com/macros/s/AKfycbx3XswfD9OK2DoOkrFE1XTB0yqYFiYZUj8P4gr9FCXiOZp0A5i4-7tXGULukSlLZTLp/exec";
    const DEFAULT_SHEET_SECRET = "MF_SECRET_2026";

    let state = {
      activeTab: "enquiries",
      reportFreq: "daily",
      globalMargin: 26,
      components: [],
      highlights: [],
      enquiries: [],
      serviceTickets: [],
      buildOrders: [],
      staffReports: [],
      customUsers: {},
      savedQuotes: [],
      prebuiltSets: [],
      masterItems: [],
      selectedMasterIds: [],
      deletedIds: [],
      cloudSyncUrl: DEFAULT_CLOUD_SYNC_URL,
      sheetSyncUrl: DEFAULT_SHEET_SYNC_URL,
      sheetSyncSecret: DEFAULT_SHEET_SECRET,
      activeEnquiryId: null,
      editingQuoteBaseCode: null,
      cloudPollTimer: null,
      weeklyMondayCleanTimer: null,
      cloudPushTimer: null,
      lastCloudUpdatedAt: 0,
      isSyncing: false,
      visibleLimits: {
        enquiries: 40,
        quotations: 30,
        master: 60,
        service: 40,
        builds: 30
      }
    };

    function getMostRecentMonday11AmMs() {
      const now = new Date();
      const daysSinceMonday = (now.getDay() + 6) % 7;
      const candidate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - daysSinceMonday,
        11, 0, 0, 0
      );
      if (now.getTime() < candidate.getTime()) {
        candidate.setDate(candidate.getDate() - 7);
      }
      return candidate.getTime();
    }

    function formatMondayCycleLabel(cycleMs) {
      const d = new Date(cycleMs);
      return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric"
      }) + " at 11:00 AM";
    }

    function runWeeklyAutoPrebuiltAnalysis(forceCheck = false) {
      const latestMonday11AmMs = getMostRecentMonday11AmMs();
      const cycleKey = String(latestMonday11AmMs);
      const lastCleanedCycle = localStorage.getItem(DB_KEYS.WEEKLY_PB_AUDIT) || "";

      const isDue = forceCheck || (lastCleanedCycle !== cycleKey);
      if (!isDue) return;

      const { duplicateGroups, staleIds } = analyzePrebuiltSetsHealth();
      const toRemove = new Set();
      let dupRemovedCount = 0;

      duplicateGroups.forEach(grp => {
        grp.slice(1).forEach(dup => {
          toRemove.add(dup.id);
          dupRemovedCount++;
        });
      });
      staleIds.forEach(id => toRemove.add(id));

      localStorage.setItem(DB_KEYS.WEEKLY_PB_AUDIT, cycleKey);

      const banner = document.getElementById("prebuiltWeeklyAutoBanner");
      const titleEl = document.getElementById("prebuiltWeeklyAutoTitle");
      const descEl = document.getElementById("prebuiltWeeklyAutoDesc");
      const cycleLabel = formatMondayCycleLabel(latestMonday11AmMs);

      if (toRemove.size > 0) {
        toRemove.forEach(id => recordDeletedId(id));
        state.prebuiltSets = state.prebuiltSets.filter(s => !toRemove.has(s.id));
        persistDatabaseToStorage();
        refreshAllViews();
        syncMasterAndPrebuiltsToGoogleSheet(true);

        if (titleEl && descEl && banner) {
          titleEl.textContent = `Monday 11:00 AM Auto-Cleanup Completed (${cycleLabel})`;
          descEl.textContent = `Automatically removed ${dupRemovedCount} duplicate build(s) and ${staleIds.size} unused build(s) older than 3 months.`;
          banner.classList.remove("hidden");
        }

        setTimeout(() => {
          showToast(`🧹 Monday 11 AM Auto-Clean: Removed ${dupRemovedCount} duplicate & ${staleIds.size} unused (>3M) Pre-Built PC(s)!`, "emerald");
        }, 900);
      } else if (forceCheck) {
        if (titleEl && descEl && banner) {
          titleEl.textContent = `Monday 11:00 AM Auto-Cleanup Checked (${cycleLabel})`;
          descEl.textContent = `Zero duplicate builds or unused builds older than 3 months found. Catalog is clean!`;
          banner.classList.remove("hidden");
        }
        showToast("✅ Monday 11 AM Auto-Clean: Pre-Built catalog is already 100% clean!", "emerald");
      }
    }

    function startWeeklyMonday11AmScheduler() {
      if (state.weeklyMondayCleanTimer) clearInterval(state.weeklyMondayCleanTimer);
      runWeeklyAutoPrebuiltAnalysis(false);
      state.weeklyMondayCleanTimer = setInterval(() => {
        runWeeklyAutoPrebuiltAnalysis(false);
      }, 60000);
    }

    function dismissWeeklyPrebuiltBanner() {
      const banner = document.getElementById("prebuiltWeeklyAutoBanner");
      if (banner) banner.classList.add("hidden");
    }

    function debounce(fn, delay = 140) {
      let timer = null;
      return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    }

    const debouncedEnquirySearch = debounce(() => { state.visibleLimits.enquiries = 40; renderEnquiriesList(); }, 140);
    const debouncedQuotationsSearch = debounce(() => { state.visibleLimits.quotations = 30; renderQuotationsWorkspace(); }, 140);
    const debouncedPrebuiltSearch = debounce(() => renderPrebuiltSets(), 140);
    const debouncedMasterSearch = debounce(() => { state.visibleLimits.master = 60; renderMasterSheet(); }, 140);
    const debouncedServiceSearch = debounce(() => { state.visibleLimits.service = 40; renderServiceTickets(); }, 140);
    const debouncedBuildsSearch = debounce(() => { state.visibleLimits.builds = 30; renderBuildOrders(); }, 140);
    const debouncedRowAutocomplete = debounce((rowId, val) => openRowMasterAutocomplete(rowId, val), 130);
    const debouncedRenderPreview = debounce(() => renderPreview(), 90);

    function showMoreListItems(tabKey, increment = 40) {
      state.visibleLimits[tabKey] = (state.visibleLimits[tabKey] || 40) + increment;
      if (tabKey === "enquiries") renderEnquiriesList();
      else if (tabKey === "quotations") renderQuotationsWorkspace();
      else if (tabKey === "master") renderMasterSheet();
      else if (tabKey === "service") renderServiceTickets();
      else if (tabKey === "builds") renderBuildOrders();
    }

    function uid() {
      return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 8);
    }

    function escapeHtml(str) {
      return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function formatINR(num) {
      const val = Number(num) || 0;
      return val.toLocaleString("en-IN", {
        maximumFractionDigits: Number.isInteger(val) ? 0 : 2
      });
    }

    function formatReadableDate(isoDateStr) {
      if (!isoDateStr) return "";
      const parts = String(isoDateStr).split("-");
      if (parts.length !== 3) return isoDateStr;
      const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return dateObj.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      });
    }

    function whatsappMarkdownToHtml(text) {
      const escaped = escapeHtml(text);
      return escaped.replace(/\*([^\*\n]+)\*/g, '<strong class="font-bold text-white">$1</strong>');
    }

    function isCategoryExternal(category, name = "") {
      if (EXTERNAL_CATEGORIES.has(category)) return true;
      const u = String(name || "").toUpperCase();
      return /\b(MONITOR|KEYBOARD|MOUSE|UPS|PRINTER|SPEAKER)\b/.test(u) && category === "Other";
    }

    function calculateUnitFinalPrice(row) {
      const base = parseFloat(row.basePrice) || 0;
      if (row.isNetPrice || state.globalMargin === 0) {
        return Math.round(base);
      }
      return Math.round(base * (1 + state.globalMargin / 100));
    }

    function calculateFinalPrice(row) {
      const qty = Math.max(1, parseInt(row.qty) || 1);
      return calculateUnitFinalPrice(row) * qty;
    }

    function getISOWeekMeta(isoDateStr) {
      const parts = String(isoDateStr || getTodayIsoLocal()).split("-");
      const d = parts.length === 3
        ? new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])))
        : new Date();
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      const wk = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
      return { weekKey: wk, weekLabel: `Week ${weekNo}, ${d.getUTCFullYear()}` };
    }

    function extractBaseQuoteCode(refCode) {
      return String(refCode || "").trim().replace(/-REV\d+$/i, "");
    }

    function extractRevisionNumber(refCode) {
      const m = String(refCode || "").trim().match(/-REV(\d+)$/i);
      return m ? (parseInt(m[1], 10) || 0) : 0;
    }

    function getNextRevisionCodeForBase(baseCode) {
      const cleanBase = extractBaseQuoteCode(baseCode);
      let maxRev = 0;
      (state.savedQuotes || []).forEach(q => {
        if (extractBaseQuoteCode(q.refCode) === cleanBase) {
          const rev = extractRevisionNumber(q.refCode);
          if (rev > maxRev) maxRev = rev;
        }
      });
      return `${cleanBase}-REV${maxRev + 1}`;
    }

    function generateNextRefCode(isoDateStr) {
      const year = String(isoDateStr || getTodayIsoLocal()).slice(0, 4) || String(new Date().getFullYear());
      const prefix = `MF-${year}-`;
      let maxSeq = 100;
      (state.savedQuotes || []).forEach(q => {
        const base = extractBaseQuoteCode(q.refCode);
        if (base.startsWith(prefix)) {
          const num = parseInt(base.slice(prefix.length), 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      });
      return `${prefix}${maxSeq + 1}`;
    }

    function generateNextPrebuiltBuildNumber() {
      let maxNum = 0;
      (state.prebuiltSets || []).forEach(s => {
        const n = parseInt(s.buildNumber, 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      });
      return maxNum + 1;
    }

    function generateNextServiceTicketCode() {
      const year = String(new Date().getFullYear());
      const prefix = `MF-SRV-${year}-`;
      let maxSeq = 100;
      (state.serviceTickets || []).forEach(t => {
        const code = String(t.ticketCode || "");
        if (code.startsWith(prefix)) {
          const num = parseInt(code.slice(prefix.length), 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      });
      return `${prefix}${maxSeq + 1}`;
    }

    function updateQuoteModeBadge() {
      const tag = document.getElementById("quoteModeTag");
      if (!tag) return;
      if (state.editingQuoteBaseCode) {
        tag.textContent = `(Revision Mode: ${state.editingQuoteBaseCode})`;
        tag.className = "text-amber-300 text-[10px] font-bold";
      } else {
        tag.textContent = "(Auto +1 / REV)";
        tag.className = "text-emerald-400 text-[10px]";
      }
    }

    function startFreshBaseQuoteNumber() {
      const todayIso = document.getElementById("quoteDateInput").value || getTodayIsoLocal();
      state.editingQuoteBaseCode = null;
      document.getElementById("refCodeInput").value = generateNextRefCode(todayIso);
      updateQuoteModeBadge();
      renderPreview();
      showToast(`Assigned new quote # ${document.getElementById("refCodeInput").value}`, "emerald");
    }

    function onQuoteDateChange() {
      const newDate = document.getElementById("quoteDateInput").value;
      if (!state.editingQuoteBaseCode && newDate) {
        document.getElementById("refCodeInput").value = generateNextRefCode(newDate);
      }
      renderPreview();
    }

    function switchWorkspaceTab(tabName) {
      if (tabName === "admin" && !isAdminUser()) {
        showToast("Admin Dashboard is restricted to Ashwin only.", "amber");
        tabName = "enquiries";
      }
      state.activeTab = tabName;
      document.querySelectorAll(".workspace-panel").forEach(panel => {
        panel.classList.add("hidden");
        panel.classList.remove("flex", "grid");
      });

      const activePanel = document.getElementById(`workspace_${tabName}`);
      if (activePanel) {
        activePanel.classList.remove("hidden");
        if (tabName === "generator") {
          activePanel.classList.add("grid");
        } else {
          activePanel.classList.add("flex");
        }
      }

      document.querySelectorAll(".workspace-tab-btn").forEach(btn => {
        btn.className = "workspace-tab-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer text-slate-300 hover:text-white shrink-0";
      });
      const activeBtn = document.getElementById(`tabBtn_${tabName}`);
      if (activeBtn) {
        activeBtn.className = "workspace-tab-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer bg-emerald-600 text-white shadow shrink-0";
        activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }

      if (tabName === "admin") renderAdminDashboard();
      if (tabName === "enquiries") renderEnquiriesList();
      if (tabName === "quotations") renderQuotationsWorkspace();
      if (tabName === "prebuilts") renderPrebuiltSets();
      if (tabName === "master") renderMasterSheet();
      if (tabName === "service") renderServiceTickets();
      if (tabName === "builds") renderBuildOrders();
      if (tabName === "reports") {
        applyReportModuleVisibility();
        renderStaffReportsList();
      }
    }

    function populateCategorySelects() {
      const catOpts = CATEGORIES.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
      const masterCatFilter = document.getElementById("masterCategoryFilter");
      if (masterCatFilter) masterCatFilter.innerHTML = `<option value="ALL">All Categories</option>` + catOpts;
      const pickerCatFilter = document.getElementById("pickerCatFilter");
      if (pickerCatFilter) pickerCatFilter.innerHTML = `<option value="ALL">All Categories</option>` + catOpts;
      const singleMasterCat = document.getElementById("singleMasterCat");
      if (singleMasterCat) singleMasterCat.innerHTML = catOpts;
      const singleMasterWarranty = document.getElementById("singleMasterWarranty");
      if (singleMasterWarranty) {
        singleMasterWarranty.innerHTML = WARRANTIES.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join("");
      }
    }

    function recordDeletedId(id) {
      if (!id) return;
      const set = new Set((state.deletedIds || []).map(String));
      set.add(String(id));
      state.deletedIds = Array.from(set).slice(-500);
      localStorage.setItem(DB_KEYS.DELETED, JSON.stringify(state.deletedIds));
    }

    function loadDatabaseFromStorage() {
      try {
        state.savedQuotes = JSON.parse(localStorage.getItem(DB_KEYS.QUOTES) || "[]");
        state.prebuiltSets = JSON.parse(localStorage.getItem(DB_KEYS.PREBUILTS) || "[]");
        state.masterItems = JSON.parse(localStorage.getItem(DB_KEYS.MASTER) || "[]");
        state.enquiries = JSON.parse(localStorage.getItem(DB_KEYS.ENQUIRIES) || "[]");
        state.serviceTickets = JSON.parse(localStorage.getItem(DB_KEYS.SERVICE) || "[]");
        state.buildOrders = JSON.parse(localStorage.getItem(DB_KEYS.BUILDS) || "[]");
        state.staffReports = JSON.parse(localStorage.getItem(DB_KEYS.REPORTS) || "[]");
        state.customUsers = JSON.parse(localStorage.getItem(DB_KEYS.USERS) || "{}");
        state.deletedIds = JSON.parse(localStorage.getItem(DB_KEYS.DELETED) || "[]");

        state.masterItems.forEach(m => {
          if (m && !m.normKey) m.normKey = buildTokenFingerprint(m.name);
        });

        const savedCloudUrl = localStorage.getItem(DB_KEYS.CLOUD_URL);
        if (savedCloudUrl !== null) state.cloudSyncUrl = savedCloudUrl;

        const savedSheetUrl = localStorage.getItem(DB_KEYS.SHEET_URL);
        if (savedSheetUrl && savedSheetUrl !== PREVIOUS_SHEET_SYNC_URL) {
          state.sheetSyncUrl = savedSheetUrl;
        }
        const savedSheetSecret = localStorage.getItem(DB_KEYS.SHEET_SECRET);
        if (savedSheetSecret) state.sheetSyncSecret = savedSheetSecret;
      } catch {
        // Fallback to defaults
      }

      const cloudInp = document.getElementById("cloudSyncUrlInput");
      if (cloudInp) cloudInp.value = state.cloudSyncUrl || "";
      const sheetInp = document.getElementById("sheetSyncUrlInput");
      if (sheetInp) sheetInp.value = state.sheetSyncUrl || "";
      const secretInp = document.getElementById("sheetSyncSecretInput");
      if (secretInp) secretInp.value = state.sheetSyncSecret || DEFAULT_SHEET_SECRET;
    }

    function saveLocalOnly() {
      localStorage.setItem(DB_KEYS.QUOTES, JSON.stringify(state.savedQuotes));
      localStorage.setItem(DB_KEYS.PREBUILTS, JSON.stringify(state.prebuiltSets));
      localStorage.setItem(DB_KEYS.MASTER, JSON.stringify(state.masterItems));
      localStorage.setItem(DB_KEYS.ENQUIRIES, JSON.stringify(state.enquiries));
      localStorage.setItem(DB_KEYS.SERVICE, JSON.stringify(state.serviceTickets));
      localStorage.setItem(DB_KEYS.BUILDS, JSON.stringify(state.buildOrders));
      localStorage.setItem(DB_KEYS.REPORTS, JSON.stringify(state.staffReports));
      localStorage.setItem(DB_KEYS.USERS, JSON.stringify(state.customUsers));
      localStorage.setItem(DB_KEYS.DELETED, JSON.stringify(state.deletedIds));
    }

    function persistDatabaseToStorage() {
      saveLocalOnly();
      if (state.cloudSyncUrl) {
        clearTimeout(state.cloudPushTimer);
        state.cloudPushTimer = setTimeout(() => {
          pushMergedToCloud();
        }, 1200);
      }
    }

    function mergeByIdAndTimestamp(localArr, remoteArr, delSet) {
      const map = new Map();
      (localArr || []).forEach(item => {
        if (item && item.id && !delSet.has(String(item.id))) {
          map.set(String(item.id), item);
        }
      });
      (remoteArr || []).forEach(item => {
        if (!item || !item.id || delSet.has(String(item.id))) return;
        const existing = map.get(String(item.id));
        if (!existing || Number(item.updatedAt || 0) > Number(existing.updatedAt || 0)) {
          map.set(String(item.id), item);
        }
      });
      return Array.from(map.values()).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    }

    function mergeMasterCollections(localArr, remoteArr, delSet) {
      const map = new Map();
      const all = [...(localArr || []), ...(remoteArr || [])];
      all.forEach(item => {
        if (!item || !item.id || delSet.has(String(item.id))) return;
        const fp = item.normKey || buildTokenFingerprint(item.name);
        if (fp && delSet.has(String(fp))) return;
        const compositeKey = `${item.category || "Other"}::${fp}`;
        const existing = map.get(compositeKey);
        if (!existing || Number(item.updatedAt || 0) >= Number(existing.updatedAt || 0)) {
          map.set(compositeKey, { ...item, normKey: fp });
        }
      });
      return Array.from(map.values());
    }

    function applyRemoteSnapshot(remoteData) {
      if (!remoteData || typeof remoteData !== "object") return false;
      const delSet = new Set([
        ...(state.deletedIds || []).map(String),
        ...((remoteData.deletedIds || []).map(String))
      ]);
      state.deletedIds = Array.from(delSet).slice(-500);

      let changed = false;
      if (Array.isArray(remoteData.enquiries)) {
        state.enquiries = mergeByIdAndTimestamp(state.enquiries, remoteData.enquiries, delSet);
        changed = true;
      }
      if (Array.isArray(remoteData.serviceTickets)) {
        state.serviceTickets = mergeByIdAndTimestamp(state.serviceTickets, remoteData.serviceTickets, delSet);
        changed = true;
      }
      if (Array.isArray(remoteData.buildOrders)) {
        state.buildOrders = mergeByIdAndTimestamp(state.buildOrders, remoteData.buildOrders, delSet);
        changed = true;
      }
      if (Array.isArray(remoteData.staffReports)) {
        state.staffReports = mergeByIdAndTimestamp(state.staffReports, remoteData.staffReports, delSet);
        changed = true;
      }
      if (remoteData.customUsers && typeof remoteData.customUsers === "object") {
        Object.entries(remoteData.customUsers).forEach(([uname, uObj]) => {
          const localU = state.customUsers[uname];
          if (!localU || Number(uObj.updatedAt || 0) > Number(localU.updatedAt || 0)) {
            state.customUsers[uname] = uObj;
          }
        });
        changed = true;
      }
      if (Array.isArray(remoteData.savedQuotes)) {
        state.savedQuotes = mergeByIdAndTimestamp(state.savedQuotes, remoteData.savedQuotes, delSet);
        changed = true;
      }
      if (Array.isArray(remoteData.prebuiltSets)) {
        state.prebuiltSets = mergeByIdAndTimestamp(state.prebuiltSets, remoteData.prebuiltSets, delSet);
        changed = true;
      }
      if (Array.isArray(remoteData.masterItems)) {
        state.masterItems = mergeMasterCollections(state.masterItems, remoteData.masterItems, delSet);
        changed = true;
      }

      if (remoteData.updatedAt) {
        state.lastCloudUpdatedAt = Number(remoteData.updatedAt) || Date.now();
      }

      if (changed) {
        saveLocalOnly();
        if (currentUser) applySessionUiAndPermissions();
        else refreshAllViews();
      }
      return changed;
    }

    function setCloudSyncIndicator(statusMode, metaMsg = "") {
      const dot = document.getElementById("syncStatusDot");
      const statusText = document.getElementById("cloudStatusText");
      const metaEl = document.getElementById("lastSyncedMeta");
      const syncNowBtn = document.getElementById("syncNowBtn");
      const stopBtn = document.getElementById("stopSyncHeaderBtn");

      if (dot) {
        dot.className = statusMode === "connected"
          ? "w-2 h-2 rounded-full bg-cyan-400"
          : (statusMode === "syncing"
            ? "w-2 h-2 rounded-full bg-amber-400 animate-ping"
            : (statusMode === "error" ? "w-2 h-2 rounded-full bg-red-400" : "w-2 h-2 rounded-full bg-emerald-400"));
      }
      if (statusText) {
        statusText.textContent = statusMode === "connected"
          ? "Live Team Sync Active ✓"
          : (statusMode === "syncing" ? "Syncing..." : (statusMode === "error" ? "Offline / Retry" : "LocalStorage Active"));
      }
      if (metaEl && metaMsg) metaEl.textContent = metaMsg;
      if (syncNowBtn) {
        if (state.cloudSyncUrl && isAdminUser()) syncNowBtn.classList.remove("hidden");
        else syncNowBtn.classList.add("hidden");
      }
      if (stopBtn) {
        if (state.cloudSyncUrl && isAdminUser()) stopBtn.classList.remove("hidden");
        else stopBtn.classList.add("hidden");
      }
    }

    async function manualPullFromCloud(silent = false) {
      if (!state.cloudSyncUrl || state.isSyncing) return;
      state.isSyncing = true;
      setCloudSyncIndicator("syncing");
      try {
        if (silent && state.lastCloudUpdatedAt > 0 && state.cloudSyncUrl.endsWith(".json")) {
          const tsUrl = state.cloudSyncUrl.replace(/\.json$/, "/updatedAt.json");
          const tsRes = await fetch(tsUrl);
          if (tsRes.ok) {
            const remoteTs = await tsRes.json();
            if (remoteTs && Number(remoteTs) <= state.lastCloudUpdatedAt) {
              setCloudSyncIndicator("connected", `Up to date • ${new Date().toLocaleTimeString()}`);
              state.isSyncing = false;
              return;
            }
          }
        }

        const res = await fetch(state.cloudSyncUrl);
        if (res.ok) {
          const data = await res.json();
          if (data) applyRemoteSnapshot(data);
          setCloudSyncIndicator("connected", `Last Synced: ${new Date().toLocaleTimeString()}`);
          if (!silent) showToast("🔄 Synced latest team updates!", "emerald");
        } else {
          setCloudSyncIndicator("error");
        }
      } catch {
        setCloudSyncIndicator("error");
      } finally {
        state.isSyncing = false;
      }
    }

    async function pushMergedToCloud() {
      if (!state.cloudSyncUrl || state.isSyncing) return;
      state.isSyncing = true;
      setCloudSyncIndicator("syncing");
      try {
        const getRes = await fetch(state.cloudSyncUrl);
        if (getRes.ok) {
          const remote = await getRes.json();
          if (remote) applyRemoteSnapshot(remote);
        }
        await pushDirectSnapshotToCloud();
      } catch {
        setCloudSyncIndicator("error");
      } finally {
        state.isSyncing = false;
      }
    }

    async function pushDirectSnapshotToCloud() {
      if (!state.cloudSyncUrl) return;
      try {
        const nowTs = Date.now();
        const payload = {
          updatedAt: nowTs,
          deletedIds: state.deletedIds,
          enquiries: state.enquiries,
          serviceTickets: state.serviceTickets,
          buildOrders: state.buildOrders,
          staffReports: state.staffReports,
          customUsers: state.customUsers,
          savedQuotes: state.savedQuotes,
          prebuiltSets: state.prebuiltSets,
          masterItems: state.masterItems
        };
        const putRes = await fetch(state.cloudSyncUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (putRes.ok) {
          state.lastCloudUpdatedAt = nowTs;
          setCloudSyncIndicator("connected", `Last Synced: ${new Date().toLocaleTimeString()}`);
        } else {
          setCloudSyncIndicator("error");
        }
      } catch {
        setCloudSyncIndicator("error");
      }
    }

    function startCloudAutoPoll() {
      if (state.cloudPollTimer) clearInterval(state.cloudPollTimer);
      if (!state.cloudSyncUrl) {
        setCloudSyncIndicator("offline");
        return;
      }
      setCloudSyncIndicator("connected");
      manualPullFromCloud(true);
      state.cloudPollTimer = setInterval(() => {
        if (!document.hidden && state.cloudSyncUrl) {
          manualPullFromCloud(true);
        }
      }, 15000);
    }

    function saveCloudSyncConfig() {
      if (!isAdminUser()) return;
      const url = document.getElementById("cloudSyncUrlInput").value.trim();
      state.cloudSyncUrl = url;
      localStorage.setItem(DB_KEYS.CLOUD_URL, url);
      startCloudAutoPoll();
      showToast(url ? "Connected to Firebase Team Sync!" : "Cloud Sync URL cleared.", "emerald");
    }

    function stopCloudSync() {
      if (!isAdminUser()) return;
      state.cloudSyncUrl = "";
      localStorage.setItem(DB_KEYS.CLOUD_URL, "");
      if (state.cloudPollTimer) clearInterval(state.cloudPollTimer);
      setCloudSyncIndicator("offline", "Auto-Sync: Stopped");
      showToast("Cloud syncing stopped. Working locally.", "amber");
    }

    function clearDemoData() {
      if (!isAdminUser()) return;
      state.enquiries = [];
      state.serviceTickets = [];
      state.buildOrders = [];
      state.staffReports = [];
      state.savedQuotes = [];
      state.prebuiltSets = [];
      state.masterItems = [];
      saveLocalOnly();
      refreshAllViews();
      closeModal("backupModal");
      showToast("Local workspace cleared.", "amber");
    }

    function refreshAllViews() {
      const openEnqCount = state.enquiries.filter(e => e.status !== "Closed" && e.status !== "Won / Billed").length;
      const openSrvCount = state.serviceTickets.filter(t => t.status !== "Delivered / Closed").length;
      const activeBldCount = state.buildOrders.filter(b => b.stage !== "Delivered").length;

      const enqBadge = document.getElementById("navEnquiriesCount");
      if (enqBadge) enqBadge.textContent = openEnqCount;
      const qtBadge = document.getElementById("navQuotesCount");
      if (qtBadge) qtBadge.textContent = state.savedQuotes.length;
      const pbBadge = document.getElementById("navBuildSetsCount");
      if (pbBadge) pbBadge.textContent = state.prebuiltSets.length;
      updatePrebuiltCleanupBadge();
      const mstBadge = document.getElementById("navMasterCount");
      if (mstBadge) mstBadge.textContent = state.masterItems.length;
      const srvBadge = document.getElementById("navServiceCount");
      if (srvBadge) srvBadge.textContent = openSrvCount;
      const bldBadge = document.getElementById("navBuildsCount");
      if (bldBadge) bldBadge.textContent = activeBldCount;
      const repBadge = document.getElementById("navReportsCount");
      if (repBadge) repBadge.textContent = state.staffReports.length;

      if (isAdminUser()) {
        const todayIso = getTodayIsoLocal();
        const overdueAlerts = state.enquiries.filter(e => e.status !== "Closed" && e.status !== "Won / Billed" && e.nextFollowUp && e.nextFollowUp < todayIso).length;
        const adminBadge = document.getElementById("navAdminAlertsCount");
        if (adminBadge) adminBadge.textContent = overdueAlerts;
      }

      const tab = state.activeTab || "enquiries";
      if (tab === "admin") renderAdminDashboard();
      else if (tab === "enquiries") renderEnquiriesList();
      else if (tab === "quotations") renderQuotationsWorkspace();
      else if (tab === "prebuilts") renderPrebuiltSets();
      else if (tab === "master") renderMasterSheet();
      else if (tab === "service") renderServiceTickets();
      else if (tab === "builds") renderBuildOrders();
      else if (tab === "reports") renderStaffReportsList();

      updateSheetSyncBadges();
    }
