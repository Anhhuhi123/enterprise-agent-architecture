# 00 — AI Agentic Workflow: Toolkit & Kiến trúc tham chiếu

> Tài liệu này là **bản đồ chuẩn bị** trước khi bắt tay xây workflow thật: liệt kê toàn bộ thành phần có thể xuất hiện trong một AI Agentic workflow, map tool cụ thể cho từng layer, và đưa ra stack khuyến nghị cho ngữ cảnh **AI Agentic + Non-tech operator + Hybrid deployment**.
>
> Đọc tài liệu này **một lần** khi bắt đầu dự án mới — sau đó chỉ cần lấy tool từ đây ra dùng, không cần tìm kiếm lại.

---

## 🏗️ Kiến trúc tổng thể

```
[Non-tech UI: Form / Chat / Dashboard]
          ↓  trigger (webhook / schedule / form submit)
┌──────────────────────────────────────────┐
│  n8n  ←  Workflow Orchestrator (visual)  │  self-hosted Docker
│  routing, triggers, human-in-loop        │
└─────────────────┬────────────────────────┘
                  │ khi cần AI phức tạp
                  ↓
┌──────────────────────────────────────────┐
│  AI Agent Service  (Python / FastAPI)    │  self-hosted
│  LangGraph state machine                 │
│  Anthropic Claude API ←────────────────────── cloud API
└──────┬────────────────────┬─────────────┘
       ↓                    ↓
  [Qdrant]             [PostgreSQL]          self-hosted Docker
  vector store         structured data
       ↑
[Document Ingestion Pipeline]
(upload → parse → chunk → embed → store)

[Langfuse]  ←  LLM observability            self-host hoặc cloud
```

**Nguyên tắc thiết kế:**
- n8n xử lý **outer loop** (trigger, routing, notification, human approval).
- LangGraph xử lý **inner loop** (multi-step AI reasoning, tool calls, retry).
- Mỗi layer độc lập → có thể swap từng phần mà không phá tổng thể.
- Security guardrail áp ở **mọi boundary** (input → AI, AI → tool, AI → output).

---

## Layer 0 — TRIGGER / INPUT

Điểm khởi động workflow — _ai/cái gì kích hoạt?_

| Loại trigger | Tool cụ thể |
|---|---|
| **HTTP Webhook** | n8n Webhook node · FastAPI endpoint · Temporal signal |
| **Schedule / Cron** | n8n Cron node · Airflow DAG schedule · Hermes cronjob · APScheduler |
| **Form submission** | n8n Form trigger · Typeform · Google Forms webhook · Tally.so |
| **Email inbound** | Gmail API (watch) · SendGrid Inbound Parse · Postmark inbound |
| **Chat message** | Slack Events API · Teams Bot Framework · Telegram Bot API · Discord bot |
| **File upload** | n8n File trigger · S3 event notification · Google Drive watch |
| **Database change (CDC)** | Debezium · PostgreSQL LISTEN/NOTIFY · Supabase realtime |
| **Event stream** | Apache Kafka · RabbitMQ · Redis Streams · AWS EventBridge |
| **Voice / Speech** | Whisper (OpenAI/local) · Deepgram · AssemblyAI |
| **UI button action** | n8n wait-for-webhook resume · Slack interactive message button |

> Stack khuyến nghị: **n8n Webhook + n8n Cron + n8n Form trigger** — non-tech cấu hình được, không cần code.

---

## Layer 1 — WORKFLOW ORCHESTRATOR

Não điều phối — _ai quyết định thứ tự chạy?_

| Loại | Tool cụ thể | Phù hợp |
|---|---|---|
| **Visual / No-code** | **n8n** · Make (Integromat) · Zapier | Non-tech operator, business process |
| **AI state machine** | **LangGraph** · LlamaIndex Workflows | Complex agentic flow, có nhánh điều kiện |
| **Code-based DAG** | Apache Airflow · Prefect · Dagster | Data engineer, ML pipeline |
| **Durable / long-running** | **Temporal** · AWS Step Functions | Workflow chạy ngày/tuần, cần resume sau lỗi |
| **Multi-agent conversation** | AutoGen · CrewAI | Nhiều agent bàn luận để ra quyết định |
| **Kubernetes-native** | Argo Workflows · Kubeflow Pipelines | Infra team, container scale |

