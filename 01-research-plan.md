# 01 — Kế hoạch nghiên cứu 3 tháng cho team (11/2026 – 01/2027)

> Một kế hoạch chung cho **cả team**, kể cả người chưa từng làm AI. Học theo tuần, mỗi tuần có lý thuyết, bài lab và một buổi chia sẻ. Kết thúc 3 tháng, team tự build được agentic workflow và áp dụng vào **PoC Godine**.
>
> Liên quan: [Agentic Workflow Toolkit](00-agentic-workflow.md) · [AI Engineer Roadmap](roadmap-ai.html) · [FDE Roadmap](roadmap-fde.html) · [Capability Matrix](capability-agentic-fde.md)

---

## 🎯 Mục tiêu sau 3 tháng

| Ai | Đạt được | Theo Capability Matrix |
|---|---|---|
| **Người mới** | Hiểu và tự build được agent đơn giản: n8n + LLM + RAG + 1 tool, có trace và eval | L1 → **L2 Practitioner** |
| **Người đã có nền** | Build được agent LangGraph đầy đủ: routing, memory, guardrail, error handling, benchmark | L2 → **L3 Production** (trên PoC Godine) |
| **Cả team** | Có chung: Agent template + 6 skill module, 11 workflow pattern, PoC Godine 1–2 kênh + báo cáo | Đầu vào cho Skills Library v1.0 và Framework v1.0 |

---

## 🧭 Cách học mỗi tuần

| Khi nào | Hoạt động | Thời lượng |
|---|---|---|
| **Đầu tuần** | Tự học tài liệu của tuần | 3–4 giờ |
| **Giữa tuần** | Làm lab theo cặp: **1 người đã biết + 1 người mới** | 3–4 giờ |
| **Cuối tuần** | Sharing 1 giờ: một người trình bày (luân phiên), demo lab, thảo luận lỗi gặp phải | 1 giờ |
| **Mọi lúc** | Code lab và ghi chú đẩy lên **một repo chung**, mỗi tuần một thư mục `weekNN/` | — |

**Quy tắc:**
- Lab luôn chạy được và có README 5 dòng: làm gì, chạy thế nào, kết quả, lỗi gặp, câu hỏi còn lại.
- Hỏi sớm: bị kẹt quá 1 giờ thì hỏi trong nhóm chat.
- Dùng **dữ liệu mẫu đã redact**; chỉ dùng dữ liệu thật của Godine khi đã được cấp quyền.

---

## 🧰 Tuần 0 — Chuẩn bị (cho người chưa có nền)

Làm trong tuần cuối tháng 10, ai đã biết thì bỏ qua.

| Chủ đề | Cần biết đến mức | Kiểm tra |
|---|---|---|
| **Python** | Hàm, class, dict/list, `pip`, virtualenv, đọc lỗi traceback | Viết script đọc file JSON và in kết quả |
| **HTTP & API** | GET/POST, JSON, status code, header, API key | Gọi một API công khai bằng `curl` và Python `requests` |
| **Git** | clone, branch, commit, push, pull request | Mở 1 PR vào repo chung |
| **Docker** | `docker run`, `docker compose up`, xem log | Chạy n8n bằng Docker trên máy mình |
| **Công cụ** | VS Code, Postman/Bruno, tài khoản API LLM (key do lead cấp) | Gọi được 1 LLM API |

---

## 📅 Lộ trình 13 tuần

### Giai đoạn 1 — Nền tảng (Tuần 1–4): hiểu LLM, n8n, tool, RAG

