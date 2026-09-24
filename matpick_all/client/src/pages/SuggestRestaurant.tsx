import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Heart,
  Link2,
  LoaderCircle,
  MapPin,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { useSeo } from "@/lib/seo";
import {
  emptyMenu,
  newSuggestion,
  readSuggestionDraft,
  SUGGESTION_DRAFT_KEY,
  SUGGESTIONS_API,
  suggestionTags,
  validateSuggestionStep,
  type SuggestionDraft,
  type SuggestionReceipt,
} from "@/lib/restaurantSuggestions";
import "./restaurant-suggestions.css";

const steps = [
  {
    label: "식당 찾기",
    title: "어떤 식당을 알려주실 건가요?",
    description: "정확한 주소를 몰라도 괜찮아요. 동네와 지점만 알려주세요.",
    icon: MapPin,
  },
  {
    label: "메뉴와 가격",
    title: "여기 가면, 뭘 먹어야 하나요?",
    description: "추천 메뉴 하나면 충분해요. 가격은 아는 경우에만 적어 주세요.",
    icon: UtensilsCrossed,
  },
  {
    label: "추천 한마디",
    title: "이 식당의 좋은 점을 들려주세요",
    description: "어떤 날, 누구와 가면 좋을까요? 짧은 한마디도 도움이 돼요.",
    icon: Heart,
  },
];
const relationships = [
  { value: "visitor", label: "직접 가봤어요" },
  { value: "owner", label: "제가 운영해요" },
  { value: "discovered", label: "알려주고 싶은 곳이에요" },
] as const;