> Stack khuyến nghị: **n8n** (visual outer loop) + **LangGraph** (AI inner loop).

---

## Layer 2 — LLM / AI BRAIN

Thực thể suy luận — _ai thực sự "nghĩ"?_

### 2a. LLM Provider

| Provider | Model gợi ý | Dùng cho |
|---|---|---|
| **Anthropic** | claude-sonnet-4-6 · claude-haiku-4-5 | Reasoning phức tạp · batch rẻ |
| **OpenAI** | GPT-4o · GPT-4o-mini | Vision · function calling |
| **Google** | Gemini 2.0 Flash · Gemini 1.5 Pro | Multimodal · long context rẻ |
| **Meta / Local** | LLaMA 3.3 70B via Ollama · llama.cpp | On-prem, không ra internet |
| **Mistral** | Mistral Large · Codestral | Code-heavy task |
| **DeepSeek** | DeepSeek-V3 · R1 | Reasoning, rẻ |

> Stack khuyến nghị: **claude-sonnet-4-6** (reasoning) + **claude-haiku-4-5** (batch/simple). Bắt buộc bật **prompt caching** cho system prompt > 1024 token (xem skill `claude-api`).

### 2b. Agent Framework

| Framework | Đặc điểm | Phù hợp |
|---|---|---|
| **LangGraph** | State machine, có checkpoint, human-in-loop | Complex multi-step agentic |
| **LangChain** | Tool-use chains, nhiều integration | Prototype nhanh |
| **CrewAI** | Role-based multi-agent (Researcher / Writer / Critic) | Task cần nhiều góc nhìn |
| **AutoGen (Microsoft)** | Conversational multi-agent | Debate / critique loop |
| **Pydantic AI** | Type-safe, lightweight, production-ready | Python agent đơn giản |
| **Smolagents (HuggingFace)** | Code agent: tự viết Python rồi tự chạy | Data analysis tự động |
| **Haystack** | Pipeline-based, NLP-heavy | RAG, document QA |
| **LlamaIndex** | RAG-first, data connectors phong phú | Knowledge base agent |

> Stack khuyến nghị: **LangGraph** cho workflow có nhánh phức tạp. **Pydantic AI** cho agent đơn giản cần production-safe.

---

## Layer 3 — MEMORY

Agent nhớ gì, nhớ ở đâu?

| Loại memory | Tool cụ thể | Đặc điểm |
|---|---|---|
| **Short-term (session)** | In-context messages · Redis (TTL) | Mất sau session |
| **Long-term semantic (RAG)** | **Qdrant** · Weaviate · Chroma · Pinecone | Search bằng meaning (vector) |
| **Long-term structured** | PostgreSQL · SQLite · Supabase | Query exact, relational |
| **Episodic (conversation history)** | **Zep** · Mem0 · PostgreSQL table | Nhớ cuộc hội thoại cũ theo user |
| **Working memory (scratchpad)** | LangGraph state object · Redis hash | Truyền dữ liệu giữa các bước trong run |
| **Shared agent memory** | Redis pub/sub · PostgreSQL shared table | Nhiều agent dùng chung một state |

> Stack khuyến nghị: **Redis** (session, TTL 24h) + **Qdrant** (long-term semantic).

---

## Layer 4 — RAG / KNOWLEDGE PIPELINE

Xử lý tài liệu → đưa vào agent có thể tìm kiếm.

```
Ingest                   Process                  Store          Retrieve
──────────────────────────────────────────────────────────────────────────
File upload (PDF/DOCX)   Parse: PyMuPDF           Qdrant         Similarity search
Web crawl (Firecrawl)    Chunk: RecursiveChar      Weaviate       Hybrid (vector+BM25)
Google Drive watch        TextSplitter (500tok)    pgvector       MMR (diversity)
DB snapshot              Embed: text-embed-3-small Chroma         Re-ranking (Cohere)
                          hoặc BGE M3 (local)      Pinecone       Contextual compress
```

### Parser / Converter

| Tool | Dùng cho |
|---|---|
| **MarkItDown** (Microsoft) | Convert PDF/DOCX/XLSX/PPTX/HTML → Markdown |
| **PyMuPDF** | PDF extract text, table, image |
| **marker** | PDF scan/phức tạp → markdown chất lượng cao |
| **Unstructured.io** | Tổng hợp nhiều định dạng, cloud hoặc local |
| **Docling** (IBM) | PDF/DOCX với table structure |
| **LlamaParse** | Cloud, chất lượng cao, trả phí |
| **Tesseract / PaddleOCR** | OCR ảnh scan |

