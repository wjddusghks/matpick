import {
  Fragment,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  FilePenLine,
  LayoutDashboard,
  Link2,
  ListFilter,
  Loader2,
  MapPin,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Star,
  Store,
  Trash2,
  Tv,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { MenuItem, Restaurant, Source, SourceLink } from "@/data/types";
import {
  getAdminAppearances,
  groupAdminRestaurants,
  normalizeAdminRestaurantSearch,
} from "@/lib/adminRestaurantAppearances";
import {
  applyRestaurantEdits,
  type RestaurantEdit,
} from "@/lib/restaurantEdits";
import { getOperationState } from "@/lib/restaurantEligibility";
import {
  buildRestaurantChanges,
  formatMenuPrice,
  hasKnownMenuPrice,
  menuChangeSummary,
  parseMenuPaste,
  restoreRemovedMenus,
  validateRestaurantDraft,
  type DraftIssue,
  type EditorTab,
  type RemovedMenu,
  type RestaurantDraft,
} from "@/lib/adminRestaurantEditor";
import "./restaurant-manager.css";

const states = {
  unknown: "영업 미확인",
  operating: "영업 중",
  temporarily_closed: "휴업",
  moved: "이전",
  closed: "폐업",
};
const PAGE_SIZE = 30;
const noSourceLinks = (): SourceLink[] => [];
type Filter = "all" | "menus" | "prices" | "edited";
export type ManagerView = {
  selectedId?: string;
  query?: string;
  sourceId?: string;
  episodeKey?: string;
  viewMode?: "episodes" | "restaurants";
  filter?: Filter;
  page?: number;
  tab?: EditorTab;
  menuQuery?: string;
  menuFilter?: string;
  sort?: string;
  scrollTop?: number;
};
export type SaveRestaurantInput = {
  restaurantId: string;
  expectedRevision: number;
  action: "save" | "reset";
  changes: Record<string, unknown>;
};
type Props = {
  restaurants: Restaurant[];
  sources: Source[];
  initialEdits: RestaurantEdit[];
  getMenus: (restaurant: Restaurant) => MenuItem[];
  getSources: (id: string) => Source[];
  getSourceLinks?: (id: string) => SourceLink[];
  configured: boolean;
  ready: boolean;
  loadError?: string;
  onRetry: () => void;
  onSave: (input: SaveRestaurantInput) => Promise<RestaurantEdit>;
  onSaved?: (view: ManagerView) => void;
  initialView?: ManagerView;
  saved?: boolean;
};

function toDraft(restaurant: Restaurant, menus: MenuItem[]): RestaurantDraft {
  return {
    name: restaurant.name,
    address: restaurant.address,
    region: restaurant.region,
    category: restaurant.category,
    phone: restaurant.phone || "",
    lat: String(restaurant.lat),
    lng: String(restaurant.lng),
    operationState: getOperationState(restaurant),
    menus: menus.map(menu => ({
      ...menu,
      price: menu.price || "",
      description: menu.description || "",
    })),
    menuPriceVerifiedAt: (
      restaurant.menuPriceVerifiedAt ||
      restaurant.detailCollectedAt ||
      ""
    ).slice(0, 10),
    menuPriceNote: restaurant.menuPriceNote || "",
    menuPriceSources: (restaurant.menuPriceSources || []).map(source => ({
      url: source.url,
      label: source.label || "",
    })),
  };
}
function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  maxLength = 500,
  issue,
  children,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength?: number;
  issue?: DraftIssue | null;
  children?: ReactNode;
}) {
  return (
    <label className="am-field">
      <span>{label}</span>
      <input
        data-editor-field={name}
        value={value}
        type={type}
        maxLength={maxLength}
        step={type === "number" ? "any" : undefined}
        aria-invalid={issue?.field === name}
        onChange={e => onChange(e.target.value)}
      />
      {children && <small>{children}</small>}
    </label>
  );
}

