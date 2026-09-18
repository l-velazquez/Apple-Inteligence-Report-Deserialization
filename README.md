# Apple Intelligence Report Explorer

A static, local-only viewer for Apple Intelligence JSON reports. Open the page, choose a report, and the browser parses it in memory. The app has no upload endpoint and makes no network request to process a file, so it can be published as a GitHub Pages site.

The public landing page includes crawlable metadata, Open Graph/Twitter cards, Schema.org structured data, a sitemap, and a short `llms.txt` guide for AI agents. These describe the tool without exposing the contents of any selected report. The SEO URLs assume the repository is published at `https://l-velazquez.github.io/Apple-Inteligence-Report-Deserialization/`; update the absolute URLs in `index.html`, `robots.txt`, `sitemap.xml`, and `llms.txt` if the deployment URL changes.

## Current report shape

The included export has two top-level arrays:

| Collection | Records | Purpose |
| --- | ---: | --- |
| `modelRequests` | 23 | Model activity and text payloads |
| `privateCloudComputeRequests` | 18 | Private Cloud Compute pipeline and node records |

The clean extraction should center on:

- `timestamp`, `identifier` / `requestId`, `model`, `modelVersion`, `useCase`, `clientIdentifier`, and `executionEnvironment`
- decoded `pipelineParameters`: `model`, `adapter`, input-token interval, output-token interval, and optional maximum-token fields
- node counts, `nodeState`, and `requestExecutionLogFinalized`
- asset application, ID, and version

Keep `prompt` and `response` available but collapsed because they contain private conversation context and custom control markup. Treat `attestationBundle`, `node`, `proxiedBy`, and `assetHash` as opaque technical values; they are useful for forensic inspection but add noise to the default view.

The default **Session flow** view is the starting point for understanding a report. It includes an aggregate device → PCC → result route map, chronological event cards, request-ID correlation notes, and filters for connected journeys, device-only records, and cloud-only records.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` and select a JSON report.

For a terminal-only schema pass, use the companion analyzer:

```bash
python3 analyze_report.py Apple_Intelligence_Report.json
```

Add `--json` when another tool needs the schema summary as JSON.

The report file is intentionally ignored by Git so it is not accidentally published with the site.
