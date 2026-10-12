# CAP-AI-01 · Agentic & FDE — Capability Matrix

Tham chiếu: AI Engineer / Agentic AI Engineer Roadmap (index.html).

## 1. Thang Level

| Level | Tên | Mô tả | Bằng chứng tối thiểu |
|---|---|---|---|
| L1 | Aware | Hiểu khái niệm, giải thích được khi nào dùng, chưa tự build | Trình bày / quiz nội bộ |
| L2 | Practitioner | Tự build được trên project mẫu với hướng dẫn | Repo cá nhân / lab chạy được |
| L3 | Production | Tự build và ship lên production cho khách hàng, đạt toàn bộ DoR | Code đã merge + trace + eval report trên dự án thật |
| L4 | Lead | Thiết kế kiến trúc, review người khác, đặt chuẩn cho team | ADR, review PR, tài liệu/chuẩn team, mentor ≥ 1 người |

## 2. Tổng quan Capability

| Mã | Nhóm Năng lực | Skill Năng lực | Định nghĩa (phạm vi skill) | Roadmap Layer | Target Level |
|---|---|---|---|---|---|
| CAP-AI-01 | Agentic & FDE | — | Thiết kế, xây dựng, đánh giá và triển khai hệ thống agentic trên dữ liệu và hạ tầng thật của khách hàng enterprise, từ discovery đến vận hành | L04–L11 | L3 |
| AI-1.1 | Agentic Engineering | Agent Orchestration | Điều phối vòng đời một agent run: state, routing, retry, termination, checkpoint, HITL, tracing | L08 | L3 |
| AI-1.2 | Agentic Engineering | Agent Workflow Design | Thiết kế luồng làm việc của agent: chọn pattern (workflow hay agent, single hay multi-agent), phân rã tác vụ, tác vụ chạy dài, và quản lý context & memory cho luồng đó | L04, L08, L09, L10 | L3 |
| AI-1.3 | Agentic Engineering | Tool Integration & Agent Security | Kết nối agent với hệ thống thật một cách an toàn: MCP/OpenAPI tools, text-to-SQL, phân quyền, chống injection/leakage | L06, L07 | L3 |
| AI-1.4 | Agentic Engineering | Agent Evaluation & Benchmarking | Dùng benchmark làm thang đo chuẩn cho chất lượng agent: benchmark công khai để chọn model, benchmark nội bộ từ task thật để đo tiến bộ và chặn release khi tụt điểm | L05 | L3 |
| FDE-01 | Forward Deployed Engineering | Discovery & Solution Design | Hiểu nghiệp vụ khách hàng, định nghĩa success metric, chọn giải pháp và kiến trúc phù hợp | Supplements | L3 |
| FDE-02 | Forward Deployed Engineering | Customer Delivery & Integration | Xây PoC/MVP trên dữ liệu thật, tích hợp hệ thống khách, báo cáo kết quả và quản lý kỳ vọng | L06, L10 | L3 |
| FDE-03 | Forward Deployed Engineering | Production Deployment & Handover | Đưa hệ thống lên hạ tầng khách, đảm bảo tuân thủ, vận hành ổn định và bàn giao trọn vẹn | L11 | L3 |

## 3. Tiêu chuẩn Đầu ra (Definition of Ready)

### AI-1.1 · Agent Orchestration — Target L3

| # | Tiêu chuẩn | Bằng chứng |
|---|---|---|
| 1.1.1 | Xây agent bằng LangGraph với state schema typed, nodes/edges, routing có điều kiện | Code + sơ đồ graph |
| 1.1.2 | Có termination conditions: max steps, ngân sách token/cost, timeout | Config + test case vượt ngưỡng |
| 1.1.3 | Retry có giới hạn và fallback model (LiteLLM) khi tool hoặc provider lỗi | Test giả lập provider outage |
| 1.1.4 | Checkpoint vào Postgres, resume được run sau crash hoặc sau bước human approval | Demo resume từ checkpoint |
| 1.1.5 | HITL interrupt trước mọi action có side-effect (ghi DB, gửi mail, giao dịch) | Trace có bước approve |
| 1.1.6 | Mọi bước agent được trace trên Langfuse kèm token và cost | Link trace end-to-end |

### AI-1.2 · Agent Workflow Design — Target L3

