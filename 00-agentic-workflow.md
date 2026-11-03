# 00 — AI Agentic Workflow: Toolkit, Patterns & Kiến trúc tham chiếu

> Tài liệu này là **bản đồ chuẩn bị** trước khi xây workflow thật: các layer cần có trong một AI Agentic workflow, tool cho từng layer, **bộ workflow patterns tái sử dụng**, và stack chuẩn cho ngữ cảnh **Agentic AI + Non-tech operator + Hybrid deployment**, ưu tiên **n8n** cho orchestration và integration.
>
> Đọc **một lần** khi bắt đầu dự án mới, sau đó lấy pattern và tool từ đây ra dùng.
>
> Liên quan: [AI Engineer Roadmap](roadmap-ai.html) · [FDE Engagement Roadmap](roadmap-fde.html) · [Capability Matrix](capability-agentic-fde.md)

---

## 🎯 Tài liệu này phục vụ 3 mục tiêu

| # | Mục tiêu | Đầu ra cụ thể | Phần liên quan |
|---|---|---|---|
| 1 | **Agentic AI — Reusable Agent Skills** | Thư viện skill dùng chung: tool calling, context & memory, routing, guardrails, evaluation, error handling; chuẩn thiết kế + chuẩn đánh giá Agent | [Agent Skills Library](#-agent-skills-library-mục-tiêu-1) |
| 2 | **Agentic Workflow Engineering — Reusable Workflow Framework** | Stack tiêu chuẩn + bộ workflow patterns (n8n + Agent Service), chuẩn state, error handling, observability, HITL | [Layers](#layer-0--trigger--channel), [Workflow Patterns](#-workflow-patterns-mục-tiêu-2), [Chuẩn n8n](#-chuẩn-n8n) |
| 3 | **FDE — Apply to Godine** | PoC end-to-end tích hợp đa kênh + xử lý hội thoại; số đo độ tin cậy, khả năng mở rộng, chi phí vận hành | [Godine PoC](#-fde--godine-poc-mục-tiêu-3) |

Thứ tự là **1 → 2 → 3**: skill và pattern phải được build và test trên bài toán mẫu trước, Godine là nơi áp dụng, không phải nơi thử nghiệm lần đầu.

---

## 🏗️ Kiến trúc tổng thể

```
[Channels: Zalo OA · Messenger · Website chat · WhatsApp · Email · Form]
          ↓  webhook (mỗi kênh một adapter)
┌──────────────────────────────────────────────────────┐
│  n8n — Workflow Orchestrator (outer loop)            │  self-hosted, queue mode
│  channel adapter → normalize → dedup/debounce        │
│  routing · gọi Agent · gửi reply · HITL · alert      │
└───────────────┬──────────────────────────────────────┘
                │ HTTP (contract chuẩn, xem bên dưới)
                ↓
┌──────────────────────────────────────────────────────┐
│  AI Agent Service (Python / FastAPI) — inner loop    │  self-hosted
│  LangGraph state machine + Agent Skills Library      │
│  LiteLLM gateway → Claude / OpenAI / local ────────────── cloud API
│  Tools: MCP / OpenAPI → hệ thống của khách           │
└──────┬─────────────────────┬─────────────────────────┘
       ↓                     ↓
 [PostgreSQL + pgvector]   [Redis]                       self-hosted
 conversation, state,      session, lock, dedup,
 checkpoint, audit, RAG    debounce, n8n queue
       ↑
[Ingestion Pipeline: upload → Docling → chunk → embed → pgvector]

[Langfuse] ← trace + cost + eval dataset     [Chatwoot / Slack] ← human handoff & approval
```

**Nguyên tắc thiết kế:**
- **n8n = outer loop**: trigger, kết nối kênh, routing, notification, human approval, retry/alert. Non-tech đọc và chỉnh được.
- **LangGraph = inner loop**: suy luận nhiều bước, tool call, memory, guardrail. Có test, có version, do dev quản lý.
- **Một contract duy nhất** giữa n8n và Agent Service → đổi kênh hoặc đổi agent không ảnh hưởng phía còn lại.
- Mỗi layer độc lập → swap từng phần mà không phá tổng thể.
- Guardrail áp ở **mọi boundary**: input → AI, AI → tool, AI → output.
- Mọi run có **một trace_id** xuyên suốt n8n execution → Agent Service → Langfuse.

### Khi nào dùng n8n AI Agent node, khi nào gọi Agent Service?

| Tình huống | Dùng | Lý do |
|---|---|---|
| 1 LLM call: phân loại, tóm tắt, trích xuất có schema | **n8n** (Basic LLM Chain / AI Agent node) | Nhanh, non-tech tự sửa prompt |
| Agent ≤ 3 tool, không cần memory dài, không cần eval nghiêm | **n8n AI Agent node** | Đủ dùng cho PoC nội bộ |
| Nhiều bước, nhánh điều kiện, HITL giữa chừng, resume sau lỗi | **Agent Service (LangGraph)** | Checkpoint, test được từng node |
| Cần benchmark / eval gate, multi-tenant, tool có side-effect | **Agent Service** | Kiểm soát version, guardrail, quyền |
| Hội thoại khách hàng production (như Godine) | **Agent Service**, n8n lo kênh | Chất lượng phải đo và chặn release được |

### Contract n8n ↔ Agent Service

```json
POST /agent/run
{
  "trace_id": "n8n-exec-12345",
  "tenant_id": "godine",
  "channel": "zalo",
  "conversation_id": "conv_8f2a",
  "user": { "id": "u_123", "channel_user_id": "zalo:987" },
  "messages": [{ "role": "user", "text": "Còn bàn tối nay 7h không?", "ts": "2026-10-23T10:00:00Z" }],
  "metadata": { "idempotency_key": "zalo:msg:abc" }
}
→ 200
{
  "reply": [{ "type": "text", "text": "..." }],
  "action": "reply | handoff | need_approval | none",
  "state": { "intent": "booking", "slots": { "time": "19:00" } },
  "usage": { "input_tokens": 1200, "output_tokens": 180, "cost_usd": 0.004 }
}
```

---

## Layer 0 — TRIGGER / CHANNEL

Điểm khởi động workflow — _cái gì kích hoạt?_

| Loại trigger | Tool cụ thể |
|---|---|
| **HTTP Webhook** | n8n Webhook node · FastAPI endpoint |
| **Chat trên web / app** | n8n Chat Trigger · Chatwoot widget · custom widget |
| **Kênh hội thoại** | Zalo OA API · Meta Messenger / Instagram (Graph API) · WhatsApp Business Cloud API · Telegram Bot API |
| **Omnichannel inbox** | **Chatwoot** (open-source: website, Messenger, Instagram, WhatsApp, Telegram, email, API channel) |
| **Schedule / Cron** | n8n Schedule Trigger · APScheduler · Celery beat |
| **Form submission** | n8n Form Trigger · Google Forms · Tally |
| **Email inbound** | n8n Email (IMAP) Trigger · Gmail API watch · SendGrid Inbound Parse |
| **Nội bộ** | Slack Events API · Teams Bot Framework |
| **File upload** | Google Drive watch · S3 / MinIO event |
| **Database change** | PostgreSQL LISTEN/NOTIFY · Debezium · Supabase realtime |
| **Event stream** | RabbitMQ · Redis Streams · Kafka |
| **Voice** | Whisper (local) · Deepgram · AssemblyAI |

**Quy tắc cho kênh hội thoại:**
- Mỗi kênh một **adapter sub-workflow**: verify chữ ký webhook → map payload về schema chung `{channel, channel_user_id, message_id, text, attachments, ts}`.
- **Dedup** theo `channel + message_id` (Redis `SET NX`, TTL 24h): nền tảng có thể gửi lại webhook.
- **Debounce** 2–4 giây: khách hay gửi nhiều tin liên tiếp, gom lại rồi mới gọi agent một lần.
- Trả `200` cho webhook ngay, xử lý bất đồng bộ: nhiều nền tảng timeout và retry nếu phản hồi chậm.
- Tôn trọng giới hạn của từng nền tảng (cửa sổ trả lời, template message, rate limit): kiểm tra tài liệu kênh trước khi thiết kế.

> Stack khuyến nghị: **n8n Webhook** cho từng kênh + **Chatwoot** khi cần inbox chung và chuyển cho nhân viên.

---

## Layer 1 — WORKFLOW ORCHESTRATOR

Não điều phối — _ai quyết định thứ tự chạy?_

| Loại | Tool cụ thể | Phù hợp |
|---|---|---|
| **Visual / Low-code** | **n8n** · Make · Zapier | Integration, business process, non-tech vận hành |
| **AI state machine** | **LangGraph** · LlamaIndex Workflows | Agentic flow có nhánh, checkpoint, HITL |
| **Durable / long-running** | Temporal · AWS Step Functions | Workflow chạy ngày/tuần, cần exactly-once |
| **Code-based DAG** | Airflow · Prefect · Dagster | Data / ML pipeline |
| **Multi-agent** | LangGraph supervisor · CrewAI · AutoGen | Nhiều agent chia việc |

> Stack khuyến nghị: **n8n** (outer loop) + **LangGraph** (inner loop). Chỉ cân nhắc Temporal khi workflow kéo dài nhiều ngày và n8n Wait node không đủ tin cậy.

---

## Layer 2 — LLM / AI BRAIN

### 2a. LLM Provider (qua LiteLLM gateway)

| Provider | Model gợi ý | Dùng cho |
|---|---|---|
| **Anthropic** | `claude-sonnet-5-5` · `claude-haiku-5-5` · `claude-opus-5-5` | Reasoning + tool use · tác vụ nhanh, rẻ · bài khó |
| **OpenAI** | GPT (bản mới nhất) · bản mini | Mặc định của AI Roadmap, function calling |
| **Google** | Gemini Pro / Flash | Multimodal, long context rẻ |
| **Local** | Qwen / Llama qua Ollama hoặc vLLM | On-prem, dữ liệu không ra ngoài |

- **Luôn gọi qua LiteLLM**: đổi model bằng config, có fallback khi provider lỗi, gom cost về một chỗ.
- **Model routing**: model nhỏ cho phân loại intent / trích xuất slot, model lớn cho trả lời phức tạp.
- Bật **prompt caching** cho system prompt + tool definitions dài: giảm cost và latency đáng kể với hội thoại nhiều lượt.
- Chọn model bằng benchmark (xem [Layer 9](#layer-9--observability--evaluation)), không chọn theo cảm tính.

### 2b. Agent Framework

| Framework | Đặc điểm | Phù hợp |
|---|---|---|
| **LangGraph** | State machine, checkpoint, `interrupt()` cho HITL | Agent production nhiều bước |
| **Pydantic AI** | Type-safe, gọn | Agent đơn giản, structured output |
| **LlamaIndex** | RAG-first, nhiều connector | Knowledge agent |
| **n8n AI Agent node** | Visual, dựa trên LangChain | PoC nhanh, agent ít tool |
| **CrewAI / AutoGen** | Role-based / hội thoại multi-agent | Thử nghiệm, ít dùng cho production |

> Stack khuyến nghị: **LangGraph** cho Agent Service, **Pydantic** cho mọi schema input/output/tool.

---

## Layer 3 — STATE & MEMORY

Tách rõ **workflow state** (workflow đang ở bước nào) và **agent memory** (agent nhớ gì về khách).

| Loại | Tool | Ghi chú |
|---|---|---|
| **Workflow execution state** | n8n execution DB (PostgreSQL) | Do n8n quản lý, không dùng làm nguồn dữ liệu nghiệp vụ |
| **Conversation state** | PostgreSQL: `conversation`, `message`, `channel_identity` | Nguồn sự thật của hội thoại, mọi kênh |
| **Agent run state / checkpoint** | LangGraph Postgres checkpointer | Resume sau crash hoặc sau bước approve |
| **Short-term (session)** | LangGraph state · Redis (TTL) | N tin gần nhất + tóm tắt hội thoại |
| **Long-term theo user** | Mem0 · bảng `user_profile` / `user_memory` | Sở thích, lịch sử; có TTL và read/write policy |
| **Lock / dedup / debounce** | Redis | Một conversation chỉ có một run tại một thời điểm |
| **Long-term semantic (RAG)** | PostgreSQL + **pgvector** | Cùng DB, ít hạ tầng hơn; Qdrant khi vượt vài triệu vector |

**Quy tắc:**
- **Cách ly theo tenant / user** ở mọi bảng và mọi query (`tenant_id` bắt buộc).
- **Liên kết danh tính đa kênh**: một khách có thể nhắn từ Zalo và Messenger → bảng `channel_identity` map về một `customer_id` (chỉ merge khi có bằng chứng, ví dụ số điện thoại đã xác minh).
- **Context budget**: giữ N tin gần nhất + bản tóm tắt; cắt gọn tool result trước khi đưa vào context.

> Stack khuyến nghị: **PostgreSQL (+pgvector) + Redis** cho tất cả; thêm Mem0 khi cần memory dài hạn theo user.

---

## Layer 4 — RAG / KNOWLEDGE PIPELINE

```
Ingest                  Process                     Store              Retrieve
─────────────────────────────────────────────────────────────────────────────────
File upload (PDF/DOCX)  Parse: Docling / MarkItDown  PostgreSQL         Hybrid: vector + FTS
Google Drive watch      Chunk: theo heading/câu      + pgvector         Rerank: BGE Reranker
Web crawl (Firecrawl)   Embed: text-embedding-3-     (Qdrant khi        Filter: tenant + ACL
DB / API snapshot         small hoặc BGE-M3 (local)    scale lớn)        Citation trong câu trả lời
```

| Bước | Tool | Ghi chú |
|---|---|---|
| **Parse** | **Docling** · MarkItDown · marker · PaddleOCR | Docling giữ cấu trúc bảng; OCR cho ảnh scan |
| **Chunk** | LlamaIndex SentenceSplitter · chunk theo heading | 300–800 token, giữ metadata nguồn |
| **Embed** | `text-embedding-3-small` · **BGE-M3** (local, tốt cho tiếng Việt) | Cố định một model cho một index |
| **Store** | PostgreSQL + pgvector · Qdrant | Index kèm `tenant_id`, `doc_id`, `acl` |
| **Retrieve** | Hybrid (vector + PostgreSQL FTS) + BGE Reranker | Đo recall@k trước và sau mỗi thay đổi |

- **Ingest tăng dần**: hash nội dung, chỉ embed lại phần đổi.
- Dữ liệu thay đổi liên tục (giá, tồn kho, lịch trống) **không đưa vào RAG**: gọi API qua tool để có số liệu thật.

> Stack khuyến nghị: **Docling → chunk theo heading → text-embedding-3-small / BGE-M3 → pgvector → hybrid + rerank** (đồng bộ với AI Roadmap Level 02–04).

---

## Layer 5 — TOOLS / ACTIONS

Những gì agent **có thể làm** với thế giới bên ngoài.

**Chuẩn tool (áp cho mọi tool):**
- Expose qua **MCP server** hoặc **OpenAPI**; argument typed bằng Pydantic; mô tả tool rõ khi nào dùng / không dùng.
- Phân loại **read** và **write**: tool write (đặt chỗ, tạo đơn, gửi tin) phải **idempotent** (idempotency key) và qua HITL hoặc policy cho phép.
- Chạy với **quyền của người dùng / tenant**, secrets không bao giờ nằm trong prompt.
- Trả kết quả gọn, có cấu trúc; lỗi trả về dạng agent hiểu được (`{"error": "slot_unavailable", "suggest": [...]}`), không trả stack trace.
- n8n có thể đóng vai **MCP server** (MCP Server Trigger) để agent gọi các workflow có sẵn làm tool, hoặc **MCP client** để n8n AI Agent node dùng tool bên ngoài.

| Nhóm | Tool cụ thể |
|---|---|
| **Search & Web** | Tavily · Exa · Brave Search · Firecrawl · Jina Reader · Playwright |
| **Code execution** | E2B · Daytona (self-hosted) · Modal — luôn chạy trong sandbox, không `subprocess` trực tiếp |
| **File & Document** | Docling · MarkItDown · PyMuPDF · openpyxl · Google Drive API · S3 / MinIO |
| **Database** | PostgreSQL (asyncpg) · DuckDB · text-to-SQL chỉ đọc, kiểm tra bằng SQLGlot |
| **Communication** | Zalo OA API · Messenger · WhatsApp · Slack · Email (SendGrid / Resend / SMTP) · Twilio SMS |
| **Productivity** | Google Calendar / Sheets · Microsoft Graph · Notion · Jira · Airtable |
| **Business systems** | CRM (HubSpot / Salesforce / Zoho) · POS / booking của khách · ERP (Odoo / SAP) · thanh toán (VNPay / MoMo / Stripe) |
| **Image & Media** | Claude / GPT Vision · Whisper · ElevenLabs · FFmpeg |
| **DevOps** | GitHub API · Docker SDK · AWS SDK (boto3) |

---

## Layer 6 — HUMAN IN THE LOOP

| Cơ chế | Tool | Cách hoạt động |
|---|---|---|
| **Handoff hội thoại** | **Chatwoot** · inbox của khách | Agent gắn nhãn `handoff`, chuyển cuộc hội thoại cho nhân viên, agent ngừng trả lời đến khi được trả lại |
| **Slack / Teams approval** | Slack interactive message | Gửi tin + nút Approve/Reject → webhook resume n8n Wait node |
| **Form approval** | n8n Wait node (On Form Submitted) | Workflow tạm dừng → người duyệt điền form → chạy tiếp |
| **Email approval** | Link có token | Click link → resume workflow |
| **Interrupt trong agent** | LangGraph `interrupt()` | Dừng giữa graph, lưu checkpoint, resume khi có quyết định |
| **Review hàng loạt** | Appsmith · Retool · Langfuse annotation | Duyệt nhiều item, gắn nhãn chất lượng |

**Khi nào bắt buộc HITL / handoff:**
- Tool có side-effect tiền bạc hoặc không hoàn tác được.
- Agent không đủ tự tin (confidence thấp, hỏi lại > 2 lần, ngoài phạm vi).
- Khách phàn nàn, yêu cầu gặp người, chủ đề nhạy cảm.
- Có **timeout**: không ai duyệt trong X phút → nhắc lại hoặc trả lời mặc định an toàn.

> Khuyến nghị: **Chatwoot** cho hội thoại khách hàng, **Slack + n8n Wait node** cho phê duyệt nội bộ.

---

## Layer 7 — GUARDRAILS / SECURITY

| Mục đích | Tool cụ thể |
|---|---|
| **PII detection & redact** | Microsoft Presidio (thêm recognizer cho SĐT / CCCD Việt Nam) |
| **Prompt injection / jailbreak** | Llama Guard · NeMo Guardrails · Guardrails AI · classifier riêng |
| **Output filter** | Pydantic schema · rule nghiệp vụ (không hứa giảm giá, không bịa giá) · grounding check với RAG |
| **Tool permission** | Allowlist tool theo agent + theo tenant; tool write cần approval |
| **Rate limiting** | `slowapi` (FastAPI) · nginx `limit_req` · giới hạn theo user / kênh |
| **Auth** | Keycloak · JWT · n8n webhook Header Auth · verify chữ ký webhook của từng kênh |
| **Secrets** | n8n Credentials · Docker secrets · Vault / Doppler |
| **Compliance** | Audit log, retention, data residency, Nghị định 13/2023 về bảo vệ dữ liệu cá nhân |

**Thứ tự áp guardrail:**
```
User input → [verify kênh + rate limit] → [PII redact + injection check] → Agent
Agent → [tool permission + approval] → Tool
Agent → [schema + business rule + grounding] → Reply → Channel
```

---

## Layer 8 — ERROR HANDLING & RELIABILITY

| Lỗi | Cách xử lý chuẩn |
|---|---|
| **Webhook gửi lặp** | Dedup theo `message_id` (Redis), idempotency key cho mọi tool write |
| **LLM provider lỗi / chậm** | Retry có backoff (tối đa 2–3 lần) → fallback model qua LiteLLM → câu trả lời an toàn + handoff |
| **Tool / API khách lỗi** | Timeout rõ ràng, retry với lỗi tạm thời, không retry lỗi nghiệp vụ; agent báo khách bằng câu tự nhiên |
| **Agent lặp vô hạn** | Max steps, ngân sách token / cost, timeout mỗi run |
| **Output sai schema** | Validate Pydantic → retry 1 lần kèm lỗi → fallback |
| **Workflow fail** | n8n **Error Trigger** workflow chung → ghi bảng `failed_run` (dead-letter) → alert Slack kèm trace_id |
| **Hai run chồng nhau** | Lock theo `conversation_id` (Redis) |
| **Mất kết nối giữa chừng** | LangGraph checkpoint → resume; n8n retry node với `Retry On Fail` |

**Nguyên tắc:** khách **không bao giờ** nhận lỗi kỹ thuật hoặc im lặng. Luôn có câu trả lời dự phòng và đường chuyển cho người.

---

## Layer 9 — OBSERVABILITY & EVALUATION

| Mục đích | Tool cụ thể |
|---|---|
| **LLM / agent tracing** | **Langfuse** (self-hosted) · LangSmith · Arize Phoenix |
| **Workflow log** | n8n Executions · Error Trigger · log stream sang Loki |
| **Metrics & alert** | Prometheus + Grafana · Uptime Kuma |
| **Error tracking** | Sentry |
| **Cost** | Langfuse cost · LiteLLM spend tracking |
| **Evaluation** | **DeepEval** · Langfuse datasets & scores · benchmark nội bộ |

```python
# Trace mọi LLM call qua LiteLLM + Langfuse, gắn trace_id từ n8n
import litellm
from langfuse import observe

litellm.callbacks = ["langfuse"]  # đọc LANGFUSE_* từ env

@observe()
def agent_step(messages, trace_id: str):
    return litellm.completion(
        model="anthropic/claude-sonnet-5-5",
        messages=messages,
        metadata={"trace_id": trace_id},
    )
```

**Số đo chuẩn cho mọi workflow:**
- **Chất lượng**: task success rate, độ đúng tool call, tỉ lệ handoff, CSAT / feedback.
- **Tin cậy**: tỉ lệ run lỗi, tỉ lệ fallback, pass^k (ổn định qua k lần chạy).
- **Hiệu năng**: p50 / p95 latency từ lúc nhận tin đến lúc trả lời.
- **Chi phí**: cost / message, cost / conversation, cost hạ tầng / tháng.

**Eval gate**: benchmark nội bộ ≥ 50 case từ hội thoại thật (đã redact PII), chạy lại mỗi lần đổi prompt / model / workflow; điểm tụt dưới ngưỡng thì không release.

> Khuyến nghị: **Langfuse self-hosted + DeepEval**; trace_id = n8n execution id để nối hai bên.

---

## Layer 10 — DEPLOY & OPERATE

Đưa toàn bộ stack lên môi trường thật và giữ nó chạy ổn định.

| Mục đích | Tool cụ thể |
|---|---|
| **Đóng gói** | Docker · Docker Compose (PoC, staging) |
| **Hạ tầng** | Terraform · VM / ECS / EKS của khách hoặc của Kyanon |
| **CI/CD** | GitHub Actions: test → **eval gate** → build image → deploy |
| **Workflow n8n** | Export JSON vào Git (`n8n export:workflow`), import theo môi trường |
| **DB migration** | Alembic (Agent Service) · có version, chạy trong pipeline |
| **Secrets & config** | `.env` theo môi trường · Vault / Doppler |
| **Backup** | `pg_dump` định kỳ cho PostgreSQL (dữ liệu nghiệp vụ + n8n DB) |
| **Scale** | Thêm n8n worker (queue mode) · nhân bản Agent Service · Redis |

**Quy tắc:**
- **Một lệnh deploy, một lệnh rollback**, và đã chạy thử rollback ít nhất một lần.
- Luôn qua **staging** trước **prod**; prod chỉ nhận image đã qua eval gate.
- Có **runbook**: khởi động lại, thêm worker, đổi model, xử lý `failed_run`.
- Theo dõi **cost hạ tầng + cost LLM** hàng tháng, so với ước tính ở Discovery.

> Khuyến nghị: **Docker Compose** cho PoC, **Terraform + GitHub Actions** khi lên hạ tầng khách (đồng bộ AI Roadmap Level 11 và FDE Roadmap stage Deploy).

---

## 🧩 Agent Skills Library (Mục tiêu 1)

Mỗi skill là một **module dùng lại được** trong Agent Service, có chuẩn thiết kế và test riêng. Dự án mới chỉ cấu hình, không viết lại.

| Skill | Module tái sử dụng | Chuẩn thiết kế | Cách đánh giá |
|---|---|---|---|
| **Tool calling** | `tools/` registry + base class Pydantic, MCP client | Typed args, read/write tách bạch, idempotent, lỗi có cấu trúc | % tool call đúng tên + đúng args trên benchmark |
| **Context & memory** | `memory/` short-term + summary + long-term theo user | Context budget, TTL, cách ly tenant | Token/run trước và sau; test recall qua session; test cách ly 2 tenant |
| **Routing** | `router/` intent classifier + model router | Model nhỏ phân loại, có nhánh `unknown` → hỏi lại / handoff | Accuracy intent trên tập có nhãn; cost tiết kiệm được |
| **Guardrails** | `guards/` input / tool / output | Áp ở 3 boundary, rule nghiệp vụ dạng config | Red-team ≥ 20 case: injection, PII leak, hứa sai |
| **Evaluation** | `evals/` dataset + scorer + CI job | Baseline, tập held-out, scorer tự động trước LLM-judge | Scorecard: success, tool accuracy, pass^k, cost, p95 |
| **Error handling** | `resilience/` retry, fallback, timeout, budget | Không im lặng, luôn có fallback + handoff | Test giả lập provider outage, tool timeout, output sai schema |

**Template Agent chuẩn (LangGraph):**
```
input → guard_input → route_intent ─┬─ faq → rag_answer ────────┐
                                    ├─ task → plan → tool_loop ─┤→ guard_output → reply
                                    └─ handoff / unknown ───────┘
          (checkpoint mỗi node · max_steps · budget · trace)
```

---

## 🔁 Workflow Patterns (Mục tiêu 2)

Mỗi pattern = **một n8n template + (tuỳ chọn) một graph trong Agent Service**. Workflow mới được ghép từ các pattern này.

| Mã | Pattern | Khi nào dùng | n8n | Agent Service |
|---|---|---|---|---|
| **WP-01** | **Trigger → AI → Notify** | Tóm tắt, phân loại, trích xuất rồi gửi kết quả | Trigger → LLM Chain → Slack/Email | Không cần |
| **WP-02** | **Channel Adapter** | Nhận tin từ một kênh mới | Webhook → verify → normalize → dedup → Execute Sub-workflow | Không |
| **WP-03** | **Conversational Agent** | Hội thoại nhiều lượt với khách | WP-02 → lock + debounce → `POST /agent/run` → gửi reply về đúng kênh | Template Agent chuẩn |
| **WP-04** | **Router** | Nhiều loại yêu cầu, xử lý khác nhau | Switch theo `intent` từ agent | `route_intent` node |
| **WP-05** | **RAG Q&A có citation** | Trả lời từ tài liệu / chính sách | Gọi agent | `rag_answer` + citation |
| **WP-06** | **Approval Gate (HITL)** | Hành động có side-effect | Wait node + Slack button / Form, có timeout | `interrupt()` + resume |
| **WP-07** | **Human Handoff** | Agent không xử lý được | Chuyển Chatwoot, tắt bot cho conversation | Trả `action: handoff` |
| **WP-08** | **Async Long Job** | Tác vụ > 30 giây | Gọi job → nhận job_id → Wait webhook callback | Celery / async worker |
| **WP-09** | **Scheduled Batch / Report** | Báo cáo định kỳ, follow-up khách | Schedule → loop batch → agent → báo cáo | Batch endpoint |
| **WP-10** | **Ingestion** | Cập nhật kiến thức | Drive / upload trigger → `POST /ingest` → báo kết quả | Docling → pgvector |
| **WP-11** | **Error Handler** | Dùng chung cho mọi workflow | Error Trigger → ghi `failed_run` → alert | — |

Ví dụ ghép: **Godine chatbot đa kênh = WP-02 (mỗi kênh) + WP-03 + WP-04 + WP-05 + WP-07 + WP-11**, thêm WP-06 khi agent được phép đặt chỗ / tạo đơn.

---

## ⚙️ Chuẩn n8n

| Hạng mục | Chuẩn |
|---|---|
| **Deploy** | Docker, DB **PostgreSQL** (không dùng SQLite cho production), **queue mode** (`EXECUTIONS_MODE=queue` + Redis + worker) để scale |
| **Cấu trúc** | Workflow chính mỏng, logic tách thành **sub-workflow** (Execute Workflow) dùng lại: adapter kênh, gửi reply, gọi agent, error handler |
| **Đặt tên** | `[tenant]-[pattern]-[mô tả]`, ví dụ `godine-WP03-conversation`; node đặt tên theo việc làm |
| **Credentials** | Chỉ dùng n8n Credentials, không hardcode key trong node; tách credential theo môi trường |
| **Môi trường** | dev / staging / prod tách instance; workflow export JSON (`n8n export:workflow`) và lưu Git |
| **Webhook** | Header Auth hoặc verify chữ ký, trả 200 sớm, xử lý bất đồng bộ |
| **Lỗi** | Mọi workflow gắn Error Workflow chung (WP-11); bật `Retry On Fail` cho node gọi API ngoài |
| **Dữ liệu** | Không lưu dữ liệu nghiệp vụ trong n8n; nguồn sự thật là PostgreSQL của Agent Service |
| **Giới hạn** | Cấu hình prune execution data (retention), timeout cho workflow, giới hạn payload |
| **Bàn giao** | Mỗi workflow có sticky note: mục đích, input/output, người phụ trách |

---

## 📦 Stack khuyến nghị (Agentic + Non-tech + Hybrid)

| Layer | Chọn | Lý do |
|---|---|---|
| **Trigger / Channel** | n8n Webhook + Chatwoot | Mỗi kênh một adapter, inbox chung cho nhân viên |
| **Orchestrator** | n8n (outer) + LangGraph (inner) | Visual cho vận hành, code cho phần AI |
| **LLM** | LiteLLM → Claude / OpenAI / local | Đổi model bằng config, fallback, gom cost |
| **Agent framework** | LangGraph + Pydantic | Checkpoint, HITL, typed |
| **State & memory** | PostgreSQL + Redis (+ Mem0) | Ít hạ tầng, đủ cho PoC đến production vừa |
| **RAG** | Docling → pgvector → hybrid + BGE Reranker | Đồng bộ AI Roadmap, tốt cho tiếng Việt |
| **Tools** | MCP / OpenAPI + Pydantic | Chuẩn chung, dùng lại giữa dự án |
| **Human in loop** | Chatwoot (khách) + Slack + n8n Wait (nội bộ) | Không phải build UI riêng |
| **Guardrails** | Presidio + guard rules + tool allowlist | PII, injection, hứa sai |
| **Observability** | Langfuse + Grafana + Sentry | Trace, cost, alert |
| **Evaluation** | DeepEval + Langfuse datasets | Benchmark nội bộ, eval gate |
| **Auth** | Keycloak / JWT | Self-hosted, enterprise |
| **Deploy** | Docker Compose → Terraform khi lên hạ tầng khách | Một lệnh deploy, rollback được |

---

## 🚀 FDE — Godine PoC (Mục tiêu 3)

**Phạm vi PoC bước 1:** tích hợp đa kênh + xử lý hội thoại. Danh sách kênh, hệ thống cần tích hợp và use case cụ thể **phải chốt với Godine ở Discovery** (xem [FDE Roadmap](roadmap-fde.html)); bảng dưới là khung để điền.

### Luồng end-to-end

```
Khách nhắn (Zalo / Messenger / Web …)
  → WP-02 adapter kênh (verify, normalize, dedup)
  → WP-03 lock + debounce → Agent Service /agent/run
       guard_input → route_intent → rag_answer | tool_loop (API Godine) | handoff
       → guard_output
  → gửi reply về đúng kênh  ·  ghi conversation + trace Langfuse
  → action = handoff → WP-07 Chatwoot cho nhân viên
  → lỗi bất kỳ → WP-11 alert + câu trả lời dự phòng
```

### Câu hỏi phải chốt ở Discovery

| Nhóm | Câu hỏi |
|---|---|
| **Kênh** | Những kênh nào, kênh nào ưu tiên, volume tin / ngày, giờ cao điểm? |
| **Use case** | Top intent khách hỏi (FAQ, đặt chỗ, đơn hàng, khiếu nại…)? Agent được **làm** gì hay chỉ **trả lời**? |
| **Hệ thống** | API nào có sẵn (CRM, booking, POS, đơn hàng)? Môi trường test? Ai cấp quyền? |
| **Dữ liệu** | Tài liệu kiến thức ở đâu, ai cập nhật? Có PII gì, lưu ở đâu, bao lâu? |
| **Vận hành** | Ai nhận handoff, dùng công cụ gì, giờ làm việc? SLA trả lời? |
| **Hạ tầng** | Cloud của Kyanon hay của Godine? Ràng buộc data residency? |

### Tiêu chí đánh giá PoC

| Trục | Số đo | Cách đo |
|---|---|---|
| **Tích hợp** | Số kênh + số hệ thống Godine kết nối được end-to-end | Demo trên dữ liệu thật |
| **Chất lượng** | Task success rate, accuracy intent, tỉ lệ handoff | Benchmark ≥ 50 hội thoại thật + review của Godine |
| **Độ tin cậy** | Tỉ lệ run lỗi, tỉ lệ fallback, không trùng / mất tin khi webhook gửi lặp | Langfuse + bảng `failed_run` + test replay |
| **Mở rộng** | Tin / phút chịu được, p95 latency khi tăng tải, số n8n worker cần | Load test (k6) theo volume cao điểm × 3 |
| **Chi phí** | Cost / conversation, cost LLM / tháng, cost hạ tầng / tháng | Langfuse + LiteLLM spend × volume dự kiến |

### Lộ trình

| Bước | Nội dung | Exit gate |
|---|---|---|
| **1. Discovery** | Chốt kênh, use case, hệ thống, baseline hiện tại | Scope + tiêu chí nghiệm thu được Godine duyệt |
| **2. PoC 1 kênh** | WP-02 + WP-03 + WP-05 trên 1 kênh ưu tiên, dữ liệu thật | Hội thoại end-to-end chạy, benchmark lần đầu |
| **3. Đa kênh + tích hợp** | Thêm kênh, tool gọi API Godine, WP-07 handoff | Đủ kênh trong scope, test replay sạch |
| **4. Đo & đánh giá** | Load test, cost report, review chất lượng với Godine | Báo cáo tin cậy / mở rộng / chi phí, go / no-go |
| **5. Hoàn thiện** | Sửa theo phản hồi, bổ sung case vào benchmark, chuẩn bị production | Backlog bước tiếp theo được thống nhất |

---

## 🗓️ Kế hoạch 3 tháng

Kế hoạch nghiên cứu chung cho cả team (11/2026 – 01/2027), từ nền tảng đến PoC Godine: xem **[01 — Kế hoạch nghiên cứu](01-research-plan.md)**.

---

## ♻️ Tái sử dụng khi vào workflow mới

| Cần | Có sẵn | Việc làm thêm |
|---|---|---|
| Kênh mới | WP-02 adapter | Viết map payload, thêm credential |
| Logic AI mới | Template Agent + skills | Thêm intent, tool, prompt; thêm case benchmark |
| Tài liệu mới cho RAG | WP-10 + `/ingest` | Upload / trỏ thư mục |
| Hành động có side-effect | WP-06 Approval Gate | Khai báo tool write + người duyệt |
| Chuyển cho người | WP-07 + Chatwoot | Cấu hình inbox, rule handoff |
| Lỗi & alert | WP-11 | Gắn Error Workflow |
| Monitor & eval | Langfuse + DeepEval | Thêm dataset của dự án |