### Chunking

| Tool | Ghi chú |
|---|---|
| **LangChain RecursiveCharacterTextSplitter** | Mặc định, tốt cho hầu hết văn bản |
| **LlamaIndex SentenceSplitter** | Giữ nguyên câu, tốt cho QA |
| **Semantic chunking** (embedding-based) | Chunk theo ý nghĩa, không theo ký tự |

### Embedding Model

| Model | Loại | Ghi chú |
|---|---|---|
| `text-embedding-3-small` | Cloud (OpenAI) | Cân bằng giá/chất lượng |
| `text-embedding-3-large` | Cloud (OpenAI) | Chất lượng cao hơn, đắt hơn |
| `BGE-M3` | Local (HuggingFace) | Đa ngôn ngữ, tốt cho tiếng Việt |
| `E5-large` | Local | Tốt cho retrieval |

> Stack khuyến nghị: **MarkItDown** → **RecursiveCharacterTextSplitter** → **text-embedding-3-small** → **Qdrant**.

---

## Layer 5 — TOOLS / ACTIONS

Những gì agent **có thể làm** với thế giới bên ngoài.

### 5a. Search & Web

| Nhóm | Tool cụ thể |
|---|---|
| **Web search** | Tavily API · Serper API · Brave Search · Exa · DuckDuckGo (free) |
| **Web scraping** | Playwright · Puppeteer · Firecrawl · Jina Reader · BeautifulSoup |
| **Academic search** | Arxiv API · Semantic Scholar · PubMed |
| **News** | NewsAPI · GDELT · RSS parser |

> Khuyến nghị: **Tavily** (AI-optimized, clean output) + **Playwright** (browser thật khi cần login).

### 5b. Code Execution

| Tool | Loại | Ghi chú |
|---|---|---|
| **E2B** | Cloud sandbox | Safe, isolate, hỗ trợ nhiều ngôn ngữ |
| **Modal** | Cloud serverless | Scale nhanh, Python-first |
| **Daytona** | Self-hosted sandbox | On-prem code execution |
| **Jupyter kernel** | Local | Via nbformat, cần guardrail |
| **smolagents CodeAgent** | Agent tự viết + chạy Python | Cần sandbox bao bọc bên ngoài |

> ⚠️ Không cho agent chạy code trực tiếp qua `subprocess` không có sandbox — xem guardrail ở Layer 8.

### 5c. File & Document

| Nhóm | Tool cụ thể |
|---|---|
| **PDF** | PyMuPDF · pdfplumber · marker · LlamaParse |
| **Office** | MarkItDown · python-docx · openpyxl · pandas |
| **OCR** | Tesseract · PaddleOCR · Google Vision API · Azure Form Recognizer |
| **File storage** | Local FS · Google Drive API · OneDrive · S3 / MinIO · Dropbox |
| **Convert → Markdown** | MarkItDown · Pandoc · marker |

### 5d. Database

| Loại | Tool cụ thể |
|---|---|
| **SQL** | PostgreSQL (psycopg2/asyncpg) · MySQL · SQLite · Supabase |
| **NoSQL** | MongoDB · Redis · DynamoDB |
| **Analytics / OLAP** | DuckDB · BigQuery · ClickHouse |
| **ORM** | SQLAlchemy · Prisma · Tortoise ORM |

### 5e. Communication & Notification

| Kênh | Tool cụ thể |
|---|---|
| **Slack** | Slack SDK · Slack Bolt · n8n Slack node |
| **Email** | Gmail API · SendGrid · Resend · SMTP (smtplib) |
| **Teams** | MS Teams Bot Framework · n8n Teams node |
| **Telegram** | python-telegram-bot · Telegraf |
| **SMS** | Twilio · Vonage |
| **Push notification** | Firebase FCM · OneSignal |

### 5f. Calendar & Productivity

| Tool | Cụ thể |
|---|---|
| **Calendar** | Google Calendar API · Microsoft Graph (Outlook Calendar) |
| **Task / Project** | Linear API · Jira API · Asana API · Notion API |
| **Spreadsheet** | Google Sheets API · Excel (Office 365 API) · Airtable API |
| **Docs** | Google Docs API · Notion API · Confluence API |

