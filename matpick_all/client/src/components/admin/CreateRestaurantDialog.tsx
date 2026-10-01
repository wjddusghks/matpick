import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  ClipboardPaste,
  Loader2,
  MapPin,
  Plus,
  Store,
  Trash2,
  Tv,
  Utensils,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Source } from "@/data/types";
import {
  formatMenuPrice,
  parseMenuPaste,
} from "@/lib/adminRestaurantEditor";
import AdminAddressLookup from "./AdminAddressLookup";
import type { AddressResult } from "@/lib/addressSearch";

type NewMenu = { id: string; name: string; price: string };
type Props = {
  open: boolean;
  sources: Source[];
  onOpenChange: (open: boolean) => void;
  onCreate: (
    changes: Record<string, unknown>,
    registration: { requestId: string; locationValidated: true }
  ) => Promise<void>;
  lookupAddress?: (query: string) => Promise<AddressResult[]>;
};

function newMenu(): NewMenu {
  return { id: crypto.randomUUID(), name: "", price: "" };
}

function initialForm(sources: Source[]) {
  return {
    name: "",
    category: "",
    region: "",
    phone: "",
    address: "",
    lat: "",
    lng: "",
    sourceId:
      sources.find(source => source.id === "popular-restaurants")?.id ||
      sources[0]?.id ||
      "",
    episode: "",
    sourceUrl: "",
    menus: [newMenu()],
  };
}

