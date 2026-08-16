(() => {
    "use strict";

    if (window.__claudeExporterContentInstalled) return;
    window.__claudeExporterContentInstalled = true;

    let activeOrgId = null;
    let activeConvoId = null;
    let currentSettings = {
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

    if (chrome?.storage?.sync) {
        chrome.storage.sync.get(currentSettings, (items) => {
            currentSettings = { ...currentSettings, ...items };
        });
    }

    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
        if (req.action === "SETTINGS_UPDATED") {
            currentSettings = { ...currentSettings, ...req.settings };
            window.dispatchEvent(new CustomEvent("CLAUDE_EXPORTER_RELOAD_DOCK"));
            sendResponse({ success: true });
        } else if (req.action === "TRIGGER_EXPORT") {
            exportCurrentConversation(req.format || "pdf");
            sendResponse({ success: true });
        } else if (req.action === "EXPORT_ALL_CHATS") {
            exportAllChats();
            sendResponse({ success: true });
        } else if (req.action === "IMPORT_CHATS_BACKUP") {
            importChatsBackup(req.backupData);
            sendResponse({ success: true });
        }
        return true;
    });

    window.addEventListener("message", (event) => {
        if (event.data && event.data.source === "claude-exporter-inject") {
            if (event.data.orgId) activeOrgId = event.data.orgId;
            if (event.data.convoId) activeConvoId = event.data.convoId;
        }
    });

    function showOnScreenToast(message) {
        if (currentSettings.muteExport) return;

        let toast = document.getElementById("claude-exporter-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "claude-exporter-toast";
            toast.style.cssText = `
                position: fixed;
                bottom: 32px;
                left: 50%;
                transform: translateX(-50%) translateY(10px);
                z-index: 999999;
                background: #da7756;
                color: #ffffff;
                padding: 10px 22px;
                border-radius: 24px;
                font-size: 13px;
                font-weight: 500;
                font-family: system-ui, -apple-system, sans-serif;
                box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                transition: opacity 0.25s ease, transform 0.25s ease;
                pointer-events: none;
                opacity: 0;
            `;
            document.body.appendChild(toast);
        }
        toast.innerText = message;
        toast.style.opacity = "1";
        toast.style.transform = "translateX(-50%) translateY(0)";

        clearTimeout(window.__exporterToastTimeout);
        window.__exporterToastTimeout = setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(-50%) translateY(10px)";
        }, 2600);
    }

    function resolveCurrentIds() {
        let convoId = activeConvoId;
        if (!convoId) {
            const match = window.location.href.match(/\/chat\/([a-f0-9-]{36})/);
            if (match) convoId = match[1];
        }

        let orgId = activeOrgId;
        if (!orgId) {
            const matchOrg = document.cookie.match(/lastActiveOrg=([a-f0-9-]{36})/);
            if (matchOrg) orgId = matchOrg[1];
        }
        return { orgId, convoId };
    }

    async function fetchConversationFromAPI(orgId, convoId) {
        if (!orgId || !convoId) return null;
        try {
            const url = `https://claude.ai/api/organizations/${orgId}/chat_conversations/${convoId}?tree=true`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) return null;
            const data = await res.json();
            return parseAPIConversation(data);
        } catch (err) {
            return null;
        }
    }

    function parseAPIConversation(data) {
        const title = data.name || data.title || getDOMTitle() || "Claude Conversation";
        const rawMessages = data.chat_messages || data.messages || [];

        const turns = [];
        rawMessages.forEach((msg, idx) => {
            const role = msg.sender === "human" ? "user" : "assistant";
            let textContent = "";
            let thinkingContent = "";
            const artifacts = [];
            const toolSteps = [];
            const webSources = [];
            const attachments = [];

            if (Array.isArray(msg.content)) {
                msg.content.forEach((block) => {
                    if (block.type === "text") {
                        textContent += block.text + "\n";
                    } else if (block.type === "thinking") {
                        thinkingContent += block.thinking + "\n";
                    } else if (block.type === "tool_use") {
                        toolSteps.push({ name: block.name, input: block.input });
                        if (block.name === "web_search" && block.input?.query) {
                            webSources.push({ query: block.input.query });
                        }
                    } else if (block.type === "tool_result") {
                        toolSteps.push({ type: "result", content: block.content });
                    }
                });
            } else if (typeof msg.text === "string") {
                textContent = msg.text;
            }

            if (Array.isArray(msg.attachments)) {
                msg.attachments.forEach(att => {
                    attachments.push({
                        fileName: att.file_name || att.name || "Attachment",
                        fileSize: att.file_size || 0,
                        extractedText: att.extracted_content || att.extractedText || ""
                    });
                });
            }

            if (Array.isArray(msg.content)) {
                msg.content.forEach(block => {
                    if (block.type === "tool_use" && block.name === "artifacts") {
                        artifacts.push({
                            id: block.input?.id || `artifact-${idx}`,
                            title: block.input?.title || "Artifact",
                            type: block.input?.type || "text",
                            content: block.input?.content || ""
                        });
                    }
                });
            }

            turns.push({
                id: msg.uuid || `turn-${idx}`,
                index: idx + 1,
                role: role,
                text: textContent.trim(),
                thinking: thinkingContent.trim(),
                artifacts: artifacts,
                toolSteps: toolSteps,
                webSources: webSources,
                attachments: attachments,
                createdAt: msg.created_at || new Date().toISOString(),
                updatedAt: msg.updated_at || new Date().toISOString()
            });
        });

        return {
            title: title,
            url: window.location.href,
            uuid: data.uuid || activeConvoId,
            createdAt: data.created_at || new Date().toISOString(),
            updatedAt: data.updated_at || new Date().toISOString(),
            turns: turns
        };
    }

    function getDOMTitle() {
        const titleEl = document.querySelector("title");
        if (titleEl && titleEl.innerText) {
            const clean = titleEl.innerText.replace("- Claude", "").replace("Claude", "").trim();
            if (clean && clean !== "Claude") return clean;
        }
        const h1El = document.querySelector("h1");
        if (h1El && h1El.innerText) return h1El.innerText.trim();
        return null;
    }

    function parseConversationFromDOM() {
        const title = getDOMTitle() || "Claude Conversation";
        const turnEls = document.querySelectorAll("[class*='font-claude-message'], [data-testid*='message'], div.grid.grid-cols-1");
        const turns = [];

        turnEls.forEach((el, idx) => {
            const isUser = el.querySelector("[data-testid='user-message']") || el.innerText.includes("Human:") || el.getAttribute("data-is-user") === "true";
            const role = isUser ? "user" : "assistant";

            let thinking = "";
            const thinkingEl = el.querySelector("[class*='thinking'], [class*='reasoning']");
            if (thinkingEl) {
                thinking = thinkingEl.innerText.trim();
            }

            const artifacts = [];
            const artifactEls = el.querySelectorAll("[class*='artifact'], [data-testid*='artifact']");
            artifactEls.forEach((art, aIdx) => {
                artifacts.push({
                    id: `dom-art-${idx}-${aIdx}`,
                    title: art.querySelector("[class*='title']")?.innerText || "Rendered Artifact",
                    content: art.innerText.trim()
                });
            });

            const clone = el.cloneNode(true);
            if (thinkingEl) clone.querySelector("[class*='thinking']")?.remove();
            artifactEls.forEach(a => a.remove());

            const text = clone.innerText.trim();

            if (text || thinking || artifacts.length > 0) {
                turns.push({
                    id: `dom-turn-${idx}`,
                    index: idx + 1,
                    role: role,
                    text: text,
                    thinking: thinking,
                    artifacts: artifacts,
                    toolSteps: [],
                    webSources: [],
                    attachments: [],
                    createdAt: new Date().toISOString()
                });
            }
        });

        return {
            title: title,
            url: window.location.href,
            uuid: activeConvoId || "dom-export",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            turns: turns
        };
    }

    function formatFilename(title, customPart, formatTemplate) {
        let cleanTitle = (title || "Claude Conversation")
            .replace(/[\\/:*?"<>|\r\n\t]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        if (cleanTitle.length > 70) cleanTitle = cleanTitle.slice(0, 70).trim();

        const custom = (customPart || "Claude").replace(/[\\/:*?"<>|\r\n\t]/g, "").trim();

        const now = new Date();
        const YYYY = now.getFullYear();
        const MM = String(now.getMonth() + 1).padStart(2, "0");
        const DD = String(now.getDate()).padStart(2, "0");
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");

        const YYYYMMDD = `${YYYY}${MM}${DD}`;
        const HHMM = `${hh}${mm}`;
        const timestamp = `${YYYYMMDD}-${HHMM}`;

        let template = formatTemplate || "{Custom Part}-{Conversation Title}";
        let result = template
            .replace(/{Custom Part}/g, custom)
            .replace(/{Conversation Title}/g, cleanTitle)
            .replace(/{Timestamp}/g, timestamp)
            .replace(/{YYYYMMDD}/g, YYYYMMDD)
            .replace(/{HHMM}/g, HHMM);

        if (result === template && !template.includes("{")) {
            result = `${custom}-${cleanTitle}-${timestamp}`;
        }
        return result.replace(/[\\/:*?"<>|\r\n\t]/g, "_").trim();
    }

    function formatDateFormatted(dateInput, settings = {}) {
        if (!dateInput) return "";
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return String(dateInput);

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');

        const isEU = settings.dateTimeFormat === "DD/MM/YYYY";
        const dateStr = isEU ? `${day}/${month}/${year}` : `${month}/${day}/${year}`;

        let hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');

        let timeStr = "";
        if (settings.dateTime24h === "12h") {
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // 0 becomes 12
            timeStr = `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
        } else {
            timeStr = `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
        }

        return `${dateStr} ${timeStr}`;
    }

    function escapeHTML(str) {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatTextWithCodeBlocks(text) {
        if (!text) return "";
        const parts = text.split(/(```[\s\S]*?```)/g);
        let html = "";
        parts.forEach(part => {
            if (part.startsWith("```")) {
                const lines = part.slice(3, -3).trim().split("\n");
                const firstLine = lines[0].trim();
                let lang = "code";
                let code = part.slice(3, -3).trim();
                if (firstLine && !firstLine.includes(" ") && firstLine.length < 15) {
                    lang = firstLine;
                    code = lines.slice(1).join("\n");
                }
                html += `
                    <div class="code-container">
                        <div class="code-header"><span>${lang.toUpperCase()}</span><span>COPY</span></div>
                        <pre class="code-body"><code>${escapeHTML(code)}</code></pre>
                    </div>
                `;
            } else {
                html += escapeHTML(part).replace(/\n/g, "<br>");
            }
        });
        return html;
    }

    // Competitor-Identical Markdown Generator
    function generateMarkdown(data, settings = {}) {
        const formattedCreated = formatDateFormatted(data.createdAt, settings);
        const formattedUpdated = formatDateFormatted(data.updatedAt, settings);
        const formattedExported = formatDateFormatted(new Date(), settings);

        let md = "";

        if (settings.contentTitle !== false) {
            md += `# ${data.title}\n\n`;
        }

        if (settings.useName || settings.useEmail) {
            const nameStr = settings.useName ? (settings.userName || "User") : "";
            const emailStr = settings.useEmail ? `<${settings.userEmail || "user@mail.com"}>` : "";
            md += `**Author:** ${nameStr} ${emailStr}`.trim() + "  \n";
        }

        md += `**Created:** ${formattedCreated}  \n`;
        md += `**Updated:** ${formattedUpdated}  \n`;
        md += `**Exported:** ${formattedExported}  \n`;
        
        if (settings.conversationLink !== false && data.url) {
            md += `**Link:** [${data.url}](${data.url})  \n`;
        }
        md += `\n`;

        data.turns.forEach(turn => {
            const roleTitle = turn.role === "user" ? "## User:" : "## Assistant:";
            md += `${roleTitle}\n\n`;

            if (settings.messageTimestamps !== false && turn.createdAt) {
                md += `> ${formatDateFormatted(turn.createdAt, settings)}\n\n`;
            }

            let cleanText = (turn.text || "")
                .replace(/```\s*This block is not supported on your current device yet\.\s*```/g, "")
                .replace(/This block is not supported on your current device yet\./g, "")
                .trim();

            if (settings.thoughtProcess !== false && turn.thinking) {
                md += `> ${turn.thinking.replace(/\n/g, "\n> ")}\n\n`;
            }

            if (cleanText) {
                md += `${cleanText}\n\n`;
            }

            if (settings.webSearch !== false && turn.webSources && turn.webSources.length > 0) {
                md += `**🌐 Web Search Sources:**\n`;
                turn.webSources.forEach(src => {
                    md += `- Source: ${src.query || 'Search'}\n`;
                });
                md += "\n";
            }

            if (settings.toolSteps !== false && turn.toolSteps && turn.toolSteps.length > 0) {
                md += `**🔧 Tool Steps:**\n`;
                turn.toolSteps.forEach(tool => {
                    md += `- Tool: \`${tool.name || tool.type || 'Execution'}\`\n`;
                });
                md += "\n";
            }

            if (turn.attachments && turn.attachments.length > 0) {
                md += `**📎 Attachments:**\n`;
                turn.attachments.forEach(att => {
                    md += `- \`${att.fileName}\`\n`;
                });
                md += "\n";
            }

            if (settings.artifactsContent !== false && turn.artifacts && turn.artifacts.length > 0) {
                turn.artifacts.forEach(art => {
                    md += `### 📦 Artifact: ${art.title}\n\`\`\`${art.type || 'markdown'}\n${art.content}\n\`\`\`\n\n`;
                });
            }
        });

        return md;
    }

    function cleanTurnText(text) {
        if (!text) return "";
        return text
            .replace(/```\s*This block is not supported on your current device yet\.\s*```/g, "")
            .replace(/This block is not supported on your current device yet\./g, "")
            .trim();
    }

    function generateJSON(data, settings) {
        const cleanedData = {
            ...data,
            turns: data.turns.map(t => ({
                ...t,
                text: cleanTurnText(t.text)
            }))
        };
        return JSON.stringify(cleanedData, null, 2);
    }

    function generateCSV(data, settings) {
        let csv = "Turn,Role,Timestamp,Content\n";
        data.turns.forEach(turn => {
            const text = cleanTurnText(turn.text);
            const cleanContent = `"${text.replace(/"/g, '""')}"`;
            csv += `${turn.index},"${turn.role}","${turn.createdAt}",${cleanContent}\n`;
        });
        return csv;
    }

    function generateText(data, settings) {
        let txt = `${data.title}\n${"=".repeat(data.title.length)}\n\n`;
        data.turns.forEach(turn => {
            const text = cleanTurnText(turn.text);
            txt += `[${turn.role.toUpperCase()}] - ${formatDateFormatted(turn.createdAt)}\n`;
            if (turn.thinking) txt += `(Thinking: ${turn.thinking})\n`;
            txt += `${text}\n\n---------------------------------------\n\n`;
        });
        return txt;
    }

    function renderMarkdownToHTML(text) {
        if (!text) return "";

        let content = text.trim();

        const codeBlocks = [];
        content = content.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const index = codeBlocks.length;
            const safeLang = (lang || 'text').toUpperCase();
            const safeCode = escapeHTML(code.trim());
            codeBlocks.push(`
                <div class="code-container">
                    <div class="code-header">
                        <span>${safeLang}</span>
                        <span>Code Block</span>
                    </div>
                    <pre class="code-body"><code>${safeCode}</code></pre>
                </div>
            `);
            return `__CODE_BLOCK_${index}__`;
        });

        content = escapeHTML(content);

        content = content.replace(/^### (.*$)/gim, '<h4 class="pdf-h4">$1</h4>');
        content = content.replace(/^## (.*$)/gim, '<h3 class="pdf-h3">$1</h3>');
        content = content.replace(/^# (.*$)/gim, '<h2 class="pdf-h2">$1</h2>');

        content = content.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
        content = content.replace(/___(.*?)___/g, '<strong><em>$1</em></strong>');
        content = content.replace(/__(.*?)__/g, '<strong>$1</strong>');
        content = content.replace(/_(.*?)_/g, '<em>$1</em>');

        content = content.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        content = content.replace(/^\&gt;\s?(.*$)/gim, '<blockquote class="pdf-quote">$1</blockquote>');

        content = content.replace(/^[\s]*[-\*]\s+(.*$)/gim, '<li class="pdf-li">$1</li>');
        content = content.replace(/(<li class="pdf-li">.*<\/li>\s*)+/g, '<ul class="pdf-ul">$&</ul>');

        content = content.replace(/^[\s]*\d+\.\s+(.*$)/gim, '<li class="pdf-oli">$1</li>');
        content = content.replace(/(<li class="pdf-oli">.*<\/li>\s*)+/g, '<ol class="pdf-ol">$&</ol>');

        const paragraphs = content.split(/\n\n+/);
        content = paragraphs.map(p => {
            p = p.trim();
            if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<ol') || p.startsWith('<blockquote') || p.startsWith('__CODE_BLOCK_')) {
                return p;
            }
            return `<p class="pdf-p">${p.replace(/\n/g, '<br>')}</p>`;
        }).join('\n');
                codeBlocks.forEach((blockHtml, idx) => {
            content = content.replace(`__CODE_BLOCK_${idx}__`, blockHtml);
        });

        return content;
    }

    function generateProfessionalPDFHTML(data, settings = {}) {
        const formattedDate = formatDateFormatted(new Date(), settings);
        const lang = settings.pdfLanguage || "en";

        let tocItems = "";
        data.turns.forEach((turn, idx) => {
            const snippet = (turn.text || turn.thinking || "Turn Content").slice(0, 60) + "...";
            const roleClass = turn.role === "user" ? "user" : "assistant";
            const roleLabel = settings.removeIcons ? (turn.role === "user" ? "User" : "Claude") : (turn.role === "user" ? "👤 User" : "🤖 Claude");
            tocItems += `
                <li class="toc-item">
                    <span><strong>#${idx + 1}</strong> <span class="toc-role ${roleClass}">${roleLabel}</span>: ${escapeHTML(snippet)}</span>
                </li>
            `;
        });

        const pageBreakCSS = settings.pageBreakPerPrompt ? ".turn-card { break-before: page; page-break-before: always; }" : "";

        let html = `<!DOCTYPE html>
<html lang="${escapeHTML(lang)}">
<head>
    <meta charset="utf-8">
    <title>${escapeHTML(data.title)}</title>
    <style>
        @page {
            size: A4;
            margin: 18mm 15mm 18mm 15mm;
        }

        ${pageBreakCSS}

        :root {
            --primary: #da7756;
            --primary-bg: rgba(218, 119, 86, 0.08);
            --user-accent: #2563eb;
            --user-bg: rgba(37, 99, 235, 0.06);
            --text-main: #0f172a;
            --text-muted: #64748b;
            --border-color: #e2e8f0;
            --code-bg: #0d1117;
            --code-text: #c9d1d9;
        }

        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            color: var(--text-main);
            background: #ffffff;
            line-height: 1.65;
            font-size: 13.5px;
            margin: 0;
            padding: 30px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .pdf-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 16px;
            border-bottom: 2px solid var(--border-color);
            margin-bottom: 24px;
        }

        .pdf-title {
            font-size: 22px;
            font-weight: 700;
            color: var(--text-main);
            margin: 0 0 8px 0;
            letter-spacing: -0.02em;
        }

        .pdf-meta-pills {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .pill {
            background: #f1f5f9;
            color: var(--text-muted);
            padding: 4px 10px;
            border-radius: 16px;
            font-size: 11px;
            font-weight: 600;
        }

        .pill.brand {
            background: var(--primary-bg);
            color: var(--primary);
        }

        .toc-container {
            background: #f8fafc;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 28px;
        }
        .toc-title {
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            margin-bottom: 10px;
        }
        .toc-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .toc-item {
            font-size: 12px;
            padding: 4px 0;
            border-bottom: 1px dashed #e2e8f0;
        }
        .toc-item:last-child { border-bottom: none; }
        .toc-role {
            font-weight: 600;
        }
        .toc-role.user { color: var(--user-accent); }
        .toc-role.assistant { color: var(--primary); }

        .turns-wrapper {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .turn-card {
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 18px 20px;
            background: #ffffff;
            page-break-inside: avoid;
        }

        .turn-card.user {
            border-left: 4px solid var(--user-accent);
            background: var(--user-bg);
        }

        .turn-card.assistant {
            border-left: 4px solid var(--primary);
            background: #ffffff;
        }

        .turn-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(0,0,0,0.05);
        }

        .turn-badge {
            font-weight: 700;
            font-size: 13px;
        }
        .turn-badge.user { color: var(--user-accent); }
        .turn-badge.assistant { color: var(--primary); }

        .thinking-box {
            background: #fffbe6;
            border: 1px solid #ffe58f;
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 16px;
            font-size: 12.5px;
            color: #92400e;
        }

        .code-container {
            background: var(--code-bg);
            border-radius: 8px;
            margin: 14px 0;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .code-header {
            background: #161b22;
            padding: 6px 14px;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            font-family: 'Fira Code', monospace;
            color: #8b949e;
            border-bottom: 1px solid #21262d;
        }
        .code-body {
            margin: 0;
            padding: 14px;
            font-family: 'Fira Code', monospace;
            font-size: 12px;
            color: var(--code-text);
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-all;
        }

        .artifact-card {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            padding: 14px 18px;
            margin: 14px 0;
        }
        .artifact-title {
            font-size: 13px;
            font-weight: 700;
            color: #166534;
            margin-bottom: 8px;
        }
        .pdf-h2 { font-size: 18px; margin: 16px 0 8px; }
        .pdf-h3 { font-size: 16px; margin: 14px 0 6px; }
        .pdf-h4 { font-size: 14px; margin: 12px 0 4px; }
        .pdf-p { margin: 8px 0; }
        .pdf-quote { border-left: 3px solid var(--border-color); padding-left: 12px; color: var(--text-muted); }
        .inline-code { background: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-family: monospace; }
    </style>
</head>
<body>

    <div class="pdf-header">
        <div>
            <h1 class="pdf-title">${escapeHTML(data.title)}</h1>
            <div class="pdf-meta-pills">
                ${settings.removeBranding ? '' : '<span class="pill brand">🤖 Claude AI Export</span>'}
                <span class="pill">📅 ${formattedDate}</span>
                <span class="pill">💬 ${data.turns.length} Messages</span>
            </div>
        </div>
    </div>

    <div class="toc-container">
        <div class="toc-title">Table of Contents</div>
        <ul class="toc-list">
            ${tocItems}
        </ul>
    </div>

    <div class="turns-wrapper">
`;

        data.turns.forEach((turn, idx) => {
            const roleClass = turn.role === "user" ? "user" : "assistant";
            const roleBadge = settings.removeIcons ? (turn.role === "user" ? "User" : "Claude") : (turn.role === "user" ? "👤 User" : "🤖 Claude");
            const formattedTurnDate = formatDateFormatted(turn.createdAt, settings);

            html += `
                <div class="turn-card ${roleClass}">
                    <div class="turn-header">
                        <span class="turn-badge ${roleClass}">${roleBadge}</span>
                        ${settings.messageTimestamps !== false ? `<span style="font-size: 11px; color: #94a3b8;">${formattedTurnDate}</span>` : ''}
                    </div>
                    <div class="turn-body">
            `;

            if (settings.thoughtProcess !== false && turn.thinking) {
                html += `
                    <div class="thinking-box">
                        <strong style="display:block; margin-bottom:4px;">🧠 Internal Reasoning:</strong>
                        ${escapeHTML(turn.thinking).replace(/\n/g, "<br>")}
                    </div>
                `;
            }

            let cleanText = (turn.text || "")
                .replace(/```\s*This block is not supported on your current device yet\.\s*```/g, "")
                .replace(/This block is not supported on your current device yet\./g, "")
                .trim();

            if (cleanText) {
                html += renderMarkdownToHTML(cleanText);
            }

            if (settings.artifactsContent !== false && turn.artifacts && turn.artifacts.length > 0) {
                turn.artifacts.forEach(art => {
                    html += `
                        <div class="artifact-card">
                            <div class="artifact-title">📦 Artifact: ${escapeHTML(art.title)}</div>
                            ${renderMarkdownToHTML("```" + (art.type || 'text') + "\n" + art.content + "\n```")}
                        </div>
                    `;
                });
            }

            html += `
                    </div>
                </div>
            `;
        });

        html += `
    </div>
</body>
</html>
`;
        return html;
    }

    function triggerIframePrint(htmlContent) {
        let iframe = document.getElementById("claude-exporter-print-iframe");
        if (iframe) iframe.remove();

        iframe = document.createElement("iframe");
        iframe.id = "claude-exporter-print-iframe";
        iframe.style.cssText = "position: fixed; right: 0; bottom: 0; width: 0; height: 0; border: none; z-index: -9999; opacity: 0; pointer-events: none;";
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(htmlContent);
        doc.close();

        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }, 500);
    }

    async function exportCurrentConversation(format = "pdf", selectedTurnIds = null) {
        const { orgId, convoId } = resolveCurrentIds();
        let convoData = await fetchConversationFromAPI(orgId, convoId);

        if (!convoData || convoData.turns.length === 0) {
            convoData = parseConversationFromDOM();
        }

        if (!convoData || convoData.turns.length === 0) {
            showOnScreenToast("⚠️ No messages found in current chat.");
            return;
        }

        if (selectedTurnIds && Array.isArray(selectedTurnIds) && selectedTurnIds.length > 0) {
            const selectedSet = new Set(selectedTurnIds.map(String));
            convoData.turns = convoData.turns.filter((t, idx) => 
                selectedSet.has(String(t.id)) || 
                selectedSet.has(String(t.uuid)) || 
                selectedSet.has(String(t.index)) || 
                selectedSet.has(String(idx + 1))
            );
        }

        if (format === "pdf") {
            const rawFilename = `${formatFilename(convoData.title, currentSettings.customFilenamePart, currentSettings.filenameFormat)}.pdf`;
            const safeFilename = rawFilename.replace(/[\\/:*?"<>|\r\n\t]/g, "_");
            const htmlContent = generateProfessionalPDFHTML(convoData, currentSettings);

            showOnScreenToast("📄 Generating Professional PDF...");

            // Create an isolated hidden iframe with visibility hidden so layout bounds are calculated
            const iframe = document.createElement("iframe");
            iframe.style.cssText = "position: absolute; left: -9999px; top: 0; width: 790px; height: 1000px; border: none; visibility: hidden;";
            document.body.appendChild(iframe);

            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(htmlContent);
            iframeDoc.close();

            setTimeout(() => {
                const pdfEngine = window.html2pdf || self.html2pdf || globalThis.html2pdf || (iframe.contentWindow && iframe.contentWindow.html2pdf);

                if (pdfEngine) {
                    const opt = {
                        margin: [10, 10, 10, 10],
                        filename: safeFilename,
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: 800 },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                    };

                    pdfEngine().set(opt).from(iframeDoc.body).save().then(() => {
                        if (iframe.parentNode) document.body.removeChild(iframe);
                        showOnScreenToast(`📥 Exported as ${safeFilename}`);
                    }).catch((err) => {
                        console.warn("[Claude Exporter] PDF engine warning inside iframe, using print fallback:", err);
                        if (iframe.parentNode) document.body.removeChild(iframe);
                        triggerIframePrint(htmlContent);
                    });
                } else {
                    console.warn("[Claude Exporter] html2pdf engine missing, using print fallback.");
                    if (iframe.parentNode) document.body.removeChild(iframe);
                    triggerIframePrint(htmlContent);
                }
            }, 400);

            return;
        }

        let outputContent = "";
        let mimeType = "text/plain";
        let extension = format;

        if (format === "html") {
            outputContent = generateProfessionalPDFHTML(convoData, currentSettings);
            mimeType = "text/html";
            extension = "html";
        } else if (format === "md" || format === "markdown") {
            outputContent = generateMarkdown(convoData, currentSettings);
            mimeType = "text/markdown";
            extension = "md";
        } else if (format === "json") {
            outputContent = generateJSON(convoData, currentSettings);
            mimeType = "application/json";
            extension = "json";
        } else if (format === "csv") {
            outputContent = generateCSV(convoData, currentSettings);
            mimeType = "text/csv";
            extension = "csv";
        } else if (format === "txt") {
            outputContent = generateText(convoData, currentSettings);
            mimeType = "text/plain";
            extension = "txt";
        }

        if (currentSettings.copyToClipboard || format === "clipboard") {
            try {
                await navigator.clipboard.writeText(outputContent);
                showOnScreenToast("📋 Copied conversation to clipboard!");
                if (format === "clipboard") return;
            } catch (err) {}
        }

        const rawFilename = `${formatFilename(convoData.title, currentSettings.customFilenamePart, currentSettings.filenameFormat)}.${extension}`;
        const safeFilename = rawFilename.replace(/[\\/:*?"<>|\r\n\t]/g, "_");

        const blob = new Blob([outputContent], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = safeFilename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            if (a.parentNode) document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);

        showOnScreenToast(`📥 Exported as ${safeFilename}`);
    }

    async function exportAllChats() {
        let { orgId } = resolveCurrentIds();
        if (!orgId) {
            const matchOrg = document.cookie.match(/lastActiveOrg=([a-f0-9-]{36})/);
            if (matchOrg) orgId = matchOrg[1];
        }

        if (!orgId) {
            showOnScreenToast("⚠️ Could not detect active Organization ID.");
            return;
        }

        showOnScreenToast("📦 Fetching conversation list from Claude API...");

        try {
            const listUrl = `https://claude.ai/api/organizations/${orgId}/chat_conversations`;
            const listRes = await fetch(listUrl, { credentials: "include" });
            if (!listRes.ok) {
                showOnScreenToast("⚠️ Failed to fetch conversation list.");
                return;
            }

            const convoList = await listRes.json();
            if (!Array.isArray(convoList) || convoList.length === 0) {
                showOnScreenToast("⚠️ No conversations found to export.");
                return;
            }

            const total = convoList.length;
            showOnScreenToast(`📦 Exporting ${total} conversations...`);

            const exportedData = {
                exporter: "Claude Exporter Pro",
                version: "1.0",
                exportedAt: new Date().toISOString(),
                totalCount: total,
                conversations: []
            };

            for (let i = 0; i < convoList.length; i++) {
                const item = convoList[i];
                const convoId = item.uuid || item.id;
                showOnScreenToast(`📦 Exporting (${i + 1}/${total}): ${item.name || 'Chat'}`);

                const parsedConvo = await fetchConversationFromAPI(orgId, convoId);
                if (parsedConvo) {
                    exportedData.conversations.push(parsedConvo);
                }
                await new Promise(r => setTimeout(r, 200));
            }

            const jsonString = JSON.stringify(exportedData, null, 2);
            const safeFilename = `Claude_All_Chats_Backup_${new Date().toISOString().slice(0,10)}.json`;

            const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = safeFilename;
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                if (a.parentNode) document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 1000);

            showOnScreenToast(`🎉 Successfully exported ${exportedData.conversations.length} conversations!`);
        } catch (err) {
            console.error("[Claude Exporter] Bulk export error:", err);
            showOnScreenToast("⚠️ Bulk export failed. See console for details.");
        }
    }

    function importChatsBackup(backupData) {
        if (!backupData || !Array.isArray(backupData.conversations)) {
            showOnScreenToast("⚠️ Invalid backup file format.");
            return;
        }

        const count = backupData.conversations.length;
        showOnScreenToast(`📥 Restored Backup: ${count} conversations loaded!`);

        let modal = document.getElementById("claude-exporter-import-modal");
        if (modal) modal.remove();

        modal = document.createElement("div");
        modal.id = "claude-exporter-import-modal";
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 480px;
            max-height: 80vh;
            background: #171a20;
            border: 1px solid #3d4350;
            border-radius: 12px;
            padding: 20px;
            z-index: 999999;
            color: #f1f5f9;
            font-family: system-ui, -apple-system, sans-serif;
            box-shadow: 0 12px 36px rgba(0,0,0,0.8);
            display: flex;
            flex-direction: column;
            gap: 14px;
        `;

        let listItemsHtml = "";
        backupData.conversations.forEach((c, idx) => {
            listItemsHtml += `
                <div style="padding: 8px 12px; background: #212630; border-radius: 6px; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 600;">#${idx + 1} ${escapeHTML(c.title)}</span>
                    <span style="color: #94a3b8; font-size: 11px;">${c.turns ? c.turns.length : 0} turns</span>
                </div>
            `;
        });

        modal.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2d333f; padding-bottom: 10px;">
                <h3 style="margin: 0; font-size: 15px; color: #da7756;">📦 Imported Backup Viewer (${count} Chats)</h3>
                <button id="close-import-modal" style="background: transparent; border: none; color: #94a3b8; font-weight: bold; cursor: pointer; font-size: 16px;">✕</button>
            </div>
            <div style="overflow-y: auto; max-height: 340px; display: flex; flex-direction: column; gap: 6px; padding-right: 4px;">
                ${listItemsHtml}
            </div>
            <div style="text-align: right; font-size: 11px; color: #94a3b8;">
                Backup Date: ${escapeHTML(backupData.exportedAt || 'Unknown')}
            </div>
        `;

        document.body.appendChild(modal);
        document.getElementById("close-import-modal").onclick = () => modal.remove();
    }

    window.__claudeExporter = {
        exportCurrentConversation,
        resolveCurrentIds,
        fetchConversationFromAPI,
        parseConversationFromDOM,
        showOnScreenToast,
        formatFilename,
        formatDateFormatted,
        generateMarkdown,
        generateProfessionalPDFHTML,
        generateJSON,
        generateCSV,
        generateText
    };

    console.log("[Claude Exporter Pro] Content script initialized.");
})();
