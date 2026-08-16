(() => {
    "use strict";

    if (window.__claudeExporterSidebarInstalled) return;
    window.__claudeExporterSidebarInstalled = true;

    let selectedTurnIds = new Set();
    let isPanelOpen = false;
    let cachedTurns = [];
    let isExpandedAll = false;
    let selectedFormat = "md"; // Default format matches competitor screenshot

    const SVG_USER_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    const SVG_CLAUDE_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="#da7756" style="flex-shrink:0;"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"></path></svg>`;
    const SVG_SIDEBAR_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f1f5f9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>`;
    const SVG_GEAR_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="cursor:pointer;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

    // -------------------------------------------------------------
    // Floating Split Buttons (Matching Competitor Screenshot 1 & 2)
    // -------------------------------------------------------------
    function renderFloatingDock() {
        if (document.getElementById("claude-exporter-dock")) return;

        const dock = document.createElement("div");
        dock.id = "claude-exporter-dock";
        dock.style.cssText = `
            position: fixed;
            right: 24px;
            bottom: 24px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-family: system-ui, -apple-system, sans-serif;
            user-select: none;
        `;

        // 1. SELECT Split Button (Warm Coral Border)
        const selectContainer = document.createElement("div");
        selectContainer.style.cssText = `
            display: flex;
            align-items: center;
            background: #1b1e24;
            border: 1px solid #da7756;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        `;

        const btnSelectText = document.createElement("button");
        btnSelectText.innerText = "SELECT";
        btnSelectText.style.cssText = `
            background: transparent;
            color: #da7756;
            border: none;
            padding: 8px 16px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.05em;
            cursor: pointer;
        `;
        btnSelectText.onclick = () => toggleTurnSidebar();

        const btnSelectArrow = document.createElement("button");
        btnSelectArrow.innerText = "˅";
        btnSelectArrow.style.cssText = `
            background: transparent;
            color: #da7756;
            border: none;
            border-left: 1px solid #da7756;
            padding: 8px 10px;
            font-size: 12px;
            font-weight: bold;
            cursor: pointer;
        `;
        btnSelectArrow.onclick = () => toggleTurnSidebar();

        selectContainer.appendChild(btnSelectText);
        selectContainer.appendChild(btnSelectArrow);

        // 2. EXPORT Split Button (Dark Gray Rounded)
        const exportContainer = document.createElement("div");
        exportContainer.style.cssText = `
            position: relative;
            display: flex;
            align-items: center;
            background: #2d323c;
            border: 1px solid #3d4350;
            border-radius: 8px;
            overflow: visible;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        `;

        const btnExportText = document.createElement("button");
        btnExportText.innerText = "EXPORT";
        btnExportText.style.cssText = `
            background: transparent;
            color: #94a3b8;
            border: none;
            padding: 8px 16px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.05em;
            cursor: pointer;
        `;
        btnExportText.onmouseover = () => { btnExportText.style.color = "#f8fafc"; };
        btnExportText.onmouseout = () => { btnExportText.style.color = "#94a3b8"; };
        btnExportText.onclick = () => triggerExport(selectedFormat);

        const btnExportArrow = document.createElement("button");
        btnExportArrow.innerText = "˅";
        btnExportArrow.style.cssText = `
            background: transparent;
            color: #94a3b8;
            border: none;
            border-left: 1px solid #3d4350;
            padding: 8px 10px;
            font-size: 12px;
            font-weight: bold;
            cursor: pointer;
        `;
        btnExportArrow.onmouseover = () => { btnExportArrow.style.color = "#f8fafc"; };
        btnExportArrow.onmouseout = () => { btnExportArrow.style.color = "#94a3b8"; };

        // Export Format Dropdown Menu
        const dropdownMenu = document.createElement("div");
        dropdownMenu.style.cssText = `
            position: absolute;
            bottom: 100%;
            right: 0;
            margin-bottom: 6px;
            background: #1e222a;
            border: 1px solid #3d4350;
            border-radius: 8px;
            padding: 4px;
            display: none;
            flex-direction: column;
            gap: 2px;
            min-width: 145px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.6);
            z-index: 100000;
        `;

        const formats = [
            { label: "📄 PDF Document", format: "pdf" },
            { label: "📝 Markdown (.md)", format: "md" },
            { label: "📊 JSON Data", format: "json" },
            { label: "📈 CSV Table", format: "csv" },
            { label: "📄 Plain Text (.txt)", format: "txt" },
            { label: "🌐 HTML Page", format: "html" },
            { label: "📋 Copy to Clipboard", format: "clipboard" }
        ];

        formats.forEach(f => {
            const item = document.createElement("button");
            item.innerText = f.label;
            item.style.cssText = `
                background: transparent;
                color: #e2e8f0;
                border: none;
                padding: 7px 12px;
                font-size: 12px;
                text-align: left;
                border-radius: 4px;
                cursor: pointer;
                transition: background 0.15s ease;
            `;
            item.onmouseover = () => { item.style.background = "#da7756"; item.style.color = "#fff"; };
            item.onmouseout = () => { item.style.background = "transparent"; item.style.color = "#e2e8f0"; };
            item.onclick = (e) => {
                e.stopPropagation();
                dropdownMenu.style.display = "none";
                triggerExport(f.format);
            };
            dropdownMenu.appendChild(item);
        });

        btnExportArrow.onclick = (e) => {
            e.stopPropagation();
            dropdownMenu.style.display = dropdownMenu.style.display === "flex" ? "none" : "flex";
        };

        document.addEventListener("click", () => {
            dropdownMenu.style.display = "none";
        });

        exportContainer.appendChild(btnExportText);
        exportContainer.appendChild(btnExportArrow);
        exportContainer.appendChild(dropdownMenu);

        dock.appendChild(selectContainer);
        dock.appendChild(exportContainer);

        document.body.appendChild(dock);
    }

    function triggerExport(format) {
        if (window.__claudeExporter?.exportCurrentConversation) {
            window.__claudeExporter.exportCurrentConversation(format, isPanelOpen ? Array.from(selectedTurnIds) : null);
        }
        if (chrome?.storage?.sync) {
            chrome.storage.sync.get({ autoCloseSelector: false }, (items) => {
                if (items.autoCloseSelector && isPanelOpen) {
                    toggleTurnSidebar();
                }
            });
        }
    }

    // -------------------------------------------------------------
    // Sliding Sidebar Drawer (Matching Competitor Screenshot Exact)
    // -------------------------------------------------------------
    async function toggleTurnSidebar() {
        let sidebar = document.getElementById("claude-exporter-sidebar");

        if (sidebar) {
            isPanelOpen = !isPanelOpen;
            sidebar.style.transform = isPanelOpen ? "translateX(0)" : "translateX(100%)";
            return;
        }

        sidebar = document.createElement("div");
        sidebar.id = "claude-exporter-sidebar";
        sidebar.style.cssText = `
            position: fixed;
            top: 0;
            right: 0;
            width: 380px;
            height: 100vh;
            background: #171a20;
            border-left: 1px solid #2a2f3a;
            z-index: 100000;
            display: flex;
            flex-direction: column;
            box-shadow: -6px 0 24px rgba(0,0,0,0.8);
            transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            font-family: system-ui, -apple-system, sans-serif;
            color: #f1f5f9;
        `;

        // 1. Sidebar Header Bar
        const header = document.createElement("div");
        header.style.cssText = `
            padding: 12px 16px;
            border-bottom: 1px solid #2a2f3a;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #1b1e24;
        `;

        const titleBox = document.createElement("div");
        titleBox.style.cssText = `display:flex; align-items:center; gap:8px; font-weight:700; font-size:14px;`;
        titleBox.innerHTML = `${SVG_SIDEBAR_ICON} <span>Select Items</span>`;

        const btnFeedback = document.createElement("button");
        btnFeedback.innerText = "Feedback";
        btnFeedback.style.cssText = `
            background: #2a2f3a;
            color: #f1f5f9;
            border: 1px solid #3d4350;
            padding: 3px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
        `;
        btnFeedback.onclick = () => alert("Thanks for using Claude Exporter Pro!");

        header.appendChild(titleBox);
        header.appendChild(btnFeedback);
        sidebar.appendChild(header);

        // 2. Tip Banner
        const tipBanner = document.createElement("div");
        tipBanner.style.cssText = `
            background: #14161b;
            padding: 7px 12px;
            font-size: 11px;
            color: #94a3b8;
            border-bottom: 1px solid #2a2f3a;
            line-height: 1.4;
            display: flex;
            align-items: center;
            gap: 6px;
        `;
        tipBanner.innerHTML = `<span>💡</span> <span>For non-PDF formats, you can copy directly to clipboard — enable it in Settings</span>`;
        sidebar.appendChild(tipBanner);

        // 3. Selection Filter Buttons Toolbar
        const filterToolbar = document.createElement("div");
        filterToolbar.style.cssText = `
            padding: 8px 12px;
            background: #1b1e24;
            border-bottom: 1px solid #2a2f3a;
            display: flex;
            flex-direction: column;
            gap: 6px;
        `;

        const row1 = document.createElement("div");
        row1.style.cssText = `display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;`;

        const btnAll = createFilterButton("All", () => filterSelection("all"));
        const btnHuman = createFilterButton("Human", () => filterSelection("user"));
        const btnAssistant = createFilterButton("Assistant", () => filterSelection("assistant"));
        const btnNone = createFilterButton("None", () => filterSelection("none"));

        row1.appendChild(btnAll);
        row1.appendChild(btnHuman);
        row1.appendChild(btnAssistant);
        row1.appendChild(btnNone);

        const btnInvert = createFilterButton("Invert", () => filterSelection("invert"));
        btnInvert.style.width = "100%";

        filterToolbar.appendChild(row1);
        filterToolbar.appendChild(btnInvert);
        sidebar.appendChild(filterToolbar);

        // 4. Turn List Container
        const turnList = document.createElement("div");
        turnList.id = "claude-exporter-turn-list";
        turnList.style.cssText = `
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            background: #14161b;
        `;
        sidebar.appendChild(turnList);

        // 5. Sidebar Bottom Footer (Exact 2-row layout from competitor screenshot)
        const footer = document.createElement("div");
        footer.style.cssText = `
            padding: 10px 14px;
            background: #1b1e24;
            border-top: 1px solid #2a2f3a;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;

        // Footer Row 1: Checkbox, Count, Expand link on left; Settings Gear Icon on right
        const footerRow1 = document.createElement("div");
        footerRow1.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
        `;

        const footerLeft = document.createElement("div");
        footerLeft.style.cssText = `display: flex; align-items: center; gap: 8px;`;

        const footerChk = document.createElement("input");
        footerChk.type = "checkbox";
        footerChk.checked = true;
        footerChk.style.cssText = `accent-color: #da7756; cursor: pointer;`;

        const counterSpan = document.createElement("span");
        counterSpan.id = "claude-exporter-counter";
        counterSpan.style.cssText = `color: #e2e8f0; font-weight: 500;`;
        counterSpan.innerText = "0/0";

        const btnExpandToggle = document.createElement("span");
        btnExpandToggle.style.cssText = `color: #94a3b8; cursor: pointer; text-decoration: underline; margin-left: 4px;`;
        btnExpandToggle.innerText = "Expand";

        footerLeft.appendChild(footerChk);
        footerLeft.appendChild(counterSpan);
        footerLeft.appendChild(btnExpandToggle);

        const gearIconBox = document.createElement("div");
        gearIconBox.innerHTML = SVG_GEAR_ICON;
        gearIconBox.onclick = () => alert("Claude Exporter Settings: Formats, Watermark, and Clipboard active!");

        footerRow1.appendChild(footerLeft);
        footerRow1.appendChild(gearIconBox);

        // Footer Row 2: CANCEL | MARKDOWN ˅ | EXPORT
        const footerRow2 = document.createElement("div");
        footerRow2.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
        `;

        // 1. CANCEL Button
        const btnCancel = document.createElement("button");
        btnCancel.innerText = "CANCEL";
        btnCancel.style.cssText = `
            flex: 1;
            background: transparent;
            color: #ef4444;
            border: 1px solid #ef4444;
            border-radius: 6px;
            padding: 8px 0;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.05em;
            cursor: pointer;
            text-align: center;
        `;
        btnCancel.onclick = () => {
            isPanelOpen = false;
            sidebar.style.transform = "translateX(100%)";
        };

        // 2. Format Select Dropdown Button (e.g. MARKDOWN ˅)
        const btnFormatSelector = document.createElement("button");
        btnFormatSelector.style.cssText = `
            flex: 1.2;
            background: #232732;
            color: #ffffff;
            border: 1px solid #3d4350;
            border-radius: 6px;
            padding: 8px 10px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.05em;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;
        btnFormatSelector.innerHTML = `<span>MARKDOWN</span> <span style="font-size:10px;">˅</span>`;

        // 3. EXPORT Action Button (Solid Warm Coral)
        const btnActionExport = document.createElement("button");
        btnActionExport.innerText = "EXPORT";
        btnActionExport.style.cssText = `
            flex: 1;
            background: #da7756;
            color: #ffffff;
            border: none;
            border-radius: 6px;
            padding: 8px 0;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.05em;
            cursor: pointer;
            text-align: center;
            box-shadow: 0 2px 6px rgba(218,119,86,0.4);
        `;
        btnActionExport.onclick = () => triggerExport(selectedFormat);

        // Fixed Popover Menu for Format Selector
        const footerMenu = document.createElement("div");
        footerMenu.id = "claude-exporter-footer-menu";
        footerMenu.style.cssText = `
            position: fixed;
            background: #252a34;
            border: 1px solid #3d4350;
            border-radius: 6px;
            padding: 4px 0;
            display: none;
            flex-direction: column;
            min-width: 140px;
            box-shadow: 0 -8px 24px rgba(0,0,0,0.8);
            z-index: 999999;
        `;

        const formatOptions = [
            { label: "CSV", format: "csv" },
            { label: "JSON", format: "json" },
            { label: "TEXT", format: "txt" },
            { label: "MARKDOWN", format: "md" },
            { label: "PDF", format: "pdf" }
        ];

        formatOptions.forEach(f => {
            const item = document.createElement("button");
            item.innerText = f.label;
            item.style.cssText = `
                background: transparent;
                color: #f1f5f9;
                border: none;
                padding: 8px 16px;
                font-size: 11.5px;
                font-weight: 700;
                letter-spacing: 0.05em;
                text-align: left;
                cursor: pointer;
                transition: background 0.15s ease;
            `;
            item.onmouseover = () => { item.style.background = "#da7756"; item.style.color = "#fff"; };
            item.onmouseout = () => { item.style.background = "transparent"; item.style.color = "#f1f5f9"; };
            item.onclick = (e) => {
                e.stopPropagation();
                footerMenu.style.display = "none";
                selectedFormat = f.format;
                btnFormatSelector.innerHTML = `<span>${f.label}</span> <span style="font-size:10px;">˅</span>`;
            };
            footerMenu.appendChild(item);
        });

        btnFormatSelector.onclick = (e) => {
            e.stopPropagation();
            if (footerMenu.style.display === "flex") {
                footerMenu.style.display = "none";
            } else {
                const rect = btnFormatSelector.getBoundingClientRect();
                footerMenu.style.right = (window.innerWidth - rect.right) + "px";
                footerMenu.style.bottom = (window.innerHeight - rect.top + 6) + "px";
                footerMenu.style.display = "flex";
            }
        };

        document.addEventListener("click", () => {
            if (footerMenu) footerMenu.style.display = "none";
        });

        document.body.appendChild(footerMenu);

        footerRow2.appendChild(btnCancel);
        footerRow2.appendChild(btnFormatSelector);
        footerRow2.appendChild(btnActionExport);

        footer.appendChild(footerRow1);
        footer.appendChild(footerRow2);
        sidebar.appendChild(footer);

        document.body.appendChild(sidebar);
        isPanelOpen = true;

        await populateTurns(turnList, counterSpan, footerChk, btnExpandToggle);
    }

    function createFilterButton(label, onClick) {
        const btn = document.createElement("button");
        btn.innerText = label;
        btn.style.cssText = `
            background: #252a32;
            color: #e2e8f0;
            border: 1px solid #333a46;
            border-radius: 4px;
            padding: 4px 0;
            font-size: 11.5px;
            font-weight: 500;
            cursor: pointer;
            text-align: center;
        `;
        btn.onmouseover = () => { btn.style.background = "#da7756"; btn.style.color = "#fff"; };
        btn.onmouseout = () => { btn.style.background = "#252a32"; btn.style.color = "#e2e8f0"; };
        btn.onclick = onClick;
        return btn;
    }

    async function populateTurns(container, counterSpan, footerChk, btnExpandToggle) {
        container.innerHTML = `<div style="padding: 16px; font-size: 12px; color: #94a3b8;">Loading messages...</div>`;

        const { orgId, convoId } = window.__claudeExporter?.resolveCurrentIds() || {};
        let convo = await window.__claudeExporter?.fetchConversationFromAPI(orgId, convoId);

        if (!convo || convo.turns.length === 0) {
            convo = window.__claudeExporter?.parseConversationFromDOM();
        }

        container.innerHTML = "";
        selectedTurnIds.clear();
        cachedTurns = convo ? convo.turns : [];

        if (!cachedTurns || cachedTurns.length === 0) {
            container.innerHTML = `<div style="padding: 16px; font-size: 12px; color: #94a3b8;">No conversation items found.</div>`;
            if (counterSpan) counterSpan.innerText = "0/0";
            return;
        }

        cachedTurns.forEach((turn, idx) => {
            selectedTurnIds.add(String(turn.id));
            selectedTurnIds.add(String(turn.index));

            const row = document.createElement("div");
            row.id = `turn-row-${turn.id}`;
            row.style.cssText = `
                background: ${idx % 2 === 0 ? '#232832' : '#1b1e25'};
                border-bottom: 1px solid #2d3340;
                padding: 7px 12px;
                display: flex;
                align-items: center;
                gap: 8px;
                height: 34px;
                box-sizing: border-box;
                cursor: pointer;
                transition: background 0.15s ease;
            `;

            const chk = document.createElement("input");
            chk.type = "checkbox";
            chk.checked = true;
            chk.id = `turn-chk-${turn.id}`;
            chk.style.cssText = `accent-color: #da7756; cursor: pointer; flex-shrink: 0; width: 14px; height: 14px;`;

            chk.addEventListener("change", (e) => {
                if (e.target.checked) {
                    selectedTurnIds.add(String(turn.id));
                    selectedTurnIds.add(String(turn.index));
                } else {
                    selectedTurnIds.delete(String(turn.id));
                    selectedTurnIds.delete(String(turn.index));
                }
                updateCounter(counterSpan);
            });

            const iconSpan = document.createElement("span");
            iconSpan.style.cssText = `display: inline-flex; align-items: center; flex-shrink: 0;`;
            iconSpan.innerHTML = turn.role === "user" ? SVG_USER_ICON : SVG_CLAUDE_ICON;

            const firstLine = (turn.text || turn.thinking || "Turn Content").split("\n")[0].trim();

            const snippet = document.createElement("div");
            snippet.id = `turn-snippet-${turn.id}`;
            snippet.style.cssText = `
                font-size: 12px;
                color: #e2e8f0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                flex: 1;
                line-height: 1.4;
            `;
            snippet.innerText = firstLine;

            row.appendChild(chk);
            row.appendChild(iconSpan);
            row.appendChild(snippet);

            row.onclick = (e) => {
                if (e.target !== chk) {
                    toggleTurnExpand(turn.id, snippet, turn);
                }
            };

            container.appendChild(row);
        });

        updateCounter(counterSpan);

        if (footerChk) {
            footerChk.onclick = (e) => {
                filterSelection(e.target.checked ? "all" : "none");
            };
        }

        if (btnExpandToggle) {
            btnExpandToggle.onclick = () => {
                isExpandedAll = !isExpandedAll;
                btnExpandToggle.innerText = isExpandedAll ? "Collapse" : "Expand";
                cachedTurns.forEach(turn => {
                    const snippet = document.getElementById(`turn-snippet-${turn.id}`);
                    const row = document.getElementById(`turn-row-${turn.id}`);
                    if (snippet && row) {
                        if (isExpandedAll) {
                            row.style.height = "auto";
                            snippet.style.whiteSpace = "normal";
                            snippet.innerText = turn.text || turn.thinking;
                        } else {
                            row.style.height = "34px";
                            snippet.style.whiteSpace = "nowrap";
                            snippet.innerText = (turn.text || turn.thinking || "").split("\n")[0].trim();
                        }
                    }
                });
            };
        }
    }

    function toggleTurnExpand(turnId, snippetEl, turn) {
        const row = document.getElementById(`turn-row-${turnId}`);
        if (snippetEl.style.whiteSpace === "nowrap") {
            snippetEl.style.whiteSpace = "normal";
            snippetEl.innerText = turn.text || turn.thinking;
            if (row) row.style.height = "auto";
        } else {
            snippetEl.style.whiteSpace = "nowrap";
            snippetEl.innerText = (turn.text || turn.thinking || "").split("\n")[0].trim();
            if (row) row.style.height = "34px";
        }
    }

    function updateCounter(counterSpan) {
        if (counterSpan) {
            counterSpan.innerText = `${Math.floor(selectedTurnIds.size / 2)}/${cachedTurns.length}`;
        }
    }

    function filterSelection(type) {
        cachedTurns.forEach(turn => {
            const chk = document.getElementById(`turn-chk-${turn.id}`);
            if (!chk) return;

            if (type === "all") {
                chk.checked = true;
                selectedTurnIds.add(String(turn.id));
                selectedTurnIds.add(String(turn.index));
            } else if (type === "none") {
                chk.checked = false;
                selectedTurnIds.delete(String(turn.id));
                selectedTurnIds.delete(String(turn.index));
            } else if (type === "user") {
                const isMatch = turn.role === "user";
                chk.checked = isMatch;
                if (isMatch) { selectedTurnIds.add(String(turn.id)); selectedTurnIds.add(String(turn.index)); }
                else { selectedTurnIds.delete(String(turn.id)); selectedTurnIds.delete(String(turn.index)); }
            } else if (type === "assistant") {
                const isMatch = turn.role === "assistant";
                chk.checked = isMatch;
                if (isMatch) { selectedTurnIds.add(String(turn.id)); selectedTurnIds.add(String(turn.index)); }
                else { selectedTurnIds.delete(String(turn.id)); selectedTurnIds.delete(String(turn.index)); }
            } else if (type === "invert") {
                chk.checked = !chk.checked;
                if (chk.checked) { selectedTurnIds.add(String(turn.id)); selectedTurnIds.add(String(turn.index)); }
                else { selectedTurnIds.delete(String(turn.id)); selectedTurnIds.delete(String(turn.index)); }
            }
        });

        const counterSpan = document.getElementById("claude-exporter-counter");
        updateCounter(counterSpan);
    }

    setTimeout(renderFloatingDock, 1000);
})();
