// =========================================================================
    // 8B. STAFF DAILY, WEEKLY & MONTHLY REPORTING PLATFORM
    // =========================================================================
    function setReportFrequency(freq) {
      state.reportFreq = freq;
      document.querySelectorAll(".rep-freq-btn").forEach(btn => {
        btn.className = "rep-freq-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer";
      });
      const activeBtn = document.getElementById(`repFreqBtn_${freq}`);
      if (activeBtn) {
        activeBtn.className = "rep-freq-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white shadow transition cursor-pointer";
      }

      const dateInp = document.getElementById("repDateInput");
      const monthInp = document.getElementById("repMonthInput");
      const dateLbl = document.getElementById("repDateFieldLabel");
      const attRow = document.getElementById("repAttendanceRow");
      const formTitle = document.getElementById("repFormHeaderTitle");
      const hlLbl = document.getElementById("repHighlightsLabel");
      const blkLbl = document.getElementById("repBlockersLabel");

      if (freq === "daily") {
        dateLbl.textContent = "Report Date";
        dateInp.classList.remove("hidden");
        monthInp.classList.add("hidden");
        if (!dateInp.value) dateInp.value = getTodayIsoLocal();
        formTitle.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-400"></span> Daily Operations Report`;
        hlLbl.textContent = "Key Highlights & Wins Today";
        blkLbl.textContent = "Stock Needed / Tomorrow's Priority Follow-Ups";
      } else if (freq === "weekly") {
        dateLbl.textContent = "Week Reference Date (Any day in week)";
        dateInp.classList.remove("hidden");
        monthInp.classList.add("hidden");
        if (!dateInp.value) dateInp.value = getTodayIsoLocal();
        formTitle.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> Weekly Summary Report (Auto-Aggregated)`;
        hlLbl.textContent = "Biggest Win & Highlight of This Week";
        blkLbl.textContent = "Fast-Moving / Out-of-Stock Items & Next Week Plan";
      } else {
        dateLbl.textContent = "Report Month";
        dateInp.classList.add("hidden");
        monthInp.classList.remove("hidden");
        if (!monthInp.value) monthInp.value = getTodayIsoLocal().slice(0, 7);
        formTitle.innerHTML = `<span class="w-2 h-2 rounded-full bg-cyan-400"></span> Monthly Performance Summary`;
        hlLbl.textContent = "Top Performing Category & Key Monthly Achievement";
        blkLbl.textContent = "Key Bottlenecks & Target Plan for Next Month";
      }

      updateReportPeriodBadge();
      autoFillReportFromSuite(true);
    }

    function getActiveReportPeriodKey() {
      if (state.reportFreq === "monthly") {
        return document.getElementById("repMonthInput").value || getTodayIsoLocal().slice(0, 7);
      }
      const d = document.getElementById("repDateInput").value || getTodayIsoLocal();
      if (state.reportFreq === "weekly") {
        return getISOWeekMeta(d).weekKey;
      }
      return d;
    }

    function updateReportPeriodBadge() {
      const badge = document.getElementById("repPeriodBadge");
      if (!badge) return;
      const key = getActiveReportPeriodKey();
      badge.textContent = state.reportFreq === "daily"
        ? formatSheetDate(key)
        : (state.reportFreq === "weekly" ? `${key} (Weekly)` : `${key} (Monthly)`);
    }

    function onReportStaffOrPeriodChanged() {
      updateReportPeriodBadge();
      applyReportModuleVisibility();
      autoFillReportFromSuite(true);
    }

    function applyReportModuleVisibility() {
      const selectedStaffName = document.getElementById("repStaffSelect")?.value || (currentUser ? currentUser.displayName : "");
      const matchedUser = getActiveUsersList().find(u => u.displayName === selectedStaffName);
      let scope = matchedUser ? (matchedUser.reportScope || "SALES") : "SALES";

      if (isAdminUser()) {
        const overrideVal = document.getElementById("repModuleOverrideSelect")?.value || "ALL";
        scope = overrideVal;
      }

      const subEl = document.getElementById("repRoleScopeSubtitle");
      if (subEl) {
        subEl.textContent = `Active Modules for ${selectedStaffName}: ${REPORT_SCOPE_LABELS[scope] || scope}`;
      }

      const salesBox = document.getElementById("repModule_sales");
      const serviceBox = document.getElementById("repModule_service");
      const accountsBox = document.getElementById("repModule_accounts");

      const showSales = scope === "ALL" || scope === "SALES" || scope === "SALES_SERVICE";
      const showService = scope === "ALL" || scope === "SERVICE" || scope === "SALES_SERVICE";
      const showAccounts = scope === "ALL" || scope === "ACCOUNTS";

      if (salesBox) salesBox.classList.toggle("hidden", !showSales);
      if (serviceBox) serviceBox.classList.toggle("hidden", !showService);
      if (accountsBox) accountsBox.classList.toggle("hidden", !showAccounts);
    }

    function autoFillReportFromSuite(silent = false) {
      const staffName = document.getElementById("repStaffSelect")?.value || (currentUser ? currentUser.displayName : "");
      const freq = state.reportFreq;
      const periodKey = getActiveReportPeriodKey();

      const matchesDatePeriod = (isoStr) => {
        if (!isoStr) return false;
        if (freq === "daily") return isoStr === periodKey;
        if (freq === "weekly") return getISOWeekMeta(isoStr).weekKey === periodKey;
        if (freq === "monthly") return isoStr.slice(0, 7) === periodKey;
        return false;
      };

      // Check if an existing report for this staff + freq + period exists
      const existingRep = state.staffReports.find(r =>
        r.staffName === staffName && r.frequency === freq && r.periodKey === periodKey
      );

      if (existingRep) {
        document.getElementById("repEditId").value = existingRep.id;
        document.getElementById("repSalesEnquiries").value = existingRep.sales?.enquiries ?? 0;
        document.getElementById("repSalesFollowups").value = existingRep.sales?.followups ?? 0;
        document.getElementById("repSalesQuotesCount").value = existingRep.sales?.quotesCount ?? 0;
        document.getElementById("repSalesWonCount").value = existingRep.sales?.wonCount ?? 0;
        document.getElementById("repSalesQuotedVal").value = existingRep.sales?.quotedVal ?? 0;
        document.getElementById("repSalesWonVal").value = existingRep.sales?.wonVal ?? 0;
        document.getElementById("repSalesNotes").value = existingRep.sales?.notes || "";

        document.getElementById("repSrvCompleted").value = existingRep.service?.completed ?? 0;
        document.getElementById("repSrvBuildsQc").value = existingRep.service?.buildsQc ?? 0;
        document.getElementById("repSrvOnsite").value = existingRep.service?.onsite ?? 0;
        document.getElementById("repSrvPending").value = existingRep.service?.pending ?? 0;
        document.getElementById("repSrvCollected").value = existingRep.service?.collected ?? 0;
        document.getElementById("repSrvNotes").value = existingRep.service?.notes || "";

        document.getElementById("repAccInvoicesCount").value = existingRep.accounts?.invoicesCount ?? 0;
        document.getElementById("repAccBilledTotal").value = existingRep.accounts?.billedTotal ?? 0;
        document.getElementById("repAccAccessoriesSales").value = existingRep.accounts?.accessoriesSales ?? 0;
        document.getElementById("repAccUpi").value = existingRep.accounts?.upi ?? 0;
        document.getElementById("repAccCash").value = existingRep.accounts?.cash ?? 0;
        document.getElementById("repAccBank").value = existingRep.accounts?.bank ?? 0;
        document.getElementById("repAccPendingDue").value = existingRep.accounts?.pendingDue ?? 0;
        document.getElementById("repAccNotes").value = existingRep.accounts?.notes || "";

        document.getElementById("repHighlightsInput").value = existingRep.highlights || "";
        document.getElementById("repBlockersInput").value = existingRep.blockers || "";
        if (!silent) showToast(`Loaded existing ${freq} report for ${staffName}!`, "emerald");
        return;
      }

      document.getElementById("repEditId").value = "";

      // For Weekly or Monthly, first aggregate submitted Daily Reports for that staff & period
      const matchingDailyReports = freq !== "daily"
        ? state.staffReports.filter(r => r.staffName === staffName && r.frequency === "daily" && matchesDatePeriod(r.periodKey))
        : [];

      if (matchingDailyReports.length > 0) {
        const sumField = (section, key) => matchingDailyReports.reduce((s, r) => s + (Number(r[section]?.[key]) || 0), 0);
        document.getElementById("repSalesEnquiries").value = sumField("sales", "enquiries");
        document.getElementById("repSalesFollowups").value = sumField("sales", "followups");
        document.getElementById("repSalesQuotesCount").value = sumField("sales", "quotesCount");
        document.getElementById("repSalesWonCount").value = sumField("sales", "wonCount");
        document.getElementById("repSalesQuotedVal").value = sumField("sales", "quotedVal");
        document.getElementById("repSalesWonVal").value = sumField("sales", "wonVal");

        document.getElementById("repSrvCompleted").value = sumField("service", "completed");
        document.getElementById("repSrvBuildsQc").value = sumField("service", "buildsQc");
        document.getElementById("repSrvOnsite").value = sumField("service", "onsite");
        document.getElementById("repSrvCollected").value = sumField("service", "collected");

        document.getElementById("repAccInvoicesCount").value = sumField("accounts", "invoicesCount");
        document.getElementById("repAccBilledTotal").value = sumField("accounts", "billedTotal");
        document.getElementById("repAccAccessoriesSales").value = sumField("accounts", "accessoriesSales");
        document.getElementById("repAccUpi").value = sumField("accounts", "upi");
        document.getElementById("repAccCash").value = sumField("accounts", "cash");
        document.getElementById("repAccBank").value = sumField("accounts", "bank");

        if (!silent) showToast(`Aggregated ${matchingDailyReports.length} daily report(s) into ${freq} summary!`, "emerald");
        return;
      }

      // Otherwise pull directly from live suite records
      const staffEnqs = state.enquiries.filter(e =>
        String(e.owner || "").toLowerCase() === staffName.toLowerCase() && matchesDatePeriod(e.dateIso)
      );
      const staffQuotes = state.savedQuotes.filter(q =>
        String(q.createdBy || "").toLowerCase() === staffName.toLowerCase() && matchesDatePeriod(q.quoteDate)
      );
      const wonEnqs = staffEnqs.filter(e => e.status === "Won / Billed");
      const quotedVal = staffQuotes.reduce((s, q) => s + (Number(q.totalFinal) || 0), 0);

      const staffSrvs = state.serviceTickets.filter(t =>
        String(t.assignedTo || "").toLowerCase() === staffName.toLowerCase() && matchesDatePeriod(t.intakeDate)
      );
      const completedSrvs = staffSrvs.filter(t => t.status === "Delivered / Closed" || t.status === "Ready for Pickup");
      const onsiteSrvs = staffSrvs.filter(t => t.serviceType === "On-Site / Visiting Service");
      const pendingSrvs = state.serviceTickets.filter(t =>
        String(t.assignedTo || "").toLowerCase() === staffName.toLowerCase() && t.status !== "Delivered / Closed"
      );
      const srvCollected = staffSrvs.reduce((s, t) => s + (t.paymentStatus?.startsWith("Paid") ? (Number(t.chargeAmount) || 0) : (Number(t.advancePaid) || 0)), 0);

      const completedBuilds = state.buildOrders.filter(b =>
        String(b.assignedTech || "").toLowerCase() === staffName.toLowerCase() &&
        matchesDatePeriod(b.orderDate) &&
        (b.stage === "Stress-Tested & Ready for Delivery" || b.stage === "Delivered")
      );

      document.getElementById("repSalesEnquiries").value = staffEnqs.length;
      document.getElementById("repSalesFollowups").value = staffEnqs.filter(e => e.status === "Follow-Up" || e.status === "Quotation Given").length;
      document.getElementById("repSalesQuotesCount").value = staffQuotes.length;
      document.getElementById("repSalesWonCount").value = wonEnqs.length;
      document.getElementById("repSalesQuotedVal").value = quotedVal;
      document.getElementById("repSalesWonVal").value = 0;
      document.getElementById("repSalesNotes").value = "";

      document.getElementById("repSrvCompleted").value = completedSrvs.length;
      document.getElementById("repSrvBuildsQc").value = completedBuilds.length;
      document.getElementById("repSrvOnsite").value = onsiteSrvs.length;
      document.getElementById("repSrvPending").value = pendingSrvs.length;
      document.getElementById("repSrvCollected").value = srvCollected;
      document.getElementById("repSrvNotes").value = "";

      document.getElementById("repAccInvoicesCount").value = wonEnqs.length;
      document.getElementById("repAccBilledTotal").value = 0;
      document.getElementById("repAccAccessoriesSales").value = 0;
      document.getElementById("repAccUpi").value = 0;
      document.getElementById("repAccCash").value = 0;
      document.getElementById("repAccBank").value = 0;
      document.getElementById("repAccPendingDue").value = 0;
      document.getElementById("repAccNotes").value = "";

      document.getElementById("repHighlightsInput").value = "";
      document.getElementById("repBlockersInput").value = "";

      if (!silent) showToast(`⚡ Auto-filled ${freq} numbers from live suite activity!`, "emerald");
    }

    function buildReportObjectFromForm() {
      const staffName = document.getElementById("repStaffSelect").value || (currentUser ? currentUser.displayName : "Staff");
      const matchedUser = getActiveUsersList().find(u => u.displayName === staffName);
      let scope = matchedUser ? (matchedUser.reportScope || "SALES") : "SALES";
      if (isAdminUser()) {
        scope = document.getElementById("repModuleOverrideSelect")?.value || "ALL";
      }

      const periodKey = getActiveReportPeriodKey();
      return {
        id: document.getElementById("repEditId").value || ("rep_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6)),
        frequency: state.reportFreq,
        periodKey,
        staffName,
        branch: document.getElementById("repBranchInput").value || "Calicut",
        attendance: document.getElementById("repAttendanceInput").value || "Full Day",
        reportScope: scope,
        sales: {
          enquiries: Number(document.getElementById("repSalesEnquiries").value) || 0,
          followups: Number(document.getElementById("repSalesFollowups").value) || 0,
          quotesCount: Number(document.getElementById("repSalesQuotesCount").value) || 0,
          wonCount: Number(document.getElementById("repSalesWonCount").value) || 0,
          quotedVal: Number(document.getElementById("repSalesQuotedVal").value) || 0,
          wonVal: Number(document.getElementById("repSalesWonVal").value) || 0,
          notes: document.getElementById("repSalesNotes").value.trim()
        },
        service: {
          completed: Number(document.getElementById("repSrvCompleted").value) || 0,
          buildsQc: Number(document.getElementById("repSrvBuildsQc").value) || 0,
          onsite: Number(document.getElementById("repSrvOnsite").value) || 0,
          pending: Number(document.getElementById("repSrvPending").value) || 0,
          collected: Number(document.getElementById("repSrvCollected").value) || 0,
          notes: document.getElementById("repSrvNotes").value.trim()
        },
        accounts: {
          invoicesCount: Number(document.getElementById("repAccInvoicesCount").value) || 0,
          billedTotal: Number(document.getElementById("repAccBilledTotal").value) || 0,
          accessoriesSales: Number(document.getElementById("repAccAccessoriesSales").value) || 0,
          upi: Number(document.getElementById("repAccUpi").value) || 0,
          cash: Number(document.getElementById("repAccCash").value) || 0,
          bank: Number(document.getElementById("repAccBank").value) || 0,
          pendingDue: Number(document.getElementById("repAccPendingDue").value) || 0,
          notes: document.getElementById("repAccNotes").value.trim()
        },
        highlights: document.getElementById("repHighlightsInput").value.trim(),
        blockers: document.getElementById("repBlockersInput").value.trim(),
        submittedAt: new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
        updatedAt: Date.now()
      };
    }

    function submitStaffReport() {
      const report = buildReportObjectFromForm();
      const idx = state.staffReports.findIndex(r =>
        r.id === report.id ||
        (r.staffName === report.staffName && r.frequency === report.frequency && r.periodKey === report.periodKey)
      );

      if (idx >= 0) {
        report.id = state.staffReports[idx].id;
        state.staffReports[idx] = report;
      } else {
        state.staffReports.unshift(report);
      }

      document.getElementById("repEditId").value = report.id;
      persistDatabaseToStorage();
      refreshAllViews();
      syncStaffReportToGoogleSheet(report);
      showToast(`✅ ${report.frequency.toUpperCase()} report saved for ${report.staffName} (${report.periodKey})!`, "emerald");
    }

    function formatStaffReportWhatsAppText(r) {
      const freqLabel = r.frequency === "daily" ? "DAILY REPORT" : (r.frequency === "weekly" ? "WEEKLY SUMMARY" : "MONTHLY SUMMARY");
      const lines = [
        `*Media Faktory — ${freqLabel}*`,
        `*Staff:* ${r.staffName} (${r.branch}) • *Period:* ${r.periodKey}`,
        r.frequency === "daily" ? `*Attendance:* ${r.attendance}` : null,
        ``
      ].filter(x => x !== null);

      const sc = r.reportScope || "ALL";
      if (sc === "ALL" || sc === "SALES" || sc === "SALES_SERVICE") {
        lines.push(`*📈 SALES:* ${r.sales.enquiries} Enquiries | ${r.sales.followups} Follow-ups | ${r.sales.quotesCount} Quotes (₹${formatINR(r.sales.quotedVal)}) | ${r.sales.wonCount} Won (₹${formatINR(r.sales.wonVal)})`);
        if (r.sales.notes) lines.push(`_Sales Note:_ ${r.sales.notes}`);
      }
      if (sc === "ALL" || sc === "SERVICE" || sc === "SALES_SERVICE") {
        lines.push(`*🛠️ SERVICE:* ${r.service.completed} Repairs | ${r.service.buildsQc} PC Builds/QC | ${r.service.onsite} On-Site | ${r.service.pending} Pending | Collected: ₹${formatINR(r.service.collected)}`);
        if (r.service.notes) lines.push(`_Service Note:_ ${r.service.notes}`);
      }
      if (sc === "ALL" || sc === "ACCOUNTS") {
        lines.push(`*🧾 ACCOUNTS & ACCESSORIES:* ${r.accounts.invoicesCount} Bills (₹${formatINR(r.accounts.billedTotal)}) | Ready Accessories: ₹${formatINR(r.accounts.accessoriesSales)} | UPI: ₹${formatINR(r.accounts.upi)} | Cash: ₹${formatINR(r.accounts.cash)} | Bank: ₹${formatINR(r.accounts.bank)} | Pending Due: ₹${formatINR(r.accounts.pendingDue)}`);
        if (r.accounts.notes) lines.push(`_Accounts/RMA Note:_ ${r.accounts.notes}`);
      }
      if (r.highlights) {
        lines.push(``);
        lines.push(`*Highlights:* ${r.highlights}`);
      }
      if (r.blockers) {
        lines.push(`*Stock / Next Plan:* ${r.blockers}`);
      }
      return lines.join("\n");
    }

    function copyCurrentDraftReportWhatsApp() {
      const draft = buildReportObjectFromForm();
      copyTextToClipboard(formatStaffReportWhatsAppText(draft), "Draft report formatted & copied for WhatsApp!");
    }

    function copySavedStaffReportWhatsApp(repId) {
      const r = state.staffReports.find(x => x.id === repId);
      if (!r) return;
      copyTextToClipboard(formatStaffReportWhatsAppText(r), `Copied ${r.staffName}'s ${r.frequency} report for WhatsApp!`);
    }

    function loadSavedReportIntoForm(repId) {
      const r = state.staffReports.find(x => x.id === repId);
      if (!r) return;
      if (!isAdminUser() && currentUser && r.staffName !== currentUser.displayName) {
        showToast("You can only edit your own submitted reports.", "amber");
        return;
      }
      document.getElementById("repStaffSelect").value = r.staffName;
      document.getElementById("repBranchInput").value = r.branch || "Calicut";
      document.getElementById("repAttendanceInput").value = r.attendance || "Full Day";
      if (r.frequency === "monthly") {
        document.getElementById("repMonthInput").value = r.periodKey;
      } else if (r.frequency === "daily") {
        document.getElementById("repDateInput").value = r.periodKey;
      }
      setReportFrequency(r.frequency);
      showToast(`Loaded ${r.staffName}'s ${r.frequency} report for editing.`, "emerald");
    }

    function deleteStaffReport(repId) {
      if (!isAdminUser()) {
        showToast("Only Admin (Ashwin) can delete submitted reports.", "amber");
        return;
      }
      recordDeletedId(repId);
      state.staffReports = state.staffReports.filter(r => r.id !== repId);
      persistDatabaseToStorage();
      refreshAllViews();
      showToast("Report deleted.", "amber");
    }

    function renderStaffReportsList() {
      const container = document.getElementById("staffReportsFeedContainer");
      if (!container) return;

      const freqFilter = document.getElementById("repFilterFreq")?.value || "ALL";
      const staffFilter = document.getElementById("repFilterStaff")?.value || "ALL";
      const branchFilter = document.getElementById("repFilterBranch")?.value || "ALL";

      const filtered = state.staffReports.filter(r => {
        if (freqFilter !== "ALL" && r.frequency !== freqFilter) return false;
        if (staffFilter !== "ALL" && r.staffName !== staffFilter) return false;
        if (branchFilter !== "ALL" && r.branch !== branchFilter) return false;
        return true;
      });

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="bg-[#1e293b] border border-dashed border-[#334155] rounded-2xl p-10 text-center">
            <p class="text-sm font-semibold text-slate-300 mb-1">No Staff Reports submitted for this filter yet.</p>
            <p class="text-xs text-slate-400">Click <strong class="text-cyan-300">⚡ Auto-Fill from Live Suite</strong> on the left and submit your Daily, Weekly, or Monthly report.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = filtered.slice(0, 40).map(r => {
        const freqBadge = r.frequency === "daily"
          ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
          : (r.frequency === "weekly" ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40");

        const sc = r.reportScope || "ALL";
        const showSales = sc === "ALL" || sc === "SALES" || sc === "SALES_SERVICE";
        const showService = sc === "ALL" || sc === "SERVICE" || sc === "SALES_SERVICE";
        const showAccounts = sc === "ALL" || sc === "ACCOUNTS";

        const delBtn = isAdminUser()
          ? `<button type="button" onclick="deleteStaffReport('${r.id}')" class="p-1.5 rounded-lg bg-[#0f172a] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-[#334155] cursor-pointer" title="Delete Report (Admin)">✕</button>`
          : "";

        return `
          <div class="perf-card bg-[#1e293b] border border-[#334155] hover:border-rose-500/40 rounded-2xl p-4 shadow-lg transition space-y-2.5 text-xs">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#334155]">
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${freqBadge}">${escapeHtml(r.frequency)}</span>
                <span class="text-sm font-bold text-white">${escapeHtml(r.staffName)}</span>
                <span class="text-[11px] font-mono text-slate-300 bg-[#0f172a] px-2 py-0.5 rounded border border-[#334155]">${escapeHtml(r.periodKey)}</span>
                <span class="text-[11px] text-slate-400">• ${escapeHtml(r.branch)}</span>
              </div>
              <span class="text-[10px] text-slate-400">${escapeHtml(r.submittedAt || "")}</span>
            </div>

            ${showSales ? `
              <div class="bg-[#0f172a] border border-emerald-500/25 rounded-xl p-2.5">
                <div class="text-[10px] font-bold text-emerald-300 uppercase mb-1">📈 Sales</div>
                <div class="text-[11px] text-slate-200 font-mono">
                  Enquiries: <strong>${r.sales?.enquiries || 0}</strong> | Follow-ups: <strong>${r.sales?.followups || 0}</strong> | Quotes: <strong class="text-cyan-300">${r.sales?.quotesCount || 0} (₹${formatINR(r.sales?.quotedVal || 0)})</strong> | Won: <strong class="text-emerald-300">${r.sales?.wonCount || 0} (₹${formatINR(r.sales?.wonVal || 0)})</strong>
                </div>
                ${r.sales?.notes ? `<div class="text-[11px] text-slate-400 mt-1">${escapeHtml(r.sales.notes)}</div>` : ""}
              </div>
            ` : ""}

            ${showService ? `
              <div class="bg-[#0f172a] border border-purple-500/25 rounded-xl p-2.5">
                <div class="text-[10px] font-bold text-purple-300 uppercase mb-1">🛠️ Service &amp; Technical</div>
                <div class="text-[11px] text-slate-200 font-mono">
                  Repairs Done: <strong>${r.service?.completed || 0}</strong> | Builds/QC: <strong class="text-sky-300">${r.service?.buildsQc || 0}</strong> | On-Site: <strong>${r.service?.onsite || 0}</strong> | Pending: <strong class="text-amber-300">${r.service?.pending || 0}</strong> | Collected: <strong class="text-emerald-300">₹${formatINR(r.service?.collected || 0)}</strong>
                </div>
                ${r.service?.notes ? `<div class="text-[11px] text-slate-400 mt-1">${escapeHtml(r.service.notes)}</div>` : ""}
              </div>
            ` : ""}

            ${showAccounts ? `
              <div class="bg-[#0f172a] border border-amber-500/25 rounded-xl p-2.5">
                <div class="text-[10px] font-bold text-amber-300 uppercase mb-1">🧾 Accounts &amp; Ready Accessories</div>
                <div class="text-[11px] text-slate-200 font-mono">
                  Bills: <strong>${r.accounts?.invoicesCount || 0} (₹${formatINR(r.accounts?.billedTotal || 0)})</strong> | Ready Accessories: <strong class="text-cyan-300">₹${formatINR(r.accounts?.accessoriesSales || 0)}</strong> | UPI: ₹${formatINR(r.accounts?.upi || 0)} | Cash: ₹${formatINR(r.accounts?.cash || 0)} | Bank: ₹${formatINR(r.accounts?.bank || 0)} | Due: <strong class="text-red-300">₹${formatINR(r.accounts?.pendingDue || 0)}</strong>
                </div>
                ${r.accounts?.notes ? `<div class="text-[11px] text-slate-400 mt-1">${escapeHtml(r.accounts.notes)}</div>` : ""}
              </div>
            ` : ""}

            ${(r.highlights || r.blockers) ? `
              <div class="text-[11px] text-slate-300 space-y-0.5 px-1">
                ${r.highlights ? `<div><strong class="text-white">Highlights:</strong> ${escapeHtml(r.highlights)}</div>` : ""}
                ${r.blockers ? `<div><strong class="text-amber-300">Stock / Next Plan:</strong> ${escapeHtml(r.blockers)}</div>` : ""}
              </div>
            ` : ""}

            <div class="flex items-center justify-between pt-2 border-t border-[#334155]">
              <div class="flex items-center gap-1.5">
                <button type="button" onclick="loadSavedReportIntoForm('${r.id}')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#0f172a] hover:bg-slate-800 text-slate-200 border border-[#334155] cursor-pointer">
                  ✏️ Edit
                </button>
                <button type="button" onclick="copySavedStaffReportWhatsApp('${r.id}')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 cursor-pointer">
                  📲 Copy WA
                </button>
              </div>
              ${delBtn}
            </div>
          </div>
        `;
      }).join("");
    }

    async function syncStaffReportToGoogleSheet(report) {
      if (!state.sheetSyncUrl || !report) return false;
      try {
        const res = await fetch(state.sheetSyncUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            secret: state.sheetSyncSecret,
            action: "upsertStaffReport",
            report
          })
        });
        const data = await res.json();
        return Boolean(data && data.ok);
      } catch {
        return false;
      }
    }

    // =========================================================================
    // 8C. ADMIN EXECUTIVE DASHBOARD ENGINE (ASHWIN ONLY)
    // =========================================================================
    function isDateInAdminPeriod(isoDateStr, period) {
      if (period === "ALL" || !isoDateStr) return true;
      const todayIso = getTodayIsoLocal();
      if (period === "TODAY") return isoDateStr === todayIso;
      if (period === "MONTH") return isoDateStr.slice(0, 7) === todayIso.slice(0, 7);
      if (period === "WEEK") {
        const weekAgoIso = addDaysIso(-7);
        return isoDateStr >= weekAgoIso;
      }
      return true;
    }

    function calculateQuoteEstProfit(q) {
      let baseSum = 0;
      let preGstSum = 0;
      const margin = Number(q.globalMargin ?? 26);
      (q.components || []).forEach(c => {
        const qty = Math.max(1, parseInt(c.qty, 10) || 1);
        const base = (parseFloat(c.basePrice) || 0) * qty;
        const finalVal = (c.isNetPrice || margin === 0) ? Math.round(parseFloat(c.basePrice) || 0) * qty : Math.round((parseFloat(c.basePrice) || 0) * (1 + margin / 100)) * qty;
        baseSum += base;
        preGstSum += (c.isNetPrice || margin === 0) ? base : (finalVal / 1.18);
      });
      return Math.max(0, Math.round(preGstSum - baseSum));
    }

    function inspectStaffMemberWork(staffName, category) {
      if (category === "leads") {
        switchWorkspaceTab("enquiries");
        const ownerSel = document.getElementById("enqOwnerFilter");
        if (ownerSel) ownerSel.value = staffName;
        const statusSel = document.getElementById("enqStatusFilter");
        if (statusSel) statusSel.value = "ACTIVE";
        renderEnquiriesList();
      } else if (category === "quotes") {
        switchWorkspaceTab("quotations");
        const qtStaff = document.getElementById("qtStaffFilter");
        if (qtStaff) qtStaff.value = staffName;
        renderQuotationsWorkspace();
      } else if (category === "service") {
        switchWorkspaceTab("service");
        const srvTech = document.getElementById("srvTechFilter");
        if (srvTech) srvTech.value = staffName;
        const srvStat = document.getElementById("srvStatusFilter");
        if (srvStat) srvStat.value = "ACTIVE";
        renderServiceTickets();
      } else if (category === "builds") {
        switchWorkspaceTab("builds");
        const bldTech = document.getElementById("bldTechFilter");
        if (bldTech) bldTech.value = staffName;
        const bldStat = document.getElementById("bldStatusFilter");
        if (bldStat) bldStat.value = "ACTIVE";
        renderBuildOrders();
      } else if (category === "reports") {
        switchWorkspaceTab("reports");
        const repStaff = document.getElementById("repFilterStaff");
        if (repStaff) repStaff.value = staffName;
        renderStaffReportsList();
      }
    }

    function renderAdminDashboard() {
      if (!isAdminUser()) return;

      renderAdminUsersPermissionsTable();

      const period = document.getElementById("adminPeriodFilter")?.value || "MONTH";
      const branch = document.getElementById("adminBranchFilter")?.value || "ALL";
      const todayIso = getTodayIsoLocal();

      const enqs = state.enquiries.filter(e => {
        if (!isDateInAdminPeriod(e.dateIso, period)) return false;
        if (branch !== "ALL") {
          const eBranch = String(e.city || "").toLowerCase().includes("ernakulam") || String(e.city || "").toLowerCase().includes("kochi") ? "Kochi" : "Calicut";
          if (eBranch !== branch) return false;
        }
        return true;
      });

      const latestQuoteByBase = new Map();
      state.savedQuotes.forEach(q => {
        if (!isDateInAdminPeriod(q.quoteDate, period)) return;
        if (branch !== "ALL" && (q.branch || "Calicut") !== branch) return;
        const base = extractBaseQuoteCode(q.refCode || q.id);
        const existing = latestQuoteByBase.get(base);
        if (!existing || extractRevisionNumber(q.refCode) >= extractRevisionNumber(existing.refCode)) {
          latestQuoteByBase.set(base, q);
        }
      });
      const uniqueQuotes = Array.from(latestQuoteByBase.values());

      const srvs = state.serviceTickets.filter(t => {
        if (!isDateInAdminPeriod(t.intakeDate, period)) return false;
        if (branch !== "ALL" && (t.branch || "Calicut") !== branch) return false;
        return true;
      });

      const blds = state.buildOrders.filter(b => {
        if (!isDateInAdminPeriod(b.orderDate, period)) return false;
        if (branch !== "ALL" && (b.branch || "Calicut") !== branch) return false;
        return true;
      });

      const totalQuotedValue = uniqueQuotes.reduce((s, q) => s + (Number(q.totalFinal) || 0), 0);
      const totalQuotedProfit = uniqueQuotes.reduce((s, q) => s + calculateQuoteEstProfit(q), 0);
      const wonEnqs = enqs.filter(e => e.status === "Won / Billed");
      const conversionRate = enqs.length > 0 ? ((wonEnqs.length / enqs.length) * 100).toFixed(1) : "0.0";
      const confirmedBuildRev = blds.reduce((s, b) => s + (Number(b.totalFinal) || 0), 0);
      const serviceCollected = srvs.reduce((s, t) => s + (t.paymentStatus?.startsWith("Paid") ? (Number(t.chargeAmount) || 0) : (Number(t.advancePaid) || 0)), 0);
      const openOverdueCount = state.enquiries.filter(e => e.status !== "Closed" && e.status !== "Won / Billed" && e.nextFollowUp && e.nextFollowUp < todayIso).length;

      const kpiContainer = document.getElementById("adminExecutiveKpis");
      if (kpiContainer) {
        kpiContainer.innerHTML = `
          <div class="bg-[#1e293b] border border-emerald-500/40 rounded-2xl p-3.5 shadow-lg">
            <div class="text-[10px] font-bold uppercase text-emerald-400">Quoted Pipeline (${uniqueQuotes.length})</div>
            <div class="text-lg sm:text-xl font-extrabold font-mono text-white mt-1">₹${formatINR(totalQuotedValue)}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">Est. Profit: <span class="text-amber-300 font-mono font-bold">₹${formatINR(totalQuotedProfit)}</span></div>
          </div>
          <div class="bg-[#1e293b] border border-cyan-500/40 rounded-2xl p-3.5 shadow-lg">
            <div class="text-[10px] font-bold uppercase text-cyan-400">Confirmed PC Builds (${blds.length})</div>
            <div class="text-lg sm:text-xl font-extrabold font-mono text-white mt-1">₹${formatINR(confirmedBuildRev)}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">${blds.filter(b => b.stage !== "Delivered").length} in assembly/QC</div>
          </div>
          <div class="bg-[#1e293b] border border-amber-500/40 rounded-2xl p-3.5 shadow-lg">
            <div class="text-[10px] font-bold uppercase text-amber-400">Lead Win Rate</div>
            <div class="text-lg sm:text-xl font-extrabold font-mono text-white mt-1">${conversionRate}%</div>
            <div class="text-[10px] text-slate-400 mt-0.5">${wonEnqs.length} Won of ${enqs.length} Leads</div>
          </div>
          <div class="bg-[#1e293b] border border-purple-500/40 rounded-2xl p-3.5 shadow-lg">
            <div class="text-[10px] font-bold uppercase text-purple-300">Service &amp; RMA (${srvs.length})</div>
            <div class="text-lg sm:text-xl font-extrabold font-mono text-white mt-1">₹${formatINR(serviceCollected)}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">${srvs.filter(t => t.status !== "Delivered / Closed").length} open tickets</div>
          </div>
          <div class="bg-[#1e293b] border border-red-500/40 rounded-2xl p-3.5 shadow-lg">
            <div class="text-[10px] font-bold uppercase text-red-400">Overdue Follow-Ups</div>
            <div class="text-lg sm:text-xl font-extrabold font-mono text-white mt-1">${openOverdueCount}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">Needs team follow-up</div>
          </div>
          <div class="bg-[#1e293b] border border-sky-500/40 rounded-2xl p-3.5 shadow-lg">
            <div class="text-[10px] font-bold uppercase text-sky-400">Catalog &amp; Master DB</div>
            <div class="text-lg sm:text-xl font-extrabold font-mono text-white mt-1">${state.masterItems.length} Parts</div>
            <div class="text-[10px] text-slate-400 mt-0.5">${state.prebuiltSets.length} Pre-Built PC sets</div>
          </div>
        `;
      }

      const alerts = [];
      state.enquiries.forEach(e => {
        if (e.status === "Closed" || e.status === "Won / Billed") return;
        if (e.nextFollowUp && e.nextFollowUp < todayIso) {
          alerts.push({
            level: "red",
            tag: "OVERDUE LEAD",
            text: `${e.customer || e.phone} (${e.requirement || "PC"}) — Due ${formatSheetDate(e.nextFollowUp)} • Owner: ${e.owner || "Unassigned"}`,
            action: `switchWorkspaceTab('enquiries')`
          });
        } else if (e.leadTemp === "Hot") {
          alerts.push({
            level: "amber",
            tag: "HOT LEAD",
            text: `${e.customer || e.phone} (${e.budget || "No budget"}) — Owner: ${e.owner || "Unassigned"} • Status: ${e.status}`,
            action: `switchWorkspaceTab('enquiries')`
          });
        }
      });

      state.buildOrders.forEach(b => {
        if (b.stage === "Awaiting Parts") {
          const pendingParts = (b.parts || []).filter(p => p.status === "Ordered from Distributor").map(p => p.name);
          alerts.push({
            level: "amber",
            tag: "BUILD PARTS",
            text: `${b.refCode} (${b.customerName}) awaiting ${pendingParts.length || "parts"} • Tech: ${b.assignedTech}`,
            action: `switchWorkspaceTab('builds')`
          });
        }
      });

      state.serviceTickets.forEach(t => {
        if (t.status === "Ready for Pickup") {
          alerts.push({
            level: "cyan",
            tag: "READY PICKUP",
            text: `${t.ticketCode} (${t.customer} — ${t.device}) ready for customer collection (${t.branch})`,
            action: `switchWorkspaceTab('service')`
          });
        }
      });

      const alertsContainer = document.getElementById("adminBottlenecksContainer");
      const alertsBadge = document.getElementById("adminAlertsSummaryBadge");
      if (alertsBadge) alertsBadge.textContent = `${alerts.length} active alert(s)`;
      if (alertsContainer) {
        if (alerts.length === 0) {
          alertsContainer.innerHTML = `<div class="p-6 text-center text-xs text-emerald-300 bg-[#0f172a] rounded-xl border border-emerald-500/30">✅ Zero overdue bottlenecks! All leads, builds, and service tickets are on schedule.</div>`;
        } else {
          alertsContainer.innerHTML = alerts.slice(0, 15).map(a => {
            const pillClass = a.level === "red"
              ? "bg-red-500/20 text-red-300 border-red-500/40"
              : (a.level === "cyan" ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" : "bg-amber-500/20 text-amber-300 border-amber-500/40");
            return `
              <div onclick="${a.action}" class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#0f172a] hover:bg-slate-800/80 border border-[#334155] cursor-pointer transition text-xs">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="px-2 py-0.5 rounded text-[9px] font-extrabold border shrink-0 ${pillClass}">${a.tag}</span>
                  <span class="text-slate-200 truncate">${escapeHtml(a.text)}</span>
                </div>
                <span class="text-[10px] text-slate-400 shrink-0">Open →</span>
              </div>
            `;
          }).join("");
        }
      }

      const branchContainer = document.getElementById("adminBranchSplitContainer");
      if (branchContainer) {
        const branches = ["Calicut", "Kochi"];
        branchContainer.innerHTML = branches.map(bName => {
          const bQuotes = uniqueQuotes.filter(q => (q.branch || "Calicut") === bName);
          const bBuilds = blds.filter(b => (b.branch || "Calicut") === bName && b.stage !== "Delivered");
          const bSrv = srvs.filter(t => (t.branch || "Calicut") === bName && t.status !== "Delivered / Closed");
          return `
            <div class="p-3 rounded-xl bg-[#0f172a] border border-[#334155] text-xs">
              <div class="flex items-center justify-between font-bold text-white mb-1.5">
                <span>📍 ${bName} Counter</span>
                <span class="text-emerald-300 font-mono">${bQuotes.length} Quotes</span>
              </div>
              <div class="flex items-center justify-between text-[11px] text-slate-400">
                <span>Active Builds: <strong class="text-sky-300">${bBuilds.length}</strong></span>
                <span>Open Service/RMA: <strong class="text-purple-300">${bSrv.length}</strong></span>
              </div>
            </div>
          `;
        }).join("");
      }

      const sourceContainer = document.getElementById("adminLeadSourcesContainer");
      if (sourceContainer) {
        const srcCounts = {};
        enqs.forEach(e => {
          const src = e.leadSource || "Other";
          srcCounts[src] = (srcCounts[src] || 0) + 1;
        });
        const entries = Object.entries(srcCounts).sort((a, b) => b[1] - a[1]);
        sourceContainer.innerHTML = entries.length > 0
          ? entries.map(([src, cnt]) => `<span class="px-2.5 py-1 rounded-lg bg-[#0f172a] border border-[#334155] text-[11px] text-slate-200">${escapeHtml(src)}: <strong class="text-emerald-300 font-mono">${cnt}</strong></span>`).join("")
          : `<span class="text-[11px] text-slate-500">No leads in selected period</span>`;
      }

      const staffTbody = document.getElementById("adminStaffTableBody");
      if (staffTbody) {
        const activeRoster = getActiveUsersList();
        staffTbody.innerHTML = activeRoster.map(u => {
          const stName = u.displayName;
          const periodLeads = enqs.filter(e => String(e.owner || "").toLowerCase() === stName.toLowerCase());
          const activeLeads = periodLeads.filter(e => e.status !== "Closed" && e.status !== "Won / Billed");
          const overdueLeads = activeLeads.filter(e => e.nextFollowUp && e.nextFollowUp < todayIso);
          const wonLeads = periodLeads.filter(e => e.status === "Won / Billed");
          const staffQuotes = uniqueQuotes.filter(q => String(q.createdBy || "").toLowerCase() === stName.toLowerCase());
          const staffQuotedSum = staffQuotes.reduce((s, q) => s + (Number(q.totalFinal) || 0), 0);
          const activeBuilds = blds.filter(b => b.assignedTech === stName && b.stage !== "Delivered");
          const openService = srvs.filter(t => t.assignedTo === stName && t.status !== "Delivered / Closed");

          return `
            <tr class="hover:bg-slate-800/40 transition">
              <td class="py-3 px-3 font-bold text-white whitespace-nowrap">${escapeHtml(stName)}</td>
              <td class="py-3 px-3 text-slate-400 text-[11px] whitespace-nowrap">${escapeHtml(REPORT_SCOPE_LABELS[u.reportScope] || "Staff")}</td>
              <td class="py-3 px-3 text-center font-mono font-bold text-emerald-300">${activeLeads.length}</td>
              <td class="py-3 px-3 text-center font-mono font-bold ${overdueLeads.length > 0 ? 'text-red-400' : 'text-slate-500'}">${overdueLeads.length}</td>
              <td class="py-3 px-3 text-center font-mono font-bold text-cyan-300">${staffQuotes.length}</td>
              <td class="py-3 px-3 text-right font-mono text-slate-200">₹${formatINR(staffQuotedSum)}</td>
              <td class="py-3 px-3 text-center font-mono font-bold text-amber-300">${wonLeads.length}</td>
              <td class="py-3 px-3 text-center font-mono font-bold text-sky-300">${activeBuilds.length}</td>
              <td class="py-3 px-3 text-center font-mono font-bold text-purple-300">${openService.length}</td>
              <td class="py-3 px-3 text-right whitespace-nowrap">
                <div class="inline-flex items-center gap-1">
                  <button type="button" onclick="inspectStaffMemberWork('${escapeHtml(stName)}', 'leads')" class="px-2 py-1 rounded bg-[#0f172a] hover:bg-slate-700 text-[10px] font-semibold text-emerald-300 border border-[#334155] cursor-pointer">Leads</button>
                  <button type="button" onclick="inspectStaffMemberWork('${escapeHtml(stName)}', 'service')" class="px-2 py-1 rounded bg-[#0f172a] hover:bg-slate-700 text-[10px] font-semibold text-purple-300 border border-[#334155] cursor-pointer">Jobs</button>
                  <button type="button" onclick="inspectStaffMemberWork('${escapeHtml(stName)}', 'reports')" class="px-2 py-1 rounded bg-[#0f172a] hover:bg-slate-700 text-[10px] font-semibold text-rose-300 border border-[#334155] cursor-pointer">Reports</button>
                </div>
              </td>
            </tr>
          `;
        }).join("");
      }

      const hwContainer = document.getElementById("adminTopHardwareContainer");
      if (hwContainer) {
        const partCounts = {};
        uniqueQuotes.forEach(q => {
          (q.components || []).forEach(c => {
            if (c.category === "Processor" || c.category === "Graphics Card") {
              const cleanLabel = String(c.name || "").split("|")[0].trim();
              if (cleanLabel) {
                partCounts[cleanLabel] = (partCounts[cleanLabel] || 0) + (Math.max(1, parseInt(c.qty, 10) || 1));
              }
            }
          });
        });
        const topParts = Object.entries(partCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
        hwContainer.innerHTML = topParts.length > 0
          ? topParts.map(([name, count], idx) => `
              <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#0f172a] border border-[#334155] text-xs">
                <div class="truncate">
                  <span class="text-purple-400 font-mono font-bold mr-1.5">#${idx + 1}</span>
                  <span class="text-white font-semibold">${escapeHtml(name)}</span>
                </div>
                <span class="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[11px] font-bold shrink-0">${count}x quoted</span>
              </div>
            `).join("")
          : `<div class="text-xs text-slate-400 py-6 text-center bg-[#0f172a] rounded-xl border border-dashed border-[#334155]">Create quotations to see top CPU &amp; GPU demand analytics.</div>`;
      }

      const feedContainer = document.getElementById("adminRecentFeedContainer");
      if (feedContainer) {
        const feedEvents = [];
        state.savedQuotes.slice(0, 8).forEach(q => {
          feedEvents.push({
            ts: Number(q.updatedAt || 0),
            badge: "QUOTE",
            color: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
            text: `${q.createdBy || "Staff"} issued ${q.refCode} for ${q.customerName || "Customer"} — ₹${formatINR(q.totalFinal)}/-`
          });
        });
        state.staffReports.slice(0, 8).forEach(r => {
          feedEvents.push({
            ts: Number(r.updatedAt || 0),
            badge: "REPORT",
            color: "text-rose-300 bg-rose-500/15 border-rose-500/30",
            text: `${r.staffName} submitted ${r.frequency} report (${r.periodKey})`
          });
        });
        state.enquiries.slice(0, 8).forEach(e => {
          feedEvents.push({
            ts: Number(e.updatedAt || 0),
            badge: "ENQUIRY",
            color: "text-cyan-300 bg-cyan-500/15 border-cyan-500/30",
            text: `${e.owner || "Sales"} updated lead ${e.customer || e.phone} (${e.status})`
          });
        });
        state.serviceTickets.slice(0, 8).forEach(t => {
          feedEvents.push({
            ts: Number(t.updatedAt || 0),
            badge: "SERVICE",
            color: "text-purple-300 bg-purple-500/15 border-purple-500/30",
            text: `${t.ticketCode} (${t.device}) → ${t.status} [Assigned: ${t.assignedTo}]`
          });
        });

        feedEvents.sort((a, b) => b.ts - a.ts);
        feedContainer.innerHTML = feedEvents.length > 0
          ? feedEvents.slice(0, 12).map(ev => `
              <div class="flex items-center gap-2 p-2 rounded-xl bg-[#0f172a] border border-[#334155] text-[11px]">
                <span class="px-1.5 py-0.2 rounded text-[9px] font-bold border shrink-0 ${ev.color}">${ev.badge}</span>
                <span class="text-slate-200 truncate">${escapeHtml(ev.text)}</span>
              </div>
            `).join("")
          : `<div class="text-xs text-slate-400 py-6 text-center bg-[#0f172a] rounded-xl">No recent activity logged yet.</div>`;
      }
    }

    function copyAdminExecutiveSummary() {
      if (!isAdminUser()) return;
      const period = document.getElementById("adminPeriodFilter")?.value || "MONTH";
      const periodLabel = period === "MONTH"
        ? new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : (period === "WEEK" ? "Last 7 Days" : (period === "TODAY" ? "Today" : "All Time"));
      const todayIso = getTodayIsoLocal();

      const periodEnqs = state.enquiries.filter(e => isDateInAdminPeriod(e.dateIso, period));
      const openEnqs = periodEnqs.filter(e => e.status !== "Closed" && e.status !== "Won / Billed");
      const overdue = openEnqs.filter(e => e.nextFollowUp && e.nextFollowUp < todayIso);
      const periodQuotes = state.savedQuotes.filter(q => isDateInAdminPeriod(q.quoteDate, period));
      const periodQuoteVal = periodQuotes.reduce((s, q) => s + (Number(q.totalFinal) || 0), 0);
      const activeBuilds = state.buildOrders.filter(b => isDateInAdminPeriod(b.orderDate, period) && b.stage !== "Delivered");
      const openService = state.serviceTickets.filter(t => isDateInAdminPeriod(t.intakeDate, period) && t.status !== "Delivered / Closed");

      const lines = [
        `*Media Faktory — Executive Ops Report (${periodLabel})*`,
        ``,
        `• *Active Open Enquiries:* ${openEnqs.length} (${overdue.length} Overdue Follow-Ups)`,
        `• *Quotations Issued:* ${periodQuotes.length} quotes (₹${formatINR(periodQuoteVal)}/-)`,
        `• *Active PC Builds & QC:* ${activeBuilds.length} builds in progress`,
        `• *Open Service & RMA Tickets:* ${openService.length} jobs active`,
        `• *Master Price Sheet:* ${state.masterItems.length} verified parts`,
        ``,
        `_Generated from Media Faktory Admin HQ_`
      ];
      copyTextToClipboard(lines.join("\n"), `${periodLabel} Executive Summary copied for WhatsApp!`);
    }

    function loadPrebuiltIntoGenerator(setId) {
      const set = state.prebuiltSets.find(s => s.id === setId);
      if (!set) return;

      set.lastLoadedAt = Date.now();
      set.loadCount = (Number(set.loadCount) || 0) + 1;
      persistDatabaseToStorage();

      const todayIso = getTodayIsoLocal();
      state.editingQuoteBaseCode = null;
      document.getElementById("quoteDateInput").value = todayIso;
      document.getElementById("refCodeInput").value = generateNextRefCode(todayIso);
      document.getElementById("buildTitleInput").value = String(set.title || "Custom PC Build").replace(/^Build\s*#?\d+\s*[—\-:]\s*/i, "").trim();
      document.getElementById("useCaseSelect").value = set.useCase || "gaming";
      state.components = sortComponentsByStandardOrder(JSON.parse(JSON.stringify(set.coreComponents || []))).map(c => ({ ...c, id: uid() }));

      const preset = USE_CASE_PRESETS[set.useCase || "gaming"];
      if (preset) {
        state.highlights = JSON.parse(JSON.stringify(preset.highlights)).map(h => ({ id: uid(), ...h }));
      }

      updateQuoteModeBadge();
      renderHighlightsList();
      renderComponentRows();
      setGlobalMargin(set.marginUsed ?? 26, "pill");
      switchWorkspaceTab("generator");
      showToast(`Loaded "${set.buildName || set.title}" into Quote Generator!`, "emerald");
    }

    function deletePrebuiltSet(setId) {
      if (!hasPermission("canManagePrebuilts")) {
        showToast("You do not have permission to delete Pre-Built PC sets.", "amber");
        return;
      }
      recordDeletedId(setId);
      state.prebuiltSets = state.prebuiltSets.filter(s => s.id !== setId);
      persistDatabaseToStorage();
      refreshAllViews();
      showToast("Pre-Built PC set removed.", "amber");
    }

    function exportPrebuiltsCSV() {
      if (!hasPermission("canExportBackup")) {
        showToast("You do not have permission to export CSV sheets.", "amber");
        return;
      }
      const headers = [
        "Build #", "Build Name", "Ref Code", "Date", "Use Case",
        "Core Base Cost", "24% Floor Price", "28% Target Price", "Quote Price", "Core Components"
      ];
      const rows = state.prebuiltSets.map(s => [
        s.buildNumber || "",
        s.buildName || s.title || "",
        s.refCode || "",
        s.quoteDate || "",
        s.useCaseLabel || s.useCase || "",
        s.coreBaseCost || 0,
        s.coreFloor24Price || 0,
        s.coreTarget28Price || 0,
        s.coreQuotePrice || 0,
        sortComponentsByStandardOrder(s.coreComponents || []).map(c => `${c.category}: ${c.name}`).join(" | ")
      ]);
      downloadCSVFile(`Media_Faktory_PreBuilt_PCs_${getTodayIsoLocal()}.csv`, headers, rows);
    }

    function setQuoteValidityPreset(val) {
      const el = document.getElementById("quoteValidityInput");
      if (el) {
        el.value = val;
        renderPreview();
      }
    }
