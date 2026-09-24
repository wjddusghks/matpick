import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Inbox,
  LoaderCircle,
  MapPin,
  MessageSquareHeart,
  RefreshCw,
  Search,
  Utensils,
  X,
} from "lucide-react";
import type { SuggestionItem } from "@/lib/restaurantSuggestions";
import {
  suggestionStatuses as statuses,
  useSuggestionInbox,
} from "@/lib/useSuggestionInbox";
import "./suggestion-inbox.css";

const relationships = {
  visitor: "직접 방문",
  owner: "식당 운영자",
  discovered: "발견한 맛집",
};
type InboxProps = {
  items: SuggestionItem[];
  total: number;
  page: number;
  loading: boolean;
  error: string;
  saving: string;
  notice: string;
  setPage: (page: number) => void;
  reload: () => void;
  update: (
    item: SuggestionItem,
    status: SuggestionItem["status"]
  ) => Promise<void>;
};
const date = (value: number) =>
  new Date(value).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });
const address = (item: SuggestionItem) =>
  [item.location, item.locationDetail].filter(Boolean).join(" ");

export function SuggestionInboxPanel({
  items,
  total,
  page,
  loading,
  error,
  saving,
  notice,
  setPage,
  reload,
  update,
}: InboxProps) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(
    () => new URLSearchParams(window.location.search).get("id") || ""
  );
  const [mobileDetail, setMobileDetail] = useState(
    () => new URLSearchParams(window.location.search).has("id")
  );
  const counts = Object.fromEntries(
    Object.keys(statuses).map(key => [
      key,
      items.filter(item => item.status === key).length,
    ])
  );
  const term = query.trim().toLowerCase();
  const visible = items.filter(
    item =>
      (filter === "all" || item.status === filter) &&
      [item.name, address(item), item.reason, ...item.menus.map(m => m.name)]
        .join(" ")
        .toLowerCase()
        .includes(term)
  );
  const selected = visible.find(item => item.id === selectedId) || visible[0];
  const setStatusFilter = (value: string) => {
    setFilter(value);
    setMobileDetail(false);
  };
  return (
    <div className="si-dashboard">
      <header className="si-heading">
        <div>
          <span className="si-eyebrow">
            <MessageSquareHeart size={14} /> COMMUNITY PICKS
          </span>
          <h1>
            사람들이 알려준 맛집<span>제보함</span>
          </h1>
          <p>
            “나만 알기 아까운 맛집”으로 보내주신 정보를 한곳에서 살펴보세요.
          </p>
        </div>
        <div className="si-heading-actions">
          <Link href="/suggest" className="si-button">
            제보 화면 <ArrowUpRight size={15} />
          </Link>
          <button
            className="si-button"
            onClick={reload}
            disabled={loading || !!saving}
          >
            <RefreshCw size={15} className={loading ? "si-spin" : ""} />
            새로고침
          </button>
        </div>
      </header>
      <div className="si-stats" aria-label="제보 처리 현황">
        <button
          className={filter === "all" ? "is-active" : ""}
          onClick={() => setStatusFilter("all")}
        >
          <span className="si-stat-icon">
            <Inbox size={20} />
          </span>
          <span>
            <small>전체 접수</small>
            <strong>
              {loading ? "—" : total.toLocaleString()}
              <em>건</em>
            </strong>
            <small>보관 중인 모든 제보</small>
          </span>
        </button>
        {(["pending", "reviewed", "archived"] as const).map((key, i) => {
          const Icon = [Clock3, CheckCircle2, Inbox][i];
          return (
            <button
              key={key}
              className={`si-tone-${key} ${filter === key ? "is-active" : ""}`}
              onClick={() => setStatusFilter(key)}
              aria-pressed={filter === key}
            >
              <span className="si-stat-icon">
                <Icon size={20} />
              </span>
              <span>
                <small>{statuses[key]}</small>
                <strong>
                  {loading ? "—" : counts[key]}
                  <em>건</em>
                </strong>
                <small>
                  {total > 50 ? "현재 페이지 기준" : "보관 중인 제보 기준"}
                </small>
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <div role="alert" className="si-error">
          {error}
          <button onClick={reload}>다시 불러오기</button>
        </div>
      )}
      <p role="status" className="si-notice">
        {notice}
      </p>
      <div
        className={`si-workspace ${mobileDetail ? "si-mobile-detail" : ""}`}
        aria-busy={loading}
      >
        <section className="si-list" aria-label="사용자 제보 목록">
          <div className="si-list-toolbar">
            <div>
              <h2>
                받은 제보 <span>{visible.length}</span>
              </h2>
              <small>최신순 · {page + 1}페이지</small>
            </div>
            <label className="si-search">
              <Search size={16} />
              <input
                aria-label="현재 페이지 제보 검색"
                placeholder={
                  total > 50
                    ? "현재 페이지의 식당·주소·메뉴 검색"
                    : "식당·주소·메뉴 검색"
                }
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setMobileDetail(false);
                }}
              />
              {query && (
                <button aria-label="검색 지우기" onClick={() => setQuery("")}>
                  <X size={14} />
                </button>
              )}
            </label>
            <div className="si-filters">
              {(["all", "pending", "reviewed", "archived"] as const).map(
                key => (
                  <button
                    key={key}
                    aria-pressed={filter === key}
                    className={filter === key ? "is-active" : ""}
                    onClick={() => setStatusFilter(key)}
                  >
                    {key === "all" ? "전체" : statuses[key]}
                  </button>
                )
              )}
            </div>
          </div>
          <div className="si-list-scroll">
            {loading ? (
              <div className="si-empty" role="status">
                <LoaderCircle className="si-spin" />
                <p>제보를 불러오고 있어요</p>
              </div>
            ) : visible.length ? (
              visible.map(item => (
                <button
                  className={`si-item ${selected?.id === item.id ? "is-selected" : ""}`}
                  key={item.id}
                  onClick={() => {
                    setSelectedId(item.id);
                    setMobileDetail(true);
                  }}
                  aria-pressed={selected?.id === item.id}
                  disabled={!!saving}
                >
                  <div className="si-item-top">
                    <span className={`si-status si-status-${item.status}`}>
                      {statuses[item.status]}
                    </span>
                    <time>{date(item.createdAt)}</time>
                  </div>
                  <h3>
                    {item.name}
                    <ChevronRight size={15} />
                  </h3>
                  <p>
                    <MapPin size={12} />
                    {address(item)}
                  </p>
                  <div className="si-item-meta">
                    <span>
                      <Utensils size={12} />
                      메뉴 {item.menus.length}개
                    </span>
                    <span>{relationships[item.relationship]}</span>
                    {item.menus.some(m => m.price !== null) && (
                      <span className="si-has-price">가격 있음</span>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="si-empty">
                <Inbox size={30} />
                <h3>
                  {items.length
                    ? "조건에 맞는 제보가 없어요"
                    : error
                      ? "제보를 불러오지 못했어요"
                      : "아직 접수된 제보가 없어요"}
                </h3>
                <p>
                  {items.length
                    ? "검색어나 상태 필터를 바꿔 보세요."
                    : "사용자가 보낸 식당 정보가 여기에 모입니다."}
                </p>
                {items.length > 0 && (
                  <button
                    className="si-button"
                    onClick={() => {
                      setFilter("all");
                      setQuery("");
                    }}
                  >
                    필터 초기화
                  </button>
                )}
              </div>
            )}
          </div>
          <nav className="si-pagination" aria-label="제보함 페이지">
            <span>
              {page + 1} / {Math.max(1, Math.ceil(total / 50))} 페이지
            </span>
            <div>
              <button
                aria-label="이전 제보 페이지"
                disabled={page === 0 || loading || !!saving}
                onClick={() => {
                  setPage(page - 1);
                  setMobileDetail(false);
                }}
              >
                <ChevronLeft size={17} />
              </button>
              <button
                aria-label="다음 제보 페이지"
                disabled={(page + 1) * 50 >= total || loading || !!saving}
                onClick={() => {
                  setPage(page + 1);
                  setMobileDetail(false);
                }}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </nav>
        </section>
        <section className="si-detail" aria-label="선택한 제보 상세">
          {!selected || loading ? (
            <div className="si-empty si-detail-placeholder">
              <button
                className="si-mobile-back si-button"
                onClick={() => setMobileDetail(false)}
              >
                <ChevronLeft size={16} />
                목록
              </button>
              <span>
                <MessageSquareHeart size={30} />
              </span>
              <h2>다음 맛집은 여기서 시작해요</h2>
              <p>
                제보를 선택하면 메뉴와 가격,
                <br />
                추천 이유를 한눈에 확인할 수 있어요.
              </p>
            </div>
          ) : (
            <>
              <header className="si-detail-head">
                <button
                  className="si-mobile-back si-button"
                  onClick={() => setMobileDetail(false)}
                >
                  <ChevronLeft size={16} />
                  목록
                </button>
                <div className="si-detail-title">
                  <span className="si-place-avatar">
                    {selected.name.slice(0, 1)}
                  </span>
                  <div>
                    <div className="si-detail-kicker">
                      <span
                        className={`si-status si-status-${selected.status}`}
                      >
                        {statuses[selected.status]}
                      </span>
                      <span>
                        {relationships[selected.relationship]} ·{" "}
                        {date(selected.createdAt)} 접수
                      </span>
                    </div>
                    <h2>{selected.name}</h2>
                    <p>
                      <MapPin size={14} />
                      {address(selected)}
                    </p>
                  </div>
                </div>
                <div className="si-detail-links">
                  <a
                    href={`https://map.naver.com/p/search/${encodeURIComponent(selected.location + " " + selected.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    지도에서 대조 <ArrowUpRight size={13} />
                  </a>
                  {selected.mapUrl && (
                    <a
                      href={selected.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      제보 출처 <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </header>
              <div className="si-detail-body">
                <section className="si-menu-section">
                  <div className="si-section-title">
                    <h3>
                      <Utensils size={16} />
                      메뉴와 가격
                    </h3>
                    <span>{selected.menus.length}개</span>
                  </div>
                  {selected.menus.length ? (
                    <ul className="si-menu-list">
                      {selected.menus.map((menu, i) => (
                        <li key={i}>
                          <span>
                            {menu.name}
                            {menu.unit && <small>{menu.unit}</small>}
                          </span>
                          <strong
                            className={menu.price === null ? "is-unknown" : ""}
                          >
                            {menu.price === null
                              ? "가격 미제보"
                              : `${menu.price.toLocaleString()}원`}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="si-muted">
                      아직 메뉴 정보가 없어요. 식당 위치부터 확인해 주세요.
                    </p>
                  )}
                  <div className="si-evidence">
                    <span>
                      정보 확인일 <b>{selected.checkedAt || "미제보"}</b>
                    </span>
                    <span>
                      확인 출처 <b>{selected.sourceNote || "미제보"}</b>
                    </span>
                  </div>
                </section>
                <section className="si-reason">
                  <h3>
                    <MessageSquareHeart size={16} />이 식당을 추천한 이유
                  </h3>
                  <p>{selected.reason || "추천 이유를 남기지 않았어요."}</p>
                  <div className="si-tags">
                    {selected.tags.map(tag => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </section>
                <p className="si-retention">
                  접수번호 {selected.id}
                  <br />
                  원문은 접수 후 180일간 보관됩니다.
                </p>
              </div>
              <footer className="si-review-actions">
                <p>
                  <CheckCircle2 size={15} />
                  정보를 확인했다면 처리 상태를 남겨 주세요.
                  <small>
                    확인 완료로 표시해도 공개 지도에 자동 등록되지는 않습니다.
                  </small>
                </p>
                <div>
                  <button
                    className="si-button"
                    disabled={!!saving || selected.status === "archived"}
                    onClick={() => void update(selected, "archived")}
                  >
                    보류
                  </button>
                  {selected.status !== "pending" && (
                    <button
                      className="si-button"
                      disabled={!!saving}
                      onClick={() => void update(selected, "pending")}
                    >
                      대기로 되돌리기
                    </button>
                  )}
                  <button
                    className="si-button si-button-primary"
                    disabled={!!saving || selected.status === "reviewed"}
                    onClick={() => void update(selected, "reviewed")}
                  >
                    {saving === selected.id ? (
                      <LoaderCircle className="si-spin" size={15} />
                    ) : (
                      <Check size={16} />
                    )}
                    확인 완료
                  </button>
                </div>
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export function AdminSuggestionOverview() {
  const inbox = useSuggestionInbox();
  const pending = inbox.items.filter(item => item.status === "pending");
  const recent = (pending.length ? pending : inbox.items).slice(0, 3);
  return (
    <section
      className="si-overview"
      aria-labelledby="suggestions-overview-title"
    >
      <div className="si-overview-intro">
        <span className="si-eyebrow">
          <MessageSquareHeart size={15} /> COMMUNITY PICKS
        </span>
        <h2 id="suggestions-overview-title">
          사용자가 발견한
          <br />
          다음 맛집을 만나보세요.
        </h2>
        <p>
          메인의 ‘나만 알기 아까운 맛집’에서
          <br />
          접수된 제보를 확인하고 검토하세요.
        </p>
        <Link href="/admin/suggestions" className="si-button si-button-primary">
          제보함 열기 <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="si-overview-content">
        <div className="si-overview-counts">
          <span>
            전체 접수{" "}
            <b>{inbox.loading ? "—" : inbox.total.toLocaleString()}</b>건
          </span>
          <span>
            최근 {inbox.items.length}건 중 대기{" "}
            <b>{inbox.loading ? "—" : pending.length}</b>건
          </span>
        </div>
        {inbox.loading ? (
          <p className="si-muted" role="status">
            최근 제보를 불러오고 있어요.
          </p>
        ) : inbox.error ? (
          <div className="si-error" role="alert">
            {inbox.error}
            <button onClick={inbox.reload}>다시 시도</button>
          </div>
        ) : recent.length ? (
          <div className="si-overview-rows">
            {recent.map(item => (
              <Link
                key={item.id}
                href={`/admin/suggestions?id=${encodeURIComponent(item.id)}`}
              >
                <span className="si-mini-avatar">
                  <Utensils size={16} />
                </span>
                <span>
                  <b>{item.name}</b>
                  <small>{address(item)}</small>
                </span>
                <span className={`si-status si-status-${item.status}`}>
                  {statuses[item.status]}
                </span>
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="si-overview-empty">
            <Inbox size={25} />
            <p>
              첫 제보를 기다리고 있어요.
              <small>접수되면 식당·메뉴·추천 이유가 여기에 표시됩니다.</small>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
