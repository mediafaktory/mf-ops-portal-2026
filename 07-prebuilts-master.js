// =========================================================================
    // 14. TAB 4: PRE-BUILT PC SETS & MASTER UPSERT
    // =========================================================================
    const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;

    function buildPrebuiltComponentSignature(coreComponents) {
      const sorted = sortComponentsByStandardOrder(coreComponents || []);
      return sorted
        .map(c => `${c.category}::${buildTokenFingerprint(c.name)}::${Math.max(1, parseInt(c.qty, 10) || 1)}`)
        .join("||");
    }

    function getPrebuiltTimestampMs(s) {
      if (s.createdAt) return Number(s.createdAt);
      if (s.quoteDate) {
        const parts = String(s.quoteDate).split("-");
        if (parts.length === 3) {
          return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
        }
      }
      return Number(s.updatedAt || Date.now());
    }

    function isPrebuiltStaleUnused3Months(s) {
      const createdMs = getPrebuiltTimestampMs(s);
      const isOlderThan3M = (Date.now() - createdMs) > THREE_MONTHS_MS;
      const neverLoadedAfter = !s.lastLoadedAt || Number(s.lastLoadedAt) <= createdMs;
      return isOlderThan3M && neverLoadedAfter;
    }

    function analyzePrebuiltSetsHealth() {
      const sigGroups = new Map();
      const staleIds = new Set();

      (state.prebuiltSets || []).forEach(s => {
        const sig = buildPrebuiltComponentSignature(s.coreComponents);
        if (sig) {
          if (!sigGroups.has(sig)) sigGroups.set(sig, []);
          sigGroups.get(sig).push(s);
        }
        if (isPrebuiltStaleUnused3Months(s)) {
          staleIds.add(s.id);
        }
      });

      const duplicateGroups = [];
      const duplicateIds = new Set();
      sigGroups.forEach(list => {
        if (list.length > 1) {
          list.sort((a, b) => (b.buildNumber || 0) - (a.buildNumber || 0));
          duplicateGroups.push(list);
          list.forEach(item => duplicateIds.add(item.id));
        }
      });

      return { duplicateGroups, duplicateIds, staleIds };
    }

    function updatePrebuiltCleanupBadge() {
      const badge = document.getElementById("prebuiltCleanupBadge");
      if (!badge) return;
      const { duplicateIds, staleIds } = analyzePrebuiltSetsHealth();
      const totalFlagged = new Set([...duplicateIds, ...staleIds]).size;
      badge.textContent = totalFlagged;
      if (totalFlagged > 0) badge.classList.remove("hidden");
      else badge.classList.add("hidden");
    }

    function openPrebuiltCleanupModal() {
      const bodyEl = document.getElementById("prebuiltCleanupModalBody");
      if (!bodyEl) return;

      const { duplicateGroups, staleIds } = analyzePrebuiltSetsHealth();
      const staleItems = state.prebuiltSets.filter(s => staleIds.has(s.id));
      const lastCleanedCycleMs = Number(localStorage.getItem(DB_KEYS.WEEKLY_PB_AUDIT) || 0);
      const lastCleanedLabel = lastCleanedCycleMs ? formatMondayCycleLabel(lastCleanedCycleMs) : "Pending First Monday 11 AM Run";
      const canManagePb = hasPermission("canManagePrebuilts");

      const dupSection = duplicateGroups.length === 0
        ? `<div class="p-3 rounded-xl bg-[#0f172a] border border-emerald-500/30 text-emerald-300">✅ No duplicate Pre-Built PCs with identical components found.</div>`
        : `<div class="bg-[#0f172a] border border-amber-500/35 rounded-xl p-3.5 space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="font-bold text-amber-300">🔁 Same-Component Duplicate Groups (${duplicateGroups.length})</span>
              <div class="flex items-center gap-1.5">
                <button type="button" onclick="closeModal('prebuiltCleanupModal'); document.getElementById('prebuiltHealthFilter').value='SIMILAR'; renderPrebuiltSets();"
                  class="px-2.5 py-1 rounded-lg bg-[#1e293b] hover:bg-slate-700 text-cyan-300 border border-[#334155] font-semibold cursor-pointer">
                  Filter in List
                </button>
                ${canManagePb ? `<button type="button" onclick="purgeDuplicatePrebuiltSets()" class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer">Keep Newest &amp; Remove Dups</button>` : ""}
              </div>
            </div>
            <div class="space-y-2 max-h-40 overflow-y-auto pr-1">
              ${duplicateGroups.map(grp => `
                <div class="p-2 rounded-lg bg-[#1e293b] border border-[#334155]">
                  <div class="text-white font-bold">Keep: ${escapeHtml(grp[0].buildName || grp[0].title)} (₹${formatINR(grp[0].coreQuotePrice)}/-)</div>
                  <div class="text-[10px] text-slate-400 mt-0.5">Identical Specs: ${grp.slice(1).map(x => `${x.buildName || x.refCode} (₹${formatINR(x.coreQuotePrice)}/-)`).join(" • ")}</div>
                </div>
              `).join("")}
            </div>
          </div>`;

      const staleSection = staleItems.length === 0
        ? `<div class="p-3 rounded-xl bg-[#0f172a] border border-emerald-500/30 text-emerald-300">✅ No unused Pre-Built PCs older than 3 months found.</div>`
        : `<div class="bg-[#0f172a] border border-purple-500/35 rounded-xl p-3.5 space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="font-bold text-purple-300">⏳ Unused &gt; 3 Months Old (${staleItems.length})</span>
              <div class="flex items-center gap-1.5">
                <button type="button" onclick="closeModal('prebuiltCleanupModal'); document.getElementById('prebuiltHealthFilter').value='STALE_3M'; renderPrebuiltSets();"
                  class="px-2.5 py-1 rounded-lg bg-[#1e293b] hover:bg-slate-700 text-purple-200 border border-[#334155] font-semibold cursor-pointer">
                  Filter in List
                </button>
                ${canManagePb ? `<button type="button" onclick="purgeStaleUnusedPrebuiltSets()" class="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer">Remove All Unused &gt;3M</button>` : ""}
              </div>
            </div>
            <div class="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              ${staleItems.map(s => `
                <div class="flex items-center justify-between p-2 rounded-lg bg-[#1e293b] border border-[#334155]">
                  <span class="text-white font-semibold truncate">${escapeHtml(s.buildName || s.title)}</span>
                  <span class="text-[10px] font-mono text-slate-400 shrink-0 ml-2">Created: ${escapeHtml(s.quoteDate || "—")} • Never Loaded</span>
                </div>
              `).join("")}
            </div>
          </div>`;

      bodyEl.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0f172a] border border-[#334155] text-[11px] text-slate-300">
          <span>🗓️ <strong>Auto-Clean Schedule:</strong> Every Monday at <strong>11:00 AM</strong></span>
          <span class="font-mono text-cyan-300">Last Auto-Run: ${escapeHtml(lastCleanedLabel)}</span>
        </div>
        ${dupSection}
        ${staleSection}
        <div class="flex items-center justify-between pt-2 border-t border-[#334155]">
          ${canManagePb && (duplicateGroups.length > 0 || staleItems.length > 0)
            ? `<button type="button" onclick="runOneClickWeeklyPrebuiltCleanup()" class="px-4 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow cursor-pointer">✨ Auto-Clean All (Dups + &gt;3M Unused)</button>`
            : `<span></span>`}
          <button type="button" onclick="closeModal('prebuiltCleanupModal')" class="px-4 py-2 rounded-xl font-semibold bg-slate-700 hover:bg-slate-600 text-white cursor-pointer">Close</button>
        </div>
      `;
      openModal("prebuiltCleanupModal");
    }

    function runOneClickWeeklyPrebuiltCleanup() {
      if (!hasPermission("canManagePrebuilts")) return;
      const { duplicateGroups, staleIds } = analyzePrebuiltSetsHealth();
      const toRemove = new Set();

      duplicateGroups.forEach(grp => {
        grp.slice(1).forEach(dup => toRemove.add(dup.id));
      });
      staleIds.forEach(id => toRemove.add(id));

      if (toRemove.size === 0) return;

      toRemove.forEach(id => recordDeletedId(id));
      state.prebuiltSets = state.prebuiltSets.filter(s => !toRemove.has(s.id));

      const currentCycleKey = String(getMostRecentMonday11AmMs());
      localStorage.setItem(DB_KEYS.WEEKLY_PB_AUDIT, currentCycleKey);
      const banner = document.getElementById("prebuiltWeeklyAutoBanner");
      if (banner) banner.classList.add("hidden");

      persistDatabaseToStorage();
      refreshAllViews();
      openPrebuiltCleanupModal();
      showToast(`✨ Weekly Cleanup complete: Removed ${toRemove.size} duplicate/stale Pre-Built PC(s)!`, "emerald");
    }

    function purgeDuplicatePrebuiltSets() {
      if (!hasPermission("canManagePrebuilts")) return;
      const { duplicateGroups } = analyzePrebuiltSetsHealth();
      let removed = 0;
      const toRemove = new Set();
      duplicateGroups.forEach(grp => {
        grp.slice(1).forEach(dup => {
          toRemove.add(dup.id);
          recordDeletedId(dup.id);
          removed++;
        });
      });
      if (removed > 0) {
        state.prebuiltSets = state.prebuiltSets.filter(s => !toRemove.has(s.id));
        persistDatabaseToStorage();
        refreshAllViews();
      }
      openPrebuiltCleanupModal();
      showToast(`Removed ${removed} duplicate Pre-Built PC(s)!`, "emerald");
    }

    function purgeStaleUnusedPrebuiltSets() {
      if (!hasPermission("canManagePrebuilts")) return;
      const { staleIds } = analyzePrebuiltSetsHealth();
      if (staleIds.size === 0) return;
      staleIds.forEach(id => recordDeletedId(id));
      state.prebuiltSets = state.prebuiltSets.filter(s => !staleIds.has(s.id));
      persistDatabaseToStorage();
      refreshAllViews();
      openPrebuiltCleanupModal();
      showToast(`Removed ${staleIds.size} unused Pre-Built PC(s) older than 3 months!`, "emerald");
    }

    function renderPrebuiltSets() {
      const container = document.getElementById("prebuiltWeeksContainer");
      const searchInput = document.getElementById("prebuiltSearchInput");
      const useCaseFilter = document.getElementById("prebuiltUseCaseFilter");
      const healthFilter = document.getElementById("prebuiltHealthFilter");
      const sortSelect = document.getElementById("prebuiltSortSelect");
      const countEl = document.getElementById("prebuiltVisibleCount");
      if (!container) return;

      updatePrebuiltCleanupBadge();
      const { duplicateIds, staleIds } = analyzePrebuiltSetsHealth();

      const query = (searchInput?.value || "").toLowerCase().trim();
      const selectedUseCase = useCaseFilter?.value || "ALL";
      const selectedHealth = healthFilter?.value || "ALL";
      const sortOrder = sortSelect?.value || "price_asc";

      const filtered = state.prebuiltSets.filter(s => {
        if (selectedUseCase !== "ALL" && s.useCase !== selectedUseCase) return false;
        if (selectedHealth === "SIMILAR" && !duplicateIds.has(s.id)) return false;
        if (selectedHealth === "STALE_3M" && !staleIds.has(s.id)) return false;
        if (query) {
          const partsText = (s.coreComponents || []).map(c => c.name).join(" ");
          const hay = `${s.buildName || ""} ${s.title || ""} ${s.refCode || ""} Build #${s.buildNumber || ""} ${partsText}`.toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      });

      if (countEl) countEl.textContent = filtered.length;

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="bg-[#1e293b] border border-dashed border-[#334155] rounded-2xl p-10 text-center">
            <p class="text-sm font-semibold text-slate-300 mb-1">No Pre-Built PC Sets match your filter.</p>
            <p class="text-xs text-slate-400">Whenever you click <strong class="text-emerald-400">Copy for WhatsApp</strong> or <strong class="text-cyan-400">PDF Quote</strong>, external peripherals are stripped and the core PC automatically saves here in standard component order.</p>
          </div>
        `;
        return;
      }

      const sortedItems = filtered.slice().sort((a, b) => {
        if (selectedHealth === "SIMILAR") {
          const sigCmp = buildPrebuiltComponentSignature(a.coreComponents).localeCompare(buildPrebuiltComponentSignature(b.coreComponents));
          if (sigCmp !== 0) return sigCmp;
        }
        if (sortOrder === "price_desc") return (b.coreQuotePrice || 0) - (a.coreQuotePrice || 0);
        if (sortOrder === "build_desc") return (b.buildNumber || 0) - (a.buildNumber || 0);
        return (a.coreQuotePrice || 0) - (b.coreQuotePrice || 0);
      });

      const canManagePb = hasPermission("canManagePrebuilts");

      const cardsHtml = sortedItems.map(s => {
        const orderedCore = sortComponentsByStandardOrder(s.coreComponents || []);
        const coreList = orderedCore.map(c =>
          `<div class="flex items-center justify-between gap-2 text-[11px] py-1 border-b border-[#334155]/60 last:border-none">
            <span class="text-slate-400 font-medium shrink-0">${escapeHtml(c.category)}</span>
            <span class="text-slate-100 truncate text-right">${(c.qty || 1) > 1 ? c.qty + "x " : ""}${escapeHtml(c.name)}</span>
          </div>`
        ).join("");

        const strippedBadge = (s.strippedExternalNames && s.strippedExternalNames.length > 0)
          ? `<div class="mt-2 text-[10px] text-purple-300 bg-purple-950/40 border border-purple-500/30 rounded-lg px-2 py-1">
              Stripped External: ${escapeHtml(s.strippedExternalNames.join(", "))}
            </div>`
          : "";

        const statusFlags = [];
        if (duplicateIds.has(s.id)) {
          statusFlags.push(`<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">🔁 Same Specs</span>`);
        }
        if (staleIds.has(s.id)) {
          statusFlags.push(`<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">⏳ Unused &gt;3M</span>`);
        }

        const deleteBtnHtml = canManagePb
          ? `<button type="button" onclick="deletePrebuiltSet('${s.id}')" class="p-2 rounded-xl bg-[#0f172a] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-[#334155] transition cursor-pointer" title="Delete Set">✕</button>`
          : "";

        return `
          <div class="perf-card bg-[#1e293b] border border-[#334155] hover:border-cyan-500/50 rounded-2xl p-4 flex flex-col justify-between shadow-lg transition">
            <div>
              <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div class="flex flex-wrap items-center gap-1.5">
                  ${s.buildNumber ? `<span class="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 font-mono text-[11px] font-extrabold border border-cyan-500/40">Build #${s.buildNumber}</span>` : ""}
                  <span class="px-2 py-0.5 rounded-md bg-[#0f172a] text-amber-300 font-mono text-[10px] font-bold border border-[#334155]">${escapeHtml(s.refCode)}</span>
                  ${statusFlags.join("")}
                </div>
                <span class="text-[10px] font-semibold text-slate-300">${escapeHtml(s.useCaseLabel || "")}</span>
              </div>

              <h4 class="text-sm font-bold text-white mb-2.5">${escapeHtml(s.buildName || s.title)}</h4>

              <div class="bg-[#0f172a] border border-[#334155] rounded-xl p-2.5 mb-3">
                ${coreList}
              </div>
              ${strippedBadge}
            </div>

            <div class="pt-3 mt-3 border-t border-[#334155]">
              <div class="grid grid-cols-3 gap-1.5 text-center mb-3">
                <div class="bg-[#0f172a] rounded-lg p-1.5 border border-[#334155]">
                  <span class="block text-[9px] text-slate-400 uppercase">Base Cost</span>
                  <span class="text-[11px] font-mono font-bold text-slate-200">₹${formatINR(s.coreBaseCost)}</span>
                </div>
                <div class="bg-[#0f172a] rounded-lg p-1.5 border border-[#334155]">
                  <span class="block text-[9px] text-slate-400 uppercase">24% Floor</span>
                  <span class="text-[11px] font-mono font-bold text-amber-300">₹${formatINR(s.coreFloor24Price)}</span>
                </div>
                <div class="bg-emerald-950/60 rounded-lg p-1.5 border border-emerald-500/40">
                  <span class="block text-[9px] text-emerald-300 uppercase">Quote Price</span>
                  <span class="text-xs font-mono font-extrabold text-emerald-300">₹${formatINR(s.coreQuotePrice)}/-</span>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button type="button" onclick="loadPrebuiltIntoGenerator('${s.id}')" class="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition cursor-pointer">
                  Load Core PC into Quote
                </button>
                ${deleteBtnHtml}
              </div>
            </div>
          </div>
        `;
      }).join("");

      container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          ${cardsHtml}
        </div>
      `;
    }

    function upsertMasterComponent(comp, sourceLabel = "Quote") {
      const price = Math.round(parseFloat(comp.basePrice) || 0);
      if (!comp || !comp.name || price <= 0) {
        return { status: "skipped", item: null };
      }

      const standardizedName = standardizeAllCapsComponentName(comp.name, comp.category, false);
      const normKey = buildTokenFingerprint(standardizedName);
      const todayIso = getTodayIsoLocal();
      const nowTs = Date.now();

      const fuzzyHit = findMasterFuzzyMatch(standardizedName, comp.category);
      const existing = fuzzyHit ? fuzzyHit.item : null;

      if (existing) {
        if (Math.round(existing.gettingPrice) !== price) {
          const oldPrice = Math.round(existing.gettingPrice);
          const deltaPct = oldPrice > 0 ? (((price - oldPrice) / oldPrice) * 100).toFixed(1) : "0.0";
          existing.previousPrice = oldPrice;
          existing.lastDelta = `${price > oldPrice ? "+" : ""}${deltaPct}%`;
          existing.gettingPrice = price;
          existing.isNetPrice = Boolean(comp.isNetPrice);
          existing.warranty = comp.warranty || existing.warranty;
          existing.source = sourceLabel;
          existing.lastUpdated = todayIso;
          existing.updatedAt = nowTs;
          return { status: "updated", item: existing };
        }
        return { status: "unchanged", item: existing };
      }

      const newItem = {
        id: "mst_" + nowTs + "_" + Math.random().toString(36).slice(2, 6),
        normKey,
        category: comp.category || "Other",
        name: standardizedName,
        warranty: comp.warranty || "3 Years",
        gettingPrice: price,
        isNetPrice: Boolean(comp.isNetPrice),
        isExternal: Boolean(comp.isExternal),
        previousPrice: null,
        lastDelta: "",
        source: sourceLabel,
        lastUpdated: todayIso,
        updatedAt: nowTs
      };
      state.masterItems.unshift(newItem);
      return { status: "created", item: newItem };
    }

    function findExistingCustomerQuoteGroup(customerName, customerPhone) {
      const pKey = normalizePhoneKey(customerPhone);
      const cleanName = String(customerName || "").trim().toLowerCase();
      if (!pKey && !cleanName) return null;

      return state.savedQuotes.find(q => {
        const qPhone = normalizePhoneKey(q.customerPhone);
        if (pKey && pKey.length >= 10 && qPhone === pKey) return true;
        const qName = String(q.customerName || "").trim().toLowerCase();
        if (!pKey && cleanName && cleanName.length >= 3 && qName === cleanName) return true;
        return false;
      }) || null;
    }

    function saveQuoteAndSyncAll(advanceQuoteNumber = true) {
      if (state.components.length === 0) {
        if (!advanceQuoteNumber) {
          showToast("Add at least one component before saving!", "amber");
        }
        return null;
      }

      state.components.forEach(c => {
        c.name = standardizeAllCapsComponentName(c.name, c.category, false);
      });
      renderComponentRows();

      const quoteDate = document.getElementById("quoteDateInput").value || getTodayIsoLocal();
      const customerName = document.getElementById("customerNameInput").value.trim();
      const customerPhone = document.getElementById("customerPhoneInput").value.trim();
      let refCode = document.getElementById("refCodeInput").value.trim() || generateNextRefCode(quoteDate);

      const exactRefExists = state.savedQuotes.find(q => q.refCode === refCode);
      if (state.editingQuoteBaseCode) {
        if (exactRefExists) {
          refCode = getNextRevisionCodeForBase(state.editingQuoteBaseCode);
        }
      } else {
        const customerPrevQuote = findExistingCustomerQuoteGroup(customerName, customerPhone);
        if (customerPrevQuote && !/-REV\d+$/i.test(refCode)) {
          const prevBase = extractBaseQuoteCode(customerPrevQuote.refCode);
          const sameDayOrRecent = (Date.now() - Number(customerPrevQuote.updatedAt || 0)) < 14 * 86400000;
          if (sameDayOrRecent) {
            refCode = getNextRevisionCodeForBase(prevBase);
          }
        }
      }

      document.getElementById("refCodeInput").value = refCode;

      const title = document.getElementById("buildTitleInput").value.trim() || "Custom PC Build";
      const docType = document.getElementById("docTypeInput").value;
      const useCase = document.getElementById("useCaseSelect").value;
      const branch = document.getElementById("branchSelectInput").value || "Calicut";
      const quoteValidity = document.getElementById("quoteValidityInput")?.value.trim() || "5 Days";
      const showItemPrices = document.getElementById("showItemPricesToggle").checked;
      const weekMeta = getISOWeekMeta(quoteDate);
      const totalFinal = state.components.reduce((sum, r) => sum + calculateFinalPrice(r), 0);
      const nowTs = Date.now();
      const createdBy = currentUser ? currentUser.displayName : "Team";

      const existingQuoteIdx = state.savedQuotes.findIndex(q => q.refCode === refCode);
      const quoteRecord = {
        id: existingQuoteIdx >= 0 ? state.savedQuotes[existingQuoteIdx].id : ("qt_" + nowTs + "_" + Math.random().toString(36).slice(2, 6)),
        refCode,
        title,
        docType,
        useCase,
        branch,
        quoteValidity,
        createdBy,
        customerName,
        customerPhone,
        quoteDate,
        weekKey: weekMeta.weekKey,
        weekLabel: weekMeta.weekLabel,
        globalMargin: state.globalMargin,
        showItemPrices,
        highlights: JSON.parse(JSON.stringify(state.highlights)),
        components: JSON.parse(JSON.stringify(state.components)),
        totalFinal,
        savedAt: new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
        updatedAt: nowTs
      };

      if (existingQuoteIdx >= 0) {
        state.savedQuotes[existingQuoteIdx] = quoteRecord;
      } else {
        state.savedQuotes.unshift(quoteRecord);
      }

      const coreComponents = sortComponentsByStandardOrder(
        state.components.filter(c => !c.isExternal && !isCategoryExternal(c.category, c.name))
      );
      const strippedExternalNames = state.components
        .filter(c => c.isExternal || isCategoryExternal(c.category, c.name))
        .map(c => c.name);

      let assignedBuildLabel = "";
      if (coreComponents.length > 0) {
        let coreBaseCost = 0;
        let coreFloor24Price = 0;
        let coreTarget28Price = 0;
        let coreQuotePrice = 0;

        coreComponents.forEach(c => {
          const qty = Math.max(1, parseInt(c.qty) || 1);
          const unitBase = parseFloat(c.basePrice) || 0;
          coreBaseCost += unitBase * qty;
          coreFloor24Price += (c.isNetPrice ? Math.round(unitBase) : Math.round(unitBase * 1.24)) * qty;
          coreTarget28Price += (c.isNetPrice ? Math.round(unitBase) : Math.round(unitBase * 1.28)) * qty;
          coreQuotePrice += calculateFinalPrice(c);
        });

        const existingPrebuiltIdx = state.prebuiltSets.findIndex(s => s.refCode === refCode);
        const buildNumber = existingPrebuiltIdx >= 0 && state.prebuiltSets[existingPrebuiltIdx].buildNumber
          ? state.prebuiltSets[existingPrebuiltIdx].buildNumber
          : generateNextPrebuiltBuildNumber();

        const cleanBaseTitle = title.replace(/^Build\s*#?\d+\s*[—\-:]\s*/i, "").trim();
        const buildName = `Build #${buildNumber} — ${cleanBaseTitle}`;
        assignedBuildLabel = `Build #${buildNumber}`;

        const prebuiltRecord = {
          id: existingPrebuiltIdx >= 0 ? state.prebuiltSets[existingPrebuiltIdx].id : ("pb_" + nowTs + "_" + Math.random().toString(36).slice(2, 6)),
          buildNumber,
          buildName,
          refCode,
          title: buildName,
          useCase,
          useCaseLabel: USE_CASE_PRESETS[useCase]?.label || "Custom PC",
          quoteDate,
          createdAt: existingPrebuiltIdx >= 0 ? (state.prebuiltSets[existingPrebuiltIdx].createdAt || nowTs) : nowTs,
          lastLoadedAt: existingPrebuiltIdx >= 0 ? (state.prebuiltSets[existingPrebuiltIdx].lastLoadedAt || null) : null,
          loadCount: existingPrebuiltIdx >= 0 ? (state.prebuiltSets[existingPrebuiltIdx].loadCount || 0) : 0,
          weekKey: weekMeta.weekKey,
          weekLabel: weekMeta.weekLabel,
          marginUsed: state.globalMargin,
          coreBaseCost: Math.round(coreBaseCost),
          coreFloor24Price: Math.round(coreFloor24Price),
          coreTarget28Price: Math.round(coreTarget28Price),
          coreQuotePrice: Math.round(coreQuotePrice),
          coreComponents: JSON.parse(JSON.stringify(coreComponents)),
          strippedExternalNames,
          updatedAt: nowTs
        };

        if (existingPrebuiltIdx >= 0) {
          state.prebuiltSets[existingPrebuiltIdx] = prebuiltRecord;
        } else {
          state.prebuiltSets.unshift(prebuiltRecord);
        }
      }

      let masterAdded = 0;
      let masterUpdated = 0;
      state.components.forEach(c => {
        const res = upsertMasterComponent(c, refCode);
        if (res.status === "created") masterAdded++;
        if (res.status === "updated") masterUpdated++;
      });

      const autoLogEl = document.getElementById("autoLogEnquiryToggle");
      if (autoLogEl && autoLogEl.checked) {
        linkOrCreateEnquiryFromQuote(quoteRecord);
      }

      persistDatabaseToStorage();
      refreshAllViews();
      syncMasterAndPrebuiltsToGoogleSheet(true);

      let nextRefCode = refCode;
      if (advanceQuoteNumber) {
        state.editingQuoteBaseCode = null;
        nextRefCode = generateNextRefCode(quoteDate);
        document.getElementById("refCodeInput").value = nextRefCode;
        updateQuoteModeBadge();
        renderPreview();
      } else {
        state.editingQuoteBaseCode = extractBaseQuoteCode(refCode);
        updateQuoteModeBadge();
        showToast(`Saved ${refCode} (${assignedBuildLabel || "Quote"}) • Master: +${masterAdded} / ${masterUpdated} updated`, "emerald");
      }

      return {
        issuedRefCode: refCode,
        nextRefCode,
        assignedBuildLabel,
        masterAdded,
        masterUpdated
      };
    }

    // =========================================================================
    // 15. TAB 5: MASTER COMPONENT PRICE SHEET & MANUAL SELECT-MERGE
    // =========================================================================
    function updateMasterSelectionToolbar() {
      const validIds = new Set((state.masterItems || []).map(m => m.id));
      state.selectedMasterIds = (state.selectedMasterIds || []).filter(id => validIds.has(id));

      const btn = document.getElementById("manualMergeSelectedBtn");
      const countSpan = document.getElementById("selectedMasterCountSpan");
      if (!btn || !countSpan) return;

      countSpan.textContent = state.selectedMasterIds.length;
      if (hasPermission("canDedupeMergeMaster") && state.selectedMasterIds.length >= 2) {
        btn.classList.remove("hidden");
      } else {
        btn.classList.add("hidden");
      }
    }

    function toggleMasterItemSelection(itemId, isChecked) {
      const set = new Set(state.selectedMasterIds || []);
      if (isChecked) set.add(itemId);
      else set.delete(itemId);
      state.selectedMasterIds = Array.from(set);
      updateMasterSelectionToolbar();
    }

    function toggleSelectAllVisibleMaster(isChecked) {
      const checkboxes = document.querySelectorAll(".master-row-select-cb");
      const set = new Set(state.selectedMasterIds || []);
      checkboxes.forEach(cb => {
        cb.checked = isChecked;
        const id = cb.getAttribute("data-id");
        if (id) {
          if (isChecked) set.add(id);
          else set.delete(id);
        }
      });
      state.selectedMasterIds = Array.from(set);
      updateMasterSelectionToolbar();
    }

    function openManualMergeModal() {
      if (!hasPermission("canDedupeMergeMaster")) {
        showToast("You do not have permission to merge Master Sheet items.", "amber");
        return;
      }
      const selectedItems = state.masterItems.filter(m => state.selectedMasterIds.includes(m.id));
      if (selectedItems.length < 2) {
        showToast("Select at least 2 items to merge.", "amber");
        return;
      }

      selectedItems.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
      const listEl = document.getElementById("manualMergeCandidatesList");
      const nameInput = document.getElementById("manualMergeFinalNameInput");

      listEl.innerHTML = selectedItems.map((item, idx) => `
        <label class="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#0f172a] border ${idx === 0 ? 'border-cyan-500/60' : 'border-[#334155]'} cursor-pointer hover:border-cyan-400">
          <div class="flex items-center gap-2.5 min-w-0">
            <input type="radio" name="manualMergePrimaryRadio" value="${item.id}" ${idx === 0 ? "checked" : ""}
              onchange="onManualMergePrimaryChanged('${item.id}')" class="accent-cyan-500 cursor-pointer" />
            <div class="min-w-0">
              <div class="text-xs font-bold text-white truncate">${escapeHtml(item.name)}</div>
              <div class="text-[10px] text-slate-400">${escapeHtml(item.category)} • ${escapeHtml(item.warranty)} • Updated: ${escapeHtml(item.lastUpdated || "—")}</div>
            </div>
          </div>
          <span class="font-mono text-xs font-bold text-amber-300 shrink-0">₹${formatINR(item.gettingPrice)}</span>
        </label>
      `).join("");

      nameInput.value = standardizeAllCapsComponentName(selectedItems[0].name, selectedItems[0].category, true);
      openModal("manualMergeModal");
    }

    function onManualMergePrimaryChanged(primaryId) {
      const item = state.masterItems.find(m => m.id === primaryId);
      if (!item) return;
      document.getElementById("manualMergeFinalNameInput").value = standardizeAllCapsComponentName(item.name, item.category, true);
    }

    async function executeManualMasterMerge() {
      if (!hasPermission("canDedupeMergeMaster")) return;
      const selectedRadio = document.querySelector('input[name="manualMergePrimaryRadio"]:checked');
      if (!selectedRadio) return;

      const primaryId = selectedRadio.value;
      const winner = state.masterItems.find(m => m.id === primaryId);
      if (!winner) return;

      const customFinalName = standardizeAllCapsComponentName(
        document.getElementById("manualMergeFinalNameInput").value.trim() || winner.name,
        winner.category,
        true
      );
      const updateHistory = document.getElementById("manualMergeUpdateHistory").checked;

      const losers = state.masterItems.filter(m => state.selectedMasterIds.includes(m.id) && m.id !== primaryId);
      const loserNamesSet = new Set(losers.map(l => l.name.toUpperCase()));

      losers.forEach(l => {
        recordDeletedId(l.id);
        if (l.normKey && l.normKey !== buildTokenFingerprint(customFinalName)) {
          recordDeletedId(l.normKey);
        }
      });

      winner.name = customFinalName;
      winner.normKey = buildTokenFingerprint(customFinalName);
      winner.updatedAt = Date.now();
      winner.lastUpdated = getTodayIsoLocal();

      const loserIdsSet = new Set(losers.map(l => l.id));
      state.masterItems = state.masterItems.filter(m => !loserIdsSet.has(m.id));
      state.selectedMasterIds = [];

      if (updateHistory && loserNamesSet.size > 0) {
        state.savedQuotes.forEach(q => {
          (q.components || []).forEach(c => {
            if (loserNamesSet.has(String(c.name || "").toUpperCase())) {
              c.name = customFinalName;
            }
          });
        });
        state.prebuiltSets.forEach(s => {
          (s.coreComponents || []).forEach(c => {
            if (loserNamesSet.has(String(c.name || "").toUpperCase())) {
              c.name = customFinalName;
            }
          });
        });
      }

      saveLocalOnly();
      refreshAllViews();
      closeModal("manualMergeModal");

      if (state.cloudSyncUrl) {
        await pushDirectSnapshotToCloud();
      }
      await syncMasterAndPrebuiltsToGoogleSheet(true);
      showToast(`🔗 Merged ${losers.length + 1} items into "${customFinalName}"!`, "emerald");
    }

    function renderMasterSheet() {
      const query = (document.getElementById("masterSearchInput").value || "").toLowerCase().trim();
      const catFilter = document.getElementById("masterCategoryFilter").value;
      const sortBy = document.getElementById("masterSortSelect").value;

      updateMasterSelectionToolbar();
      const selectAllCb = document.getElementById("masterSelectAllCheckbox");
      if (selectAllCb) selectAllCb.checked = false;

      let items = state.masterItems.filter(item => {
        if (catFilter !== "ALL" && item.category !== catFilter) return false;
        if (query && !item.name.toLowerCase().includes(query) && !item.category.toLowerCase().includes(query)) return false;
        return true;
      });

      items.sort((a, b) => compareMasterItemsByCategory(a, b, sortBy));

      const tbody = document.getElementById("masterTableBody");
      if (items.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" class="py-10 text-center text-slate-400">
              No components match your filter.
            </td>
          </tr>
        `;
        return;
      }

      const limit = state.visibleLimits.master || 60;
      const visibleItems = items.slice(0, limit);
      const selectedSet = new Set(state.selectedMasterIds || []);
      const canEditMaster = hasPermission("canEditMasterPrices");

      const rowsHtml = visibleItems.map(item => {
        const floor24 = item.isNetPrice ? item.gettingPrice : Math.round(item.gettingPrice * 1.24);
        const target28 = item.isNetPrice ? item.gettingPrice : Math.round(item.gettingPrice * 1.28);
        const isChecked = selectedSet.has(item.id);

        let updateBadge = `<span class="text-[11px] text-slate-400 font-mono">${escapeHtml(item.lastUpdated || "—")}</span>`;
        if (item.previousPrice && item.previousPrice !== item.gettingPrice) {
          const isUp = item.gettingPrice > item.previousPrice;
          const badgeColors = isUp
            ? "bg-red-500/15 text-red-300 border-red-500/35"
            : "bg-emerald-500/15 text-emerald-300 border-emerald-500/35";
          updateBadge = `
            <div class="flex flex-col gap-0.5">
              <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badgeColors}">
                Price Updated: ₹${formatINR(item.previousPrice)} → ₹${formatINR(item.gettingPrice)} (${item.lastDelta || ""})
              </span>
              <span class="text-[10px] text-slate-500 font-mono">${escapeHtml(item.lastUpdated || "")}</span>
            </div>
          `;
        }

        const adminButtons = canEditMaster
          ? `<button type="button" onclick="openEditMasterItemModal('${item.id}')" class="px-2 py-1 rounded-lg text-[11px] font-semibold bg-[#0f172a] hover:bg-slate-700 text-slate-200 border border-[#334155] transition cursor-pointer">Edit</button>
             <button type="button" onclick="deleteMasterItem('${item.id}')" class="p-1 rounded-lg bg-[#0f172a] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-[#334155] transition cursor-pointer" title="Delete">✕</button>`
          : "";

        return `
          <tr class="${isChecked ? 'bg-cyan-950/35' : 'hover:bg-slate-800/50'} transition">
            <td class="py-3 px-3 text-center">
              <input type="checkbox" data-id="${item.id}" ${isChecked ? "checked" : ""}
                onchange="toggleMasterItemSelection('${item.id}', this.checked)"
                class="master-row-select-cb accent-cyan-500 cursor-pointer" />
            </td>
            <td class="py-3 px-4 font-semibold text-slate-300 whitespace-nowrap">${escapeHtml(item.category)}</td>
            <td class="py-3 px-4 font-medium text-white max-w-md">${escapeHtml(item.name)}</td>
            <td class="py-3 px-4 whitespace-nowrap">
              ${item.isExternal
                ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">External</span>`
                : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Core PC</span>`}
            </td>
            <td class="py-3 px-4 text-slate-300 whitespace-nowrap">${escapeHtml(item.warranty)}</td>
            <td class="py-3 px-4 font-mono font-bold text-amber-300 whitespace-nowrap">
              ₹${formatINR(item.gettingPrice)} ${item.isNetPrice ? '<span class="text-[10px] text-sky-400">(Net)</span>' : '<span class="text-[10px] text-slate-400">+GST</span>'}
            </td>
            <td class="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
              <span class="text-slate-300">₹${formatINR(floor24)}</span> <span class="text-slate-500">/</span> <span class="text-emerald-300 font-semibold">₹${formatINR(target28)}</span>
            </td>
            <td class="py-3 px-4">${updateBadge}</td>
            <td class="py-3 px-4 text-right whitespace-nowrap">
              <div class="inline-flex items-center gap-1.5">
                <button type="button" onclick="addMasterItemToQuote('${item.id}')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer" title="Add to active Quote">
                  + Quote
                </button>
                ${adminButtons}
              </div>
            </td>
          </tr>
        `;
      }).join("");

      const moreRow = items.length > limit
        ? `<tr><td colspan="9" class="p-3 text-center"><button type="button" onclick="showMoreListItems('master', 60)" class="px-4 py-2 rounded-xl text-xs font-bold bg-[#0f172a] hover:bg-slate-800 text-amber-300 border border-[#334155] cursor-pointer">Load More Components (${items.length - limit} remaining)</button></td></tr>`
        : "";

      tbody.innerHTML = rowsHtml + moreRow;
    }

    function openMasterPickerModal() {
      document.getElementById("pickerSearchInput").value = "";
      renderMasterPickerList();
      openModal("masterPickerModal");
    }

    function renderMasterPickerList() {
      const q = (document.getElementById("pickerSearchInput").value || "").toLowerCase().trim();
      const cat = document.getElementById("pickerCatFilter").value;
      const listEl = document.getElementById("masterPickerList");

      const matches = state.masterItems
        .filter(item => {
          if (cat !== "ALL" && item.category !== cat) return false;
          if (q && !item.name.toLowerCase().includes(q) && !item.category.toLowerCase().includes(q)) return false;
          return true;
        })
        .sort((a, b) => compareMasterItemsByCategory(a, b, "price_asc"))
        .slice(0, 60);

      if (matches.length === 0) {
        listEl.innerHTML = `<div class="text-center py-6 text-xs text-slate-400">No matching components in Master Price Sheet.</div>`;
        return;
      }

      listEl.innerHTML = matches.map(item => `
        <div class="bg-[#0f172a] border border-[#334155] hover:border-cyan-500/50 rounded-xl p-3 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#1e293b] text-slate-300 border border-[#334155]">${escapeHtml(item.category)}</span>
              <span class="text-[10px] text-slate-400">${escapeHtml(item.warranty)}</span>
            </div>
            <div class="text-xs font-semibold text-white truncate mt-1">${escapeHtml(item.name)}</div>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <div class="text-right">
              <div class="text-xs font-mono font-bold text-amber-300">₹${formatINR(item.gettingPrice)}</div>
              <div class="text-[10px] text-slate-400">${item.isNetPrice ? 'Net' : 'Base'}</div>
            </div>
            <button type="button" onclick="addMasterItemToQuote('${item.id}', true)" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer">
              + Insert
            </button>
          </div>
        </div>
      `).join("");
    }

    function addMasterItemToQuote(masterId, fromPickerModal = false) {
      const item = state.masterItems.find(m => m.id === masterId);
      if (!item) return;

      state.components.push({
        id: uid(),
        category: item.category,
        name: String(item.name).toUpperCase(),
        warranty: item.warranty,
        qty: 1,
        basePrice: item.gettingPrice,
        isNetPrice: Boolean(item.isNetPrice),
        isExternal: Boolean(item.isExternal)
      });

      renderComponentRows();
      recalculateAll();
      if (!fromPickerModal) {
        switchWorkspaceTab("generator");
      }
      showToast(`Added "${item.name}" (₹${formatINR(item.gettingPrice)})`, "emerald");
    }

    function openMasterBulkImportModal() {
      if (!hasPermission("canEditMasterPrices")) {
        showToast("You do not have permission to import master price lists.", "amber");
        return;
      }
      document.getElementById("masterBulkTextarea").value = "";
      openModal("masterImportModal");
    }

    function processMasterBulkImport() {
      if (!hasPermission("canEditMasterPrices")) return;
      const raw = document.getElementById("masterBulkTextarea").value.trim();
      if (!raw) {
        showToast("Paste distributor lines to import!", "amber");
        return;
      }

      const parsed = parseRawLinesToObjects(raw);
      let updated = 0;
      let added = 0;

      parsed.forEach(p => {
        const res = upsertMasterComponent(p, "Bulk Price Sync");
        if (res.status === "updated") updated++;
        if (res.status === "created") added++;
      });

      persistDatabaseToStorage();
      refreshAllViews();
      closeModal("masterImportModal");
      syncMasterAndPrebuiltsToGoogleSheet(true);
      showToast(`Master Sheet Synced: ${added} new, ${updated} price(s) updated!`, "emerald");
    }

    function autoToggleSingleMasterExternal() {
      const cat = document.getElementById("singleMasterCat").value;
      document.getElementById("singleMasterIsExternal").checked = isCategoryExternal(cat);
    }

    function openAddMasterItemModal() {
      if (!hasPermission("canEditMasterPrices")) {
        showToast("You do not have permission to add master items manually.", "amber");
        return;
      }
      document.getElementById("singleMasterModalTitle").textContent = "Add New Component to Master Sheet";
      document.getElementById("editMasterItemId").value = "";
      document.getElementById("singleMasterCat").value = "Processor";
      document.getElementById("singleMasterName").value = "";
      document.getElementById("singleMasterPrice").value = "";
      document.getElementById("singleMasterWarranty").value = "3 Years";
      document.getElementById("singleMasterIsNet").checked = false;
      document.getElementById("singleMasterIsExternal").checked = false;
      openModal("masterSingleItemModal");
    }

    function openEditMasterItemModal(itemId) {
      if (!hasPermission("canEditMasterPrices")) {
        showToast("You do not have permission to edit master prices.", "amber");
        return;
      }
      const item = state.masterItems.find(m => m.id === itemId);
      if (!item) return;
      document.getElementById("singleMasterModalTitle").textContent = "Edit Master Component Price";
      document.getElementById("editMasterItemId").value = item.id;
      document.getElementById("singleMasterCat").value = item.category;
      document.getElementById("singleMasterName").value = item.name;
      document.getElementById("singleMasterPrice").value = item.gettingPrice;
      document.getElementById("singleMasterWarranty").value = item.warranty;
      document.getElementById("singleMasterIsNet").checked = Boolean(item.isNetPrice);
      document.getElementById("singleMasterIsExternal").checked = Boolean(item.isExternal);
      openModal("masterSingleItemModal");
    }

    function saveSingleMasterItem() {
      if (!hasPermission("canEditMasterPrices")) return;
      const editId = document.getElementById("editMasterItemId").value;
      const category = document.getElementById("singleMasterCat").value;
      const rawName = document.getElementById("singleMasterName").value.trim();
      const name = standardizeAllCapsComponentName(rawName, category, true);
      const price = parseFloat(document.getElementById("singleMasterPrice").value) || 0;
      const warranty = document.getElementById("singleMasterWarranty").value;
      const isNetPrice = document.getElementById("singleMasterIsNet").checked;
      const isExternal = document.getElementById("singleMasterIsExternal").checked;

      if (!name || price <= 0) {
        showToast("Enter valid component name and price!", "amber");
        return;
      }

      if (editId) {
        const existing = state.masterItems.find(m => m.id === editId);
        if (existing) {
          if (Math.round(existing.gettingPrice) !== Math.round(price)) {
            const oldPrice = Math.round(existing.gettingPrice);
            const newPrice = Math.round(price);
            const deltaPct = oldPrice > 0 ? (((newPrice - oldPrice) / oldPrice) * 100).toFixed(1) : "0.0";
            existing.previousPrice = oldPrice;
            existing.lastDelta = `${newPrice > oldPrice ? "+" : ""}${deltaPct}%`;
          }
          existing.category = category;
          existing.name = name;
          existing.normKey = buildTokenFingerprint(name);
          existing.gettingPrice = Math.round(price);
          existing.warranty = warranty;
          existing.isNetPrice = isNetPrice;
          existing.isExternal = isExternal;
          existing.lastUpdated = new Date().toISOString().split("T")[0];
          existing.updatedAt = Date.now();
        }
      } else {
        upsertMasterComponent({ category, name, basePrice: price, warranty, isNetPrice, isExternal }, "Manual Entry");
      }

      persistDatabaseToStorage();
      refreshAllViews();
      closeModal("masterSingleItemModal");
      syncMasterAndPrebuiltsToGoogleSheet(true);
      showToast("Master Price Sheet updated in ALL-CAPS!", "emerald");
    }

    async function deleteMasterItem(itemId) {
      if (!hasPermission("canEditMasterPrices")) {
        showToast("You do not have permission to delete master items.", "amber");
        return;
      }
      const target = state.masterItems.find(m => m.id === itemId);
      if (target) {
        recordDeletedId(target.id);
        recordDeletedId(target.normKey);
      }
      state.masterItems = state.masterItems.filter(m => m.id !== itemId);
      saveLocalOnly();
      refreshAllViews();
      if (state.cloudSyncUrl) {
        await pushDirectSnapshotToCloud();
      }
      syncMasterAndPrebuiltsToGoogleSheet(true);
      showToast("Item deleted from Master Sheet.", "amber");
    }

    function exportMasterSheetCSV() {
      if (!hasPermission("canExportBackup")) {
        showToast("You do not have permission to export CSV sheets.", "amber");
        return;
      }
      const headers = [
        "Category", "Component Model & Specs", "Type", "Warranty",
        "Latest Getting Price", "Price Mode", "24% Floor Price", "28% Target Price",
        "Previous Price", "Price Delta", "Last Updated"
      ];

      const sortedMaster = state.masterItems.slice().sort((a, b) => compareMasterItemsByCategory(a, b, "price_asc"));
      const rows = sortedMaster.map(m => [
        m.category,
        m.name,
        m.isExternal ? "External Peripheral" : "Core PC",
        m.warranty,
        m.gettingPrice,
        m.isNetPrice ? "Tax-Incl. Net" : "Base (+GST)",
        m.isNetPrice ? m.gettingPrice : Math.round(m.gettingPrice * 1.24),
        m.isNetPrice ? m.gettingPrice : Math.round(m.gettingPrice * 1.28),
        m.previousPrice || "",
        m.lastDelta || "",
        m.lastUpdated || ""
      ]);

      downloadCSVFile(`Media_Faktory_Master_Price_Sheet_${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
    }

    // =========================================================================
    // 16. CSV & JSON EXPORT/RESTORE HELPERS
    // =========================================================================
    function downloadCSVFile(filename, headers, rows) {
      const escapeCSV = (val) => {
        const str = String(val ?? "");
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvContent = "\uFEFF" + [
        headers.map(escapeCSV).join(","),
        ...rows.map(r => r.map(escapeCSV).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Exported ${filename}`, "emerald");
    }

    function exportFullDatabaseJSON() {
      if (!isAdminUser()) {
        showToast("Only Admin (Ashwin) can download backups.", "amber");
        return;
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        brand: "Media Faktory",
        enquiries: state.enquiries,
        serviceTickets: state.serviceTickets,
        buildOrders: state.buildOrders,
        staffReports: state.staffReports,
        customUsers: state.customUsers,
        savedQuotes: state.savedQuotes,
        prebuiltSets: state.prebuiltSets,
        masterItems: state.masterItems
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Media_Faktory_Backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Full JSON database backup downloaded!", "emerald");
    }

    function importFullDatabaseJSON(event) {
      if (!isAdminUser()) return;
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (Array.isArray(data.enquiries)) state.enquiries = data.enquiries;
          if (Array.isArray(data.serviceTickets)) state.serviceTickets = data.serviceTickets;
          if (Array.isArray(data.buildOrders)) state.buildOrders = data.buildOrders;
          if (Array.isArray(data.staffReports)) state.staffReports = data.staffReports;
          if (data.customUsers && typeof data.customUsers === "object") state.customUsers = data.customUsers;
          if (Array.isArray(data.savedQuotes)) state.savedQuotes = data.savedQuotes;
          if (Array.isArray(data.prebuiltSets)) state.prebuiltSets = data.prebuiltSets;
          if (Array.isArray(data.masterItems)) state.masterItems = data.masterItems;
          persistDatabaseToStorage();
          refreshAllViews();
          closeModal("backupModal");
          showToast("Database restored from JSON backup!", "emerald");
        } catch {
          showToast("Invalid JSON backup file.", "amber");
        }
      };
      reader.readAsText(file);
    }