export default function CreateRestaurantDialog({
  open,
  sources,
  onOpenChange,
  onCreate,
  lookupAddress,
}: Props) {
  const [form, setForm] = useState(() => initialForm(sources));
  const [locatedAddress, setLocatedAddress] = useState("");
  const [mapConfirmed, setMapConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(initialForm(sources));
    setLocatedAddress("");
    setMapConfirmed(false);
    setSaving(false);
    setError("");
    setRequestId(crypto.randomUUID());
    setPasteOpen(false);
    setPasteText("");
  }, [open, sources]);

  const pasted = useMemo(() => parseMenuPaste(pasteText), [pasteText]);
  const nonEmptyMenus = form.menus.filter(
    menu => menu.name.trim() || menu.price.trim()
  );
  const newPasteRows = pasted.rows.filter(
    row =>
      !nonEmptyMenus.some(
        menu =>
          menu.name.trim().replace(/\s+/g, " ") === row.name &&
          formatMenuPrice(menu.price) === row.price
      )
  );
  const duplicatePasteCount =
    pasted.duplicates + pasted.rows.length - newPasteRows.length;
  const pasteConflicts = useMemo(() => {
    const prices = new Map<string, Set<string>>();
    for (const menu of [...nonEmptyMenus, ...pasted.rows]) {
      const name = menu.name.trim().replace(/\s+/g, " ");
      const price = formatMenuPrice(menu.price);
      if (!name || !price) continue;
      const values = prices.get(name) || new Set<string>();
      values.add(price);
      prices.set(name, values);
    }
    return Array.from(prices)
      .filter(([, values]) => values.size > 1)
      .map(([name, values]) => ({ name, prices: Array.from(values) }));
  }, [nonEmptyMenus, pasted.rows]);
  const pasteCapacity = 100 - nonEmptyMenus.length;

  function togglePastePanel() {
    setPasteOpen(current => !current);
    setPasteText("");
  }

  function addPastedMenus() {
    if (
      !newPasteRows.length ||
      pasted.errors.length ||
      newPasteRows.length > pasteCapacity
    )
      return;
    setForm(current => ({
      ...current,
      menus: [
        ...current.menus.filter(
          menu => menu.name.trim() || menu.price.trim()
        ),
        ...newPasteRows.map(row => ({
          id: crypto.randomUUID(),
          name: row.name,
          price: row.price,
        })),
      ],
    }));
    setPasteText("");
    setPasteOpen(false);
    setError("");
  }

  function setField(
    key: keyof Omit<ReturnType<typeof initialForm>, "menus">,
    value: string
  ) {
    setForm(current => ({ ...current, [key]: value }));
    if (["name", "address", "lat", "lng"].includes(key)) setMapConfirmed(false);
    if (key === "address" && value !== locatedAddress) setLocatedAddress("");
    setError("");
  }

  function setMenu(id: string, patch: Partial<NewMenu>) {
    setForm(current => ({
      ...current,
      menus: current.menus.map(menu =>
        menu.id === id ? { ...menu, ...patch } : menu
      ),
    }));
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const menus = form.menus.filter(
      menu => menu.name.trim() || menu.price.trim()
    );
    if (!form.name.trim() || !form.category.trim() || !form.region.trim()) {
      setError("식당명, 음식 종류, 지역을 모두 입력해 주세요.");
      return;
    }
    if (!locatedAddress || !form.lat || !form.lng) {
      setError("주소를 조회하고 정확한 주소·좌표 결과를 적용해 주세요.");
      return;
    }
    if (!mapConfirmed) {
      setError("지도에서 식당명과 지점 위치를 확인해 주세요.");
      return;
    }
    if (!form.sourceId || !form.episode.trim()) {
      setError("식당이 소개된 주제와 회차·목록 이름을 입력해 주세요.");
      return;
    }
    if (!menus.length || menus.some(menu => !menu.name.trim())) {
      setError("메뉴를 하나 이상 등록하고 메뉴명을 확인해 주세요.");
      return;
    }
    const episodeNumber = Number(form.episode.match(/\d+/)?.[0]);
    setSaving(true);
    setError("");
    try {
      await onCreate(
        {
          name: form.name.trim(),
          category: form.category.trim(),
          region: form.region.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          lat: Number(form.lat),
          lng: Number(form.lng),
          operationState: "operating",
          menus: menus.map((menu, index) => ({
            id: `new-menu-${index + 1}`,
            name: menu.name.trim(),
            price: formatMenuPrice(menu.price),
            description: "",
            isSignature: index === 0,
          })),
          sourceLinks: [
            {
              id: "new-source-1",
              restaurantId: "new",
              sourceId: form.sourceId,
              label: form.episode.trim(),
              sourceUrl: form.sourceUrl.trim(),
              ...(Number.isInteger(episodeNumber) && episodeNumber > 0
                ? { episodeNumber }
                : {}),
            },
          ],
        },
        { requestId, locationValidated: true }
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "식당을 등록하지 못했어요. 입력 내용은 그대로 남아 있어요."
      );
      setSaving(false);
    }
  }

  const mapQuery = `${form.name} ${form.address}`.trim();
  return (
    <Dialog open={open} onOpenChange={next => !saving && onOpenChange(next)}>
      <DialogContent className="am-dialog am-create-dialog">
        <DialogHeader>
          <span className="am-dialog-icon">
            <Store size={23} />
          </span>
          <DialogTitle>새 식당 등록</DialogTitle>
          <DialogDescription>
            주제와 회차, 지도에서 확인한 위치, 메뉴를 입력하면 저장 즉시 공개
            검색과 지도에 반영됩니다.
          </DialogDescription>
        </DialogHeader>
        <form className="am-create-form" onSubmit={submit}>
          <section className="am-create-section">
            <h3>
              <Store size={16} /> 기본 정보
            </h3>
            <div className="am-field-grid">
              <label className="am-field">
                <span>식당명 *</span>
                <input
                  autoFocus
                  maxLength={200}
                  value={form.name}
                  onChange={e => setField("name", e.target.value)}
                />
              </label>
              <label className="am-field">
                <span>음식 종류 *</span>
                <input
                  maxLength={100}
                  placeholder="예: 한식, 중식"
                  value={form.category}
                  onChange={e => setField("category", e.target.value)}
                />
              </label>
              <label className="am-field">
                <span>지역 *</span>
                <input
                  maxLength={100}
                  placeholder="예: 서울 마포구"
                  value={form.region}
                  onChange={e => setField("region", e.target.value)}
                />
              </label>
              <label className="am-field">
                <span>전화번호</span>
                <input
                  type="tel"
                  maxLength={80}
                  value={form.phone}
                  onChange={e => setField("phone", e.target.value)}
                />
              </label>
            </div>
          </section>
          <section className="am-create-section">
            <h3>
              <MapPin size={16} /> 주소·지도 확인
            </h3>
            <label className="am-field">
              <span>주소 *</span>
              <input
                maxLength={500}
                value={form.address}
                onChange={e => setField("address", e.target.value)}
                placeholder="도로명 또는 지번 주소"
              />
            </label>
            <AdminAddressLookup
              address={form.address}
              disabled={saving}
              lookup={lookupAddress}
              onSelect={result => {
                const address = result.roadAddress || result.jibunAddress;
                setForm(current => ({
                  ...current,
                  address,
                  lat: String(result.lat),
                  lng: String(result.lng),
                }));
                setLocatedAddress(address);
                setMapConfirmed(false);
                setError("");
              }}
            />
            {locatedAddress && (
              <div className="am-create-map-check">
                <div>
                  <strong>위도 {form.lat}</strong>
                  <strong>경도 {form.lng}</strong>
                </div>
                <div className="am-reference-links">
                  <a
                    className="am-btn am-btn-white"
                    href={`https://map.naver.com/p/search/${encodeURIComponent(mapQuery)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    네이버지도 확인 <ArrowUpRight size={13} />
                  </a>
                  <a
                    className="am-btn am-btn-white"
                    href={`https://map.kakao.com/?q=${encodeURIComponent(mapQuery)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    카카오지도 확인 <ArrowUpRight size={13} />
                  </a>
                </div>
                <label className="am-create-confirm">
                  <input
                    type="checkbox"
                    checked={mapConfirmed}
                    onChange={e => setMapConfirmed(e.target.checked)}
                  />{" "}
                  지도의 식당명과 정확한 지점 위치를 확인했습니다.
                </label>
              </div>
            )}
          </section>
          <section className="am-create-section">
            <h3>
              <Tv size={16} /> 주제·회차
            </h3>
            <div className="am-field-grid">
              <label className="am-field">
                <span>주제 *</span>
                <select
                  value={form.sourceId}
                  onChange={e => setField("sourceId", e.target.value)}
                >
                  <option value="">선택해 주세요</option>
                  {sources.map(source => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="am-field">
                <span>회차·목록 이름 *</span>
                <input
                  maxLength={200}
                  placeholder="예: 173회, 2026 인기맛집"
                  value={form.episode}
                  onChange={e => setField("episode", e.target.value)}
                />
              </label>
              <label className="am-field am-full">
                <span>소개 영상·방송 링크</span>
                <input
                  type="url"
                  maxLength={2000}
                  placeholder="https://"
                  value={form.sourceUrl}
                  onChange={e => setField("sourceUrl", e.target.value)}
                />
              </label>
            </div>
          </section>
          <section className="am-create-section">
            <div className="am-create-section-head">
              <h3>
                <Utensils size={16} /> 메뉴·가격 *
              </h3>
              <div className="am-create-menu-actions">
                <button
                  type="button"
                  className="am-btn am-btn-white"
                  disabled={pasteCapacity <= 0}
                  aria-expanded={pasteOpen}
                  onClick={togglePastePanel}
                >
                  <ClipboardPaste size={14} /> 여러 메뉴 추가
                </button>
                <button
                  type="button"
                  className="am-btn am-btn-white"
                  disabled={form.menus.length >= 100}
                  onClick={() =>
                    setForm(current => ({
                      ...current,
                      menus: [...current.menus, newMenu()],
                    }))
                  }
                >
                  <Plus size={14} /> 메뉴 추가
                </button>
              </div>
            </div>
            {pasteOpen && (
              <div className="am-create-paste-panel">
                <label className="am-field">
                  <span>메뉴와 가격 붙여넣기 · 최대 {pasteCapacity}개 추가</span>
                  <textarea
                    autoFocus
                    aria-label="여러 메뉴 붙여넣기"
                    value={pasteText}
                    onChange={event => setPasteText(event.target.value)}
                    rows={6}
                    placeholder={
                      "대표\n김치찌개\n9,000원\n된장찌개\n8,500원\n계란말이 12,000원"
                    }
                  />
                </label>
                <div className="am-paste-preview" aria-live="polite">
                  {pasted.errors.map((pasteError, index) => (
                    <p className="am-text-red" key={index}>
                      {pasteError}
                    </p>
                  ))}
                  {newPasteRows.length > pasteCapacity && (
                    <p className="am-text-red">
                      {pasteCapacity}개까지 추가할 수 있어요. 행 수를 줄여 주세요.
                    </p>
                  )}
                  <strong>{newPasteRows.length}개 메뉴 미리보기</strong>
                  {duplicatePasteCount > 0 && (
                    <small>
                      메뉴명·가격이 같은 중복 {duplicatePasteCount}개는 제외했어요.
                    </small>
                  )}
                  {pasted.ignoredDescriptions > 0 && (
                    <small>
                      메뉴명과 가격 사이의 설명·수량 안내{" "}
                      {pasted.ignoredDescriptions}줄은 메뉴에 넣지 않았어요.
                    </small>
                  )}
                  {pasteConflicts.map(conflict => (
                    <p className="am-text-red" key={conflict.name}>
                      검토 필요: ‘{conflict.name}’ 가격이{" "}
                      {conflict.prices.join(" / ")}로 서로 달라요. 추가한 뒤 실제
                      가격이 아닌 행을 수정하거나 삭제해 주세요.
                    </p>
                  ))}
                  <div className="am-paste-rows">
                    {newPasteRows.map((row, index) => (
                      <p key={`${row.name}-${row.price}-${index}`}>
                        <span>{row.name}</span>
                        <b>{row.price || "금액 미확인"}</b>
                      </p>
                    ))}
                  </div>
                  <small>
                    메뉴명·금액을 확인하세요. 추가한 뒤에도 수정할 수 있으며 식당
                    등록 전에는 저장되지 않아요.
                  </small>
                </div>
                <div className="am-create-paste-actions">
                  <button
                    type="button"
                    className="am-btn am-btn-white"
                    onClick={togglePastePanel}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="am-btn am-btn-primary"
                    disabled={
                      !newPasteRows.length ||
                      pasted.errors.length > 0 ||
                      newPasteRows.length > pasteCapacity
                    }
                    onClick={addPastedMenus}
                  >
                    <Plus size={14} /> {newPasteRows.length}개 메뉴 추가
                  </button>
                </div>
              </div>
            )}
            <div className="am-create-menus">
              {form.menus.map((menu, index) => (
                <div className="am-create-menu" key={menu.id}>
                  <span>{index + 1}</span>
                  <input
                    aria-label={`메뉴 ${index + 1} 이름`}
                    maxLength={200}
                    placeholder="메뉴명"
                    value={menu.name}
                    onChange={e => setMenu(menu.id, { name: e.target.value })}
                  />
                  <input
                    aria-label={`메뉴 ${index + 1} 가격`}
                    maxLength={120}
                    placeholder="가격 (예: 12,000원)"
                    value={menu.price}
                    onBlur={() =>
                      setMenu(menu.id, { price: formatMenuPrice(menu.price) })
                    }
                    onChange={e => setMenu(menu.id, { price: e.target.value })}
                  />
                  <button
                    type="button"
                    aria-label={`메뉴 ${index + 1} 삭제`}
                    disabled={form.menus.length === 1}
                    onClick={() =>
                      setForm(current => ({
                        ...current,
                        menus: current.menus.filter(
                          item => item.id !== menu.id
                        ),
                      }))
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </section>
          {error && (
            <p className="am-create-error" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <button
              type="button"
              className="am-btn am-btn-white"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              취소
            </button>
            <button
              type="submit"
              className="am-btn am-btn-primary"
              disabled={saving}
            >
              {saving ? (
                <Loader2 size={15} className="am-spin" />
              ) : (
                <Plus size={15} />
              )}
              {saving ? "등록 중" : "식당 등록"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
