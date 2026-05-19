(() => {
  const data = window.COINLYTE_DATA;
  const liveData = window.COINLYTE_LIVE_DATA || null;
  const CHECKS = ["scripting", "recording", "editing", "draftupload", "scheduled", "published"];
  const CHECK_LABELS = {
    scripting: "Research locked",
    recording: "Recorded",
    editing: "Edited",
    draftupload: "Draft uploaded",
    scheduled: "Scheduled",
    published: "Published"
  };
  const STAGES = [
    ["ideas", "Ideas"],
    ["scripting", "Research"],
    ["recording", "Recording"],
    ["editing", "Editing"],
    ["scheduled", "Scheduled"],
    ["published", "Published"]
  ];
  const BRAND_STAGES = ["Pitching", "Discussion", "Confirmed", "Product Received", "Content Live", "Paid", "Declined"];
  const VIDEO_CATEGORIES = ["Security", "India Focus", "Policy", "Macro", "AI Crypto", "Education", "Stablecoin", "Hardware", "DeFi", "Comparison", "Strategy", "Bitcoin", "XRP", "Community", "Competitor Gap", "Topic Pivot", "Other"];
  const HUB_CATEGORIES = ["Content", "Research", "Community", "Business", "Sponsors", "Analytics", "Automation", "Design", "Publishing", "Other"];
  const BRAND_CATEGORIES = ["Wallet", "Exchange", "Tax", "Security", "Education", "SaaS", "Affiliate", "Agency", "Media", "Other"];
  const BRAND_TYPES = ["Fixed Fee", "Product Review", "Affiliate", "Dedicated Integration", "Mention", "Revenue Share", "Barter", "Other"];
  const CURRENCIES = ["INR", "USD"];
  const APP_ACCESS = ["Command", "Analytics", "Channel Intelligence", "Content Planner", "Brand Deals", "Team Access", "Refresh"];
  const VIEW_ACCESS = {
    overview: "Command",
    analytics: "Analytics",
    intelligence: "Channel Intelligence",
    planner: "Content Planner",
    brand: "Brand Deals",
    team: "Team Access",
    refresh: "Refresh"
  };
  const NOTIFICATION_CHANNELS = ["In-app", "Email", "WhatsApp", "Slack", "Telegram"];
  const DEFAULT_TEAM = [
    { id: "owner-kirtish", name: "Kirtish", role: "Owner", userId: "kirtish", email: "", channels: ["In-app"], access: APP_ACCESS, notifyStages: true }
  ];
  applyLiveData(data, liveData);
  const store = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  };

  let state = {
    view: "overview",
    period: "90d",
    plannerMode: "list",
    plannerTab: "board",
    intelligenceTab: "health",
    brandTab: "directory",
    plannerStage: "all",
    plannerQuery: "",
    hubCategory: "all",
    hubQuery: "",
    brandStage: "all",
    refreshJob: store.get("cl_refresh_job_v1", null),
    pipeline: normalizePipeline(store.get("cl_pipeline_v4", data.defaultPipeline)),
    hubLinks: store.get("cl_hub_links_v3", data.defaultHubLinks).map(withId),
    brands: store.get("cl_brands_v3", data.defaultBrands).map(withId),
    dismissedIdeas: store.get("cl_dismissed_ideas_v1", []),
    dismissedCommand: store.get("cl_dismissed_command_v1", []),
    teamMembers: normalizeTeamMembers(store.get("cl_team_members_v1", DEFAULT_TEAM)),
    notifications: store.get("cl_notifications_v1", []),
    session: { role: "owner", name: "Local Owner", userId: "local", access: APP_ACCESS },
    cloud: { ready: false, loading: false, mode: "local", dirty: false, lastSyncedAt: "" }
  };
  let cloudSaveTimer = null;
  let cloudPollTimer = null;

  function $(selector, root = document) {
    return root.querySelector(selector);
  }
  function $all(selector, root = document) {
    return [...root.querySelectorAll(selector)];
  }
  function escapeHTML(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function formatNumber(value) {
    return new Intl.NumberFormat("en-IN").format(Math.round(value || 0));
  }
  function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
  }
  function formatDealValue(brand) {
    const currency = brand?.currency || "INR";
    return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(brand?.value || 0));
  }
  function compact(value) {
    if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
    return String(value || 0);
  }
  function applyLiveData(target, live) {
    if (!live) {
      target.liveStatus = "seed";
      target.market = { india: [], regulation: [], market: [] };
      return;
    }
    target.liveStatus = "live";
    target.refreshedAt = live.refreshedAt || target.refreshedAt;
    target.refreshBuild = live.lastRefresh || target.refreshBuild;
    if (live.channelStats) {
      target.channel.subscribers = Number(live.channelStats.subs || target.channel.subscribers);
      target.channel.views = Number(live.channelStats.views || target.channel.views);
      target.channel.videos = Number(live.channelStats.vids || target.channel.videos);
    }
    if (Array.isArray(live.coinlyte) && live.coinlyte.length) {
      target.uploads = live.coinlyte.map((video) => ({
        title: video.title || "Untitled video",
        days: video.days || "",
        videoId: video.videoId || "",
        category: inferCategory(video.title || "")
      }));
    }
    const coinBureauSeed = target.competitors?.find((comp) => comp.channel === "Coin Bureau")?.latest || [];
    target.competitors = [
      competitorFromLive("Coin Bureau", "Check daily", "Official @CoinBureau crypto narratives to localize for Indian investors", officialCoinBureauVideos(live.coinbureau, coinBureauSeed)),
      competitorFromLive("Cyber Scrilla", "Check 3x/week", "Wallet, exchange, and scam angles", live.cyberscrilla),
      competitorFromLive("Bankless", "Check weekly", "Macro, Ethereum, regulation, and institutions", live.bankless)
    ];
    if (Array.isArray(live.videoIdeas) && live.videoIdeas.length) {
      target.ideas = live.videoIdeas.map((idea, index) => ({
        title: idea.title || `AI idea ${index + 1}`,
        category: idea.category || "Education",
        urgency: priorityLabel(idea.priority),
        signal: idea.signal || "analytics_insight",
        source: idea.source || "Refresh Engine",
        reason: idea.why || "Generated from live channel, competitor, audience, and news signals.",
        score: ideaScore(idea, index)
      })).sort((a, b) => b.score - a.score);
    }
    if (Array.isArray(live.comments) && live.comments.length) {
      target.comments = live.comments.slice(0, 24).map((comment) => ({
        author: comment.author || "Viewer",
        intent: labelCase(comment.intent || "comment"),
        text: comment.text || "",
        likes: Number(comment.likes || 0),
        video: comment.videoTitle || comment.video || ""
      }));
    }
    target.commentThemes = Array.isArray(live.commentThemes) ? live.commentThemes : [];
    target.market = live.news || { india: [], regulation: [], market: [] };
    target.videoPerformance = Array.isArray(live.videoPerformance) ? live.videoPerformance : [];
    if (live.analytics) applyLiveAnalytics(target, live.analytics);
    target.bestHours = buildBestHours(live.analytics?.hourly, target.bestHours);
  }
  function applyLiveAnalytics(target, analytics) {
    const mapped = {
      "30d": convertPeriod("30 Days", analytics.p28 || analytics.p30 || analytics),
      "90d": convertPeriod("90 Days", analytics.p90 || analytics),
      "1y": convertPeriod("1 Year", analytics.p365 || analytics.p90 || analytics)
    };
    Object.keys(mapped).forEach((key) => {
      if (mapped[key]) target.analytics[key] = mapped[key];
    });
    const p90 = analytics.p90 || analytics;
    target.geo = convertGeo(p90.geo || analytics.geo) || target.geo;
    target.devices = convertDevice(p90.device || analytics.device) || target.devices;
    target.traffic = convertTraffic(p90.traffic || analytics.traffic) || target.traffic;
    target.demographics = convertDemo(p90.ageGender || analytics.ageGender) || target.demographics;
    target.topVideos = convertTopVideos(p90.topVideos || analytics.topVideos, analytics.videoTitles || {}) || target.topVideos;
  }
  function convertPeriod(label, period) {
    const row = period?.core?.rows?.[0];
    if (!row) return null;
    const views = Number(row[0] || 0);
    const minutes = Number(row[1] || 0);
    const likes = Number(row[6] || 0);
    const comments = Number(row[7] || 0);
    return {
      label,
      period: `${period.period?.start || ""} to ${period.period?.end || ""}`.trim(),
      views,
      watchHours: Math.round(minutes / 60),
      retention: Number(row[3] || 0).toFixed(1),
      averageDuration: secondsToDuration(Number(row[2] || 0)),
      likeRate: views ? Number((likes / views) * 100).toFixed(2) : 0,
      commentRate: views ? Number((comments / views) * 100).toFixed(2) : 0,
      subscribersGained: Number(row[4] || 0),
      subscribersLost: Number(row[5] || 0),
      shares: Number(row[8] || 0),
      daily: period.daily?.rows?.map((r) => [r[0], Number(r[1] || 0)]) || []
    };
  }
  function secondsToDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = String(Math.round(seconds % 60)).padStart(2, "0");
    return `${mins}m ${secs}s`;
  }
  function convertGeo(table) {
    if (!table?.rows?.length) return null;
    const total = table.rows.reduce((sum, row) => sum + Number(row[1] || 0), 0) || 1;
    const names = { IN: "India", PK: "Pakistan", BD: "Bangladesh", NP: "Nepal", AE: "UAE", US: "USA", SA: "Saudi Arabia", GB: "UK", CA: "Canada", AU: "Australia" };
    return table.rows.slice(0, 10).map((row) => [names[row[0]] || row[0], row[0], Number(row[1] || 0), Number(((Number(row[1] || 0) / total) * 100).toFixed(1))]);
  }
  function convertDevice(table) {
    if (!table?.rows?.length) return null;
    const total = table.rows.reduce((sum, row) => sum + Number(row[1] || 0), 0) || 1;
    const names = { MOBILE: "Mobile", DESKTOP: "Desktop", TV: "Smart TV", TABLET: "Tablet" };
    return table.rows.map((row) => [names[row[0]] || labelCase(row[0]), Number(row[1] || 0), Number(((Number(row[1] || 0) / total) * 100).toFixed(1))]);
  }
  function convertTraffic(table) {
    if (!table?.rows?.length) return null;
    const total = table.rows.reduce((sum, row) => sum + Number(row[1] || 0), 0) || 1;
    const names = { YT_SEARCH: "YouTube Search", SUBSCRIBER: "Subscribers feed", RELATED_VIDEO: "Related videos", SHORTS: "Shorts feed", YT_OTHER_PAGE: "Other YouTube pages", YT_CHANNEL: "Channel page", NOTIFICATION: "Notifications", NO_LINK_OTHER: "Direct / unknown", EXT_URL: "External websites", END_SCREEN: "End screens", PLAYLIST: "Playlists" };
    return table.rows.slice(0, 10).map((row) => [names[row[0]] || row[0], Number(row[1] || 0), Number(((Number(row[1] || 0) / total) * 100).toFixed(1))]);
  }
  function convertDemo(table) {
    if (!table?.rows?.length) return null;
    const map = new Map();
    table.rows.forEach(([age, gender, pct]) => {
      const label = ageLabel(age);
      const entry = map.get(label) || { male: 0, female: 0 };
      const g = String(gender || "").toLowerCase();
      if (g === "male") entry.male += Number(pct || 0);
      if (g === "female") entry.female += Number(pct || 0);
      map.set(label, entry);
    });
    return [...map.entries()].map(([age, entry]) => [age, Number(entry.male.toFixed(1)), Number(entry.female.toFixed(1))]);
  }
  function convertTopVideos(table, titles) {
    if (!table?.rows?.length) return null;
    return table.rows.slice(0, 10).map((row) => [row[0], titles[row[0]] || row[0], Number(row[1] || 0), Number(row[3] || 0).toFixed(1), Number(row[5] || 0)]);
  }
  function buildBestHours(hourly, fallback) {
    const rows = hourly?.rows || [];
    if (!rows.length) return fallback;
    return {
      source: "Live 7-day YouTube Analytics hourly rows",
      rows: rows.slice(0, 4).map(([hour, views], index) => ({
        daypart: "Live hourly rank",
        time: `${String(hour).padStart(2, "0")}:00 IST`,
        score: Math.max(55, 98 - index * 8),
        note: `${views.toLocaleString("en-IN")} views in this hour across the latest 7-day window.`
      }))
    };
  }
  function officialCoinBureauVideos(videos = [], fallback = []) {
    const badSignals = ["spirit airlines", "ireland", "openai scandal", "switzerland controls migration", "money bureau", "ukraine", "uae left opec"];
    const titles = (videos || []).map((video) => String(video?.title || video || "").toLowerCase());
    const looksLikeWrongChannel = titles.some((title) => badSignals.some((signal) => title.includes(signal)));
    return videos?.length && !looksLikeWrongChannel ? videos : fallback;
  }
  function competitorFromLive(channel, cadence, reason, videos = []) {
    return {
      channel,
      cadence,
      reason,
      latest: videos.slice(0, 8).map((v) => {
        const title = typeof v === "string" ? v : v.title || "Untitled";
        return {
          title,
          days: v.days || v.age || "Fresh",
          videoId: v.videoId || "",
          url: v.videoId ? `https://youtube.com/watch?v=${v.videoId}` : v.url || ""
        };
      })
    };
  }
  function inferCategory(title) {
    const t = title.toLowerCase();
    if (/(wallet|scam|hack|secure|ledger|tangem)/.test(t)) return "Security";
    if (/(xrp|ripple)/.test(t)) return "XRP";
    if (/(solana|ethereum|eth|btc|bitcoin)/.test(t)) return "Comparison";
    if (/(stablecoin|usdt|usdc)/.test(t)) return "Stablecoin";
    if (/(ai|model)/.test(t)) return "AI Crypto";
    return "Education";
  }
  function priorityLabel(priority = "medium") {
    const p = String(priority).toLowerCase();
    if (p === "urgent") return "Urgent";
    if (p === "high") return "High";
    return "Medium";
  }
  function ideaScore(idea, index) {
    const priority = String(idea.priority || "").toLowerCase();
    const signal = String(idea.signal || "").toLowerCase();
    let score = priority === "urgent" ? 92 : priority === "high" ? 82 : 68;
    if (signal.includes("audience")) score += 5;
    if (signal.includes("news")) score += 4;
    if (signal.includes("competitor")) score += 3;
    if (signal.includes("pivot")) score += 2;
    return Math.max(40, Math.min(99, score - index * 0.4));
  }
  function ageLabel(age) {
    return String(age).replace("age", "").replace("-", "-").replace(/65-?$/, "65+");
  }
  function labelCase(value) {
    return String(value || "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  function withId(item) {
    return item.id ? item : { ...item, id: `id-${Date.now()}-${Math.random().toString(16).slice(2)}` };
  }
  function uniqueOptions(base, values = []) {
    const seen = new Set();
    return [...base, ...values]
      .map((item) => String(item || "").trim())
      .filter((item) => item && !seen.has(item.toLowerCase()) && seen.add(item.toLowerCase()));
  }
  function selectOptions(options, selected) {
    const current = String(selected || "");
    return options.map((option) => `<option value="${escapeHTML(option)}" ${current === option ? "selected" : ""}>${escapeHTML(option)}</option>`).join("");
  }
  function categoryField(name, options, selected, label = "Category") {
    const hasOption = options.some((option) => option.toLowerCase() === String(selected || "").toLowerCase());
    return `
      <label>${label}
        <select name="${name}" data-custom-select="${name}">${selectOptions([...options, "Custom..."], hasOption ? selected : "Custom...")}</select>
      </label>
      <label class="custom-field ${hasOption ? "is-hidden" : ""}" data-custom-field="${name}">Custom ${label.toLowerCase()}
        <input name="${name}Custom" value="${hasOption ? "" : escapeHTML(selected || "")}" placeholder="Add new category">
      </label>`;
  }
  function bindCustomSelects(root = document) {
    $all("[data-custom-select]", root).forEach((select) => {
      const field = $(`[data-custom-field="${select.dataset.customSelect}"]`, root);
      const sync = () => field?.classList.toggle("is-hidden", select.value !== "Custom...");
      select.addEventListener("change", sync);
      sync();
    });
  }
  function customSelectValue(form, name, fallback) {
    const value = String(form.get(name) || "").trim();
    if (value === "Custom...") return String(form.get(`${name}Custom`) || "").trim() || fallback;
    return value || fallback;
  }
  function emptyChecks() {
    return Object.fromEntries(CHECKS.map((key) => [key, false]));
  }
  function normalizePipeline(cards) {
    return (cards || []).map((card) => {
      const checks = emptyChecks();
      CHECKS.forEach((key) => {
        checks[key] = Boolean(card.checks?.[key]);
      });
      const hasSource = Boolean(card.sourceUrl || (card.source && card.source !== "Manual"));
      const researchBrief = card.researchBrief || (hasSource ? card.notes || "" : "");
      const editorNotes = card.editorNotes || (!hasSource ? card.notes || "" : "");
      const sourceLinks = Array.isArray(card.sourceLinks) ? card.sourceLinks : [];
      const primary = card.sourceUrl ? { label: card.source || "Original source", url: card.sourceUrl } : null;
      const mergedLinks = [primary, ...sourceLinks]
        .filter(Boolean)
        .filter((link, index, all) => all.findIndex((item) => (item.url || item) === (link.url || link)) === index);
      return withId({ ...card, stage: card.stage || "ideas", checks, researchBrief, editorNotes, sourceLinks: mergedLinks });
    });
  }
  function cleanTeamMembers(members = state.teamMembers) {
    return normalizeTeamMembers(members).map(({ accessCode, ...member }) => member);
  }
  function boardSnapshot() {
    return {
      pipeline: state.pipeline,
      hubLinks: state.hubLinks,
      brands: state.brands,
      teamMembers: cleanTeamMembers(),
      notifications: state.notifications.slice(0, 80),
      dismissedIdeas: state.dismissedIdeas,
      dismissedCommand: state.dismissedCommand
    };
  }
  function saveLocalSnapshot() {
    store.set("cl_pipeline_v4", state.pipeline);
    store.set("cl_hub_links_v3", state.hubLinks);
    store.set("cl_brands_v3", state.brands);
    store.set("cl_dismissed_ideas_v1", state.dismissedIdeas);
    store.set("cl_dismissed_command_v1", state.dismissedCommand);
    store.set("cl_team_members_v1", cleanTeamMembers());
    store.set("cl_notifications_v1", state.notifications.slice(0, 80));
  }
  function applyBoardData(board = {}) {
    if (Array.isArray(board.pipeline)) state.pipeline = normalizePipeline(board.pipeline);
    if (Array.isArray(board.hubLinks)) state.hubLinks = board.hubLinks.map(withId);
    if (Array.isArray(board.brands)) state.brands = board.brands.map(withId);
    if (Array.isArray(board.teamMembers)) state.teamMembers = cleanTeamMembers(board.teamMembers);
    if (Array.isArray(board.notifications)) state.notifications = board.notifications.slice(0, 80);
    if (Array.isArray(board.dismissedIdeas)) state.dismissedIdeas = board.dismissedIdeas;
    if (Array.isArray(board.dismissedCommand)) state.dismissedCommand = board.dismissedCommand;
    saveLocalSnapshot();
  }
  function scheduleCloudSave() {
    if (!state.cloud.ready || state.cloud.loading) return;
    state.cloud.dirty = true;
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(() => persistBoardNow(), 450);
  }
  async function persistBoardNow({ force = false } = {}) {
    if (!state.cloud.ready || (state.cloud.loading && !force)) return false;
    try {
      setSync("Saving shared board...");
      const res = await fetch("/api/board", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(boardSnapshot())
      });
      if (!res.ok) throw new Error("Cloud save failed");
      state.cloud.dirty = false;
      state.cloud.lastSyncedAt = new Date().toISOString();
      setSync("Shared board saved");
      return true;
    } catch {
      setSync("Local save only");
      return false;
    }
  }
  function savePipeline() {
    store.set("cl_pipeline_v4", state.pipeline);
    scheduleCloudSave();
  }
  function saveHub() {
    store.set("cl_hub_links_v3", state.hubLinks);
    scheduleCloudSave();
  }
  function saveBrands() {
    store.set("cl_brands_v3", state.brands);
    scheduleCloudSave();
  }
  function saveDismissedIdeas() {
    store.set("cl_dismissed_ideas_v1", state.dismissedIdeas);
    scheduleCloudSave();
  }
  function saveDismissedCommand() {
    store.set("cl_dismissed_command_v1", state.dismissedCommand);
    scheduleCloudSave();
  }
  function saveTeam() {
    state.teamMembers = cleanTeamMembers();
    store.set("cl_team_members_v1", state.teamMembers);
    scheduleCloudSave();
  }
  function saveNotifications() {
    store.set("cl_notifications_v1", state.notifications.slice(0, 80));
    scheduleCloudSave();
  }
  function normalizeTeamMembers(members) {
    return (members || DEFAULT_TEAM).map((member) => withId({
      ...member,
      access: Array.isArray(member.access) && member.access.length ? member.access : ["Content Planner"],
      email: member.email || "",
      accessStatus: member.accessStatus || "Active",
      channels: normalizeChannels(member),
      notifyStages: member.notifyStages !== false
    }));
  }
  function normalizeChannels(member = {}) {
    const saved = Array.isArray(member.channels) ? member.channels : (member.channel ? [member.channel] : ["In-app"]);
    const known = saved.filter((item) => NOTIFICATION_CHANNELS.includes(item));
    return known.length ? [...new Set(known)] : ["In-app"];
  }
  function teamMemberName(id) {
    return state.teamMembers.find((member) => member.id === id)?.name || "";
  }
  function teamMemberOptions(selected = "") {
    return state.teamMembers.map((member) => `<option value="${escapeHTML(member.id)}" ${selected === member.id ? "selected" : ""}>${escapeHTML(member.name)} · ${escapeHTML(member.role || "Team")}</option>`).join("");
  }
  function channelIcon(channel = "") {
    return {
      "In-app": "🔔",
      Email: "✉️",
      WhatsApp: "🟢",
      Slack: "💬",
      Telegram: "✈️"
    }[channel] || "🔔";
  }
  function createNotification({ card, type, message, memberId }) {
    const assigneeId = memberId || card?.assignedTo || "";
    const assignee = state.teamMembers.find((member) => member.id === assigneeId);
    if (assignee?.accessStatus === "Paused") return;
    const channels = normalizeChannels(assignee || {});
    const note = withId({
      type,
      cardId: card?.id || "",
      title: card?.title || "Planner update",
      message,
      memberId: assigneeId,
      memberName: assignee?.name || "Unassigned",
      channels,
      email: assignee?.email || "",
      emailStatus: channels.includes("Email") && assignee?.email ? "queued" : "",
      createdAt: new Date().toISOString(),
      read: false
    });
    state.notifications.unshift(note);
    state.notifications = state.notifications.slice(0, 80);
    saveNotifications();
    if (note.emailStatus) sendEmailNotification(note);
    toast(`${note.memberName}: ${message}`);
    if (state.view === "team") renderTeam();
  }
  async function sendEmailNotification(note) {
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: note.email,
          subject: `CoinLyte planner: ${note.title}`,
          message: `${note.memberName}, ${note.message}`,
          cardTitle: note.title
        })
      });
      const body = await res.json().catch(() => ({}));
      state.notifications = state.notifications.map((item) => item.id === note.id ? { ...item, emailStatus: body.status || (res.ok ? "sent" : "failed") } : item);
    } catch {
      state.notifications = state.notifications.map((item) => item.id === note.id ? { ...item, emailStatus: "failed" } : item);
    }
    saveNotifications();
    if (state.view === "team") renderTeam();
  }
  function ideaKey(idea) {
    return `${idea.title || ""}::${idea.source || ""}`.toLowerCase();
  }
  function visibleIdeas() {
    const dismissed = new Set(state.dismissedIdeas);
    const planned = new Set(state.pipeline.map((card) => String(card.title || "").toLowerCase()));
    return data.ideas.filter((idea) => !dismissed.has(ideaKey(idea)) && !planned.has(String(idea.title || "").toLowerCase()));
  }
  function isPlannedIdea(idea) {
    return state.pipeline.some((card) => String(card.title || "").toLowerCase() === String(idea.title || "").toLowerCase());
  }
  function isVisibleGeneratedIdea(idea) {
    return !state.dismissedIdeas.includes(ideaKey(idea)) && !isPlannedIdea(idea);
  }
  function ideaPayload(idea) {
    return encodeURIComponent(JSON.stringify({
      title: idea.title || "",
      category: idea.category || "Education",
      urgency: idea.urgency || "Medium",
      signal: idea.signal || "",
      source: idea.source || "Intelligence",
      sourceUrl: idea.sourceUrl || idea.url || "",
      sourceAge: idea.sourceAge || "",
      reason: idea.reason || "",
      score: idea.score || ""
    }));
  }
  function readIdeaPayload(btn) {
    try {
      return JSON.parse(decodeURIComponent(btn.dataset.ideaPayload || ""));
    } catch {
      return null;
    }
  }
  function categoryEmoji(category = "", signal = "") {
    const text = `${category} ${signal}`.toLowerCase();
    if (text.includes("competitor")) return "🎯";
    if (text.includes("community") || text.includes("audience") || text.includes("comment")) return "💬";
    if (text.includes("security") || text.includes("wallet") || text.includes("scam")) return "🔐";
    if (text.includes("india") || text.includes("tax") || text.includes("rbi")) return "🇮🇳";
    if (text.includes("policy") || text.includes("regulation")) return "🧾";
    if (text.includes("stable")) return "💵";
    if (text.includes("ai")) return "🤖";
    if (text.includes("comparison")) return "⚔️";
    if (text.includes("defi")) return "💎";
    if (text.includes("macro") || text.includes("market")) return "📈";
    return "💡";
  }
  function withLeadingEmoji(title, emoji) {
    const text = String(title || "");
    return /^[\u2600-\u27BF]|\uD83C|\uD83D|\uD83E/.test(text) ? text : `${emoji} ${text}`;
  }
  function sourceAge(item = {}) {
    const direct = item.days || item.age || item.publicAge || item.publishedAgo;
    if (direct) return normalizeAgeLabel(direct);
    const raw = item.publishedAt || item.published || item.date || item.pubDate || item.createdAt;
    if (!raw) return "Today";
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return String(raw).slice(0, 18);
    const refreshed = new Date(data.refreshedAt || Date.now());
    const now = Number.isNaN(refreshed.getTime()) ? new Date() : refreshed;
    const days = Math.max(0, Math.floor((now - parsed) / 86400000));
    return formatAgeDays(days);
  }
  function normalizeAgeLabel(value = "") {
    const text = String(value).trim();
    const lower = text.toLowerCase();
    if (!text || lower === "fresh" || lower === "just now" || lower.includes("today")) return "Today";
    if (lower.includes("yesterday")) return "1 day ago";
    const dayMatch = lower.match(/(\d+)\s*(?:d|day|days)/);
    if (dayMatch) return formatAgeDays(Number(dayMatch[1]));
    const hourMatch = lower.match(/(\d+)\s*(?:h|hr|hour|hours)/);
    if (hourMatch) return "Today";
    return text;
  }
  function formatAgeDays(days) {
    if (days === 0) return "Today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  }
  function ageUrgency(age = "") {
    const text = String(age).toLowerCase();
    if (text.includes("today") || text.includes("hour") || text.includes("0 day")) return "Urgent";
    if (text.includes("1 day") || text.includes("2 days") || text.includes("3 days")) return "High";
    return "Medium";
  }
  function categoryTone(category = "", urgency = "") {
    const text = `${category} ${urgency}`.toLowerCase();
    if (text.includes("urgent")) return "urgent";
    if (text.includes("security") || text.includes("scam") || text.includes("wallet")) return "security";
    if (text.includes("india") || text.includes("tax") || text.includes("rbi")) return "india";
    if (text.includes("policy") || text.includes("regulation") || text.includes("sec")) return "policy";
    if (text.includes("macro") || text.includes("bitcoin") || text.includes("market")) return "macro";
    if (text.includes("ai")) return "ai";
    if (text.includes("stable")) return "stablecoin";
    if (text.includes("defi")) return "defi";
    if (text.includes("education") || text.includes("explain")) return "education";
    return "security";
  }
  function toneForText(text = "") {
    const tones = ["violet", "blue", "green", "gold", "teal", "red"];
    let total = 0;
    String(text || "").split("").forEach((char) => { total += char.charCodeAt(0); });
    return tones[total % tones.length];
  }
  function normalizeCompetitorVideo(video) {
    if (typeof video === "string") return { title: video, days: "Saved", videoId: "", url: "" };
    return {
      title: video?.title || "Untitled",
      days: video?.days || video?.age || sourceAge(video),
      videoId: video?.videoId || "",
      url: video?.url || (video?.videoId ? `https://youtube.com/watch?v=${video.videoId}` : "")
    };
  }
  function competitorIdea(comp, video) {
    const v = normalizeCompetitorVideo(video);
    return {
      title: `${categoryEmoji("Competitor Gap")} India angle: ${v.title}`,
      category: "Competitor Gap",
      urgency: ageUrgency(v.days),
      signal: "competitor_gap",
      source: comp.channel,
      sourceUrl: v.url,
      sourceAge: v.days,
      reason: `${comp.channel} published "${v.title}" ${v.days}. Build the Indian/Hindi investor version with rupee impact, risk context, and CoinLyte trust angle before the gap cools.`
    };
  }
  function competitorSuggestedIdeas() {
    const ideas = [];
    data.competitors.forEach((comp) => {
      (comp.latest || []).map(normalizeCompetitorVideo).forEach((video, index) => {
        const category = inferCategory(video.title);
        const urgency = ageUrgency(video.days);
        const title = competitorAudienceTitle(video.title, category);
        const idea = {
          title,
          category,
          urgency,
          signal: "competitor_fit",
          source: comp.channel,
          sourceUrl: video.url,
          sourceAge: video.days,
          score: urgency === "Urgent" ? 91 - index : urgency === "High" ? 84 - index : 74 - index,
          reason: `${comp.channel} published "${video.title}" ${video.days}. CoinLyte audience fit: convert the global/English angle into a Hindi India-first video with rupee impact, safety lesson, or portfolio decision.`
        };
        if (isVisibleGeneratedIdea(idea) && !ideas.some((item) => item.title.toLowerCase() === title.toLowerCase())) ideas.push(idea);
      });
    });
    return ideas.sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 5);
  }
  function competitorAudienceTitle(title, category) {
    const clean = String(title || "Competitor topic").replace(/\s+/g, " ").trim();
    const lower = clean.toLowerCase();
    if (/(wallet|tangem|cold|coinbase|hack|crime|scam)/.test(lower)) return `🔐 Exchange vs Cold Wallet: Indian crypto holders ke liye safety checklist`;
    if (/(clarity|regulation|reserve|sec|cftc|senate|stablecoin|law)/.test(lower)) return `🧾 US crypto rules बदल रहे हैं — Indian investors को क्या करना चाहिए?`;
    if (/(bitcoin|ethereum|nasdaq|stock|gold|macro|opec|uae|trump|xi)/.test(lower)) return `📈 Global market shock ka India portfolio par real impact`;
    if (/(ai|anthropic|boom)/.test(lower)) return `🤖 AI boom aur crypto: Indian investors ke liye risk vs opportunity`;
    return `${categoryEmoji(category)} ${clean.split(/[:|—-]/)[0]} ka Indian investor angle`;
  }
  function marketSignals() {
    const market = data.market || {};
    const buckets = [
      ["India Policy", "india", market.india || [], "🇮🇳", "red"],
      ["US Regulation", "regulation", market.regulation || [], "🧾", "gold"],
      ["Global Market", "market", market.market || [], "📈", "blue"]
    ];
    return buckets.flatMap(([bucket, key, items, emoji, tone]) => (items || []).slice(0, 10).map((item) => {
      const age = sourceAge(item);
      const category = item.category || item.region || bucket;
      const title = item.title || "Untitled market signal";
      return {
        bucket,
        key,
        tone,
        emoji,
        item,
        age,
        idea: {
          title: `${emoji} ${title}`,
          category,
          urgency: bucket === "India Policy" ? "Urgent" : ageUrgency(age),
          signal: "news_trend",
          source: bucket,
          sourceUrl: item.url || item.link || "",
          sourceAge: age,
          reason: `${newsAngle(item, bucket)} Source went public ${age}. Brief: explain the Indian investor impact in simple Hindi with one clear rupee/risk takeaway.`
        }
      };
    })).filter((signal) => isVisibleGeneratedIdea(signal.idea));
  }
  function dismissIdea(idea) {
    const key = ideaKey(idea);
    if (!state.dismissedIdeas.includes(key)) state.dismissedIdeas.push(key);
    saveDismissedIdeas();
    toast("Idea dismissed.", { label: "Undo", run: () => {
      state.dismissedIdeas = state.dismissedIdeas.filter((item) => item !== key);
      saveDismissedIdeas();
      render();
    } });
    render();
  }
  function animateAction(btn, kind, run) {
    const card = btn.closest(".idea-card, .market-signal-card, .competitor-row, .comment-item");
    btn.classList.add(kind === "dismiss" ? "action-dismissing" : "action-adding");
    card?.classList.add(kind === "dismiss" ? "card-dismissing" : "card-adding");
    setTimeout(run, kind === "dismiss" ? 180 : 240);
  }
  function restoreDismissedIdeas() {
    state.dismissedIdeas = [];
    saveDismissedIdeas();
    render();
    toast("Dismissed ideas restored.");
  }
  function titleFor(view) {
    return {
      overview: "Command Centre",
      analytics: "My Analytics",
      intelligence: "Channel Intelligence",
      ideas: "Video Ideas",
      pulse: "Comment Pulse",
      market: "Market Intelligence",
      planner: "Content Planner",
      calendar: "Content Calendar",
      team: "Team Access",
      brand: "Brand Deals",
      review: "Monthly Review",
      refresh: "Refresh Control"
    }[view];
  }
  function hasAppAccess(area) {
    if (!area) return true;
    return state.session?.role === "owner" || (state.session?.access || []).includes(area);
  }
  function firstAllowedView() {
    const found = Object.entries(VIEW_ACCESS).find(([, area]) => hasAppAccess(area));
    return found?.[0] || "overview";
  }
  function applyAccessNavigation() {
    $all(".nav-btn").forEach((btn) => {
      const area = VIEW_ACCESS[btn.dataset.view];
      btn.classList.toggle("is-hidden", !hasAppAccess(area));
    });
    $("#refresh-now")?.classList.toggle("is-hidden", !hasAppAccess("Refresh"));
    $("#sync-board")?.classList.toggle("is-hidden", !state.session);
    $("#owner-menu").textContent = state.session?.role === "owner" ? "CL" : (state.session?.name || "T").slice(0, 2).toUpperCase();
  }
  async function bootstrapCloud() {
    await pullSharedBoard("board", { label: "Checking shared board...", success: "Shared board synced", fail: "Local board", renderAfter: true, quiet: false });
    startCloudPolling();
  }
  function syncScopeLabel(scope = "board") {
    return {
      board: "Board",
      planner: "Planner",
      brand: "Brand Deals",
      team: "Team Access"
    }[scope] || "Board";
  }
  function isModalOpen() {
    return $("#modal-root") && !$("#modal-root").classList.contains("is-hidden");
  }
  async function syncSharedBoard(scope = "board") {
    clearTimeout(cloudSaveTimer);
    if (state.cloud.ready && state.cloud.dirty) await persistBoardNow({ force: true });
    await pullSharedBoard(scope, {
      label: `Syncing ${syncScopeLabel(scope)}...`,
      success: `${syncScopeLabel(scope)} synced`,
      fail: "Board sync unavailable",
      renderAfter: true,
      quiet: false
    });
  }
  async function pullSharedBoard(scope = "board", options = {}) {
    const { label = "Checking shared board...", success = "Shared board synced", fail = "Local board", renderAfter = true, quiet = false } = options;
    if (state.cloud.loading) return;
    state.cloud.loading = true;
    try {
      if (!quiet) setSync(label);
      const sessionRes = await fetch("/api/me", { headers: { Accept: "application/json" } });
      if (!sessionRes.ok) throw new Error("No server session");
      const session = await sessionRes.json();
      if (session.authenticated) {
        state.session = session;
        applyAccessNavigation();
        if (!hasAppAccess(VIEW_ACCESS[state.view])) state.view = firstAllowedView();
      }
      const boardRes = await fetch("/api/board", { headers: { Accept: "application/json" } });
      const board = await boardRes.json().catch(() => ({}));
      if (!boardRes.ok || !board.ok) throw new Error(board.error || "Shared board unavailable");
      state.cloud.ready = true;
      state.cloud.mode = "cloud";
      if (board.empty) {
        state.cloud.loading = false;
        await persistBoardNow();
      } else {
        applyBoardData(board.data || {});
      }
      state.cloud.lastSyncedAt = new Date().toISOString();
      setSync(success);
      if (renderAfter) render();
    } catch {
      state.cloud.ready = false;
      state.cloud.mode = "local";
      setSync(fail);
      if (!quiet) toast(`${syncScopeLabel(scope)} sync could not reach Supabase yet.`);
    } finally {
      state.cloud.loading = false;
      applyAccessNavigation();
    }
  }
  function startCloudPolling() {
    if (cloudPollTimer) return;
    cloudPollTimer = setInterval(() => {
      if (!state.cloud.ready || state.cloud.dirty || isModalOpen() || document.visibilityState !== "visible") return;
      pullSharedBoard("board", { success: "Shared board synced", fail: "Local board", renderAfter: true, quiet: true });
    }, 45000);
    window.addEventListener("focus", () => {
      if (!state.cloud.ready || state.cloud.dirty || isModalOpen()) return;
      pullSharedBoard("board", { success: "Shared board synced", fail: "Local board", renderAfter: true, quiet: true });
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible" || !state.cloud.ready || state.cloud.dirty || isModalOpen()) return;
      pullSharedBoard("board", { success: "Shared board synced", fail: "Local board", renderAfter: true, quiet: true });
    });
  }
  function setView(view) {
    if (["ideas", "pulse", "market"].includes(view)) {
      state.intelligenceTab = view === "pulse" ? "community" : view;
      view = "intelligence";
    }
    if (view === "calendar") {
      state.plannerTab = view;
      view = "planner";
    }
    const area = VIEW_ACCESS[view];
    if (!hasAppAccess(area)) {
      toast(`No access to ${area}.`);
      view = firstAllowedView();
    }
    state.view = view;
    $all(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
    $all(".view").forEach((section) => section.classList.toggle("active", section.id === view));
    $("#view-title").textContent = titleFor(view);
    render();
  }
  function toast(message, action) {
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `${escapeHTML(message)}${action ? ` <button type="button">${escapeHTML(action.label)}</button>` : ""}`;
    if (action) $("button", el).addEventListener("click", () => {
      action.run();
      el.remove();
    });
    $("#toast-root").append(el);
    setTimeout(() => el.remove(), action ? 9000 : 4200);
  }
  function confirmDialog({ title, body, confirmText = "Confirm", danger = false, onConfirm }) {
    const root = $("#modal-root");
    root.classList.remove("is-hidden");
    root.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${escapeHTML(title)}</h3>
          <button class="ghost-btn" data-close type="button">Close</button>
        </div>
        <p class="panel-sub">${escapeHTML(body)}</p>
        <div class="modal-actions">
          <button class="ghost-btn" data-close type="button">Cancel</button>
          <button class="${danger ? "danger-btn" : "primary-btn"}" data-confirm type="button">${escapeHTML(confirmText)}</button>
        </div>
      </div>`;
    $all("[data-close]", root).forEach((btn) => btn.addEventListener("click", closeModal));
    $("[data-confirm]", root).addEventListener("click", () => {
      closeModal();
      onConfirm();
    });
  }
  function closeModal() {
    const root = $("#modal-root");
    root.classList.add("is-hidden");
    root.innerHTML = "";
  }

  function metric(label, value, note) {
    return `<div class="metric-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
  }
  function renderOverview() {
    const net = data.analytics["90d"].subscribersGained - data.analytics["90d"].subscribersLost;
    const an = data.analytics["90d"];
    const visibleIdeaCount = visibleIdeas().length;
    const activePipeline = state.pipeline.filter((card) => card.stage !== "published");
    const nextCard = activePipeline.find((card) => ["recording", "editing", "scheduled"].includes(card.stage)) || activePipeline[0] || state.pipeline[0];
    const activeBrands = state.brands.filter((brand) => !["Paid", "Declined"].includes(brand.status));
    const topIdea = visibleIdeas()[0] || data.ideas[0];
    const commentIdea = commentPickedIdea();
    const latestUpload = data.uploads[0];
    const latestComments = data.comments.filter((comment) => String(comment.video || comment.videoTitle || "").includes(latestUpload.title.slice(0, 24))).length;
    const searchTraffic = data.traffic?.find((row) => row[0] === "YouTube Search")?.[1] || data.traffic?.[0]?.[1] || 0;
    const urgentCards = activePipeline.filter((card) => String(card.priority || "").toLowerCase() === "urgent");
    const unassigned = activePipeline.filter((card) => !card.assignedTo);
    const overdue = activePipeline.filter((card) => isOverdue(card));
    const unreadNotifications = state.notifications.filter((note) => !note.read).length;
    const targetStatus = commandTargetStatus(nextCard);
    const ownerName = nextCard?.assignedTo ? teamMemberName(nextCard.assignedTo) : "";
    const sponsorWatch = activeBrands[0];
    $("#overview").innerHTML = `
      <div class="command-hero">
        <div>
          <p class="eyebrow">CoinLyte OS · daily owner dashboard</p>
          <h3>CoinLyte Command Centre</h3>
          <p>Open this first: decide today's video move, catch blockers, assign the right person, and jump straight into the app area where the work happens.</p>
          <div class="hero-chips">
            <span class="hchip purple">${visibleIdeaCount} usable ideas</span>
            <span class="hchip teal">${data.comments.length} comment signals</span>
            <span class="hchip gold">${activeBrands.length} active brand deals</span>
            <span class="hchip red">${urgentCards.length} urgent pipeline cards</span>
          </div>
        </div>
        <div class="command-live-card">
          <span class="tag green">${data.liveStatus === "live" ? "Live data loaded" : "Cached build"}</span>
          <h4>${escapeHTML(data.refreshBuild || "Latest snapshot")}</h4>
          <p>Last refresh ${escapeHTML(new Date(data.refreshedAt).toLocaleString("en-GB"))}</p>
          <button class="primary-btn" data-command-jump="refresh" type="button">Refresh Control</button>
        </div>
      </div>
      <div class="command-metrics">
        ${metric("Subscribers", compact(data.channel.subscribers), `+${compact(data.channel.subscriberDelta)} in 6 months`)}
        ${metric("90d Views", formatNumber(an.views), `${formatNumber(net)} net subscribers`)}
        ${metric("Retention", `${data.channel.retention}%`, data.channel.retention >= 35 ? "Healthy" : "Fix first 90 seconds")}
        ${metric("Comment Rate", `${data.channel.commentRate}%`, "Target 1%+ community depth")}
        ${metric("Pipeline", state.pipeline.length, `${inProgressCount()} active cards`)}
        ${metric("Brand Value", formatCurrency(state.brands.reduce((sum, brand) => sum + Number(brand.value || 0), 0)), `${activeBrands.length} active deals`)}
      </div>
      <div class="daily-command-grid">
        <section class="daily-priority-card ${nextCard?.priority === "Urgent" ? "urgent" : "steady"}">
          <p class="eyebrow">Today's owner decision</p>
          <h3>${escapeHTML(nextCard?.title || topIdea?.title || "Pick today's strongest video idea")}</h3>
          <p>${escapeHTML(commandDecisionLine(nextCard, topIdea))}</p>
          <div class="daily-status-row">
            ${commandChip(stageEmoji(nextCard?.stage) + " " + stageLabel(nextCard?.stage || "ideas"), "blue")}
            ${commandChip(ownerName ? `👤 ${ownerName}` : "👤 Unassigned", ownerName ? "green" : "red")}
            ${commandChip(`📌 ${targetStatus.label}`, targetStatus.tone)}
            ${commandChip(`⚡ ${nextCard?.priority || topIdea?.priority || "High"}`, priorityTone(nextCard?.priority || topIdea?.priority))}
          </div>
          <div class="command-action-row">
            <button class="primary-btn" data-command-jump="planner" type="button">Open Planner</button>
            <button class="ghost-btn" data-command-jump="market" type="button">Check Market</button>
            <button class="ghost-btn" data-command-jump="team" type="button">Assign Team</button>
          </div>
        </section>
        <aside class="daily-alert-stack">
          ${commandAlert("cmd-overdue", "red", "Overdue", overdue.length, overdue.length ? "Move target date or publish decision today." : "No overdue active cards.", "planner", "Open")}
          ${commandAlert("cmd-urgent", "gold", "Urgent Cards", urgentCards.length, urgentCards.length ? "Check urgent ideas before recording anything new." : "No urgent cards waiting.", "planner", "Review")}
          ${commandAlert("cmd-unassigned", "purple", "Unassigned", unassigned.length, unassigned.length ? "Give each active card an owner." : "Every active card has an owner.", "team", "Assign")}
          ${commandAlert("cmd-notifications", "teal", "Unread Alerts", unreadNotifications, unreadNotifications ? "Team/stage notifications need review." : "No unread board notifications.", "team", "Inbox")}
          ${state.dismissedCommand.length ? `<button class="ghost-btn compact-btn" data-restore-command type="button">Restore ${state.dismissedCommand.length} dismissed</button>` : ""}
        </aside>
      </div>
      <div class="today-action-grid">
        ${todayActionCard("qa-production", "blue", "🎬", "Production move", nextCard ? `${stageLabel(nextCard.stage)}: ${nextStageNudge(nextCard)}` : "Add the next pipeline card", nextCard?.title || "No active planner card yet", "planner", "Planner")}
        ${todayActionCard("qa-comments", "pink", "💬", "Audience demand", commentIdea.title, commentIdea.note, "pulse", "Comments")}
        ${todayActionCard("qa-market", "teal", "📰", "Market signal", topIdea?.title || "Scan market intelligence", topIdea?.reason || "Use news, competitors, and comments to pick the best Indian angle.", "market", "Market")}
        ${todayActionCard("qa-brand", "gold", "💰", "Money watch", sponsorWatch?.name || "No active sponsor watch", sponsorWatch ? `${sponsorWatch.status} · ${formatDealValue(sponsorWatch)}` : "Add brand records or move an active deal forward.", "brand", "Brands")}
      </div>
      <div class="panel command-focus">
        <div class="panel-head"><div><h3>Owner Action Queue</h3><div class="panel-sub">Fast horizontal moves for the next working session.</div></div></div>
        <div class="command-move-grid">
          ${commandMove("move-research", "Research next", topIdea?.title || "Open Video Ideas", topIdea?.reason || "Pick the highest scoring opportunity now.", "ideas", "Video Ideas", "purple")}
          ${commandMove("move-comment", "Comment-picked idea", commentIdea.title, commentIdea.note, "pulse", "Community Pulse", "pink")}
          ${commandMove("move-card", "Move card", nextCard?.title || "No active card", nextCard ? nextStageNudge(nextCard) : "Add a new card from ideas.", "planner", "Planner", "blue")}
          ${commandMove("move-sponsor", "Sponsor timing", sponsorWatch?.name || "No urgent sponsor", sponsorWatch ? `${sponsorWatch.status} · ${formatDealValue(sponsorWatch)}` : "Add prospects or prepare outreach.", "brand", "Brand Deals", "gold")}
        </div>
      </div>
      <div class="panel latest-upload-panel">
        <div class="panel-head"><div><h3>Latest Upload Reach Context</h3><div class="panel-sub">Use the newest video as the baseline for the next title, thumbnail, follow-up, and pinned comment.</div></div></div>
        <div class="upload-spotlight wide">
          <img src="https://i.ytimg.com/vi/${latestUpload.videoId}/mqdefault.jpg" alt="">
          <div class="upload-main">
            <h4>${escapeHTML(latestUpload.title)}</h4>
            <p>${escapeHTML(latestUpload.days)} · ${escapeHTML(latestUpload.category)}</p>
            <div class="upload-reach-grid">
              <div><span>Comment pull</span><strong>${latestComments || "Fresh"}</strong><small>Signals on this upload</small></div>
              <div><span>Best window</span><strong>${escapeHTML(data.bestHours.rows[0]?.time || "09:30 IST")}</strong><small>Next publish timing</small></div>
              <div><span>90d reach base</span><strong>${compact(an.views)}</strong><small>Channel demand pool</small></div>
              <div><span>Top traffic</span><strong>${compact(searchTraffic)}</strong><small>Discovery engine</small></div>
            </div>
            <div class="card-actions"><a class="ghost-btn" href="https://youtube.com/watch?v=${latestUpload.videoId}" target="_blank" rel="noreferrer">Open Video</a><button class="primary-btn" data-command-jump="analytics" type="button">Review Analytics</button><button class="ghost-btn" data-command-jump="pulse" type="button">Check Comments</button></div>
          </div>
        </div>
      </div>
      <div class="grid cols-3">
        <div class="panel">
          <div class="panel-head"><div><h3>Production Health</h3><div class="panel-sub">Immediate state from your saved planner.</div></div></div>
          ${stageBars()}
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>Risk Board</h3><div class="panel-sub">Signals that can weaken trust if ignored.</div></div></div>
          <div class="bars">
            ${riskRow("Retention", data.channel.retention, 42, "Target 38-42%")}
            ${riskRow("Comment rate", data.channel.commentRate, 1, "Target 1%+")}
            ${riskRow("Churn", 15, data.channel.churn, "Keep below 15%", true)}
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>Command Shortcuts</h3><div class="panel-sub">Jump straight to the screen that answers the question.</div></div></div>
          <div class="shortcut-grid">
            ${shortcut("What should I make?", "ideas", "Intelligence: Ideas", "purple")}
            ${shortcut("What does audience want?", "pulse", "Intelligence: Community", "pink")}
            ${shortcut("What is moving in market?", "market", "Intelligence: Market", "teal")}
            ${shortcut("What earns money?", "brand", "Brand Deals", "gold")}
          </div>
        </div>
      </div>`;
    bindCommandControls();
  }
  function commandDecisionLine(card, idea) {
    if (!card) return idea?.reason || "Start by adding one strong idea into the planner, then assign an owner and target date.";
    const stage = stageLabel(card.stage).toLowerCase();
    const owner = card.assignedTo ? teamMemberName(card.assignedTo) : "no owner yet";
    return `${stage} card with ${owner}. Next: ${nextStageNudge(card).toLowerCase()}`;
  }
  function commandChip(label, tone = "blue") {
    return `<span class="command-chip ${tone}">${escapeHTML(label)}</span>`;
  }
  function isCommandDismissed(key) {
    return state.dismissedCommand.includes(key);
  }
  function dismissCommandItem(key) {
    if (!state.dismissedCommand.includes(key)) state.dismissedCommand.push(key);
    saveDismissedCommand();
    renderOverview();
    toast("Command item dismissed.", { label: "Undo", run: () => {
      state.dismissedCommand = state.dismissedCommand.filter((item) => item !== key);
      saveDismissedCommand();
      renderOverview();
    } });
  }
  function restoreCommandItems() {
    state.dismissedCommand = [];
    saveDismissedCommand();
    renderOverview();
    toast("Command items restored.");
  }
  function bindCommandControls() {
    $all("[data-command-jump]").forEach((btn) => btn.addEventListener("click", () => setView(btn.dataset.commandJump)));
    $all("[data-command-dismiss]").forEach((btn) => btn.addEventListener("click", (event) => {
      event.stopPropagation();
      dismissCommandItem(btn.dataset.commandDismiss);
    }));
    $("[data-restore-command]")?.addEventListener("click", restoreCommandItems);
  }
  function commandAlert(key, tone, label, value, note, view, action) {
    if (isCommandDismissed(key)) return "";
    return `<article class="command-alert ${tone}">
      <span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(value)}</strong>
      <small>${escapeHTML(note)}</small>
      <div class="command-card-actions"><button class="mini-link-btn" data-command-jump="${view}" type="button">${escapeHTML(action)} →</button><button class="dismiss-mini-btn" data-command-dismiss="${key}" type="button">Dismiss</button></div>
    </article>`;
  }
  function todayActionCard(key, tone, icon, label, title, note, view, action) {
    if (isCommandDismissed(key)) return "";
    return `<article class="today-action-card ${tone}">
      <span class="today-action-icon">${escapeHTML(icon)}</span>
      <span class="today-action-label">${escapeHTML(label)}</span>
      <strong>${escapeHTML(title)}</strong>
      <small>${escapeHTML(note)}</small>
      <div class="command-card-actions"><button class="mini-link-btn" data-command-jump="${view}" type="button">${escapeHTML(action)} →</button><button class="dismiss-mini-btn" data-command-dismiss="${key}" type="button">Dismiss</button></div>
    </article>`;
  }
  function commandTargetStatus(card) {
    if (!card) return { label: "No target", tone: "gold" };
    const date = parseTargetDate(card.target);
    if (!date) return { label: "No target", tone: "gold" };
    const base = commandToday();
    const diff = Math.round((startOfDay(date) - base) / 86400000);
    if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, tone: "red" };
    if (diff === 0) return { label: "Today", tone: "red" };
    if (diff === 1) return { label: "Tomorrow", tone: "gold" };
    return { label: `${diff}d left`, tone: diff <= 3 ? "gold" : "green" };
  }
  function commandToday() {
    const refreshDate = new Date(data.refreshedAt || Date.now());
    return startOfDay(Number.isNaN(refreshDate.getTime()) ? new Date() : refreshDate);
  }
  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  function isOverdue(card) {
    const date = parseTargetDate(card.target);
    return date && startOfDay(date) < commandToday() && card.stage !== "published";
  }
  function priorityTone(priority = "") {
    const text = String(priority).toLowerCase();
    if (text.includes("urgent")) return "red";
    if (text.includes("high")) return "gold";
    if (text.includes("medium")) return "blue";
    return "green";
  }
  function nextStageNudge(card) {
    return {
      ideas: "attach source, owner, and target date",
      research: "lock research brief and move to recording",
      recording: "record or add editor reference sources",
      editing: "final edit, thumbnail, and scheduled upload check",
      scheduled: "verify title, description, pinned comment, then publish",
      published: "review performance and comments"
    }[card?.stage] || "choose the next action";
  }
  function commentPickedIdea() {
    const visible = visibleIdeas();
    const picked = visible.find((idea) => {
      const signal = String(idea.signal || "").toLowerCase();
      const source = String(idea.source || "").toLowerCase();
      return signal.includes("audience") || signal.includes("pivot") || source.includes("comment");
    });
    if (picked) {
      return {
        title: picked.title,
        note: picked.reason || `Picked from Comment Pulse via ${picked.source || "audience signal"}.`
      };
    }
    const theme = data.commentThemes?.[0];
    if (theme) {
      return {
        title: `${theme.topic} - Hindi Complete Guide 2026`,
        note: `${theme.count || 0} viewers are circling this theme. Turn the repeated comment demand into a full explainer.`
      };
    }
    return {
      title: "Open Comment Pulse",
      note: "Review comments to pick the next audience-led video idea."
    };
  }
  function commandMove(key, title, subject, note, view, action, tone) {
    if (isCommandDismissed(key)) return "";
    return `<div class="command-move ${tone}"><div><span>${escapeHTML(title)}</span><strong>${escapeHTML(subject)}</strong><p>${escapeHTML(note)}</p></div><div class="command-card-actions"><button class="mini-link-btn" data-command-jump="${view}" type="button">${escapeHTML(action)} →</button><button class="dismiss-mini-btn" data-command-dismiss="${key}" type="button">Dismiss</button></div></div>`;
  }
  function shortcut(question, view, label, tone) {
    return `<button class="shortcut ${tone}" data-command-jump="${view}" type="button"><span>${escapeHTML(question)}</span><strong>${escapeHTML(label)}</strong></button>`;
  }
  function riskRow(label, current, target, note, inverse = false) {
    const pct = inverse ? Math.max(0, 100 - (target / current) * 100) : Math.min(100, (current / target) * 100);
    return `<div>
      <div class="bar-row"><strong>${label}</strong><div class="bar-track"><span style="width:${Math.max(6, pct)}%;background:${pct > 75 ? "var(--green)" : "var(--gold)"}"></span></div><span>${note}</span></div>
    </div>`;
  }
  function stageBars() {
    const total = Math.max(1, state.pipeline.length);
    return `<div class="bars">${STAGES.map(([key, label]) => {
      const count = state.pipeline.filter((card) => card.stage === key).length;
      return `<div class="bar-row"><strong>${label}</strong><div class="bar-track"><span style="width:${(count / total) * 100}%"></span></div><span>${count}</span></div>`;
    }).join("")}</div>`;
  }
  function inProgressCount() {
    return state.pipeline.filter((card) => !["ideas", "published"].includes(card.stage)).length;
  }

  function renderAnalytics() {
    const an = data.analytics[state.period];
    const net = an.subscribersGained - an.subscribersLost;
    $("#analytics").innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <div><h3>YouTube Analytics API</h3><div class="panel-sub">Real channel data from the latest cached refresh. Best hours are clearly marked when modeled.</div></div>
          <div class="segmented">${Object.entries(data.analytics).map(([key, value]) => `<button type="button" data-period="${key}" class="${state.period === key ? "active" : ""}">${value.label}</button>`).join("")}</div>
        </div>
        <div class="grid cols-4">
          ${metric(`Views (${an.label})`, formatNumber(an.views), an.period)}
          ${metric("Watch Time", `${formatNumber(an.watchHours)}h`, `${an.averageDuration} average view`)}
          ${metric("Net Growth", `+${formatNumber(net)}`, `${formatNumber(an.subscribersGained)} gained / ${formatNumber(an.subscribersLost)} lost`)}
          ${metric("Engagement", `${an.likeRate}%`, `${an.commentRate}% comment rate`)}
        </div>
      </div>
      <div class="grid cols-2">
        <div class="panel">
          <div class="panel-head"><div><h3>Daily Views Trend</h3><div class="panel-sub">${escapeHTML(an.period)}</div></div></div>
          ${sparkline(an.daily)}
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>Best Hours To Publish</h3><div class="panel-sub">${escapeHTML(data.bestHours.source)}</div></div></div>
          <div class="heat-grid">${data.bestHours.rows.map((row) => `<div class="heat-cell ${row.score >= 80 ? "hot" : ""}"><strong>${escapeHTML(row.time)}</strong><span class="tag ${row.score >= 80 ? "green" : "gold"}">${row.score}/100</span><p class="panel-sub">${escapeHTML(row.note)}</p></div>`).join("")}</div>
        </div>
      </div>
      <div class="grid cols-3">
        ${rankPanel("Top Countries", data.geo.map(([name, code, views, pct]) => [name, `${formatNumber(views)} views`, pct]))}
        ${rankPanel("Devices", data.devices.map(([name, views, pct]) => [name, `${formatNumber(views)} views`, pct]))}
        ${rankPanel("Traffic Sources", data.traffic.map(([name, views, pct]) => [name, `${formatNumber(views)} views`, pct]))}
      </div>
      <div class="grid cols-2">
        <div class="panel"><div class="panel-head"><div><h3>Audience Demographics</h3><div class="panel-sub">Male / female viewer percentage by age group.</div></div></div>${demoBars()}</div>
        <div class="panel"><div class="panel-head"><div><h3>Top Videos</h3><div class="panel-sub">Views, retention, and subscribers gained.</div></div></div>${topVideosTable()}</div>
      </div>`;
    $all("[data-period]").forEach((btn) => btn.addEventListener("click", () => {
      state.period = btn.dataset.period;
      renderAnalytics();
    }));
  }
  function sparkline(rows) {
    const values = rows.map((row) => row[1]);
    const max = Math.max(...values, 1);
    const min = Math.min(...values);
    const width = 720;
    const height = 180;
    const points = rows.map((row, index) => {
      const x = rows.length === 1 ? 0 : (index / (rows.length - 1)) * width;
      const y = height - ((row[1] - min) / Math.max(1, max - min)) * (height - 24) - 12;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily views trend">
      <polyline fill="none" stroke="#246bfe" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="${points}"></polyline>
      <line x1="0" x2="${width}" y1="${height - 12}" y2="${height - 12}" stroke="#ded6c8"></line>
    </svg>`;
  }
  function rankPanel(title, rows) {
    return `<div class="panel"><div class="panel-head"><div><h3>${title}</h3><div class="panel-sub">Current selected period where available.</div></div></div><div class="bars">${rows.map(([name, meta, pct]) => `<div><div class="bar-row"><strong>${escapeHTML(name)}</strong><div class="bar-track"><span style="width:${pct}%"></span></div><span>${pct}%</span></div><div class="panel-sub">${escapeHTML(meta)}</div></div>`).join("")}</div></div>`;
  }
  function demoBars() {
    return `<div class="bars">${data.demographics.map(([age, male, female]) => {
      const total = Math.max(.1, male + female);
      return `<div><div class="bar-row"><strong>${age}</strong><div class="bar-track"><span style="width:${Math.min(100, total * 2.2)}%;background:linear-gradient(90deg,var(--blue) ${(male / total) * 100}%,var(--violet) 0)"></span></div><span>${total.toFixed(1)}%</span></div><div class="panel-sub">Male ${male}% / Female ${female}%</div></div>`;
    }).join("")}</div>`;
  }
  function topVideosTable() {
    return `<div class="table-wrap"><table><thead><tr><th>Video</th><th>Views</th><th>Retention</th><th>Subs +</th></tr></thead><tbody>${data.topVideos.map(([id, title, views, retention, subs]) => `<tr><td><div class="thumb-row"><img src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt=""><a href="https://youtube.com/watch?v=${id}" target="_blank" rel="noreferrer">${escapeHTML(title)}</a></div></td><td>${formatNumber(views)}</td><td>${retention}%</td><td>+${formatNumber(subs)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function renderIntelligence() {
    const an = data.analytics["90d"] || data.analytics[state.period];
    $("#intelligence").innerHTML = `
      <div class="channel-hero">
        <p class="eyebrow">CoinLyte · Channel Intelligence</p>
        <h3>Your Channel, <span>Real-Time</span></h3>
        <p>One app for channel health, market signals, competitor videos, community demand, and final video ideas.</p>
        <div class="hero-chips">
          <span class="hchip purple">Live Analytics</span>
          <span class="hchip teal">India gaps ${data.geo?.[0]?.[3] || 0}%</span>
          <span class="hchip gold">${compact(data.channel.subscribers)} subscribers</span>
          <span class="hchip red">${visibleIdeas().length} fresh ideas</span>
        </div>
      </div>
      <div class="intel-strip">
        ${intelligenceTabs().map(([key, label]) => `<button class="${state.intelligenceTab === key ? "active" : ""}" data-intel-tab="${key}" type="button">${label}</button>`).join("")}
      </div>
      <div class="intel-tab-body">${intelligenceContent(an)}</div>`;
    $all("[data-intel-tab]").forEach((btn) => btn.addEventListener("click", () => {
      state.intelligenceTab = btn.dataset.intelTab;
      renderIntelligence();
    }));
    bindIdeaActions();
    bindIntelligenceActions();
  }
  function intelligenceTabs() {
    return [
      ["health", "Channel Health"],
      ["market", "Market Intel"],
      ["competitors", "Competitor Intel"],
      ["community", "Community Pulse"],
      ["ideas", "Video Ideas"],
      ["action", "Action Plan"]
    ];
  }
  function intelligenceContent(an) {
    if (state.intelligenceTab === "market") return intelligenceMarketContent();
    if (state.intelligenceTab === "competitors") return intelligenceCompetitorContent();
    if (state.intelligenceTab === "community") return intelligenceCommunityContent();
    if (state.intelligenceTab === "ideas") return intelligenceIdeasContent();
    if (state.intelligenceTab === "action") return intelligenceActionContent();
    return intelligenceHealthContent(an);
  }
  function intelligenceHealthContent(an) {
    const net = an.subscribersGained - an.subscribersLost;
    const retention = Number(data.channel.retention || an.retention || 0);
    const likeRate = Number(data.channel.likeRate || an.likeRate || 0);
    const commentRate = Number(data.channel.commentRate || an.commentRate || 0);
    const churn = Number(data.channel.churn || 0);
    return `
      <section class="panel">
        <div class="panel-head"><div><h3>Channel Health</h3><div class="panel-sub">Refreshed ${escapeHTML(new Date(data.refreshedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}. This tab stays focused only on health.</div></div></div>
        <div class="health-stat-grid">
          ${healthStat("Subscribers", compact(data.channel.subscribers), `+${compact(data.channel.subscriberDelta || net)} recent growth`, "gold")}
          ${healthStat("Total Views", compact(data.channel.views || an.views), `${compact(an.views)} in 90 days`, "blue")}
          ${healthStat("Videos", data.channel.videos || data.uploads.length, `${data.channel.cadence || "10-12/mo"} cadence`, "teal")}
          ${healthStat("Avg Retention", `${retention.toFixed(retention % 1 ? 1 : 0)}%`, retention >= 35 ? "Healthy watch depth" : "Below target, fix opening", retention >= 35 ? "green" : "coral")}
          ${healthStat("Like Rate", `${likeRate.toFixed(2)}%`, likeRate >= 3 ? "Excellent" : "Improve ask-to-like", likeRate >= 3 ? "violet" : "gold")}
          ${healthStat("Comment Rate", `${commentRate.toFixed(2)}%`, commentRate >= 1 ? "Community healthy" : "Needs pinned question", commentRate >= 1 ? "green" : "pink")}
        </div>
      </section>
      <div class="grid cols-2">
        <section class="panel">
          <div class="panel-head"><div><h3>Health Priority</h3><div class="panel-sub">Only channel health signals here. Research stays in the other subtabs.</div></div></div>
          <div class="rule-stack">
            ${intelligenceRule("red", "Fix Retention First", "Treat the opening 30 seconds as the main bottleneck until retention crosses 35%.")}
            ${intelligenceRule("gold", "Raise Comment Rate", "Every upload needs a specific pinned question and fast first-48-hour replies.")}
            ${intelligenceRule("teal", "Protect Cadence", "Do not slow below the current 10-12/month rhythm while improving packaging.")}
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h3>Health Rules</h3><div class="panel-sub">Keep checking these after every refresh.</div></div></div>
          <div class="rule-stack">
            ${intelligenceRule("teal", "Upload Cadence", `${data.channel.cadence || "10-12/mo"} is your strongest edge. Keep the calendar moving.`)}
            ${intelligenceRule("gold", "Churn Watch", `${churn.toFixed(1)}% churn means content type rotation matters.`)}
            ${intelligenceRule("red", "Retention Emergency", `${retention.toFixed(1)}% retention needs stronger first 30 seconds.`)}
            ${intelligenceRule("violet", "Topic Saturation", "Alternate scams, wallets, regulation, stablecoins, and India explainers.")}
          </div>
        </section>
      </div>`;
  }
  function intelligenceMarketContent() {
    const signals = marketSignals();
    const urgentCount = signals.filter((signal) => normalizePriority(signal.idea.urgency) === "urgent").length;
    return `<section class="panel market-intel-panel">
      <div class="panel-head">
        <div><h3>📰 Market Intelligence — Trending Topics Worth Covering</h3><div class="panel-sub">India policy · US regulation · global macro · every card carries source age and Indian angle.</div></div>
        <span class="tag green">🟢 Live · ${urgentCount} urgent</span>
      </div>
      ${marketLane("🔴 Urgent — India Policy News", "RBI, tax, exchanges, India investor risk. Cover first when it affects Indian viewers directly.", "india", signals)}
      ${marketLane("🟣 US Policy / Regulation", "GENIUS, CLARITY, SEC/CFTC, stablecoin law. Convert global regulation into India-safe decisions.", "regulation", signals)}
      ${marketLane("🌐 Global Market News", "Bitcoin, ETH, macro, institutions, RWA, AI crypto. Use when it can become a simple Hindi story.", "market", signals)}
      ${signals.length ? `<div class="market-monitor">
        <h4>📡 Monitor These Sources Daily</h4>
        <div class="card-actions">
          ${["CoinDesk", "CoinTelegraph", "ET Markets Crypto", "Google News India", "The Block", "RBI Press"].map((source) => `<span class="ghost-btn source-chip">${source} ↗</span>`).join("")}
        </div>
      </div>` : `<div class="empty">No market signals available. Refresh live data to fetch news.</div>`}
    </section>
    <section class="panel reading-guide">
      <div class="panel-head"><div><h3>📖 Reading Guide</h3><div class="panel-sub">How to decide what deserves a planner card.</div></div></div>
      <div class="rule-stack">
        ${intelligenceRule("teal", "India Gap", "Covered globally but not yet in Hindi. Act within 1-2 weeks for first-mover advantage.")}
        ${intelligenceRule("gold", "Speed Rule", "India Policy and US Regulation cool fastest. If it has source age Today or 1 day ago, decide now.")}
        ${intelligenceRule("violet", "Global Market Filter", "Only add global market stories if they connect to rupee impact, exchange safety, or portfolio decisions.")}
      </div>
    </section>`;
  }
  function marketLane(title, subtitle, key, signals) {
    const laneSignals = signals.map((signal, index) => ({ signal, index })).filter(({ signal }) => signal.key === key);
    const tone = key === "india" ? "red" : key === "regulation" ? "gold" : "blue";
    return `<div class="market-lane market-lane-${tone}">
      <div class="market-lane-head"><div><h4>${escapeHTML(title)}</h4><p>${escapeHTML(subtitle)}</p></div><span>${laneSignals.length}</span></div>
      <div class="market-signal-grid">
        ${laneSignals.map(({ signal, index }) => marketSignalCard(signal, index)).join("") || `<div class="empty">No ${escapeHTML(title)} signals in this refresh.</div>`}
      </div>
    </div>`;
  }
  function intelligenceCompetitorContent() {
    const tones = ["red", "teal", "violet"];
    const suggested = competitorSuggestedIdeas();
    return `<div class="competitor-grid">${data.competitors.map((comp, index) => {
      const videos = (comp.latest || []).map(normalizeCompetitorVideo).filter((video) => isVisibleGeneratedIdea(competitorIdea(comp, video)));
      return `<article class="competitor-card tone-${tones[index % tones.length]}">
        <div class="competitor-head">
          <div><div class="competitor-kicker"><span></span>${escapeHTML(comp.channel)} · ${escapeHTML(comp.cadence)}</div><h3>${escapeHTML(comp.channel)} ↗</h3><p>${escapeHTML(comp.reason)}</p></div>
        </div>
        <div class="competitor-video-list">
          ${videos.map((video) => {
            const idea = competitorIdea(comp, video);
            return `<div class="competitor-row">
              <div><h4>${escapeHTML(video.title)}</h4><div class="row-tags"><span class="badge teal">🇮🇳 India Gap</span><span class="badge ${normalizePriority(idea.urgency) === "urgent" ? "red" : "amber"}">⏱ ${escapeHTML(video.days)}</span></div></div>
              <div class="row-actions">
                ${video.url ? `<a class="mini-link" href="${escapeHTML(video.url)}" target="_blank" rel="noreferrer">Source ↗</a>` : ""}
                <button class="primary-btn compact-btn" data-add-generated data-idea-payload="${escapeHTML(ideaPayload(idea))}" type="button">+ Idea</button>
                <button class="ghost-btn compact-btn dismiss-btn" data-dismiss-generated data-idea-payload="${escapeHTML(ideaPayload(idea))}" type="button">Dismiss</button>
              </div>
            </div>`;
          }).join("") || `<div class="empty">All visible gaps from this channel are already planned or dismissed.</div>`}
        </div>
      </article>`;
    }).join("")}</div>
    <section class="panel competitor-ideas-panel">
      <div class="panel-head"><div><h3>🎯 Competitor Learning → CoinLyte Ideas</h3><div class="panel-sub">Not a copy of their videos: these are India/Hindi audience-fit angles derived from their latest topics.</div></div><span class="tag teal">${suggested.length} fit ideas</span></div>
      <div class="idea-grid">${suggested.map((idea) => ideaCard(idea)).join("") || `<div class="empty">No new competitor-fit ideas. Existing ones are already planned or dismissed.</div>`}</div>
    </section>`;
  }
  function intelligenceCommunityContent() {
    const comments = data.comments || [];
    const themes = data.commentThemes || [];
    const sortedComments = [...comments].sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0)).slice(0, 12);
    return `<div class="panel">
      <div class="panel-head"><div><h3>Community Pulse</h3><div class="panel-sub">Viewer demand before the final idea tab.</div></div></div>
      <div class="idea-grid">${themes.slice(0, 8).map((theme) => `<div class="theme-card"><h4>${escapeHTML(theme.topic || "Theme")}</h4><div class="theme-count">${formatNumber(theme.count || 0)} comments</div><div class="theme-bar"><span style="width:${Math.min(100, Number(theme.count || 0) * 5)}%"></span></div>${theme.sample ? `<div class="theme-quote">"${escapeHTML(theme.sample).slice(0, 130)}"</div>` : ""}</div>`).join("") || `<div class="empty">Run refresh to build comment themes.</div>`}</div>
    </div>
    <div class="panel community-ideas-panel">
      <div class="panel-head"><div><h3>💡 Community + AI Suggested Ideas</h3><div class="panel-sub">Video ideas generated after reading repeated comments and topic gaps.</div></div></div>
      <div class="idea-grid">${communityIdeaCards(themes).join("") || `<div class="empty">No community ideas available yet.</div>`}</div>
    </div>
    <div class="panel">
      <div class="panel-head"><div><h3>Top Comments by Engagement</h3><div class="panel-sub">Kept at the end for deeper review when needed.</div></div></div>
      <div class="comment-list">${sortedComments.map((comment, index) => `<article class="comment-item">
        <div class="comment-meta"><span class="comment-author">${escapeHTML(comment.author)}</span><span class="panel-sub">${formatNumber(comment.likes || 0)} likes</span><span class="tag ${commentIntentClass(comment.intent)}">${escapeHTML(normalizeIntent(comment.intent))}</span></div>
        <div class="comment-text">${escapeHTML(comment.text).slice(0, 220)}${String(comment.text || "").length > 220 ? "..." : ""}</div>
        <div class="panel-sub">${escapeHTML(comment.video || comment.videoTitle || "Recent upload")}</div>
        <div class="card-actions"><button class="ghost-btn" data-comment-idea="${index}" type="button">Make Video Idea</button></div>
      </article>`).join("") || `<div class="empty">No comments available in this refresh snapshot.</div>`}</div>
    </div>`;
  }
  function intelligenceIdeasContent() {
    const ideas = visibleIdeas();
    return `<div class="mission-banner compact">
      <div class="mission-quote">"${ideas.length} visible ideas split by <span>posting urgency</span>"</div>
      <div class="mission-pills">
        <span class="mission-pill red">${ideas.filter((idea) => normalizePriority(idea.urgency) === "urgent").length} urgent</span>
        <span class="mission-pill gold">${ideas.filter((idea) => normalizePriority(idea.urgency) === "high").length} high</span>
        <span class="mission-pill purple">${ideas.filter((idea) => normalizePriority(idea.urgency) === "medium").length} queue</span>
      </div>
    </div>
    ${videoIdeaSections(ideas)}`;
  }
  function intelligenceActionContent() {
    const bestHour = data.bestHours?.rows?.[0]?.time || "09:30-10:00 IST";
    const topTheme = data.commentThemes?.[0]?.topic || "cold wallet / safety questions";
    return `<section class="action-plan">
      <div class="mission-banner compact">
        <div class="mission-quote">"Learn Crypto. <span>Grow Your Wealth.</span> Invest Smartly."</div>
        <div class="mission-pills">
          <span class="mission-pill teal">Upload ${escapeHTML(bestHour)}</span>
          <span class="mission-pill gold">Rupee hook in every title</span>
          <span class="mission-pill red">Zero trading promo</span>
          <span class="mission-pill purple">Alternate categories</span>
        </div>
      </div>
      <div class="grid cols-2">
        <div class="panel"><div class="panel-head"><div><h3>30-Day Sprint</h3><div class="panel-sub">What the channel should do next.</div></div></div><div class="sprint-list">
          ${sprintWeek("Week 1", "Retention repair", ["Rewrite the first 30 seconds for the next two recordings", "Pinned comment question on every new upload"])}
          ${sprintWeek("Week 2", "Audience demand", [`Turn ${topTheme} into one Hindi explainer`, "Reply to top 20 comments within 48 hours"])}
          ${sprintWeek("Week 3", "Competitor gap", data.competitors.slice(0, 2).map((comp) => `${comp.channel}: Indian version of best gap`))}
          ${sprintWeek("Week 4", "Scale winners", ["Double down on best retention topic", "Review churn, retention, comment rate after refresh"])}
        </div></div>
        <div class="panel"><div class="panel-head"><div><h3>Non-Negotiable Rules</h3><div class="panel-sub">Every video, every time.</div></div></div><div class="rule-stack">
          ${intelligenceRule("teal", `Upload ${bestHour}`, "No random timing unless it is breaking news.")}
          ${intelligenceRule("teal", "Rupee Amount in Title", "Indian CTR needs money context before coin context.")}
          ${intelligenceRule("teal", "End with Pinned Question", "Ask one specific question viewers can answer in one line.")}
          ${intelligenceRule("red", "Max 1 XRP Video / Month", "Prevents topic fatigue.")}
          ${intelligenceRule("gold", "Check Competitors Before Recording", "Do this before the title is locked.")}
        </div></div>
      </div>
    </section>`;
  }
  function marketSignalCard(signal, index) {
    const idea = signal.idea;
    const priority = normalizePriority(idea.urgency);
    return `<article class="market-signal-card tone-${signal.tone}">
      <span class="source-age ${priority}">${escapeHTML(signal.age)}</span>
      <div class="market-kicker">${escapeHTML(signal.emoji)} ${escapeHTML(signal.bucket)} · ${escapeHTML(idea.category)}</div>
      <h4>${escapeHTML(idea.title)}</h4>
      <p>💡 Angle: ${escapeHTML(newsAngle(signal.item, signal.bucket))}</p>
      <div class="card-actions">
        <span class="badge ${priority === "urgent" ? "red" : priority === "high" ? "amber" : "navy"}">${priority === "urgent" ? "🔴 Urgent" : priority === "high" ? "🟡 High" : "⚪ Medium"}</span>
        <span class="badge teal">🇮🇳 India angle</span>
      </div>
      <div class="market-card-actions">
        ${idea.sourceUrl ? `<a class="mini-link" href="${escapeHTML(idea.sourceUrl)}" target="_blank" rel="noreferrer">📰 Source ↗</a>` : `<span class="mini-link muted-link">📰 Source pending</span>`}
        <button class="primary-btn compact-btn" data-add-market="${index}" type="button">+ Planner</button>
        <button class="ghost-btn compact-btn dismiss-btn" data-dismiss-market="${index}" type="button">Dismiss</button>
      </div>
    </article>`;
  }
  function bindIntelligenceActions() {
    $all("[data-news-title]").forEach((btn) => btn.addEventListener("click", () => addIdeaToPipeline({
      title: `News: ${btn.dataset.newsTitle}`,
      category: btn.dataset.newsCat,
      urgency: btn.dataset.newsCat === "India Policy" ? "Urgent" : "High",
      source: btn.dataset.newsCat,
      sourceUrl: btn.dataset.newsUrl || "",
      reason: newsAngle({}, btn.dataset.newsCat)
    })));
    const signals = marketSignals();
    $all("[data-add-market]").forEach((btn) => btn.addEventListener("click", () => {
      const signal = signals[Number(btn.dataset.addMarket)];
      if (signal) animateAction(btn, "add", () => addIdeaToPipeline(signal.idea));
    }));
    $all("[data-dismiss-market]").forEach((btn) => btn.addEventListener("click", () => {
      const signal = signals[Number(btn.dataset.dismissMarket)];
      if (signal) animateAction(btn, "dismiss", () => dismissIdea(signal.idea));
    }));
    $all("[data-add-generated]").forEach((btn) => btn.addEventListener("click", () => {
      const idea = readIdeaPayload(btn);
      if (idea) animateAction(btn, "add", () => addIdeaToPipeline(idea));
    }));
    $all("[data-dismiss-generated]").forEach((btn) => btn.addEventListener("click", () => {
      const idea = readIdeaPayload(btn);
      if (idea) animateAction(btn, "dismiss", () => dismissIdea(idea));
    }));
    const sortedComments = [...(data.comments || [])].sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0)).slice(0, 12);
    $all("[data-comment-idea]").forEach((btn) => btn.addEventListener("click", () => {
      const comment = sortedComments[Number(btn.dataset.commentIdea)];
      animateAction(btn, "add", () => addIdeaToPipeline({
        title: `💬 Viewer asked: ${comment.text.slice(0, 78)}`,
        category: "Community",
        urgency: normalizeIntent(comment.intent) === "Idea" ? "High" : "Medium",
        source: "Community Comments",
        signal: "audience_ask",
        reason: `Audience signal from ${comment.author}: ${comment.text}`
      }));
    }));
  }
  function healthStat(label, value, note, tone) {
    return `<div class="health-stat ${tone}"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong><small>${escapeHTML(note)}</small></div>`;
  }
  function intelligenceRule(tone, title, body) {
    return `<div class="intel-rule ${tone}"><strong>${escapeHTML(title)}</strong><span>${escapeHTML(body)}</span></div>`;
  }
  function sprintWeek(label, theme, items) {
    return `<div class="sprint-week"><div><strong>${escapeHTML(label)}</strong><span>${escapeHTML(theme)}</span></div><ul>${items.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul></div>`;
  }
  function videoIdeaSections(ideas) {
    const groups = [
      { key: "urgent", tone: "red", title: "🔴 Urgent Priority — Post This Week", sub: "Market timing, competitor gaps, or audience demand that should move into Planner first." },
      { key: "high", tone: "gold", title: "🟡 High Priority — This Month", sub: "Strong ideas worth planning after urgent items are scheduled." },
      { key: "medium", tone: "blue", title: "🔵 Medium Priority — Queue It", sub: "Good backlog ideas for evergreen videos, follow-ups, and calmer production weeks." }
    ];
    return groups.map((group) => {
      const groupIdeas = ideas.filter((idea) => normalizePriority(idea.urgency) === group.key);
      return `<section class="idea-priority-section tone-${group.tone}">
        <div class="idea-section-head"><div><h3>${escapeHTML(group.title)}</h3><p>${escapeHTML(group.sub)}</p></div><span>${groupIdeas.length}</span></div>
        <div class="idea-grid">${groupIdeas.map((idea) => ideaCard(idea)).join("") || `<div class="empty">No ${escapeHTML(group.key)} ideas visible right now.</div>`}</div>
      </section>`;
    }).join("");
  }
  function renderVideoIdeas() {
    const ideas = visibleIdeas();
    const all = data.ideas || [];
    const urgent = ideas.filter((idea) => normalizePriority(idea.urgency) === "urgent").length;
    const high = ideas.filter((idea) => normalizePriority(idea.urgency) === "high").length;
    const medium = ideas.filter((idea) => normalizePriority(idea.urgency) === "medium").length;
    const removed = all.length - ideas.length;
    $("#ideas").innerHTML = `
      <div class="mission-banner">
        <div class="mission-quote">"${all.length} AI-generated ideas analysed from <span>live channel, competitor, news, and community data</span>"</div>
        <div class="mission-pills">
          <span class="mission-pill purple">AI ranked</span>
          <span class="mission-pill red">${urgent} urgent this week</span>
          <span class="mission-pill gold">${high} high priority</span>
          <span class="mission-pill teal">${medium} queue ideas</span>
          <span class="mission-pill">Refresh: ${escapeHTML(data.refreshBuild || "cached")}</span>
        </div>
      </div>
      ${removed ? `<div class="panel"><div class="panel-head"><div><h3>${removed} Idea${removed > 1 ? "s" : ""} Hidden</h3><div class="panel-sub">Dismissed ideas stay hidden on this browser so your working list gets cleaner over time.</div></div><button class="ghost-btn" data-restore-ideas type="button">Restore ${removed}</button></div></div>` : ""}
      <div class="grid cols-4">
        ${metric("Visible Ideas", ideas.length, "After pipeline and dismiss filters")}
        ${metric("Community Signals", all.filter((idea) => String(idea.signal || "").includes("audience")).length, "Viewer-driven briefs")}
        ${metric("News Trends", all.filter((idea) => String(idea.signal || "").includes("news")).length, "Market timing opportunities")}
        ${metric("Topic Pivots", all.filter((idea) => String(idea.signal || "").includes("pivot")).length, "Fix low-performer angles")}
      </div>
      ${videoIdeaSections(ideas) || `<div class="empty">All ideas are dismissed or already in the pipeline. Restore dismissed ideas or refresh for a new set.</div>`}`;
    bindIdeaActions();
    $("[data-restore-ideas]")?.addEventListener("click", restoreDismissedIdeas);
  }
  function renderCommentPulse() {
    const comments = data.comments || [];
    const themes = data.commentThemes || [];
    const communityIdeas = communityIdeaCards(themes);
    const sortedComments = [...comments].sort((a, b) => (Number(b.likes || 0) - Number(a.likes || 0))).slice(0, 25);
    const counts = comments.reduce((acc, comment) => {
      const key = normalizeIntent(comment.intent);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const topTheme = themes[0]?.topic || "Viewer questions";
    $("#pulse").innerHTML = `
      <div class="pulse-hero">
        <h3>Community <span>Pulse</span></h3>
        <p>Live audience analysis: filtered comments from recent videos, scam noise removed, ranked into questions, video requests, concerns, and praise.</p>
        <div class="hero-chips">
          <span class="hchip purple">${comments.length} comments</span>
          <span class="hchip teal">${counts.Idea || 0} video ideas asked</span>
          <span class="hchip gold">${counts.Ask || 0} questions</span>
          <span class="hchip red">Top: ${escapeHTML(topTheme)}</span>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h3>Top Comment Themes</h3><div class="panel-sub">What your audience is actually asking, ranked by frequency.</div></div></div>
        <div class="idea-grid">${themes.slice(0, 10).map((theme) => `<div class="theme-card"><h4>${escapeHTML(theme.topic || "Theme")}</h4><div class="theme-count">${formatNumber(theme.count || 0)} comments</div><div class="theme-bar"><span style="width:${Math.min(100, Number(theme.count || 0) * 5)}%"></span></div>${theme.sample ? `<div class="theme-quote">"${escapeHTML(theme.sample).slice(0, 130)}"</div>` : ""}</div>`).join("") || `<div class="empty">Run refresh to build comment themes.</div>`}</div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <div><h3>Community + AI Suggested Ideas</h3><div class="panel-sub">Based on viewer asks plus AI analysis of gaps and pivots.</div></div>
          ${state.dismissedIdeas.length ? `<button class="ghost-btn" data-restore-ideas type="button">Restore ${state.dismissedIdeas.length}</button>` : ""}
        </div>
        <div class="idea-grid">${communityIdeas.join("") || `<div class="empty">No community-specific ideas visible. Restore dismissed ideas or refresh comments.</div>`}</div>
      </div>
      <div class="grid cols-2">
        <div class="panel">
          <div class="panel-head"><div><h3>Intent Mix</h3><div class="panel-sub">Use this to decide whether to explain, reassure, or respond.</div></div></div>
          <div class="bars">
            ${Object.entries({ Ask: counts.Ask || 0, Idea: counts.Idea || 0, Concern: counts.Concern || 0, Praise: counts.Praise || 0 }).map(([label, value]) => {
              const pct = comments.length ? Math.round((value / comments.length) * 100) : 0;
              return `<div><div class="bar-row"><strong>${label}</strong><div class="bar-track"><span class="${commentIntentClass(label)}" style="width:${Math.max(5, pct)}%"></span></div><span>${pct}%</span></div><div class="panel-sub">${value} comments</div></div>`;
            }).join("")}
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>Comment Strategy</h3><div class="panel-sub">Actions that directly improve community depth.</div></div></div>
          <div class="bars">
            <div class="strategy-rule purple"><strong>Pin a Question</strong><br>After every upload, pin one specific question like "ETH रखोगे या SOL?" to move comment rate toward 1%+.</div>
            <div class="strategy-rule teal"><strong>Reply to Idea Requests</strong><br>Every "video banao" comment is a free brief. Reply "Aa raha hai!" and create anticipation.</div>
            <div class="strategy-rule gold"><strong>48-Hour Window</strong><br>Reply hardest in the first 48 hours. YouTube rewards active comment sections.</div>
            <div class="strategy-rule navy"><strong>Refresh for Fresh Data</strong><br>Scans recent videos, comments, themes, and AI topic pivots.</div>
          </div>
        </div>
      </div>
      <div class="panel" style="padding:0;overflow:hidden">
        <div style="padding:18px 20px 14px;border-bottom:1px solid var(--line)">
          <h3 style="margin:0">Top Comments by Engagement</h3>
          <div class="panel-sub">Sorted by likes. Turn strong comments into planner cards or pinned replies.</div>
        </div>
        <div class="comment-list">${sortedComments.map((comment, index) => `<article class="comment-item">
          <div class="comment-meta"><span class="comment-author">${escapeHTML(comment.author)}</span><span class="comment-age">${escapeHTML(comment.age || "recent")}</span><span class="panel-sub">${formatNumber(comment.likes || 0)} likes</span><span class="tag ${commentIntentClass(comment.intent)}">${escapeHTML(normalizeIntent(comment.intent))}</span></div>
          <div class="comment-text">${escapeHTML(comment.text).slice(0, 220)}${String(comment.text || "").length > 220 ? "..." : ""}</div>
          <div class="panel-sub">${escapeHTML(comment.video || comment.videoTitle || "Recent upload")}</div>
          <div class="card-actions"><button class="ghost-btn" data-comment-idea="${index}" type="button">Make Video Idea</button></div>
        </article>`).join("") || `<div class="empty">No comments available in this refresh snapshot.</div>`}</div>
      </div>`;
    bindIdeaActions();
    $("[data-restore-ideas]")?.addEventListener("click", restoreDismissedIdeas);
    $all("[data-comment-idea]").forEach((btn) => btn.addEventListener("click", () => {
      const comment = sortedComments[Number(btn.dataset.commentIdea)];
      addIdeaToPipeline({
        title: `Viewer asked: ${comment.text.slice(0, 78)}`,
        category: "Community",
        urgency: normalizeIntent(comment.intent) === "Idea" ? "High" : "Medium",
        source: "Community Comments",
        reason: `Audience signal from ${comment.author}: ${comment.text}`
      });
    }));
  }
  function communityIdeaCards(themes) {
    const dismissed = new Set(state.dismissedIdeas);
    const aiIdeas = (data.ideas || []).filter((idea) => {
      const signal = String(idea.signal || "").toLowerCase();
      return (signal.includes("audience") || signal.includes("pivot") || String(idea.source || "").toLowerCase().includes("comment")) && !dismissed.has(ideaKey(idea));
    }).slice(0, 5).map((idea) => ideaCard(idea));
    if (aiIdeas.length) return aiIdeas;
    return (themes || []).filter((theme) => Number(theme.count || 0) > 0).slice(0, 4).map((theme) => {
      const idea = {
        title: `${theme.topic} - Hindi Complete Guide 2026`,
        category: "Community",
        urgency: "High",
        source: "Comment Themes",
        signal: "audience_ask",
        reason: `${theme.count} viewers asked about this. ${theme.sample || "Convert this repeated theme into a simple Hindi explainer."}`,
        score: Math.min(95, 65 + Number(theme.count || 0))
      };
      if (dismissed.has(ideaKey(idea))) return "";
      return ideaCard(idea);
    });
  }
  function normalizeIntent(intent = "") {
    const text = String(intent).toLowerCase();
    if (text.includes("question") || text.includes("ask")) return "Ask";
    if (text.includes("idea") || text.includes("request")) return "Idea";
    if (text.includes("support") || text.includes("praise") || text.includes("thanks")) return "Praise";
    if (text.includes("concern")) return "Concern";
    return labelCase(intent || "Comment");
  }
  function commentIntentClass(intent = "") {
    const text = normalizeIntent(intent).toLowerCase();
    if (text.includes("ask")) return "blue";
    if (text.includes("idea")) return "pink";
    if (text.includes("praise")) return "green";
    if (text.includes("concern")) return "gold";
    return "violet";
  }
  function normalizePriority(priority = "") {
    const text = String(priority).toLowerCase();
    if (text.includes("urgent") || text.includes("🔴")) return "urgent";
    if (text.includes("high") || text.includes("🟡")) return "high";
    return "medium";
  }
  function renderMarket() {
    const market = data.market || {};
    const topSource = topIdeaSource();
    const topSourceValue = topSource.includes("Comment") ? "Audience" : topSource.split(/\s+/).slice(0, 2).join(" ");
    const ideas = visibleIdeas();
    const allNews = [
      ...(market.india || []).map((item) => ({ ...item, bucket: "India Policy", weight: 10 })),
      ...(market.regulation || []).map((item) => ({ ...item, bucket: "US Regulation", weight: 8 })),
      ...(market.market || []).map((item) => ({ ...item, bucket: "Global Market", weight: 6 }))
    ].slice(0, 30);
    $("#market").innerHTML = `
      <div class="hero-band">
        <div class="hero-copy">
          <p class="eyebrow">Intelligence engine</p>
          <h3>Market signal to video decision.</h3>
          <p>This view is built around your real refresh engine: India policy, global crypto news, competitor movement, comment demand, and channel analytics. It is designed to answer one question: should CoinLyte make this video now?</p>
          <div class="grid cols-4">
            ${metric("News Signals", allNews.length, "Deduped RSS/news items")}
            ${metric("AI Ideas", data.ideas.length, "Ranked by refresh engine")}
            ${metric("Audience Themes", data.commentThemes?.length || 0, "From latest comments")}
            ${metric("Top Source", topSourceValue, `Leading signal: ${topSource}`)}
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>Idea Scoring Model</h3><div class="panel-sub">Transparent enough for trust, flexible enough for future tuning.</div></div></div>
          <div class="bars">
            ${scoreRule("Audience demand", "Comments, repeated questions, and viewer language", 28)}
            ${scoreRule("Timing", "India policy, regulation, breaking market context", 24)}
            ${scoreRule("Channel fit", "Matches proven formats and avoids recent duplicate topics", 22)}
            ${scoreRule("Competitor gap", "English/global story not yet localized for India", 16)}
            ${scoreRule("Execution confidence", "Clear hook, thumbnail, and retention promise", 10)}
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <div><h3>Best Ideas Right Now</h3><div class="panel-sub">From live AI output. Score includes priority, signal type, and CoinLyte fit.</div></div>
          ${state.dismissedIdeas.length ? `<button class="ghost-btn" data-restore-ideas type="button">Restore ${state.dismissedIdeas.length}</button>` : ""}
        </div>
        <div class="idea-grid">${ideas.slice(0, 9).map((idea) => ideaCard(idea)).join("") || `<div class="empty">All ideas are dismissed. Restore them when you want to review again.</div>`}</div>
      </div>
      <div class="grid cols-3">
        ${newsPanel("India Policy", market.india || [], "India investor angle, RBI, tax, exchanges")}
        ${newsPanel("US Regulation", market.regulation || [], "GENIUS Act, CLARITY Act, ETF, SEC/CFTC")}
        ${newsPanel("Global Market", market.market || [], "Bitcoin, ETH, XRP, stablecoins, RWA, AI crypto")}
      </div>
      <div class="grid cols-2">
        <div class="panel">
          <div class="panel-head"><div><h3>Audience Demand Map</h3><div class="panel-sub">Comment themes from the latest refresh.</div></div></div>
          <div class="bars">${(data.commentThemes || []).slice(0, 10).map((theme) => `<div class="bar-row"><strong>${escapeHTML(theme.topic)}</strong><div class="bar-track"><span style="width:${Math.min(100, Number(theme.count || 0) * 4)}%"></span></div><span>${theme.count || 0}</span></div>`).join("") || `<div class="empty">Run refresh to mine comment themes.</div>`}</div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>Topic Pivot Watch</h3><div class="panel-sub">Recent videos that may need a better angle.</div></div></div>
          <div class="bars">${(data.videoPerformance || []).slice(0, 8).map((video) => `<div class="list-card"><h4>${escapeHTML(video.title || "Video")}</h4><p>${formatNumber(video.views || 0)} views ${video.pctOfAvg ? `| ${video.pctOfAvg}% of recent average` : ""}</p><button class="ghost-btn" data-pivot="${escapeHTML(video.title || "")}" type="button">Make Pivot Card</button></div>`).join("") || `<div class="empty">Performance pivots appear after refresh.</div>`}</div>
        </div>
      </div>`;
    bindIdeaActions();
    $("[data-restore-ideas]")?.addEventListener("click", restoreDismissedIdeas);
    $all("[data-news-title]").forEach((btn) => btn.addEventListener("click", () => addIdeaToPipeline({
      title: `News: ${btn.dataset.newsTitle}`,
      category: btn.dataset.newsCat,
      urgency: btn.dataset.newsCat === "India Policy" ? "Urgent" : "High",
      source: btn.dataset.newsCat,
      reason: newsAngle({}, btn.dataset.newsCat)
    })));
    $all("[data-pivot]").forEach((btn) => btn.addEventListener("click", () => addIdeaToPipeline({
      title: `Pivot: ${btn.dataset.pivot}`,
      category: "Topic Pivot",
      urgency: "High",
      source: "Analytics Data",
      reason: "Created from video performance watchlist. Reframe the same topic with a sharper hook and India-first promise."
    })));
  }
  function scoreRule(label, note, weight) {
    return `<div><div class="bar-row"><strong>${label}</strong><div class="bar-track"><span style="width:${weight * 3}%"></span></div><span>${weight}%</span></div><div class="panel-sub">${note}</div></div>`;
  }
  function topIdeaSource() {
    const counts = data.ideas.reduce((acc, idea) => {
      acc[idea.source] = (acc[idea.source] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Refresh";
  }
  function newsPanel(title, items, subtitle) {
    return `<div class="panel"><div class="panel-head"><div><h3>${title}</h3><div class="panel-sub">${subtitle}</div></div></div><div class="bars">${items.slice(0, 8).map((item) => {
      const angle = newsAngle(item, title);
      return `<div class="list-card"><span class="tag ${title === "India Policy" ? "red" : title === "US Regulation" ? "gold" : "blue"}">${escapeHTML(item.region || title)}</span><h4>${escapeHTML(item.title || "Untitled signal")}</h4><p>${escapeHTML(angle)}</p><div class="card-actions">${item.url ? `<a class="ghost-btn" href="${escapeHTML(item.url)}" target="_blank" rel="noreferrer">Source</a>` : ""}<button class="primary-btn" data-news-title="${escapeHTML(item.title || "")}" data-news-cat="${escapeHTML(title)}" type="button">Add Idea</button></div></div>`;
    }).join("") || `<div class="empty">No live signals yet.</div>`}</div></div>`;
  }
  function newsAngle(item, bucket) {
    if (bucket === "India Policy") return "Localize this for Indian investors: tax, exchange access, RBI risk, or rupee impact.";
    if (bucket === "US Regulation") return "Explain why a US decision changes liquidity, exchange access, or token risk for India.";
    return "Use only if it can become a simple Hindi story with a rupee amount, risk, or portfolio decision.";
  }
  function ideaCard(idea) {
    const exists = state.pipeline.some((card) => card.title.toLowerCase() === idea.title.toLowerCase());
    const tone = categoryTone(idea.category, idea.urgency);
    const key = escapeHTML(ideaKey(idea));
    const priority = normalizePriority(idea.urgency);
    const priorityBadge = priority === "urgent" ? ["red", "Urgent"] : priority === "high" ? ["amber", "High"] : ["navy", "Medium"];
    const sig = signalMeta(idea.signal);
    const emoji = categoryEmoji(idea.category, idea.signal || idea.source);
    const payload = escapeHTML(ideaPayload(idea));
    return `<div class="list-card idea-card">
      <div class="idea-top idea-${tone}">
        <div class="idea-cat">${emoji} ${escapeHTML(idea.source || sig.label)} · ${escapeHTML(idea.category || "Education")}</div>
        <h4>${escapeHTML(withLeadingEmoji(idea.title, emoji))}</h4>
      </div>
      <div class="idea-body">
        <p>${escapeHTML(idea.reason)}</p>
        <div class="card-actions">
          <span class="badge ${priorityBadge[0]}">${priority === "urgent" ? "🔴" : priority === "high" ? "🟡" : "⚪"} ${priorityBadge[1]}</span>
          <span class="badge ${sig.color}">${sig.label}</span>
          ${idea.sourceAge ? `<span class="badge blue">⏱ ${escapeHTML(idea.sourceAge)}</span>` : ""}
          ${idea.score ? `<span class="badge teal">${Math.round(idea.score)}/100</span>` : ""}
        </div>
        <div class="idea-source">${escapeHTML(idea.source || "Refresh Engine")}</div>
        <div class="card-actions">
          ${idea.sourceUrl || idea.url ? `<a class="mini-link" href="${escapeHTML(idea.sourceUrl || idea.url)}" target="_blank" rel="noreferrer">Source ↗</a>` : ""}
          <button class="primary-btn compact-btn" data-add-idea="${key}" data-idea-payload="${payload}" type="button" ${exists ? "disabled" : ""}>${exists ? "In Planner" : "+ Planner"}</button>
          <button class="ghost-btn compact-btn idea-dismiss dismiss-btn" data-dismiss-idea="${key}" data-idea-payload="${payload}" type="button">Dismiss</button>
        </div>
      </div>
    </div>`;
  }
  function signalMeta(signal = "") {
    const key = String(signal).toLowerCase();
    if (key.includes("competitor")) return { label: "Competitor Gap", color: "teal" };
    if (key.includes("news")) return { label: "News Trend", color: "coral" };
    if (key.includes("audience")) return { label: "Audience Ask", color: "purple" };
    if (key.includes("analytics")) return { label: "Analytics", color: "blue" };
    if (key.includes("pivot")) return { label: "Topic Pivot", color: "amber" };
    return { label: "Refresh Signal", color: "navy" };
  }
  function bindIdeaActions() {
    $all("[data-add-idea]").forEach((btn) => btn.addEventListener("click", () => {
      const idea = data.ideas.find((item) => ideaKey(item) === btn.dataset.addIdea) || readIdeaPayload(btn);
      if (idea) animateAction(btn, "add", () => addIdeaToPipeline(idea));
    }));
    $all("[data-dismiss-idea]").forEach((btn) => btn.addEventListener("click", () => {
      const idea = data.ideas.find((item) => ideaKey(item) === btn.dataset.dismissIdea) || readIdeaPayload(btn);
      if (idea) animateAction(btn, "dismiss", () => dismissIdea(idea));
    }));
  }
  function addIdeaToPipeline(idea) {
    if (state.pipeline.some((card) => card.title.toLowerCase() === idea.title.toLowerCase())) {
      toast("That idea is already in the planner.");
      return;
    }
    const primaryUrl = idea.sourceUrl || idea.url || "";
    const sourceLinks = [
      primaryUrl ? { label: idea.source || "Original source", url: primaryUrl } : null,
      ...(Array.isArray(idea.sourceLinks) ? idea.sourceLinks : [])
    ].filter(Boolean);
    const notes = [
      idea.reason || "",
      idea.sourceAge ? `Source age/public timing: ${idea.sourceAge}` : ""
    ].filter(Boolean).join("\n\n");
    const newCard = withId({
      title: idea.title,
      category: idea.category,
      priority: idea.urgency,
      stage: "ideas",
      sponsor: "",
      assignedTo: "",
      target: "",
      checks: emptyChecks(),
      notes: "",
      researchBrief: notes,
      editorNotes: "",
      source: idea.source || "Intelligence",
      sourceUrl: primaryUrl,
      sourceLinks
    });
    state.pipeline.unshift(newCard);
    savePipeline();
    createNotification({
      card: newCard,
      type: "new-card",
      memberId: "owner-kirtish",
      message: `${newCard.title} was added to planner from ${newCard.source || "Intelligence"}.`
    });
    render();
    toast("Added to planner.", { label: "Open Planner", run: () => {
      state.plannerTab = "board";
      setView("planner");
    } });
  }

  function renderPlanner() {
    const cards = filteredPipeline();
    $("#planner").innerHTML = `
      <div class="channel-hero planner-hero">
        <p class="eyebrow">CoinLyte · Content Planner</p>
        <h3>Planner, <span>Calendar</span> & Team Hub</h3>
        <p>Pipeline board, real upload calendar, team links, research notes, and source-backed cards in one planning app.</p>
        <div class="hero-chips">
          <span class="hchip purple">${state.pipeline.length} in pipeline</span>
          <span class="hchip teal">${inProgressCount()} in progress</span>
          <span class="hchip gold">${state.pipeline.filter((c) => c.stage === "scheduled").length} scheduled</span>
        </div>
      </div>
      <div class="intel-strip planner-tabs">
        ${plannerTabs().map(([key, label]) => `<button class="${state.plannerTab === key ? "active" : ""}" data-planner-tab="${key}" type="button">${label}</button>`).join("")}
      </div>
      ${state.plannerTab === "calendar" ? plannerCalendarContent() : state.plannerTab === "team" ? plannerTeamContent() : plannerBoardContent(cards)}`;
    bindPlannerTabs();
    if (state.plannerTab === "calendar") bindCalendarButtons();
    if (state.plannerTab === "team") bindPlannerTeam();
    if (state.plannerTab === "board") bindPlannerBoardControls();
  }
  function plannerTabs() {
    return [["board", "Planner Board"], ["calendar", "Calendar"], ["team", "Team Hub"]];
  }
  function bindPlannerTabs() {
    $all("[data-planner-tab]").forEach((btn) => btn.addEventListener("click", () => {
      state.plannerTab = btn.dataset.plannerTab;
      renderPlanner();
    }));
  }
  function plannerBoardContent(cards) {
    return `
      <div class="panel">
        <div class="panel-head">
          <div><h3>Video Pipeline Board</h3><div class="panel-sub">Cards added from Intelligence carry original source links and research notes.</div></div>
          <div class="card-actions">
            <button class="ghost-btn sync-board-btn" data-sync-scope="planner" type="button">Sync Planner</button>
            <button class="ghost-btn" data-backup-board type="button">Backup Board</button>
            <button class="ghost-btn" data-import-board type="button">Import Backup</button>
            <input class="is-hidden" id="planner-backup-file" type="file" accept="application/json">
            <button class="primary-btn" data-new-card type="button">Add Video</button>
            <button class="danger-btn" data-clear-published type="button">Clear Published</button>
          </div>
        </div>
        <div class="grid cols-4">
          ${metric("In Pipeline", state.pipeline.length, "All saved cards")}
          ${metric("In Progress", inProgressCount(), "Research through scheduled")}
          ${metric("Scheduled", state.pipeline.filter((c) => c.stage === "scheduled").length, "Plotted on calendar")}
          ${metric("Published", state.pipeline.filter((c) => c.stage === "published").length, "Ready to clear when needed")}
        </div>
        <div class="toolbar">
          <input id="planner-query" value="${escapeHTML(state.plannerQuery)}" placeholder="Search title, category, sponsor">
          <select id="planner-stage">${stageOptions(state.plannerStage)}</select>
          <div class="segmented"><button data-mode="list" class="${state.plannerMode === "list" ? "active" : ""}" type="button">List</button><button data-mode="board" class="${state.plannerMode === "board" ? "active" : ""}" type="button">Board</button></div>
        </div>
      </div>
      ${state.plannerMode === "list" ? plannerList(cards) : plannerBoard(cards)}`;
  }
  function bindPlannerBoardControls() {
    $("#planner-query").addEventListener("input", (event) => {
      state.plannerQuery = event.target.value;
      renderPlanner();
    });
    $("#planner-stage").addEventListener("change", (event) => {
      state.plannerStage = event.target.value;
      renderPlanner();
    });
    $all("[data-mode]").forEach((btn) => btn.addEventListener("click", () => {
      state.plannerMode = btn.dataset.mode;
      renderPlanner();
    }));
    $("[data-new-card]").addEventListener("click", () => openCardModal());
    $("[data-sync-scope]")?.addEventListener("click", (event) => syncSharedBoard(event.currentTarget.dataset.syncScope));
    $("[data-clear-published]").addEventListener("click", clearPublished);
    $("[data-backup-board]")?.addEventListener("click", backupBoard);
    $("[data-import-board]")?.addEventListener("click", () => $("#planner-backup-file")?.click());
    $("#planner-backup-file")?.addEventListener("change", importBoardBackup);
    bindPlannerButtons();
  }
  function backupBoard() {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: "CoinLyte Command Centre",
      pipeline: state.pipeline,
      brands: state.brands,
      hubLinks: state.hubLinks,
      teamMembers: state.teamMembers,
      notifications: state.notifications,
      dismissedIdeas: state.dismissedIdeas,
      dismissedCommand: state.dismissedCommand
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `coinlyte-board-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("Board backup downloaded.");
  }
  function importBoardBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || "{}"));
        if (!Array.isArray(payload.pipeline)) throw new Error("Missing planner cards");
        confirmDialog({
          title: "Restore board backup?",
          body: "This replaces the current planner board, brand records, team links, and dismissed ideas with the backup file.",
          confirmText: "Restore",
          onConfirm: () => {
            state.pipeline = normalizePipeline(payload.pipeline);
            state.brands = Array.isArray(payload.brands) ? payload.brands.map(withId) : state.brands;
            state.hubLinks = Array.isArray(payload.hubLinks) ? payload.hubLinks.map(withId) : state.hubLinks;
            state.teamMembers = Array.isArray(payload.teamMembers) ? normalizeTeamMembers(payload.teamMembers) : state.teamMembers;
            state.notifications = Array.isArray(payload.notifications) ? payload.notifications : state.notifications;
            state.dismissedIdeas = Array.isArray(payload.dismissedIdeas) ? payload.dismissedIdeas : state.dismissedIdeas;
            state.dismissedCommand = Array.isArray(payload.dismissedCommand) ? payload.dismissedCommand : state.dismissedCommand;
            savePipeline();
            saveBrands();
            saveHub();
            saveTeam();
            saveNotifications();
            saveDismissedIdeas();
            saveDismissedCommand();
            renderPlanner();
            toast("Backup restored.");
          }
        });
      } catch {
        toast("That backup file could not be read.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }
  function plannerCalendarContent() {
    const monthDate = new Date(2026, 4, 1);
    const active = state.pipeline.filter((card) => card.stage !== "published");
    const scheduled = active.filter((card) => parseTargetDate(card.target));
    return `<div class="panel">
      <div class="panel-head"><div><h3>Actual Upload Calendar</h3><div class="panel-sub">Planner cards appear on their target date. Edit a card to change where it lands.</div></div><button class="primary-btn" data-new-card type="button">Add Video</button></div>
      <div class="grid cols-4">
        ${metric("Best Window", data.bestHours.rows[0]?.time || "09:30 IST", data.bestHours.source)}
        ${metric("This Week", active.length, "Unpublished planner cards")}
        ${metric("Scheduled", scheduled.length, "Cards with target dates")}
        ${metric("Ready Soon", active.filter((card) => ["editing", "scheduled"].includes(card.stage)).length, "Close to upload")}
      </div>
    </div>
    <div class="panel calendar-panel">
      <div class="panel-head"><div><h3>May 2026</h3><div class="panel-sub">Calendar view is now part of Content Planner.</div></div><span class="tag blue">${scheduled.length} planned</span></div>
      ${monthCalendar(monthDate, active)}
    </div>`;
  }
  function bindCalendarButtons() {
    $("[data-new-card]")?.addEventListener("click", () => openCardModal());
    bindPlannerButtons();
  }
  function monthCalendar(monthDate, cards) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i += 1) cells.push({ day: "", cards: [] });
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayCards = cards.filter((card) => {
        const date = parseTargetDate(card.target);
        return date && date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
      });
      cells.push({ day, cards: dayCards });
    }
    while (cells.length % 7) cells.push({ day: "", cards: [] });
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `<div class="month-calendar"><div class="month-head">${weekDays.map((day) => `<div>${day}</div>`).join("")}</div><div class="month-grid">${cells.map((cell) => `<div class="month-day ${cell.day === 15 ? "today" : ""}"><strong>${cell.day || ""}</strong>${cell.cards.map((card) => `<button class="calendar-event" data-edit="${card.id}" type="button">${escapeHTML(card.title)}</button>`).join("")}</div>`).join("")}</div></div>`;
  }
  function parseTargetDate(value) {
    if (!value) return null;
    const text = String(value).trim();
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00`) : null;
    if (iso && !Number.isNaN(iso.getTime())) return iso;
    const withYear = new Date(`${text} 2026`);
    return Number.isNaN(withYear.getTime()) ? null : withYear;
  }
  function dateInputValue(value) {
    const date = parseTargetDate(value);
    if (!date) return "";
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }
  function plannerTeamContent() {
    const categories = ["all", ...new Set(state.hubLinks.map((link) => link.category))];
    const links = state.hubLinks.filter((link) => {
      const q = state.hubQuery.toLowerCase();
      return (state.hubCategory === "all" || link.category === state.hubCategory) &&
        (!q || `${link.title} ${link.url} ${link.category} ${link.desc}`.toLowerCase().includes(q));
    });
    return `<div class="panel team-hub-hero">
      <div class="panel-head"><div><h3>✨ Production Resource Hub</h3><div class="panel-sub">Editor, research, brand, analytics, and publishing links for the people working on videos.</div></div><button class="primary-btn" data-add-link type="button">Add Link</button></div>
      <div class="toolbar">
        <input id="hub-query" value="${escapeHTML(state.hubQuery)}" placeholder="Search resources">
        <select id="hub-category">${categories.map((cat) => `<option value="${escapeHTML(cat)}" ${state.hubCategory === cat ? "selected" : ""}>${escapeHTML(cat === "all" ? "All categories" : cat)}</option>`).join("")}</select>
      </div>
    </div>
    <div class="hub-grid premium-hub-grid">${links.map(hubLinkCard).join("") || `<div class="empty">No links match this filter.</div>`}</div>`;
  }
  function hubLinkCard(link) {
    const icon = link.icon || categoryEmoji(link.category, link.category) || "🔗";
    return `<article class="list-card hub-card-premium hub-${toneForText(link.category)}">
      <div class="hub-card-top">
        <span class="hub-icon">${escapeHTML(icon)}</span>
        <span class="hub-category-pill">${escapeHTML(link.category || "Resource")}</span>
      </div>
      <h4><a href="${escapeHTML(link.url)}" target="_blank" rel="noreferrer">${escapeHTML(link.title)}</a></h4>
      <p>${escapeHTML(link.desc || "Team reference link")}</p>
      <div class="panel-sub clipped-url">${escapeHTML(link.url)}</div>
      <div class="card-actions">
        <a class="primary-btn compact-btn" href="${escapeHTML(link.url)}" target="_blank" rel="noreferrer">Open →</a>
        <button class="ghost-btn compact-btn" data-edit-link="${link.id}" type="button">✏️ Edit</button>
        <button class="danger-btn compact-btn" data-remove-link="${link.id}" type="button">Remove</button>
      </div>
    </article>`;
  }
  function teamMemberCard(member) {
    return `<article class="list-card team-member-card">
      <div class="card-actions"><span class="tag teal">👤 ${escapeHTML(member.role || "Team")}</span><span class="tag ${member.accessStatus === "Paused" ? "red" : "green"}">${escapeHTML(member.accessStatus || "Active")}</span><span class="tag blue">${member.notifyStages ? "🔔 Stage alerts" : "🔕 Quiet"}</span></div>
      <h4>${escapeHTML(member.name)}</h4>
      <p>${escapeHTML(member.userId || "No user ID")} · ${escapeHTML(normalizeChannels(member).join(", "))}${member.email ? ` · ${escapeHTML(member.email)}` : ""}</p>
      <div class="access-chip-row">${(member.access || []).map((item) => `<span>${escapeHTML(item)}</span>`).join("")}</div>
      <div class="card-actions"><button class="ghost-btn compact-btn" data-edit-member="${member.id}" type="button">Edit Access</button><button class="danger-btn compact-btn" data-delete-member="${member.id}" type="button" ${member.role === "Owner" ? "disabled" : ""}>×</button></div>
    </article>`;
  }
  function notificationItem(note) {
    const emailText = note.emailStatus ? ` · Email ${note.emailStatus}` : "";
    const channels = Array.isArray(note.channels) ? note.channels.join(", ") : note.channel || "In-app";
    return `<article class="notification-item ${note.read ? "read" : ""}">
      <div><strong>${escapeHTML(note.memberName)}</strong><p>${escapeHTML(note.message)}</p><span>${escapeHTML(channels)}${escapeHTML(emailText)} · ${escapeHTML(new Date(note.createdAt).toLocaleString("en-GB"))}</span></div>
      <div class="notification-actions">
        <button class="ghost-btn compact-btn" data-open-notification="${note.cardId}" type="button" ${note.cardId ? "" : "disabled"}>Open Card</button>
        <button class="ghost-btn compact-btn" data-read-notification="${note.id}" type="button">${note.read ? "Unread" : "Mark Read"}</button>
        <button class="danger-btn compact-btn" data-dismiss-notification="${note.id}" type="button">Dismiss</button>
      </div>
    </article>`;
  }
  function bindPlannerTeam() {
    $("#hub-query")?.addEventListener("input", (event) => {
      state.hubQuery = event.target.value;
      renderPlanner();
    });
    $("#hub-category")?.addEventListener("change", (event) => {
      state.hubCategory = event.target.value;
      renderPlanner();
    });
    $("[data-add-link]")?.addEventListener("click", openHubModal);
    $all("[data-edit-link]").forEach((btn) => btn.addEventListener("click", () => openHubModal(state.hubLinks.find((link) => link.id === btn.dataset.editLink))));
    $all("[data-remove-link]").forEach((btn) => btn.addEventListener("click", () => removeLink(btn.dataset.removeLink)));
  }
  function bindTeamAccess() {
    $("[data-add-member]")?.addEventListener("click", () => openTeamMemberModal());
    $all("[data-sync-scope]").forEach((btn) => btn.addEventListener("click", () => syncSharedBoard(btn.dataset.syncScope)));
    $all("[data-edit-member]").forEach((btn) => btn.addEventListener("click", () => openTeamMemberModal(state.teamMembers.find((member) => member.id === btn.dataset.editMember))));
    $all("[data-delete-member]").forEach((btn) => btn.addEventListener("click", () => deleteTeamMember(btn.dataset.deleteMember)));
    $("[data-clear-notifications]")?.addEventListener("click", () => {
      state.notifications = state.notifications.map((note) => ({ ...note, read: true }));
      saveNotifications();
      renderTeam();
    });
    $all("[data-read-notification]").forEach((btn) => btn.addEventListener("click", () => {
      state.notifications = state.notifications.map((note) => note.id === btn.dataset.readNotification ? { ...note, read: !note.read } : note);
      saveNotifications();
      renderTeam();
    }));
    $all("[data-dismiss-notification]").forEach((btn) => btn.addEventListener("click", () => {
      state.notifications = state.notifications.filter((note) => note.id !== btn.dataset.dismissNotification);
      saveNotifications();
      renderTeam();
      toast("Notification dismissed.");
    }));
    $all("[data-open-notification]").forEach((btn) => btn.addEventListener("click", () => {
      const note = state.notifications.find((item) => item.cardId === btn.dataset.openNotification);
      if (note) {
        note.read = true;
        saveNotifications();
      }
      setView("planner");
      state.plannerTab = "board";
      renderPlanner();
      const card = state.pipeline.find((item) => item.id === btn.dataset.openNotification);
      if (card) openCardModal(card);
    }));
  }
  function openTeamMemberModal(member) {
    const editing = Boolean(member);
    const current = member || { id: "", name: "", role: "Editor", userId: "", email: "", accessStatus: "Active", channels: ["In-app"], access: ["Content Planner"], notifyStages: true };
    const selectedChannels = normalizeChannels(current);
    $("#modal-root").classList.remove("is-hidden");
    $("#modal-root").innerHTML = `
      <form class="modal team-member-modal" id="member-form">
        <div class="modal-head"><div><h3>${editing ? "Edit Team Member" : "Create Team User"}</h3><div class="panel-sub">Choose assignments, board visibility, and notification preferences.</div></div><button class="ghost-btn" data-close type="button">Close</button></div>
        <div class="form-grid">
          <label>Name<input name="name" required value="${escapeHTML(current.name || "")}" placeholder="Editor name"></label>
          <label>User ID<input name="userId" required value="${escapeHTML(current.userId || "")}" placeholder="editor01"></label>
          <label>Email<input name="email" type="email" value="${escapeHTML(current.email || "")}" placeholder="name@example.com"></label>
          <label>Role<select name="role">${["Owner", "Manager", "Editor", "Researcher", "Sponsor Ops", "Viewer"].map((role) => `<option ${current.role === role ? "selected" : ""}>${role}</option>`).join("")}</select></label>
          <label>Access status<select name="accessStatus">${["Active", "Paused"].map((status) => `<option ${current.accessStatus === status ? "selected" : ""}>${status}</option>`).join("")}</select></label>
        </div>
        <div class="modal-section">
          <div class="section-title">🔔 Notification Channels</div>
          <div class="access-check-grid notification-check-grid">${NOTIFICATION_CHANNELS.map((channel) => `<label><input name="channels" type="checkbox" value="${escapeHTML(channel)}" ${selectedChannels.includes(channel) ? "checked" : ""}> ${channelIcon(channel)} ${escapeHTML(channel)}</label>`).join("")}</div>
          <div class="panel-sub">Email sends from Vercel when RESEND_API_KEY is configured. Other external channels are saved as team preference for the next integration.</div>
        </div>
        <div class="modal-section">
          <div class="section-title">🔐 Board Access</div>
          <div class="access-check-grid">${APP_ACCESS.map((item) => `<label><input name="access" type="checkbox" value="${escapeHTML(item)}" ${(current.access || []).includes(item) ? "checked" : ""}> ${escapeHTML(item)}</label>`).join("")}</div>
          <div class="access-note">With Supabase configured, these permissions control the tabs this user can open after login. Without Supabase, they remain assignment preferences only.</div>
        </div>
        <div class="modal-section">
          <div class="section-title">🔑 Login Access Code</div>
          <label>Set or reset team login code<input name="accessCode" type="password" autocomplete="new-password" placeholder="${editing ? "Leave blank to keep current code" : "Required for this user to log in separately"}"></label>
          <div class="access-note">The code is sent to the Vercel API and stored in Supabase as a hash. It is never saved in browser local storage and cannot be viewed later.</div>
        </div>
        <div class="modal-section">
          <label class="sponsor-toggle"><input name="notifyStages" type="checkbox" ${current.notifyStages !== false ? "checked" : ""}> Notify this member when assigned card changes stage</label>
        </div>
        <div class="modal-actions"><button class="ghost-btn" data-close type="button">Cancel</button><button class="primary-btn" type="submit">Save User</button></div>
      </form>`;
    $all("[data-close]", $("#modal-root")).forEach((btn) => btn.addEventListener("click", closeModal));
    $("#member-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const accessCode = String(form.get("accessCode") || "").trim();
      const next = withId({
        id: current.id,
        name: form.get("name").trim(),
        userId: form.get("userId").trim(),
        email: form.get("email").trim(),
        role: form.get("role"),
        accessStatus: form.get("accessStatus") || "Active",
        channels: form.getAll("channels"),
        access: form.getAll("access"),
        notifyStages: Boolean(form.get("notifyStages"))
      });
      if (!next.channels.length) next.channels = ["In-app"];
      if (!next.access.length) next.access = ["Content Planner"];
      if (editing) state.teamMembers = state.teamMembers.map((item) => item.id === current.id ? next : item);
      else state.teamMembers.unshift(next);
      saveTeam();
      if (accessCode) syncTeamMemberAccess(next, accessCode);
      closeModal();
      state.view === "team" ? renderTeam() : renderPlanner();
      toast(editing ? "Team access updated." : "Team user created.");
    });
  }
  async function syncTeamMemberAccess(member, accessCode) {
    if (!state.cloud.ready) {
      toast("Team code saved locally? No. Configure Supabase first, then reset this user code.");
      return;
    }
    try {
      const res = await fetch("/api/team-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member, accessCode })
      });
      if (!res.ok) throw new Error("Team login save failed");
      toast(`${member.name} can now log in with their own code.`);
    } catch {
      toast("Team access code was not saved. Check Supabase setup and try again.");
    }
  }
  function deleteTeamMember(id) {
    const member = state.teamMembers.find((item) => item.id === id);
    if (!member || member.role === "Owner") return;
    confirmDialog({
      title: "Remove team member?",
      body: `This removes ${member.name} from assignment and access lists.`,
      confirmText: "Remove",
      danger: true,
      onConfirm: () => {
        state.teamMembers = state.teamMembers.filter((item) => item.id !== id);
        state.pipeline = state.pipeline.map((card) => card.assignedTo === id ? { ...card, assignedTo: "" } : card);
        saveTeam();
        savePipeline();
        state.view === "team" ? renderTeam() : renderPlanner();
        toast("Team member removed.");
      }
    });
  }
  function stageOptions(selected) {
    return `<option value="all">All stages</option>${STAGES.map(([key, label]) => `<option value="${key}" ${selected === key ? "selected" : ""}>${label}</option>`).join("")}`;
  }
  function filteredPipeline() {
    const q = state.plannerQuery.toLowerCase().trim();
    return state.pipeline.filter((card) => {
      const inStage = state.plannerStage === "all" || card.stage === state.plannerStage;
      const text = `${card.title} ${card.category} ${card.sponsor} ${card.priority}`.toLowerCase();
      return inStage && (!q || text.includes(q));
    });
  }
  function plannerList(cards) {
    if (!cards.length) return `<div class="empty">No planner cards match this filter.</div>`;
    return `<div class="grid">${cards.map(cardHTML).join("")}</div>`;
  }
  function plannerBoard(cards) {
    return `<div class="board">${STAGES.map(([key, label]) => {
      const stageCards = cards.filter((card) => card.stage === key);
      return `<div class="board-col stage-${key}"><h4>${stageEmoji(key)} ${label}<span>${stageCards.length}</span></h4>${stageCards.map(cardHTML).join("") || `<div class="empty">No cards</div>`}</div>`;
    }).join("")}</div>`;
  }
  function cardHTML(card) {
    const stageIndex = STAGES.findIndex(([key]) => key === card.stage);
    const priority = normalizePriority(card.priority);
    const tone = categoryTone(card.category, card.priority);
    const emoji = categoryEmoji(card.category, card.source);
    const brief = card.researchBrief || card.editorNotes || card.notes || "";
    return `<article class="list-card pipeline-card pipeline-${tone} priority-${priority}" data-card="${card.id}">
      <div class="card-actions"><span class="tag ${priority === "urgent" ? "red" : priority === "high" ? "gold" : "blue"}">${priority === "urgent" ? "🔴" : priority === "high" ? "🟡" : "⚪"} ${escapeHTML(card.priority || "Medium")}</span><span class="tag teal">${stageEmoji(card.stage)} ${escapeHTML(stageLabel(card.stage))}</span></div>
      <h4>${escapeHTML(withLeadingEmoji(card.title, emoji))}</h4>
      <div class="panel-sub">${escapeHTML(card.category)} | Target ${escapeHTML(card.target || "not set")}</div>
      ${card.assignedTo ? `<div class="panel-sub">Assigned: ${escapeHTML(teamMemberName(card.assignedTo))}</div>` : ""}
      <div class="panel-sub">Source: ${escapeHTML(card.source || "Manual")}${card.sourceUrl ? ` · <button class="source-action-link" data-open-url="${escapeHTML(card.sourceUrl)}" onclick="window.open(this.dataset.openUrl, '_blank', 'noopener,noreferrer');return false;" type="button">open ↗</button>` : ""}</div>
      ${card.sponsor ? `<div class="card-actions"><span class="tag gold">💰 Sponsor: ${escapeHTML(card.sponsor)}</span></div>` : ""}
      ${brief ? `<p>${escapeHTML(brief).slice(0, 120)}${String(brief).length > 120 ? "..." : ""}</p>` : ""}
      <div class="card-actions">
        <button class="ghost-btn edit-btn" data-edit="${card.id}" type="button">✏️ Edit</button>
        <button class="ghost-btn compact-btn" data-back="${card.id}" type="button" ${stageIndex <= 0 ? "disabled" : ""}>← Back</button>
        <button class="primary-btn compact-btn" data-next="${card.id}" type="button" ${stageIndex >= STAGES.length - 1 ? "disabled" : ""}>Fwd →</button>
        <button class="danger-btn compact-btn" data-delete="${card.id}" type="button">×</button>
      </div>
    </article>`;
  }
  function stageEmoji(stage = "") {
    return {
      ideas: "💡",
      scripting: "🔎",
      recording: "🎬",
      editing: "✂️",
      scheduled: "📅",
      published: "✅"
    }[stage] || "📌";
  }
  function stageLabel(stage) {
    return STAGES.find(([key]) => key === stage)?.[1] || stage;
  }
  function bindPlannerButtons() {
    wireSourceNavigation(document);
    $all("[data-edit]").forEach((btn) => btn.addEventListener("click", () => openCardModal(state.pipeline.find((card) => card.id === btn.dataset.edit))));
    $all("[data-next]").forEach((btn) => btn.addEventListener("click", () => moveCard(btn.dataset.next, 1)));
    $all("[data-back]").forEach((btn) => btn.addEventListener("click", () => moveCard(btn.dataset.back, -1)));
    $all("[data-delete]").forEach((btn) => btn.addEventListener("click", () => deleteCard(btn.dataset.delete)));
  }
  function wireSourceNavigation(root = document) {
    $all("[data-open-url]", root).forEach((link) => {
      link.addEventListener("click", (event) => {
        const href = link.dataset.openUrl;
        if (!href) return;
        event.preventDefault();
        window.open(href, "_blank", "noopener,noreferrer");
      });
    });
  }
  function moveCard(id, delta) {
    const card = state.pipeline.find((item) => item.id === id);
    const index = STAGES.findIndex(([key]) => key === card.stage);
    const previousStage = card.stage;
    card.stage = STAGES[Math.max(0, Math.min(STAGES.length - 1, index + delta))][0];
    savePipeline();
    const assignee = state.teamMembers.find((member) => member.id === card.assignedTo);
    if (card.assignedTo && assignee?.notifyStages !== false && previousStage !== card.stage) {
      createNotification({
        card,
        type: "stage",
        message: `${card.title} moved to ${stageLabel(card.stage)}.`
      });
    }
    renderPlanner();
  }
  function deleteCard(id) {
    const card = state.pipeline.find((item) => item.id === id);
    confirmDialog({
      title: "Delete planner card?",
      body: `This removes "${card.title}" from the local planner.`,
      confirmText: "Delete",
      danger: true,
      onConfirm: () => {
        state.pipeline = state.pipeline.filter((item) => item.id !== id);
        savePipeline();
        renderPlanner();
        toast("Card deleted.", { label: "Undo", run: () => { state.pipeline.unshift(card); savePipeline(); renderPlanner(); } });
      }
    });
  }
  function clearPublished() {
    const published = state.pipeline.filter((card) => card.stage === "published");
    if (!published.length) {
      toast("No published cards to clear.");
      return;
    }
    confirmDialog({
      title: "Clear published cards?",
      body: `This removes ${published.length} published card(s) from the local planner.`,
      confirmText: "Clear",
      danger: true,
      onConfirm: () => {
        state.pipeline = state.pipeline.filter((card) => card.stage !== "published");
        savePipeline();
        renderPlanner();
        toast("Published cards cleared.", { label: "Undo", run: () => { state.pipeline.push(...published); savePipeline(); renderPlanner(); } });
      }
    });
  }
  function openCardModal(card) {
    const editing = Boolean(card);
    const current = card || { id: "", title: "", category: "Education", priority: "Medium", stage: "ideas", sponsor: "", sponsorBrandId: "", assignedTo: "", target: "", checks: emptyChecks(), researchBrief: "", editorNotes: "", notes: "", source: "Manual", sourceUrl: "", sourceLinks: [] };
    const links = Array.isArray(current.sourceLinks) ? current.sourceLinks : [];
    const sourceBacked = Boolean(current.sourceUrl || (current.source && current.source !== "Manual"));
    const brief = current.researchBrief || (sourceBacked ? current.notes || "" : "");
    const editorNotes = current.editorNotes || (!sourceBacked ? current.notes || "" : "");
    const referenceLinks = links.filter((link) => (link.url || link) !== current.sourceUrl);
    const categoryOptions = uniqueOptions(VIDEO_CATEGORIES, state.pipeline.map((item) => item.category));
    const sponsorOptions = state.brands.map((brand) => `<option value="${escapeHTML(brand.id)}" ${current.sponsorBrandId === brand.id ? "selected" : ""}>${escapeHTML(brand.name)}</option>`).join("");
    const tone = categoryTone(current.category, current.priority);
    $("#modal-root").classList.remove("is-hidden");
    $("#modal-root").innerHTML = `
      <form class="modal planner-modal" id="card-form">
        <div class="planner-modal-hero idea-${tone}">
          <div class="modal-head"><div><p class="eyebrow">Edit · Planner Card</p><h3>${editing ? "Edit Planner Card" : "Add Planner Card"}</h3></div><button class="ghost-btn close-pill" data-close type="button">Close</button></div>
          <label class="title-editor"><span>Title</span><input name="title" required value="${escapeHTML(current.title)}" placeholder="Video title"></label>
          <div class="modal-chip-row">
            <span>${categoryEmoji(current.category, current.source)} ${escapeHTML(current.source || "Manual")}</span>
            <span>${stageEmoji(current.stage)} ${escapeHTML(stageLabel(current.stage))}</span>
            <span>${current.priority === "Urgent" ? "🔴" : current.priority === "High" ? "🟡" : "⚪"} ${escapeHTML(current.priority || "Medium")}</span>
            ${current.sourceUrl ? `<button class="modal-source-chip" data-open-url="${escapeHTML(current.sourceUrl)}" onclick="window.open(this.dataset.openUrl, '_blank', 'noopener,noreferrer');return false;" type="button">Open Source ↗</button>` : ""}
          </div>
        </div>
        <div class="planner-modal-body">
          <div class="form-grid compact-form">
            <label>Stage<select name="stage">${STAGES.map(([key, label]) => `<option value="${key}" ${current.stage === key ? "selected" : ""}>${label}</option>`).join("")}</select></label>
            ${categoryField("category", categoryOptions, current.category)}
            <label>Priority<select name="priority">${["Urgent", "High", "Medium"].map((p) => `<option ${current.priority === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>
            <label>Target date<input name="target" type="date" value="${escapeHTML(dateInputValue(current.target))}"></label>
            <label>Assign to<select name="assignedTo"><option value="">Unassigned</option>${teamMemberOptions(current.assignedTo)}</select></label>
          </div>
          <div class="modal-section">
            <div class="section-title">📝 Working Notes</div>
            <textarea name="editorNotes" rows="5" placeholder="Your notes for recording/editor: hook, structure, b-roll, warnings, Hindi angle...">${escapeHTML(editorNotes)}</textarea>
          </div>
          <div class="modal-section source-section">
            <div class="section-title">📌 Research Brief</div>
            <div class="readonly-brief">
              <strong>${escapeHTML(current.source || "Manual")}</strong>
              <p>${escapeHTML(brief || "No locked research brief yet. Add your working notes above if this is a manual planner card.")}</p>
              ${current.sourceUrl ? `<button class="brief-source-link" data-open-url="${escapeHTML(current.sourceUrl)}" onclick="window.open(this.dataset.openUrl, '_blank', 'noopener,noreferrer');return false;" type="button">Source ↗</button>` : ""}
            </div>
          </div>
          <div class="modal-section">
            <div class="section-title">➕ Editor Reference Sources <button class="mini-add-btn" data-add-reference type="button">+ Add Source</button></div>
            <div class="reference-list" data-reference-list>${renderReferenceRows(referenceLinks)}</div>
          </div>
          <div class="modal-section sponsor-section">
            <label class="sponsor-toggle"><input name="sponsorEnabled" type="checkbox" ${current.sponsor ? "checked" : ""}> This video has a sponsor deal</label>
            <div class="form-grid compact-form sponsor-fields">
              <label>Linked brand deal<select name="sponsorBrandId"><option value="">Select brand deal</option>${sponsorOptions}</select></label>
              <label>Sponsor label<input name="sponsor" value="${escapeHTML(current.sponsor || "")}" placeholder="Brand name or campaign"></label>
            </div>
          </div>
        </div>
        <div class="modal-actions planner-modal-actions"><button class="ghost-btn" data-close type="button">Cancel</button><button class="primary-btn" type="submit">💾 Save Video</button></div>
      </form>`;
    $all("[data-close]", $("#modal-root")).forEach((btn) => btn.addEventListener("click", closeModal));
    wireSourceNavigation($("#modal-root"));
    bindCustomSelects($("#modal-root"));
    bindReferenceRows($("#modal-root"));
    $("#card-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const sponsorEnabled = Boolean(form.get("sponsorEnabled"));
      const selectedBrand = state.brands.find((brand) => brand.id === form.get("sponsorBrandId"));
      const sponsorName = sponsorEnabled ? (form.get("sponsor").trim() || selectedBrand?.name || "") : "";
      const sourceLinks = [
        current.sourceUrl ? { label: current.source || "Original source", url: current.sourceUrl } : null,
        ...parseReferenceRows($("#modal-root"))
      ].filter(Boolean);
      const next = {
        id: current.id || `card-${Date.now()}`,
        title: form.get("title").trim(),
        category: customSelectValue(form, "category", "Education"),
        priority: form.get("priority"),
        stage: form.get("stage"),
        sponsor: sponsorName,
        sponsorBrandId: sponsorEnabled ? (form.get("sponsorBrandId") || "") : "",
        assignedTo: form.get("assignedTo") || "",
        target: form.get("target").trim(),
        source: current.source || "Manual",
        sourceUrl: current.sourceUrl || "",
        sourceLinks,
        notes: "",
        researchBrief: brief,
        editorNotes: form.get("editorNotes").trim(),
        checks: current.checks || emptyChecks()
      };
      if (editing) state.pipeline = state.pipeline.map((item) => item.id === current.id ? next : item);
      else state.pipeline.unshift(next);
      savePipeline();
      if (next.assignedTo && (!editing || next.assignedTo !== current.assignedTo)) {
        createNotification({
          card: next,
          type: editing ? "assignment" : "new-card",
          message: editing ? `${next.title} assigned to you.` : `${next.title} added to planner and assigned to you.`
        });
      }
      closeModal();
      renderPlanner();
      toast(editing ? "Video updated." : "Video added.");
    });
  }
  function renderReferenceRows(links = []) {
    const rows = links.length ? links : [{ label: "", url: "" }];
    return rows.map((link) => {
      const label = typeof link === "string" ? "" : link?.label || "";
      const url = typeof link === "string" ? link : link?.url || "";
      return `<div class="reference-row">
      <input name="referenceTitle" value="${escapeHTML(label)}" placeholder="Reference title">
      <input name="referenceUrl" value="${escapeHTML(url)}" type="url" placeholder="https://youtube.com/... or article URL">
      <button class="reference-save-btn" data-save-reference type="button">Save ✓</button>
      <button class="danger-btn compact-btn" data-remove-reference type="button">×</button>
    </div>`;
    }).join("");
  }
  function bindReferenceRows(root) {
    const list = $("[data-reference-list]", root);
    $("[data-add-reference]", root)?.addEventListener("click", () => {
      list.insertAdjacentHTML("beforeend", renderReferenceRows([{ label: "", url: "" }]));
      bindReferenceRemoveButtons(root);
    });
    bindReferenceRemoveButtons(root);
  }
  function bindReferenceRemoveButtons(root) {
    $all("[data-remove-reference]", root).forEach((btn) => {
      btn.onclick = () => {
        const row = btn.closest(".reference-row");
        if ($all(".reference-row", root).length > 1) row.remove();
        else row.querySelectorAll("input").forEach((input) => { input.value = ""; });
      };
    });
    $all("[data-save-reference]", root).forEach((btn) => {
      btn.onclick = () => {
        btn.closest(".reference-row")?.classList.add("reference-saved");
        btn.textContent = "Saved ✓";
      };
    });
  }
  function parseReferenceRows(root) {
    return $all(".reference-row", root).map((row) => {
      const label = row.querySelector('[name="referenceTitle"]')?.value.trim() || "Additional source";
      const url = row.querySelector('[name="referenceUrl"]')?.value.trim() || "";
      return url ? { label, url } : null;
    }).filter(Boolean);
  }

  function renderTeam() {
    const unread = state.notifications.filter((note) => !note.read).length;
    const emailReady = state.teamMembers.filter((member) => normalizeChannels(member).includes("Email") && member.email).length;
    $("#team").innerHTML = `
      <section class="page-hero team-page-hero">
        <div><p class="eyebrow">Access · Notifications · Accountability</p><h3>Team Access Control</h3><p>Save assignment profiles, board permissions, notification preferences, and separate team login codes once Supabase is connected.</p></div>
        <div class="hero-stat-row">
          ${metric("Team Users", state.teamMembers.length, "Saved users")}
          ${metric("Unread", unread, "Board notifications")}
          ${metric("Email Ready", emailReady, "Members with email channel")}
        </div>
      </section>
      <div class="panel team-access-panel">
        <div class="panel-head">
          <div><h3>🔐 App Access</h3><div class="panel-sub">Create user IDs, choose allowed app areas, and set/reset login codes from the edit modal.</div></div>
          <div class="card-actions">
            <button class="ghost-btn sync-board-btn" data-sync-scope="team" type="button">Sync Team</button>
            <button class="primary-btn" data-add-member type="button">Add Team Member</button>
          </div>
        </div>
        <div class="team-member-grid">${state.teamMembers.map(teamMemberCard).join("")}</div>
      </div>
      <div class="panel team-notification-panel">
        <div class="panel-head">
          <div><h3>🔔 Notification Board</h3><div class="panel-sub">${unread} unread · In-app alerts are live. Email delivery uses the Vercel notification endpoint when configured.</div></div>
          <button class="ghost-btn" data-clear-notifications type="button">Mark All Read</button>
        </div>
        <div class="notification-list">${state.notifications.slice(0, 12).map(notificationItem).join("") || `<div class="empty">No planner notifications yet.</div>`}</div>
      </div>`;
    bindTeamAccess();
  }
  function openHubModal(link) {
    const editing = Boolean(link);
    const current = link || { id: "", title: "", url: "", category: "Publishing", icon: "🔗", desc: "" };
    const categoryOptions = uniqueOptions(HUB_CATEGORIES, state.hubLinks.map((link) => link.category));
    $("#modal-root").classList.remove("is-hidden");
    $("#modal-root").innerHTML = `
      <form class="modal" id="hub-form">
        <div class="modal-head"><div><p class="eyebrow">Team Hub · Resource</p><h3>${editing ? "Edit Team Link" : "Add Team Link"}</h3></div><button class="ghost-btn" data-close type="button">Close</button></div>
        <div class="form-grid">
          <label>Title<input name="title" required value="${escapeHTML(current.title)}" placeholder="YouTube Studio"></label>
          <label>URL<input name="url" required type="url" value="${escapeHTML(current.url)}" placeholder="https://"></label>
          ${categoryField("category", categoryOptions, current.category || "Publishing")}
          <label>Emoji icon<input name="icon" maxlength="4" value="${escapeHTML(current.icon || "")}" placeholder="🎬"></label>
          <label class="span-2">Description<input name="desc" value="${escapeHTML(current.desc || "")}" placeholder="What this link is used for"></label>
        </div>
        <div class="modal-actions"><button class="ghost-btn" data-close type="button">Cancel</button><button class="primary-btn" type="submit">${editing ? "Save Link" : "Add Link"}</button></div>
      </form>`;
    $all("[data-close]", $("#modal-root")).forEach((btn) => btn.addEventListener("click", closeModal));
    bindCustomSelects($("#modal-root"));
    $("#hub-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const next = withId({
        id: current.id,
        title: form.get("title").trim(),
        url: form.get("url").trim(),
        category: customSelectValue(form, "category", "Publishing"),
        icon: form.get("icon").trim() || "🔗",
        desc: form.get("desc").trim()
      });
      if (editing) state.hubLinks = state.hubLinks.map((item) => item.id === current.id ? next : item);
      else state.hubLinks.unshift(next);
      saveHub();
      closeModal();
      state.view === "planner" ? renderPlanner() : renderTeam();
      toast(editing ? "Team link updated." : "Team link added.");
    });
  }
  function removeLink(id) {
    const link = state.hubLinks.find((item) => item.id === id);
    confirmDialog({
      title: "Remove team link?",
      body: `This removes "${link.title}" from this local team hub.`,
      confirmText: "Remove",
      danger: true,
      onConfirm: () => {
        state.hubLinks = state.hubLinks.filter((item) => item.id !== id);
        saveHub();
        state.view === "planner" ? renderPlanner() : renderTeam();
        toast("Link removed.", { label: "Undo", run: () => { state.hubLinks.unshift(link); saveHub(); state.view === "planner" ? renderPlanner() : renderTeam(); } });
      }
    });
  }

  function renderBrand() {
    const filtered = state.brands.filter((brand) => state.brandStage === "all" || brand.status === state.brandStage);
    const confirmed = state.brands.filter((brand) => ["Confirmed", "Product Received", "Content Live", "Paid"].includes(brand.status));
    $("#brand").innerHTML = `
      <div class="channel-hero brand-hero">
        <p class="eyebrow">CoinLyte · Brand Deals</p>
        <h3>Brand Records <span>& Deal Board</span></h3>
        <p>Simple brand directory first, sponsorship progress board second.</p>
        <div class="hero-chips">
          <span class="hchip teal">${state.brands.length} brand records</span>
          <span class="hchip gold">${state.brands.filter((b) => !["Paid", "Declined"].includes(b.status)).length} active</span>
          <span class="hchip purple">${formatCurrency(confirmed.reduce((sum, b) => sum + Number(b.value || 0), 0))} confirmed</span>
        </div>
      </div>
      <div class="intel-strip brand-tabs">
        ${[["directory", "Brand Directory"], ["board", "Deal Board"]].map(([key, label]) => `<button class="${state.brandTab === key ? "active" : ""}" data-brand-tab="${key}" type="button">${label}</button>`).join("")}
      </div>
      ${state.brandTab === "directory" ? brandDirectoryContent() : brandBoardContent(filtered, confirmed)}`;
    $all("[data-brand-tab]").forEach((btn) => btn.addEventListener("click", () => {
      state.brandTab = btn.dataset.brandTab;
      renderBrand();
    }));
    bindBrandButtons();
  }
  function brandDirectoryContent() {
    return `
      <div class="panel brand-panel">
        <div class="panel-head">
          <div><h3>Brand Directory</h3><div class="panel-sub">Record website, communication channel, owner, and notes before it becomes a deal.</div></div>
          <div class="card-actions">
            <button class="ghost-btn sync-board-btn" data-sync-scope="brand" type="button">Sync Brands</button>
            <button class="ghost-btn" data-backup-brands type="button">Backup Brands</button>
            <button class="ghost-btn" data-import-brands type="button">Import Backup</button>
            <input class="is-hidden" id="brand-backup-file" type="file" accept="application/json">
            <button class="primary-btn" data-add-brand type="button">Add Brand Record</button>
          </div>
        </div>
        <div class="grid cols-4">
          ${metric("Total Brands", state.brands.length, "All saved records")}
          ${metric("Active", state.brands.filter((b) => !["Paid", "Declined"].includes(b.status)).length, "May become deals")}
          ${metric("With Website", state.brands.filter((b) => b.website).length, "Direct research links")}
          ${metric("With Contact", state.brands.filter((b) => b.contact).length, "Communication ready")}
        </div>
      </div>
      <div class="brand-grid directory-grid">${state.brands.map(brandCard).join("") || `<div class="empty">No brand records yet.</div>`}</div>`;
  }
  function brandBoardContent(filtered, confirmed) {
    return `<div class="panel brand-panel">
      <div class="panel-head">
        <div><h3>Deal Board</h3><div class="panel-sub">Track progress only after a brand becomes an active sponsorship opportunity.</div></div>
        <div class="card-actions">
          <button class="ghost-btn sync-board-btn" data-sync-scope="brand" type="button">Sync Brands</button>
          <button class="ghost-btn" data-backup-brands type="button">Backup Brands</button>
          <button class="ghost-btn" data-import-brands type="button">Import Backup</button>
          <input class="is-hidden" id="brand-backup-file" type="file" accept="application/json">
          <button class="primary-btn" data-add-brand type="button">Add Brand Deal</button>
        </div>
      </div>
      <div class="grid cols-4">
        ${metric("Active", state.brands.filter((b) => !["Paid", "Declined"].includes(b.status)).length, "Needs follow-up")}
        ${metric("Confirmed", confirmed.length, "Revenue likely")}
        ${metric("Confirmed Value", formatCurrency(confirmed.reduce((sum, b) => sum + Number(b.value || 0), 0)), "Pipeline value")}
        ${metric("Paid", state.brands.filter((b) => b.status === "Paid").length, "Closed deals")}
      </div>
      <div class="toolbar"><select id="brand-stage"><option value="all">All stages</option>${BRAND_STAGES.map((stage) => `<option ${state.brandStage === stage ? "selected" : ""}>${stage}</option>`).join("")}</select></div>
    </div>
    ${state.brandStage === "all" ? brandKanban(state.brands) : `<div class="brand-grid">${filtered.map(brandCard).join("") || `<div class="empty">No brand deals in this stage.</div>`}</div>`}`;
  }
  function bindBrandButtons() {
    $("[data-add-brand]")?.addEventListener("click", () => openBrandModal());
    $all("[data-sync-scope]").forEach((btn) => btn.addEventListener("click", () => syncSharedBoard(btn.dataset.syncScope)));
    $("[data-backup-brands]")?.addEventListener("click", backupBrands);
    $("[data-import-brands]")?.addEventListener("click", () => $("#brand-backup-file")?.click());
    $("#brand-backup-file")?.addEventListener("change", importBrandBackup);
    $("#brand-stage")?.addEventListener("change", (event) => {
      state.brandStage = event.target.value;
      renderBrand();
    });
    $all("[data-edit-brand]").forEach((btn) => btn.addEventListener("click", () => openBrandModal(state.brands.find((brand) => brand.id === btn.dataset.editBrand))));
    $all("[data-advance-brand]").forEach((btn) => btn.addEventListener("click", () => advanceBrand(btn.dataset.advanceBrand)));
    $all("[data-delete-brand]").forEach((btn) => btn.addEventListener("click", () => deleteBrand(btn.dataset.deleteBrand)));
  }
  function backupBrands() {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: "CoinLyte Command Centre",
      scope: "brand-deals",
      brands: state.brands
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `coinlyte-brand-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("Brand backup downloaded.");
  }
  function importBrandBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || "{}"));
        if (!Array.isArray(payload.brands)) throw new Error("Missing brand records");
        confirmDialog({
          title: "Restore brand backup?",
          body: "This replaces the current Brand Directory and Deal Board with the selected backup file.",
          confirmText: "Restore Brands",
          onConfirm: () => {
            state.brands = payload.brands.map(withId);
            saveBrands();
            renderBrand();
            toast("Brand backup restored.");
          }
        });
      } catch {
        toast("That brand backup file could not be read.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }
  function brandCard(brand) {
    const tone = brandStatusTone(brand.status);
    return `<article class="list-card brand-card tone-${tone}">
      <div class="brand-card-top"><span class="tag ${tone}">${brandStatusEmoji(brand.status)} ${escapeHTML(brand.status)}</span><span class="brand-value">${formatDealValue(brand)}</span></div>
      <h4>${escapeHTML(brand.name)}</h4>
      <p>${escapeHTML(brand.notes || "No notes yet.")}</p>
      <div class="brand-meta-grid">
        <span>🏷️ ${escapeHTML(brand.category || "Brand")}</span>
        <span>💼 ${escapeHTML(brand.type || "Fixed Fee")}</span>
        <span>📅 ${escapeHTML(brand.deadline || "No deadline")}</span>
        <span>📨 ${escapeHTML(brand.communication || "Not set")}</span>
        <span>👤 ${escapeHTML(brand.contact || "No contact")}</span>
      </div>
      <div class="panel-sub">Website: ${brand.website ? `<a href="${escapeHTML(brand.website)}" target="_blank" rel="noreferrer">${escapeHTML(brand.website)}</a>` : "not set"}</div>
      <div class="card-actions"><button class="ghost-btn edit-btn" data-edit-brand="${brand.id}" type="button">✏️ Edit</button><button class="primary-btn compact-btn" data-advance-brand="${brand.id}" type="button">Advance →</button><button class="danger-btn compact-btn" data-delete-brand="${brand.id}" type="button">×</button></div>
    </article>`;
  }
  function brandKanban(brands) {
    return `<div class="brand-board">${BRAND_STAGES.map((stage) => {
      const cards = brands.filter((brand) => brand.status === stage);
      return `<div class="brand-col tone-${brandStatusTone(stage)}"><h4>${brandStatusEmoji(stage)} ${escapeHTML(stage)} <span>${cards.length}</span></h4>${cards.map(brandCard).join("") || `<div class="empty">No deals</div>`}</div>`;
    }).join("")}</div>`;
  }
  function brandStatusTone(status = "") {
    const text = String(status).toLowerCase();
    if (text.includes("pitch")) return "violet";
    if (text.includes("discussion")) return "blue";
    if (text.includes("confirmed")) return "green";
    if (text.includes("product")) return "gold";
    if (text.includes("content")) return "teal";
    if (text.includes("paid")) return "green";
    if (text.includes("declined")) return "red";
    return "blue";
  }
  function brandStatusEmoji(status = "") {
    const text = String(status).toLowerCase();
    if (text.includes("pitch")) return "📨";
    if (text.includes("discussion")) return "💬";
    if (text.includes("confirmed")) return "✅";
    if (text.includes("product")) return "📦";
    if (text.includes("content")) return "🎬";
    if (text.includes("paid")) return "💰";
    if (text.includes("declined")) return "⛔";
    return "💼";
  }
  function openBrandModal(brand) {
    const editing = Boolean(brand);
    const current = brand || { name: "", website: "", communication: "Email", contact: "", value: "", currency: "INR", type: "Fixed Fee", category: "Wallet", status: "Pitching", deadline: "", notes: "" };
    const categoryOptions = uniqueOptions(BRAND_CATEGORIES, state.brands.map((item) => item.category));
    const typeOptions = uniqueOptions(BRAND_TYPES, state.brands.map((item) => item.type));
    $("#modal-root").classList.remove("is-hidden");
    $("#modal-root").innerHTML = `
      <form class="modal brand-modal" id="brand-form">
        <div class="brand-modal-hero">
          <div class="modal-head"><div><p class="eyebrow">Brand · Deal Record</p><h3>${editing ? "Edit Brand Deal" : "Add Brand Deal"}</h3></div><button class="ghost-btn close-pill" data-close type="button">Close</button></div>
          <div class="modal-chip-row">
            <span>${brandStatusEmoji(current.status)} ${escapeHTML(current.status)}</span>
            <span>💼 ${escapeHTML(current.type || "Fixed Fee")}</span>
            <span>${formatDealValue(current)}</span>
          </div>
        </div>
        <div class="form-grid brand-form-body">
          <label>Brand / campaign<input name="name" required value="${escapeHTML(current.name)}"></label>
          <label>Website<input name="website" value="${escapeHTML(current.website || "")}" placeholder="https://"></label>
          ${categoryField("category", categoryOptions, current.category || "Wallet")}
          <label>Communication<select name="communication">${["Email", "WhatsApp", "Telegram", "LinkedIn", "Agency", "Other"].map((channel) => `<option ${current.communication === channel ? "selected" : ""}>${channel}</option>`).join("")}</select></label>
          <label>Contact<input name="contact" value="${escapeHTML(current.contact || "")}"></label>
          <div class="deal-value-wrap span-2">
            <label>Currency<select name="currency">${CURRENCIES.map((currency) => `<option ${String(current.currency || "INR") === currency ? "selected" : ""}>${currency}</option>`).join("")}</select></label>
            <label>Amount<input name="value" type="number" min="0" value="${escapeHTML(current.value || "")}" placeholder="Enter amount"></label>
          </div>
          <label>Type<select name="type" data-custom-select="type">${selectOptions([...typeOptions, "Custom..."], typeOptions.includes(current.type) ? current.type : "Custom...")}</select></label>
          <label class="custom-field ${typeOptions.includes(current.type) ? "is-hidden" : ""}" data-custom-field="type">Custom type<input name="typeCustom" value="${typeOptions.includes(current.type) ? "" : escapeHTML(current.type || "")}" placeholder="New deal type"></label>
          <label>Status<select name="status">${BRAND_STAGES.map((stage) => `<option ${current.status === stage ? "selected" : ""}>${stage}</option>`).join("")}</select></label>
          <label>Deadline<input name="deadline" type="date" value="${escapeHTML(current.deadline || "")}"></label>
          <label class="span-2">Notes<textarea name="notes" rows="4">${escapeHTML(current.notes || "")}</textarea></label>
        </div>
        <div class="modal-actions planner-modal-actions"><button class="ghost-btn" data-close type="button">Cancel</button><button class="primary-btn" type="submit">💾 Save Brand</button></div>
      </form>`;
    $all("[data-close]", $("#modal-root")).forEach((btn) => btn.addEventListener("click", closeModal));
    bindCustomSelects($("#modal-root"));
    $("#brand-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const next = withId({
        id: current.id,
        name: form.get("name").trim(),
        website: form.get("website").trim(),
        category: customSelectValue(form, "category", "Wallet"),
        communication: form.get("communication"),
        contact: form.get("contact").trim(),
        value: Number(form.get("value") || 0),
        currency: form.get("currency") || "INR",
        type: customSelectValue(form, "type", "Fixed Fee"),
        status: form.get("status"),
        deadline: form.get("deadline"),
        notes: form.get("notes").trim()
      });
      if (editing) state.brands = state.brands.map((item) => item.id === current.id ? next : item);
      else state.brands.unshift(next);
      saveBrands();
      closeModal();
      renderBrand();
      toast(editing ? "Brand deal updated." : "Brand deal added.");
    });
  }
  function advanceBrand(id) {
    const brand = state.brands.find((item) => item.id === id);
    const idx = BRAND_STAGES.indexOf(brand.status);
    brand.status = BRAND_STAGES[Math.min(BRAND_STAGES.length - 1, idx + 1)];
    saveBrands();
    renderBrand();
  }
  function deleteBrand(id) {
    const brand = state.brands.find((item) => item.id === id);
    confirmDialog({
      title: "Delete brand deal?",
      body: `This removes "${brand.name}" from local sponsorship tracking.`,
      confirmText: "Delete",
      danger: true,
      onConfirm: () => {
        state.brands = state.brands.filter((item) => item.id !== id);
        saveBrands();
        renderBrand();
        toast("Brand deal deleted.", { label: "Undo", run: () => { state.brands.unshift(brand); saveBrands(); renderBrand(); } });
      }
    });
  }

  function renderCalendar() {
    const active = state.pipeline.filter((card) => card.stage !== "published");
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    $("#calendar").innerHTML = `
      <div class="panel">
        <div class="panel-head"><div><h3>Upload Calendar</h3><div class="panel-sub">Turns planner cards into a weekly operating cadence. Best publish window uses refreshed hourly data when available.</div></div><button class="primary-btn" data-new-card type="button">Add Video</button></div>
        <div class="grid cols-4">
          ${metric("Best Window", data.bestHours.rows[0]?.time || "09:30 IST", data.bestHours.source)}
          ${metric("This Week", active.length, "Unpublished planner cards")}
          ${metric("Sponsored", active.filter((card) => card.sponsor).length, "Needs brand coordination")}
          ${metric("Ready Soon", active.filter((card) => ["editing", "scheduled"].includes(card.stage)).length, "Close to upload")}
        </div>
      </div>
      <div class="board">${days.map((day, index) => {
        const card = active[index % Math.max(active.length, 1)];
        return `<div class="board-col"><h4>${day}</h4>${card ? `<article class="list-card"><span class="tag ${card.priority === "Urgent" ? "red" : "gold"}">${escapeHTML(card.priority)}</span><h4>${escapeHTML(card.title)}</h4><p>${escapeHTML(card.category)} | ${escapeHTML(stageLabel(card.stage))}</p><div class="panel-sub">Recommended: ${escapeHTML(data.bestHours.rows[index % data.bestHours.rows.length]?.time || "09:30 IST")}</div></article>` : `<div class="empty">No planned upload</div>`}</div>`;
      }).join("")}</div>`;
    $("[data-new-card]").addEventListener("click", () => openCardModal());
  }

  function renderReview() {
    const an = data.analytics[state.period] || data.analytics["90d"];
    const net = an.subscribersGained - an.subscribersLost;
    $("#review").innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <div><h3>Monthly Review</h3><div class="panel-sub">A decision board for what to double down on, what to fix, and what to stop.</div></div>
          <div class="segmented">${Object.entries(data.analytics).map(([key, value]) => `<button type="button" data-period="${key}" class="${state.period === key ? "active" : ""}">${value.label}</button>`).join("")}</div>
        </div>
        <div class="grid cols-4">
          ${metric("Views", formatNumber(an.views), an.period)}
          ${metric("Net Subs", `+${formatNumber(net)}`, "Growth after lost subscribers")}
          ${metric("Retention", `${an.retention}%`, an.retention >= 35 ? "Healthy" : "Needs stronger opening")}
          ${metric("Shares", formatNumber(an.shares), "Trust and forwarding signal")}
        </div>
      </div>
      <div class="grid cols-3">
        <div class="panel"><div class="panel-head"><div><h3>Double Down</h3><div class="panel-sub">Formats already proven by your channel.</div></div></div><div class="bars">${data.topVideos.slice(0, 4).map((video) => `<div class="list-card"><h4>${escapeHTML(video[1])}</h4><p>${formatNumber(video[2])} views | ${video[3]}% retention | +${formatNumber(video[4])} subs</p></div>`).join("")}</div></div>
        <div class="panel"><div class="panel-head"><div><h3>Fix Next</h3><div class="panel-sub">Weakest operating metrics.</div></div></div><div class="bars">${riskRow("Retention", Number(an.retention), 42, "Target 38-42%")}${riskRow("Comment rate", Number(an.commentRate), 1, "Target 1%+")}${riskRow("Upload cadence", 10, 12, "Target 12/mo")}</div></div>
        <div class="panel"><div class="panel-head"><div><h3>Next Moves</h3><div class="panel-sub">Generated from market and audience intelligence.</div></div></div><div class="bars">${data.ideas.slice(0, 4).map((idea) => `<div class="list-card"><span class="tag green">${Math.round(idea.score || 75)}/100</span><h4>${escapeHTML(idea.title)}</h4><p>${escapeHTML(idea.reason)}</p></div>`).join("")}</div></div>
      </div>`;
    $all("[data-period]").forEach((btn) => btn.addEventListener("click", () => {
      state.period = btn.dataset.period;
      renderReview();
    }));
  }

  function renderRefresh() {
    const job = state.refreshJob || { status: "idle", runId: "not queued", updatedAt: data.refreshedAt, datasets: {} };
    const rows = [
      ["Channel", job.datasets?.channel || "cached", data.refreshedAt],
      ["Analytics", job.datasets?.analytics || "cached", data.refreshedAt],
      ["Comments", job.datasets?.comments || "cached", data.refreshedAt],
      ["Competitors", job.datasets?.competitors || "cached", data.refreshedAt],
      ["Ideas", job.datasets?.ideas || "cached", data.refreshedAt]
    ];
    $("#refresh").innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <div><h3>Refresh Control</h3><div class="panel-sub">The browser calls your own server endpoint. GitHub and YouTube secrets stay server-side.</div></div>
          <button class="primary-btn" data-trigger-refresh type="button">Queue Refresh</button>
        </div>
        <div class="grid cols-4">
          ${metric("Workflow", escapeHTML(job.status || "idle"), `Run ${escapeHTML(job.runId || "not queued")}`)}
          ${metric("Last Build", data.refreshBuild, "Git commit snapshot")}
          ${metric("Data Date", new Date(data.refreshedAt).toLocaleDateString("en-GB"), "Cached build timestamp")}
          ${metric("Hourly", "Modeled", "API hourly rows not present yet")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h3>Dataset Freshness</h3><div class="panel-sub">What changed, when it changed, and whether the refresh completed.</div></div><button class="ghost-btn" data-check-status type="button">Check Status</button></div>
        <div class="refresh-timeline">${rows.map(([name, status, time]) => `<div class="timeline-item"><strong>${escapeHTML(name)}</strong><div><span class="tag ${status === "updated" ? "green" : "blue"}">${escapeHTML(status)}</span><div class="panel-sub">${escapeHTML(new Date(time).toLocaleString("en-GB"))}</div></div></div>`).join("")}</div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h3>Production Safety</h3><div class="panel-sub">Expected deployment rules.</div></div></div>
        <div class="idea-grid">
          <div class="list-card"><h4>No browser tokens</h4><p>Frontend files do not contain GitHub PATs, YouTube keys, or workflow authorization headers.</p></div>
          <div class="list-card"><h4>Status is auditable</h4><p>Refresh can show queued, running, completed, or failed, plus a workflow run id when GitHub returns it.</p></div>
          <div class="list-card"><h4>Graceful fallback</h4><p>When running locally without env vars, the UI simulates status clearly instead of pretending live data changed.</p></div>
        </div>
      </div>`;
    $("[data-trigger-refresh]").addEventListener("click", triggerRefresh);
    $("[data-check-status]").addEventListener("click", checkRefreshStatus);
  }
  async function triggerRefresh() {
    setSync("Queuing refresh...");
    try {
      const res = await fetch("/api/refresh", { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!res.ok) throw new Error(`Refresh endpoint returned ${res.status}`);
      const body = await res.json();
      state.refreshJob = {
        status: body.status || "queued",
        runId: body.runId || "pending",
        updatedAt: new Date().toISOString(),
        datasets: { channel: "queued", analytics: "queued", comments: "queued", competitors: "queued", ideas: "queued" }
      };
      toast("Refresh queued. Status panel updated.");
    } catch (error) {
      state.refreshJob = {
        status: "local simulation",
        runId: `local-${Date.now()}`,
        updatedAt: new Date().toISOString(),
        datasets: { channel: "cached", analytics: "cached", comments: "cached", competitors: "cached", ideas: "cached" },
        error: error.message
      };
      toast("Running locally without refresh credentials, so status is simulated.");
    }
    store.set("cl_refresh_job_v1", state.refreshJob);
    setSync(state.refreshJob.status);
    renderRefresh();
  }
  async function checkRefreshStatus() {
    setSync("Checking status...");
    try {
      const query = state.refreshJob?.runId ? `?runId=${encodeURIComponent(state.refreshJob.runId)}` : "";
      const res = await fetch(`/api/refresh-status${query}`);
      if (!res.ok) throw new Error(`Status endpoint returned ${res.status}`);
      const body = await res.json();
      state.refreshJob = { ...state.refreshJob, ...body, updatedAt: new Date().toISOString() };
      toast(`Refresh status: ${state.refreshJob.status}`);
    } catch {
      toast("No live status available in local mode.");
    }
    store.set("cl_refresh_job_v1", state.refreshJob);
    setSync(state.refreshJob?.status || "Ready");
    renderRefresh();
  }
  function openOwnerModal() {
    $("#modal-root").classList.remove("is-hidden");
    $("#modal-root").innerHTML = `
      <div class="modal owner-settings-modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div><p class="eyebrow">Owner · Access</p><h3>Owner Settings</h3><div class="panel-sub">Production login is controlled by the Vercel <strong>OWNER_ACCESS_CODE</strong> environment variable.</div></div>
          <button class="ghost-btn" data-close type="button">Close</button>
        </div>
        <div class="grid cols-2">
          <div class="list-card">
            <span class="tag teal">☁ Shared board</span>
            <h4>${state.cloud.ready ? "Supabase connected" : "Local browser mode"}</h4>
            <p>${state.cloud.ready ? "Planner, brands, team users, notifications, and dismissed items are syncing through Vercel APIs." : "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel to make this board shared across devices."}</p>
          </div>
          <div class="list-card">
            <span class="tag green">🔐 Owner login code</span>
            <h4>Managed in Vercel</h4>
            <p>To reset the owner login code, change <strong>OWNER_ACCESS_CODE</strong> in Vercel and redeploy. No GitHub, YouTube, access-code, or API secrets are exposed inside frontend files.</p>
            <div class="card-actions">
              <a class="ghost-btn" href="https://vercel.com/kirtish-vyas-projects/coinlyte-youtube-command-centre/settings/environment-variables" target="_blank" rel="noreferrer">Open Vercel Env</a>
            </div>
          </div>
          <div class="list-card">
            <span class="tag blue">👥 Team login</span>
            <h4>Managed in Team Access</h4>
            <p>After Supabase is connected, create a team user and set their login code. Their code opens only the tabs selected in Board Access.</p>
          </div>
          <div class="list-card">
            <span class="tag red">🚪 Session</span>
            <h4>Logout from this browser</h4>
            <p>Use this before sharing your screen or when you finish working on a public machine.</p>
            <button class="danger-btn" data-logout type="button">Logout</button>
          </div>
        </div>
        <div class="modal-actions"><button class="primary-btn" data-close type="button">Done</button></div>
      </div>`;
    $all("[data-close]", $("#modal-root")).forEach((btn) => btn.addEventListener("click", closeModal));
    $("[data-logout]", $("#modal-root"))?.addEventListener("click", logoutOwner);
  }
  function logoutOwner() {
    sessionStorage.removeItem("cl_local_session");
    window.location.href = "/api/logout";
  }
  function setSync(text) {
    $("#sync-pill").textContent = text;
  }

  function render() {
    $("#side-refresh").textContent = new Date(data.refreshedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    $("#side-refresh-mode").textContent = state.refreshJob?.status || "Latest cached build";
    if (state.view === "overview") renderOverview();
    if (state.view === "analytics") renderAnalytics();
    if (state.view === "intelligence") renderIntelligence();
    if (state.view === "ideas") renderVideoIdeas();
    if (state.view === "pulse") renderCommentPulse();
    if (state.view === "market") renderMarket();
    if (state.view === "planner") renderPlanner();
    if (state.view === "calendar") renderCalendar();
    if (state.view === "team") renderTeam();
    if (state.view === "brand") renderBrand();
    if (state.view === "review") renderReview();
    if (state.view === "refresh") renderRefresh();
  }
  function initLogin() {
    const authed = sessionStorage.getItem("cl_local_session") === "1";
    if (authed || $("#gate").classList.contains("is-hidden")) unlock();
    $("#login-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const code = $("#access-code").value.trim();
      if (!code) {
        $("#login-error").textContent = "Enter any local passphrase to unlock this demo. Production auth should stay server-side.";
        return;
      }
      sessionStorage.setItem("cl_local_session", "1");
      unlock();
    });
  }
  function unlock() {
    $("#gate").classList.add("is-hidden");
    $("#app").classList.remove("is-hidden");
    applyAccessNavigation();
    render();
    bootstrapCloud();
  }
  function init() {
    initLogin();
    $all(".nav-btn").forEach((btn) => btn.addEventListener("click", () => setView(btn.dataset.view)));
    $("#sync-board")?.addEventListener("click", () => syncSharedBoard("board"));
    $("#refresh-now").addEventListener("click", () => {
      setView("refresh");
      triggerRefresh();
    });
    $("#owner-menu")?.addEventListener("click", openOwnerModal);
  }
  init();
})();
