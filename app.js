(() => {
  "use strict";

  const dom = {
    emptyState: document.getElementById("emptyState"),
    workspace: document.getElementById("workspace"),
    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("fileInput"),
    chooseFile: document.getElementById("chooseFile"),
    openAnother: document.getElementById("openAnother"),
    reportTitle: document.getElementById("reportTitle"),
    reportMeta: document.getElementById("reportMeta"),
    fileSize: document.getElementById("fileSize"),
    summaryStats: document.getElementById("summaryStats"),
    keepFields: document.getElementById("keepFields"),
    inspectFields: document.getElementById("inspectFields"),
    pulseList: document.getElementById("pulseList"),
    schemaCount: document.getElementById("schemaCount"),
    schemaTable: document.getElementById("schemaTable"),
    modelCount: document.getElementById("modelCount"),
    modelRecords: document.getElementById("modelRecords"),
    pccCount: document.getElementById("pccCount"),
    pccRecords: document.getElementById("pccRecords"),
    flowCount: document.getElementById("flowCount"),
    flowSummary: document.getElementById("flowSummary"),
    flowList: document.getElementById("flowList"),
    errorToast: document.getElementById("errorToast"),
    errorMessage: document.getElementById("errorMessage"),
    dismissError: document.getElementById("dismissError"),
    tabs: [...document.querySelectorAll(".tab")],
    tabPanels: [...document.querySelectorAll(".tab-panel")],
  };

  const state = {
    report: null,
    analysis: null,
    fileName: "",
    fileSize: 0,
  };

  const modelMetadataFields = [
    ["model", "Model"],
    ["modelVersion", "Model version"],
    ["useCase", "Use case"],
    ["clientIdentifier", "Client"],
    ["executionEnvironment", "Execution environment"],
  ];

  const pipelineFieldOrder = [
    "model",
    "adapter",
    "inference-id",
    "workflow-id",
    "input-token-count-interval-start-closed",
    "input-token-count-interval-end-open",
    "heuristic-input-token-count-interval-start-closed",
    "heuristic-input-token-count-interval-end-open",
    "max-allowed-output-tokens-interval-start-closed",
    "max-allowed-output-tokens-interval-end-open",
    "apple-max-tokens",
  ];

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clear(node) {
    node.replaceChildren();
  }

  function formatNumber(value) {
    return new Intl.NumberFormat().format(Number(value) || 0);
  }

  function formatCompactCount(value) {
    const number = Number(value) || 0;
    return new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(number);
  }

  function formatBytes(value) {
    const number = Number(value) || 0;
    if (number < 1024) return `${number} B`;
    if (number < 1024 * 1024) return `${(number / 1024).toFixed(number < 10240 ? 1 : 0)} KB`;
    return `${(number / (1024 * 1024)).toFixed(number < 10 * 1024 * 1024 ? 2 : 1)} MB`;
  }

  function timestampToDate(timestamp) {
    const numeric = Number(timestamp);
    if (!Number.isFinite(numeric)) return null;
    const milliseconds = numeric > 1e12 ? numeric : numeric * 1000;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatTimestamp(timestamp) {
    const date = timestampToDate(timestamp);
    if (!date) return "Unknown time";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  }

  function formatClock(timestamp) {
    const date = timestampToDate(timestamp);
    if (!date) return "--:--:--";
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  }

  function formatDateRange(startTimestamp, endTimestamp) {
    const start = timestampToDate(startTimestamp);
    const end = timestampToDate(endTimestamp);
    if (!start || !end) return "Timestamp range unavailable";
    const dateLabel = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(start);
    const timeLabel = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${dateLabel} · ${timeLabel.format(start)}–${timeLabel.format(end)}`;
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    if (minutes === 0) return `${remainder}s`;
    return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
  }

  function formatModel(value) {
    const raw = String(value || "");
    if (raw.includes("conversation_title_summarization")) return "Title summarization";
    if (raw.includes("lw_planner_v5")) return "Agentic planner · v5";
    if (raw.includes("lw_planner_v4")) return "Agentic planner · v4";
    if (raw.includes("base_pro")) return "Base Pro";
    if (raw.includes("base_zap")) return "Base Zap";
    if (raw.includes("speech.synthesis.v7")) return "Speech synthesis · v7";
    const parts = raw.split(".").filter(Boolean);
    return parts.slice(-2).join(" · ") || "Unknown model";
  }

  function formatUseCase(value) {
    const raw = String(value || "");
    if (raw === "Siri.AgenticPlanner") return "Siri · Agentic planner";
    if (raw === "Conversation.TitleSummarization") return "Title summarization";
    return raw.replace(/[._]/g, " ") || "Unspecified use case";
  }

  function compactIdentifier(value) {
    const raw = String(value || "");
    if (!raw) return "Not recorded";
    if (raw.length <= 24) return raw;
    return `${raw.slice(0, 8)}…${raw.slice(-6)}`;
  }

  function countSubstrings(value, needle) {
    const source = String(value || "");
    if (!source || !needle) return 0;
    let count = 0;
    let start = 0;
    while (true) {
      const index = source.indexOf(needle, start);
      if (index === -1) return count;
      count += 1;
      start = index + needle.length;
    }
  }

  function countMatches(value, expression) {
    const matches = String(value || "").match(expression);
    return matches ? matches.length : 0;
  }

  function textMetrics(value) {
    const source = String(value || "");
    return {
      characters: source.length,
      lines: source ? source.split("\n").length : 0,
      turnMarkers: countSubstrings(source, "<start_of_turn>"),
      controlMarkers: countMatches(source, /<ctrl\d+>/g),
      toolCalls: countSubstrings(source, "<ctrl42>call:"),
      standaloneAnswers: countSubstrings(source, "<standalone_answer>"),
    };
  }

  function cleanRequestText(value) {
    return String(value || "")
      .replace(/<ctrl\d+>/g, " ")
      .replace(/<start_of_turn>[^\n]*/g, " ")
      .replace(/<end_of_turn>/g, " ")
      .replace(/<standalone_answer>/g, " ")
      .replace(/<\/standalone_answer>/g, " ")
      .replace(/<ui_entity_rendering[^>]*\/?\s*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractRequestText(value) {
    const source = String(value || "");
    const segments = [];
    const turnPattern = /<start_of_turn>user(?:\r?\n)?([\s\S]*?)(?=<start_of_turn>|<end_of_turn>|$)/g;
    const controlPattern = /<ctrl99>user(?:\r?\n)?([\s\S]*?)(?=<ctrl99>model|<ctrl99>assistant|<end_of_turn>|$)/g;
    let match;
    while ((match = turnPattern.exec(source)) !== null) segments.push(match[1]);
    while ((match = controlPattern.exec(source)) !== null) segments.push(match[1]);
    const selected = segments.length ? segments[segments.length - 1] : "";
    return cleanRequestText(selected);
  }

  function requestPreview(value, limit = 300) {
    const text = extractRequestText(value);
    if (!text) return "No readable user excerpt found; open the serialized prompt to inspect it.";
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
  }

  function parsePipelineParameters(request) {
    if (!request || typeof request.pipelineParameters !== "string") return null;
    try {
      const parsed = JSON.parse(request.pipelineParameters);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function valueType(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
  }

  function pathIsMetadata(path) {
    const lastPart = path.split(".").pop().replace(/\[\]$/, "");
    return /^(model|modelVersion|useCase|clientIdentifier|executionEnvironment|pipelineKind|adapter|applicationId|assetId|assetVersion)$/.test(lastPart);
  }

  function addSchemaRecord(records, path, value) {
    if (!path || path === "$") return;
    if (!records.has(path)) {
      records.set(path, {
        path,
        types: new Set(),
        occurrences: 0,
        nullCount: 0,
        stringLengths: [],
        arrayLengths: [],
        values: new Set(),
        numberMin: Number.POSITIVE_INFINITY,
        numberMax: Number.NEGATIVE_INFINITY,
        booleanValues: new Set(),
      });
    }

    const record = records.get(path);
    const type = valueType(value);
    record.types.add(type);
    record.occurrences += 1;
    if (type === "null") {
      record.nullCount += 1;
    } else if (type === "string") {
      record.stringLengths.push(value.length);
      if (pathIsMetadata(path) && value.length <= 96) record.values.add(value);
    } else if (type === "array") {
      record.arrayLengths.push(value.length);
    } else if (type === "number" && Number.isFinite(value)) {
      record.numberMin = Math.min(record.numberMin, value);
      record.numberMax = Math.max(record.numberMax, value);
    } else if (type === "boolean") {
      record.booleanValues.add(value);
    }
  }

  function collectSchema(records, value, path) {
    addSchemaRecord(records, path, value);
    const type = valueType(value);
    if (type === "object") {
      Object.keys(value).forEach((key) => collectSchema(records, value[key], `${path}.${key}`));
    } else if (type === "array") {
      value.forEach((item) => collectSchema(records, item, `${path}[]`));
    }
  }

  function discoverSchema(report) {
    const records = new Map();
    collectSchema(records, report, "$");

    const pccRequests = Array.isArray(report.privateCloudComputeRequests)
      ? report.privateCloudComputeRequests
      : [];
    pccRequests.forEach((request) => {
      const decoded = parsePipelineParameters(request);
      if (decoded) collectSchema(records, decoded, "privateCloudComputeRequests[].pipelineParameters (decoded)");
    });

    return [...records.values()];
  }

  function expectedPresence(records, path) {
    const lastDot = path.lastIndexOf(".");
    if (lastDot === -1) return null;
    const parentPath = path.slice(0, lastDot);
    const parent = records.find((record) => record.path === parentPath);
    return parent && parent.occurrences > 1 ? parent.occurrences : null;
  }

  function schemaTypeLabel(record) {
    return [...record.types].sort().join(" | ");
  }

  function schemaShapeLabel(record) {
    const types = record.types;
    if (types.has("array")) {
      const lengths = record.arrayLengths;
      if (!lengths.length) return "array";
      const min = Math.min(...lengths);
      const max = Math.max(...lengths);
      return min === max ? `${min} item${min === 1 ? "" : "s"}` : `${min}–${max} items`;
    }
    if (types.has("string")) {
      const lengths = record.stringLengths;
      const size = lengths.length
        ? (Math.min(...lengths) === Math.max(...lengths)
          ? `${formatNumber(lengths[0])} chars`
          : `${formatNumber(Math.min(...lengths))}–${formatNumber(Math.max(...lengths))} chars`)
        : "text";
      const values = [...record.values].sort();
      if (values.length && values.length <= 4) return `${size} · ${values.map((value) => formatModel(value)).join(" · ")}`;
      return size;
    }
    if (types.has("number")) return "numeric";
    if (types.has("boolean")) return "true / false";
    if (types.has("object")) return "object";
    return "null";
  }

  function buildFlowEvents(modelRequests, pccRequests) {
    const pccByRequestId = new Map();
    pccRequests.forEach((request) => {
      const key = request && request.requestId;
      if (!key) return;
      if (!pccByRequestId.has(key)) pccByRequestId.set(key, []);
      pccByRequestId.get(key).push(request);
    });

    const consumed = new Set();
    const events = [];
    modelRequests.forEach((request) => {
      const pipelines = request && request.identifier && pccByRequestId.get(request.identifier) || [];
      pipelines.forEach((item) => consumed.add(item));
      events.push({ kind: "turn", timestamp: Number(request && request.timestamp), request, pipelines });
    });
    pccRequests.forEach((request) => {
      if (consumed.has(request)) return;
      events.push({ kind: "cloud", timestamp: Number(request && request.timestamp), request, pipelines: [request] });
    });
    return events.filter((event) => Number.isFinite(event.timestamp)).sort((a, b) => a.timestamp - b.timestamp);
  }

  function buildAnalysis(report, fileSize) {
    const modelRequests = Array.isArray(report.modelRequests) ? report.modelRequests : [];
    const pccRequests = Array.isArray(report.privateCloudComputeRequests)
      ? report.privateCloudComputeRequests
      : [];
    const modelIds = new Set(modelRequests.map((item) => item && item.identifier).filter(Boolean));
    const timestamps = [...modelRequests, ...pccRequests]
      .map((item) => Number(item && item.timestamp))
      .filter(Number.isFinite);
    const prompts = modelRequests.map((item) => String(item && item.prompt ? item.prompt : ""));
    const responses = modelRequests.map((item) => String(item && item.response ? item.response : ""));
    const nodes = pccRequests.flatMap((item) => (Array.isArray(item && item.nodes) ? item.nodes : []));
    const assets = pccRequests.flatMap((item) => (Array.isArray(item && item.assets) ? item.assets : []));
    const attestationCharacters = nodes.reduce((sum, node) => sum + String(node && node.attestationBundle ? node.attestationBundle : "").length, 0);
    const linkedPcc = pccRequests.filter((item) => modelIds.has(item && item.requestId)).length;
    const decodedParameters = pccRequests.map(parsePipelineParameters).filter(Boolean);
    const infrastructureModels = new Set(decodedParameters.map((item) => item.model).filter(Boolean));
    const minTimestamp = timestamps.length ? Math.min(...timestamps) : null;
    const maxTimestamp = timestamps.length ? Math.max(...timestamps) : null;
    const flowEvents = buildFlowEvents(modelRequests, pccRequests);

    return {
      modelRequests,
      pccRequests,
      nodes,
      assets,
      decodedParameters,
      schema: discoverSchema(report),
      fileSize,
      modelIds,
      linkedPcc,
      infrastructureModels,
      promptCharacters: prompts.reduce((sum, value) => sum + value.length, 0),
      responseCharacters: responses.reduce((sum, value) => sum + value.length, 0),
      attestationCharacters,
      minTimestamp,
      maxTimestamp,
      duration: minTimestamp === null || maxTimestamp === null ? 0 : maxTimestamp - minTimestamp,
      flowEvents,
      linkedTurns: flowEvents.filter((event) => event.kind === "turn" && event.pipelines.length).length,
      cloudOnlyEvents: flowEvents.filter((event) => event.kind === "cloud").length,
    };
  }

  function showError(message) {
    dom.errorMessage.textContent = message;
    dom.errorToast.hidden = false;
  }

  function hideError() {
    dom.errorToast.hidden = true;
  }

  function validateReport(report) {
    if (!report || typeof report !== "object" || Array.isArray(report)) {
      throw new Error("This file is not a JSON object.");
    }
    const hasKnownCollection = Array.isArray(report.modelRequests) || Array.isArray(report.privateCloudComputeRequests);
    if (!hasKnownCollection) {
      throw new Error("This does not look like an Apple Intelligence report: the expected request collections are missing.");
    }
  }

  async function loadFile(file) {
    if (!file) return;
    hideError();
    dom.fileInput.value = "";
    try {
      const rawText = await file.text();
      const report = JSON.parse(rawText);
      validateReport(report);
      state.report = report;
      state.fileName = file.name || "Apple Intelligence report.json";
      state.fileSize = file.size || new TextEncoder().encode(rawText).length;
      state.analysis = buildAnalysis(report, state.fileSize);
      renderWorkspace();
    } catch (error) {
      showError(error && error.message ? error.message : "Could not read this JSON file.");
    }
  }

  function addStat(label, value, detail) {
    const card = el("article", "stat-card");
    card.append(el("span", "stat-label", label), el("strong", "stat-value", value), el("span", "stat-detail", detail));
    dom.summaryStats.append(card);
  }

  function renderStats() {
    clear(dom.summaryStats);
    const analysis = state.analysis;
    addStat("Model requests", formatNumber(analysis.modelRequests.length), "modelRequests[]");
    addStat("PCC requests", formatNumber(analysis.pccRequests.length), "privateCloudComputeRequests[]");
    addStat("Infrastructure models", formatNumber(analysis.infrastructureModels.size), "decoded pipeline models");
    addStat("Infrastructure nodes", formatNumber(analysis.nodes.length), `${formatNumber(analysis.nodes.filter((node) => node && node.nodeState === "Validated").length)} validated`);
    addStat("Observed span", formatDuration(analysis.duration), formatDateRange(analysis.minTimestamp, analysis.maxTimestamp));
  }

  function addFieldListItem(list, text) {
    const item = el("li");
    item.append(el("code", null, text));
    list.append(item);
  }

  function addPulseItem(label, value) {
    const item = el("div", "pulse-item");
    item.append(el("span", "pulse-label", label), el("strong", "pulse-value", value));
    dom.pulseList.append(item);
  }

  function renderOverview() {
    const analysis = state.analysis;
    clear(dom.keepFields);
    clear(dom.inspectFields);
    clear(dom.pulseList);

    [
      "timestamp",
      "model · modelVersion",
      "useCase · clientIdentifier",
      "identifier ↔ requestId",
      "pipelineParameters (decoded)",
      "nodes · state · finalized",
      "assets · version",
    ].forEach((field) => addFieldListItem(dom.keepFields, field));

    [
      "prompt · response",
      "attestationBundle",
      "node · proxiedBy",
      "assetHash",
      "custom <ctrl…> markup",
    ].forEach((field) => addFieldListItem(dom.inspectFields, field));

    addPulseItem("Text payload", `${formatCompactCount(analysis.promptCharacters + analysis.responseCharacters)} chars`);
    addPulseItem("Attestation data", formatBytes(analysis.attestationCharacters));
    addPulseItem("Correlated IDs", `${formatNumber(analysis.linkedPcc)} model ↔ PCC`);
    addPulseItem("Decoded parameters", `${formatNumber(analysis.decodedParameters.length)} / ${formatNumber(analysis.pccRequests.length)}`);
  }

  function createTypeBadge(label, optional) {
    return el("span", `type-badge${optional ? " optional" : ""}`, label);
  }

  function renderSchema() {
    const analysis = state.analysis;
    const rows = analysis.schema;
    clear(dom.schemaTable);
    dom.schemaCount.textContent = `${formatNumber(rows.length)} paths`;
    rows.forEach((record) => {
      const row = el("tr");
      const pathCell = el("td", "path-cell", record.path.replace(/^\$\./, ""));
      const typeCell = el("td");
      const expected = expectedPresence(rows, record.path);
      const optional = expected !== null && record.occurrences < expected;
      typeCell.append(createTypeBadge(schemaTypeLabel(record), optional));
      const presenceCell = el("td");
      presenceCell.textContent = expected === null
        ? formatNumber(record.occurrences)
        : `${formatNumber(record.occurrences)} / ${formatNumber(expected)}`;
      const shapeCell = el("td");
      shapeCell.append(el("span", "shape-text", schemaShapeLabel(record)));
      row.append(pathCell, typeCell, presenceCell, shapeCell);
      dom.schemaTable.append(row);
    });
  }

  function addSummaryField(parent, className, label, value, title) {
    const field = el("div", className);
    const strong = el("strong", null, value);
    const caption = el("span", null, label);
    if (title) {
      strong.title = title;
      caption.title = title;
    }
    field.append(strong, caption);
    parent.append(field);
  }

  function createRecordShell(mainTitle, mainDetail, fields, stat, bodyBuilder, previewText) {
    const details = el("details", "record");
    const summary = el("summary", "record-summary");
    const main = el("div", "summary-main");
    main.append(el("strong", null, mainTitle), el("span", null, mainDetail));
    summary.append(main);
    fields.forEach((field) => addSummaryField(summary, "summary-field", field.label, field.value, field.title));
    const statField = el("div", "summary-stat");
    statField.append(el("strong", null, stat.value), el("span", null, stat.detail));
    summary.append(statField, el("span", "summary-arrow", "›"));
    if (previewText) {
      const preview = el("div", "summary-preview");
      preview.append(el("span", "summary-preview-label", "Request excerpt"), el("span", "summary-preview-text", previewText));
      summary.append(preview);
    }
    const body = el("div", "record-body");
    details.append(summary, body);
    let built = false;
    details.addEventListener("toggle", () => {
      if (details.open && !built) {
        built = true;
        bodyBuilder(body);
      }
    });
    return details;
  }

  function addKeyValueList(parent, entries) {
    const list = el("dl", "key-value-list");
    entries.forEach((entry) => {
      const row = el("div", "key-value-row");
      const term = el("dt", null, entry.label);
      const definition = el("dd", entry.mono ? "mono-value" : null, entry.value);
      if (entry.title) {
        definition.title = entry.title;
        term.title = entry.title;
      }
      row.append(term, definition);
      list.append(row);
    });
    parent.append(list);
  }

  function addDetailCard(parent, title, entries, fullWidth = false) {
    const card = el("section", `detail-card${fullWidth ? " full-width" : ""}`);
    card.append(el("h3", null, title));
    addKeyValueList(card, entries);
    parent.append(card);
    return card;
  }

  function addPayloadDetails(parent, label, value, metrics) {
    const details = el("details", "payload-details");
    const summary = el("summary", null, `${label} · ${formatNumber(metrics.characters)} chars`);
    const note = el("p", "payload-note", `${formatNumber(metrics.lines)} lines · ${formatNumber(metrics.controlMarkers)} control markers · ${formatNumber(metrics.toolCalls)} tool calls`);
    details.append(summary, note);
    details.addEventListener("toggle", () => {
      if (details.open && !details.querySelector("pre")) {
        details.append(el("pre", "payload", value || "(empty string)"));
      }
    });
    parent.append(details);
  }

  function addOpaqueDetails(parent, label, value) {
    const raw = String(value || "");
    const details = el("details", "opaque-details");
    details.append(el("summary", null, `${label} · ${formatNumber(raw.length)} chars`));
    details.addEventListener("toggle", () => {
      if (details.open && !details.querySelector("pre")) details.append(el("pre", "payload", raw || "(empty string)"));
    });
    parent.append(details);
  }

  function renderModelRecordBody(parent, request, linked) {
    const grid = el("div", "detail-grid");
    const identityEntries = [
      { label: "identifier", value: compactIdentifier(request.identifier), mono: true, title: request.identifier },
      { label: "PCC correlation", value: linked ? "requestId match found" : "no requestId match in this file" },
    ];
    addDetailCard(grid, "Identity", identityEntries);

    const metadataEntries = modelMetadataFields.map(([key, label]) => ({
      label,
      value: key === "model" ? formatModel(request[key]) : key === "useCase" ? formatUseCase(request[key]) : String(request[key] ?? "Not recorded"),
      mono: key === "modelVersion" || key === "clientIdentifier",
      title: String(request[key] ?? ""),
    }));
    addDetailCard(grid, "Request metadata", metadataEntries);

    const promptMetrics = textMetrics(request.prompt);
    const responseMetrics = textMetrics(request.response);
    addDetailCard(grid, "Payload shape", [
      { label: "prompt", value: `${formatNumber(promptMetrics.characters)} chars` },
      { label: "response", value: `${formatNumber(responseMetrics.characters)} chars` },
      { label: "prompt markers", value: `${formatNumber(promptMetrics.turnMarkers)} turns · ${formatNumber(promptMetrics.toolCalls)} tool calls` },
    ]);

    const requestCard = el("section", "detail-card full-width");
    requestCard.append(el("h3", null, "Request excerpt"));
    requestCard.append(el("p", "request-readout", extractRequestText(request.prompt) || "No readable user excerpt found; open the serialized prompt below."));
    requestCard.append(el("p", "payload-note", "This excerpt is taken from the latest readable user segment. The original serialized prompt remains available below."));
    grid.append(requestCard);

    const payloadCard = el("section", "detail-card full-width");
    payloadCard.append(el("h3", null, "Original payloads"));
    payloadCard.append(el("p", "payload-note", "These strings can contain private conversation context and custom control markup. They are kept collapsed and rendered as plain text."));
    addPayloadDetails(payloadCard, "Prompt", String(request.prompt || ""), promptMetrics);
    addPayloadDetails(payloadCard, "Response", String(request.response || ""), responseMetrics);
    grid.append(payloadCard);
    parent.append(grid);
  }

  function renderModelRecords() {
    const analysis = state.analysis;
    clear(dom.modelRecords);
    dom.modelCount.textContent = `${formatNumber(analysis.modelRequests.length)} records`;
    if (!analysis.modelRequests.length) {
      dom.modelRecords.append(el("div", "empty-table", "No model requests were found in this report."));
      return;
    }
    analysis.modelRequests.forEach((request) => {
      const linked = analysis.pccRequests.some((item) => item && item.requestId === request.identifier);
      const record = createRecordShell(
        formatUseCase(request.useCase),
        formatTimestamp(request.timestamp),
        [
          { label: "Model", value: formatModel(request.model), title: request.model },
          { label: "Version", value: request.modelVersion || "Not recorded" },
          { label: "Prompt / response", value: `${formatCompactCount(String(request.prompt || "").length)} / ${formatCompactCount(String(request.response || "").length)}` },
        ],
        { value: linked ? "Linked" : "Standalone", detail: linked ? "PCC requestId match" : "no PCC match" },
        (body) => renderModelRecordBody(body, request, linked),
        requestPreview(request.prompt),
      );
      dom.modelRecords.append(record);
    });
  }

  function prettyPipelineKey(key) {
    const labels = {
      "input-token-count-interval-start-closed": "Input interval start",
      "input-token-count-interval-end-open": "Input interval end",
      "heuristic-input-token-count-interval-start-closed": "Heuristic input start",
      "heuristic-input-token-count-interval-end-open": "Heuristic input end",
      "max-allowed-output-tokens-interval-start-closed": "Output interval start",
      "max-allowed-output-tokens-interval-end-open": "Output interval end",
      "apple-max-tokens": "Apple max tokens",
      "inference-id": "Inference id",
      "workflow-id": "Workflow id",
    };
    return labels[key] || key;
  }

  function pipelineValue(key, value, params) {
    if (value === null || value === undefined) return "Not recorded";
    if (key === "model" || key === "adapter") return formatModel(value);
    if (key === "inference-id" || key === "workflow-id") {
      return value === params.adapter ? "same as adapter" : formatModel(value);
    }
    if (/tokens|token-count/.test(key)) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? formatNumber(numeric) : String(value);
    }
    return String(value);
  }

  function renderNodes(parent, nodes) {
    const card = el("section", "detail-card full-width");
    card.append(el("h3", null, `Nodes · ${formatNumber(nodes.length)}`));
    const list = el("div", "node-list");
    nodes.forEach((node, index) => {
      const row = el("div", "node-row");
      const stateValue = node && Object.prototype.hasOwnProperty.call(node, "nodeState")
        ? (node.nodeState || "Null")
        : "Not recorded";
      const finalizedValue = node && Object.prototype.hasOwnProperty.call(node, "requestExecutionLogFinalized")
        ? (node.requestExecutionLogFinalized === true ? "true" : String(node.requestExecutionLogFinalized))
        : "Not recorded";
      row.append(
        el("span", null, `Node ${index + 1}`),
        el("span", `status-badge ${stateValue === "Validated" ? "good" : "neutral"}`, stateValue),
        el("span", null, `Log finalized · ${finalizedValue}`),
        el("span", null, node && node.proxiedBy ? `proxied by ${compactIdentifier(node.proxiedBy)}` : (node && node.node ? compactIdentifier(node.node) : "opaque id unavailable")),
      );
      list.append(row);
      if (node && (node.node || node.proxiedBy || node.attestationBundle)) {
        const opaque = el("div", "opaque-value");
        if (node.node) addOpaqueDetails(opaque, `Node ${index + 1} id`, node.node);
        if (node.proxiedBy) addOpaqueDetails(opaque, `Node ${index + 1} proxiedBy`, node.proxiedBy);
        if (node.attestationBundle) addOpaqueDetails(opaque, `Node ${index + 1} attestationBundle`, node.attestationBundle);
        list.append(opaque);
      }
    });
    card.append(list);
    parent.append(card);
  }

  function renderAssets(parent, assets) {
    const card = el("section", "detail-card full-width");
    card.append(el("h3", null, `Assets · ${formatNumber(assets.length)}`));
    const list = el("div", "asset-list");
    assets.forEach((asset) => {
      const row = el("div", "asset-row");
      row.append(
        el("span", null, asset.applicationId || "Not recorded"),
        el("span", null, asset.assetId || "Not recorded"),
        el("span", null, asset.assetVersion || "Not recorded"),
        el("span", null, asset.assetHash ? `hash ${compactIdentifier(asset.assetHash)}` : "hash not recorded"),
      );
      list.append(row);
      if (asset.assetHash) {
        const opaque = el("div", "opaque-value");
        addOpaqueDetails(opaque, "assetHash", asset.assetHash);
        list.append(opaque);
      }
    });
    if (!assets.length) list.append(el("div", "empty-table", "No assets were recorded."));
    card.append(list);
    parent.append(card);
  }

  function renderPccRecordBody(parent, request, params) {
    const grid = el("div", "detail-grid");
    const requestEntries = [
      { label: "requestId", value: compactIdentifier(request.requestId), mono: true, title: request.requestId },
      { label: "pipelineKind", value: request.pipelineKind || "Not recorded", mono: true },
      { label: "timestamp", value: formatTimestamp(request.timestamp) },
    ];
    addDetailCard(grid, "Request metadata", requestEntries);

    if (params) {
      const entries = pipelineFieldOrder
        .filter((key) => Object.prototype.hasOwnProperty.call(params, key))
        .map((key) => ({
          label: prettyPipelineKey(key),
          value: pipelineValue(key, params[key], params),
          mono: key !== "model" && key !== "adapter",
          title: String(params[key]),
        }));
      addDetailCard(grid, "Decoded pipelineParameters", entries, true);
    } else {
      addDetailCard(grid, "Decoded pipelineParameters", [{ label: "status", value: "Could not decode nested JSON" }], true);
    }

    renderNodes(grid, Array.isArray(request.nodes) ? request.nodes : []);
    renderAssets(grid, Array.isArray(request.assets) ? request.assets : []);
    parent.append(grid);
  }

  function summarizePccNodes(nodes) {
    const source = Array.isArray(nodes) ? nodes : [];
    return {
      total: source.length,
      validated: source.filter((node) => node && node.nodeState === "Validated").length,
      proxied: source.filter((node) => node && node.proxiedBy).length,
    };
  }

  function renderPccRecords() {
    const analysis = state.analysis;
    clear(dom.pccRecords);
    dom.pccCount.textContent = `${formatNumber(analysis.pccRequests.length)} records`;
    if (!analysis.pccRequests.length) {
      dom.pccRecords.append(el("div", "empty-table", "No Private Cloud Compute requests were found in this report."));
      return;
    }
    analysis.pccRequests.forEach((request) => {
      const params = parsePipelineParameters(request);
      const nodes = summarizePccNodes(request.nodes);
      const model = params && params.model ? formatModel(params.model) : "Unknown pipeline";
      const adapter = params && params.adapter ? formatModel(params.adapter) : "No adapter";
      const linked = analysis.modelIds.has(request.requestId);
      const record = createRecordShell(
        request.pipelineKind || "PCC request",
        formatTimestamp(request.timestamp),
        [
          { label: "Model", value: model, title: params && params.model },
          { label: "Adapter", value: adapter, title: params && params.adapter },
          { label: "Nodes", value: `${formatNumber(nodes.total)} total` },
        ],
        { value: linked ? "Linked" : "Technical", detail: linked ? "model identifier match" : "no model match" },
        (body) => renderPccRecordBody(body, request, params),
      );
      dom.pccRecords.append(record);
    });
  }

  function addFlowChip(parent, value, label) {
    const chip = el("div", "flow-chip");
    chip.append(el("strong", "flow-chip-value", value), el("span", "flow-chip-label", label));
    parent.append(chip);
  }

  function renderFlowSummary(analysis) {
    clear(dom.flowSummary);
    addFlowChip(dom.flowSummary, formatNumber(analysis.modelRequests.length), "device requests");
    addFlowChip(dom.flowSummary, formatNumber(analysis.linkedTurns), "handled in the cloud");
    addFlowChip(dom.flowSummary, formatNumber(analysis.cloudOnlyEvents), "cloud-only pipelines");
    addFlowChip(dom.flowSummary, formatNumber(analysis.nodes.length), "node executions");
    addFlowChip(dom.flowSummary, formatDuration(analysis.duration), "session span");
  }

  function createFlowStage(kind, title) {
    const stage = el("section", `flow-stage k-${kind}`);
    const heading = el("div", "flow-stage-title");
    const dot = el("span", "stage-dot");
    dot.setAttribute("aria-hidden", "true");
    heading.append(dot, el("span", null, title));
    stage.append(heading);
    return stage;
  }

  function addFlowFacts(stage, entries) {
    const facts = el("div", "flow-facts");
    entries.forEach((entry) => {
      const row = el("div", "flow-fact");
      row.append(el("span", "flow-fact-label", entry.label), el("strong", `flow-fact-value${entry.mono ? " mono" : ""}`, entry.value));
      facts.append(row);
    });
    stage.append(facts);
  }

  function addFlowExcerpt(stage, text, emptyText) {
    stage.append(el("p", `flow-excerpt${text ? "" : " is-empty"}`, text || emptyText));
  }

  function addNodeChain(stage, pccRequest) {
    const nodes = Array.isArray(pccRequest && pccRequest.nodes) ? pccRequest.nodes : [];
    if (!nodes.length) return;
    const chain = el("div", "node-chain");
    nodes.forEach((node, index) => {
      if (index) chain.append(el("span", "node-chain-arrow", "→"));
      const stateValue = node && node.nodeState ? String(node.nodeState) : "unknown";
      chain.append(el("span", `node-chip${stateValue === "Validated" ? " good" : ""}`, `Node ${index + 1} · ${stateValue.toLowerCase()}`));
    });
    stage.append(chain);
  }

  function buildDeviceStage(request) {
    const stage = createFlowStage("device", "On-device request");
    addFlowFacts(stage, [
      { label: "Use case", value: formatUseCase(request.useCase) },
      { label: "Model", value: formatModel(request.model) },
      { label: "Identifier", value: compactIdentifier(request.identifier), mono: true },
    ]);
    const excerpt = requestPreview(request.prompt, 170);
    addFlowExcerpt(
      stage,
      excerpt.startsWith("No readable") ? "" : excerpt,
      "No readable user excerpt; the serialized prompt is available in Model requests.",
    );
    return stage;
  }

  function buildCloudStage(request) {
    const params = parsePipelineParameters(request);
    const stage = createFlowStage("cloud", "Private Cloud Compute");
    const facts = [
      { label: "Pipeline", value: request.pipelineKind || "Not recorded" },
      { label: "Model", value: params && params.model ? formatModel(params.model) : "Unknown pipeline" },
      { label: "Adapter", value: params && params.adapter ? formatModel(params.adapter) : "Not recorded" },
      { label: "requestId", value: compactIdentifier(request.requestId), mono: true },
    ];
    if (params && params["input-token-count-interval-start-closed"] !== undefined) {
      facts.push({
        label: "Input tokens",
        value: `${formatNumber(params["input-token-count-interval-start-closed"])}–${formatNumber(params["input-token-count-interval-end-open"])}`,
      });
    }
    if (params && params["apple-max-tokens"] !== undefined && params["apple-max-tokens"] !== null) {
      facts.push({ label: "Max output", value: formatNumber(params["apple-max-tokens"]) });
    }
    addFlowFacts(stage, facts);
    addNodeChain(stage, request);
    return stage;
  }

  function buildResponseStage(request) {
    const stage = createFlowStage("response", "Response returned");
    const raw = String(request.response || "");
    addFlowFacts(stage, [{ label: "Size", value: `${formatCompactCount(raw.length)} chars` }]);
    addFlowExcerpt(stage, responseExcerpt(raw), "The response was empty or unreadable.");
    return stage;
  }

  function responseExcerpt(value, limit = 200) {
    const text = cleanRequestText(value);
    if (!text) return "";
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
  }

  function flowArrow() {
    const arrow = el("div", "flow-arrow");
    arrow.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 10h12m0 0-4.5-4.5M15.5 10 11 14.5" /></svg>';
    return arrow;
  }

  function buildFlowEvent(event, previousTimestamp) {
    const linked = event.kind === "turn" && event.pipelines.length > 0;
    const wrap = el("article", `flow-event kind-${event.kind}${linked ? " is-linked" : ""}`);

    const time = el("div", "flow-time");
    time.append(el("strong", null, formatClock(event.timestamp)));
    if (previousTimestamp !== null) {
      const delta = Math.max(0, Math.round(event.timestamp - previousTimestamp));
      time.append(el("span", `flow-delta${delta >= 30 ? " is-gap" : ""}`, `+${formatDuration(delta)}`));
    }

    const rail = el("div", "flow-rail");
    rail.append(el("span", "flow-dot"));

    const card = el("div", "flow-card");
    const header = el("div", "flow-card-header");
    const request = event.request;
    const title = event.kind === "turn"
      ? formatUseCase(request.useCase)
      : (() => {
          const params = parsePipelineParameters(request);
          return (params && params.model ? formatModel(params.model) : null) || request.pipelineKind || "Cloud pipeline";
        })();
    header.append(el("h3", "flow-card-title", title));
    header.append(el("span", `kind-chip ${linked ? "kind-linked" : event.kind === "turn" ? "kind-device" : "kind-cloud"}`, linked ? "Device → Cloud" : event.kind === "turn" ? "Device only" : "Cloud only"));
    card.append(header);

    const stages = el("div", "flow-stages");
    if (event.kind === "turn") {
      stages.append(buildDeviceStage(request));
      if (linked) {
        stages.append(flowArrow());
        event.pipelines.forEach((pipeline, index) => {
          if (index) stages.append(flowArrow());
          stages.append(buildCloudStage(pipeline));
        });
        stages.append(flowArrow());
      }
      stages.append(buildResponseStage(request));
    } else {
      stages.append(buildCloudStage(request));
    }
    card.append(stages);

    wrap.append(time, rail, card);
    return wrap;
  }

  function renderFlow() {
    const analysis = state.analysis;
    renderFlowSummary(analysis);
    dom.flowCount.textContent = `${formatNumber(analysis.flowEvents.length)} events`;
    clear(dom.flowList);
    if (!analysis.flowEvents.length) {
      dom.flowList.append(el("div", "empty-table", "No timestamped events were found in this report."));
      return;
    }
    let previousTimestamp = null;
    analysis.flowEvents.forEach((event) => {
      dom.flowList.append(buildFlowEvent(event, previousTimestamp));
      previousTimestamp = event.timestamp;
    });
  }

  function setTab(tabName) {
    dom.tabs.forEach((tab) => {
      const active = tab.dataset.tab === tabName;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    dom.tabPanels.forEach((panel) => {
      const active = panel.id === `panel-${tabName}`;
      panel.hidden = !active;
      panel.classList.toggle("is-visible", active);
    });
  }

  function renderWorkspace() {
    const analysis = state.analysis;
    dom.emptyState.hidden = true;
    dom.workspace.hidden = false;
    dom.reportTitle.textContent = state.fileName;
    dom.reportMeta.textContent = `${formatNumber(analysis.modelRequests.length)} model requests · ${formatNumber(analysis.pccRequests.length)} PCC requests · ${formatDateRange(analysis.minTimestamp, analysis.maxTimestamp)}`;
    dom.fileSize.textContent = formatBytes(state.fileSize);
    renderStats();
    renderFlow();
    renderOverview();
    renderSchema();
    renderModelRecords();
    renderPccRecords();
    setTab("flow");
    window.scrollTo(0, 0);
  }

  function openPicker(event) {
    if (event) event.stopPropagation();
    dom.fileInput.click();
  }

  dom.chooseFile.addEventListener("click", openPicker);
  dom.openAnother.addEventListener("click", openPicker);
  dom.fileInput.addEventListener("change", (event) => loadFile(event.target.files && event.target.files[0]));
  dom.dismissError.addEventListener("click", hideError);

  dom.dropzone.addEventListener("click", (event) => {
    if (event.target !== dom.chooseFile) openPicker(event);
  });
  dom.dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker(event);
    }
  });
  dom.dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dom.dropzone.classList.add("is-dragging");
  });
  dom.dropzone.addEventListener("dragleave", () => dom.dropzone.classList.remove("is-dragging"));
  dom.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dom.dropzone.classList.remove("is-dragging");
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    loadFile(file);
  });
  dom.tabs.forEach((tab) => tab.addEventListener("click", () => setTab(tab.dataset.tab)));
})();
