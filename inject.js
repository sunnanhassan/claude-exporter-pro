(() => {
    "use strict";

    if (window.__claudeExporterInjectHookInstalled) return;
    window.__claudeExporterInjectHookInstalled = true;

    const ORG_CONVO_REGEX = /\/api\/organizations\/([a-f0-9-]{36})\/chat_conversations\/([a-f0-9-]{36})/;
    const ORG_ONLY_REGEX = /\/api\/organizations\/([a-f0-9-]{36})/;

    function broadcastState(orgId, convoId) {
        window.postMessage({
            source: "claude-exporter-inject",
            type: "CLAUDE_EXPORTER_STATE",
            orgId: orgId || null,
            convoId: convoId || null,
            url: window.location.href
        }, "*");
    }

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    function onRouteUpdate() {
        setTimeout(() => {
            const url = window.location.href;
            const match = url.match(/\/chat\/([a-f0-9-]{36})/);
            if (match) {
                broadcastState(window.__activeClaudeOrgId || null, match[1]);
            }
        }, 50);
    }

    window.history.pushState = function (...args) {
        const res = originalPushState.apply(this, args);
        onRouteUpdate();
        return res;
    };

    window.history.replaceState = function (...args) {
        const res = originalReplaceState.apply(this, args);
        onRouteUpdate();
        return res;
    };

    window.addEventListener("popstate", onRouteUpdate);

    if (typeof window.fetch === "function") {
        const originalFetch = window.fetch;
        window.fetch = async function (input, init) {
            try {
                const url = typeof input === "string" ? input : (input instanceof URL ? input.href : input?.url || "");
                if (url) {
                    const matchConvo = url.match(ORG_CONVO_REGEX);
                    if (matchConvo) {
                        window.__activeClaudeOrgId = matchConvo[1];
                        broadcastState(matchConvo[1], matchConvo[2]);
                    } else {
                        const matchOrg = url.match(ORG_ONLY_REGEX);
                        if (matchOrg) {
                            window.__activeClaudeOrgId = matchOrg[1];
                        }
                    }
                }
            } catch (e) {}
            return originalFetch.apply(this, arguments);
        };
    }
})();
