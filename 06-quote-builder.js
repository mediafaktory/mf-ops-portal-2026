// =========================================================================
    // 12. QUOTE BUILDER, INLINE MASTER SEARCH, INSERT ROW & SORT ORDER
    // =========================================================================
    function loadSampleBuild(silent = false) {
      const todayIso = document.getElementById("quoteDateInput").value || getTodayIsoLocal();
      state.editingQuoteBaseCode = null;
      document.getElementById("refCodeInput").value = generateNextRefCode(todayIso);
      document.getElementById("useCaseSelect").value = "gaming";
      document.getElementById("docTypeInput").value = "Custom PC Build Quotation";
      document.getElementById("buildTitleInput").value = "High-Performance Gaming PC";
      document.getElementById("quoteValidityInput").value = "5 Days";
      document.getElementById("showItemPricesToggle").checked = true;

      state.highlights = JSON.parse(JSON.stringify(USE_CASE_PRESETS.gaming.highlights)).map(h => ({ id: uid(), ...h }));
      state.components = [
        { id: uid(), category: "Processor", name: "AMD RYZEN 5 7600X | 6 CORES / 12 THREADS", warranty: "3 Years", qty: 1, basePrice: 15000, isNetPrice: false, isExternal: false },
        { id: uid(), category: "Motherboard", name: "MSI B650M GAMING WIFI DDR5", warranty: "3 Years", qty: 1, basePrice: 9200, isNetPrice: false, isExternal: false },
        { id: uid(), category: "RAM", name: "ADATA XPG LANCER BLADE 16GB DDR5 5600MHZ", warranty: "3 Years", qty: 1, basePrice: 22500, isNetPrice: false, isExternal: false },
        { id: uid(), category: "Storage (SSD)", name: "ADATA XPG GAMMIX S60 1TB NVME M.2 SSD", warranty: "3 Years", qty: 1, basePrice: 13050, isNetPrice: false, isExternal: false },
        { id: uid(), category: "Graphics Card", name: "POWERCOLOR REAPER RADEON RX 9060 XT 8GB GDDR6", warranty: "3 Years", qty: 1, basePrice: 53940, isNetPrice: true, isExternal: false },
        { id: uid(), category: "CPU Cooler", name: "DEEPCOOL AK400 AIR COOLER", warranty: "3 Years", qty: 1, basePrice: 1960, isNetPrice: false, isExternal: false },
        { id: uid(), category: "Power Supply", name: "DEEPCOOL PL650D 650W 80 PLUS BRONZE", warranty: "3 Years", qty: 1, basePrice: 3710, isNetPrice: false, isExternal: false },
        { id: uid(), category: "Cabinet", name: "DEEPCOOL CG530 4F TEMPERED GLASS CABINET", warranty: "1 Year", qty: 1, basePrice: 4300, isNetPrice: false, isExternal: false }
      ];

      updateQuoteModeBadge();
      renderHighlightsList();
      renderComponentRows();
      setGlobalMargin(26, "pill");
      if (!silent) showToast("Sample Gaming Build loaded!", "emerald");
    }

    function updateFloorGuardrail(totalMargin) {
      const warningBadge = document.getElementById("floorWarningBadge");
      if (!warningBadge) return;
      if (totalMargin > 0 && totalMargin < 23.9) {
        warningBadge.classList.remove("hidden");
      } else {
        warningBadge.classList.add("hidden");
      }
    }

    function setGlobalMargin(val, source = "pill") {
      let margin = Math.max(0, Number(val) || 0);

      if (!hasPermission("canOverrideMinProfit") && margin > 0 && margin < 24) {
        margin = 24;
        showToast("Minimum 24% floor enforced (Admin override required).", "amber");
      }

      state.globalMargin = margin;

      if (source !== "total") {
        document.getElementById("customMarginInput").value = Number(margin.toFixed(2));
      }

      if (source !== "profit") {
        const impliedProfitPct = margin === 0 ? 0 : (((1 + margin / 100) / 1.18) - 1) * 100;
        document.getElementById("targetProfitInput").value = impliedProfitPct.toFixed(2);
      }

      document.querySelectorAll(".margin-pill").forEach(btn => {
        const pillVal = Number(btn.getAttribute("data-margin"));
        if (Math.abs(pillVal - margin) < 0.05) {
          btn.className = "margin-pill px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer bg-amber-500 text-slate-950 border-amber-400 shadow";
        } else {
          btn.className = "margin-pill px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer bg-[#0f172a] text-slate-300 border-[#334155] hover:border-slate-500";
        }
      });

      updateFloorGuardrail(margin);
      recalculateAll();
    }

    function setTargetProfitMargin(profitPct) {
      let p = Math.max(0, Number(profitPct) || 0);
      if (!hasPermission("canOverrideMinProfit") && p > 0 && p < 5.08) {
        p = 5.08;
      }
      const combinedMarkup = (((1 + p / 100) * 1.18) - 1) * 100;
      setGlobalMargin(Number(combinedMarkup.toFixed(2)), "profit");
    }

    function applyUseCasePreset(presetKey) {
      const preset = USE_CASE_PRESETS[presetKey];
      if (!preset) return;
      document.getElementById("buildTitleInput").value = preset.title;
      document.getElementById("docTypeInput").value = preset.docType;
      state.highlights = JSON.parse(JSON.stringify(preset.highlights)).map(h => ({ id: uid(), ...h }));
      renderHighlightsList();
      renderPreview();
      showToast(`Applied "${preset.title}" preset`, "emerald");
    }

    function toggleParserDrawer() {
      const body = document.getElementById("parserDrawerBody");
      const chevron = document.getElementById("parserChevron");
      body.classList.toggle("hidden");
      chevron.classList.toggle("rotate-180");
    }

    function sortCurrentComponentsStandardOrder() {
      state.components = sortComponentsByStandardOrder(state.components);
      renderComponentRows();
      renderPreview();
      showToast("⇅ Sorted components into standard build order!", "emerald");
    }

    function detectCategoryAndCleanName(rawLine) {
      const upper = rawLine.toUpperCase();
      let category = "Other";
      let cleanText = rawLine.trim();

      const rules = [
        { cat: "Processor", regex: /^(PROCESSOR|CPU)\b[:\-\s]*/i },
        { cat: "Motherboard", regex: /^(MOTHERBOARD|MOBO|MB)\b[:\-\s]*/i },
        { cat: "RAM", regex: /^(RAM|MEMORY)\b[:\-\s]*/i },
        { cat: "Storage (HDD)", regex: /^(STORAGE\s*\(HDD\)|HDD|HARD\s*DISK|HARD\s*DRIVE)\b[:\-\s]*/i },
        { cat: "Storage (SSD)", regex: /^(STORAGE\s*\(SSD\)|SSD|NVME)\b[:\-\s]*/i },
        { cat: "Graphics Card", regex: /^(GRAPHICS\s*CARD|GPU|VGA|GRAPHIC\s*CARD)\b[:\-\s]*/i },
        { cat: "CPU Cooler", regex: /^(CPU\s*LIQUID\s*COOLER|LIQUID\s*COOLER|AIO|CPU\s*AIR\s*COOLER|CPU\s*COOLER|CPU\s*FAN|COOLER)\b[:\-\s]*/i },
        { cat: "Power Supply", regex: /^(POWER\s*SUPPLY|SMPS|PSU)\b[:\-\s]*/i },
        { cat: "Cabinet", regex: /^(CABINET|CHASSIS|CASE)\b[:\-\s]*/i },
        { cat: "Monitor", regex: /^(MONITOR|DISPLAY)\b[:\-\s]*/i },
        { cat: "Keyboard & Mouse", regex: /^(KEYBOARD\s*&\s*MOUSE|KBM|KEYBOARD|MOUSE)\b[:\-\s]*/i },
        { cat: "UPS", regex: /^(UPS)\b[:\-\s]*/i },
        { cat: "Printer", regex: /^(PRINTER)\b[:\-\s]*/i },
        { cat: "Speakers / Audio", regex: /^(SPEAKERS?|AUDIO|HEADSET)\b[:\-\s]*/i }
      ];

      for (const rule of rules) {
        if (rule.regex.test(cleanText)) {
          category = rule.cat;
          cleanText = cleanText.replace(rule.regex, "").trim();
          break;
        }
      }

      if (category === "Other") {
        if (/\b(RYZEN|CORE\s*I[3579]|CORE\s*ULTRA|INTEL\s*I[3579])\b/i.test(upper)) category = "Processor";
        else if (/\b(B650|B850|B860|B760|B550|A520|H610|H310|Z790|Z890|X870)\b/i.test(upper)) category = "Motherboard";
        else if (/\b(DDR4|DDR5|MHZ|VENGEANCE|VENGENCE|RIPJAWS|AEGIS|LANCER)\b/i.test(upper)) category = "RAM";
        else if (/\b(HDD|HARD\s*DISK|BARRACUDA|BARACUDA|IRONWOLF|SKYHAWK|WD\s*BLUE\s*\d+TB|7200\s*RPM|5400\s*RPM)\b/i.test(upper)) category = "Storage (HDD)";
        else if (/\b(NVME|SSD|SN5100|SN7100|SN350|GAMMIX|M\.2)\b/i.test(upper)) category = "Storage (SSD)";
        else if (/\b(RTX|GTX|RX\s*\d{4}|GT\s*730|RADEON|GEFORCE)\b/i.test(upper)) category = "Graphics Card";
        else if (/\b(LE240|LE360|LS520|LS720|AK400|AG400|AK620)\b/i.test(upper)) category = "CPU Cooler";
        else if (/\b(PL550|PL650|PN750|PN850|A650BN|80\+|80\s*PLUS|BRONZE|GOLD)\b/i.test(upper)) category = "Power Supply";
        else if (/\b(CG530|CC550|VM41|VM50|ATLANTIC|TURBO)\b/i.test(upper)) category = "Cabinet";
        else if (/\b(GW2790|22U401|IPS|100HZ|144HZ|165HZ|180HZ)\b/i.test(upper)) category = "Monitor";
        else if (/\b(MK120|MK200|NX1600|LOGITECH|RAPOO)\b/i.test(upper)) category = "Keyboard & Mouse";
      }

      return { category, cleanText };
    }

    function parseRawLinesToObjects(raw) {
      const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const parsedRows = [];

      for (let line of lines) {
        if (/^(BUILD\s*TOTAL|TOTAL|MF-)/i.test(line) && !/\d{3,}/.test(line)) continue;
        if (/^BUILD\s*TOTAL/i.test(line)) continue;

        let qty = 1;
        const qtyPrefix = line.match(/^(\d+)\s*[xX\*]\s+/);
        if (qtyPrefix) {
          qty = Math.max(1, parseInt(qtyPrefix[1], 10) || 1);
          line = line.slice(qtyPrefix[0].length).trim();
        }

        let warranty = null;
        const warrantyMatch = line.match(/\b(1|2|3|5|10)\s*YEARS?\b/i);
        if (warrantyMatch) {
          const yrs = warrantyMatch[1];
          warranty = yrs === "1" ? "1 Year" : `${yrs} Years`;
          line = line.replace(warrantyMatch[0], " ").trim();
        } else if (/\bLIFETIME\b/i.test(line)) {
          warranty = "Lifetime";
          line = line.replace(/\bLIFETIME\b/i, " ").trim();
        }

        let basePrice = 0;
        let isNetPrice = false;
        const priceMatch = line.match(/(?:[=\-–—]\s*)?(?:₹|Rs\.?)?\s*([\d,]+(?:\.\d+)?)\s*(?:(\+\s*(?:tax|gst)?)|(\/-))?\s*$/i);
        if (priceMatch) {
          basePrice = parseFloat(priceMatch[1].replace(/,/g, "")) || 0;
          if (priceMatch[3] && !priceMatch[2]) {
            isNetPrice = true;
          }
          line = line.slice(0, priceMatch.index).trim();
        }

        line = line.replace(/[\-–—:=]+$/, "").trim();
        if (!line && basePrice === 0) continue;

        const { category, cleanText } = detectCategoryAndCleanName(line);
        const standardizedName = standardizeAllCapsComponentName(cleanText, category, false);
        const fuzzyHit = findMasterFuzzyMatch(standardizedName, category);
        const masterHit = fuzzyHit ? fuzzyHit.item : null;

        if (basePrice === 0 && masterHit) {
          basePrice = masterHit.gettingPrice || 0;
          isNetPrice = Boolean(masterHit.isNetPrice);
        }

        if (!warranty) {
          warranty = masterHit?.warranty || ((category === "Cabinet" || category === "Keyboard & Mouse") ? "1 Year" : "3 Years");
        }

        parsedRows.push({
          id: uid(),
          category,
          name: standardizedName || "COMPONENT",
          warranty,
          qty,
          basePrice,
          isNetPrice,
          isExternal: isCategoryExternal(category, standardizedName)
        });
      }

      return sortComponentsByStandardOrder(parsedRows);
    }

    function parseAndAddComponents(replaceExisting = false) {
      const raw = document.getElementById("rawPasteInput").value.trim();
      if (!raw) {
        showToast("Paste some component lines first!", "amber");
        return;
      }

      const parsedRows = parseRawLinesToObjects(raw);
      if (parsedRows.length === 0) {
        showToast("Could not detect valid components from text.", "amber");
        return;
      }

      if (replaceExisting) {
        state.components = parsedRows;
      } else {
        state.components = sortComponentsByStandardOrder([...state.components, ...parsedRows]);
      }

      renderComponentRows();
      recalculateAll();
      showToast(`Parsed & ALL-CAPS standardized ${parsedRows.length} component(s)!`, "emerald");
    }

    function openRowMasterAutocomplete(rowId, queryText = "") {
      closeAllRowAutocompletes();
      const dropdown = document.getElementById(`row_ac_${rowId}`);
      const row = state.components.find(r => r.id === rowId);
      if (!dropdown || !row) return;

      const q = String(queryText || row.name || "").toLowerCase().trim();
      const qFp = q.length >= 3 ? buildTokenFingerprint(q) : "";
      const rowCat = row.category || "Other";

      const matches = (state.masterItems || [])
        .map(item => {
          const itemNameLower = item.name.toLowerCase();
          const directHit = !q
            ? (rowCat === "Other" || item.category === rowCat)
            : (itemNameLower.includes(q) || item.category.toLowerCase().includes(q));
          if (directHit) {
            return { item, directHit: true, simScore: 1.0 };
          }
          if (!qFp || q.length < 4 || !haveCompatibleCriticalSpecs(q, item.name)) {
            return { item, directHit: false, simScore: 0 };
          }
          const simScore = computeFingerprintSimilarity(qFp, item.normKey || buildTokenFingerprint(item.name));
          return { item, directHit: false, simScore };
        })
        .filter(x => x.directHit || x.simScore >= 0.78)
        .sort((a, b) => {
          const aSameCat = a.item.category === rowCat ? 0 : 1;
          const bSameCat = b.item.category === rowCat ? 0 : 1;
          if (aSameCat !== bSameCat) return aSameCat - bSameCat;
          if (Math.abs(b.simScore - a.simScore) > 0.1) return b.simScore - a.simScore;
          return compareMasterItemsByCategory(a.item, b.item, "price_asc");
        })
        .slice(0, 10);

      if (matches.length === 0) {
        dropdown.classList.add("hidden");
        return;
      }

      dropdown.innerHTML = `
        <div class="px-2.5 py-1 bg-[#1e293b] border-b border-[#334155] flex items-center justify-between text-[10px] text-slate-400">
          <span>Master Price Sheet Matches (${matches.length})</span>
          <button type="button" onmousedown="closeAllRowAutocompletes()" class="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>
        <div class="max-h-52 overflow-y-auto divide-y divide-[#334155]/70">
          ${matches.map(({ item: m, directHit, simScore }) => `
            <button type="button" onmousedown="selectMasterItemForRow('${rowId}', '${m.id}')"
              class="w-full text-left px-3 py-2 hover:bg-cyan-950/60 flex items-center justify-between gap-2 transition cursor-pointer">
              <div class="min-w-0">
                <div class="text-xs font-semibold text-white truncate">
                  ${escapeHtml(m.name)}
                  ${!directHit && simScore >= 0.78 ? `<span class="ml-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300">Did you mean?</span>` : ""}
                </div>
                <div class="text-[10px] text-slate-400">${escapeHtml(m.category)} • ${escapeHtml(m.warranty)}</div>
              </div>
              <div class="text-right shrink-0">
                <div class="text-xs font-mono font-bold text-amber-300">₹${formatINR(m.gettingPrice)}</div>
                <div class="text-[9px] text-slate-400">${m.isNetPrice ? 'Net' : '+GST'}</div>
              </div>
            </button>
          `).join("")}
        </div>
      `;
      dropdown.classList.remove("hidden");
    }

    function closeAllRowAutocompletes() {
      document.querySelectorAll(".row-master-ac-dropdown").forEach(el => el.classList.add("hidden"));
    }

    function selectMasterItemForRow(rowId, masterId) {
      const row = state.components.find(r => r.id === rowId);
      const item = state.masterItems.find(m => m.id === masterId);
      if (!row || !item) return;

      row.category = item.category;
      row.name = String(item.name).toUpperCase();
      row.warranty = item.warranty;
      row.basePrice = item.gettingPrice;
      row.isNetPrice = Boolean(item.isNetPrice);
      row.isExternal = Boolean(item.isExternal);

      closeAllRowAutocompletes();
      renderComponentRows();
      recalculateAll();
      showToast(`Selected "${row.name}" (₹${formatINR(item.gettingPrice)})`, "emerald");
    }

    function renderComponentRows() {
      const container = document.getElementById("componentsContainer");
      if (!container) return;

      if (state.components.length === 0) {
        container.innerHTML = `
          <div class="text-center py-8 px-4 rounded-xl border border-dashed border-[#334155] bg-[#0f172a]/50">
            <p class="text-xs text-slate-400 mb-2">No components added yet.</p>
            <button type="button" onclick="addEmptyRow()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer">
              + Add First Component
            </button>
          </div>
        `;
        return;
      }

      container.innerHTML = state.components.map((row, idx) => {
        const finalPrice = calculateFinalPrice(row);
        const catOptions = CATEGORIES.map(c => `<option value="${escapeHtml(c)}" ${row.category === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("");
        const warOptions = WARRANTIES.map(w => `<option value="${escapeHtml(w)}" ${row.warranty === w ? "selected" : ""}>${escapeHtml(w)}</option>`).join("");
        const ext = Boolean(row.isExternal);

        return `
          <div class="bg-[#0f172a] border ${ext ? 'border-purple-500/40' : (row.isNetPrice ? 'border-sky-500/40' : 'border-[#334155]')} hover:border-slate-500 rounded-xl p-3 transition" data-row-id="${row.id}">
            <div class="grid grid-cols-12 gap-2.5 items-center">
              <div class="col-span-6 sm:col-span-3">
                <label class="block text-[10px] font-medium text-slate-400 uppercase mb-1">Category</label>
                <select onchange="updateRowField('${row.id}', 'category', this.value)"
                  class="w-full bg-[#1e293b] border border-[#334155] focus:border-emerald-500 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-200 outline-none">
                  ${catOptions}
                </select>
              </div>

              <div class="col-span-12 sm:col-span-6 order-first sm:order-none relative">
                <div class="flex items-center justify-between mb-1">
                  <label class="text-[10px] font-medium text-slate-400 uppercase">Component Name & Specs <span class="text-cyan-400 normal-case">(ALL-CAPS • Master Search)</span></label>
                  <button type="button" onclick="updateRowField('${row.id}', 'isExternal', !${ext})"
                    class="px-1.5 py-0.2 rounded text-[10px] font-bold border cursor-pointer ${ext ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'}"
                    title="Toggle Core PC vs External Peripheral">
                    ${ext ? 'External Peripheral' : 'Core PC'}
                  </button>
                </div>
                <input type="text" value="${escapeHtml(row.name)}" placeholder="Search Master Sheet or type spec..."
                  onfocus="openRowMasterAutocomplete('${row.id}', this.value)"
                  onblur="setTimeout(closeAllRowAutocompletes, 180)"
                  oninput="updateRowField('${row.id}', 'name', this.value); debouncedRowAutocomplete('${row.id}', this.value);"
                  class="w-full bg-[#1e293b] border border-[#334155] focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase placeholder-slate-500 outline-none" />
                <div id="row_ac_${row.id}" class="row-master-ac-dropdown hidden absolute left-0 right-0 top-full mt-1 z-40 bg-[#0f172a] border border-cyan-500/50 rounded-xl shadow-2xl overflow-hidden"></div>
              </div>

              <div class="col-span-6 sm:col-span-3">
                <label class="block text-[10px] font-medium text-slate-400 uppercase mb-1">Warranty</label>
                <select onchange="updateRowField('${row.id}', 'warranty', this.value)"
                  class="w-full bg-[#1e293b] border border-[#334155] focus:border-emerald-500 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none">
                  ${warOptions}
                </select>
              </div>

              <div class="col-span-3 sm:col-span-2">
                <label class="block text-[10px] font-medium text-slate-400 uppercase mb-1">Qty</label>
                <input type="number" min="1" max="99" value="${row.qty || 1}"
                  oninput="updateRowField('${row.id}', 'qty', Math.max(1, parseInt(this.value) || 1))"
                  class="w-full bg-[#1e293b] border border-[#334155] focus:border-emerald-500 rounded-lg px-2 py-1.5 text-xs font-mono text-white outline-none" />
              </div>

              <div class="col-span-5 sm:col-span-4">
                <div class="flex items-center justify-between mb-1">
                  <label class="text-[10px] font-medium text-slate-400 uppercase">${row.isNetPrice ? 'Fixed Net (₹)' : 'Base Cost (₹)'}</label>
                  <label class="inline-flex items-center gap-1 cursor-pointer" title="Check if this price is already tax-inclusive / fixed net customer price">
                    <input type="checkbox" ${row.isNetPrice ? "checked" : ""} onchange="updateRowField('${row.id}', 'isNetPrice', this.checked)"
                      class="w-3 h-3 accent-sky-500 rounded cursor-pointer" />
                    <span class="text-[10px] font-semibold ${row.isNetPrice ? 'text-sky-400' : 'text-slate-400'}">Net</span>
                  </label>
                </div>
                <input type="number" step="any" min="0" value="${row.basePrice}"
                  oninput="updateRowField('${row.id}', 'basePrice', parseFloat(this.value) || 0)"
                  class="w-full bg-[#1e293b] border border-[#334155] focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 outline-none" />
              </div>

              <div class="col-span-4 sm:col-span-3">
                <label class="block text-[10px] font-medium text-emerald-400 uppercase mb-1">Customer Total</label>
                <div id="final_price_${row.id}" class="bg-emerald-950/50 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-300 truncate">
                  ₹${formatINR(finalPrice)}/-
                </div>
              </div>

              <div class="col-span-12 sm:col-span-3 flex items-end justify-end gap-1 pt-1 sm:pt-4">
                <button type="button" onclick="insertRowAfter(${idx})"
                  class="px-2 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-800/70 text-emerald-300 border border-emerald-500/35 text-xs font-bold transition cursor-pointer" title="Insert New Row Below">
                  +
                </button>
                <button type="button" onclick="moveRow(${idx}, -1)" ${idx === 0 ? "disabled" : ""}
                  class="p-1.5 rounded-lg bg-[#1e293b] hover:bg-slate-700 disabled:opacity-30 text-slate-300 border border-[#334155] transition cursor-pointer" title="Move Up">
                  ▲
                </button>
                <button type="button" onclick="moveRow(${idx}, 1)" ${idx === state.components.length - 1 ? "disabled" : ""}
                  class="p-1.5 rounded-lg bg-[#1e293b] hover:bg-slate-700 disabled:opacity-30 text-slate-300 border border-[#334155] transition cursor-pointer" title="Move Down">
                  ▼
                </button>
                <button type="button" onclick="deleteRow('${row.id}')"
                  class="p-1.5 rounded-lg bg-[#1e293b] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-[#334155] transition cursor-pointer" title="Remove">
                  ✕
                </button>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    function addEmptyRow() {
      state.components.push({
        id: uid(),
        category: "Other",
        name: "",
        warranty: "3 Years",
        qty: 1,
        basePrice: 0,
        isNetPrice: false,
        isExternal: false
      });
      renderComponentRows();
      recalculateAll();
    }

    function insertRowAfter(index) {
      const currentRow = state.components[index];
      const suggestedCategory = currentRow ? currentRow.category : "Other";
      const newRow = {
        id: uid(),
        category: suggestedCategory,
        name: "",
        warranty: (suggestedCategory === "Cabinet" || suggestedCategory === "Keyboard & Mouse") ? "1 Year" : "3 Years",
        qty: 1,
        basePrice: 0,
        isNetPrice: false,
        isExternal: isCategoryExternal(suggestedCategory)
      };
      state.components.splice(index + 1, 0, newRow);
      renderComponentRows();
      recalculateAll();
    }

    function updateRowField(id, field, value) {
      const row = state.components.find(r => r.id === id);
      if (!row) return;
      row[field] = value;

      if (field === "category") {
        row.isExternal = isCategoryExternal(value, row.name);
        renderComponentRows();
        recalculateAll();
        return;
      }

      if (field === "isNetPrice" || field === "isExternal") {
        renderComponentRows();
        recalculateAll();
        return;
      }

      if (field === "basePrice" || field === "qty") {
        const finalPrice = calculateFinalPrice(row);
        const priceEl = document.getElementById(`final_price_${row.id}`);
        if (priceEl) priceEl.textContent = `₹${formatINR(finalPrice)}/-`;
        updateSummaryTotals();
      }
      debouncedRenderPreview();
    }

    function moveRow(index, direction) {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= state.components.length) return;
      const temp = state.components[index];
      state.components[index] = state.components[targetIndex];
      state.components[targetIndex] = temp;
      renderComponentRows();
      renderPreview();
    }

    function deleteRow(id) {
      state.components = state.components.filter(r => r.id !== id);
      renderComponentRows();
      recalculateAll();
    }

    function recalculateAll() {
      state.components.forEach(row => {
        const finalPrice = calculateFinalPrice(row);
        const priceEl = document.getElementById(`final_price_${row.id}`);
        if (priceEl) priceEl.textContent = `₹${formatINR(finalPrice)}/-`;
      });
      updateSummaryTotals();
      renderPreview();
    }