export default function SuggestRestaurant() {
  const [initial] = useState(readSuggestionDraft);
  const [draft, setDraft] = useState(initial.draft);
  const [step, setStep] = useState(initial.step);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<SuggestionReceipt | null>(null);
  const [restored, setRestored] = useState(initial.restored);
  const busy = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useSeo({
    title: "맛집 제보",
    description:
      "나만 알기 아까운 식당을 맛픽에 알려주세요. 사진이나 로그인 없이 식당, 메뉴, 가격을 간편하게 제보할 수 있어요.",
    path: "/suggest",
  });

  useEffect(() => {
    if (receipt) return;
    try {
      sessionStorage.setItem(
        SUGGESTION_DRAFT_KEY,
        JSON.stringify({ draft, step, savedAt: Date.now() })
      );
    } catch {
      /* The form remains usable without browser storage. */
    }
  }, [draft, step, receipt]);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, [step, receipt]);

  function update<K extends keyof SuggestionDraft>(
    key: K,
    value: SuggestionDraft[K]
  ) {
    setDraft(current => ({ ...current, [key]: value }));
    setErrors(current => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setSendError("");
  }
  function updateMenu(
    index: number,
    key: "name" | "price" | "unit",
    value: string
  ) {
    update(
      "menus",
      draft.menus.map((menu, i) =>
        i === index ? { ...menu, [key]: value } : menu
      )
    );
    setErrors(current => {
      const next = { ...current };
      delete next[`menu-${index}-${key}`];
      return next;
    });
  }
  function move(next: number) {
    setStep(next);
    setErrors({});
    setSendError("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function showErrors(next: Record<string, string>) {
    setErrors(next);
    requestAnimationFrame(() =>
      document.getElementById(`suggest-${Object.keys(next)[0]}`)?.focus()
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    const nextErrors = validateSuggestionStep(draft, step, consent);
    if (Object.keys(nextErrors).length) return showErrors(nextErrors);
    if (step < 2) return move(step + 1);
    for (let i = 0; i < 2; i++) {
      const previousErrors = validateSuggestionStep(draft, i, consent);
      if (Object.keys(previousErrors).length) {
        move(i);
        showErrors(previousErrors);
        return;
      }
    }
    busy.current = true;
    setSending(true);
    setSendError("");
    try {
      const response = await fetch(SUGGESTIONS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, consent, website }),
        signal: AbortSignal.timeout(25000),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok || typeof body.receipt?.id !== "string")
        throw new Error(
          body?.error ||
            "아직 제보를 접수하지 못했어요. 입력 내용은 그대로 있으니 잠시 후 다시 시도해 주세요."
        );
      setReceipt(body.receipt);
      try {
        sessionStorage.removeItem(SUGGESTION_DRAFT_KEY);
      } catch {
        /* No storage is required for a successful receipt. */
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (error) {
      setSendError(
        error instanceof Error && error.name !== "TimeoutError"
          ? error.message
          : "연결이 지연되고 있어요. 다시 보내도 같은 제보는 중복 접수되지 않아요."
      );
    } finally {
      busy.current = false;
      setSending(false);
    }
  }
  function reset() {
    setDraft(newSuggestion());
    setConsent(false);
    setReceipt(null);
    setRestored(false);
    move(0);
  }
  function fieldProps(key: string) {
    return {
      id: `suggest-${key}`,
      "aria-invalid": Boolean(errors[key]),
      "aria-describedby": errors[key] ? `suggest-error-${key}` : undefined,
    };
  }
  function errorText(key: string) {
    return errors[key] ? (
      <p
        className="suggest-field-error"
        id={`suggest-error-${key}`}
        role="alert"
      >
        {errors[key]}
      </p>
    ) : null;
  }
  const selectedMenus = draft.menus.filter(menu => menu.name.trim());

  return (
    <div
      className={`suggest-page ${step > 0 && !receipt ? "suggest-page--progress" : ""}`}
    >
      <header className="suggest-header">
        <Link href="/" className="suggest-brand" aria-label="맛픽 홈">
          맛<span>픽</span>
          <span className="suggest-header-divider" />
          <small>함께 채우는 맛집 지도</small>
        </Link>
        <Link href="/" className="suggest-home">
          <ArrowLeft size={16} aria-hidden="true" /> 홈으로
        </Link>
      </header>
      {receipt ? (
        <main className="suggest-success" aria-live="polite">
          <span className="suggest-success-icon">
            <CheckCheck size={36} />
          </span>
          <p className="suggest-eyebrow">THANK YOU FOR YOUR PICK</p>
          <h1 ref={titleRef} tabIndex={-1}>
            맛있는 제보,
            <br />잘 받았어요!
          </h1>
          <p>
            <strong>{draft.name}</strong>의 정보를 운영자가 확인할게요.
            <br />
            보내주신 정보는 검토 후 맛픽에 반영됩니다.
          </p>
          <div className="suggest-receipt">
            <span>제보 접수 번호</span>
            <code>{receipt.id}</code>
            <small>문의할 때 이 번호를 함께 알려주세요.</small>
          </div>
          <Link href="/map" className="suggest-primary">
            다른 맛집 둘러보기 <ArrowRight size={18} />
          </Link>
          <button type="button" className="suggest-text-button" onClick={reset}>
            한 곳 더 알려주기
          </button>
        </main>
      ) : (
        <main className="suggest-layout">
          <aside className="suggest-story">
            <p className="suggest-eyebrow">
              <span /> YOUR PICK, OUR MAP
            </p>
            <h1>
              누군가의 다음 한 끼가
              <br />
              <em>당신의 맛집</em>이 되도록.
            </h1>
            <p className="suggest-intro">
              자꾸 생각나는 그 집, 맛픽에 알려주세요.
              <br />
              당신의 한마디가 좋은 선택의 시작이 돼요.
            </p>
            <div className="suggest-perks">
              <span>
                <Check size={14} /> 로그인 없이
              </span>
              <span>
                <Check size={14} /> 사진 없이
              </span>
              <span>
                <Check size={14} /> 아는 만큼만
              </span>
            </div>
            <div className="suggest-preview" aria-hidden="true">
              <div className="suggest-map-art">
                <i />
                <i />
                <i />
                <span className="suggest-map-pin">
                  <MapPin size={28} />
                </span>
                <span className="suggest-map-heart">
                  <Heart size={16} fill="currentColor" />
                </span>
                <span className="suggest-map-dot" />
              </div>
              <div className="suggest-preview-content">
                <span className="suggest-mini-label">당신이 발견한 한 곳</span>
                <strong>{draft.name || "나의 단골 맛집"}</strong>
                <p>
                  <MapPin size={13} />{" "}
                  {draft.location || "맛있는 기억이 있는 동네"}
                </p>
                <div className="suggest-preview-menu">
                  <UtensilsCrossed size={16} />
                  <span>{selectedMenus[0]?.name || "꼭 먹어봐야 할 메뉴"}</span>
                  <b>
                    {selectedMenus[0]?.price
                      ? `${Number(selectedMenus[0].price.replace(/,/g, "")).toLocaleString()}원`
                      : "당신의 추천"}
                  </b>
                </div>
              </div>
            </div>
            <p className="suggest-story-note">
              <Sparkles size={16} /> 제보는 운영자가 확인한 뒤 반영해요.
            </p>
          </aside>

          <div className="suggest-workspace">
            <nav className="suggest-progress" aria-label="제보 작성 단계">
              <ol>
                {steps.map((item, i) => (
                  <li
                    key={item.label}
                    className={
                      i === step ? "is-current" : i < step ? "is-complete" : ""
                    }
                    aria-current={i === step ? "step" : undefined}
                  >
                    <span>{i < step ? <Check size={15} /> : `0${i + 1}`}</span>
                    <b>{item.label}</b>
                  </li>
                ))}
              </ol>
              <div className="suggest-progress-track">
                <span style={{ width: `${((step + 1) / 3) * 100}%` }} />
              </div>
            </nav>
            <form
              className="suggest-form"
              onSubmit={submit}
              noValidate
              onKeyDown={event => {
                if (event.key === "Enter" && event.nativeEvent.isComposing)
                  event.preventDefault();
              }}
            >
              <div className="suggest-form-heading">
                <span className="suggest-step-caption">
                  STEP 0{step + 1} <span>/ 03</span>
                </span>
                <h2 ref={titleRef} tabIndex={-1}>
                  {steps[step].title}
                </h2>
                <p>{steps[step].description}</p>
              </div>
              {restored && (
                <p className="suggest-draft-note">
                  <Check size={14} /> 이 탭에서 작성하던 내용을 이어서
                  보여드려요.
                </p>
              )}
              <fieldset disabled={sending} className="suggest-fields">
                {step === 0 && (
                  <>
                    <div className="suggest-field">
                      <label htmlFor="suggest-name">
                        식당 이름 <span className="suggest-required">필수</span>
                      </label>
                      <input
                        {...fieldProps("name")}
                        value={draft.name}
                        maxLength={100}
                        autoComplete="off"
                        placeholder="예: ○○국밥 해운대점"
                        onChange={event => update("name", event.target.value)}
                      />
                      {errorText("name")}
                    </div>
                    <div className="suggest-field">
                      <label htmlFor="suggest-location">
                        어디에 있나요?{" "}
                        <span className="suggest-required">필수</span>
                      </label>
                      <div className="suggest-input-icon">
                        <MapPin size={18} aria-hidden="true" />
                        <input
                          {...fieldProps("location")}
                          value={draft.location}
                          maxLength={300}
                          autoComplete="off"
                          placeholder="예: 부산 해운대구 중동, 해운대역 3번 출구 근처"
                          onChange={event =>
                            update("location", event.target.value)
                          }
                        />
                      </div>
                      <p className="suggest-help">
                        도로명 주소 또는 동네·역 이름과 지점을 적어 주세요.
                      </p>
                      {errorText("location")}
                    </div>
                    <div className="suggest-field">
                      <label htmlFor="suggest-mapUrl">
                        지도나 식당 링크 <span>선택</span>
                      </label>
                      <div className="suggest-input-icon">
                        <Link2 size={18} aria-hidden="true" />
                        <input
                          {...fieldProps("mapUrl")}
                          type="url"
                          inputMode="url"
                          value={draft.mapUrl}
                          maxLength={1500}
                          placeholder="네이버·카카오 지도 공유 링크 붙여 넣기"
                          onChange={event =>
                            update("mapUrl", event.target.value)
                          }
                        />
                      </div>
                      <p className="suggest-help">
                        링크가 있으면 같은 이름의 다른 식당과 구분하기 쉬워요.
                      </p>
                      {errorText("mapUrl")}
                    </div>
                    <div className="suggest-soft-note">
                      <MapPin size={20} />
                      <p>
                        <strong>식당 이름과 위치만 알아도 괜찮아요.</strong>
                        <br />
                        다음에 나오는 메뉴와 추천 이유는 선택 항목이에요.
                      </p>
                    </div>
                  </>
                )}
                {step === 1 && (
                  <>
                    <div className="suggest-field">
                      <div className="suggest-label-row">
                        <label>
                          추천 메뉴 <span>선택 · 최대 8개</span>
                        </label>
                        <span className="suggest-count">
                          {draft.menus.length} / 8
                        </span>
                      </div>
                      <div className="suggest-menu-list">
                        {draft.menus.map((menu, i) => (
                          <div className="suggest-menu-row" key={i}>
                            <div className="suggest-menu-top">
                              <span>추천 메뉴 {i + 1}</span>
                              {draft.menus.length > 1 && (
                                <button
                                  type="button"
                                  aria-label={`메뉴 ${i + 1} 삭제`}
                                  onClick={() => {
                                    update(
                                      "menus",
                                      draft.menus.filter(
                                        (_, index) => index !== i
                                      )
                                    );
                                    setErrors({});
                                  }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                            <label
                              className="suggest-sr-only"
                              htmlFor={`suggest-menu-${i}-name`}
                            >
                              메뉴 {i + 1} 이름
                            </label>
                            <input
                              {...fieldProps(`menu-${i}-name`)}
                              value={menu.name}
                              maxLength={80}
                              placeholder="예: 돼지국밥"
                              onChange={event =>
                                updateMenu(i, "name", event.target.value)
                              }
                            />
                            {errorText(`menu-${i}-name`)}
                            <div className="suggest-menu-bottom">
                              <div>
                                <label htmlFor={`suggest-menu-${i}-price`}>
                                  가격 <span>모르면 비워두세요</span>
                                </label>
                                <div className="suggest-price-input">
                                  <input
                                    {...fieldProps(`menu-${i}-price`)}
                                    inputMode="numeric"
                                    value={
                                      menu.price
                                        ? Number(
                                            menu.price.replace(/,/g, "")
                                          ).toLocaleString("ko-KR")
                                        : ""
                                    }
                                    maxLength={10}
                                    placeholder="예: 10,000"
                                    onChange={event =>
                                      updateMenu(
                                        i,
                                        "price",
                                        event.target.value.replace(
                                          /[^0-9]/g,
                                          ""
                                        )
                                      )
                                    }
                                  />
                                  <span>원</span>
                                </div>
                                {errorText(`menu-${i}-price`)}
                              </div>
                              <div>
                                <label htmlFor={`suggest-menu-${i}-unit`}>
                                  수량 기준 <span>선택</span>
                                </label>
                                <input
                                  id={`suggest-menu-${i}-unit`}
                                  value={menu.unit}
                                  maxLength={40}
                                  placeholder="예: 1인분, 소(小)"
                                  onChange={event =>
                                    updateMenu(i, "unit", event.target.value)
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {draft.menus.length < 8 && (
                        <button
                          type="button"
                          className="suggest-add-menu"
                          onClick={() =>
                            update("menus", [...draft.menus, emptyMenu()])
                          }
                        >
                          <Plus size={17} /> 메뉴 하나 더 알려주기
                        </button>
                      )}
                    </div>
                    <div className="suggest-field">
                      <label htmlFor="suggest-checkedAt">
                        언제 확인한 정보인가요? <span>선택</span>
                      </label>
                      <input
                        {...fieldProps("checkedAt")}
                        type="date"
                        value={draft.checkedAt}
                        max={new Date().toLocaleDateString("en-CA", {
                          timeZone: "Asia/Seoul",
                        })}
                        onChange={event =>
                          update("checkedAt", event.target.value)
                        }
                      />
                      {errorText("checkedAt")}
                    </div>
                    <div className="suggest-field">
                      <label htmlFor="suggest-sourceNote">
                        어디서 확인했나요? <span>선택</span>
                      </label>
                      <input
                        id="suggest-sourceNote"
                        value={draft.sourceNote}
                        maxLength={300}
                        placeholder="예: 직접 방문한 메뉴판, 식당 공식 홈페이지"
                        onChange={event =>
                          update("sourceNote", event.target.value)
                        }
                      />
                    </div>
                  </>
                )}
                {step === 2 && (
                  <>
                    <fieldset className="suggest-field">
                      <legend>
                        어떤 날 가기 좋을까요? <span>선택 · 여러 개 가능</span>
                      </legend>
                      <div className="suggest-tags">
                        {suggestionTags.map(tag => (
                          <button
                            key={tag}
                            type="button"
                            aria-pressed={draft.tags.includes(tag)}
                            onClick={() =>
                              update(
                                "tags",
                                draft.tags.includes(tag)
                                  ? draft.tags.filter(value => value !== tag)
                                  : [...draft.tags, tag]
                              )
                            }
                          >
                            {draft.tags.includes(tag) && <Check size={14} />}
                            {tag}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <div className="suggest-field">
                      <label htmlFor="suggest-reason">
                        어떤 점이 좋았나요? <span>선택</span>
                      </label>
                      <textarea
                        id="suggest-reason"
                        value={draft.reason}
                        maxLength={1000}
                        rows={4}
                        placeholder="예: 혼자 가도 편하고, 국밥에 고기가 넉넉해요. 점심에는 조금 기다려야 해요."
                        onChange={event => update("reason", event.target.value)}
                      />
                      <p className="suggest-character-count">
                        {draft.reason.length} / 1,000
                      </p>
                    </div>
                    <fieldset className="suggest-field">
                      <legend>어떻게 아는 식당인가요?</legend>
                      <div className="suggest-relationships">
                        {relationships.map(item => (
                          <label key={item.value}>
                            <input
                              type="radio"
                              name="relationship"
                              value={item.value}
                              checked={draft.relationship === item.value}
                              onChange={() =>
                                update("relationship", item.value)
                              }
                            />
                            <span>{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="suggest-review">
                      <div>
                        <span>보내기 전 확인</span>
                        <button type="button" onClick={() => move(0)}>
                          수정 <ChevronRight size={13} />
                        </button>
                      </div>
                      <strong>{draft.name}</strong>
                      <p>{draft.location}</p>
                      <small>
                        {selectedMenus.length
                          ? `메뉴 ${selectedMenus.length}개${draft.checkedAt ? ` · ${draft.checkedAt} 확인` : ""}`
                          : "메뉴 정보는 운영자가 추가로 확인할게요."}
                      </small>
                    </div>
                    <div className="suggest-consent">
                      <label>
                        <input
                          {...fieldProps("consent")}
                          type="checkbox"
                          checked={consent}
                          onChange={event => {
                            setConsent(event.target.checked);
                            setErrors({});
                          }}
                        />
                        <span>
                          <strong>
                            제보 정보 활용에 동의해요. <b>필수</b>
                          </strong>
                          <small>
                            직접 확인했거나 공유할 수 있는 정보를 보내며, 맛픽이
                            식당 정보 확인·편집·공개에 활용하는 데 동의합니다.
                          </small>
                        </span>
                      </label>
                      {errorText("consent")}
                      <p>
                        개인 연락처는 적지 말아 주세요. 제보 원문은 관리자만
                        열람하며 접수 후 180일간 보관합니다.{" "}
                        <Link href="/privacy" target="_blank">
                          개인정보처리방침
                        </Link>
                      </p>
                    </div>
                  </>
                )}
                <div className="suggest-honeypot" aria-hidden="true">
                  <label htmlFor="suggest-website">Website</label>
                  <input
                    id="suggest-website"
                    name="website"
                    value={website}
                    onChange={event => setWebsite(event.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>
              </fieldset>
              {sendError && (
                <div className="suggest-send-error" role="alert">
                  {sendError}
                </div>
              )}
              <div className="suggest-actions">
                {step > 0 && (
                  <button
                    type="button"
                    className="suggest-back"
                    onClick={() => move(step - 1)}
                    disabled={sending}
                  >
                    <ArrowLeft size={17} /> 이전
                  </button>
                )}
                <button
                  className="suggest-primary"
                  type="submit"
                  disabled={sending}
                  aria-busy={sending}
                >
                  {sending ? (
                    <>
                      <LoaderCircle size={18} className="suggest-spinner" />{" "}
                      제보 보내는 중
                    </>
                  ) : step === 2 ? (
                    <>
                      맛집 제보 보내기 <Send size={17} />
                    </>
                  ) : (
                    <>
                      다음으로 <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
              <p className="suggest-bottom-note">
                {step === 0
                  ? "필수 정보는 딱 2개. 나머지는 아는 만큼만 알려주세요."
                  : step === 1
                    ? "메뉴를 몰라도 ‘다음으로’를 눌러 계속할 수 있어요."
                    : "제보 내용은 바로 공개되지 않고, 확인을 거쳐 반영돼요."}
              </p>
            </form>
            <p className="suggest-footer">
              함께 발견하고, 함께 나누는 맛집. <Link href="/">맛픽</Link>
              <span>·</span>
              <Link href="/contact">문의하기</Link>
            </p>
          </div>
        </main>
      )}
    </div>
  );
}