export default function RestaurantManager({
  restaurants,
  sources,
  initialEdits,
  getMenus,
  getSources,
  getSourceLinks = noSourceLinks,
  configured,
  ready,
  loadError,
  onRetry,
  onSave,
  onSaved,
  initialView = {},
  saved = false,
}: Props) {
  const [edits, setEdits] = useState(initialEdits);
  const [query, setQuery] = useState(initialView.query || "");
  const deferredQuery = useDeferredValue(query);
  const [sourceId, setSourceId] = useState(initialView.sourceId || "");
  const [episodeKey, setEpisodeKey] = useState(initialView.episodeKey || "");
  const [viewMode, setViewMode] = useState<"episodes" | "restaurants">(
    initialView.viewMode || "episodes"
  );
  const [filter, setFilter] = useState<Filter>(initialView.filter || "all");
  const [sort, setSort] = useState(initialView.sort || "default");
  const [page, setPage] = useState(initialView.page || 1);
  const [selectedId, setSelectedId] = useState(
    initialView.selectedId || restaurants[0]?.id || ""
  );
  const [mobileEditor, setMobileEditor] = useState(
    Boolean(initialView.selectedId)
  );
  const [tab, setTab] = useState<EditorTab>(initialView.tab || "menus");
  const [draft, setDraft] = useState<RestaurantDraft | null>(null);
  const [initial, setInitial] = useState<RestaurantDraft | null>(null);
  const [menuQuery, setMenuQuery] = useState(initialView.menuQuery || "");
  const [menuFilter, setMenuFilter] = useState(initialView.menuFilter || "all");
  const [checked, setChecked] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [undo, setUndo] = useState<RemovedMenu[][]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(
    saved ? "수정한 정보를 저장했어요." : ""
  );
  const [error, setError] = useState("");
  const [issue, setIssue] = useState<DraftIssue | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [focusField, setFocusField] = useState("");
  const [pending, setPending] = useState<{
    kind: "switch" | "discard" | "exit" | "reset";
    value?: string;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const allowUnload = useRef(false);
  const restoredScroll = useRef(false);
  const records = useMemo(
    () => applyRestaurantEdits(restaurants, edits),
    [restaurants, edits]
  );
  const selected = records.find(r => r.id === selectedId);
  const edit = edits.find(e => e.restaurantId === selectedId);
  const dirty = Boolean(
    draft && initial && JSON.stringify(draft) !== JSON.stringify(initial)
  );
  const editIds = useMemo(
    () =>
      new Set(
        edits
          .filter(e => Object.keys(e.changes).length)
          .map(e => e.restaurantId)
      ),
    [edits]
  );
  const entries = useMemo(
    () =>
      records.map(restaurant => {
        const menus = getMenus(restaurant);
        const appearances = getAdminAppearances(
          getSourceLinks(restaurant.id),
          sources
        );
        return {
          restaurant,
          appearances,
          count: menus.length,
          priced: menus.filter(m => hasKnownMenuPrice(m.price)).length,
          sourceIds: getSources(restaurant.id).map(s => s.id),
          text: normalizeAdminRestaurantSearch(
            [
              restaurant.name,
              restaurant.address,
              restaurant.category,
              ...getSources(restaurant.id).map(s => s.name),
              ...appearances.map(
                a => `${a.sourceName} ${a.episode} ${a.date || ""}`
              ),
              ...menus.map(m => m.name),
            ].join(" ")
          ),
        };
      }),
    [records, getMenus, getSources, getSourceLinks, sources]
  );
  const episodeOptions = useMemo(
    () =>
      Array.from(
        new Map(
          entries
            .flatMap(e => e.appearances)
            .filter(a => !sourceId || a.sourceId === sourceId)
            .map(a => [a.key, a])
        ).values()
      ).sort(
        (a, b) =>
          a.sourceName.localeCompare(b.sourceName, "ko") ||
          (a.series || "").localeCompare(b.series || "", "ko") ||
          b.season - a.season ||
          b.episodeNumber - a.episodeNumber ||
          (a.part || "").localeCompare(b.part || "", "ko")
      ),
    [entries, sourceId]
  );
  const missingMenus = entries.filter(e => !e.count).length;
  useEffect(() => {
    if (episodeKey && !episodeOptions.some(a => a.key === episodeKey)) {
      setEpisodeKey("");
    }
  }, [episodeKey, episodeOptions]);
  const missingPrices = entries.filter(
    e => e.count && e.priced < e.count
  ).length;
  const filtered = useMemo(() => {
    const term = normalizeAdminRestaurantSearch(deferredQuery.trim());
    const items = entries.filter(
      e =>
        (!term || e.text.includes(term)) &&
        (!sourceId || e.sourceIds.includes(sourceId)) &&
        (!episodeKey || e.appearances.some(a => a.key === episodeKey)) &&
        (filter === "all" ||
          (filter === "menus" && !e.count) ||
          (filter === "prices" && e.count > e.priced) ||
          (filter === "edited" && editIds.has(e.restaurant.id)))
    );
    if (sort === "name")
      items.sort((a, b) =>
        a.restaurant.name.localeCompare(b.restaurant.name, "ko")
      );
    if (sort === "menus") items.sort((a, b) => a.count - b.count);
    return items;
  }, [entries, deferredQuery, sourceId, episodeKey, filter, editIds, sort]);
  const episodeGroups = useMemo(
    () => groupAdminRestaurants(filtered, sourceId, episodeKey),
    [filtered, sourceId, episodeKey]
  );
  const listRows = useMemo(
    () =>
      viewMode === "episodes"
        ? episodeGroups.flatMap(group =>
            group.entries.map(entry => ({ entry, group }))
          )
        : filtered.map(entry => ({ entry, group: null })),
    [viewMode, episodeGroups, filtered]
  );
  const pageCount = Math.max(1, Math.ceil(listRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = listRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [sourceId, episodeKey, filter, currentPage, viewMode, deferredQuery]);
  const menuRows = (draft?.menus || []).filter(
    menu =>
      (!menuQuery.trim() ||
        menu.name.toLowerCase().includes(menuQuery.trim().toLowerCase())) &&
      (menuFilter === "all" ||
        (menuFilter === "missing" && !hasKnownMenuPrice(menu.price)) ||
        (menuFilter === "signature" && menu.isSignature))
  );
  const pricedCount =
    draft?.menus.filter(m => hasKnownMenuPrice(m.price)).length || 0;
  const summary = menuChangeSummary(initial?.menus || [], draft?.menus || []);
  const pasted = useMemo(() => parseMenuPaste(pasteText), [pasteText]);
  const capacity = 100 - (draft?.menus.length || 0);
  const selectedSources = selected ? getSources(selected.id) : [];
  const selectedAppearances =
    entries.find(e => e.restaurant.id === selectedId)?.appearances || [];

  useEffect(() => {
    setEdits(initialEdits);
  }, [initialEdits]);
  useEffect(() => {
    if (!ready || !selected) return;
    const next = toDraft(selected, getMenus(selected));
    setDraft(next);
    setInitial(next);
    setChecked([]);
    setExpanded([]);
    setUndo([]);
    setIssue(null);
  }, [ready, selected, getMenus]);
  useEffect(() => {
    if (!draft || restoredScroll.current) return;
    restoredScroll.current = true;
    if (bodyRef.current) bodyRef.current.scrollTop = initialView.scrollTop || 0;
  }, [draft, initialView.scrollTop]);
  useEffect(() => {
    if (!focusField) return;
    const field = Array.from(
      formRef.current?.querySelectorAll<HTMLInputElement>(
        "[data-editor-field]"
      ) || []
    ).find(e => e.dataset.editorField === focusField);
    field?.focus();
    field?.scrollIntoView({ block: "nearest" });
    setFocusField("");
  }, [focusField, tab, draft]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!allowUnload.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (
          dirty &&
          !saving &&
          configured &&
          !pasteOpen &&
          !pending &&
          !event.isComposing
        )
          formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [dirty, saving, configured, pasteOpen, pending]);

  function update<K extends keyof RestaurantDraft>(
    key: K,
    value: RestaurantDraft[K]
  ) {
    setDraft(current => (current ? { ...current, [key]: value } : current));
    setStatus("");
  }
  function updateMenu(id: string, patch: Partial<MenuItem>) {
    setDraft(current =>
      current
        ? {
            ...current,
            menus: current.menus.map(m =>
              m.id === id ? { ...m, ...patch } : m
            ),
          }
        : current
    );
    setStatus("");
  }
  function chooseDirect(id: string) {
    setSelectedId(id);
    setMobileEditor(true);
    setTab("menus");
    setMenuQuery("");
    setMenuFilter("all");
    setError("");
    setStatus("");
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }
  function choose(id: string) {
    if (saving) return;
    if (id === selectedId) {
      setMobileEditor(true);
      return;
    }
    if (dirty) setPending({ kind: "switch", value: id });
    else chooseDirect(id);
  }
  function leave(event: React.MouseEvent<HTMLAnchorElement>, url: string) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0)
      return;
    if (saving || dirty) {
      event.preventDefault();
      if (!saving) setPending({ kind: "exit", value: url });
    }
  }
  function setQuickFilter(value: Filter) {
    setFilter(value);
    setPage(1);
    setMobileEditor(false);
  }
  function addMenus(rows = [{ name: "", price: "" }]) {
    if (!draft || rows.length > capacity) return;
    const menus = rows.map(row => ({
      ...row,
      id: `draft-${crypto.randomUUID()}`,
      isSignature: false,
      description: "",
    }));
    update("menus", [...menus, ...draft.menus]);
    setMenuQuery("");
    setMenuFilter("all");
    setTab("menus");
    setChecked([]);
    setFocusField(`name-${menus[0].id}`);
    setPasteOpen(false);
    setPasteText("");
  }
  function removeMenus(ids: string[]) {
    if (!draft) return;
    const removed = draft.menus.flatMap((menu, index) =>
      ids.includes(menu.id) ? [{ index, menu }] : []
    );
    setUndo(stack => [...stack.slice(-19), removed]);
    update(
      "menus",
      draft.menus.filter(m => !ids.includes(m.id))
    );
    setChecked([]);
  }
  function undoDelete() {
    if (!draft || !undo.length) return;
    const removed = undo[undo.length - 1];
    if (draft.menus.length + removed.length > 100) {
      setError(
        "되돌리면 메뉴가 100개를 넘어요. 새로 추가한 메뉴를 먼저 정리해 주세요."
      );
      return;
    }
    update("menus", restoreRemovedMenus(draft.menus, removed));
    setUndo(stack => stack.slice(0, -1));
    setMenuQuery("");
    setMenuFilter("all");
  }
  async function save(action: "save" | "reset") {
    if (!draft || !initial || !selected || saving || !configured) return;
    const problem =
      action === "save" ? validateRestaurantDraft(draft, initial) : null;
    if (problem) {
      setIssue(problem);
      setError(problem.message);
      setTab(problem.tab);
      setMenuQuery("");
      setMenuFilter("all");
      setFocusField(problem.field);
      return;
    }
    setSaving(true);
    setError("");
    setIssue(null);
    try {
      const savedEdit = await onSave({
        restaurantId: selected.id,
        expectedRevision: edit?.revision || 0,
        action,
        changes:
          action === "reset" ? {} : buildRestaurantChanges(draft, initial),
      });
      const view = {
        selectedId,
        query,
        sourceId,
        episodeKey,
        viewMode,
        filter,
        page: currentPage,
        sort,
        tab,
        menuQuery,
        menuFilter,
        scrollTop: bodyRef.current?.scrollTop || 0,
      };
      setEdits(current => [
        ...current.filter(item => item.restaurantId !== savedEdit.restaurantId),
        savedEdit,
      ]);
      setInitial(draft);
      setUndo([]);
      setChecked([]);
      setStatus(
        action === "reset"
          ? "수집 원본으로 복원했어요."
          : "수정한 정보를 저장했어요."
      );
      if (onSaved) {
        allowUnload.current = true;
        onSaved(view);
      } else setSaving(false);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "저장하지 못했어요. 입력 내용은 그대로 남아 있어요."
      );
      setSaving(false);
    }
  }
  function confirmPending() {
    const action = pending;
    setPending(null);
    if (action?.kind === "switch" && action.value) chooseDirect(action.value);
    if (action?.kind === "discard" && initial) {
      setDraft(structuredClone(initial));
      setUndo([]);
      setChecked([]);
      setIssue(null);
      setError("");
    }
    if (action?.kind === "exit" && action.value) {
      allowUnload.current = true;
      window.location.assign(action.value);
    }
    if (action?.kind === "reset") void save("reset");
  }

  return (
    <main className={`am ${mobileEditor ? "am-show-editor" : ""}`}>
      <nav className="am-rail" aria-label="관리자 탐색">
        <a
          href="/admin"
          className="am-brand"
          onClick={e => leave(e, "/admin")}
          aria-label="맛픽 관리자 홈"
        >
          <span>
            <Utensils size={22} />
          </span>
          <strong>
            맛픽<small>ADMIN WORKSPACE</small>
          </strong>
        </a>
        <p className="am-nav-caption">WORKSPACE</p>
        <a
          href="/admin"
          className="am-nav-item"
          onClick={e => leave(e, "/admin")}
          title="운영 대시보드"
        >
          <LayoutDashboard size={19} />
          <span>운영 대시보드</span>
        </a>
        <a
          href="/admin/restaurants"
          className="am-nav-item am-nav-active"
          aria-current="page"
          onClick={e => e.preventDefault()}
          title="식당·메뉴 관리"
        >
          <Store size={19} />
          <span>식당·메뉴 관리</span>
          <i />
        </a>
        <a
          href="/admin/topic-research"
          className="am-nav-item"
          onClick={e => leave(e, "/admin/topic-research")}
          title="주제별 식당 후보 검토"
        >
          <Search size={19} />
          <span>식당 후보 검토</span>
        </a>
        <div className="am-rail-bottom">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="am-nav-item"
            title="맛픽 사이트 보기"
          >
            <ArrowUpRight size={19} />
            <span>맛픽 사이트 보기</span>
          </a>
          <div className="am-admin-badge">
            <ShieldCheck size={21} />
            <span>
              관리자<small>콘텐츠 관리</small>
            </span>
          </div>
        </div>
      </nav>
      <div className="am-main">
        <header className="am-page-header">
          <div>
            <div className="am-breadcrumb">
              <a href="/admin" onClick={e => leave(e, "/admin")}>
                관리자
              </a>
              <ChevronRight size={12} />
              콘텐츠 관리
            </div>
            <h1>
              식당·메뉴 관리<span>WORKSPACE</span>
            </h1>
          </div>
          <div className="am-header-actions">
            <span
              className={`am-connection ${ready && configured ? "is-connected" : ""}`}
            >
              <i />
              {!ready ? "연결 중" : configured ? "저장소 연결됨" : "조회 전용"}
            </span>
            <a
              className="am-btn am-btn-white"
              href="/"
              target="_blank"
              rel="noreferrer"
            >
              사이트 보기
              <ArrowUpRight size={15} />
            </a>
          </div>
        </header>
        <section className="am-stats" aria-label="식당 데이터 현황">
          {(
            [
              {
                key: "all",
                label: "전체 식당",
                count: records.length,
                note: "맛픽에 등록된 모든 식당",
                icon: Store,
                tone: "rose",
              },
              {
                key: "menus",
                label: "메뉴 미등록",
                count: missingMenus,
                note: "메뉴를 채워 주세요",
                icon: Utensils,
                tone: "violet",
              },
              {
                key: "prices",
                label: "가격 보완 필요",
                count: missingPrices,
                note: "일부 또는 전체 가격 누락",
                icon: Wallet,
                tone: "amber",
              },
              {
                key: "edited",
                label: "직접 수정한 식당",
                count: editIds.size,
                note: "관리자가 저장한 정보",
                icon: FilePenLine,
                tone: "green",
              },
            ] as const
          ).map(stat => (
            <button
              key={stat.key}
              className={`am-stat am-tone-${stat.tone} ${filter === stat.key ? "is-active" : ""}`}
              onClick={() => setQuickFilter(stat.key)}
              aria-pressed={filter === stat.key}
            >
              <span className="am-stat-icon">
                <stat.icon size={20} />
              </span>
              <span className="am-stat-content">
                <span>{stat.label}</span>
                <strong>
                  {ready ? stat.count.toLocaleString() : "—"}
                  <small>곳</small>
                </strong>
                <small>{stat.note}</small>
              </span>
              <ArrowUpRight size={16} className="am-stat-arrow" />
            </button>
          ))}
        </section>
        {loadError && (
          <div className="am-banner am-error" role="alert">
            {loadError}
            <button onClick={onRetry}>다시 불러오기</button>
          </div>
        )}
        {ready && !configured && (
          <div className="am-banner am-warning" role="alert">
            저장소가 연결되지 않아 조회만 가능해요. 연결 후 수정할 수 있습니다.
          </div>
        )}
        <div className="am-workspace">
          <section className="am-list" aria-label="식당 목록">
            <div className="am-list-head">
              <div className="am-section-heading">
                <h2>
                  식당 목록 <span>{filtered.length.toLocaleString()}</span>
                </h2>
                <ListFilter size={17} />
              </div>
              <div className="am-view-switch" aria-label="식당 목록 보기 방식">
                <button
                  aria-pressed={viewMode === "episodes"}
                  onClick={() => {
                    setViewMode("episodes");
                    setPage(1);
                  }}
                >
                  <Tv size={14} /> 방송·회차별
                </button>
                <button
                  aria-pressed={viewMode === "restaurants"}
                  onClick={() => {
                    setViewMode("restaurants");
                    setPage(1);
                  }}
                >
                  <Store size={14} /> 식당별
                </button>
              </div>
              <label className="am-search">
                <Search size={17} />
                <input
                  ref={searchRef}
                  aria-label="식당 검색"
                  placeholder="식당명, 방송·회차, 지역, 메뉴 검색"
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                />
                {query && (
                  <button
                    aria-label="식당 검색 지우기"
                    onClick={() => {
                      setQuery("");
                      setPage(1);
                      searchRef.current?.focus();
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              <div className="am-list-filters">
                <select
                  aria-label="주제 필터"
                  value={sourceId}
                  onChange={e => {
                    setSourceId(e.target.value);
                    setEpisodeKey("");
                    setPage(1);
                  }}
                >
                  <option value="">모든 방송·가이드</option>
                  {sources.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="식당 정렬"
                  value={sort}
                  onChange={e => {
                    setSort(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="default">기본순</option>
                  <option value="name">이름순</option>
                  <option value="menus">메뉴 적은 순</option>
                </select>
              </div>
              {episodeOptions.length > 0 && (
                <label className="am-episode-filter">
                  <Tv size={15} />
                  <select
                    aria-label="방송 회차 필터"
                    value={episodeKey}
                    onChange={e => {
                      setEpisodeKey(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">
                      모든 회차 · {episodeOptions.length}개
                    </option>
                    {episodeOptions.map(a => (
                      <option value={a.key} key={a.key}>
                        {sourceId ? "" : `${a.sourceName} · `}
                        {a.episode}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {viewMode === "episodes" && (
                <p className="am-group-note">
                  프로그램별 최신 회차부터 묶었어요. 여러 회차에 나온 식당은 각
                  회차에 표시됩니다.
                </p>
              )}
              <div className="am-pills" aria-label="확인 상태 필터">
                {(
                  [
                    ["all", "전체"],
                    ["menus", "메뉴 없음"],
                    ["prices", "가격 보완"],
                    ["edited", "수정됨"],
                  ] as const
                ).map(([key, text]) => (
                  <button
                    key={key}
                    aria-pressed={filter === key}
                    className={filter === key ? "is-active" : ""}
                    onClick={() => {
                      setFilter(key);
                      setPage(1);
                    }}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
            <div className="am-list-scroll" ref={listRef} aria-busy={!ready}>
              {!ready ? (
                <div className="am-empty">
                  <Loader2 className="am-spin" />
                  <strong>식당을 불러오고 있어요</strong>
                </div>
              ) : (
                pageRows.map(
                  (
                    {
                      entry: { restaurant: r, count, priced, appearances },
                      group,
                    },
                    index
                  ) => (
                    <Fragment key={`${group?.key || "list"}:${r.id}`}>
                      {group &&
                        (index === 0 ||
                          pageRows[index - 1].group?.key !== group.key) && (
                          <div className="am-episode-group-heading">
                            <span className="am-episode-number">
                              {group.appearance
                                ? `${group.appearance.episodeNumber}회${group.appearance.part ? ` ${group.appearance.part}부` : ""}`
                                : "미확인"}
                            </span>
                            <div>
                              <h3>
                                {group.appearance?.sourceName ||
                                  sources.find(s => s.id === sourceId)?.name ||
                                  "회차 정보 없는 식당"}
                              </h3>
                              <p>
                                {group.appearance
                                  ? `${group.appearance.series ? `${group.appearance.series} · ` : ""}${group.appearance.season ? `시즌 ${group.appearance.season} · ` : ""}${group.entries.length}곳`
                                  : "회차를 임의로 지정하지 않았어요"}
                              </p>
                            </div>
                            {group.appearance?.date && (
                              <time>{group.appearance.date.slice(0, 10)}</time>
                            )}
                          </div>
                        )}
                      <button
                        key={r.id}
                        className={`am-restaurant ${selectedId === r.id ? "is-selected" : ""}`}
                        aria-pressed={selectedId === r.id}
                        onClick={() => choose(r.id)}
                        disabled={saving}
                      >
                        <div className="am-restaurant-title">
                          <strong>{r.name}</strong>
                          {selectedId === r.id ? (
                            <ChevronRight size={17} />
                          ) : editIds.has(r.id) ? (
                            <FilePenLine size={14} />
                          ) : null}
                        </div>
                        <p>{r.address}</p>
                        {viewMode === "restaurants" &&
                          appearances.length > 0 && (
                            <div className="am-episode-badges">
                              {appearances
                                .filter(
                                  a => !sourceId || a.sourceId === sourceId
                                )
                                .slice(0, 2)
                                .map(a => (
                                  <span
                                    key={a.key}
                                    title={`${a.sourceName} · ${a.episode}${a.date ? ` · ${a.date}` : ""}`}
                                  >
                                    <Tv size={11} />
                                    {a.sourceName} <b>{a.episode}</b>
                                  </span>
                                ))}
                              {appearances.filter(
                                a => !sourceId || a.sourceId === sourceId
                              ).length > 2 && (
                                <small>
                                  +
                                  {appearances.filter(
                                    a => !sourceId || a.sourceId === sourceId
                                  ).length - 2}
                                  개 회차
                                </small>
                              )}
                            </div>
                          )}
                        <div className="am-restaurant-meta">
                          <span>
                            <Utensils size={11} />
                            메뉴 {count}
                          </span>
                          <span
                            className={
                              !count
                                ? "am-muted"
                                : priced < count
                                  ? "am-text-amber"
                                  : "am-text-green"
                            }
                          >
                            {!count ? (
                              "미등록"
                            ) : priced < count ? (
                              `가격 ${priced}/${count}`
                            ) : (
                              <>
                                <Check size={11} />
                                가격 완료
                              </>
                            )}
                          </span>
                          {["closed", "moved", "temporarily_closed"].includes(
                            getOperationState(r)
                          ) && (
                            <span className="am-text-red">
                              {states[getOperationState(r)]}
                            </span>
                          )}
                        </div>
                      </button>
                    </Fragment>
                  )
                )
              )}
              {ready && !filtered.length && (
                <div className="am-empty">
                  <Search />
                  <strong>일치하는 식당이 없어요</strong>
                  <p>다른 검색어나 필터로 찾아보세요.</p>
                  <button
                    className="am-btn"
                    onClick={() => {
                      setQuery("");
                      setFilter("all");
                      setSourceId("");
                      setEpisodeKey("");
                      setPage(1);
                    }}
                  >
                    검색 조건 초기화
                  </button>
                </div>
              )}
            </div>
            <footer className="am-pagination">
              <span>
                {currentPage} <small>/ {pageCount} 페이지</small>
              </span>
              <div>
                <button
                  aria-label="이전 페이지"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  aria-label="다음 페이지"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </footer>
          </section>
          <section className="am-editor" aria-label="식당 편집">
            {!ready || !selected || !draft || !initial ? (
              <div className="am-empty am-editor-empty">
                <span className="am-empty-icon">
                  <Store size={28} />
                </span>
                <h2>
                  {!ready
                    ? "정보를 불러오고 있어요"
                    : "어떤 식당을 수정할까요?"}
                </h2>
                <p>
                  목록에서 식당을 선택하면 메뉴와 가격을 바로 편집할 수 있어요.
                </p>
              </div>
            ) : (
              <form
                ref={formRef}
                className="am-editor-form"
                noValidate
                onSubmit={e => {
                  e.preventDefault();
                  if (dirty) void save("save");
                }}
              >
                <header className="am-editor-header">
                  <button
                    type="button"
                    className="am-mobile-back am-icon-btn"
                    aria-label="식당 목록으로 돌아가기"
                    onClick={() => setMobileEditor(false)}
                  >
                    <ArrowLeft size={19} />
                  </button>
                  <div className="am-store-avatar">
                    {draft.name.replace(/^(서울|부산|제주)\s/, "").slice(0, 1)}
                  </div>
                  <div className="am-editor-heading">
                    <div className="am-editor-title">
                      <h2>{draft.name || selected.name}</h2>
                      <span
                        className={`am-state ${draft.operationState === "operating" ? "is-open" : ""}`}
                      >
                        <i />
                        {states[draft.operationState]}
                      </span>
                    </div>
                    <p>
                      <MapPin size={12} />
                      {draft.address}
                    </p>
                    <div className="am-source-chips">
                      {selectedSources.slice(0, 3).map(s => (
                        <span key={s.id}>{s.name}</span>
                      ))}
                      {selectedSources.length > 3 && (
                        <span>+{selectedSources.length - 3}</span>
                      )}
                    </div>
                    {selectedAppearances.length > 0 && (
                      <div className="am-episode-badges am-episode-detail">
                        {selectedAppearances.map(a => (
                          <a
                            key={a.key}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Tv size={12} />
                            {a.sourceName} <b>{a.episode}</b>
                            {a.date && <small>{a.date}</small>}
                            <ArrowUpRight size={12} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <a
                    className="am-icon-btn am-detail-link"
                    title="사용자 상세 화면 보기"
                    aria-label="사용자 상세 화면 보기"
                    href={`/restaurant/${encodeURIComponent(selected.id)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ArrowUpRight size={19} />
                  </a>
                </header>
                <Tabs.Root
                  value={tab}
                  onValueChange={value => setTab(value as EditorTab)}
                  className="am-tabs"
                >
                  <Tabs.List
                    className="am-tab-list"
                    aria-label="식당 편집 항목"
                  >
                    <Tabs.Trigger disabled={saving} value="menus">
                      <Utensils size={15} />
                      메뉴·가격<span>{draft.menus.length}</span>
                    </Tabs.Trigger>
                    <Tabs.Trigger disabled={saving} value="info">
                      <Store size={15} />
                      기본정보
                    </Tabs.Trigger>
                    <Tabs.Trigger disabled={saving} value="sources">
                      <Link2 size={15} />
                      출처·메모
                    </Tabs.Trigger>
                  </Tabs.List>
                  <div className="am-editor-body" ref={bodyRef}>
                    <Tabs.Content value="menus" className="am-tab-content">
                      <fieldset disabled={saving || !configured}>
                        <div className="am-menu-heading">
                          <div>
                            <h3>메뉴와 가격</h3>
                            <p>메뉴명과 가격을 눌러 바로 수정하세요.</p>
                          </div>
                          <div className="am-menu-actions">
                            <button
                              type="button"
                              className="am-btn am-btn-white am-paste-button"
                              onClick={() => setPasteOpen(true)}
                              disabled={capacity <= 0}
                            >
                              <ClipboardPaste size={15} />
                              <span>여러 메뉴 추가</span>
                            </button>
                            <button
                              type="button"
                              className="am-btn am-btn-primary"
                              onClick={() => addMenus()}
                              disabled={capacity <= 0}
                            >
                              <Plus size={17} />
                              메뉴 추가
                            </button>
                          </div>
                        </div>
                        <div className="am-menu-tools">
                          <label className="am-search am-menu-search">
                            <Search size={15} />
                            <input
                              aria-label="메뉴 검색"
                              placeholder="메뉴 찾기"
                              value={menuQuery}
                              onChange={e => {
                                setMenuQuery(e.target.value);
                                setChecked([]);
                              }}
                            />
                            {menuQuery && (
                              <button
                                type="button"
                                aria-label="메뉴 검색 지우기"
                                onClick={() => setMenuQuery("")}
                              >
                                <X size={13} />
                              </button>
                            )}
                          </label>
                          <select
                            aria-label="메뉴 보기 필터"
                            value={menuFilter}
                            onChange={e => {
                              setMenuFilter(e.target.value);
                              setChecked([]);
                            }}
                          >
                            <option value="all">
                              전체 메뉴 {draft.menus.length}
                            </option>
                            <option value="missing">
                              금액 미확인 {draft.menus.length - pricedCount}
                            </option>
                            <option value="signature">대표 메뉴</option>
                          </select>
                          <span className="am-menu-progress">
                            <span>
                              가격 입력{" "}
                              <b>
                                {pricedCount}/{draft.menus.length}
                              </b>
                            </span>
                            <i>
                              <i
                                style={{
                                  width: `${draft.menus.length ? (pricedCount / draft.menus.length) * 100 : 0}%`,
                                }}
                              />
                            </i>
                          </span>
                        </div>
                        {undo.length > 0 && (
                          <div className="am-undo" role="status">
                            <span>
                              메뉴 {undo[undo.length - 1].length}개를
                              삭제했어요. 저장 전까지 되돌릴 수 있어요.
                            </span>
                            <button type="button" onClick={undoDelete}>
                              <RotateCcw size={13} />
                              되돌리기
                            </button>
                          </div>
                        )}
                        {checked.length > 0 && (
                          <div className="am-bulk">
                            <span>
                              <CheckCheck size={15} />
                              <b>{checked.length}개 선택</b>
                            </span>
                            <button
                              type="button"
                              onClick={() => removeMenus(checked)}
                            >
                              <Trash2 size={14} />
                              선택 삭제
                            </button>
                            <button
                              type="button"
                              className="am-icon-btn"
                              aria-label="메뉴 선택 해제"
                              onClick={() => setChecked([])}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                        {draft.menus.length > 0 && (
                          <div className="am-table-head">
                            <input
                              type="checkbox"
                              aria-label="표시된 메뉴 전체 선택"
                              checked={
                                menuRows.length > 0 &&
                                menuRows.every(m => checked.includes(m.id))
                              }
                              onChange={e =>
                                setChecked(
                                  e.target.checked
                                    ? menuRows.map(m => m.id)
                                    : []
                                )
                              }
                            />
                            <span>대표</span>
                            <span>메뉴명</span>
                            <span className="am-price-label">가격</span>
                            <span className="am-row-action-label">관리</span>
                          </div>
                        )}
                        <div
                          className="am-menu-table"
                          aria-label="메뉴 편집 목록"
                        >
                          {menuRows.map(menu => {
                            const original = initial.menus.find(
                              m => m.id === menu.id
                            );
                            const isNew = !original;
                            const changed =
                              original &&
                              JSON.stringify(original) !== JSON.stringify(menu);
                            const index =
                              draft.menus.findIndex(m => m.id === menu.id) + 1;
                            return (
                              <div
                                key={menu.id}
                                className={`am-menu-row ${isNew ? "is-new" : changed ? "is-changed" : ""} ${checked.includes(menu.id) ? "is-checked" : ""}`}
                              >
                                <input
                                  className="am-row-check"
                                  type="checkbox"
                                  aria-label={`메뉴 ${index} 선택`}
                                  checked={checked.includes(menu.id)}
                                  onChange={e =>
                                    setChecked(current =>
                                      e.target.checked
                                        ? [...current, menu.id]
                                        : current.filter(id => id !== menu.id)
                                    )
                                  }
                                />
                                <button
                                  type="button"
                                  className={`am-signature ${menu.isSignature ? "is-signature" : ""}`}
                                  aria-label={`메뉴 ${index} 대표 메뉴`}
                                  aria-pressed={Boolean(menu.isSignature)}
                                  title="대표 메뉴로 표시"
                                  onClick={() =>
                                    updateMenu(menu.id, {
                                      isSignature: !menu.isSignature,
                                    })
                                  }
                                >
                                  <Star size={17} />
                                </button>
                                <div className="am-menu-name">
                                  <input
                                    aria-label={`메뉴명 ${index}`}
                                    data-editor-field={`name-${menu.id}`}
                                    aria-invalid={
                                      issue?.field === `name-${menu.id}`
                                    }
                                    maxLength={200}
                                    value={menu.name}
                                    placeholder="메뉴 이름 입력"
                                    onChange={e =>
                                      updateMenu(menu.id, {
                                        name: e.target.value,
                                      })
                                    }
                                  />
                                  {isNew ? (
                                    <small className="am-new-label">NEW</small>
                                  ) : changed ? (
                                    <span
                                      className="am-change-dot"
                                      title="수정한 메뉴"
                                    />
                                  ) : null}
                                </div>
                                <input
                                  className={`am-price ${!hasKnownMenuPrice(menu.price) ? "is-missing" : ""}`}
                                  aria-label={`가격 ${index}`}
                                  data-editor-field={`price-${menu.id}`}
                                  aria-invalid={
                                    issue?.field === `price-${menu.id}`
                                  }
                                  maxLength={120}
                                  value={menu.price || ""}
                                  placeholder="금액 미확인"
                                  onChange={e =>
                                    updateMenu(menu.id, {
                                      price: e.target.value,
                                    })
                                  }
                                  onBlur={e => {
                                    const formatted = formatMenuPrice(
                                      e.target.value
                                    );
                                    if (formatted !== e.target.value)
                                      updateMenu(menu.id, { price: formatted });
                                  }}
                                />
                                <div className="am-row-actions">
                                  <button
                                    type="button"
                                    className={`am-icon-btn ${expanded.includes(menu.id) ? "is-active" : ""}`}
                                    aria-label={`메뉴 ${index} 설명 편집`}
                                    aria-expanded={expanded.includes(menu.id)}
                                    title="메뉴 설명"
                                    onClick={() =>
                                      setExpanded(current =>
                                        current.includes(menu.id)
                                          ? current.filter(id => id !== menu.id)
                                          : [...current, menu.id]
                                      )
                                    }
                                  >
                                    <ChevronDown size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    className="am-icon-btn am-delete"
                                    aria-label={`메뉴 ${index} 삭제`}
                                    title="메뉴 삭제"
                                    onClick={() => removeMenus([menu.id])}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                                {expanded.includes(menu.id) && (
                                  <label className="am-menu-description">
                                    메뉴 설명
                                    <input
                                      aria-label={`메뉴 설명 ${index}`}
                                      value={menu.description || ""}
                                      maxLength={500}
                                      placeholder="양, 구성, 주문 조건 등을 적어 주세요"
                                      onChange={e =>
                                        updateMenu(menu.id, {
                                          description: e.target.value,
                                        })
                                      }
                                    />
                                  </label>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {!menuRows.length && (
                          <div className="am-empty am-menu-empty">
                            <span className="am-empty-icon">
                              <Utensils size={26} />
                            </span>
                            <strong>
                              {draft.menus.length
                                ? "조건에 맞는 메뉴가 없어요"
                                : "첫 메뉴를 등록해 주세요"}
                            </strong>
                            <p>
                              {draft.menus.length
                                ? "검색어나 메뉴 필터를 변경해 보세요."
                                : "메뉴 이름과 가격만 있으면 충분해요."}
                            </p>
                            {!draft.menus.length && (
                              <button
                                type="button"
                                className="am-btn am-btn-primary"
                                onClick={() => addMenus()}
                              >
                                <Plus size={16} />첫 메뉴 추가
                              </button>
                            )}
                          </div>
                        )}
                        {draft.menus.length > 0 && (
                          <button
                            type="button"
                            className="am-add-row"
                            onClick={() => addMenus()}
                            disabled={capacity <= 0}
                          >
                            <Plus size={16} />
                            {capacity > 0
                              ? "새 메뉴 추가"
                              : "메뉴 100개 등록 완료"}
                          </button>
                        )}
                        <div className="am-menu-footnote">
                          <Star size={13} />
                          <span>
                            별표는 대표 메뉴로 노출돼요. 가격은 숫자만 입력해도
                            원 단위로 정리돼요. ‘싯가’도 입력할 수 있어요.
                          </span>
                        </div>
                      </fieldset>
                    </Tabs.Content>
                    <Tabs.Content value="info" className="am-tab-content">
                      <fieldset
                        disabled={saving || !configured}
                        className="am-info-content"
                      >
                        <div className="am-content-title">
                          <span className="am-section-icon">
                            <Store size={19} />
                          </span>
                          <div>
                            <h3>식당 기본정보</h3>
                            <p>이름, 위치, 영업 상태를 한곳에서 관리하세요.</p>
                          </div>
                        </div>
                        <div className="am-reference-links">
                          <a
                            className="am-btn am-btn-white"
                            href={`https://map.naver.com/p/search/${encodeURIComponent(draft.name + " " + draft.address)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            네이버지도 확인
                            <ArrowUpRight size={14} />
                          </a>
                          <a
                            className="am-btn am-btn-white"
                            href={`https://map.kakao.com/?q=${encodeURIComponent(draft.name + " " + draft.address)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            카카오지도 확인
                            <ArrowUpRight size={14} />
                          </a>
                          {selected.locationVerifiedAt && (
                            <small>
                              위치 확인{" "}
                              {selected.locationVerifiedAt.slice(0, 10)}
                            </small>
                          )}
                        </div>
                        <div className="am-field-grid">
                          <Field
                            name="name"
                            label="식당명"
                            value={draft.name}
                            onChange={v => update("name", v)}
                            maxLength={200}
                            issue={issue}
                          />
                          <Field
                            name="category"
                            label="음식 종류"
                            value={draft.category}
                            onChange={v => update("category", v)}
                            maxLength={100}
                            issue={issue}
                          />
                          <Field
                            name="region"
                            label="지역"
                            value={draft.region}
                            onChange={v => update("region", v)}
                            maxLength={100}
                            issue={issue}
                          />
                          <Field
                            name="phone"
                            label="전화번호"
                            value={draft.phone}
                            onChange={v => update("phone", v)}
                            type="tel"
                            maxLength={80}
                          />
                          <div className="am-full">
                            <Field
                              name="address"
                              label="주소"
                              value={draft.address}
                              onChange={v => update("address", v)}
                              issue={issue}
                            />
                          </div>
                          <Field
                            name="lat"
                            label="위도"
                            value={draft.lat}
                            onChange={v => update("lat", v)}
                            type="number"
                            issue={issue}
                          />
                          <Field
                            name="lng"
                            label="경도"
                            value={draft.lng}
                            onChange={v => update("lng", v)}
                            type="number"
                            issue={issue}
                          />
                        </div>
                        <p className="am-inline-tip">
                          <MapPin size={14} />
                          주소를 변경했다면 지도에 표시될 위도·경도도 확인해
                          주세요.
                        </p>
                        <div className="am-operation">
                          <label className="am-field">
                            <span>영업 상태</span>
                            <select
                              value={draft.operationState}
                              onChange={e =>
                                update(
                                  "operationState",
                                  e.target
                                    .value as RestaurantDraft["operationState"]
                                )
                              }
                            >
                              {Object.entries(states).map(([key, value]) => (
                                <option key={key} value={key}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          </label>
                          <p>
                            휴업·폐업·이전으로 저장한 식당은 추천 목록에서
                            제외됩니다.
                          </p>
                        </div>
                      </fieldset>
                    </Tabs.Content>
                    <Tabs.Content value="sources" className="am-tab-content">
                      <fieldset
                        disabled={saving || !configured}
                        className="am-info-content"
                      >
                        <div className="am-content-title">
                          <span className="am-section-icon">
                            <ShieldCheck size={20} />
                          </span>
                          <div>
                            <h3>믿을 수 있는 메뉴 정보</h3>
                            <p>
                              확인한 날짜와 출처를 남겨 다음 관리를 편하게
                              하세요.
                            </p>
                          </div>
                        </div>
                        <div className="am-date-row">
                          <Field
                            name="menuPriceVerifiedAt"
                            label="가격 정보를 확인한 날짜"
                            value={draft.menuPriceVerifiedAt}
                            onChange={v => update("menuPriceVerifiedAt", v)}
                            type="date"
                            issue={issue}
                          />
                          <button
                            type="button"
                            className="am-btn am-btn-white"
                            onClick={() =>
                              update(
                                "menuPriceVerifiedAt",
                                new Date().toLocaleDateString("en-CA", {
                                  timeZone: "Asia/Seoul",
                                })
                              )
                            }
                          >
                            오늘로 입력
                          </button>
                        </div>
                        <p className="am-inline-tip">
                          실제로 확인한 날짜만 입력해 주세요. 확인하지 않았다면
                          비워 두세요.
                        </p>
                        <label className="am-field am-note">
                          <span>
                            가격 정보 메모 <small>공개 데이터에 포함</small>
                          </span>
                          <textarea
                            value={draft.menuPriceNote}
                            onChange={e =>
                              update("menuPriceNote", e.target.value)
                            }
                            maxLength={1000}
                            rows={4}
                            placeholder="가격 변동, 전화 확인 내용, 다음에 확인할 항목을 기록하세요."
                          />
                        </label>
                        <div className="am-section-heading am-source-heading">
                          <h3>
                            가격 정보 출처{" "}
                            <span>{draft.menuPriceSources.length}</span>
                          </h3>
                          <button
                            type="button"
                            className="am-btn am-btn-white"
                            disabled={draft.menuPriceSources.length >= 10}
                            onClick={() =>
                              update("menuPriceSources", [
                                ...draft.menuPriceSources,
                                { label: "", url: "" },
                              ])
                            }
                          >
                            <Plus size={15} />
                            출처 추가
                          </button>
                        </div>
                        {draft.menuPriceSources.map((source, index) => (
                          <div className="am-source-card" key={index}>
                            <div className="am-source-number">
                              <Link2 size={15} />
                            </div>
                            <div>
                              <Field
                                name={`source-label-${index}`}
                                label={`출처 이름 ${index + 1}`}
                                value={source.label}
                                onChange={v =>
                                  update(
                                    "menuPriceSources",
                                    draft.menuPriceSources.map((s, i) =>
                                      i === index ? { ...s, label: v } : s
                                    )
                                  )
                                }
                                maxLength={100}
                              />
                              <Field
                                name={`source-${index}`}
                                label={`출처 링크 ${index + 1}`}
                                value={source.url}
                                onChange={v =>
                                  update(
                                    "menuPriceSources",
                                    draft.menuPriceSources.map((s, i) =>
                                      i === index ? { ...s, url: v } : s
                                    )
                                  )
                                }
                                maxLength={2000}
                                type="url"
                                issue={issue}
                              />
                            </div>
                            <button
                              type="button"
                              className="am-icon-btn am-delete"
                              aria-label={`출처 ${index + 1} 삭제`}
                              onClick={() =>
                                update(
                                  "menuPriceSources",
                                  draft.menuPriceSources.filter(
                                    (_, i) => i !== index
                                  )
                                )
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                        {!draft.menuPriceSources.length && (
                          <p className="am-no-sources">
                            네이버·카카오 지도나 식당 공식 메뉴 링크를 추가할 수
                            있어요.
                          </p>
                        )}
                        {editIds.has(selected.id) && (
                          <div className="am-reset-section">
                            <div>
                              <strong>수집 원본으로 복원</strong>
                              <p>
                                이 식당의 관리자 수정 내용을 해제하고 원본
                                정보를 불러옵니다.
                              </p>
                            </div>
                            <button
                              type="button"
                              className="am-btn am-btn-white"
                              onClick={() => setPending({ kind: "reset" })}
                            >
                              <RotateCcw size={14} />
                              원본 복원
                            </button>
                          </div>
                        )}
                      </fieldset>
                    </Tabs.Content>
                  </div>
                </Tabs.Root>
                <footer className={`am-savebar ${dirty ? "is-dirty" : ""}`}>
                  {error && (
                    <div className="am-save-error" role="alert">
                      {error}
                      <small>입력한 수정 내용은 유지됩니다.</small>
                    </div>
                  )}
                  <div className="am-save-status" role="status">
                    {saving ? (
                      <Loader2 className="am-spin" size={18} />
                    ) : dirty ? (
                      <span className="am-dirty-dot" />
                    ) : (
                      <CheckCircle2 size={18} />
                    )}
                    <div>
                      <strong>
                        {saving
                          ? "변경 내용을 저장하고 있어요"
                          : dirty
                            ? "저장하지 않은 변경사항"
                            : status || "모든 변경사항이 저장됐어요"}
                      </strong>
                      <small>
                        {dirty
                          ? [
                              summary.added && `${summary.added}개 추가`,
                              summary.updated && `${summary.updated}개 수정`,
                              summary.removed && `${summary.removed}개 삭제`,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "식당 정보를 수정했어요"
                          : edit?.updatedAt
                            ? `최근 저장 ${new Date(edit.updatedAt).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                            : "변경하면 저장 버튼이 활성화돼요"}
                      </small>
                    </div>
                  </div>
                  <div className="am-save-actions">
                    <button
                      type="button"
                      className="am-btn am-discard"
                      disabled={!dirty || saving}
                      onClick={() => setPending({ kind: "discard" })}
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="am-btn am-btn-primary am-save"
                      disabled={!dirty || saving || !configured}
                    >
                      {saving ? (
                        <Loader2 size={16} className="am-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      변경사항 저장<kbd>Ctrl S</kbd>
                    </button>
                  </div>
                </footer>
              </form>
            )}
          </section>
        </div>
      </div>
      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="am-dialog">
          <DialogHeader>
            <span className="am-dialog-icon">
              <ClipboardPaste size={24} />
            </span>
            <DialogTitle>여러 메뉴를 한 번에 추가</DialogTitle>
            <DialogDescription>
              엑셀의 메뉴명·가격 두 열을 복사해서 붙여 넣으세요. 가격이 없으면
              메뉴명만 입력해도 돼요.
            </DialogDescription>
          </DialogHeader>
          <label className="am-field">
            <span>한 줄에 메뉴 하나 · 최대 {capacity}개 추가</span>
            <textarea
              aria-label="여러 메뉴 붙여넣기"
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              rows={7}
              placeholder={"김치찌개\t9000\n된장찌개\t8500\n계란말이\t12000"}
            />
          </label>
          <div className="am-paste-preview" aria-live="polite">
            {pasted.errors.length ? (
              <p className="am-text-red">{pasted.errors[0]}</p>
            ) : pasted.rows.length > capacity ? (
              <p className="am-text-red">
                {capacity}개까지 추가할 수 있어요. 행 수를 줄여 주세요.
              </p>
            ) : (
              <>
                <strong>{pasted.rows.length}개 메뉴 준비됨</strong>
                {pasted.rows.slice(0, 3).map((row, i) => (
                  <p key={i}>
                    <span>{row.name}</span>
                    <b>{row.price || "금액 미확인"}</b>
                  </p>
                ))}
                {pasted.rows.length > 3 && (
                  <small>
                    외 {pasted.rows.length - 3}개 · 추가 후 표에서 수정할 수
                    있어요.
                  </small>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <button
              type="button"
              className="am-btn am-btn-white"
              onClick={() => setPasteOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="am-btn am-btn-primary"
              disabled={
                !pasted.rows.length ||
                pasted.errors.length > 0 ||
                pasted.rows.length > capacity
              }
              onClick={() => addMenus(pasted.rows)}
            >
              <Plus size={16} />
              {pasted.rows.length}개 메뉴 추가
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(pending)}
        onOpenChange={open => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent className="am-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === "reset"
                ? "수집 원본으로 복원할까요?"
                : "저장하지 않은 변경사항이 있어요"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "reset"
                ? "이 식당에 저장한 관리자 수정 내용을 모두 해제합니다. 수집한 원본으로 돌아가며 복원 기록은 남습니다."
                : "계속하면 지금 수정한 내용은 저장되지 않아요. 편집을 계속하려면 돌아가기를 선택하세요."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>돌아가기</AlertDialogCancel>
            <AlertDialogAction
              className="am-confirm-button"
              onClick={confirmPending}
            >
              {pending?.kind === "reset"
                ? "원본으로 복원"
                : pending?.kind === "discard"
                  ? "변경 취소"
                  : "저장하지 않고 이동"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
