import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAdminRegistrationKey, isAdminUser } from "./admin";
import { SUGGESTIONS_API, type SuggestionItem } from "./restaurantSuggestions";

export const suggestionStatuses = {
  pending: "검토 대기",
  reviewed: "확인 완료",
  archived: "보류",
};
export function useSuggestionInbox() {
  const { user } = useAuth();
  const allowed = isAdminUser(user);
  const [items, setItems] = useState<SuggestionItem[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!allowed || !user) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`${SUGGESTIONS_API}&page=${page}`, {
      headers: {
        "x-matpick-admin-key": getAdminRegistrationKey(user),
        "x-matpick-admin-token": user.syncToken || "",
      },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async response => {
        const body = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(body?.items))
          throw new Error(body?.error || "제보함을 불러오지 못했습니다.");
        if (!controller.signal.aborted) {
          setItems(body.items);
          setTotal(body.total);
          setLoading(false);
        }
      })
      .catch(reason => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error ? reason.message : "연결에 실패했습니다."
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [allowed, user, page, revision]);
  async function update(
    item: SuggestionItem,
    status: SuggestionItem["status"]
  ) {
    if (!allowed || !user || saving) return;
    setSaving(item.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(SUGGESTIONS_API, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-matpick-admin-key": getAdminRegistrationKey(user),
          "x-matpick-admin-token": user.syncToken || "",
        },
        body: JSON.stringify({ requestId: item.requestId, status }),
        signal: AbortSignal.timeout(20000),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok)
        throw new Error(body?.error || "상태를 변경하지 못했습니다.");
      setItems(current =>
        current.map(entry =>
          entry.id === item.id ? { ...entry, status } : entry
        )
      );
      setNotice(`${item.name}: ${suggestionStatuses[status]}로 변경했습니다.`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "저장에 실패했습니다."
      );
    } finally {
      setSaving("");
    }
  }
  return {
    items,
    page,
    total,
    loading,
    error,
    saving,
    notice,
    setPage,
    update,
    reload: () => setRevision(value => value + 1),
  };
}
