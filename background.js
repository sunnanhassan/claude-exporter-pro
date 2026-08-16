(() => {
    "use strict";

    chrome.runtime.onInstalled.addListener(() => {
        console.log("[Claude Exporter Pro] Service worker installed successfully.");
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "DOWNLOAD_FILE") {
            let { url, filename } = request;
            
            // Clean illegal characters for Windows/macOS file systems
            let safeFilename = (filename || "Claude-Export.md")
                .replace(/[\\/:*?"<>|\r\n\t]/g, "_")
                .trim();

            chrome.downloads.download({
                url: url,
                filename: safeFilename,
                saveAs: false
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.error("[Claude Exporter] Download error:", chrome.runtime.lastError.message);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ success: true, downloadId });
                }
            });
            return true;
        }
        return true;
    });
})();