| # | Tiêu chuẩn | Bằng chứng |
|---|---|---|
| 1.2.1 | Chọn đúng pattern (deterministic workflow / ReAct / plan-and-execute / router / multi-agent supervisor); biết khi nào chỉ cần Agent SDK hoặc một LLM call | ADR so sánh ≥ 2 phương án |
| 1.2.2 | Multi-agent: phân rã tác vụ rõ ràng, có contract input/output khi chuyển giao giữa các agent | Sơ đồ + schema handoff |
| 1.2.3 | Thiết kế cho lỗi: tool idempotent, xử lý kết quả thiếu/sai, degrade gracefully | Test failure scenarios |
| 1.2.4 | Tác vụ chạy dài: async worker, stream tiến trình qua SSE | Demo streaming end-to-end |
| 1.2.5 | Context budget: cắt gọn tool result, compaction/summarization cho run dài | Đo token/run trước và sau |
| 1.2.6 | Agentic RAG: agent tự quyết khi nào và truy xuất ở đâu, câu trả lời có citation | Trace + output có nguồn trích dẫn |
| 1.2.7 | Memory: short-term trong state, long-term theo user có TTL, read/write policy rõ ràng, cách ly theo user/tenant | Demo recall qua nhiều session + test cách ly 2 tenant |
| 1.2.8 | Mọi lựa chọn thiết kế (pattern, context, memory) đều được chứng minh bằng điểm benchmark của AI-1.4 | So sánh điểm benchmark giữa các phương án |

### AI-1.3 · Tool Integration & Agent Security — Target L3

| # | Tiêu chuẩn | Bằng chứng |
|---|---|---|
| 1.3.1 | Expose API nội bộ thành MCP server hoặc tool OpenAPI, argument typed bằng Pydantic | MCP server chạy được |
| 1.3.2 | Text-to-SQL chỉ đọc, kiểm tra AST bằng SQLGlot, giới hạn theo tenant | Test chặn DML / truy vấn chéo tenant |
| 1.3.3 | Text-to-SQL dựa trên semantic layer, cùng một câu hỏi metric luôn ra cùng một con số | Test lặp câu hỏi metric |
| 1.3.4 | Phân quyền theo user, tool chạy với quyền của người dùng (delegated), secrets không nằm trong prompt | Test user không đủ quyền bị từ chối |
| 1.3.5 | Permission-aware retrieval: RAG lọc theo ACL của từng tài liệu | Test user A không thấy tài liệu của B |
| 1.3.6 | Validate input/output, chặn prompt injection, tool abuse, data leakage | Báo cáo red-team ≥ 20 case |

### AI-1.4 · Agent Evaluation & Benchmarking — Target L3

| # | Tiêu chuẩn | Bằng chứng |
|---|---|---|
| 1.4.1 | Dùng benchmark công khai phù hợp với bài toán để shortlist model: function calling (BFCL), agent dùng tool có hội thoại với user (τ²-bench), text-to-SQL (BIRD); hiểu giới hạn của benchmark công khai (khác domain, rò rỉ dữ liệu train) | Bảng so sánh model + lý do chọn |
| 1.4.2 | Xây benchmark nội bộ từ task thật của khách: ≥ 50 task có expected outcome, chia tập dev và tập held-out test, có version | Benchmark dataset vX trên Langfuse |
| 1.4.3 | Scorecard chuẩn cho mọi lần đo: task success rate, độ đúng trajectory/tool call, pass^k (ổn định qua k lần chạy), cost/task, p95 latency | Scorecard template |
| 1.4.4 | Luôn có baseline; khi đổi model/prompt/workflow phải chạy lại cùng benchmark nhiều lần, chỉ công nhận cải tiến khi vượt baseline rõ ràng | Báo cáo so sánh vs. baseline |
| 1.4.5 | Scorer tin cậy: ưu tiên check tự động (kết quả, trạng thái DB, tool call); LLM-as-judge chỉ dùng khi cần và phải hiệu chỉnh với nhãn người | Bảng agreement judge vs. human |
| 1.4.6 | Benchmark gate trong CI/CD: điểm tụt dưới ngưỡng thì chặn merge và release | GitHub Actions log |
| 1.4.7 | Benchmark được duy trì: định kỳ bổ sung case lỗi từ production, giữ tập held-out không bị tối ưu theo | Changelog benchmark |

### FDE-01 · Discovery & Solution Design — Target L3

