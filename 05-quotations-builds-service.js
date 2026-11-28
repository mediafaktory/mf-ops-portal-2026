// =========================================================================
    // 9. TAB 3: SAVED QUOTATIONS & CUSTOMER REVISIONS WORKSPACE
    // =========================================================================
    function findLinkedEnquiryForQuote(q) {
      if (!q) return null;
      const pKey = normalizePhoneKey(q.customerPhone);
      if (pKey && pKey.length >= 10) {
        const byPhone = state.enquiries.find(e => normalizePhoneKey(e.phone) === pKey);
        if (byPhone) return byPhone;
      }
      const cName = String(q.customerName || "").trim().toLowerCase();
      if (cName && cName.length >= 3) {
        return state.enquiries.find(e => String(e.customer || "").trim().toLowerCase() === cName) || null;
      }
      return null;
    }

    function bumpQuoteEnquiryFollowUp(enqId, daysOffset) {
      const e = state.enquiries.find(x => x.id === enqId);
      if (!e) return;
      e.nextFollowUp = addDaysIso(daysOffset);
      e.updatedAt = Date.now();
      e.sheetSynced = false;
      persistDatabaseToStorage();
      refreshAllViews();
      syncEnquiryToGoogleSheet(e);
      showToast(`Follow-up updated to ${formatSheetDate(e.nextFollowUp)}`, "emerald");
    }

    function renderQuotationsWorkspace() {
      const container = document.getElementById("quotationsWorkspaceList");
      if (!container) return;

      const todayIso = getTodayIsoLocal();
      const query = (document.getElementById("qtSearchInput")?.value || "").toLowerCase().trim();
      const staffFilterEl = document.getElementById("qtStaffFilter");
      const branchFilter = document.getElementById("qtBranchFilter")?.value || "ALL";
      const sortBy = document.getElementById("qtSortSelect")?.value || "newest";

      const staffSet = new Set(getActiveUsersList().map(u => u.displayName));
      state.savedQuotes.forEach(q => {
        if (q.createdBy && q.createdBy !== "Team") staffSet.add(q.createdBy);
      });

      const currentStaffVal = staffFilterEl ? (staffFilterEl.value || "ALL") : "ALL";
      const myName = currentUser ? currentUser.displayName : (localStorage.getItem(DB_KEYS.OWNER_PREF) || "");
      if (staffFilterEl) {
        staffFilterEl.innerHTML = `<option value="ALL" ${currentStaffVal === "ALL" ? "selected" : ""}>All Staff Members</option>` +
          (myName ? `<option value="${escapeHtml(myName)}" ${currentStaffVal === myName ? "selected" : ""}>My Quotes (${escapeHtml(myName)})</option>` : "") +
          Array.from(staffSet).filter(s => s !== myName).sort().map(s =>
            `<option value="${escapeHtml(s)}" ${currentStaffVal === s ? "selected" : ""}>${escapeHtml(s)}</option>`
          ).join("");
      }
      const selectedStaff = staffFilterEl ? staffFilterEl.value : "ALL";

      const groupsMap = new Map();
      state.savedQuotes.forEach(q => {
        const baseCode = extractBaseQuoteCode(q.refCode || q.id);
        if (!groupsMap.has(baseCode)) {
          groupsMap.set(baseCode, []);
        }
        groupsMap.get(baseCode).push(q);
      });

      let groups = Array.from(groupsMap.entries()).map(([baseCode, versions]) => {
        versions.sort((a, b) => {
          const revDiff = extractRevisionNumber(b.refCode) - extractRevisionNumber(a.refCode);
          if (revDiff !== 0) return revDiff;
          return Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
        });
        return { baseCode, latest: versions[0], versions };
      });

      groups = groups.filter(g => {
        const q = g.latest;
        if (branchFilter !== "ALL" && q.branch !== branchFilter) return false;
        if (selectedStaff !== "ALL") {
          const matchesStaff = g.versions.some(v => String(v.createdBy || "").toLowerCase() === selectedStaff.toLowerCase());
          if (!matchesStaff) return false;
        }
        if (query) {
          const allText = g.versions.map(v => {
            const partsStr = (v.components || []).map(c => c.name).join(" ");
            return `${v.refCode} ${v.customerName} ${v.customerPhone} ${v.title} ${v.createdBy} ${partsStr}`;
          }).join(" ").toLowerCase();
          if (!allText.includes(query)) return false;
        }
        return true;
      });

      groups.sort((a, b) => {
        if (sortBy === "price_desc") return (b.latest.totalFinal || 0) - (a.latest.totalFinal || 0);
        if (sortBy === "price_asc") return (a.latest.totalFinal || 0) - (b.latest.totalFinal || 0);
        return Number(b.latest.updatedAt || 0) - Number(a.latest.updatedAt || 0);
      });

      if (groups.length === 0) {
        container.innerHTML = `
          <div class="bg-[#1e293b] border border-dashed border-[#334155] rounded-2xl p-10 text-center">
            <p class="text-sm font-semibold text-slate-300 mb-1">No saved quotations match your search.</p>
            <p class="text-xs text-slate-400">Build a quote in <strong class="text-emerald-300">2. Quote Generator</strong> and click <strong class="text-emerald-300">Copy for WhatsApp</strong> or <strong class="text-cyan-300">PDF Quote</strong> to save it automatically.</p>
          </div>
        `;
        return;
      }

      const limit = state.visibleLimits.quotations || 30;
      const visibleGroups = groups.slice(0, limit);

      const cardsHtml = visibleGroups.map(g => {
        const latest = g.latest;
        const revCount = g.versions.length;
        const linkedEnq = findLinkedEnquiryForQuote(latest);

        let followUpBadgeHtml = "";
        let quickFollowUpActionsHtml = "";
        if (linkedEnq) {
          const isClosed = linkedEnq.status === "Closed" || linkedEnq.status === "Won / Billed";
          const isOverdue = !isClosed && linkedEnq.nextFollowUp && linkedEnq.nextFollowUp < todayIso;
          const isDueToday = !isClosed && linkedEnq.nextFollowUp && linkedEnq.nextFollowUp === todayIso;

          if (linkedEnq.status === "Won / Billed") {
            followUpBadgeHtml = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">✅ WON / BILLED</span>`;
          } else if (linkedEnq.status === "Closed") {
            followUpBadgeHtml = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">Closed</span>`;
          } else if (isOverdue) {
            followUpBadgeHtml = `<span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/45 animate-pulse">🔴 OVERDUE: ${escapeHtml(formatSheetDate(linkedEnq.nextFollowUp))}</span>`;
          } else if (isDueToday) {
            followUpBadgeHtml = `<span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/45">🟡 DUE TODAY: ${escapeHtml(formatSheetDate(linkedEnq.nextFollowUp))}</span>`;
          } else if (linkedEnq.nextFollowUp) {
            followUpBadgeHtml = `<span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cyan-950/60 text-cyan-200 border border-cyan-500/35">📅 Follow-Up: ${escapeHtml(formatSheetDate(linkedEnq.nextFollowUp))}</span>`;
          }

          if (!isClosed) {
            quickFollowUpActionsHtml = `
              <button type="button" onclick="bumpQuoteEnquiryFollowUp('${linkedEnq.id}', 1)" class="px-2 py-1 rounded-lg text-[10px] font-semibold bg-[#0f172a] hover:bg-slate-800 text-amber-300 border border-[#334155] cursor-pointer" title="Reschedule follow-up to tomorrow">
                📅 +1d
              </button>
              <button type="button" onclick="quickUpdateEnquiryStatus('${linkedEnq.id}', 'Won / Billed')" class="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 cursor-pointer" title="Mark Enquiry Won / Billed">
                ✅ Won
              </button>
            `;
          }
        }

        const versionsHtml = g.versions.map((v, idx) => {
          const revNum = extractRevisionNumber(v.refCode);
          const isLatest = idx === 0;
          const cpu = (v.components || []).find(c => c.category === "Processor")?.name.split("|")[0].trim() || "";
          const gpu = (v.components || []).find(c => c.category === "Graphics Card")?.name.split("|")[0].trim() || "";
          const specSnippet = [cpu, gpu].filter(Boolean).join(" • ") || `${(v.components || []).length} components`;

          const delBtn = hasPermission("canDeleteQuotes")
            ? `<button type="button" onclick="deleteSavedQuote('${v.id}')" class="p-1.5 rounded-lg bg-[#1e293b] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-[#334155] transition cursor-pointer" title="Delete Version">✕</button>`
            : "";

          return `
            <div class="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl ${isLatest ? 'bg-[#0f172a] border border-emerald-500/35' : 'bg-[#0f172a]/60 border border-[#334155]/70'}">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="px-2 py-0.5 rounded-md font-mono text-xs font-extrabold ${revNum > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'}">
                    ${escapeHtml(v.refCode)}
                  </span>
                  ${revNum > 0 ? `<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/30">REV ${revNum}</span>` : `<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-800 text-slate-300">ORIGINAL</span>`}
                  ${isLatest && revCount > 1 ? `<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300">LATEST</span>` : ""}
                  <span class="text-xs font-bold text-white truncate">${escapeHtml(v.title)}</span>
                </div>
                <div class="text-[11px] text-slate-400 mt-1 truncate">
                  <span class="text-emerald-300 font-mono font-extrabold">₹${formatINR(v.totalFinal)}/-</span>
                  • ${escapeHtml(specSnippet)}
                  • ${v.createdBy ? 'By ' + escapeHtml(v.createdBy) + ' • ' : ''}${escapeHtml(v.savedAt || v.quoteDate)}
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                <button type="button" onclick="loadSavedQuoteForRevision('${v.id}')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer" title="Open in Quote Generator to edit and save as next REV">
                  ✏️ Edit / Revise
                </button>
                <button type="button" onclick="copySavedQuoteWhatsApp('${v.id}')" class="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 transition cursor-pointer" title="Copy WhatsApp Quote directly">
                  📲 Copy WA
                </button>
                <button type="button" onclick="createBuildOrderFromSavedId('${v.id}')" class="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-sky-600/25 hover:bg-sky-600/40 text-sky-200 border border-sky-500/40 transition cursor-pointer" title="Confirm PC Order & Track Assembly QC">
                  🛠️ Build &amp; QC
                </button>
                ${delBtn}
              </div>
            </div>
          `;
        }).join("");

        return `
          <div class="perf-card bg-[#1e293b] border border-[#334155] hover:border-slate-500 rounded-2xl p-4 shadow-xl transition">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-[#334155]">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm sm:text-base font-extrabold text-white">${escapeHtml(latest.customerName || "Walk-In / Unnamed Customer")}</span>
                ${latest.customerPhone ? `<span class="text-xs font-mono text-emerald-300 bg-[#0f172a] px-2 py-0.5 rounded-md border border-[#334155]">${escapeHtml(latest.customerPhone)}</span>` : ""}
                ${latest.createdBy ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0f172a] text-cyan-300 border border-[#334155]">👤 By ${escapeHtml(latest.createdBy)}</span>` : ""}
                <span class="text-[11px] text-slate-400">• ${escapeHtml(latest.branch || "Calicut")}</span>
                ${revCount > 1 ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/35">${revCount} Versions</span>` : ""}
                ${followUpBadgeHtml}
              </div>
              <div class="flex flex-wrap items-center gap-1.5">
                ${quickFollowUpActionsHtml}
                <button type="button" onclick="cloneCustomerAsSeparateNewQuote('${latest.id}')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#0f172a] hover:bg-slate-800 text-cyan-300 border border-[#334155] cursor-pointer" title="Create a separate new base quote number for this customer">
                  + New Separate Quote
                </button>
              </div>
            </div>
            <div class="space-y-2">
              ${versionsHtml}
            </div>
          </div>
        `;
      }).join("");

      const moreHtml = groups.length > limit
        ? `<button type="button" onclick="showMoreListItems('quotations', 30)" class="w-full py-2.5 rounded-xl text-xs font-bold bg-[#1e293b] hover:bg-slate-800 text-emerald-300 border border-[#334155] cursor-pointer">Show More Quotations (${groups.length - limit} remaining)</button>`
        : "";

      container.innerHTML = cardsHtml + moreHtml;
    }

    function startBrandNewQuoteFromArchive() {
      const todayIso = getTodayIsoLocal();
      state.editingQuoteBaseCode = null;
      document.getElementById("quoteDateInput").value = todayIso;
      document.getElementById("refCodeInput").value = generateNextRefCode(todayIso);
      document.getElementById("customerNameInput").value = "";
      document.getElementById("customerPhoneInput").value = "";
      updateQuoteModeBadge();
      switchWorkspaceTab("generator");
      showToast("Ready for new quotation!", "emerald");
    }

    function loadSavedQuoteForRevision(id) {
      const item = state.savedQuotes.find(q => q.id === id);
      if (!item) return;

      const baseCode = extractBaseQuoteCode(item.refCode);
      const nextRevCode = getNextRevisionCodeForBase(baseCode);
      state.editingQuoteBaseCode = baseCode;

      document.getElementById("refCodeInput").value = nextRevCode;
      document.getElementById("buildTitleInput").value = item.title || "";
      document.getElementById("docTypeInput").value = item.docType || "Custom PC Build Quotation";
      document.getElementById("useCaseSelect").value = item.useCase || "gaming";
      document.getElementById("branchSelectInput").value = item.branch || "Calicut";
      document.getElementById("customerNameInput").value = item.customerName || "";
      document.getElementById("customerPhoneInput").value = item.customerPhone || "";
      if (item.quoteDate) document.getElementById("quoteDateInput").value = item.quoteDate;
      const valEl = document.getElementById("quoteValidityInput");
      if (valEl) valEl.value = item.quoteValidity || "5 Days";
      document.getElementById("showItemPricesToggle").checked = item.showItemPrices !== false;
      state.highlights = JSON.parse(JSON.stringify(item.highlights || []));
      state.components = JSON.parse(JSON.stringify(item.components || []));

      updateQuoteModeBadge();
      renderHighlightsList();
      renderComponentRows();
      setGlobalMargin(item.globalMargin ?? 26, "pill");
      switchWorkspaceTab("generator");
      showToast(`Loaded ${item.refCode} as ${nextRevCode} for editing!`, "emerald");
    }

    function cloneCustomerAsSeparateNewQuote(id) {
      const item = state.savedQuotes.find(q => q.id === id);
      if (!item) return;
      const todayIso = getTodayIsoLocal();
      state.editingQuoteBaseCode = null;
      document.getElementById("quoteDateInput").value = todayIso;
      document.getElementById("refCodeInput").value = generateNextRefCode(todayIso);
      document.getElementById("buildTitleInput").value = item.title || "";
      document.getElementById("customerNameInput").value = item.customerName || "";
      document.getElementById("customerPhoneInput").value = item.customerPhone || "";
      state.components = JSON.parse(JSON.stringify(item.components || []));
      updateQuoteModeBadge();
      renderComponentRows();
      recalculateAll();
      switchWorkspaceTab("generator");
      showToast(`Cloned build with new quote # ${document.getElementById("refCodeInput").value}`, "emerald");
    }

    function copySavedQuoteWhatsApp(id) {
      const item = state.savedQuotes.find(q => q.id === id);
      if (!item) return;
      const formattedDate = formatReadableDate(item.quoteDate);
      const showPrices = item.showItemPrices !== false;
      const margin = item.globalMargin ?? 26;

      let lines = [];
      lines.push(`*Media Faktory* - *${item.docType || "Custom PC Build Quotation"}*`);
      lines.push("");
      if (item.customerName) lines.push(`*Prepared For:* ${item.customerName}`);
      if (item.refCode) lines.push(`*Ref Code:* ${item.refCode}`);
      lines.push(`*Configuration:* ${item.title}`);
      lines.push("");
      lines.push(`*Date:* ${formattedDate}`);
      lines.push("");
      lines.push(`*System Configuration & Component Details:*`);
      lines.push("");

      (item.components || []).forEach(row => {
        const qty = Math.max(1, parseInt(row.qty) || 1);
        const unitFinal = (row.isNetPrice || margin === 0) ? Math.round(row.basePrice || 0) : Math.round((row.basePrice || 0) * (1 + margin / 100));
        const finalPrice = unitFinal * qty;
        const qtyLabel = qty > 1 ? ` *(Qty: ${qty})*` : "";
        const pricePart = showPrices
          ? (qty > 1 ? ` — *₹${formatINR(unitFinal)} x ${qty} = ₹${formatINR(finalPrice)}/-*` : ` — *₹${formatINR(finalPrice)}/-*`)
          : "";
        lines.push(`• *${row.category}:* ${standardizeAllCapsComponentName(row.name, row.category, false)}${qtyLabel} | *${row.warranty} Warranty*${pricePart}`);
        lines.push("");
      });

      lines.push("---");
      lines.push("");
      lines.push(`*TOTAL PRICE (All Inclusive of Taxes): ₹${formatINR(item.totalFinal)}/-*`);
      lines.push("");
      lines.push("---");
      lines.push("");
      lines.push(`*Warm Regards,*`);
      lines.push(`*Media Faktory*`);
      lines.push(`📍 Calicut | Kochi • 📞 9446242476 | 9446242404`);

      copyTextToClipboard(lines.join("\n"), `Copied ${item.refCode} for WhatsApp!`);
    }

    function deleteSavedQuote(id) {
      if (!hasPermission("canDeleteQuotes")) {
        showToast("You do not have permission to delete saved quotations.", "amber");
        return;
      }
      recordDeletedId(id);
      state.savedQuotes = state.savedQuotes.filter(q => q.id !== id);
      persistDatabaseToStorage();
      refreshAllViews();
      showToast("Quotation removed.", "amber");
    }

    // =========================================================================
    // 10. TAB 7: CUSTOMER BUILD TRACKER & ASSEMBLY QC CHECKLIST
    // =========================================================================
    function createBuildOrderFromQuoteObject(q) {
      if (!q || !Array.isArray(q.components) || q.components.length === 0) return null;

      const existing = state.buildOrders.find(b => b.refCode === q.refCode);
      if (existing) {
        switchWorkspaceTab("builds");
        showToast(`${q.refCode} is already in Build & QC Tracker!`, "amber");
        return existing;
      }

      const nowTs = Date.now();
      const buildOrder = {
        id: "bld_" + nowTs + "_" + Math.random().toString(36).slice(2, 6),
        refCode: q.refCode || generateNextRefCode(getTodayIsoLocal()),
        title: q.title || "Custom PC Build",
        customerName: q.customerName || "Valued Customer",
        customerPhone: q.customerPhone || "",
        branch: q.branch || "Calicut",
        orderDate: getTodayIsoLocal(),
        assignedTech: "Rinoj",
        stage: "Awaiting Parts",
        totalFinal: q.totalFinal || 0,
        notes: "",
        parts: q.components.map(c => ({
          id: uid(),
          category: c.category,
          name: standardizeAllCapsComponentName(c.name, c.category, false),
          qty: c.qty || 1,
          status: "In Stock"
        })),
        qcChecklist: {
          xmpEnabled: false,
          osDriversInstalled: false,
          stressTestPassed: false,
          cableMgmtChecked: false
        },
        updatedAt: nowTs
      };

      state.buildOrders.unshift(buildOrder);
      persistDatabaseToStorage();
      refreshAllViews();
      syncBuildOrderToGoogleSheet(buildOrder);
      switchWorkspaceTab("builds");
      showToast(`🛠️ ${buildOrder.refCode} sent to Build & QC Tracker!`, "emerald");
      return buildOrder;
    }

    function createBuildOrderFromCurrentQuote() {
      const saved = saveQuoteAndSyncAll(false);
      if (!saved) return;
      const latestQuote = state.savedQuotes.find(q => q.refCode === saved.issuedRefCode);
      if (latestQuote) {
        createBuildOrderFromQuoteObject(latestQuote);
      }
    }

    function createBuildOrderFromSavedId(quoteId) {
      const q = state.savedQuotes.find(x => x.id === quoteId);
      if (!q) return;
      createBuildOrderFromQuoteObject(q);
    }

    function updateBuildOrderPartStatus(buildId, partId, newStatus) {
      const b = state.buildOrders.find(x => x.id === buildId);
      if (!b) return;
      const part = (b.parts || []).find(p => p.id === partId);
      if (!part) return;
      part.status = newStatus;
      b.updatedAt = Date.now();

      const allReady = b.parts.every(p => p.status === "In Stock" || p.status === "Arrived at Counter");
      if (allReady && b.stage === "Awaiting Parts") {
        b.stage = "Assembly & Stress-Test QC";
        showToast(`All parts ready for ${b.refCode} → Moved to Assembly & Stress-Test QC!`, "emerald");
      }

      persistDatabaseToStorage();
      refreshAllViews();
      syncBuildOrderToGoogleSheet(b);
    }

    function toggleBuildQcItem(buildId, qcKey, checked) {
      const b = state.buildOrders.find(x => x.id === buildId);
      if (!b) return;
      if (!b.qcChecklist) b.qcChecklist = {};
      b.qcChecklist[qcKey] = checked;
      b.updatedAt = Date.now();

      const allQcDone = QC_CHECKLIST_ITEMS.every(item => Boolean(b.qcChecklist[item.key]));
      if (allQcDone && b.stage !== "Stress-Tested & Ready for Delivery" && b.stage !== "Delivered") {
        b.stage = "Stress-Tested & Ready for Delivery";
        showToast(`✅ All QC checks passed for ${b.refCode} → Ready for Delivery!`, "emerald");
      }

      persistDatabaseToStorage();
      refreshAllViews();
      syncBuildOrderToGoogleSheet(b);
    }

    function updateBuildOrderField(buildId, field, value) {
      const b = state.buildOrders.find(x => x.id === buildId);
      if (!b) return;
      b[field] = value;
      b.updatedAt = Date.now();
      persistDatabaseToStorage();
      refreshAllViews();
      syncBuildOrderToGoogleSheet(b);
    }

    function deleteBuildOrder(buildId) {
      if (!hasPermission("canDeleteEnquiriesService")) {
        showToast("You do not have permission to delete build orders.", "amber");
        return;
      }
      recordDeletedId(buildId);
      state.buildOrders = state.buildOrders.filter(x => x.id !== buildId);
      persistDatabaseToStorage();
      refreshAllViews();
      showToast("Build order removed.", "amber");
    }

    function setBuildTrackerFilter(statusVal) {
      document.getElementById("bldStatusFilter").value = statusVal;
      renderBuildOrders();
    }

    function renderBuildOrders() {
      const container = document.getElementById("buildOrdersContainer");
      if (!container) return;

      let partsCount = 0;
      let assemblyCount = 0;
      let readyCount = 0;
      let activeCount = 0;

      state.buildOrders.forEach(b => {
        if (b.stage !== "Delivered") {
          activeCount++;
          if (b.stage === "Awaiting Parts") partsCount++;
          if (b.stage === "Assembly & Stress-Test QC") assemblyCount++;
          if (b.stage === "Stress-Tested & Ready for Delivery") readyCount++;
        }
      });

      document.getElementById("kpiBldParts").textContent = partsCount;
      document.getElementById("kpiBldAssembly").textContent = assemblyCount;
      document.getElementById("kpiBldReady").textContent = readyCount;
      document.getElementById("kpiBldActive").textContent = activeCount;

      const query = (document.getElementById("bldSearchInput").value || "").toLowerCase().trim();
      const techFilter = document.getElementById("bldTechFilter").value;
      const statusFilter = document.getElementById("bldStatusFilter").value;

      const filtered = state.buildOrders.filter(b => {
        if (statusFilter === "ACTIVE" && b.stage === "Delivered") return false;
        else if (statusFilter !== "ALL" && statusFilter !== "ACTIVE" && b.stage !== statusFilter) return false;

        if (techFilter !== "ALL" && b.assignedTech !== techFilter) return false;

        if (query) {
          const partsText = (b.parts || []).map(p => p.name).join(" ");
          const hay = `${b.refCode} ${b.customerName} ${b.customerPhone} ${b.title} ${b.assignedTech} ${partsText}`.toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      });

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="bg-[#1e293b] border border-dashed border-[#334155] rounded-2xl p-10 text-center">
            <p class="text-sm font-semibold text-slate-300 mb-1">No Custom PC Build Orders match this filter.</p>
            <p class="text-xs text-slate-400">Open <strong class="text-sky-300">2. Quote Generator</strong> or <strong class="text-emerald-300">3. Quotations</strong> and click <strong class="text-sky-300">🛠️ Build &amp; QC</strong> when a customer confirms their PC build.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = filtered.map(b => {
        const parts = b.parts || [];
        const readyParts = parts.filter(p => p.status === "In Stock" || p.status === "Arrived at Counter").length;
        const qc = b.qcChecklist || {};
        const doneQcCount = QC_CHECKLIST_ITEMS.filter(item => Boolean(qc[item.key])).length;

        const stageBadgeClass = b.stage === "Delivered"
          ? "bg-slate-800 text-slate-400 border-slate-700"
          : (b.stage === "Stress-Tested & Ready for Delivery"
            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
            : (b.stage === "Assembly & Stress-Test QC"
              ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
              : "bg-amber-500/20 text-amber-300 border-amber-500/40"));

        const partsRowsHtml = parts.map(p => {
          const pColor = p.status === "Ordered from Distributor"
            ? "text-amber-300 border-amber-500/40"
            : (p.status === "Arrived at Counter" ? "text-cyan-300 border-cyan-500/40" : "text-emerald-300 border-emerald-500/35");

          return `
            <div class="flex items-center justify-between gap-2 py-1.5 border-b border-[#334155]/60 last:border-none text-[11px]">
              <div class="min-w-0 truncate">
                <span class="text-slate-400 font-semibold">${escapeHtml(p.category)}:</span>
                <span class="text-slate-100">${(p.qty || 1) > 1 ? p.qty + "x " : ""}${escapeHtml(p.name)}</span>
              </div>
              <select onchange="updateBuildOrderPartStatus('${b.id}', '${p.id}', this.value)"
                class="bg-[#1e293b] border ${pColor} rounded-lg px-2 py-1 text-[10px] font-bold outline-none shrink-0 cursor-pointer">
                <option value="In Stock" ${p.status === "In Stock" ? "selected" : ""}>✅ In Stock</option>
                <option value="Ordered from Distributor" ${p.status === "Ordered from Distributor" ? "selected" : ""}>📦 Ordered from Distributor</option>
                <option value="Arrived at Counter" ${p.status === "Arrived at Counter" ? "selected" : ""}>🏪 Arrived at Counter</option>
              </select>
            </div>
          `;
        }).join("");

        const qcChecksHtml = QC_CHECKLIST_ITEMS.map(item => {
          const isChecked = Boolean(qc[item.key]);
          return `
            <label class="flex items-center gap-2.5 p-2 rounded-xl bg-[#0f172a] border ${isChecked ? 'border-emerald-500/45 bg-emerald-950/25' : 'border-[#334155]'} cursor-pointer hover:border-slate-500 transition">
              <input type="checkbox" ${isChecked ? "checked" : ""} onchange="toggleBuildQcItem('${b.id}', '${item.key}', this.checked)"
                class="w-4 h-4 accent-emerald-500 rounded cursor-pointer" />
              <span class="text-xs font-medium ${isChecked ? 'text-emerald-200 line-through decoration-emerald-500/50' : 'text-slate-200'}">${escapeHtml(item.label)}</span>
            </label>
          `;
        }).join("");

        const deleteBtn = hasPermission("canDeleteEnquiriesService")
          ? `<button type="button" onclick="deleteBuildOrder('${b.id}')" class="p-1.5 rounded-lg bg-[#0f172a] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-[#334155] cursor-pointer" title="Delete Build Order">✕</button>`
          : "";

        return `
          <div class="bg-[#1e293b] border border-[#334155] hover:border-sky-500/45 rounded-2xl p-4 sm:p-5 shadow-xl transition">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#334155]">
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-mono text-xs font-extrabold border border-sky-500/40">${escapeHtml(b.refCode)}</span>
                <h3 class="text-sm sm:text-base font-bold text-white">${escapeHtml(b.title)}</h3>
                <span class="text-xs text-slate-300">• <strong>${escapeHtml(b.customerName)}</strong> ${b.customerPhone ? `(${escapeHtml(b.customerPhone)})` : ""}</span>
                <span class="text-[11px] text-slate-400">• ${escapeHtml(b.branch)} • ₹${formatINR(b.totalFinal)}/-</span>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <select onchange="updateBuildOrderField('${b.id}', 'assignedTech', this.value)"
                  class="bg-[#0f172a] border border-sky-500/40 rounded-lg px-2.5 py-1 text-xs font-bold text-sky-200 outline-none cursor-pointer">
                  <option value="Rinoj" ${b.assignedTech === "Rinoj" ? "selected" : ""}>Tech: Rinoj (Chief Tech)</option>
                  <option value="Adith" ${b.assignedTech === "Adith" ? "selected" : ""}>Tech: Adith (In-House)</option>
                  <option value="Rijil" ${b.assignedTech === "Rijil" ? "selected" : ""}>Tech: Rijil (Visiting)</option>
                </select>

                <select onchange="updateBuildOrderField('${b.id}', 'stage', this.value)"
                  class="rounded-lg px-2.5 py-1 text-xs font-bold border outline-none cursor-pointer ${stageBadgeClass}">
                  <option value="Awaiting Parts" ${b.stage === "Awaiting Parts" ? "selected" : ""}>🟡 Awaiting Parts</option>
                  <option value="Assembly & Stress-Test QC" ${b.stage === "Assembly & Stress-Test QC" ? "selected" : ""}>🔵 Assembly &amp; Stress-Test QC</option>
                  <option value="Stress-Tested & Ready for Delivery" ${b.stage === "Stress-Tested & Ready for Delivery" ? "selected" : ""}>🟢 Stress-Tested &amp; Ready for Delivery</option>
                  <option value="Delivered" ${b.stage === "Delivered" ? "selected" : ""}>✅ Delivered</option>
                </select>
                ${deleteBtn}
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div class="lg:col-span-7 bg-[#0f172a] border border-[#334155] rounded-xl p-3">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-slate-300">1. Parts Procurement Checklist</span>
                  <span class="text-[11px] font-mono font-bold text-emerald-300">${readyParts} / ${parts.length} Ready</span>
                </div>
                <div>
                  ${partsRowsHtml}
                </div>
              </div>

              <div class="lg:col-span-5 flex flex-col justify-between gap-3">
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-slate-300">2. Assembly &amp; Stress-Test QC Sign-Off</span>
                    <span class="text-[11px] font-mono font-bold text-sky-300">${doneQcCount} / ${QC_CHECKLIST_ITEMS.length} Passed</span>
                  </div>
                  <div class="space-y-2">
                    ${qcChecksHtml}
                  </div>
                </div>

                <div class="pt-2.5 border-t border-[#334155] flex flex-wrap items-center gap-2">
                  <button type="button" onclick="copyBuildMilestoneWhatsApp('${b.id}', 'assembly')"
                    class="flex-1 py-2 px-3 rounded-xl text-[11px] font-bold bg-[#0f172a] hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 transition cursor-pointer">
                    📲 Copy "Parts Arrived — Assembly Started"
                  </button>
                  <button type="button" onclick="copyBuildMilestoneWhatsApp('${b.id}', 'ready')"
                    class="flex-1 py-2 px-3 rounded-xl text-[11px] font-bold bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 transition cursor-pointer">
                    ✅ Copy "Stress-Tested &amp; Ready for Delivery"
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    function copyBuildMilestoneWhatsApp(buildId, milestoneType) {
      const b = state.buildOrders.find(x => x.id === buildId);
      if (!b) return;

      const lines = milestoneType === "assembly"
        ? [
            `*Media Faktory* — *Custom PC Build Update*`,
            ``,
            `Hi *${b.customerName || "Valued Customer"}*,`,
            `Great news! All components for your custom PC (*${b.refCode}* — *${b.title}*) have arrived at our *${b.branch}* counter and assembly has officially started under our technician *${b.assignedTech}*.`,
            ``,
            `We will run full driver installation and thermal stress-testing next and update you as soon as it is ready for delivery!`,
            ``,
            `*Media Faktory* — ${b.branch} • 📞 9446242476 | 9446242404`
          ]
        : [
            `*Media Faktory* — *Your Custom PC is Ready!* 🎉`,
            ``,
            `Hi *${b.customerName || "Valued Customer"}*,`,
            `Your custom PC (*${b.refCode}* — *${b.title}*) has been assembled and passed our complete quality & stress-test checklist:`,
            `✓ XMP / EXPO Memory Profile Enabled`,
            `✓ Windows, Softwares & Drivers Installed`,
            `✓ 30-Min OCCT / FurMark Thermal & Stability Stress Test Passed`,
            `✓ Clean Cable Management Checked`,
            ``,
            `Your system is ready for pickup / delivery from our *${b.branch}* branch!`,
            ``,
            `*Media Faktory* — ${b.branch} • 📞 9446242476 | 9446242404`
          ];

      copyTextToClipboard(lines.join("\n"), `WhatsApp build update copied for ${b.refCode}!`);
    }

    async function syncBuildOrderToGoogleSheet(b) {
      if (!state.sheetSyncUrl || !b) return false;
      const qc = b.qcChecklist || {};
      const qcSummary = QC_CHECKLIST_ITEMS
        .map(item => `${qc[item.key] ? "[✓]" : "[ ]"} ${item.label}`)
        .join(" | ");
      const readyParts = (b.parts || []).filter(p => p.status === "In Stock" || p.status === "Arrived at Counter").length;

      try {
        const res = await fetch(state.sheetSyncUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            secret: state.sheetSyncSecret,
            action: "upsertBuildOrder",
            build: {
              id: b.id,
              refCode: b.refCode,
              orderDate: b.orderDate,
              branch: b.branch,
              customerName: b.customerName,
              customerPhone: b.customerPhone,
              title: b.title,
              assignedTech: b.assignedTech,
              stage: b.stage,
              partsSummary: `${readyParts}/${(b.parts || []).length} Ready`,
              qcSummary,
              totalFinal: b.totalFinal || 0
            }
          })
        });
        const data = await res.json();
        return Boolean(data && data.ok);
      } catch {
        return false;
      }
    }

    // =========================================================================
    // 11. TAB 6: SERVICE, REPAIR & RMA COUNTER LOGIC
    // =========================================================================
    function handleServiceTypeOrWarrantyChange() {
      const srvType = document.getElementById("srvTypeInput").value;
      const warrantyStatus = document.getElementById("srvWarrantyInput").value;
      const assignedSelect = document.getElementById("srvAssignedToInput");
      const autoTag = document.getElementById("srvAutoRouteTag");
      const rmaRow = document.getElementById("srvRmaDocketRow");

      const isWarrantyOrRma = srvType === "RMA / Brand Warranty Claim" ||
        warrantyStatus === "In Warranty (Free)" ||
        warrantyStatus === "Sent for Brand RMA";

      if (warrantyStatus === "Sent for Brand RMA" || srvType === "RMA / Brand Warranty Claim") {
        rmaRow.classList.remove("hidden");
      } else {
        rmaRow.classList.add("hidden");
      }

      if (isWarrantyOrRma) {
        assignedSelect.value = "Athulya";
        autoTag.textContent = "Warranty → Athulya";
        autoTag.classList.remove("hidden");
      } else {
        autoTag.classList.add("hidden");
      }
    }

    function appendServiceAccessory(label) {
      const inp = document.getElementById("srvAccessoriesInput");
      const cur = inp.value.trim();
      if (!cur) {
        inp.value = label;
      } else if (!cur.toLowerCase().includes(label.toLowerCase())) {
        inp.value = `${cur}, ${label}`;
      }
    }

    function checkServiceCustomerHistory(rawPhone) {
      const tag = document.getElementById("srvRepeatCustomerTag");
      const custInput = document.getElementById("srvCustomerInput");
      const pKey = normalizePhoneKey(rawPhone);
      if (!pKey || pKey.length < 10) {
        tag.classList.add("hidden");
        return;
      }
      const pastQuote = state.savedQuotes.find(q => normalizePhoneKey(q.customerPhone) === pKey);
      const pastEnq = state.enquiries.find(e => normalizePhoneKey(e.phone) === pKey);
      const pastSrv = state.serviceTickets.find(s => normalizePhoneKey(s.phone) === pKey);

      if (pastQuote || pastEnq || pastSrv) {
        tag.textContent = pastQuote ? `MF PC Client (${pastQuote.refCode}) ✓` : "Existing MF Client ✓";
        tag.classList.remove("hidden");
        if (!custInput.value.trim()) {
          custInput.value = pastQuote?.customerName || pastEnq?.customer || pastSrv?.customer || "";
        }
      } else {
        tag.classList.add("hidden");
      }
    }

    function resetServiceForm() {
      const editEl = document.getElementById("srvEditId");
      if (!editEl) return;
      editEl.value = "";
      document.getElementById("srvFormTitle").innerHTML = `<span class="w-2 h-2 rounded-full bg-purple-400"></span> New Service / RMA Job Card`;
      document.getElementById("srvTicketPreviewBadge").textContent = generateNextServiceTicketCode();
      document.getElementById("srvSaveBtn").textContent = "+ Save Service / RMA Job Card";
      document.getElementById("srvCancelEditBtn").classList.add("hidden");
      document.getElementById("srvBranchInput").value = "Calicut";
      document.getElementById("srvTypeInput").value = "PC Repair / Diagnostics";
      document.getElementById("srvWarrantyInput").value = "Out of Warranty (Paid)";
      document.getElementById("srvAssignedToInput").value = "Rinoj";
      document.getElementById("srvAutoRouteTag").classList.add("hidden");
      document.getElementById("srvRmaDocketRow").classList.add("hidden");
      document.getElementById("srvRmaDocketInput").value = "";
      document.getElementById("srvPhoneInput").value = "";
      document.getElementById("srvRepeatCustomerTag").classList.add("hidden");
      document.getElementById("srvCustomerInput").value = "";
      document.getElementById("srvCityInput").value = "";
      document.getElementById("srvDeviceInput").value = "";
      document.getElementById("srvSerialInput").value = "";
      document.getElementById("srvAccessoriesInput").value = "";
      document.getElementById("srvIssueInput").value = "";
      document.getElementById("srvDiagnosisInput").value = "";
      document.getElementById("srvStatusInput").value = "Received / In Queue";
      document.getElementById("srvDueDateInput").value = addDaysIso(2);
      document.getElementById("srvChargeInput").value = "0";
      document.getElementById("srvAdvanceInput").value = "0";
      document.getElementById("srvPaymentInput").value = "Unpaid";
    }

    function saveServiceTicket() {
      const editId = document.getElementById("srvEditId").value;
      const branch = document.getElementById("srvBranchInput").value;
      const serviceType = document.getElementById("srvTypeInput").value;
      const warrantyStatus = document.getElementById("srvWarrantyInput").value;
      const assignedTo = document.getElementById("srvAssignedToInput").value;
      const rmaDocket = document.getElementById("srvRmaDocketInput").value.trim();
      const phone = document.getElementById("srvPhoneInput").value.trim();
      const customer = document.getElementById("srvCustomerInput").value.trim();
      const city = document.getElementById("srvCityInput").value.trim();
      const device = document.getElementById("srvDeviceInput").value.trim();
      const serialNumber = document.getElementById("srvSerialInput").value.trim();
      const accessories = document.getElementById("srvAccessoriesInput").value.trim();
      const issue = document.getElementById("srvIssueInput").value.trim();
      const diagnosis = document.getElementById("srvDiagnosisInput").value.trim();
      const status = document.getElementById("srvStatusInput").value;
      const dueDate = document.getElementById("srvDueDateInput").value;
      const chargeAmount = Math.max(0, parseFloat(document.getElementById("srvChargeInput").value) || 0);
      const advancePaid = Math.max(0, parseFloat(document.getElementById("srvAdvanceInput").value) || 0);
      const paymentStatus = document.getElementById("srvPaymentInput").value;

      if (!phone && !customer) {
        showToast("Enter Customer Name or Phone Number!", "amber");
        return;
      }
      if (!device || !issue) {
        showToast("Enter Device Model and Reported Issue!", "amber");
        return;
      }

      const nowTs = Date.now();
      let savedTicket = null;

      if (editId) {
        const existing = state.serviceTickets.find(t => t.id === editId);
        if (existing) {
          existing.branch = branch;
          existing.serviceType = serviceType;
          existing.warrantyStatus = warrantyStatus;
          existing.assignedTo = assignedTo;
          existing.rmaDocket = rmaDocket;
          existing.phone = phone;
          existing.customer = customer;
          existing.city = city;
          existing.device = device;
          existing.serialNumber = serialNumber;
          existing.accessories = accessories;
          existing.issue = issue;
          existing.diagnosis = diagnosis;
          existing.status = status;
          existing.dueDate = dueDate;
          existing.chargeAmount = chargeAmount;
          existing.advancePaid = advancePaid;
          existing.paymentStatus = paymentStatus;
          existing.updatedAt = nowTs;
          existing.sheetSynced = false;
          savedTicket = existing;
        }
      } else {
        savedTicket = {
          id: "srv_" + nowTs + "_" + Math.random().toString(36).slice(2, 6),
          ticketCode: generateNextServiceTicketCode(),
          intakeDate: getTodayIsoLocal(),
          loggedBy: currentUser ? currentUser.displayName : "Counter",
          branch,
          serviceType,
          warrantyStatus,
          assignedTo,
          rmaDocket,
          phone,
          customer,
          city,
          device,
          serialNumber,
          accessories,
          issue,
          diagnosis,
          status,
          dueDate,
          chargeAmount,
          advancePaid,
          paymentStatus,
          updatedAt: nowTs,
          sheetSynced: false
        };
        state.serviceTickets.unshift(savedTicket);
      }

      persistDatabaseToStorage();
      refreshAllViews();
      resetServiceForm();

      if (savedTicket) {
        syncServiceTicketToGoogleSheet(savedTicket);
        showToast(`${savedTicket.ticketCode} assigned to ${savedTicket.assignedTo} (${TECH_ROLE_LABELS[savedTicket.assignedTo] || ""})!`, "emerald");
      }
    }

    function editServiceTicket(ticketId) {
      const t = state.serviceTickets.find(x => x.id === ticketId);
      if (!t) return;
      document.getElementById("srvEditId").value = t.id;
      document.getElementById("srvFormTitle").innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> Update Job Card`;
      document.getElementById("srvTicketPreviewBadge").textContent = t.ticketCode;
      document.getElementById("srvSaveBtn").textContent = "Save Job Card Updates";
      document.getElementById("srvCancelEditBtn").classList.remove("hidden");

      document.getElementById("srvBranchInput").value = t.branch || "Calicut";
      document.getElementById("srvTypeInput").value = t.serviceType || "PC Repair / Diagnostics";
      document.getElementById("srvWarrantyInput").value = t.warrantyStatus || "Out of Warranty (Paid)";
      document.getElementById("srvAssignedToInput").value = t.assignedTo || "Rinoj";
      document.getElementById("srvRmaDocketInput").value = t.rmaDocket || "";
      if (t.rmaDocket || t.warrantyStatus !== "Out of Warranty (Paid)") {
        document.getElementById("srvRmaDocketRow").classList.remove("hidden");
      } else {
        document.getElementById("srvRmaDocketRow").classList.add("hidden");
      }
      document.getElementById("srvPhoneInput").value = t.phone || "";
      document.getElementById("srvCustomerInput").value = t.customer || "";
      document.getElementById("srvCityInput").value = t.city || "";
      document.getElementById("srvDeviceInput").value = t.device || "";
      document.getElementById("srvSerialInput").value = t.serialNumber || "";
      document.getElementById("srvAccessoriesInput").value = t.accessories || "";
      document.getElementById("srvIssueInput").value = t.issue || "";
      document.getElementById("srvDiagnosisInput").value = t.diagnosis || "";
      document.getElementById("srvStatusInput").value = t.status || "Received / In Queue";
      document.getElementById("srvDueDateInput").value = t.dueDate || "";
      document.getElementById("srvChargeInput").value = t.chargeAmount || 0;
      document.getElementById("srvAdvanceInput").value = t.advancePaid || 0;
      document.getElementById("srvPaymentInput").value = t.paymentStatus || "Unpaid";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function quickUpdateServiceStatus(ticketId, newStatus) {
      const t = state.serviceTickets.find(x => x.id === ticketId);
      if (!t) return;
      t.status = newStatus;
      t.updatedAt = Date.now();
      t.sheetSynced = false;
      persistDatabaseToStorage();
      refreshAllViews();
      syncServiceTicketToGoogleSheet(t);
      showToast(`${t.ticketCode} marked as ${newStatus}`, "emerald");
    }

    function deleteServiceTicket(ticketId) {
      if (!hasPermission("canDeleteEnquiriesService")) {
        showToast("You do not have permission to delete service job cards.", "amber");
        return;
      }
      recordDeletedId(ticketId);
      state.serviceTickets = state.serviceTickets.filter(x => x.id !== ticketId);
      persistDatabaseToStorage();
      refreshAllViews();
      showToast("Service ticket removed.", "amber");
    }

    function setServiceQuickFilter(statusVal) {
      document.getElementById("srvTechFilter").value = "ALL";
      document.getElementById("srvStatusFilter").value = statusVal;
      renderServiceTickets();
    }

    function setServiceTechFilter(techName) {
      document.getElementById("srvTechFilter").value = techName;
      document.getElementById("srvStatusFilter").value = "ACTIVE";
      renderServiceTickets();
    }

    function renderServiceTickets() {
      const container = document.getElementById("serviceTicketsContainer");
      if (!container) return;

      let activeCount = 0;
      let readyCount = 0;
      let rinojCount = 0;
      let adithCount = 0;
      let rijilCount = 0;
      let athulyaCount = 0;

      state.serviceTickets.forEach(t => {
        const isDone = t.status === "Delivered / Closed";
        if (!isDone) {
          activeCount++;
          if (t.assignedTo === "Rinoj") rinojCount++;
          if (t.assignedTo === "Adith") adithCount++;
          if (t.assignedTo === "Rijil") rijilCount++;
          if (t.assignedTo === "Athulya") athulyaCount++;
        }
        if (t.status === "Ready for Pickup") readyCount++;
      });

      document.getElementById("kpiSrvActive").textContent = activeCount;
      document.getElementById("kpiSrvReady").textContent = readyCount;
      document.getElementById("kpiSrvRinoj").textContent = rinojCount;
      document.getElementById("kpiSrvAdith").textContent = adithCount;
      document.getElementById("kpiSrvRijil").textContent = rijilCount;
      document.getElementById("kpiSrvAthulya").textContent = athulyaCount;

      const query = (document.getElementById("srvSearchInput").value || "").toLowerCase().trim();
      const techFilter = document.getElementById("srvTechFilter").value;
      const statusFilter = document.getElementById("srvStatusFilter").value;

      const filtered = state.serviceTickets.filter(t => {
        const isDone = t.status === "Delivered / Closed";
        if (statusFilter === "ACTIVE" && isDone) return false;
        else if (statusFilter !== "ALL" && statusFilter !== "ACTIVE" && t.status !== statusFilter) return false;

        if (techFilter !== "ALL" && t.assignedTo !== techFilter) return false;

        if (query) {
          const hay = `${t.ticketCode} ${t.customer} ${t.phone} ${t.device} ${t.serialNumber} ${t.issue} ${t.diagnosis} ${t.assignedTo} ${t.rmaDocket}`.toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      });

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="bg-[#1e293b] border border-dashed border-[#334155] rounded-2xl p-10 text-center">
            <p class="text-sm font-semibold text-slate-300 mb-1">No Service or RMA job cards match this filter.</p>
            <p class="text-xs text-slate-400">Log a repair, on-site visit, or warranty RMA claim using the form on the left.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = filtered.map(t => {
        const balance = Math.max(0, (Number(t.chargeAmount) || 0) - (Number(t.advancePaid) || 0));
        const isWarranty = t.warrantyStatus !== "Out of Warranty (Paid)";

        const statusBadgeClass = t.status === "Delivered / Closed"
          ? "bg-slate-800 text-slate-400 border-slate-700"
          : (t.status === "Ready for Pickup"
            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
            : (t.status === "Sent for RMA / Waiting Parts"
              ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
              : (t.status === "Diagnosing / Under Repair"
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                : "bg-amber-500/20 text-amber-300 border-amber-500/40")));

        const deleteBtn = hasPermission("canDeleteEnquiriesService")
          ? `<button type="button" onclick="deleteServiceTicket('${t.id}')" class="p-1.5 rounded-lg bg-[#0f172a] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-[#334155] cursor-pointer" title="Delete Job Card">✕</button>`
          : "";

        return `
          <div class="perf-card bg-[#1e293b] border border-[#334155] hover:border-purple-500/40 rounded-2xl p-4 shadow-lg transition">
            <div class="flex flex-wrap items-start justify-between gap-2 mb-2">
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-mono text-xs font-extrabold border border-purple-500/40">${escapeHtml(t.ticketCode)}</span>
                <span class="text-sm font-bold text-white">${escapeHtml(t.customer || "Customer")}</span>
                ${t.phone ? `<span class="text-xs font-mono text-emerald-300 bg-[#0f172a] px-2 py-0.5 rounded-md border border-[#334155]">${escapeHtml(t.phone)}</span>` : ""}
                <span class="text-[11px] text-slate-400">• ${escapeHtml(t.branch)}</span>
              </div>
              <span class="px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${statusBadgeClass}">${escapeHtml(t.status)}</span>
            </div>

            <div class="flex flex-wrap items-center gap-1.5 mb-2.5 text-[11px]">
              <span class="px-2 py-0.5 rounded-md bg-[#0f172a] text-white font-semibold border border-[#334155]">🖥️ ${escapeHtml(t.device)}</span>
              ${t.serialNumber ? `<span class="px-2 py-0.5 rounded-md bg-[#0f172a] text-slate-300 font-mono border border-[#334155]">S/N: ${escapeHtml(t.serialNumber)}</span>` : ""}
              <span class="px-2 py-0.5 rounded-md ${isWarranty ? 'bg-purple-950/60 text-purple-300 border-purple-500/40' : 'bg-cyan-950/60 text-cyan-200 border-cyan-500/35'} font-bold border">
                👤 Assigned: ${escapeHtml(t.assignedTo)} (${escapeHtml(TECH_ROLE_LABELS[t.assignedTo] || "")})
              </span>
              ${t.rmaDocket ? `<span class="px-2 py-0.5 rounded-md bg-amber-950/50 text-amber-300 font-mono border border-amber-500/35">RMA #: ${escapeHtml(t.rmaDocket)}</span>` : ""}
            </div>

            <div class="bg-[#0f172a] border border-[#334155] rounded-xl p-2.5 text-xs space-y-1 mb-3">
              <div><span class="text-slate-400 font-semibold">Issue:</span> <span class="text-slate-100">${escapeHtml(t.issue)}</span></div>
              ${t.diagnosis ? `<div><span class="text-emerald-400 font-semibold">Diagnosis / Action:</span> <span class="text-slate-200">${escapeHtml(t.diagnosis)}</span></div>` : ""}
              <div class="flex flex-wrap items-center justify-between gap-2 pt-1.5 mt-1 border-t border-[#334155]/70 text-[11px] text-slate-400">
                <span>Accessories: <strong class="text-slate-200">${escapeHtml(t.accessories || "None")}</strong></span>
                <span class="font-mono">
                  Charge: <strong class="text-white">₹${formatINR(t.chargeAmount)}</strong> |
                  Adv: <strong class="text-emerald-300">₹${formatINR(t.advancePaid)}</strong> |
                  Bal: <strong class="text-amber-300">₹${formatINR(balance)}</strong> (${escapeHtml(t.paymentStatus)})
                </span>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#334155]">
              <div class="flex flex-wrap items-center gap-1.5">
                <button type="button" onclick="editServiceTicket('${t.id}')" class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#0f172a] hover:bg-slate-800 text-slate-200 border border-[#334155] cursor-pointer">
                  ✏️ Edit / Update
                </button>
                <button type="button" onclick="copyServiceWhatsApp('${t.id}')" class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 cursor-pointer">
                  📲 WhatsApp Update
                </button>
                <button type="button" onclick="printServiceJobCard('${t.id}')" class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer">
                  🖨️ Job Card PDF
                </button>
                <button type="button" onclick="convertServiceToUpgradeQuote('${t.id}')" class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 cursor-pointer">
                  🧾 Upgrade Quote
                </button>
                ${t.status !== "Ready for Pickup" && t.status !== "Delivered / Closed" ? `<button type="button" onclick="quickUpdateServiceStatus('${t.id}', 'Ready for Pickup')" class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">🟢 Mark Ready</button>` : ""}
                ${t.status !== "Delivered / Closed" ? `<button type="button" onclick="quickUpdateServiceStatus('${t.id}', 'Delivered / Closed')" class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/35 cursor-pointer">✅ Delivered</button>` : ""}
              </div>
              ${deleteBtn}
            </div>
          </div>
        `;
      }).join("");
    }

    function copyServiceWhatsApp(ticketId) {
      const t = state.serviceTickets.find(x => x.id === ticketId);
      if (!t) return;
      const balance = Math.max(0, (Number(t.chargeAmount) || 0) - (Number(t.advancePaid) || 0));
      const isReady = t.status === "Ready for Pickup";

      const lines = [
        `*Media Faktory* — *Service & RMA Desk*`,
        ``,
        `*Job Card #:* ${t.ticketCode}`,
        `*Customer:* ${t.customer || "Valued Customer"}`,
        `*Device:* ${t.device}${t.serialNumber ? ` (S/N: ${t.serialNumber})` : ""}`,
        `*Assigned Specialist:* ${t.assignedTo} (${TECH_ROLE_LABELS[t.assignedTo] || "Technician"})`,
        `*Current Status:* *${t.status}*`,
        t.rmaDocket ? `*RMA Docket #:* ${t.rmaDocket}` : null,
        t.diagnosis ? `*Service Note:* ${t.diagnosis}` : `*Reported Issue:* ${t.issue}`,
        ``,
        isReady
          ? `✅ *Your system is ready for collection at our ${t.branch} counter!*`
          : `*Expected Delivery / Update:* ${formatReadableDate(t.dueDate) || "Will update shortly"}`,
        t.chargeAmount > 0 ? `*Service / Parts Total:* ₹${formatINR(t.chargeAmount)}/- | *Balance Payable:* ₹${formatINR(balance)}/-` : null,
        ``,
        `*Media Faktory* — ${t.branch} • 📞 9446242476 | 9446242404`
      ].filter(Boolean);

      copyTextToClipboard(lines.join("\n"), `WhatsApp service update copied for ${t.ticketCode}!`);
    }

    function convertServiceToUpgradeQuote(ticketId) {
      const t = state.serviceTickets.find(x => x.id === ticketId);
      if (!t) return;
      state.editingQuoteBaseCode = null;
      document.getElementById("refCodeInput").value = generateNextRefCode(getTodayIsoLocal());
      document.getElementById("customerNameInput").value = t.customer || "";
      document.getElementById("customerPhoneInput").value = t.phone || "";
      document.getElementById("branchSelectInput").value = t.branch || "Calicut";
      document.getElementById("buildTitleInput").value = `PC Upgrade / Replacement (${t.device})`;
      updateQuoteModeBadge();
      switchWorkspaceTab("generator");
      showToast(`Pre-filled Quote Generator for ${t.customer || t.ticketCode}!`, "emerald");
    }

    function printServiceJobCard(ticketId) {
      const t = state.serviceTickets.find(x => x.id === ticketId);
      if (!t) return;
      const balance = Math.max(0, (Number(t.chargeAmount) || 0) - (Number(t.advancePaid) || 0));
      const win = window.open("", "_blank");
      if (!win) {
        showToast("Allow pop-ups to print Service Job Card.", "amber");
        return;
      }
      win.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>${escapeHtml(t.ticketCode)}_Service_Job_Card</title>
          <style>
            body { font-family: 'Inter', -apple-system, sans-serif; color: #0f172a; padding: 28px; margin: 0; }
            .hdr { display: flex; justify-content: space-between; border-bottom: 3px solid #7e22ce; padding-bottom: 14px; margin-bottom: 18px; }
            .badge { background: #7e22ce; color: #fff; font-family: monospace; font-weight: 800; padding: 6px 12px; border-radius: 6px; font-size: 14px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; font-size: 12.5px; }
            .box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
            .lbl { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 3px; }
            table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 18px; }
            th, td { border: 1px solid #cbd5e1; padding: 9px 12px; text-align: left; }
            th { background: #f1f5f9; width: 180px; }
            .signs { display: flex; justify-content: space-between; margin-top: 48px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="hdr">
            <div>
              <h2 style="margin:0;">Media Faktory — Service &amp; RMA Job Card</h2>
              <p style="margin:4px 0 0; font-size:12px; color:#475569;">${escapeHtml(t.branch)} Branch • 📞 9446242476 / 9446242404 • GSTIN: 32CWPPA4910C1Z3</p>
            </div>
            <div style="text-align:right;">
              <div class="badge">${escapeHtml(t.ticketCode)}</div>
              <p style="margin:6px 0 0; font-size:12px;">Intake Date: <strong>${escapeHtml(formatReadableDate(t.intakeDate))}</strong></p>
            </div>
          </div>

          <div class="grid">
            <div class="box">
              <div class="lbl">Customer Details</div>
              <strong>${escapeHtml(t.customer || "Customer")}</strong><br/>
              Phone: ${escapeHtml(t.phone || "—")}<br/>
              Location: ${escapeHtml(t.city || t.branch)}
            </div>
            <div class="box">
              <div class="lbl">Assigned Responsibility</div>
              <strong>${escapeHtml(t.assignedTo)} (${escapeHtml(TECH_ROLE_LABELS[t.assignedTo] || "")})</strong><br/>
              Service Type: ${escapeHtml(t.serviceType)}<br/>
              Warranty: ${escapeHtml(t.warrantyStatus)}${t.rmaDocket ? ` • RMA #: ${escapeHtml(t.rmaDocket)}` : ""}
            </div>
          </div>

          <table>
            <tr><th>Device / Model</th><td><strong>${escapeHtml(t.device)}</strong></td></tr>
            <tr><th>Serial Number (S/N)</th><td style="font-family:monospace;">${escapeHtml(t.serialNumber || "Not Recorded")}</td></tr>
            <tr><th>Accessories Received</th><td>${escapeHtml(t.accessories || "None")}</td></tr>
            <tr><th>Reported Issue</th><td>${escapeHtml(t.issue)}</td></tr>
            <tr><th>Diagnosis / Action</th><td>${escapeHtml(t.diagnosis || "Pending Technician Inspection")}</td></tr>
            <tr><th>Current Status</th><td><strong>${escapeHtml(t.status)}</strong> (Expected: ${escapeHtml(formatReadableDate(t.dueDate) || "TBD")})</td></tr>
            <tr><th>Charges &amp; Balance</th><td>Estimated/Final: <strong>₹${formatINR(t.chargeAmount)}/-</strong> | Advance Paid: <strong>₹${formatINR(t.advancePaid)}/-</strong> | Balance Due: <strong>₹${formatINR(balance)}/-</strong> (${escapeHtml(t.paymentStatus)})</td></tr>
          </table>

          <p style="font-size:10.5px; color:#475569;"><strong>Service Terms:</strong> Media Faktory is not responsible for customer data loss during hardware/OS diagnostics; please maintain a complete backup prior to service. Brand warranty/RMA turnaround depends on manufacturer service center policies.</p>

          <div class="signs">
            <div>___________________________<br/>Customer Signature</div>
            <div style="text-align:right;">___________________________<br/>Media Faktory Counter (${escapeHtml(t.loggedBy || "Staff")})</div>
          </div>
          <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };<\/script>
        </body>
        </html>
      `);
      win.document.close();
    }

    async function syncServiceTicketToGoogleSheet(ticket) {
      if (!state.sheetSyncUrl || !ticket) return false;
      try {
        const res = await fetch(state.sheetSyncUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            secret: state.sheetSyncSecret,
            action: "upsertServiceTicket",
            ticket: {
              ...ticket,
              assignedRole: TECH_ROLE_LABELS[ticket.assignedTo] || ""
            }
          })
        });
        const data = await res.json();
        if (data && data.ok) {
          ticket.sheetSynced = true;
          saveLocalOnly();
          return true;
        }
      } catch {
        // Silent fallback
      }
      return false;
    }
