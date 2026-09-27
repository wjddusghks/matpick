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
import SuggestionAddressSearch from "@/components/SuggestionAddressSearch";
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
import { useLocale } from "@/contexts/LocaleContext";

const steps = [
  {
    label: "식당 찾기",
    title: "어떤 식당을 알려주실 건가요?",
    description: "식당 이름을 적고, 주소 검색으로 정확한 위치를 찾아주세요.",
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

const englishSteps = [
  { label: "Find the restaurant", title: "Which restaurant would you like to share?", description: "Enter its name and use address search to choose the exact location.", icon: MapPin },
  { label: "Menu and price", title: "What should people order?", description: "One recommendation is enough. Add a price only if you know it.", icon: UtensilsCrossed },
  { label: "Why you recommend it", title: "What makes this place worth a visit?", description: "Tell us when to go or who it suits. A short note still helps.", icon: Heart },
] as const;

const englishRelationships = [
  { value: "visitor", label: "I have visited" },
  { value: "owner", label: "I run this place" },
  { value: "discovered", label: "I want to share it" },
] as const;

export default function SuggestRestaurant() {
  const { isEnglish, locale } = useLocale();
  const localizedSteps = isEnglish ? englishSteps : steps;
  const localizedRelationships = isEnglish ? englishRelationships : relationships;
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
    title: isEnglish ? "Suggest a restaurant" : "맛집 제보",
    description: isEnglish ? "Share a restaurant with Matpick without signing in or uploading a photo." : "나만 알기 아까운 식당을 맛픽에 알려주세요. 사진이나 로그인 없이 식당, 메뉴, 가격을 간편하게 제보할 수 있어요.",
    path: "/suggest",
    locale,
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
    const nextErrors = validateSuggestionStep(draft, step, consent, locale);
    if (Object.keys(nextErrors).length) return showErrors(nextErrors);
    if (step < 2) return move(step + 1);
    for (let i = 0; i < 2; i++) {
      const previousErrors = validateSuggestionStep(draft, i, consent, locale);
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
            (isEnglish ? "We could not submit this yet. Your entries are still here; please try again shortly." : "아직 제보를 접수하지 못했어요. 입력 내용은 그대로 있으니 잠시 후 다시 시도해 주세요.")
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
          : isEnglish ? "The connection is taking too long. Retrying will not create a duplicate submission." : "연결이 지연되고 있어요. 다시 보내도 같은 제보는 중복 접수되지 않아요."
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
        <Link href="/" className="suggest-brand" aria-label={isEnglish ? "Matpick home" : "맛픽 홈"}>
          {isEnglish ? "Mat" : "맛"}<span>{isEnglish ? "pick" : "픽"}</span>
          <span className="suggest-header-divider" />
          <small>{isEnglish ? "A restaurant map shaped by diners" : "함께 채우는 맛집 지도"}</small>
        </Link>
        <Link href="/" className="suggest-home">
          <ArrowLeft size={16} aria-hidden="true" /> {isEnglish ? "Home" : "홈으로"}
        </Link>
      </header>
      {receipt ? (
        <main className="suggest-success" aria-live="polite">
          <span className="suggest-success-icon">
            <CheckCheck size={36} />
          </span>
          <p className="suggest-eyebrow">THANK YOU FOR YOUR PICK</p>
          <h1 ref={titleRef} tabIndex={-1}>
            {isEnglish ? (receipt.storage === "local" ? "Saved locally," : "Thank you,") : (receipt.storage === "local" ? "로컬 접수함에," : "맛있는 제보,")}
            <br />{isEnglish ? "we received your pick!" : "잘 받았어요!"}
          </h1>
          <p>
            {receipt.storage === "local" ? (
              <>
                {isEnglish ? <>Your suggestion for <strong>{draft.name}</strong> was saved on this computer.<br />It was not sent to the live site.</> : <><strong>{draft.name}</strong> 제보를 이 컴퓨터에 저장했어요.<br />운영 사이트에는 전송되지 않았어요.</>}
              </>
            ) : (
              <>
                {isEnglish ? <>Our team will check the information for <strong>{draft.name}</strong>.<br />Approved details will be added to Matpick.</> : <><strong>{draft.name}</strong>의 정보를 운영자가 확인할게요.<br />보내주신 정보는 검토 후 맛픽에 반영됩니다.</>}
              </>
            )}
          </p>
          <div className="suggest-receipt">
            <span>{isEnglish ? "Submission reference" : "제보 접수 번호"}</span>
            <code>{receipt.id}</code>
            <small>{isEnglish ? "Include this number if you contact us." : "문의할 때 이 번호를 함께 알려주세요."}</small>
          </div>
          <Link href="/map" className="suggest-primary">
            {isEnglish ? "Explore more restaurants" : "다른 맛집 둘러보기"} <ArrowRight size={18} />
          </Link>
          <button type="button" className="suggest-text-button" onClick={reset}>
            {isEnglish ? "Suggest another place" : "한 곳 더 알려주기"}
          </button>
        </main>
      ) : (
        <main className="suggest-layout">
          <aside className="suggest-story">
            <p className="suggest-eyebrow">
              <span /> YOUR PICK, OUR MAP
            </p>
            <h1>
              {isEnglish ? <>Help someone discover<br /><em>their next great meal.</em></> : <>누군가의 다음 한 끼가<br /><em>당신의 맛집</em>이 되도록.</>}
            </h1>
            <p className="suggest-intro">
              {isEnglish ? <>Share the place you keep thinking about.<br />Your note can help someone choose well.</> : <>자꾸 생각나는 그 집, 맛픽에 알려주세요.<br />당신의 한마디가 좋은 선택의 시작이 돼요.</>}
            </p>
            <div className="suggest-perks">
              <span>
                <Check size={14} /> {isEnglish ? "No sign-in" : "로그인 없이"}
              </span>
              <span>
                <Check size={14} /> {isEnglish ? "No photo needed" : "사진 없이"}
              </span>
              <span>
                <Check size={14} /> {isEnglish ? "Share what you know" : "아는 만큼만"}
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
                <span className="suggest-mini-label">{isEnglish ? "A place you discovered" : "당신이 발견한 한 곳"}</span>
                <strong>{draft.name || (isEnglish ? "My local favorite" : "나의 단골 맛집")}</strong>
                <p>
                  <MapPin size={13} />{" "}
                  {draft.location || (isEnglish ? "A neighborhood worth remembering" : "맛있는 기억이 있는 동네")}
                </p>
                <div className="suggest-preview-menu">
                  <UtensilsCrossed size={16} />
                  <span>{selectedMenus[0]?.name || (isEnglish ? "A must-try menu item" : "꼭 먹어봐야 할 메뉴")}</span>
                  <b>
                    {selectedMenus[0]?.price
                      ? `${isEnglish ? "₩" : ""}${Number(selectedMenus[0].price.replace(/,/g, "")).toLocaleString()}${isEnglish ? "" : "원"}`
                      : isEnglish ? "Your pick" : "당신의 추천"}
                  </b>
                </div>
              </div>
            </div>
            <p className="suggest-story-note">
              <Sparkles size={16} /> {isEnglish ? "Our team reviews suggestions before publishing." : "제보는 운영자가 확인한 뒤 반영해요."}
            </p>
          </aside>

          <div className="suggest-workspace">
            <nav className="suggest-progress" aria-label={isEnglish ? "Submission steps" : "제보 작성 단계"}>
              <ol>
                {localizedSteps.map((item, i) => (
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
                  {localizedSteps[step].title}
                </h2>
                <p>{localizedSteps[step].description}</p>
              </div>
              {restored && (
                <p className="suggest-draft-note">
                  <Check size={14} /> {isEnglish ? "Restored the draft from this tab." : "이 탭에서 작성하던 내용을 이어서 보여드려요."}
                </p>
              )}
              <fieldset disabled={sending} className="suggest-fields">
                {step === 0 && (
                  <>
                    <div className="suggest-field">
                      <label htmlFor="suggest-name">
                        {isEnglish ? "Restaurant name" : "식당 이름"} <span className="suggest-required">{isEnglish ? "Required" : "필수"}</span>
                      </label>
                      <input
                        {...fieldProps("name")}
                        value={draft.name}
                        maxLength={100}
                        autoComplete="off"
                        placeholder={isEnglish ? "Enter the name exactly as shown in Korea" : "예: ○○국밥 해운대점"}
                        onChange={event => update("name", event.target.value)}
                      />
                      {errorText("name")}
                    </div>
                    <SuggestionAddressSearch
                      value={draft.location}
                      detail={draft.locationDetail || ""}
                      error={errors.location}
                      onChange={value => update("location", value)}
                      onDetailChange={value => update("locationDetail", value)}
                    />
                    <div className="suggest-field">
                      <label htmlFor="suggest-mapUrl">
                        {isEnglish ? "Map or restaurant link" : "지도나 식당 링크"} <span>{isEnglish ? "Optional" : "선택"}</span>
                      </label>
                      <div className="suggest-input-icon">
                        <Link2 size={18} aria-hidden="true" />
                        <input
                          {...fieldProps("mapUrl")}
                          type="url"
                          inputMode="url"
                          value={draft.mapUrl}
                          maxLength={1500}
                          placeholder={isEnglish ? "Paste a Naver or Kakao Map link" : "네이버·카카오 지도 공유 링크 붙여 넣기"}
                          onChange={event =>
                            update("mapUrl", event.target.value)
                          }
                        />
                      </div>
                      <p className="suggest-help">
                        {isEnglish ? "A link helps distinguish places with similar names." : "링크가 있으면 같은 이름의 다른 식당과 구분하기 쉬워요."}
                      </p>
                      {errorText("mapUrl")}
                    </div>
                    <div className="suggest-soft-note">
                      <MapPin size={20} />
                      <p>
                        <strong>{isEnglish ? "The name and location are enough." : "식당 이름과 위치만 알아도 괜찮아요."}</strong>
                        <br />
                        {isEnglish ? "Menu details and your reason are optional." : "다음에 나오는 메뉴와 추천 이유는 선택 항목이에요."}
                      </p>
                    </div>
                  </>
                )}
                {step === 1 && (
                  <>
                    <div className="suggest-field">
                      <div className="suggest-label-row">
                        <label>
                          {isEnglish ? "Recommended menu" : "추천 메뉴"} <span>{isEnglish ? "Optional · up to 8" : "선택 · 최대 8개"}</span>
                        </label>
                        <span className="suggest-count">
                          {draft.menus.length} / 8
                        </span>
                      </div>
                      <div className="suggest-menu-list">
                        {draft.menus.map((menu, i) => (
                          <div className="suggest-menu-row" key={i}>
                            <div className="suggest-menu-top">
                              <span>{isEnglish ? `Menu item ${i + 1}` : `추천 메뉴 ${i + 1}`}</span>
                              {draft.menus.length > 1 && (
                                <button
                                  type="button"
                                  aria-label={isEnglish ? `Remove menu item ${i + 1}` : `메뉴 ${i + 1} 삭제`}
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
                              {isEnglish ? `Menu item ${i + 1} name` : `메뉴 ${i + 1} 이름`}
                            </label>
                            <input
                              {...fieldProps(`menu-${i}-name`)}
                              value={menu.name}
                              maxLength={80}
                              placeholder={isEnglish ? "Enter the menu name as listed" : "예: 돼지국밥"}
                              onChange={event =>
                                updateMenu(i, "name", event.target.value)
                              }
                            />
                            {errorText(`menu-${i}-name`)}
                            <div className="suggest-menu-bottom">
                              <div>
                                <label htmlFor={`suggest-menu-${i}-price`}>
                                  {isEnglish ? "Price" : "가격"} <span>{isEnglish ? "Leave blank if unknown" : "모르면 비워두세요"}</span>
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
                                    placeholder={isEnglish ? "e.g. 10,000" : "예: 10,000"}
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
                                  <span>{isEnglish ? "KRW" : "원"}</span>
                                </div>
                                {errorText(`menu-${i}-price`)}
                              </div>
                              <div>
                                <label htmlFor={`suggest-menu-${i}-unit`}>
                                  {isEnglish ? "Serving unit" : "수량 기준"} <span>{isEnglish ? "Optional" : "선택"}</span>
                                </label>
                                <input
                                  id={`suggest-menu-${i}-unit`}
                                  value={menu.unit}
                                  maxLength={40}
                                  placeholder={isEnglish ? "e.g. one serving, small" : "예: 1인분, 소(小)"}
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
                          <Plus size={17} /> {isEnglish ? "Add another menu item" : "메뉴 하나 더 알려주기"}
                        </button>
                      )}
                    </div>
                    <div className="suggest-field">
                      <label htmlFor="suggest-checkedAt">
                        {isEnglish ? "When did you check this?" : "언제 확인한 정보인가요?"} <span>{isEnglish ? "Optional" : "선택"}</span>
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
                        {isEnglish ? "Where did you verify it?" : "어디서 확인했나요?"} <span>{isEnglish ? "Optional" : "선택"}</span>
                      </label>
                      <input
                        id="suggest-sourceNote"
                        value={draft.sourceNote}
                        maxLength={300}
                        placeholder={isEnglish ? "e.g. in-store menu or official website" : "예: 직접 방문한 메뉴판, 식당 공식 홈페이지"}
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
                        {isEnglish ? "What occasion is it good for?" : "어떤 날 가기 좋을까요?"} <span>{isEnglish ? "Optional · choose several" : "선택 · 여러 개 가능"}</span>
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
                            {isEnglish ? ({ "데이트": "Date", "혼밥": "Solo dining", "가족 식사": "Family meal", "친구 모임": "Friends", "여행": "Travel", "가성비": "Good value" } as Record<string, string>)[tag] : tag}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <div className="suggest-field">
                      <label htmlFor="suggest-reason">
                        {isEnglish ? "What did you like?" : "어떤 점이 좋았나요?"} <span>{isEnglish ? "Optional" : "선택"}</span>
                      </label>
                      <textarea
                        id="suggest-reason"
                        value={draft.reason}
                        maxLength={1000}
                        rows={4}
                        placeholder={isEnglish ? "e.g. Comfortable for solo diners, generous portions, and a short lunch wait." : "예: 혼자 가도 편하고, 국밥에 고기가 넉넉해요. 점심에는 조금 기다려야 해요."}
                        onChange={event => update("reason", event.target.value)}
                      />
                      <p className="suggest-character-count">
                        {draft.reason.length} / 1,000
                      </p>
                    </div>
                    <fieldset className="suggest-field">
                      <legend>{isEnglish ? "How do you know this restaurant?" : "어떻게 아는 식당인가요?"}</legend>
                      <div className="suggest-relationships">
                        {localizedRelationships.map(item => (
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
                        <span>{isEnglish ? "Review before sending" : "보내기 전 확인"}</span>
                        <button type="button" onClick={() => move(0)}>
                          {isEnglish ? "Edit" : "수정"} <ChevronRight size={13} />
                        </button>
                      </div>
                      <strong>{draft.name}</strong>
                      <p>
                        {[draft.location, draft.locationDetail]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                      <small>
                        {selectedMenus.length
                          ? isEnglish ? `${selectedMenus.length} menu items${draft.checkedAt ? ` · checked ${draft.checkedAt}` : ""}` : `메뉴 ${selectedMenus.length}개${draft.checkedAt ? ` · ${draft.checkedAt} 확인` : ""}`
                          : isEnglish ? "Our team will check the menu details." : "메뉴 정보는 운영자가 추가로 확인할게요."}
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
                            {isEnglish ? "I agree to the use of this submission." : "제보 정보 활용에 동의해요."} <b>{isEnglish ? "Required" : "필수"}</b>
                          </strong>
                          <small>
                            {isEnglish ? "I am sharing information I verified or may lawfully share, and agree that Matpick may verify, edit, and publish it." : "직접 확인했거나 공유할 수 있는 정보를 보내며, 맛픽이 식당 정보 확인·편집·공개에 활용하는 데 동의합니다."}
                          </small>
                        </span>
                      </label>
                      {errorText("consent")}
                      <p>
                        {isEnglish ? "Do not include personal contact details. Only administrators can read the original submission, which is kept for 180 days. " : "개인 연락처는 적지 말아 주세요. 제보 원문은 관리자만 열람하며 접수 후 180일간 보관합니다. "}
                        <Link href="/privacy" target="_blank">
                          {isEnglish ? "Privacy Policy" : "개인정보처리방침"}
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
              {import.meta.env.DEV && (
                <p className="suggest-draft-note">
                  {isEnglish ? "Local development mode: submissions are saved only on this computer." : "로컬 개발 화면이에요. 제보는 이 컴퓨터의 접수함에 저장됩니다."}
                </p>
              )}
              <div className="suggest-actions">
                {step > 0 && (
                  <button
                    type="button"
                    className="suggest-back"
                    onClick={() => move(step - 1)}
                    disabled={sending}
                  >
                    <ArrowLeft size={17} /> {isEnglish ? "Back" : "이전"}
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
                      {isEnglish ? "Sending…" : "제보 보내는 중"}
                    </>
                  ) : step === 2 ? (
                    <>
                      {isEnglish ? "Send suggestion" : "맛집 제보 보내기"} <Send size={17} />
                    </>
                  ) : (
                    <>
                      {isEnglish ? "Continue" : "다음으로"} <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
              <p className="suggest-bottom-note">
                {step === 0
                  ? isEnglish ? "Only the name and location are required. Share anything else you know." : "필수 정보는 딱 2개. 나머지는 아는 만큼만 알려주세요."
                  : step === 1
                    ? isEnglish ? "You can continue without adding a menu." : "메뉴를 몰라도 ‘다음으로’를 눌러 계속할 수 있어요."
                    : isEnglish ? "Suggestions are reviewed before they appear publicly." : "제보 내용은 바로 공개되지 않고, 확인을 거쳐 반영돼요."}
              </p>
            </form>
            <p className="suggest-footer">
              {isEnglish ? "Discover and share good food together. " : "함께 발견하고, 함께 나누는 맛집. "}<Link href="/">{isEnglish ? "Matpick" : "맛픽"}</Link>
              <span>·</span>
              <Link href="/contact">{isEnglish ? "Contact" : "문의하기"}</Link>
            </p>
          </div>
        </main>
      )}
    </div>
  );
}
