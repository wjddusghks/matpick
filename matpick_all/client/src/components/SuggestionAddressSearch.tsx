import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, MapPin, Search, X } from "lucide-react";
import { searchAddresses, type AddressResult } from "@/lib/addressSearch";
export default function SuggestionAddressSearch({
  value,
  detail,
  error,
  onChange,
  onDetailChange,
}: {
  value: string;
  detail: string;
  error?: string;
  onChange: (address: string) => void;
  onDetailChange: (detail: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AddressResult[]>([]);
  const [searchError, setSearchError] = useState("");
  const [searched, setSearched] = useState("");
  const [selected, setSelected] = useState("");
  const request = useRef(0);
  const detailInput = useRef<HTMLInputElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  useEffect(
    () => () => {
      request.current++;
    },
    []
  );
  function cancelSearch() {
    request.current++;
    setOpen(false);
    setLoading(false);
  }
  async function search() {
    const current = ++request.current;
    setOpen(true);
    setLoading(true);
    setSearchError("");
    setResults([]);
    setSearched(value.trim());
    try {
      const addresses = await searchAddresses(value);
      if (request.current === current) setResults(addresses);
    } catch (error) {
      if (request.current === current)
        setSearchError(
          error instanceof Error
            ? error.message
            : "주소 검색에 연결하지 못했어요."
        );
    } finally {
      if (request.current === current) setLoading(false);
    }
  }
  function select(address: string) {
    onChange(address);
    setSelected(address);
    cancelSearch();
    requestAnimationFrame(() => detailInput.current?.focus());
  }
  return (
    <>
      <div className="suggest-field">
        <label htmlFor="suggest-location">
          어디에 있나요? <span className="suggest-required">필수</span>
        </label>
        <div className="suggest-address-row">
          <div className="suggest-input-icon">
            <MapPin size={18} aria-hidden="true" />
            <input
              id="suggest-location"
              value={value}
              maxLength={300}
              autoComplete="street-address"
              placeholder="예: 해운대해변로 264 또는 중동 1411-1"
              aria-invalid={Boolean(error)}
              aria-describedby={
                error ? "suggest-error-location" : "suggest-address-help"
              }
              onChange={event => {
                onChange(event.target.value);
                setSelected("");
                cancelSearch();
              }}
              onKeyDown={event => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (!event.nativeEvent.isComposing) void search();
                }
              }}
            />
          </div>
          <button
            ref={searchButton}
            type="button"
            className="suggest-address-button"
            onClick={search}
            disabled={loading}
            aria-expanded={open}
            aria-controls="suggest-address-search"
          >
            {loading ? (
              <LoaderCircle size={16} className="suggest-spinner" />
            ) : (
              <Search size={16} aria-hidden="true" />
            )}{" "}
            주소 검색
          </button>
        </div>
        <p className="suggest-help" id="suggest-address-help">
          도로명·건물번호 또는 지번으로 검색하고 정확한 주소를 선택해 주세요.
        </p>
        {selected === value && selected && (
          <p className="suggest-address-selected">
            <Check size={14} /> 검색한 주소가 입력됐어요.
          </p>
        )}
        {error && (
          <p
            className="suggest-field-error"
            id="suggest-error-location"
            role="alert"
          >
            {error}
          </p>
        )}
        {open && (
          <section
            id="suggest-address-search"
            className="suggest-address-search"
            aria-label="주소 검색 결과"
          >
            <div className="suggest-address-search-heading">
              <strong>주소 검색 결과</strong>
              <button
                type="button"
                onClick={() => {
                  cancelSearch();
                  searchButton.current?.focus();
                }}
                aria-label="주소 검색 닫기"
              >
                <X size={18} />
              </button>
            </div>
            <div aria-live="polite" aria-busy={loading}>
              {loading ? (
                <p className="suggest-address-status">
                  <LoaderCircle size={18} className="suggest-spinner" /> 주소를
                  찾고 있어요.
                </p>
              ) : searchError ? (
                <p className="suggest-address-status" role="alert">
                  {searchError}
                </p>
              ) : results.length ? (
                <ul className="suggest-address-results">
                  {results.map(result => (
                    <li key={result.roadAddress || result.jibunAddress}>
                      {result.roadAddress && (
                        <button
                          type="button"
                          onClick={() => select(result.roadAddress)}
                        >
                          <span>도로명</span>
                          <strong>{result.roadAddress}</strong>
                          <span className="suggest-address-choose">선택</span>
                        </button>
                      )}
                      {result.jibunAddress && (
                        <button
                          type="button"
                          onClick={() => select(result.jibunAddress)}
                        >
                          <span>지번</span>
                          <strong>{result.jibunAddress}</strong>
                          <span className="suggest-address-choose">선택</span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="suggest-address-status">
                  ‘{searched}’ 검색 결과가 없어요. 시·군·구와 도로명, 건물번호를
                  함께 입력해 주세요.
                </p>
              )}
            </div>
            <p className="suggest-address-provider">주소 검색 · NAVER Maps</p>
          </section>
        )}
      </div>
      <div className="suggest-field">
        <label htmlFor="suggest-locationDetail">
          상세주소 <span>선택</span>
        </label>
        <input
          ref={detailInput}
          id="suggest-locationDetail"
          value={detail}
          maxLength={100}
          autoComplete="address-line2"
          placeholder="예: 2층, 101호, ○○상가 안쪽"
          onChange={event => onDetailChange(event.target.value)}
        />
      </div>
    </>
  );
}