| # | Tiêu chuẩn | Bằng chứng |
|---|---|---|
| F01.1 | Chuyển yêu cầu nghiệp vụ thành problem statement, success metric và eval criteria đo được | Tài liệu discovery được khách duyệt |
| F01.2 | Nhận ra khi nào KHÔNG nên dùng LLM và đề xuất giải pháp đơn giản hơn | Ghi chú phương án trong discovery |
| F01.3 | Đề xuất kiến trúc và stack, ước lượng cost/request và latency trước khi build | Solution design + cost estimate |
| F01.4 | Xác định sớm ràng buộc dữ liệu: nguồn, chất lượng, quyền truy cập, PII, data residency | Data assessment checklist |
| F01.5 | Nhận diện rủi ro và phạm vi, thống nhất tiêu chí nghiệm thu với khách | Biên bản thống nhất scope |

### FDE-02 · Customer Delivery & Integration — Target L3

| # | Tiêu chuẩn | Bằng chứng |
|---|---|---|
| F02.1 | Dựng PoC/MVP trên dữ liệu thật của khách trong 2–4 tuần bằng stack mặc định | Demo cho khách |
| F02.2 | Tích hợp hệ thống khách (API, DB, SSO) theo chuẩn AI-1.3 | Sơ đồ tích hợp + test |
| F02.3 | Báo cáo kết quả bằng số liệu: trước/sau, cost per task, p95 latency | Slide/báo cáo kết quả |
| F02.4 | Giao tiếp được với cả stakeholder nghiệp vụ lẫn kỹ thuật, quản lý kỳ vọng về độ chính xác của AI | Feedback từ khách / PM |
| F02.5 | Chuyển phản hồi của khách thành backlog và case eval mới | Backlog + golden set cập nhật |

### FDE-03 · Production Deployment & Handover — Target L3

| # | Tiêu chuẩn | Bằng chứng |
|---|---|---|
| F03.1 | Deploy lên hạ tầng khách bằng Docker / EKS / Terraform, tái lập được bằng một lệnh | IaC repo + deploy log |
| F03.2 | CI/CD có eval gate, canary và rollback an toàn | Pipeline + lần rollback thử |
| F03.3 | Tuân thủ: PII masking (Presidio), data residency, retention, audit log, Luật Bảo vệ dữ liệu cá nhân Việt Nam | Checklist compliance đã duyệt |
| F03.4 | Dashboard giám sát chất lượng, latency, token và cost; có alert | Link dashboard + rule alert |
| F03.5 | Tối ưu chi phí sau go-live: model routing, caching, prompt caching | Cost/task trước và sau |
| F03.6 | Handover đủ runbook, tài liệu kiến trúc và buổi đào tạo cho team khách | Biên bản bàn giao |

## 4. Lộ trình gợi ý theo Level

| Skill | L1 → L2 | L2 → L3 | L3 → L4 |
|---|---|---|---|
| AI-1.1 Agent Orchestration | Lab LangGraph: agent có tool + HITL | Đạt 1.1.1–1.1.6 trên dự án thật | Viết template agent chuẩn cho team |
| AI-1.2 Agent Workflow Design | So sánh 3 pattern trên cùng bài toán; lab agentic RAG + memory theo user | Đạt 1.2.1–1.2.8 trên dự án thật | Review kiến trúc agent, đặt chuẩn context/memory policy cho team |
| AI-1.3 Tool Integration & Agent Security | Viết MCP server cho 1 API nội bộ | Đạt 1.3.1–1.3.6, qua red-team | Xây bộ red-team chuẩn của team |
| AI-1.4 Agent Evaluation & Benchmarking | Chạy 1 benchmark công khai (BFCL / τ²-bench) cho 3 model; dựng benchmark nội bộ 20 task | Đạt 1.4.1–1.4.7, benchmark gate trong CI | Sở hữu bộ benchmark chuẩn của team, dùng chung cho mọi dự án |
| FDE-01 Discovery & Solution Design | Shadow discovery 1 dự án | Tự lead discovery cho 1 khách | Chuẩn hóa template discovery, đào tạo FDE mới |
| FDE-02 Customer Delivery & Integration | Tham gia build PoC cùng team | Tự lead PoC/MVP cho 1 khách | Lead nhiều account song song |
| FDE-03 Production Deployment & Handover | Deploy staging theo runbook có sẵn | Tự go-live + handover 1 khách | Chuẩn hóa playbook triển khai |
