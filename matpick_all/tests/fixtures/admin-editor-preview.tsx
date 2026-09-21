import { useState } from "react";
import { createRoot } from "react-dom/client";
import RestaurantManager from "@/components/admin/RestaurantManager";
import {
  restaurants,
  sources,
  getRestaurantMenuItems,
  getSourcesByRestaurant,
} from "@/data";
import type { RestaurantEdit } from "@/lib/restaurantEdits";
import "@/index.css";
function Preview() {
  const [edits, setEdits] = useState<RestaurantEdit[]>([]);
  const [fail, setFail] = useState(false);
  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: 2,
          left: 6,
          zIndex: 100,
          fontSize: 10,
          background: "#fff",
          border: "1px solid #ddd",
          padding: "1px 5px",
          borderRadius: 4,
        }}
      >
        <label>
          <input
            type="checkbox"
            checked={fail}
            onChange={e => setFail(e.target.checked)}
          />
          저장 오류 재현
        </label>{" "}
        · 로컬 검수 / 운영 데이터 변경 없음
      </div>
      <RestaurantManager
        restaurants={restaurants}
        sources={sources}
        initialEdits={edits}
        getMenus={getRestaurantMenuItems}
        getSources={getSourcesByRestaurant}
        configured
        ready
        onRetry={() => {}}
        onSave={async input => {
          await new Promise(resolve => setTimeout(resolve, 350));
          if (fail)
            throw new Error("검수용 저장 오류입니다. 다시 저장해 주세요.");
          const old = edits.find(e => e.restaurantId === input.restaurantId);
          const edit: RestaurantEdit = {
            restaurantId: input.restaurantId,
            revision: (old?.revision || 0) + 1,
            updatedAt: new Date().toISOString(),
            changes:
              input.action === "reset"
                ? {}
                : { ...old?.changes, ...input.changes },
          };
          setEdits(current => [
            ...current.filter(e => e.restaurantId !== input.restaurantId),
            edit,
          ]);
          return edit;
        }}
      />
    </>
  );
}
const previewRoot = createRoot(document.getElementById("root")!);
previewRoot.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => previewRoot.unmount());
