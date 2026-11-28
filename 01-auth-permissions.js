// =========================================================================
    // 1. DYNAMIC TEAM AUTHENTICATION & GRANULAR PERMISSION ENGINE
    // =========================================================================
    const DEFAULT_TEAM_USERS = {
      ashwin: {
        username: "ashwin",
        displayName: "Ashwin",
        role: "admin",
        branch: "Calicut",
        reportScope: "ALL",
        defaultPwd: "admin@123",
        permissions: {
          canEditMasterPrices: true,
          canDedupeMergeMaster: true,
          canManagePrebuilts: true,
          canDeleteQuotes: true,
          canDeleteEnquiriesService: true,
          canOverrideMinProfit: true,
          canExportBackup: true
        }
      },
      shaheer: {
        username: "shaheer",
        displayName: "Shaheer Ali",
        role: "user",
        branch: "Calicut",
        reportScope: "SALES",
        defaultPwd: "shaheer",
        permissions: {}
      },
      athulya: {
        username: "athulya",
        displayName: "Athulya",
        role: "user",
        branch: "Calicut",
        reportScope: "ACCOUNTS",
        defaultPwd: "athulya",
        permissions: {}
      },
      adith: {
        username: "adith",
        displayName: "Adith",
        role: "user",
        branch: "Calicut",
        reportScope: "SALES_SERVICE",
        defaultPwd: "adith",
        permissions: {}
      },
      rinoj: {
        username: "rinoj",
        displayName: "Rinoj",
        role: "user",
        branch: "Calicut",
        reportScope: "SERVICE",
        defaultPwd: "rinoj",
        permissions: {}
      },
      rijil: {
        username: "rijil",
        displayName: "Rijil",
        role: "user",
        branch: "Calicut",
        reportScope: "SERVICE",
        defaultPwd: "rijil",
        permissions: {}
      }
    };

    const REPORT_SCOPE_LABELS = {
      SALES: "Sales",
      SALES_SERVICE: "Sales + Service",
      SERVICE: "Service",
      ACCOUNTS: "Accounts & Accessories",
      ALL: "Sales + Service + Accounts"
    };

    const TECH_ROLE_LABELS = {
      Rinoj: "Chief Technician",
      Adith: "In-House Technician",
      Rijil: "Visiting Technician",
      Athulya: "Accounts & Warranty/RMA",
      Ashwin: "Admin"
    };

    const QC_CHECKLIST_ITEMS = [
      { key: "xmpEnabled", label: "XMP / EXPO Enabled" },
      { key: "osDriversInstalled", label: "Windows, Softwares & Drivers Installed" },
      { key: "stressTestPassed", label: "30-Min OCCT / FurMark Stress Test Passed" },
      { key: "cableMgmtChecked", label: "Cable Management Checked" }
    ];

    const AUTH_SESSION_KEY = "mf_ops_active_session_v1";
    const AUTH_CUSTOM_PWDS_KEY = "mf_ops_custom_pwds_v1";

    let currentUser = null;

    function getAllTeamUsersMap() {
      const merged = {};
      Object.entries(DEFAULT_TEAM_USERS).forEach(([k, u]) => {
        merged[k] = JSON.parse(JSON.stringify(u));
      });
      if (typeof state !== "undefined" && state && state.customUsers && typeof state.customUsers === "object") {
        Object.entries(state.customUsers).forEach(([k, u]) => {
          if (!u) return;
          if (u.deleted && k !== "ashwin") {
            delete merged[k];
          } else {
            merged[k] = {
              ...(merged[k] || {}),
              ...u,
              permissions: {
                ...((merged[k] && merged[k].permissions) || {}),
                ...(u.permissions || {})
              }
            };
          }
        });
      }
      return merged;
    }

    function getActiveUsersList() {
      return Object.values(getAllTeamUsersMap());
    }

    function isAdminUser() {
      return Boolean(currentUser && (currentUser.role === "admin" || currentUser.username === "ashwin"));
    }

    function hasPermission(permKey) {
      if (!currentUser) return false;
      if (isAdminUser()) return true;
      const latestRecord = getAllTeamUsersMap()[currentUser.username] || currentUser;
      return Boolean(latestRecord.permissions && latestRecord.permissions[permKey]);
    }

    function toggleUserProfileDropdown(event) {
      if (event) event.stopPropagation();
      const dd = document.getElementById("userProfileDropdown");
      if (dd) dd.classList.toggle("hidden");
    }

    function closeUserProfileDropdown() {
      const dd = document.getElementById("userProfileDropdown");
      if (dd) dd.classList.add("hidden");
    }

    document.addEventListener("click", (e) => {
      const container = document.getElementById("userMenuContainer");
      if (container && !container.contains(e.target)) {
        closeUserProfileDropdown();
      }
    });

    function getCustomPasswords() {
      try {
        return JSON.parse(localStorage.getItem(AUTH_CUSTOM_PWDS_KEY) || "{}");
      } catch {
        return {};
      }
    }

    function getExpectedPassword(username) {
      const u = getAllTeamUsersMap()[username];
      if (!u) return null;
      const custom = getCustomPasswords();
      return custom[username] || u.customPwd || u.defaultPwd;
    }

    function handleTeamLogin(event) {
      if (event && event.preventDefault) event.preventDefault();
      const rawUser = (document.getElementById("loginUsernameInput").value || "").trim().toLowerCase();
      const rawPwd = document.getElementById("loginPasswordInput").value || "";
      const errBox = document.getElementById("loginErrorBox");

      const account = getAllTeamUsersMap()[rawUser];
      if (!account || rawPwd !== getExpectedPassword(rawUser)) {
        errBox.classList.remove("hidden");
        return false;
      }

      errBox.classList.add("hidden");
      currentUser = JSON.parse(JSON.stringify(account));
      sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(currentUser));
      localStorage.setItem(DB_KEYS.OWNER_PREF, currentUser.displayName);
      applySessionUiAndPermissions();
      showToast(`Welcome, ${currentUser.displayName}!`, "emerald");
      return false;
    }

    function restoreTeamSession() {
      try {
        const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        const latestAccount = parsed ? getAllTeamUsersMap()[parsed.username] : null;
        if (latestAccount) {
          currentUser = JSON.parse(JSON.stringify(latestAccount));
          localStorage.setItem(DB_KEYS.OWNER_PREF, currentUser.displayName);
          return true;
        }
      } catch {
        // Ignore
      }
      return false;
    }

    function populateDynamicTeamDatalists() {
      const users = getActiveUsersList();
      const ownersList = document.getElementById("mfOwnersList");
      if (ownersList) {
        ownersList.innerHTML = users.map(u => `<option value="${escapeHtml(u.displayName)}"></option>`).join("");
      }
      const repStaffSel = document.getElementById("repStaffSelect");
      if (repStaffSel) {
        const prev = repStaffSel.value;
        repStaffSel.innerHTML = users.map(u =>
          `<option value="${escapeHtml(u.displayName)}">${escapeHtml(u.displayName)} (${escapeHtml(REPORT_SCOPE_LABELS[u.reportScope] || "Staff")})</option>`
        ).join("");
        if (prev && users.some(u => u.displayName === prev)) {
          repStaffSel.value = prev;
        } else if (currentUser) {
          repStaffSel.value = currentUser.displayName;
        }
      }
      const repFilterStaff = document.getElementById("repFilterStaff");
      if (repFilterStaff) {
        const prevF = repFilterStaff.value || "ALL";
        repFilterStaff.innerHTML = `<option value="ALL">All Staff Members</option>` +
          users.map(u => `<option value="${escapeHtml(u.displayName)}" ${prevF === u.displayName ? "selected" : ""}>${escapeHtml(u.displayName)}</option>`).join("");
      }
    }

    function applySessionUiAndPermissions() {
      const overlay = document.getElementById("loginOverlay");
      if (!currentUser) {
        if (overlay) overlay.classList.remove("hidden");
        return;
      }
      // Refresh currentUser permissions in case Admin updated them remotely
      const refreshed = getAllTeamUsersMap()[currentUser.username];
      if (refreshed) {
        currentUser = JSON.parse(JSON.stringify(refreshed));
      } else {
        logoutTeamUser();
        return;
      }

      if (overlay) overlay.classList.add("hidden");
      populateDynamicTeamDatalists();

      const nameEl = document.getElementById("currentUserDisplayName");
      const roleBadge = document.getElementById("currentUserRoleBadge");
      const roleDot = document.getElementById("currentUserRoleDot");

      if (nameEl) nameEl.textContent = currentUser.displayName;
      if (roleBadge) {
        roleBadge.textContent = isAdminUser() ? "ADMIN" : "USER";
        roleBadge.className = isAdminUser()
          ? "px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40"
          : "px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40";
      }
      if (roleDot) {
        roleDot.className = isAdminUser() ? "w-2 h-2 rounded-full bg-amber-400" : "w-2 h-2 rounded-full bg-cyan-400";
      }

      document.querySelectorAll(".admin-only-control").forEach(el => {
        if (isAdminUser()) el.classList.remove("hidden");
        else el.classList.add("hidden");
      });

      // Delegated permission controls
      const togglePermEl = (id, permKey) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (hasPermission(permKey)) el.classList.remove("hidden");
        else el.classList.add("hidden");
      };

      togglePermEl("masterBulkImportBtn", "canEditMasterPrices");
      togglePermEl("masterAddSingleBtn", "canEditMasterPrices");
      togglePermEl("masterDedupeBtn", "canDedupeMergeMaster");
      togglePermEl("exportMasterBtn", "canExportBackup");
      togglePermEl("exportPrebuiltsBtn", "canExportBackup");

      const profitInput = document.getElementById("targetProfitInput");
      const marginInput = document.getElementById("customMarginInput");
      const canOverride = hasPermission("canOverrideMinProfit");
      if (profitInput) profitInput.min = canOverride ? "0" : "5.0";
      if (marginInput) marginInput.min = canOverride ? "0" : "24";

      const ownerInput = document.getElementById("enqOwnerInput");
      if (ownerInput) {
        ownerInput.value = currentUser.displayName;
        ownerInput.readOnly = !isAdminUser();
      }

      // Initialize Staff Reporting form for the active user
      const repStaffSel = document.getElementById("repStaffSelect");
      if (repStaffSel) {
        repStaffSel.value = currentUser.displayName;
        repStaffSel.disabled = !isAdminUser();
      }
      const repBranchInp = document.getElementById("repBranchInput");
      if (repBranchInp && currentUser.branch) {
        repBranchInp.value = currentUser.branch;
      }
      const adminModWrap = document.getElementById("repAdminModuleSwitchWrap");
      if (adminModWrap) {
        if (isAdminUser()) adminModWrap.classList.remove("hidden");
        else adminModWrap.classList.add("hidden");
      }
      applyReportModuleVisibility();

      refreshAllViews();
    }

    function logoutTeamUser() {
      currentUser = null;
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      if (state.activeTab === "admin") {
        switchWorkspaceTab("enquiries");
      }
      document.getElementById("loginUsernameInput").value = "";
      document.getElementById("loginPasswordInput").value = "";
      document.getElementById("loginErrorBox").classList.add("hidden");
      document.getElementById("loginOverlay").classList.remove("hidden");
    }

    function openPasswordModal() {
      document.getElementById("oldPwdInput").value = "";
      document.getElementById("newPwdInput").value = "";
      openModal("passwordModal");
    }

    function saveNewPassword() {
      if (!currentUser) return;
      const oldPwd = document.getElementById("oldPwdInput").value;
      const newPwd = document.getElementById("newPwdInput").value.trim();

      if (oldPwd !== getExpectedPassword(currentUser.username)) {
        showToast("Current password is incorrect.", "amber");
        return;
      }
      if (newPwd.length < 4) {
        showToast("New password must be at least 4 characters.", "amber");
        return;
      }

      const custom = getCustomPasswords();
      custom[currentUser.username] = newPwd;
      localStorage.setItem(AUTH_CUSTOM_PWDS_KEY, JSON.stringify(custom));

      if (!state.customUsers[currentUser.username]) {
        state.customUsers[currentUser.username] = JSON.parse(JSON.stringify(getAllTeamUsersMap()[currentUser.username]));
      }
      state.customUsers[currentUser.username].customPwd = newPwd;
      state.customUsers[currentUser.username].updatedAt = Date.now();
      persistDatabaseToStorage();

      closeModal("passwordModal");
      showToast("Password updated successfully!", "emerald");
    }

    function saveAdminInlinePassword() {
      if (!isAdminUser()) return;
      const oldPwd = document.getElementById("adminInlineOldPwd").value;
      const newPwd = document.getElementById("adminInlineNewPwd").value.trim();

      if (oldPwd !== getExpectedPassword(currentUser.username)) {
        showToast("Current password is incorrect.", "amber");
        return;
      }
      if (newPwd.length < 4) {
        showToast("New password must be at least 4 characters.", "amber");
        return;
      }

      const custom = getCustomPasswords();
      custom[currentUser.username] = newPwd;
      localStorage.setItem(AUTH_CUSTOM_PWDS_KEY, JSON.stringify(custom));

      if (!state.customUsers[currentUser.username]) {
        state.customUsers[currentUser.username] = JSON.parse(JSON.stringify(getAllTeamUsersMap()[currentUser.username]));
      }
      state.customUsers[currentUser.username].customPwd = newPwd;
      state.customUsers[currentUser.username].updatedAt = Date.now();
      persistDatabaseToStorage();

      document.getElementById("adminInlineOldPwd").value = "";
      document.getElementById("adminInlineNewPwd").value = "";
      showToast("Admin password updated & synced!", "emerald");
    }

    // =========================================================================
    // 1B. ADMIN TEAM & GRANULAR PERMISSION MANAGEMENT FUNCTIONS
    // =========================================================================
    function renderAdminUsersPermissionsTable() {
      const tbody = document.getElementById("adminUsersPermissionsBody");
      if (!tbody || !isAdminUser()) return;

      const users = getActiveUsersList();
      const permLabels = {
        canEditMasterPrices: "Edit Master",
        canDedupeMergeMaster: "Merge Master",
        canManagePrebuilts: "Edit Pre-Builts",
        canDeleteQuotes: "Delete Quotes",
        canDeleteEnquiriesService: "Delete Jobs/Leads",
        canOverrideMinProfit: "Floor Override",
        canExportBackup: "Export CSV"
      };

      tbody.innerHTML = users.map(u => {
        const isMainAdmin = u.username === "ashwin" || u.role === "admin";
        const activePerms = isMainAdmin
          ? `<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[10px]">FULL ADMIN ACCESS</span>`
          : Object.entries(permLabels)
              .filter(([k]) => Boolean(u.permissions && u.permissions[k]))
              .map(([, label]) => `<span class="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/35 text-[10px] font-semibold">${escapeHtml(label)}</span>`)
              .join(" ") || `<span class="text-slate-500 text-[11px]">Standard User Access Only</span>`;

        const removeBtn = u.username !== "ashwin"
          ? `<button type="button" onclick="removeTeamUser('${escapeHtml(u.username)}')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-950/60 hover:bg-red-900/70 text-red-300 border border-red-500/35 cursor-pointer">Remove</button>`
          : "";

        return `
          <tr class="hover:bg-slate-800/40 transition">
            <td class="py-3 px-3">
              <div class="font-bold text-white">${escapeHtml(u.displayName)}</div>
              <div class="text-[10px] font-mono text-slate-400">@${escapeHtml(u.username)}</div>
            </td>
            <td class="py-3 px-3 text-slate-300">${escapeHtml(u.branch || "Calicut")}</td>
            <td class="py-3 px-3">
              <span class="px-2 py-0.5 rounded bg-[#0f172a] border border-[#334155] text-[10px] font-bold text-rose-300">
                ${escapeHtml(REPORT_SCOPE_LABELS[u.reportScope] || "Sales")}
              </span>
            </td>
            <td class="py-3 px-3">
              <div class="flex flex-wrap gap-1">${activePerms}</div>
            </td>
            <td class="py-3 px-3 text-right whitespace-nowrap">
              <div class="inline-flex items-center gap-1.5">
                <button type="button" onclick="openUserEditorModal('${escapeHtml(u.username)}')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#0f172a] hover:bg-slate-700 text-cyan-300 border border-[#334155] cursor-pointer">
                  ✏️ Edit / Permissions
                </button>
                ${removeBtn}
              </div>
            </td>
          </tr>
        `;
      }).join("");
    }

    function openUserEditorModal(username = "") {
      if (!isAdminUser()) return;
      const existing = username ? getAllTeamUsersMap()[username] : null;

      document.getElementById("userEditorModalTitle").textContent = existing
        ? `Edit User: ${existing.displayName}`
        : "Add New Team Member & Permissions";
      document.getElementById("editUserOriginalUsername").value = existing ? existing.username : "";

      const uInp = document.getElementById("usrUsernameInput");
      uInp.value = existing ? existing.username : "";
      uInp.readOnly = Boolean(existing);

      document.getElementById("usrDisplayNameInput").value = existing ? existing.displayName : "";
      document.getElementById("usrPasswordInput").value = existing ? (getExpectedPassword(existing.username) || "") : "";
      document.getElementById("usrBranchInput").value = existing ? (existing.branch || "Calicut") : "Calicut";
      document.getElementById("usrRoleInput").value = existing ? (existing.role || "user") : "user";
      document.getElementById("usrReportScopeInput").value = existing ? (existing.reportScope || "SALES") : "SALES";

      const perms = (existing && existing.permissions) || {};
      const permKeys = [
        "canEditMasterPrices",
        "canDedupeMergeMaster",
        "canManagePrebuilts",
        "canDeleteQuotes",
        "canDeleteEnquiriesService",
        "canOverrideMinProfit",
        "canExportBackup"
      ];
      permKeys.forEach(k => {
        const cb = document.getElementById(`perm_${k}`);
        if (cb) cb.checked = Boolean(perms[k]);
      });

      openModal("userEditorModal");
    }

    function saveTeamUserFromModal() {
      if (!isAdminUser()) return;
      const origUser = document.getElementById("editUserOriginalUsername").value.trim().toLowerCase();
      const username = (origUser || document.getElementById("usrUsernameInput").value.trim().toLowerCase()).replace(/[^a-z0-9_]/g, "");
      const displayName = document.getElementById("usrDisplayNameInput").value.trim();
      const password = document.getElementById("usrPasswordInput").value.trim();
      const branch = document.getElementById("usrBranchInput").value;
      const role = username === "ashwin" ? "admin" : document.getElementById("usrRoleInput").value;
      const reportScope = document.getElementById("usrReportScopeInput").value;

      if (!username || !displayName || password.length < 4) {
        showToast("Enter valid username, display name & password (min 4 chars)!", "amber");
        return;
      }

      const permissions = {
        canEditMasterPrices: document.getElementById("perm_canEditMasterPrices").checked,
        canDedupeMergeMaster: document.getElementById("perm_canDedupeMergeMaster").checked,
        canManagePrebuilts: document.getElementById("perm_canManagePrebuilts").checked,
        canDeleteQuotes: document.getElementById("perm_canDeleteQuotes").checked,
        canDeleteEnquiriesService: document.getElementById("perm_canDeleteEnquiriesService").checked,
        canOverrideMinProfit: document.getElementById("perm_canOverrideMinProfit").checked,
        canExportBackup: document.getElementById("perm_canExportBackup").checked
      };

      state.customUsers[username] = {
        username,
        displayName,
        role,
        branch,
        reportScope,
        customPwd: password,
        defaultPwd: password,
        permissions,
        deleted: false,
        updatedAt: Date.now()
      };

      const customPwds = getCustomPasswords();
      customPwds[username] = password;
      localStorage.setItem(AUTH_CUSTOM_PWDS_KEY, JSON.stringify(customPwds));

      persistDatabaseToStorage();
      populateDynamicTeamDatalists();
      renderAdminUsersPermissionsTable();
      renderAdminDashboard();
      closeModal("userEditorModal");
      showToast(`Saved user "${displayName}" & updated permissions across all devices!`, "emerald");
    }

    function removeTeamUser(username) {
      if (!isAdminUser() || !username || username === "ashwin") return;
      state.customUsers[username] = {
        username,
        deleted: true,
        updatedAt: Date.now()
      };
      persistDatabaseToStorage();
      populateDynamicTeamDatalists();
      renderAdminUsersPermissionsTable();
      renderAdminDashboard();
      showToast(`User @${username} removed.`, "amber");
    }