### 5g. Image & Media

| Nhóm | Tool cụ thể |
|---|---|
| **Generate image** | DALL-E 3 · Stable Diffusion (local) · Flux · Midjourney API |
| **Analyze image** | Claude Vision · GPT-4o Vision · Google Vision API |
| **Speech → Text** | Whisper (local/OpenAI) · Deepgram · AssemblyAI |
| **Text → Speech** | ElevenLabs · OpenAI TTS · Coqui TTS (local) |
| **Video** | FFmpeg · MoviePy · Runway API |

### 5h. External APIs & Business Systems

| Nhóm | Tool cụ thể |
|---|---|
| **CRM** | HubSpot API · Salesforce API · Zoho CRM |
| **Payment** | Stripe API · PayPal API · VNPay |
| **Maps / Geo** | Google Maps API · OSRM · OpenStreetMap Nominatim |
| **HR / Payroll** | BambooHR · Workday API |
| **ERP** | SAP API · Odoo API |

### 5i. DevOps & Infrastructure

| Tool | Cụ thể |
|---|---|
| **Git** | GitHub API (PyGithub) · GitLab API · `gh` CLI |
| **CI/CD trigger** | GitHub Actions API · Jenkins API |
| **Container** | Docker SDK (Python) · Kubernetes Python client |
| **Cloud** | AWS SDK (boto3) · GCP client libs · Azure SDK |

---

## Layer 6 — HUMAN IN THE LOOP

Agent dừng lại, chờ người duyệt trước khi tiếp tục.

| Cơ chế | Tool cụ thể | Cách hoạt động |
|---|---|---|
| **Slack approval** | Slack interactive message | Agent gửi tin + 2 nút Approve/Reject → webhook resume n8n |
| **Email approval** | SendGrid + token link | Agent gửi email link có token → click → resume |
| **Form approval** | n8n wait node + Form trigger | Agent tạm dừng → non-tech điền form → workflow tiếp tục |
| **Dashboard review** | Retool · Appsmith · custom Next.js | Non-tech review batch, approve/reject nhiều items |
| **Interrupt trong agent** | LangGraph `interrupt()` | Dừng giữa step, serialize state, resume sau |
| **Durable human task** | Temporal human task activity | Workflow suspend indefinitely, wake khi có response |

> Khuyến nghị: **Slack button + n8n wait node** — không cần build UI riêng, non-tech quen Slack.

---

## Layer 7 — GUARDRAILS / SECURITY

Tham chiếu chi tiết: [05-security-guardrails.md](./05-security-guardrails.md)

| Mục đích | Tool cụ thể |
|---|---|
| **PII detection & redact** | Microsoft Presidio · Guardrails AI · custom `pii-guard.ps1` (đã có) |
| **Output filter / toxic** | Guardrails AI validators · Llama Guard · NeMo Guardrails (NVIDIA) |
| **Dangerous command block** | `block-dangerous.py` + `dcg.exe` (đã có) |
| **Rate limiting** | FastAPI `slowapi` · Kong gateway · nginx `limit_req` |
| **Auth & AuthZ** | Keycloak (self-hosted) · JWT (FastAPI) · Clerk · Supabase Auth |
| **Secrets management** | HashiCorp Vault · Doppler · Docker secrets / `.env` |
| **Input schema validation** | Pydantic v2 · Zod (TypeScript) |

**Thứ tự áp guardrail:**
```
User input → [PII check] → Agent → [Tool permission check] → Tool
                                 → [Output filter] → Response
```

---

## Layer 8 — OBSERVABILITY

Hiểu chuyện gì đang xảy ra bên trong agent.

| Mục đích | Tool cụ thể |
|---|---|
| **LLM call tracing** | **Langfuse** (open-source) · LangSmith · Arize Phoenix · Helicone |
| **App metrics** | Prometheus + Grafana · Datadog · New Relic |
| **Log aggregation** | Loki + Grafana · ELK Stack · Axiom |
| **Error tracking** | Sentry · Bugsnag |
| **Cost tracking** | Langfuse cost tab · Helicone cost dashboard |
| **Distributed tracing** | OpenTelemetry → Jaeger / Grafana Tempo |

