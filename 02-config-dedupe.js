// =========================================================================
    // 2. CORE CONSTANTS, STANDARD BUILD ORDER & USE-CASE PRESETS
    // =========================================================================
    const CATEGORIES = [
      "Processor",
      "Motherboard",
      "RAM",
      "Storage (SSD)",
      "Storage (HDD)",
      "Graphics Card",
      "CPU Cooler",
      "Power Supply",
      "Cabinet",
      "Monitor",
      "Keyboard & Mouse",
      "UPS",
      "Printer",
      "Speakers / Audio",
      "Other"
    ];

    function getCategoryRank(cat) {
      const idx = CATEGORIES.indexOf(cat);
      return idx === -1 ? CATEGORIES.length : idx;
    }

    function sortComponentsByStandardOrder(list) {
      return (list || []).slice().sort((a, b) => getCategoryRank(a.category) - getCategoryRank(b.category));
    }

    function compareMasterItemsByCategory(a, b, subSort = "price_asc") {
      const catDiff = getCategoryRank(a.category) - getCategoryRank(b.category);
      if (catDiff !== 0) return catDiff;

      if (subSort === "price_desc") return (b.gettingPrice || 0) - (a.gettingPrice || 0);
      if (subSort === "name_asc") return (a.name || "").localeCompare(b.name || "");
      if (subSort === "updated_desc") return (b.lastUpdated || "").localeCompare(a.lastUpdated || "");
      return (a.gettingPrice || 0) - (b.gettingPrice || 0);
    }

    const EXTERNAL_CATEGORIES = new Set([
      "Monitor",
      "Keyboard & Mouse",
      "UPS",
      "Printer",
      "Speakers / Audio"
    ]);

    const WARRANTIES = [
      "1 Year",
      "2 Years",
      "3 Years",
      "5 Years",
      "10 Years",
      "Lifetime"
    ];

    const USE_CASE_PRESETS = {
      gaming: {
        label: "🎮 Gaming",
        title: "High-Performance Gaming PC",
        docType: "Custom PC Build Quotation",
        highlights: [
          { title: "High-FPS Gaming Performance", desc: "Modern multi-core processor with high boost clock speeds delivers ultra-smooth frame rates in competitive esports and demanding AAA titles." },
          { title: "Next-Gen Graphics Acceleration", desc: "Dedicated discrete GPU powers crisp 1080p/1440p gameplay with hardware ray tracing, AI upscaling, and responsive frame pacing." },
          { title: "High-Speed Memory & NVMe Storage", desc: "Fast RAM paired with a high-speed NVMe SSD ensures near-instant game level loading and seamless background multitasking." },
          { title: "Optimized Thermals & Reliable Power", desc: "Efficient cooling solution and certified power supply inside a high-airflow chassis ensure stability during marathon gaming sessions." }
        ]
      },
      vfx: {
        label: "🎬 VFX & 3D",
        title: "VFX & 3D Rendering Workstation",
        docType: "Custom Workstation Quotation",
        highlights: [
          { title: "Multi-Core VFX & Simulation Power", desc: "High-core-count processor delivers exceptional multi-threaded throughput for particle simulation, caching, compositing, and 3D rendering." },
          { title: "GPU Rendering & Viewport Acceleration", desc: "Dedicated graphics card accelerates CUDA/OptiX rendering, AI denoising, and heavy 3D scene manipulation." },
          { title: "High-Bandwidth Memory & NVMe Scratch Storage", desc: "Fast memory architecture and high-speed Gen4 NVMe SSD handle large simulation caches and high-resolution texture assets effortlessly." },
          { title: "Sustained Thermal & Power Stability", desc: "Engineered with robust cooling and a high-efficiency certified power supply for uninterrupted 24/7 rendering workloads." }
        ]
      },
      autocad: {
        label: "📐 AutoCAD & CAD",
        title: "AutoCAD & 2D/3D Drafting Workstation",
        docType: "Custom Workstation Quotation",
        highlights: [
          { title: "High-Clock CAD & Multitasking Performance", desc: "Strong single-core processor speeds ensure snappy 2D drafting, large schematic navigation, and rapid calculations in AutoCAD." },
          { title: "Dedicated Viewport Graphics Acceleration", desc: "Discrete GPU provides smooth 3D viewport orbiting, hardware-accelerated line smoothing, and multi-monitor support." },
          { title: "Fast NVMe Storage & Responsive Memory", desc: "Effortlessly opens heavy DWG/BIM project files while running simultaneous office and engineering suites." },
          { title: "Reliable Everyday Engineering Build", desc: "Built with enterprise-grade stability, efficient cooling, and clean power delivery for daily architectural and engineering workflows." }
        ]
      },
      editing: {
        label: "📸 Photo / Video Editing",
        title: "Photo & 4K Video Editing Workstation",
        docType: "Custom Workstation Quotation",
        highlights: [
          { title: "Multi-Core Timeline & Batch Processing", desc: "High-performance processor accelerates RAW photo batch exports in Lightroom, layered Photoshop compositing, and 4K timeline scrubbing." },
          { title: "Hardware-Accelerated Video Encoding", desc: "Dedicated GPU speeds up effects rendering, color grading, and H.264/HEVC exports in Premiere Pro and DaVinci Resolve." },
          { title: "High-Speed RAM & NVMe Media Cache", desc: "Fast memory and NVMe SSD deliver smooth playback of high-bitrate footage and instant project catalog loading." },
          { title: "Whisper-Quiet Studio Reliability", desc: "Balanced thermal design and clean power delivery keep the workstation cool and quiet during long post-production sessions." }
        ]
      },
      printing: {
        label: "🖨️ Digital Printing",
        title: "Digital Printing & Graphic Production PC",
        docType: "Custom PC Build Quotation",
        highlights: [
          { title: "Fast Graphic & Print Spooling Performance", desc: "Multi-core processor ensures rapid rendering, RIP spooling, and smooth multitasking across CorelDRAW, Adobe Illustrator, and Photoshop." },
          { title: "High-Speed Memory & NVMe Storage", desc: "Effortlessly handles large high-DPI print layouts, vector banners, and rapid print queue file transfers." },
          { title: "Reliable Commercial Uptime", desc: "Built with durable components and stable power delivery for continuous daily printing and design studio operations." }
        ]
      },
      office: {
        label: "💼 Office & Everyday",
        title: "Everyday & Office Computing PC",
        docType: "Custom PC Build Quotation",
        highlights: [
          { title: "Reliable Everyday & Office Productivity", desc: "Efficient multi-core processor delivers smooth performance for accounting software, billing, web browsing, and office suites." },
          { title: "Fast NVMe SSD Storage", desc: "High-speed NVMe M.2 SSD ensures rapid system boot times and instant file access compared to traditional drives." },
          { title: "Compact & Durable Design", desc: "Clean, low-maintenance build engineered for dependable daily business operations." }
        ]
      }
    };

    // =========================================================================
    // 3. ALL-CAPS STANDARDIZER & CAPACITY/MODEL-SAFE FUZZY DEDUPLICATION
    // =========================================================================
    const STOP_TOKENS = new Set([
      "PROCESSOR", "CPU", "MOTHERBOARD", "MOBO", "RAM", "MEMORY", "SSD", "HDD",
      "HARD", "DISK", "DRIVE", "GRAPHICS", "CARD", "GPU", "COOLER", "AIR",
      "LIQUID", "AIO", "POWER", "SUPPLY", "SMPS", "PSU", "CABINET", "CHASSIS",
      "CASE", "MONITOR", "DISPLAY", "KEYBOARD", "MOUSE", "COMBO", "UPS", "PRINTER",
      "SPEAKER", "SPEAKERS", "EDITION", "SERIES", "BLACK", "WITH", "AND", "FOR",
      "CORES", "THREADS", "PLUS", "TEMPERED", "GLASS", "PANORAMIC", "M2"
    ]);

    function normalizeHardwareUnits(rawName) {
      return String(rawName || "")
        .toUpperCase()
        .replace(/\|.*$/, "")
        .replace(/\b1000\s*GB\b/g, "1TB")
        .replace(/\b2000\s*GB\b/g, "2TB")
        .replace(/\b4000\s*GB\b/g, "4TB")
        .replace(/\b8000\s*GB\b/g, "8TB")
        .replace(/\b(\d+)\s*(GB|TB|MHZ|W|HZ|MM|VA)\b/g, "$1$2")
        .replace(/\bDDR\s*([45])\b/g, "DDR$1")
        .replace(/\bRX\s*(\d{4})\s*(XT|GRE|XTX)?\b/g, "RX$1$2")
        .replace(/\bRTX\s*(\d{4})\s*(TI|SUPER)?\b/g, "RTX$1$2")
        .replace(/\bGTX\s*(\d{4})\s*(TI|SUPER)?\b/g, "GTX$1$2");
    }

    function buildTokenFingerprint(rawName) {
      const s = normalizeHardwareUnits(rawName)
        .replace(/[^A-Z0-9]+/g, " ")
        .trim();

      const tokens = s.split(/\s+/).filter(t => t && !STOP_TOKENS.has(t));
      const uniqueSorted = Array.from(new Set(tokens)).sort();
      return uniqueSorted.join("|");
    }

    function extractCriticalSpecSignature(rawName) {
      const s = normalizeHardwareUnits(rawName).replace(/[^A-Z0-9]+/g, " ").trim();
      const tokens = s.split(/\s+/).filter(Boolean);

      const capacities = [];
      const wattages = [];
      const frequencies = [];
      const ddrGens = [];
      const modelCodes = [];

      tokens.forEach(tok => {
        if (/^\d+(GB|TB)$/.test(tok)) {
          capacities.push(tok);
        } else if (/^\d+(W|VA)$/.test(tok)) {
          wattages.push(tok);
        } else if (/^\d+(MHZ|HZ|MM)$/.test(tok)) {
          frequencies.push(tok);
        } else if (/^DDR[345]$/.test(tok)) {
          ddrGens.push(tok);
        } else if (/\d/.test(tok) && !STOP_TOKENS.has(tok) && tok !== "80") {
          modelCodes.push(tok);
        }
      });

      const hasWifi = tokens.includes("WIFI") ? "WIFI" : "";
      const psuTier = tokens.find(t => ["BRONZE", "GOLD", "PLATINUM", "SILVER"].includes(t)) || "";

      return {
        capacities: Array.from(new Set(capacities)).sort().join(","),
        wattages: Array.from(new Set(wattages)).sort().join(","),
        frequencies: Array.from(new Set(frequencies)).sort().join(","),
        ddrGens: Array.from(new Set(ddrGens)).sort().join(","),
        modelCodes: Array.from(new Set(modelCodes)).sort().join(","),
        hasWifi,
        psuTier
      };
    }

    function haveCompatibleCriticalSpecs(nameA, nameB) {
      const sigA = extractCriticalSpecSignature(nameA);
      const sigB = extractCriticalSpecSignature(nameB);

      if (sigA.capacities !== sigB.capacities) return false;
      if (sigA.wattages !== sigB.wattages) return false;
      if (sigA.frequencies !== sigB.frequencies) return false;
      if (sigA.ddrGens !== sigB.ddrGens) return false;
      if (sigA.psuTier && sigB.psuTier && sigA.psuTier !== sigB.psuTier) return false;
      if (sigA.modelCodes !== sigB.modelCodes) return false;

      return true;
    }

    function computeLevenshteinDistance(a, b) {
      if (a === b) return 0;
      if (!a.length) return b.length;
      if (!b.length) return a.length;

      const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          const cost = b[i - 1] === a[j - 1] ? 0 : 1;
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + cost
          );
        }
      }
      return matrix[b.length][a.length];
    }

    function computeFingerprintSimilarity(fpA, fpB) {
      if (!fpA || !fpB) return 0;
      if (fpA === fpB) return 1.0;

      const strA = fpA.replace(/\|/g, " ");
      const strB = fpB.replace(/\|/g, " ");
      const maxLen = Math.max(strA.length, strB.length);
      if (maxLen === 0) return 1.0;

      const dist = computeLevenshteinDistance(strA, strB);
      const charSim = 1 - (dist / maxLen);

      const tokA = new Set(fpA.split("|"));
      const tokB = new Set(fpB.split("|"));
      let common = 0;
      tokA.forEach(t => {
        if (tokB.has(t)) common++;
      });
      const unionSize = new Set([...tokA, ...tokB]).size;
      const jaccard = unionSize > 0 ? (common / unionSize) : 0;

      return Math.max(charSim, jaccard * 0.95);
    }

    function findMasterFuzzyMatch(rawName, category = "") {
      const fp = buildTokenFingerprint(rawName);
      if (!fp) return null;

      const exactFpMatch = (state.masterItems || []).find(m => {
        if (category && category !== "Other" && m.category !== category) return false;
        const mFp = m.normKey || buildTokenFingerprint(m.name);
        return mFp === fp && haveCompatibleCriticalSpecs(rawName, m.name);
      });
      if (exactFpMatch) return { item: exactFpMatch, score: 1.0 };

      let bestMatch = null;
      let bestScore = 0;
      (state.masterItems || []).forEach(m => {
        if (category && category !== "Other" && m.category !== category) return;
        if (!haveCompatibleCriticalSpecs(rawName, m.name)) return;
        const mFp = m.normKey || buildTokenFingerprint(m.name);
        const score = computeFingerprintSimilarity(fp, mFp);
        if (score >= 0.85 && score > bestScore) {
          bestScore = score;
          bestMatch = m;
        }
      });

      return bestMatch ? { item: bestMatch, score: bestScore } : null;
    }

    function standardizeAllCapsComponentName(rawName, category = "", skipMasterLookup = false) {
      let input = String(rawName || "").trim();
      if (!input) return "";

      if (!skipMasterLookup) {
        const fuzzyHit = findMasterFuzzyMatch(input, category);
        if (fuzzyHit && fuzzyHit.item && fuzzyHit.item.name) {
          return String(fuzzyHit.item.name).toUpperCase();
        }
      }

      let suffixPipe = "";
      if (input.includes("|")) {
        const parts = input.split("|");
        input = parts[0].trim();
        suffixPipe = " | " + parts.slice(1).join(" ").trim().toUpperCase();
      }

      let upper = input
        .toUpperCase()
        .replace(/^(PROCESSOR|CPU|MOTHERBOARD|MOBO|SMPS|PSU|CABINET|CHASSIS|MONITOR)\b[:\-\s]+/i, "")
        .replace(/\s+/g, " ")
        .trim();

      upper = upper
        .replace(/\b(\d+)\s*GB\b/g, "$1GB")
        .replace(/\b(\d+)\s*TB\b/g, "$1TB")
        .replace(/\b(\d+)\s*MHZ\b/g, "$1MHZ")
        .replace(/\b(\d+)\s*W\b/g, "$1W")
        .replace(/\b(\d+)\s*HZ\b/g, "$1HZ")
        .replace(/\b(\d+)\s*MM\b/g, "$1MM")
        .replace(/\bDDR\s*([45])\b/g, "DDR$1")
        .replace(/\bWI[\-\s]?FI\b/g, "WIFI")
        .replace(/\bM\s*\.\s*2\b/g, "M.2")
        .replace(/\bNVME\s+M\.2\b/g, "NVME M.2")
        .replace(/\b80\+\s*(BRONZE|GOLD|PLATINUM|SILVER|WHITE)?\b/g, (_, tier) => tier ? `80 PLUS ${tier}` : "80 PLUS")
        .replace(/\bRX\s*(\d{4})\s*(XT|GRE|XTX)?\b/g, (_, num, ext) => ext ? `RX ${num} ${ext}` : `RX ${num}`)
        .replace(/\bRTX\s*(\d{4})\s*(TI|SUPER)?\b/g, (_, num, ext) => ext ? `RTX ${num} ${ext}` : `RTX ${num}`);

      const typoFixes = [
        [/\bVENGENCE\b/g, "VENGEANCE"],
        [/\bBARACUDA\b/g, "BARRACUDA"],
        [/\bADATA\s+LANCER\b/g, "ADATA XPG LANCER"],
        [/\bWD\s+SN(\d{4})\b/g, "WD BLACK SN$1"],
        [/\bDEEP\s*COOL\b/g, "DEEPCOOL"],
        [/\bCOOLERMASTER\b/g, "COOLER MASTER"],
        [/\bLIANLI\b/g, "LIAN LI"]
      ];
      typoFixes.forEach(([rx, rep]) => {
        upper = upper.replace(rx, rep);
      });

      if (category === "Storage (SSD)" && !/\bSSD\b/.test(upper)) {
        upper = `${upper} NVME M.2 SSD`.replace(/\bNVME\s+NVME\b/g, "NVME");
      } else if (category === "Storage (HDD)" && !/\bHDD\b/.test(upper)) {
        if (!/\bRPM\b/.test(upper)) upper = `${upper} 7200RPM`;
        upper = `${upper} HDD`;
      } else if (category === "CPU Cooler" && !/\bCOOLER\b/.test(upper)) {
        if (/\b(240MM|360MM|LE240|LE360|LS520|LS720)\b/.test(upper)) {
          upper = `${upper} LIQUID COOLER`;
        } else {
          upper = `${upper} AIR COOLER`;
        }
      } else if (category === "Cabinet" && !/\b(CABINET|CHASSIS)\b/.test(upper)) {
        upper = `${upper} TEMPERED GLASS CABINET`;
      } else if (category === "Monitor" && !/\bMONITOR\b/.test(upper)) {
        upper = `${upper} MONITOR`;
      } else if (category === "Keyboard & Mouse" && !/\b(COMBO|KEYBOARD|MOUSE)\b/.test(upper)) {
        upper = `${upper} KEYBOARD & MOUSE COMBO`;
      } else if (category === "UPS" && !/\bUPS\b/.test(upper)) {
        upper = `${upper} UPS`;
      } else if (category === "Printer" && !/\bPRINTER\b/.test(upper)) {
        upper = `${upper} PRINTER`;
      } else if (category === "Speakers / Audio" && !/\b(SPEAKER|SPEAKERS|HEADSET)\b/.test(upper)) {
        upper = `${upper} SPEAKERS`;
      }

      const cpuSpecsAllCaps = {
        "5600X": "6 CORES / 12 THREADS",
        "5700X": "8 CORES / 16 THREADS",
        "5700X3D": "8 CORES / 16 THREADS",
        "7600": "6 CORES / 12 THREADS",
        "7600X": "6 CORES / 12 THREADS",
        "9600X": "6 CORES / 12 THREADS",
        "7700X": "8 CORES / 16 THREADS",
        "9700X": "8 CORES / 16 THREADS",
        "7800X3D": "8 CORES / 16 THREADS",
        "9800X3D": "8 CORES / 16 THREADS",
        "7900X": "12 CORES / 24 THREADS",
        "9900X": "12 CORES / 24 THREADS",
        "7950X": "16 CORES / 32 THREADS",
        "9950X": "16 CORES / 32 THREADS",
        "12400F": "6 CORES / 12 THREADS",
        "13400F": "10 CORES / 16 THREADS",
        "14400F": "10 CORES / 16 THREADS",
        "14700K": "20 CORES / 28 THREADS",
        "245K": "14 CORES / 14 THREADS",
        "265K": "20 CORES / 20 THREADS",
        "285K": "24 CORES / 24 THREADS"
      };

      if ((category === "Processor" || /\b(RYZEN|CORE)\b/.test(upper)) && !suffixPipe) {
        for (const [model, spec] of Object.entries(cpuSpecsAllCaps)) {
          if (new RegExp(`\\b${model}\\b`).test(upper)) {
            suffixPipe = ` | ${spec}`;
            break;
          }
        }
      }

      return (upper + suffixPipe).replace(/\s+/g, " ").trim();
    }

    function beautifyAllCurrentRows() {
      state.components.forEach(row => {
        row.name = standardizeAllCapsComponentName(row.name, row.category, false);
      });
      renderComponentRows();
      renderPreview();
      showToast("✨ All components standardized to ALL-CAPS!", "emerald");
    }

    function analyzeMasterDuplicates() {
      const clusters = [];
      const visited = new Set();

      const items = (state.masterItems || []).slice();
      for (let i = 0; i < items.length; i++) {
        if (visited.has(items[i].id)) continue;
        const base = items[i];
        const baseFp = base.normKey || buildTokenFingerprint(base.name);
        const group = [base];
        visited.add(base.id);

        for (let j = i + 1; j < items.length; j++) {
          if (visited.has(items[j].id)) continue;
          const cand = items[j];
          if (base.category !== cand.category) continue;
          if (!haveCompatibleCriticalSpecs(base.name, cand.name)) continue;

          const candFp = cand.normKey || buildTokenFingerprint(cand.name);
          const sim = computeFingerprintSimilarity(baseFp, candFp);
          if (sim >= 0.85) {
            group.push(cand);
            visited.add(cand.id);
          }
        }

        if (group.length > 1) {
          group.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
          clusters.push(group);
        }
      }
      return clusters;
    }

    function openDeduplicateModal() {
      if (!hasPermission("canDedupeMergeMaster")) {
        showToast("You do not have permission to deduplicate Master Sheet.", "amber");
        return;
      }

      const clusters = analyzeMasterDuplicates();
      const nonCapsCount = (state.masterItems || []).filter(m => m.name !== standardizeAllCapsComponentName(m.name, m.category, true)).length;
      const summaryEl = document.getElementById("dedupePreviewSummary");

      let clustersHtml = "";
      if (clusters.length === 0) {
        clustersHtml = `<div class="text-emerald-300 font-semibold">✅ Zero duplicate components detected in Master Price Sheet! (Different capacities &amp; models are safely preserved.)</div>`;
      } else {
        clustersHtml = `
          <div class="text-amber-300 font-bold mb-2">Found ${clusters.length} true duplicate group(s) to merge safely:</div>
          <div class="max-h-44 overflow-y-auto space-y-2 pr-1">
            ${clusters.map(grp => {
              const winner = grp[0];
              const winnerName = standardizeAllCapsComponentName(winner.name, winner.category, true);
              const dupNames = grp.slice(1).map(d => `${d.name} (₹${formatINR(d.gettingPrice)})`).join(" + ");
              return `
                <div class="p-2 rounded-lg bg-[#1e293b] border border-[#334155]">
                  <div class="text-[11px] font-bold text-emerald-300">Keep Latest: ${escapeHtml(winnerName)} — ₹${formatINR(winner.gettingPrice)}</div>
                  <div class="text-[10px] text-slate-400 mt-0.5">Merge &amp; Remove: ${escapeHtml(dupNames)}</div>
                </div>
              `;
            }).join("")}
          </div>
        `;
      }

      summaryEl.innerHTML = `
        ${clustersHtml}
        <div class="pt-2 mt-2 border-t border-[#334155] text-[11px] text-slate-300">
          • <strong>${nonCapsCount}</strong> Master Sheet item(s) will be formatted to strict <strong>ALL-CAPS</strong>.<br/>
          • Different storage sizes (e.g., <code>1TB</code> vs <code>2TB</code>), RAM sizes, wattages &amp; models are <strong>never</strong> merged.<br/>
          • All <strong>Saved Quotes</strong> and <strong>Pre-Built PC Sets</strong> keep their exact historical prices and totals.
        </div>
      `;

      openModal("deduplicateModal");
    }

    async function executeMasterDeduplication() {
      if (!hasPermission("canDedupeMergeMaster")) return;

      const updateHistoricalNames = document.getElementById("dedupeUpdateHistoricalNames").checked;
      const clusters = analyzeMasterDuplicates();
      const idsToRemove = new Set();

      clusters.forEach(grp => {
        const winner = grp[0];
        const cleanWinnerName = standardizeAllCapsComponentName(winner.name, winner.category, true);
        const winnerFp = buildTokenFingerprint(cleanWinnerName);
        winner.name = cleanWinnerName;
        winner.normKey = winnerFp;
        winner.updatedAt = Date.now();

        grp.slice(1).forEach(dup => {
          idsToRemove.add(dup.id);
          recordDeletedId(dup.id);
          if (dup.normKey && dup.normKey !== winnerFp) {
            recordDeletedId(dup.normKey);
          }
        });
      });

      const dedupedMap = new Map();
      state.masterItems
        .filter(m => !idsToRemove.has(m.id))
        .forEach(m => {
          const cleanName = standardizeAllCapsComponentName(m.name, m.category, true);
          const fp = buildTokenFingerprint(cleanName);
          const compositeKey = `${m.category}::${fp}`;
          const normalizedItem = { ...m, name: cleanName, normKey: fp };
          const existing = dedupedMap.get(compositeKey);
          if (!existing) {
            dedupedMap.set(compositeKey, normalizedItem);
          } else if (Number(normalizedItem.updatedAt || 0) >= Number(existing.updatedAt || 0)) {
            recordDeletedId(existing.id);
            dedupedMap.set(compositeKey, normalizedItem);
          } else {
            recordDeletedId(normalizedItem.id);
          }
        });

      state.masterItems = Array.from(dedupedMap.values());

      if (updateHistoricalNames) {
        state.savedQuotes.forEach(q => {
          (q.components || []).forEach(c => {
            c.name = standardizeAllCapsComponentName(c.name, c.category, false);
          });
        });
        state.prebuiltSets.forEach(s => {
          (s.coreComponents || []).forEach(c => {
            c.name = standardizeAllCapsComponentName(c.name, c.category, false);
          });
        });
      }

      saveLocalOnly();
      refreshAllViews();
      closeModal("deduplicateModal");

      if (state.cloudSyncUrl) {
        await pushDirectSnapshotToCloud();
      }
      await syncMasterAndPrebuiltsToGoogleSheet(true);
      showToast(`✨ Cleaned Master Sheet (${state.masterItems.length} unique items) & applied ALL-CAPS!`, "emerald");
    }
