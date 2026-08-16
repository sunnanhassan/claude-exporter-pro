(() => {
    "use strict";

    const DEFAULT_SETTINGS = {
        showExportButtons: true,
        autoCloseSelector: false,
        filenameFormat: "{Custom Part}-{Conversation Title}",
        customFilenamePart: "Claude",
        conversationLink: true,
        artifactsContent: true,
        messageTimestamps: true,
        thoughtProcess: true,
        toolSteps: true,
        webSearch: true,
        contentTitle: true,
        useName: false,
        userName: "",
        useEmail: false,
        userEmail: "",
        dateTimeRange: "All",
        dateTimeFormat: "MM/DD/YYYY",
        dateTime24h: "24h",
        copyToClipboard: false,
        embedImagesMd: false,
        pdfLanguage: "en",
        pageBreakPerPrompt: false,
        removeIcons: false,
        removeBranding: false,
        muteExport: false
    };

    const CHECKBOX_KEYS = [
        "showExportButtons", "autoCloseSelector", "conversationLink",
        "artifactsContent", "messageTimestamps", "thoughtProcess", "toolSteps",
        "webSearch", "contentTitle", "useName", "useEmail", "copyToClipboard",
        "embedImagesMd", "pageBreakPerPrompt", "removeIcons", "removeBranding", "muteExport"
    ];

    const VALUE_KEYS = [
        "filenameFormat", "customFilenamePart", "userName", "userEmail",
        "dateTimeRange", "dateTimeFormat", "dateTime24h", "pdfLanguage"
    ];

    function showToast(msg) {
        const toast = document.getElementById("toast");
        if (toast) {
            toast.innerText = msg || "Saved!";
            toast.style.display = "block";
            setTimeout(() => { toast.style.display = "none"; }, 1800);
        }
    }

    async function getActiveClaudeTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && tab.url.includes("claude.ai")) {
            return tab;
        }
        return null;
    }

    function saveSettings() {
        const settings = {};
        CHECKBOX_KEYS.forEach(key => {
            const el = document.getElementById(key);
            if (el) settings[key] = el.checked;
        });
        VALUE_KEYS.forEach(key => {
            const el = document.getElementById(key);
            if (el) settings[key] = el.value;
        });

        chrome.storage.sync.set(settings, () => {
            showToast("Settings Saved!");
            getActiveClaudeTab().then(tab => {
                if (tab) {
                    chrome.tabs.sendMessage(tab.id, { action: "SETTINGS_UPDATED", settings });
                }
            });
        });
    }

    function loadSettings() {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
            CHECKBOX_KEYS.forEach(key => {
                const el = document.getElementById(key);
                if (el) el.checked = Boolean(items[key]);
            });
            VALUE_KEYS.forEach(key => {
                const el = document.getElementById(key);
                if (el) el.value = items[key] || DEFAULT_SETTINGS[key] || "";
            });
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        loadSettings();

        const inputs = document.querySelectorAll("input, select");
        inputs.forEach(input => {
            input.addEventListener("change", saveSettings);
            if (input.type === "text") {
                input.addEventListener("keyup", () => {
                    clearTimeout(window.__saveTimeout);
                    window.__saveTimeout = setTimeout(saveSettings, 400);
                });
            }
        });

        const openDownloads = document.getElementById("link-open-downloads");
        if (openDownloads) {
            openDownloads.addEventListener("click", (e) => {
                e.preventDefault();
                chrome.tabs.create({ url: "chrome://settings/downloads" });
            });
        }

        const btnExportNow = document.getElementById("btn-export-now");
        if (btnExportNow) {
            btnExportNow.addEventListener("click", async () => {
                const tab = await getActiveClaudeTab();
                if (!tab) {
                    alert("Please open a Claude chat at https://claude.ai first.");
                    return;
                }
                chrome.tabs.sendMessage(tab.id, { action: "TRIGGER_EXPORT" }, (res) => {
                    if (chrome.runtime.lastError) {
                        alert("Could not connect to Claude tab. Please refresh the page at https://claude.ai and try again.");
                    } else {
                        window.close();
                    }
                });
            });
        }

        const btnFeedback = document.getElementById("btn-feedback");
        if (btnFeedback) {
            btnFeedback.addEventListener("click", () => {
                alert("Thanks for using Claude Exporter Pro!");
            });
        }

        const btnExportAll = document.getElementById("btn-export-all");
        if (btnExportAll) {
            btnExportAll.addEventListener("click", async () => {
                const tab = await getActiveClaudeTab();
                if (!tab) {
                    alert("Please open https://claude.ai first to export all chats.");
                    return;
                }
                chrome.tabs.sendMessage(tab.id, { action: "EXPORT_ALL_CHATS" }, (res) => {
                    if (chrome.runtime.lastError) {
                        alert("Could not connect to Claude tab. Please refresh https://claude.ai and try again.");
                    } else {
                        window.close();
                    }
                });
            });
        }

        const btnImportChats = document.getElementById("btn-import-chats");
        const importFileInput = document.getElementById("import-file-input");
        if (btnImportChats && importFileInput) {
            btnImportChats.addEventListener("click", () => {
                importFileInput.click();
            });

            importFileInput.addEventListener("change", async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async (evt) => {
                    try {
                        const backupData = JSON.parse(evt.target.result);
                        const tab = await getActiveClaudeTab();
                        if (!tab) {
                            alert("Please open https://claude.ai first to view imported backup.");
                            return;
                        }
                        chrome.tabs.sendMessage(tab.id, { action: "IMPORT_CHATS_BACKUP", backupData }, () => {
                            window.close();
                        });
                    } catch (err) {
                        alert("Invalid JSON backup file selected.");
                    }
                };
                reader.readAsText(file);
            });
        }
    });
})();
