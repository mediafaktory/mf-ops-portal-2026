// =========================================================================
    // 17. TAB 1: ENQUIRIES & FOLLOW-UPS + GOOGLE SHEETS BACKEND SYNC
    // =========================================================================
    function normalizePhoneKey(phone) {
      const digits = String(phone || "").replace(/\D/g, "");
      if (!digits) return "";
      if (digits.length === 10) return "91" + digits;
      return digits;
    }

    function formatSheetDate(isoDate) {
      if (!isoDate) return "";
      const parts = isoDate.split("-");
      if (parts.length !== 3) return isoDate;
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mIdx = Math.max(0, Math.min(11, parseInt(parts[1], 10) - 1));
      return `${String(parts[2]).padStart(2, "0")} ${months[mIdx]} ${parts[0]}`;
    }

    function getTodayIsoLocal() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function addDaysIso(offsetDays) {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function setEnqFollowUpOffset(days) {
      document.getElementById("enqFollowUpInput").value = addDaysIso(days);
    }

    function savePreferredOwner(ownerName) {
      const clean = (ownerName || "").trim();
      if (clean) localStorage.setItem(DB_KEYS.OWNER_PREF, clean);
    }

    function checkRepeatEnquiryPhone(rawPhone) {
      const badge = document.getElementById("enqRepeatBadge");
      const key = normalizePhoneKey(rawPhone);
      const editId = document.getElementById("enqEditId").value;
      if (!key || key.length < 10) {
        badge.classList.add("hidden");
        return;
      }
      const prevMatches = state.enquiries.filter(e => e.id !== editId && normalizePhoneKey(e.phone) === key);
      if (prevMatches.length > 0) {
        badge.textContent = `Repeat Customer (${prevMatches.length} prev)`;
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
      }
    }

    function resetEnquiryForm() {
      document.getElementById("enqEditId").value = "";
      document.getElementById("enqFormTitle").innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Quick-Add Sales Enquiry`;
      document.getElementById("enqSaveBtn").textContent = "+ Save Enquiry";
      document.getElementById("enqCancelEditBtn").classList.add("hidden");
      document.getElementById("enqPhoneInput").value = "";
      document.getElementById("enqCustomerInput").value = "";
      document.getElementById("enqCityInput").value = "";
      document.getElementById("enqReqInput").value = "Gaming PC";
      document.getElementById("enqBudgetInput").value = "";
      document.getElementById("enqSourceInput").value = "Whatsapp";
      document.getElementById("enqStatusInput").value = "Open";
      document.getElementById("enqTempInput").value = "Warm";
      document.getElementById("enqFollowUpInput").value = addDaysIso(1);
      document.getElementById("enqNotesInput").value = "";
      document.getElementById("enqRepeatBadge").classList.add("hidden");
      const defaultOwner = currentUser ? currentUser.displayName : (localStorage.getItem(DB_KEYS.OWNER_PREF) || "");
      if (defaultOwner) document.getElementById("enqOwnerInput").value = defaultOwner;
    }

    function saveEnquiryForm(andBuildQuote = false) {
      const editId = document.getElementById("enqEditId").value;
      const phone = document.getElementById("enqPhoneInput").value.trim();
      const customer = document.getElementById("enqCustomerInput").value.trim();
      const city = document.getElementById("enqCityInput").value.trim();
      const requirement = document.getElementById("enqReqInput").value;
      const budget = document.getElementById("enqBudgetInput").value.trim();
      const owner = isAdminUser()
        ? (document.getElementById("enqOwnerInput").value.trim() || currentUser?.displayName || "")
        : (currentUser?.displayName || document.getElementById("enqOwnerInput").value.trim());
      const leadSource = document.getElementById("enqSourceInput").value;
      const status = document.getElementById("enqStatusInput").value;
      const leadTemp = document.getElementById("enqTempInput").value;
      const nextFollowUp = document.getElementById("enqFollowUpInput").value;
      const notes = document.getElementById("enqNotesInput").value.trim();

      if (!phone && !customer) {
        showToast("Enter at least a Customer Name or Phone Number!", "amber");
        return;
      }

      if (owner) savePreferredOwner(owner);
      const nowTs = Date.now();
      let savedRecord = null;

      if (editId) {
        const existing = state.enquiries.find(e => e.id === editId);
        if (existing) {
          existing.phone = phone;
          existing.phoneKey = normalizePhoneKey(phone);
          existing.customer = customer;
          existing.city = city;
          existing.requirement = requirement;
          existing.budget = budget;
          existing.owner = owner;
          existing.leadSource = leadSource;
          existing.status = status;
          existing.leadTemp = leadTemp;
          existing.nextFollowUp = nextFollowUp;
          existing.notes = notes;
          existing.updatedAt = nowTs;
          existing.sheetSynced = false;
          savedRecord = existing;
        }
      } else {
        savedRecord = {
          id: "enq_" + nowTs + "_" + Math.random().toString(36).slice(2, 6),
          dateIso: getTodayIsoLocal(),
          customer,
          phone,
          phoneKey: normalizePhoneKey(phone),
          requirement,
          budget,
          status,
          nextFollowUp,
          notes,
          owner,
          city,
          leadSource,
          leadTemp,
          updatedAt: nowTs,
          sheetSynced: false
        };
        state.enquiries.unshift(savedRecord);
      }

      persistDatabaseToStorage();
      refreshAllViews();
      resetEnquiryForm();

      if (savedRecord) {
        syncEnquiryToGoogleSheet(savedRecord);
        showToast(editId ? "Enquiry updated & synced!" : "Enquiry logged & synced!", "emerald");
        if (andBuildQuote) {
          launchQuoteFromEnquiry(savedRecord.id);
        }
      }
    }

    function editEnquiry(enqId) {
      const e = state.enquiries.find(x => x.id === enqId);
      if (!e) return;
      document.getElementById("enqEditId").value = e.id;
      document.getElementById("enqFormTitle").innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> Update Enquiry`;
      document.getElementById("enqSaveBtn").textContent = "Save Changes";
      document.getElementById("enqCancelEditBtn").classList.remove("hidden");
      document.getElementById("enqPhoneInput").value = e.phone || "";
      document.getElementById("enqCustomerInput").value = e.customer || "";
      document.getElementById("enqCityInput").value = e.city || "";
      document.getElementById("enqReqInput").value = e.requirement || "Gaming PC";
      document.getElementById("enqBudgetInput").value = e.budget || "";
      document.getElementById("enqOwnerInput").value = e.owner || (currentUser ? currentUser.displayName : "");
      document.getElementById("enqSourceInput").value = e.leadSource || "Whatsapp";
      document.getElementById("enqStatusInput").value = e.status || "Open";
      document.getElementById("enqTempInput").value = e.leadTemp || "Warm";
      document.getElementById("enqFollowUpInput").value = e.nextFollowUp || "";
      document.getElementById("enqNotesInput").value = e.notes || "";
      checkRepeatEnquiryPhone(e.phone);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function quickUpdateEnquiryStatus(enqId, newStatus) {
      const e = state.enquiries.find(x => x.id === enqId);
      if (!e) return;
      e.status = newStatus;
      e.updatedAt = Date.now();
      e.sheetSynced = false;
      persistDatabaseToStorage();
      refreshAllViews();
      syncEnquiryToGoogleSheet(e);
      showToast(`Status updated to "${newStatus}"`, "emerald");
    }

    function quickUpdateEnquiryFollowUp(enqId, newIsoDate) {
      const e = state.enquiries.find(x => x.id === enqId);
      if (!e) return;
      e.nextFollowUp = newIsoDate || "";
      e.updatedAt = Date.now();
      e.sheetSynced = false;
      persistDatabaseToStorage();
      refreshAllViews();
      syncEnquiryToGoogleSheet(e);
      showToast(newIsoDate ? `Next follow-up set to ${formatSheetDate(newIsoDate)}` : "Follow-up date cleared", "emerald");
    }

    function appendQuickEnquiryCallNote(enqId) {
      const inputEl = document.getElementById(`enq_quick_note_${enqId}`);
      if (!inputEl) return;
      const noteText = inputEl.value.trim();
      if (!noteText) {
        showToast("Type a quick call note first.", "amber");
        return;
      }
      const e = state.enquiries.find(x => x.id === enqId);
      if (!e) return;

      const stamp = `${formatSheetDate(getTodayIsoLocal())} (${currentUser ? currentUser.displayName : "Staff"})`;
      const formattedLine = `[${stamp}] ${noteText}`;
      e.notes = e.notes ? `${e.notes}\n${formattedLine}` : formattedLine;
      e.updatedAt = Date.now();
      e.sheetSynced = false;
      inputEl.value = "";

      persistDatabaseToStorage();
      refreshAllViews();
      syncEnquiryToGoogleSheet(e);
      showToast("Call note logged & synced!", "emerald");
    }

    function deleteEnquiry(enqId) {
      if (!hasPermission("canDeleteEnquiriesService")) {
        showToast("You do not have permission to delete enquiries.", "amber");
        return;
      }
      recordDeletedId(enqId);
      state.enquiries = state.enquiries.filter(x => x.id !== enqId);
      if (state.activeEnquiryId === enqId) unlinkActiveEnquiry();
      persistDatabaseToStorage();
      refreshAllViews();
      showToast("Enquiry removed from app.", "amber");
    }

    function mapRequirementToUseCase(req) {
      const r = String(req || "").toLowerCase();
      if (r.includes("3d") || r.includes("render") || r.includes("arch")) return "vfx";
      if (r.includes("video") || r.includes("edit")) return "editing";
      if (r.includes("office") || r.includes("business")) return "office";
      return "gaming";
    }

    function launchQuoteFromEnquiry(enqId) {
      const e = state.enquiries.find(x => x.id === enqId);
      if (!e) return;
      state.activeEnquiryId = e.id;

      const existingQuotes = findQuotesForEnquiry(e);
      if (existingQuotes.length > 0) {
        loadSavedQuoteForRevision(existingQuotes[0].id);
        updateLinkedEnquiryBanner();
        return;
      }

      state.editingQuoteBaseCode = null;
      document.getElementById("refCodeInput").value = generateNextRefCode(getTodayIsoLocal());
      document.getElementById("customerNameInput").value = e.customer || "";
      document.getElementById("customerPhoneInput").value = e.phone || "";
      const mappedUseCase = mapRequirementToUseCase(e.requirement);
      document.getElementById("useCaseSelect").value = mappedUseCase;
      applyUseCasePreset(mappedUseCase);
      updateQuoteModeBadge();
      updateLinkedEnquiryBanner();
      switchWorkspaceTab("generator");
      showToast(`Building quote for ${e.customer || e.phone}`, "emerald");
    }

    function findQuotesForEnquiry(e) {
      if (!e) return [];
      const pKey = normalizePhoneKey(e.phone);
      const cName = String(e.customer || "").trim().toLowerCase();

      const matches = (state.savedQuotes || []).filter(q => {
        const qPhone = normalizePhoneKey(q.customerPhone);
        if (pKey && pKey.length >= 10 && qPhone === pKey) return true;
        const qName = String(q.customerName || "").trim().toLowerCase();
        if (cName && cName.length >= 3 && qName === cName) return true;
        return false;
      });

      return matches.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    }

    function unlinkActiveEnquiry() {
      state.activeEnquiryId = null;
      updateLinkedEnquiryBanner();
    }

    function updateLinkedEnquiryBanner() {
      const banner = document.getElementById("linkedEnquiryBanner");
      const textEl = document.getElementById("linkedEnquiryBannerText");
      if (!banner || !textEl) return;

      const e = state.enquiries.find(x => x.id === state.activeEnquiryId);
      if (!e) {
        banner.classList.add("hidden");
        return;
      }

      const currentQuoteTotal = state.components.reduce((sum, r) => sum + calculateFinalPrice(r), 0);
      const parts = [
        `${e.customer || "Customer"}${e.phone ? " (" + e.phone + ")" : ""}`,
        e.requirement || "",
        e.budget ? `Budget: ${e.budget}` : "",
        `Current Quote: ₹${formatINR(currentQuoteTotal)}/-`
      ].filter(Boolean);

      textEl.textContent = parts.join(" • ");
      banner.classList.remove("hidden");
    }

    function linkOrCreateEnquiryFromQuote(quoteRecord) {
      const cpu = quoteRecord.components.find(c => c.category === "Processor")?.name.split("|")[0].trim() || "";
      const gpu = quoteRecord.components.find(c => c.category === "Graphics Card")?.name.split("|")[0].trim() || "";
      const specSummary = [cpu, gpu].filter(Boolean).join(" / ") || quoteRecord.title;
      const quoteNoteLine = `[${quoteRecord.refCode}] Quoted ₹${formatINR(quoteRecord.totalFinal)}/- (${specSummary})`;
      const nowTs = Date.now();

      let target = state.activeEnquiryId
        ? state.enquiries.find(e => e.id === state.activeEnquiryId)
        : null;

      if (!target && quoteRecord.customerPhone) {
        const pKey = normalizePhoneKey(quoteRecord.customerPhone);
        if (pKey.length >= 10) {
          target = state.enquiries.find(e => normalizePhoneKey(e.phone) === pKey && e.status !== "Closed");
        }
      }

      if (target) {
        target.status = "Quotation Given";
        target.notes = target.notes ? `${target.notes}\n${quoteNoteLine}` : quoteNoteLine;
        if (!target.nextFollowUp) target.nextFollowUp = addDaysIso(1);
        target.updatedAt = nowTs;
        target.sheetSynced = false;
      } else {
        target = {
          id: "enq_" + nowTs + "_" + Math.random().toString(36).slice(2, 6),
          dateIso: quoteRecord.quoteDate || getTodayIsoLocal(),
          customer: quoteRecord.customerName || "",
          phone: quoteRecord.customerPhone || "",
          phoneKey: normalizePhoneKey(quoteRecord.customerPhone || ""),
          requirement: USE_CASE_PRESETS[quoteRecord.useCase]?.title || "Gaming PC",
          budget: `₹${formatINR(quoteRecord.totalFinal)}`,
          status: "Quotation Given",
          nextFollowUp: addDaysIso(1),
          notes: quoteNoteLine,
          owner: currentUser ? currentUser.displayName : (localStorage.getItem(DB_KEYS.OWNER_PREF) || quoteRecord.branch || ""),
          city: quoteRecord.branch === "Kochi" ? "Ernakulam" : "Kozhikode",
          leadSource: "Whatsapp",
          leadTemp: "Warm",
          updatedAt: nowTs,
          sheetSynced: false
        };
        state.enquiries.unshift(target);
      }

      syncEnquiryToGoogleSheet(target);
    }

    function setEnquiryQuickFilter(filterVal) {
      document.getElementById("enqStatusFilter").value = filterVal;
      renderEnquiriesList();
    }

    function renderEnquiriesList() {
      const container = document.getElementById("enquiriesFeedContainer");
      if (!container) return;

      const todayIso = getTodayIsoLocal();
      let overdueCount = 0;
      let todayCount = 0;
      let activeCount = 0;
      let quotedCount = 0;

      const ownerSet = new Set(getActiveUsersList().map(u => u.displayName));
      state.enquiries.forEach(e => {
        if (e.owner) ownerSet.add(e.owner);
        const isClosed = e.status === "Closed" || e.status === "Won / Billed";
        if (!isClosed) {
          activeCount++;
          if (e.nextFollowUp) {
            if (e.nextFollowUp < todayIso) overdueCount++;
            else if (e.nextFollowUp === todayIso) todayCount++;
          }
        }
        if (e.status === "Quotation Given") quotedCount++;
      });

      document.getElementById("kpiEnqOverdue").textContent = overdueCount;
      document.getElementById("kpiEnqToday").textContent = todayCount;
      document.getElementById("kpiEnqActive").textContent = activeCount;
      document.getElementById("kpiEnqQuoted").textContent = quotedCount;

      const ownerFilter = document.getElementById("enqOwnerFilter");
      const currentOwnerVal = ownerFilter.value || "ALL";
      const myName = currentUser ? currentUser.displayName : (localStorage.getItem(DB_KEYS.OWNER_PREF) || "");
      ownerFilter.innerHTML = `<option value="ALL" ${currentOwnerVal === "ALL" ? "selected" : ""}>All Owners</option>` +
        (myName ? `<option value="${escapeHtml(myName)}" ${currentOwnerVal === myName ? "selected" : ""}>My Leads (${escapeHtml(myName)})</option>` : "") +
        Array.from(ownerSet).filter(o => o !== myName).sort().map(o =>
          `<option value="${escapeHtml(o)}" ${currentOwnerVal === o ? "selected" : ""}>${escapeHtml(o)}</option>`
        ).join("");

      const query = (document.getElementById("enqSearchInput").value || "").toLowerCase().trim();
      const selectedOwner = ownerFilter.value;
      const selectedStatus = document.getElementById("enqStatusFilter").value;

      const filtered = state.enquiries.filter(e => {
        const isClosed = e.status === "Closed" || e.status === "Won / Billed";
        if (selectedStatus === "ACTIVE" && isClosed) return false;
        else if (selectedStatus === "OVERDUE" && (isClosed || !e.nextFollowUp || e.nextFollowUp >= todayIso)) return false;
        else if (selectedStatus === "TODAY" && (isClosed || e.nextFollowUp !== todayIso)) return false;
        else if (!["ALL", "ACTIVE", "OVERDUE", "TODAY"].includes(selectedStatus) && e.status !== selectedStatus) return false;

        if (selectedOwner !== "ALL" && e.owner !== selectedOwner) return false;

        if (query) {
          const hay = `${e.customer} ${e.phone} ${e.city} ${e.requirement} ${e.notes} ${e.budget} ${e.owner}`.toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      });

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="bg-[#1e293b] border border-dashed border-[#334155] rounded-2xl p-10 text-center">
            <p class="text-sm font-semibold text-slate-300 mb-1">No enquiries match this filter.</p>
            <p class="text-xs text-slate-400">Use the Quick-Add form on the left to log a call, WhatsApp, or walk-in enquiry.</p>
          </div>
        `;
        return;
      }

      const limit = state.visibleLimits.enquiries || 40;
      const visibleItems = filtered.slice(0, limit);
      const canDelEnq = hasPermission("canDeleteEnquiriesService");

      const cardsHtml = visibleItems.map(e => {
        const isClosed = e.status === "Closed" || e.status === "Won / Billed";
        const isOverdue = !isClosed && e.nextFollowUp && e.nextFollowUp < todayIso;
        const isDueToday = !isClosed && e.nextFollowUp && e.nextFollowUp === todayIso;
        const cardBorder = isOverdue
          ? "border-red-500/50"
          : (isDueToday ? "border-amber-500/50" : "border-[#334155]");

        const tempIcon = e.leadTemp === "Hot" ? "🔥" : (e.leadTemp === "Warm" ? "🌤️" : (e.leadTemp === "Cold" ? "❄️" : "•"));
        const statusColor = e.status === "Won / Billed"
          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
          : (e.status === "Quotation Given"
            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
            : (e.status === "Closed"
              ? "bg-slate-800 text-slate-400 border-slate-700"
              : "bg-amber-500/15 text-amber-300 border-amber-500/35"));

        const followUpPill = e.nextFollowUp
          ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${isOverdue ? 'bg-red-500/20 text-red-300 border-red-500/40' : (isDueToday ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-[#0f172a] text-slate-300 border-[#334155]')}">
              ${isOverdue ? 'OVERDUE: ' : (isDueToday ? 'DUE TODAY: ' : 'Follow-up: ')}${escapeHtml(formatSheetDate(e.nextFollowUp))}
            </span>`
          : "";

        const sheetPill = state.sheetSyncUrl
          ? (e.sheetSynced
            ? `<span class="text-[10px] font-mono text-emerald-400" title="Written to Google Sheet">✓ Sheet</span>`
            : `<span class="text-[10px] font-mono text-amber-400" title="Pending sync to Google Sheet">⏳ Pending</span>`)
          : "";

        const deleteEnqBtn = canDelEnq
          ? `<button type="button" onclick="deleteEnquiry('${e.id}')" class="p-1.5 rounded-lg bg-[#0f172a] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-[#334155] cursor-pointer" title="Delete from App">✕</button>`
          : "";

        const matchedQuotes = findQuotesForEnquiry(e);
        const hasExistingQuote = matchedQuotes.length > 0 || e.status === "Quotation Given";
        const quoteActionBtnHtml = hasExistingQuote
          ? `<button type="button" onclick="launchQuoteFromEnquiry('${e.id}')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/45 cursor-pointer" title="${matchedQuotes[0] ? 'Revise ' + escapeHtml(matchedQuotes[0].refCode) : 'Create Revision Quote'}">
              ✏️ Revise Quote${matchedQuotes[0] ? ' (' + escapeHtml(matchedQuotes[0].refCode) + ')' : ''}
            </button>`
          : `<button type="button" onclick="launchQuoteFromEnquiry('${e.id}')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">
              🧾 Build Quote
            </button>`;

        return `
          <div class="perf-card bg-[#1e293b] border ${cardBorder} hover:border-slate-500 rounded-2xl p-3.5 shadow-lg transition">
            <div class="flex flex-wrap items-start justify-between gap-2 mb-2">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-bold text-white">${tempIcon} ${escapeHtml(e.customer || "Unnamed Lead")}</span>
                ${e.phone ? `<span class="text-xs font-mono text-emerald-300 bg-[#0f172a] px-2 py-0.5 rounded-md border border-[#334155]">${escapeHtml(e.phone)}</span>` : ""}
                ${e.city ? `<span class="text-[11px] text-slate-400">📍 ${escapeHtml(e.city)}</span>` : ""}
              </div>
              <div class="flex items-center gap-2">
                ${sheetPill}
                <select onchange="quickUpdateEnquiryStatus('${e.id}', this.value)" title="Change Enquiry Status directly"
                  class="px-2 py-1 rounded-md text-[11px] font-bold border outline-none cursor-pointer ${statusColor}">
                  <option value="Open" ${e.status === "Open" ? "selected" : ""}>Open</option>
                  <option value="Quotation Given" ${e.status === "Quotation Given" ? "selected" : ""}>Quotation Given</option>
                  <option value="Follow-Up" ${e.status === "Follow-Up" ? "selected" : ""}>Follow-Up</option>
                  <option value="Won / Billed" ${e.status === "Won / Billed" ? "selected" : ""}>✅ Won / Billed</option>
                  <option value="Closed" ${e.status === "Closed" ? "selected" : ""}>Closed</option>
                </select>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-1.5 mb-2 text-[11px]">
              <span class="px-2 py-0.5 rounded-md bg-[#0f172a] text-slate-200 font-semibold border border-[#334155]">${escapeHtml(e.requirement || "General")}</span>
              ${e.budget ? `<span class="px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 font-mono font-semibold border border-emerald-500/30">Budget: ${escapeHtml(e.budget)}</span>` : ""}
              ${e.owner ? `<span class="px-2 py-0.5 rounded-md bg-[#0f172a] text-cyan-300 border border-[#334155]">Owner: ${escapeHtml(e.owner)}</span>` : ""}
              ${e.leadSource ? `<span class="px-2 py-0.5 rounded-md bg-[#0f172a] text-slate-400 border border-[#334155]">${escapeHtml(e.leadSource)}</span>` : ""}
              <span class="text-[10px] text-slate-500 font-mono">${escapeHtml(formatSheetDate(e.dateIso))}</span>
              ${followUpPill}
            </div>

            ${e.notes ? `<div class="bg-[#0f172a] border border-[#334155] rounded-xl px-2.5 py-2 text-xs text-slate-200 whitespace-pre-line mb-2">${escapeHtml(e.notes)}</div>` : ""}

            <div class="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-[#334155] text-[11px]">
              <div class="flex flex-wrap items-center gap-1.5">
                <div class="inline-flex items-center gap-1 bg-[#0f172a] border border-[#334155] rounded-lg px-1.5 py-0.5" title="Next Follow-Up Date">
                  <span class="text-[10px] text-slate-400 font-semibold">📅</span>
                  <input type="date" value="${escapeHtml(e.nextFollowUp || "")}"
                    onchange="quickUpdateEnquiryFollowUp('${e.id}', this.value)"
                    class="bg-transparent ${isOverdue ? 'text-red-300 font-bold' : (isDueToday ? 'text-amber-300 font-bold' : 'text-slate-200')} text-[11px] font-mono outline-none [color-scheme:dark] cursor-pointer w-[112px]" />
                  <button type="button" onclick="quickUpdateEnquiryFollowUp('${e.id}', addDaysIso(1))" class="px-1 py-0.2 rounded bg-[#1e293b] hover:bg-slate-700 text-[10px] text-amber-300 font-semibold cursor-pointer" title="Tomorrow">+1d</button>
                </div>

                <div class="inline-flex items-center gap-1 bg-[#0f172a] border border-[#334155] rounded-lg px-1.5 py-0.5">
                  <input type="text" id="enq_quick_note_${e.id}" placeholder="Quick note..."
                    onkeydown="if(event.key==='Enter'){ event.preventDefault(); appendQuickEnquiryCallNote('${e.id}'); }"
                    class="bg-transparent text-[11px] text-white placeholder-slate-500 outline-none w-24 sm:w-28 focus:w-40 transition-all" />
                  <button type="button" onclick="appendQuickEnquiryCallNote('${e.id}')" class="px-1.5 py-0.2 rounded bg-emerald-600/25 hover:bg-emerald-600/40 text-[10px] text-emerald-300 font-bold cursor-pointer" title="Save Call Note">
                    +Note
                  </button>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <button type="button" onclick="editEnquiry('${e.id}')" class="px-2 py-1 rounded-lg text-[11px] font-semibold bg-[#0f172a] hover:bg-slate-800 text-slate-200 border border-[#334155] cursor-pointer" title="Full Edit">
                  ✏️ Edit
                </button>
                ${quoteActionBtnHtml}
                ${e.status !== "Won / Billed" ? `<button type="button" onclick="quickUpdateEnquiryStatus('${e.id}', 'Won / Billed')" class="px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-950/70 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-500/35 cursor-pointer">✅ Won</button>` : ""}
                ${e.status !== "Closed" ? `<button type="button" onclick="quickUpdateEnquiryStatus('${e.id}', 'Closed')" class="px-2 py-1 rounded-lg text-[11px] font-semibold bg-[#0f172a] hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-[#334155] cursor-pointer">Close</button>` : ""}
                ${deleteEnqBtn}
              </div>
            </div>
          </div>
        `;
      }).join("");

      const moreHtml = filtered.length > limit
        ? `<button type="button" onclick="showMoreListItems('enquiries', 40)" class="w-full py-2.5 rounded-xl text-xs font-bold bg-[#1e293b] hover:bg-slate-800 text-emerald-300 border border-[#334155] cursor-pointer">Show More Leads (${filtered.length - limit} remaining)</button>`
        : "";

      container.innerHTML = cardsHtml + moreHtml;
    }

    function updateSheetSyncBadges() {
      const badge = document.getElementById("sheetSyncBadge");
      const modalStatus = document.getElementById("sheetModalStatusText");
      const retryBtn = document.getElementById("retrySheetSyncBtn");
      const pendingSpan = document.getElementById("pendingSheetCount");
      const pendingCount = state.enquiries.filter(e => !e.sheetSynced).length;

      if (state.sheetSyncUrl) {
        if (badge) {
          badge.textContent = "Sheet Linked ✓";
          badge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
        }
        if (modalStatus) modalStatus.textContent = "Connected ✓";
        if (retryBtn && pendingSpan) {
          pendingSpan.textContent = pendingCount;
          if (pendingCount > 0) retryBtn.classList.remove("hidden");
          else retryBtn.classList.add("hidden");
        }
      } else {
        if (badge) {
          badge.textContent = "Not Linked";
          badge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-[#334155]";
        }
        if (modalStatus) modalStatus.textContent = "Not Connected";
        if (retryBtn) retryBtn.classList.add("hidden");
      }
    }

    async function syncEnquiryToGoogleSheet(enquiry) {
      if (!state.sheetSyncUrl || !enquiry) return false;
      try {
        const res = await fetch(state.sheetSyncUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            secret: state.sheetSyncSecret,
            action: "upsertEnquiry",
            enquiry: {
              id: enquiry.id,
              dateDisplay: formatSheetDate(enquiry.dateIso),
              customer: enquiry.customer || "",
              phone: enquiry.phone || "",
              requirement: enquiry.requirement || "",
              budget: enquiry.budget || "",
              status: enquiry.status || "Open",
              nextFollowUpDisplay: formatSheetDate(enquiry.nextFollowUp),
              notes: enquiry.notes || "",
              owner: enquiry.owner || "",
              city: enquiry.city || "",
              leadSource: enquiry.leadSource || "",
              leadTemp: enquiry.leadTemp || "Not assessed"
            }
          })
        });
        const data = await res.json();
        if (data && data.ok) {
          enquiry.sheetSynced = true;
          saveLocalOnly();
          if (state.activeTab === "enquiries") renderEnquiriesList();
          updateSheetSyncBadges();
          return true;
        }
      } catch {
        // Remains sheetSynced: false
      }
      updateSheetSyncBadges();
      return false;
    }

    async function pushAllPendingToSheet() {
      if (!state.sheetSyncUrl) {
        openBackupModal();
        return;
      }
      const pending = state.enquiries.filter(e => !e.sheetSynced);
      let okCount = 0;
      for (const enq of pending) {
        if (await syncEnquiryToGoogleSheet(enq)) okCount++;
      }
      await syncMasterAndPrebuiltsToGoogleSheet(true);
      showToast(`Synced ${okCount} pending enquiries + Master & Pre-Built tabs to Google Sheet!`, "emerald");
    }

    async function syncMasterAndPrebuiltsToGoogleSheet(silent = true) {
      if (!state.sheetSyncUrl) return false;
      try {
        const res = await fetch(state.sheetSyncUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            secret: state.sheetSyncSecret,
            action: "syncMasterAndPrebuilts",
            masterItems: state.masterItems,
            prebuiltSets: state.prebuiltSets
          })
        });
        const data = await res.json();
        if (data && data.ok) {
          if (!silent) {
            showToast(`Google Sheet synced: ${data.masterSynced} Master items & ${data.prebuiltsSynced} Pre-Built sets!`, "emerald");
          }
          return true;
        }
      } catch {
        if (!silent) showToast("Could not sync Master & Pre-Built tabs to Google Sheet.", "amber");
      }
      return false;
    }

    async function saveSheetSyncConfig() {
      if (!isAdminUser()) {
        showToast("Only Admin (Ashwin) can configure Google Sheet URL.", "amber");
        return;
      }
      const url = document.getElementById("sheetSyncUrlInput").value.trim();
      const secret = document.getElementById("sheetSyncSecretInput").value.trim() || DEFAULT_SHEET_SECRET;
      state.sheetSyncUrl = url;
      state.sheetSyncSecret = secret;
      localStorage.setItem(DB_KEYS.SHEET_URL, url);
      localStorage.setItem(DB_KEYS.SHEET_SECRET, secret);
      updateSheetSyncBadges();

      if (!url) {
        showToast("Google Sheet backend disconnected.", "amber");
        return;
      }

      try {
        const pingUrl = `${url}${url.includes("?") ? "&" : "?"}action=ping&secret=${encodeURIComponent(secret)}`;
        const res = await fetch(pingUrl);
        const data = await res.json();
        if (data && data.ok) {
          showToast("Connected to Google Sheets Backend!", "emerald");
          await pullOpenEnquiriesFromSheet(true);
          pushAllPendingToSheet();
        } else {
          showToast(data?.error || "Connection failed. Check Secret Token.", "amber");
        }
      } catch {
        showToast("Could not reach Apps Script URL. Ensure Deploy access is set to 'Anyone'.", "amber");
      }
    }

    async function pullOpenEnquiriesFromSheet(silent = false) {
      if (!state.sheetSyncUrl) {
        if (!silent) showToast("Paste and save your Apps Script Web App URL first.", "amber");
        return;
      }
      try {
        const getUrl = `${state.sheetSyncUrl}${state.sheetSyncUrl.includes("?") ? "&" : "?"}action=getOpen&secret=${encodeURIComponent(state.sheetSyncSecret)}`;
        const res = await fetch(getUrl);
        const data = await res.json();
        if (!data || !data.ok || !Array.isArray(data.enquiries)) {
          if (!silent) showToast(data?.error || "Failed to pull open leads from Sheet.", "amber");
          return;
        }
        const delSet = new Set((state.deletedIds || []).map(String));
        let added = 0;
        let updated = 0;
        data.enquiries.forEach(row => {
          if (!row || !row.id || delSet.has(String(row.id))) return;
          const pKey = normalizePhoneKey(row.phone);
          const existing = state.enquiries.find(e =>
            e.id === row.id ||
            (pKey && pKey.length >= 10 && normalizePhoneKey(e.phone) === pKey && e.dateIso === row.dateIso)
          );
          if (!existing) {
            state.enquiries.push({
              ...row,
              phoneKey: pKey,
              updatedAt: Date.now(),
              sheetSynced: true
            });
            added++;
          } else if (existing.sheetSynced) {
            existing.customer = row.customer || existing.customer;
            existing.phone = row.phone || existing.phone;
            existing.phoneKey = pKey || existing.phoneKey;
            existing.requirement = row.requirement || existing.requirement;
            existing.budget = row.budget || existing.budget;
            existing.status = row.status || existing.status;
            existing.nextFollowUp = row.nextFollowUp || existing.nextFollowUp;
            existing.notes = row.notes || existing.notes;
            existing.owner = row.owner || existing.owner;
            existing.city = row.city || existing.city;
            existing.leadSource = row.leadSource || existing.leadSource;
            existing.leadTemp = row.leadTemp || existing.leadTemp;
            updated++;
          }
        });
        if (added > 0 || updated > 0) {
          persistDatabaseToStorage();
          refreshAllViews();
        }
        if (!silent) {
          showToast(added > 0 ? `Pulled ${added} open lead(s) from Google Sheet!` : "All open leads from Google Sheet are already up to date!", "emerald");
        } else if (added > 0) {
          showToast(`📥 Loaded ${added} active lead(s) from Google Sheet!`, "emerald");
        }
      } catch {
        if (!silent) showToast("Error pulling leads from Google Sheet.", "amber");
      }
    }

    // =========================================================================
    // 18. WORKFLOW HIGHLIGHTS, SUMMARY TOTALS & WHATSAPP/PDF GENERATORS
    // =========================================================================
    function renderHighlightsList() {
      const container = document.getElementById("highlightsListContainer");
      if (!container) return;

      if (!state.highlights || state.highlights.length === 0) {
        container.innerHTML = `<div class="text-xs text-slate-400 text-center py-3 bg-[#0f172a] rounded-xl border border-dashed border-[#334155]">No highlights added. Click "+ Add Bullet" or "Reset Preset".</div>`;
        return;
      }

      container.innerHTML = state.highlights.map(h => `
        <div class="bg-[#0f172a] border border-[#334155] rounded-xl p-2.5 flex flex-col sm:flex-row gap-2 items-start">
          <div class="flex-1 w-full grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input type="text" value="${escapeHtml(h.title)}" placeholder="Highlight Title"
              oninput="updateHighlight('${h.id}', 'title', this.value)"
              class="sm:col-span-4 bg-[#1e293b] border border-[#334155] focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white outline-none" />
            <input type="text" value="${escapeHtml(h.desc)}" placeholder="Description..."
              oninput="updateHighlight('${h.id}', 'desc', this.value)"
              class="sm:col-span-8 bg-[#1e293b] border border-[#334155] focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none" />
          </div>
          <button type="button" onclick="removeHighlight('${h.id}')"
            class="p-1.5 rounded-lg bg-[#1e293b] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-[#334155] transition cursor-pointer shrink-0" title="Remove Bullet">
            ✕
          </button>
        </div>
      `).join("");
    }

    function addHighlightBullet() {
      state.highlights.push({ id: uid(), title: "", desc: "" });
      renderHighlightsList();
      renderPreview();
    }

    function updateHighlight(id, field, value) {
      const item = state.highlights.find(h => h.id === id);
      if (!item) return;
      item[field] = value;
      debouncedRenderPreview();
    }

    function removeHighlight(id) {
      state.highlights = state.highlights.filter(h => h.id !== id);
      renderHighlightsList();
      renderPreview();
    }

    function updateSummaryTotals() {
      let totalBase = 0;
      let totalFinal = 0;
      let totalPreGstSelling = 0;

      state.components.forEach(row => {
        const qty = Math.max(1, parseInt(row.qty) || 1);
        const base = (parseFloat(row.basePrice) || 0) * qty;
        const finalPrice = calculateFinalPrice(row);
        totalBase += base;
        totalFinal += finalPrice;

        if (row.isNetPrice || state.globalMargin === 0) {
          totalPreGstSelling += base;
        } else {
          totalPreGstSelling += (finalPrice / 1.18);
        }
      });

      const gstAmount = Math.max(0, totalFinal - totalPreGstSelling);
      const netProfit = totalPreGstSelling - totalBase;
      const profitPctOnBase = totalBase > 0 ? ((netProfit / totalBase) * 100) : 0;

      document.getElementById("summaryBaseCost").textContent = `₹${formatINR(totalBase)}`;
      document.getElementById("summaryProfit").textContent = `₹${formatINR(netProfit)} (${profitPctOnBase.toFixed(1)}%)`;
      document.getElementById("summaryGstAmount").textContent = `₹${formatINR(gstAmount)}`;
      document.getElementById("summaryFinalTotal").textContent = `₹${formatINR(totalFinal)}/-`;
      updateLinkedEnquiryBanner();

      const profitCard = document.getElementById("profitSummaryCard");
      const profitText = document.getElementById("summaryProfit");
      if (state.globalMargin > 0 && profitPctOnBase < 4.95) {
        profitCard.className = "bg-red-950/50 border border-red-500/50 rounded-xl p-3";
        profitText.className = "text-sm sm:text-base font-bold font-mono text-red-400 mt-1";
      } else {
        profitCard.className = "bg-[#0f172a] border border-amber-500/40 rounded-xl p-3";
        profitText.className = "text-sm sm:text-base font-bold font-mono text-amber-300 mt-1";
      }
    }

    function generateQuoteText() {
      const docType = document.getElementById("docTypeInput").value.trim() || "Custom PC Build Quotation";
      const refCode = document.getElementById("refCodeInput").value.trim();
      const buildTitle = document.getElementById("buildTitleInput").value.trim() || "Custom PC Build";
      const rawDate = document.getElementById("quoteDateInput").value;
      const formattedDate = formatReadableDate(rawDate);
      const showItemPrices = document.getElementById("showItemPricesToggle").checked;
      const customerName = document.getElementById("customerNameInput").value.trim();
      const quoteValidity = document.getElementById("quoteValidityInput")?.value.trim() || "5 Days";

      let lines = [];
      lines.push(`*Media Faktory* - *${docType}*`);
      lines.push("");

      if (customerName) {
        lines.push(`*Prepared For:* ${customerName}`);
      }
      if (refCode) {
        lines.push(`*Ref Code:* ${refCode}`);
      }
      lines.push(`*Configuration:* ${buildTitle}`);
      lines.push("");
      lines.push(`*Date:* ${formattedDate} | *Validity:* ${quoteValidity}`);
      lines.push("");
      lines.push(`*System Configuration & Component Details:*`);
      lines.push("");

      let totalFinal = 0;

      state.components.forEach(row => {
        const qty = Math.max(1, parseInt(row.qty) || 1);
        const unitFinal = calculateUnitFinalPrice(row);
        const finalPrice = calculateFinalPrice(row);
        totalFinal += finalPrice;
        const namePart = String(row.name || "COMPONENT").trim().toUpperCase();
        const qtyLabel = qty > 1 ? ` *(Qty: ${qty})*` : "";
        const warrantyPart = `*${row.warranty} Warranty*`;
        const pricePart = showItemPrices
          ? (qty > 1 ? ` — *₹${formatINR(unitFinal)} x ${qty} = ₹${formatINR(finalPrice)}/-*` : ` — *₹${formatINR(finalPrice)}/-*`)
          : "";
        lines.push(`• *${row.category}:* ${namePart}${qtyLabel} | ${warrantyPart}${pricePart}`);
        lines.push("");
      });

      lines.push("---");
      lines.push("");
      lines.push(`*TOTAL PRICE (All Inclusive of Taxes): ₹${formatINR(totalFinal)}/-*`);
      lines.push("");
      lines.push("---");

      const validHighlights = state.highlights.filter(h => h.title.trim() || h.desc.trim());
      if (validHighlights.length > 0) {
        lines.push("");
        lines.push(`*Workflow Highlights:*`);
        lines.push("");
        validHighlights.forEach(hl => {
          const t = hl.title.trim();
          const d = hl.desc.trim();
          if (t && d) {
            lines.push(`✓ *${t}:* ${d}`);
          } else {
            lines.push(`✓ ${t || d}`);
          }
          lines.push("");
        });
        lines.push("---");
      }

      lines.push("");
      lines.push(`*Terms & Conditions:*`);
      lines.push("");
      lines.push(`• Pricing includes all applicable taxes.`);
      lines.push(`• Component warranties are backed directly by the respective manufacturers.`);
      lines.push(`• Quotation validity: *${quoteValidity}* | *Fixed Price Sales - No Bargaining*.`);
      lines.push("");
      lines.push(`*Warm Regards,*`);
      lines.push(`*Media Faktory*`);
      lines.push("");
      lines.push(`📍 Calicut | Kochi`);
      lines.push(`📞 9446242476 | 9446242404`);

      return lines.join("\n");
    }

    function renderPreview() {
      const fullText = generateQuoteText();
      document.getElementById("charCountLabel").textContent = fullText.length;

      const previewContainer = document.getElementById("visualPreviewContainer");
      const paragraphs = fullText.split("\n");

      previewContainer.innerHTML = paragraphs.map(line => {
        if (line === "") return `<div class="h-1.5"></div>`;
        if (line === "---") return `<hr class="border-emerald-500/25 my-2" />`;
        if (line.startsWith("*TOTAL PRICE")) {
          return `<div class="py-1.5 px-2.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-sm">${whatsappMarkdownToHtml(line)}</div>`;
        }
        return `<div class="text-slate-100">${whatsappMarkdownToHtml(line)}</div>`;
      }).join("");
    }

    function copyTextToClipboard(text, successMsg) {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
          if (successMsg) showToast(successMsg, "emerald");
        }).catch(() => {
          fallbackCopyText(text, successMsg);
        });
        return true;
      }
      return fallbackCopyText(text, successMsg);
    }

    function fallbackCopyText(text, successMsg) {
      const tempTextArea = document.createElement("textarea");
      tempTextArea.value = text;
      tempTextArea.style.position = "fixed";
      tempTextArea.style.left = "-9999px";
      document.body.appendChild(tempTextArea);
      tempTextArea.select();

      let success = false;
      try {
        success = document.execCommand("copy");
      } catch {
        success = false;
      }
      document.body.removeChild(tempTextArea);

      if (success && successMsg) {
        showToast(successMsg, "emerald");
      } else if (!success) {
        showToast("Copy failed. Please copy manually.", "amber");
      }
      return success;
    }

    function copyWhatsAppQuote() {
      const syncResult = saveQuoteAndSyncAll(true);
      const text = generateQuoteText();
      if (copyTextToClipboard(text, "")) {
        const btn = document.getElementById("copyBtn");
        const btnText = document.getElementById("copyBtnText");
        btnText.textContent = "Copied!";
        btn.classList.remove("bg-[#25D366]");
        btn.classList.add("bg-emerald-400");

        if (syncResult) {
          showToast(`Copied ${syncResult.issuedRefCode}! Saved ${syncResult.assignedBuildLabel || "Build"} • Next Quote: ${syncResult.nextRefCode}`, "emerald");
        } else {
          showToast("WhatsApp quotation copied!", "emerald");
        }

        setTimeout(() => {
          btnText.textContent = "Copy for WhatsApp";
          btn.classList.add("bg-[#25D366]");
          btn.classList.remove("bg-emerald-400");
        }, 2000);
      }
    }

    function downloadOfficialPDF() {
      const syncResult = saveQuoteAndSyncAll(true);
      const issuedRef = syncResult ? syncResult.issuedRefCode : (document.getElementById("refCodeInput").value.trim() || generateNextRefCode(getTodayIsoLocal()));

      const docType = document.getElementById("docTypeInput").value;
      const rawDate = document.getElementById("quoteDateInput").value;
      const buildTitle = document.getElementById("buildTitleInput").value.trim() || "Custom PC Build";
      const customerName = document.getElementById("customerNameInput").value.trim() || "Valued Customer";
      const customerPhone = document.getElementById("customerPhoneInput").value.trim();
      const branch = document.getElementById("branchSelectInput").value || "Calicut";
      const quoteValidity = document.getElementById("quoteValidityInput")?.value.trim() || "5 Days";
      const useCaseKey = document.getElementById("useCaseSelect").value;
      const useCaseLabel = USE_CASE_PRESETS[useCaseKey]?.label || "Custom System";
      const quoteDate = formatReadableDate(rawDate);
      const weekMeta = getISOWeekMeta(rawDate);
      const showItemPrices = document.getElementById("showItemPricesToggle").checked;

      let totalFinal = 0;
      const rowsHtml = state.components.map((row, i) => {
        const qty = Math.max(1, parseInt(row.qty) || 1);
        const unitFinal = calculateUnitFinalPrice(row);
        const finalPrice = calculateFinalPrice(row);
        totalFinal += finalPrice;
        return `
          <tr>
            <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b;">${i + 1}</td>
            <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${escapeHtml(row.category)}</td>
            <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; color: #334155;">${escapeHtml(String(row.name || "").toUpperCase())}</td>
            <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569;">${escapeHtml(row.warranty)}</td>
            <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-family: monospace; font-weight: 700; color: #0f172a;">${qty}</td>
            ${showItemPrices ? `<td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #475569;">₹${formatINR(unitFinal)}</td><td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: 700; color: #0f172a;">₹${formatINR(finalPrice)}/-</td>` : ''}
          </tr>
        `;
      }).join("");

      const highlightsHtml = state.highlights.map(h => `
        <li style="margin-bottom: 6px; color: #334155;"><strong>${escapeHtml(h.title)}:</strong> ${escapeHtml(h.desc)}</li>
      `).join("");

      const upiUri = `upi://pay?pa=mediafaktorytech@ybl&pn=Media%20Faktory&am=${totalFinal}&cu=INR`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&margin=4&data=${encodeURIComponent(upiUri)}`;

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        showToast("Please allow pop-ups to export the PDF quote.", "amber");
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>${escapeHtml(issuedRef)}_Media_Faktory_Quotation</title>
          <style>
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: #1e293b; margin: 0; padding: 32px; background: #fff; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #9d174d; padding-bottom: 18px; margin-bottom: 18px; }
            .brand-wrap { display: flex; align-items: flex-start; gap: 14px; }
            .mf-logo { width: 64px; height: 72px; border-radius: 10px; background-color: #031618 !important; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; border: 1px solid #07262a; }
            .brand h2 { margin: 0; font-size: 22px; color: #0f172a; font-weight: 800; letter-spacing: -0.4px; }
            .brand .gst-pill { display: inline-block; margin: 3px 0 5px; font-size: 11.5px; font-weight: 700; color: #be185d; background: #fdf2f8; border: 1px solid #fbcfe8; padding: 2px 8px; border-radius: 5px; font-family: monospace; }
            .brand p { margin: 2px 0; font-size: 11.5px; color: #475569; line-height: 1.4; }
            .ref-badge { display: inline-block; background: linear-gradient(135deg, #be185d, #ea580c); color: #fff; font-family: monospace; font-size: 13.5px; font-weight: 800; padding: 6px 12px; border-radius: 6px; margin-bottom: 6px; }
            .meta { text-align: right; font-size: 12px; color: #334155; }
            .meta p { margin: 3px 0; }
            .meta strong { color: #0f172a; }
            .ref-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px 15px; border-radius: 8px; margin-bottom: 16px; font-size: 12px; }
            .ref-grid-item span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700; margin-bottom: 2px; }
            .ref-grid-item strong { color: #0f172a; font-size: 12.5px; }
            .title-bar { background: #0f172a; color: #fff; padding: 10px 15px; border-radius: 8px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; border-left: 5px solid #e11d48; }
            .title-bar h3 { margin: 0; font-size: 14.5px; font-weight: 700; }
            .title-bar span { font-size: 11px; background: linear-gradient(135deg, #be185d, #ea580c); padding: 3px 10px; border-radius: 999px; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
            th { background: #f1f5f9; color: #1e293b; font-weight: 700; text-align: left; padding: 8px 10px; border-bottom: 2px solid #cbd5e1; }
            .total-box { text-align: right; font-size: 16.5px; font-weight: 800; color: #9d174d; margin-bottom: 18px; padding: 11px 16px; background: #fdf2f8; border-radius: 8px; border: 1px solid #f9a8d4; }
            .payment-grid { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
            .bank-table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin: 0; }
            .bank-table td { padding: 3px 6px; color: #334155; }
            .bank-table td.lbl { font-weight: 700; color: #0f172a; width: 115px; }
            .qr-box { text-align: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; }
            .qr-box img { width: 96px; height: 96px; display: block; margin: 0 auto 4px; }
            .qr-box span { display: block; font-size: 9.5px; font-weight: 700; color: #0f172a; }
            .footer { margin-top: 22px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11.5px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; }
            @media print {
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
              body { padding: 12px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand-wrap">
              <div class="mf-logo">
                <svg viewBox="0 0 100 112" width="64" height="72" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="mfGrad1" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#831843" />
                      <stop offset="48%" stop-color="#be185d" />
                      <stop offset="100%" stop-color="#ea580c" />
                    </linearGradient>
                    <linearGradient id="mfGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#4c1d95" />
                      <stop offset="100%" stop-color="#9d174d" />
                    </linearGradient>
                  </defs>
                  <rect width="100" height="112" fill="#031618" />
                  <polygon points="14,11 14,76 27,85 27,36 52,51 89,26 89,11 52,36" fill="#ffffff" />
                  <polygon points="53,63 89,39 89,54 53,78" fill="url(#mfGrad1)" />
                  <polygon points="53,89 64,81 64,96 53,104" fill="url(#mfGrad2)" />
                </svg>
              </div>
              <div class="brand">
                <h2>Media Faktory</h2>
                <div class="gst-pill">GSTIN: 32CWPPA4910C1Z3</div>
                <p>VV Building, Makolath Lane, Opp Coronation Theatre</p>
                <p>Calicut, Kerala - 673004</p>
                <p><strong>Phone:</strong> 9446242476 / 9446242404</p>
                <p><strong>Email:</strong> mediafaktory.in@gmail.com • <strong>Web:</strong> https://mediafaktory.in/</p>
              </div>
            </div>
            <div class="meta">
              <div class="ref-badge">QUOTATION #: ${escapeHtml(issuedRef)}</div>
              <p><strong>ORIGINAL FOR RECIPIENT</strong></p>
              <p><strong>Quotation Date:</strong> ${escapeHtml(quoteDate)}</p>
              <p><strong>Place of Supply:</strong> Kerala (32)</p>
              <p><strong>Batch / Week:</strong> ${escapeHtml(weekMeta.weekKey)}</p>
            </div>
          </div>

          <div class="ref-grid">
            <div class="ref-grid-item">
              <span>Quotation Reference ID</span>
              <strong style="font-family: monospace; color: #be185d;">${escapeHtml(issuedRef)}</strong>
            </div>
            <div class="ref-grid-item">
              <span>Details of Buyer / Billed To</span>
              <strong>${escapeHtml(customerName)}${customerPhone ? ' • ' + escapeHtml(customerPhone) : ''}</strong>
            </div>
            <div class="ref-grid-item">
              <span>Issuing Branch &amp; Validity</span>
              <strong>${escapeHtml(branch)} Branch • ${escapeHtml(quoteValidity)}</strong>
            </div>
          </div>

          <div class="title-bar">
            <h3>${escapeHtml(docType)}: ${escapeHtml(buildTitle)}</h3>
            <span>${escapeHtml(useCaseLabel)}</span>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 34px; text-align: center;">Sr.</th>
                <th style="width: 115px;">Category</th>
                <th>Name of Product / Component Specification</th>
                <th style="width: 85px; text-align: center;">Warranty</th>
                <th style="width: 44px; text-align: center;">Qty</th>
                ${showItemPrices ? `<th style="width: 95px; text-align: right;">Unit Rate</th><th style="width: 105px; text-align: right;">Total (Incl. GST)</th>` : ''}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="total-box">
            Total Amount (All Inclusive of 18% GST): ₹${formatINR(totalFinal)}/-
          </div>

          ${highlightsHtml ? `
            <div style="margin-bottom: 16px;">
              <h4 style="font-size: 13px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 8px;">System Workflow Highlights</h4>
              <ul style="padding-left: 18px; font-size: 11.5px; margin: 0;">
                ${highlightsHtml}
              </ul>
            </div>
          ` : ''}

          <div class="payment-grid">
            <div>
              <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.4px;">Bank &amp; NEFT / RTGS / UPI Details</div>
              <table class="bank-table">
                <tr><td class="lbl">Bank Name:</td><td><strong>Canara Bank</strong></td><td class="lbl">Account Name:</td><td><strong>Media Faktory</strong></td></tr>
                <tr><td class="lbl">Branch:</td><td>Chalappuram</td><td class="lbl">Account Number:</td><td><strong style="font-family: monospace; font-size: 12.5px;">125006331023</strong></td></tr>
                <tr><td class="lbl">IFSC Code:</td><td><strong style="font-family: monospace;">CNRB0001144</strong></td><td class="lbl">UPI ID:</td><td><strong style="font-family: monospace; color: #be185d;">mediafaktorytech@ybl</strong></td></tr>
              </table>
            </div>
            <div class="qr-box">
              <img src="${qrCodeUrl}" alt="Pay using UPI QR" onerror="this.style.display='none'" />
              <span>Scan to Pay via UPI</span>
              <span style="font-family: monospace; font-weight: 500; color: #64748b; font-size: 8.5px;">mediafaktorytech@ybl</span>
            </div>
          </div>

          <div style="font-size: 10.5px; color: #475569; background: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #cbd5e1; line-height: 1.45;">
            <strong>Terms &amp; Conditions (Ref: ${escapeHtml(issuedRef)}):</strong><br/>
            • All prices include GST. Payment must be made in full before delivery.<br/>
            • Warranty is covered directly by the respective manufacturer; claims require the original invoice.<br/>
            • Quotation validity: <strong>${escapeHtml(quoteValidity)}</strong> | <strong>Fixed Price Sales - No Bargaining</strong>. Delivery is subject to stock availability.
          </div>

          <div class="footer">
            <div>
              <strong>Media Faktory</strong> • https://mediafaktory.in/ • mediafaktory.in@gmail.com<br/>
              Ref: ${escapeHtml(issuedRef)} • Place of Supply: Kerala (32)
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">For Media Faktory</div>
              <div>Authorised Signatory</div>
            </div>
          </div>

          <script>
            window.onload = function() { setTimeout(function() { window.print(); }, 350); };
          <\/script>
        </body>
        </html>
      `);
      printWindow.document.close();

      if (syncResult) {
        showToast(`PDF Quote ${issuedRef} generated! Saved ${syncResult.assignedBuildLabel || "Build"} • Next Quote: ${syncResult.nextRefCode}`, "emerald");
      } else {
        showToast(`PDF Quote generated with Reference ${issuedRef}!`, "emerald");
      }
    }

    function openBackupModal() {
      openModal("backupModal");
    }

    function confirmReset() {
      openModal("resetModal");
    }

    function executeReset() {
      const todayIso = document.getElementById("quoteDateInput").value;
      state.editingQuoteBaseCode = null;
      document.getElementById("refCodeInput").value = generateNextRefCode(todayIso);
      document.getElementById("buildTitleInput").value = "Custom PC Build";
      document.getElementById("customerNameInput").value = "";
      document.getElementById("customerPhoneInput").value = "";
      document.getElementById("rawPasteInput").value = "";
      state.components = [];
      updateQuoteModeBadge();
      renderComponentRows();
      recalculateAll();
      closeModal("resetModal");
      showToast("Form cleared.", "amber");
    }

    function openModal(id) {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove("hidden");
        el.classList.add("flex");
      }
    }

    function closeModal(id) {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add("hidden");
        el.classList.remove("flex");
      }
    }

    function showToast(message, type = "emerald") {
      const container = document.getElementById("toastContainer");
      const toast = document.createElement("div");
      const borderClass = type === "amber" ? "border-amber-500/50 text-amber-200" : "border-emerald-500/50 text-emerald-200";
      toast.className = `pointer-events-auto bg-[#1e293b]/95 backdrop-blur-md border ${borderClass} px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl transition-all duration-300 transform translate-y-2 opacity-0`;
      toast.textContent = message;
      container.appendChild(toast);

      requestAnimationFrame(() => {
        toast.classList.remove("translate-y-2", "opacity-0");
      });

      setTimeout(() => {
        toast.classList.add("translate-y-2", "opacity-0");
        setTimeout(() => toast.remove(), 300);
      }, 2800);
    }

    function initApp() {
      try {
        populateCategorySelects();
        loadDatabaseFromStorage();
        populateDynamicTeamDatalists();

        const todayIso = getTodayIsoLocal();
        document.getElementById("quoteDateInput").value = todayIso;
        document.getElementById("repDateInput").value = todayIso;
        document.getElementById("repMonthInput").value = todayIso.slice(0, 7);
        updateReportPeriodBadge();
        document.getElementById("bubbleTimestamp").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        resetEnquiryForm();
        resetServiceForm();
        loadSampleBuild(true);

        if (restoreTeamSession()) {
          applySessionUiAndPermissions();
        } else {
          refreshAllViews();
        }

        startCloudAutoPoll();
        startWeeklyMonday11AmScheduler();
        if (state.sheetSyncUrl) {
          pullOpenEnquiriesFromSheet(true);
        }
      } catch (err) {
        console.error("Media Faktory Suite Init Error:", err);
        showToast("Recovered from a startup data issue. Check console if needed.", "amber");
      }
    }

    window.addEventListener("DOMContentLoaded", () => {
      initApp();
    });