```python
# Tích hợp Langfuse vào agent — 2 dòng
from langfuse.anthropic import anthropic  # drop-in replacement

@observe()
def agent_step(prompt: str):
    return anthropic.messages.create(...)
```

> Khuyến nghị: **Langfuse self-hosted** — open-source, đủ dùng, non-tech có dashboard xem cost/latency.


---

## 📦 Stack khuyến nghị (AI Agentic + Non-tech + Hybrid)

| Layer | Chọn | Lý do |
|---|---|---|
| **Trigger** | n8n (webhook / form / cron) | Visual, non-tech cấu hình được |
| **Orchestrator** | n8n outer + LangGraph inner | Visual routing + AI state machine |
| **LLM** | Claude Sonnet + Haiku | Reasoning mạnh + batch rẻ (caching) |
| **Agent framework** | LangGraph + Pydantic AI | Typed, debuggable, production-safe |
| **Memory short-term** | Redis (TTL 24h) | Session state nhanh |
| **Memory long-term** | Qdrant | Vector search, self-hosted |
| **RAG pipeline** | MarkItDown → RecursiveChunk → text-embedding-3-small → Qdrant | Chuẩn, dễ maintain |
| **Web search** | Tavily | AI-optimized, clean output |
| **Browser** | Playwright (MCP) | Đã có sẵn (xem 04) |
| **Code execution** | E2B | Safe sandbox |
| **File processing** | MarkItDown + Drive API | Convert bất kỳ → markdown |
| **Database** | PostgreSQL | Audit log, config, state |
| **Notification** | Slack + Email (SendGrid) | Phổ biến trong công ty |
| **Human in loop** | Slack button + n8n wait | Không cần build UI riêng |
| **Guardrails** | Presidio + custom hooks (05) | PII + dangerous command |
| **Observability** | Langfuse (self-hosted) | Open-source, dashboard đủ dùng |
| **Auth** | Keycloak / JWT FastAPI | Self-hosted, enterprise |

---

## 🗂️ Thứ tự xây dựng toolset (trước khi vào workflow thật)

```
Phase 0 — Hạ tầng (1–2 ngày)
├── docker-compose.yml: n8n + Qdrant + PostgreSQL + Redis + Langfuse
├── .env template: API keys, DB credentials, secrets
└── Health check script: verify tất cả service lên đúng

Phase 1 — AI Agent Service skeleton (2–3 ngày)
├── FastAPI app: /health · /agent/run · /ingest
├── Anthropic SDK + prompt caching + Langfuse integration
├── LangGraph state machine template (reusable)
└── Unit test từng node trong graph

Phase 2 — Document Ingestion Pipeline (1–2 ngày)
├── /ingest endpoint: parse → chunk → embed → Qdrant
├── Hỗ trợ: PDF, DOCX, XLSX, URL
└── Smoke test với tài liệu công ty (đã redact PII)

Phase 3 — n8n setup + Templates (1–2 ngày)
├── n8n self-hosted, cấu hình webhook domain + basic auth
├── Template 1: "Trigger → AI Agent → Notify Slack/Email"
├── Template 2: "File upload → Ingest → Confirm"
├── Template 3: "Schedule → AI summarize → Report"
└── UAT với non-tech user (BA/PM thao tác thử)

Phase 4 — Security + Observability (1 ngày)
├── Guardrails từ 05 → áp vào Agent Service (PII + dangerous cmd)
├── Rate limiting trên FastAPI
├── Langfuse dashboard: cost, latency, error rate
└── Auth cho n8n UI và Agent Service
```

---

## 🔁 Tái sử dụng khi vào workflow mới

Mỗi workflow mới chỉ cần:

| Cần | Tool có sẵn | Việc làm thêm |
|---|---|---|
| Trigger mới (form/email/API) | n8n node | Thêm 1 trigger node |
| Logic AI mới | LangGraph template | Thêm/sửa node trong graph |
| Tài liệu mới cần RAG | Qdrant + /ingest | Upload file, gọi `/ingest` |
| Thông báo đầu ra | n8n (Slack/Email/Webhook) | Thêm 1 output node |
| Human approval | n8n wait + Slack | Thêm wait node + Slack message |
| Monitor | Langfuse | Tự động, không cần cấu hình thêm |