| Tuần | Chủ đề | Học gì | Lab | Đầu ra |
|---|---|---|---|---|
| **1** | **LLM cơ bản** | Token, context window, temperature, system prompt, structured output, chi phí theo token, so sánh model | Gọi LLM qua **LiteLLM**, trả JSON đúng schema **Pydantic**; so sánh 2 model về chất lượng + cost | Script `classify.py` + bảng so sánh |
| **2** | **n8n cơ bản** | Node, trigger, webhook, credential, expression, sub-workflow, Error Trigger | Workflow **Form → LLM tóm tắt → gửi Slack/Email** (pattern WP-01) | Workflow JSON export vào Git |
| **3** | **Tool calling & MCP** | Function calling, mô tả tool, tool read vs write, MCP server/client, n8n AI Agent node | Tạo **mock API Godine** (FastAPI: menu, giờ mở cửa, đơn hàng) → agent gọi tool để trả lời | Mock API + agent dùng 2 tool |
| **4** | **RAG cơ bản** | Embedding, chunking, vector search, **pgvector**, hybrid search, citation | FAQ bot: ingest tài liệu mẫu → trả lời có trích nguồn | RAG pipeline + 10 câu hỏi test |

**✅ Checkpoint 1 (cuối tuần 4):** mỗi cặp demo một **mini agent**: n8n nhận tin → LLM + RAG + 1 tool → trả lời. Người mới đạt **L1**.

### Giai đoạn 2 — Agentic Engineering (Tuần 5–8): 6 agent skills

| Tuần | Chủ đề | Học gì | Lab | Đầu ra |
|---|---|---|---|---|
| **5** | **LangGraph & Routing** | State, node, edge, conditional routing, checkpoint, `interrupt()` cho human-in-the-loop; workflow vs agent | Agent có **router intent** (FAQ / tra cứu / chuyển người) + checkpoint Postgres | **Agent template** v0 |
| **6** | **Context & Memory + Conversation design** | Context budget, tóm tắt hội thoại, memory theo user, cách ly tenant; hội thoại nhiều lượt: hỏi lại, slot filling, khi nào chuyển người | Agent nhớ khách qua nhiều phiên; xử lý khách gửi nhiều tin liên tiếp | Module `memory/` + `router/` |
| **7** | **Guardrails & Error handling** | PII (Presidio, thêm SĐT/CCCD VN), prompt injection (OWASP LLM Top 10), tool permission; retry, fallback model, timeout, idempotency | Chặn 10 câu tấn công; giả lập provider sập → agent vẫn trả lời an toàn | Module `guards/` + `resilience/` |
| **8** | **Evaluation & Observability** | Tracing Langfuse, dataset, scorer tự động, LLM-as-judge, benchmark, eval hội thoại nhiều lượt, eval gate trong CI | Benchmark 20 case cho agent của tuần 5–7; chạy trước/sau một thay đổi prompt | Module `evals/` + scorecard |

**✅ Checkpoint 2 (cuối tuần 8):** **Agent template + 6 skill module** (tool calling, memory, routing, guardrails, evaluation, error handling) chạy chung, có benchmark. Người mới đạt **L2**.

### Giai đoạn 3 — Workflow Framework & FDE Godine (Tuần 9–13)

| Tuần | Chủ đề | Học gì | Lab / Việc thật | Đầu ra |
|---|---|---|---|---|
| **9** | **FDE: Discovery** | Quy trình FDE 7 stage, hỏi khách hàng đúng cách, problem statement, success metric, baseline | **Discovery Godine**: kênh, use case, hệ thống, dữ liệu, baseline (nếu chưa gặp được khách: làm trên đề bài giả lập) | Discovery pack + tiêu chí nghiệm thu |
| **10** | **Workflow patterns & đa kênh** | 11 pattern WP-01…11, adapter kênh (Zalo OA, Messenger, web chat), dedup/debounce, Chatwoot handoff, n8n queue mode | Dựng **kênh ưu tiên của Godine** + nối Agent Service qua contract `/agent/run` | Pattern WP-02, 03, 07 chạy thật |
| **11** | **PoC Godine end-to-end** | Tích hợp API Godine, tool đọc/ghi an toàn, HITL cho hành động có side-effect | PoC 1 kênh trên dữ liệu thật; benchmark ≥ 50 hội thoại thật (đã redact) | PoC chạy + benchmark lần 1 |
| **12** | **Deploy & Operate** | Docker Compose, CI có eval gate, rollback, load test (k6), cost model / hội thoại | Deploy staging; load test theo volume cao điểm × 3; tính cost / tháng | Runbook + báo cáo tải & chi phí |
| **13** | **Đánh giá & tổng kết** | Viết báo cáo cho khách, value report, retro | Demo Godine; báo cáo **tin cậy · mở rộng · chi phí** → go / no-go; retro team | Báo cáo PoC · Skills Library v1.0 · Framework v1.0 · tự đánh giá level |

