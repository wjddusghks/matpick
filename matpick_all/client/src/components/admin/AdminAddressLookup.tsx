import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MapPin, Search, X } from "lucide-react";
import {
  hasAddressCoordinates,
  searchAddresses,
  type AddressResult,
  type LocatedAddressResult,
} from "@/lib/addressSearch";

export default function AdminAddressLookup({
  address,
  disabled,
  onSelect,
  lookup = searchAddresses,
}: {
  address: string;
  disabled: boolean;
  onSelect: (result: LocatedAddressResult) => void;
  lookup?: (query: string) => Promise<AddressResult[]>;
}) {
  const [results, setResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState("");
  const request = useRef(0);
  useEffect(() => {
    request.current++;
    setResults([]);
    setSearched(null);
    setLoading(false);
    setError("");
    return () => {
      request.current++;
    };
  }, [address, disabled]);

  async function search() {
    if (disabled || loading || address.trim().length < 2) return;
    const sequence = ++request.current;
    const query = address.trim();
    setLoading(true);
    setSearched(query);
    setResults([]);
    setApplied("");
    setError("");
    try {
      const matches = await lookup(query);
      if (sequence === request.current) setResults(matches);
    } catch {
      if (sequence === request.current)
        setError(
          "주소 조회에 연결하지 못했어요. 잠시 후 다시 검색하거나 위도·경도를 직접 입력해 주세요."
        );
    } finally {
      if (sequence === request.current) setLoading(false);
    }
  }

  function select(result: LocatedAddressResult) {
    if (disabled || searched !== address.trim()) return;
    request.current++;
    onSelect(result);
    setApplied(result.roadAddress || result.jibunAddress);
    setSearched(null);
    setResults([]);
  }

  return (
    <div className="am-address-lookup">
      <div className="am-address-toolbar">
        <p>주소를 선택하면 위도·경도가 자동 입력돼요.</p>
        <button
          type="button"
          className="am-btn am-btn-white"
          onClick={search}
          disabled={disabled || loading || address.trim().length < 2}
        >
          {loading ? (
            <Loader2 size={15} className="am-spin" />
          ) : (
            <Search size={15} />
          )}
          {loading ? "주소 조회 중" : "주소·좌표 찾기"}
        </button>
      </div>
      {applied && address === applied && (
        <p className="am-address-success" role="status">
          <CheckCircle2 size={14} /> 주소·위도·경도를 입력했어요. ‘변경사항
          저장’을 눌러 반영하세요.
        </p>
      )}
      {searched !== null && (
        <section
          aria-label="주소·좌표 검색 결과"
          className="am-address-results"
          aria-busy={loading}
        >
          <header>
            <strong>NAVER Maps · 주소 검색 결과</strong>
            <button
              type="button"
              aria-label="주소·좌표 검색 닫기"
              onClick={() => {
                request.current++;
                setSearched(null);
                setLoading(false);
              }}
            >
              <X size={16} />
            </button>
          </header>
          {loading ? (
            <p role="status">주소에 맞는 좌표를 찾고 있어요.</p>
          ) : error ? (
            <p role="alert">{error}</p>
          ) : !results.length ? (
            <p role="status">
              결과가 없어요. 식당명·층·호수를 빼고 시·군·구와 도로명·건물번호
              또는 지번으로 검색해 주세요.
            </p>
          ) : (
            <ul>
              {results.map(result => (
                <li key={result.roadAddress || result.jibunAddress}>
                  <div>
                    <strong>
                      <MapPin size={14} />{" "}
                      {result.roadAddress || result.jibunAddress}
                    </strong>
                    {result.roadAddress && result.jibunAddress && (
                      <small>지번 {result.jibunAddress}</small>
                    )}
                    <small>
                      {hasAddressCoordinates(result)
                        ? `위도 ${result.lat} · 경도 ${result.lng}`
                        : "좌표가 없는 결과입니다. 다른 주소를 검색해 주세요."}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="am-btn am-btn-white"
                    disabled={disabled || !hasAddressCoordinates(result)}
                    onClick={() => {
                      if (hasAddressCoordinates(result)) select(result);
                    }}
                  >
                    주소·좌표 적용
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="am-address-note">
            주소와 지점을 확인한 뒤 적용하세요. 층·호수는 적용 후 주소 끝에
            덧붙일 수 있어요.
          </p>
        </section>
      )}
    </div>
  );
}
