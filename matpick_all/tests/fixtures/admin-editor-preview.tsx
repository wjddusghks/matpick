import { useState } from "react";
import { createRoot } from "react-dom/client";
import RestaurantManager from "@/components/admin/RestaurantManager";
import {
  restaurantCatalog,
  sources,
  getRestaurantMenuItems,
  getSourcesByRestaurant,
} from "@/data";
import type { RestaurantEdit } from "@/lib/restaurantEdits";
import "@/index.css";
function Preview() {
  const [edits, setEdits] = useState<RestaurantEdit[]>([]);
  const [fail, setFail] = useState(false);
  const [geocodeFixture, setGeocodeFixture] = useState(false);
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
        <label>
          <input
            type="checkbox"
            checked={geocodeFixture}
            onChange={e => setGeocodeFixture(e.target.checked)}
          />
          주소 검색 샘플 응답
        </label>
      </div>
      <RestaurantManager
        restaurants={restaurantCatalog}
        sources={sources}
        initialEdits={edits}
        getMenus={getRestaurantMenuItems}
        getSources={getSourcesByRestaurant}
        lookupAddress={
          geocodeFixture
            ? async query => {
                await new Promise(resolve => setTimeout(resolve, 800));
                if (query.includes("오류")) throw new Error("검수용 오류");
                if (query.includes("없음")) return [];
                return [
                  {
                    roadAddress: "서울특별시 중구 세종대로 110",
                    jibunAddress: "서울특별시 중구 태평로1가 31",
                    lat: 37.56631,
                    lng: 126.97794,
                  },
                  { roadAddress: "좌표 없는 샘플", jibunAddress: "" },
                ];
              }
            : undefined
        }
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
            deletedAt:
              input.action === "delete" ? new Date().toISOString() : null,
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