**✅ Checkpoint 3 (cuối tuần 13):** PoC Godine được trình bày cho khách, có quyết định go / no-go. Team có bộ skill và framework dùng lại cho dự án sau.

---

## 📚 Tài liệu học chính

| Chủ đề | Tài liệu | Ghi chú |
|---|---|---|
| Tổng quan agent | Anthropic — *Building effective agents* (bài blog) | Đọc trước tuần 1, đọc lại tuần 5 |
| Sách nền | Chip Huyen — *AI Engineering* (O'Reilly, 2025) | Đọc dần theo tuần: model, RAG, eval, agent |
| LLM & prompt | Tài liệu prompt engineering của Anthropic và OpenAI | Tuần 1 |
| n8n | [n8n Courses — Level 1 & Level 2](https://docs.n8n.io/courses/) | Tuần 2, bắt buộc với cả team |
| Agent cơ bản | [Hugging Face Agents Course](https://huggingface.co/learn/agents-course) | Tuần 1–3, miễn phí |
| MCP | [modelcontextprotocol.io](https://modelcontextprotocol.io) | Tuần 3 |
| LangGraph | [LangChain Academy — Introduction to LangGraph](https://academy.langchain.com) | Tuần 5–6, miễn phí |
| Guardrails | [OWASP Top 10 for LLM Applications](https://genai.owasp.org) · [Microsoft Presidio](https://microsoft.github.io/presidio/) | Tuần 7 |
| Eval & tracing | [Langfuse docs](https://langfuse.com/docs) · DeepEval docs | Tuần 8 |
| FDE | [FDE Roadmap](roadmap-fde.html) · *The Mom Test* (Rob Fitzpatrick) | Tuần 9 |
| Kiến trúc tham chiếu | [00 — Agentic Workflow Toolkit](00-agentic-workflow.md) | Dùng xuyên suốt |

---

## 👥 Vai trò trong team

| Vai trò | Việc |
|---|---|
| **Lead** | Chốt nội dung tuần, review lab, gỡ kẹt kỹ thuật, làm đầu mối với Godine |
| **Người trình bày tuần** (luân phiên) | Chuẩn bị sharing 1 giờ, tổng hợp lỗi và câu hỏi của cả team |
| **Cặp lab** | 1 người đã biết + 1 người mới, đổi cặp sau mỗi giai đoạn |
| **Owner module** (từ tuần 5) | Mỗi người sở hữu 1–2 skill module, viết README và test cho module đó |

---

## ⚠️ Rủi ro & cách xử lý

| Rủi ro | Xử lý |
|---|---|
| Người mới theo không kịp | Tuần 0 bắt buộc; lab theo cặp; cho phép làm phần "tối thiểu" của lab |
| Chưa có dữ liệu / API thật của Godine đến tuần 9–11 | Dùng mock API từ tuần 3, thay bằng API thật khi được cấp; chạy song song việc xin quyền từ tuần 1 |
| Đăng ký kênh (Zalo OA, Meta app) mất thời gian | Lead nộp hồ sơ ngay khi Godine đồng ý, không chờ đến tuần 10 |
| Vừa học vừa làm dự án khác | Giữ tối thiểu 6–8 giờ/tuần; tuần bận thì làm lab tối thiểu, không bỏ sharing |
| Chi phí API LLM khi học | Dùng model nhỏ cho lab, đặt hạn mức theo key, theo dõi trên LiteLLM / Langfuse |
