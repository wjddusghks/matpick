import { createRoot } from "react-dom/client";
import AdminTopicResearch from "@/pages/AdminTopicResearch";
import "@/index.css";
createRoot(document.getElementById("root")!).render(
  <>
    <div className="bg-amber-100 p-2 text-center text-xs">
      로컬 UI 검수 · 테스트 관리자 · 운영 데이터 변경 없음
    </div>
    <AdminTopicResearch />
  </>
);
