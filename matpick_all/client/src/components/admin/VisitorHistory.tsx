import { useEffect, useState } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";

type CountryCount = { label: string; count: number };
type VisitDay = {
  day: string;
  weekday: number;
  visitors: number;
  countries: CountryCount[];
  unknown: number;
  historicalUnclassified: number;
  hasData: boolean;
};
type VisitorHistoryData = {
  startDay: string;
  endDay: string;
  timeZone: string;
  storage: "kv" | "memory";
  days: VisitDay[];
  weekdays: {
    weekday: number;
    visitors: number;
    days: number;
    countries: CountryCount[];
    unknown: number;
    historicalUnclassified: number;
  }[];
  countries: CountryCount[];
  totalDailyVisitors: number;
};

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
const number = (value: number) => value.toLocaleString("ko-KR");
const names =
  typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["ko"], { type: "region" })
    : null;
function countryName(code: string) {
  try {
    return names?.of(code) || code;
  } catch {
    return code;
  }
}

export default function VisitorHistory({
  adminKey,
  adminToken,
}: {
  adminKey: string;
  adminToken: string;
}) {
  const [period, setPeriod] = useState<7 | 28>(7);
  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null);
  const [history, setHistory] = useState<VisitorHistoryData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/admin/metrics?view=visitors&days=${period}`, {
      headers: {
        "x-matpick-admin-key": adminKey,
        "x-matpick-admin-token": adminToken,
      },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok || !payload.history)
          throw new Error(payload.error || "방문 기록을 불러오지 못했습니다.");
        if (!controller.signal.aborted) setHistory(payload.history);
      })
      .catch(cause => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "방문 기록을 불러오지 못했습니다."
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [period, adminKey, adminToken, reload]);

  const visibleDays = (history?.days || []).filter(
    day => selectedWeekday === null || day.weekday === selectedWeekday
  );
  const selectedSummary = history?.weekdays.find(
    row => row.weekday === selectedWeekday
  );
  const countries =
    selectedWeekday === null
      ? history?.countries || []
      : selectedSummary?.countries || [];
  const total = visibleDays.reduce((sum, day) => sum + day.visitors, 0);
  const unknown = visibleDays.reduce((sum, day) => sum + day.unknown, 0);
  const historical = visibleDays.reduce(
    (sum, day) => sum + day.historicalUnclassified,
    0
  );
  const recordedDays = visibleDays.filter(day => day.hasData).length;
  const max = Math.max(
    1,
    ...(history?.weekdays.map(day => day.visitors) || [])
  );

  return (
    <section
      className="mt-6 rounded-2xl border border-[#eadfe2] bg-white p-5 sm:p-6"
      aria-labelledby="visitor-history-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3
            id="visitor-history-title"
            className="flex items-center gap-2 text-lg font-black"
          >
            <CalendarDays className="h-5 w-5 text-[#e64d65]" />
            요일별 방문자 · 국가
          </h3>
          <p className="mt-2 text-sm text-[#6d6265]">
            어느 요일에, 어느 국가에서 방문했는지 확인하세요. 한국 시간 기준이며
            오늘은 집계 중입니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 28].map(days => (
            <button
              key={days}
              type="button"
              aria-pressed={period === days}
              onClick={() => setPeriod(days as 7 | 28)}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${period === days ? "bg-[#292327] text-white" : "bg-[#f7f3f4] text-[#65565c]"}`}
            >
              최근 {days}일
            </button>
          ))}
          <button
            type="button"
            aria-label="요일별 방문 통계 새로고침"
            disabled={loading}
            onClick={() => setReload(value => value + 1)}
            className="rounded-lg border border-[#eadfe2] p-2 disabled:opacity-40"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <p role="status" className="py-10 text-center text-sm text-[#6d6265]">
          방문 기록을 불러오는 중입니다…
        </p>
      ) : error ? (
        <div
          role="alert"
          className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
          <button
            type="button"
            onClick={() => setReload(value => value + 1)}
            className="ml-3 font-bold underline"
          >
            다시 시도
          </button>
        </div>
      ) : history ? (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="font-semibold">
              {history.startDay} ~ {history.endDay} · 일별 방문자 합계{" "}
              {number(history.totalDailyVisitors)}명
            </p>
            <label className="flex items-center gap-2">
              요일 선택
              <select
                value={selectedWeekday ?? "all"}
                onChange={event =>
                  setSelectedWeekday(
                    event.target.value === "all"
                      ? null
                      : Number(event.target.value)
                  )
                }
                className="rounded-lg border border-[#ded3d7] bg-white px-3 py-2"
              >
                <option value="all">전체 요일</option>
                {weekdayOrder.map(day => (
                  <option key={day} value={day}>
                    {weekdays[day]}요일
                  </option>
                ))}
              </select>
            </label>
          </div>
          {history.storage === "memory" && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              임시 메모리에 남아 있는 기록입니다. 서버 재시작 시 사라질 수 있어
              전체 방문 기록과 다를 수 있습니다.
            </p>
          )}
          <div
            className="mt-4 grid grid-cols-7 gap-1 sm:gap-3"
            aria-label="요일별 일별 방문자 합계"
          >
            {weekdayOrder.map(weekday => {
              const row = history.weekdays.find(
                item => item.weekday === weekday
              );
              const measured = history.days.some(
                day => day.weekday === weekday && day.hasData
              );
              const count = row?.visitors || 0;
              return (
                <button
                  key={weekday}
                  type="button"
                  aria-pressed={selectedWeekday === weekday}
                  aria-label={`${weekdays[weekday]}요일 ${measured ? `${number(count)}명` : "기록 없음"}, 해당 요일 보기`}
                  onClick={() =>
                    setSelectedWeekday(
                      selectedWeekday === weekday ? null : weekday
                    )
                  }
                  className={`rounded-xl px-1 py-3 text-center ${selectedWeekday === weekday ? "bg-[#fff0f3] ring-2 ring-[#ed7085]" : "bg-[#faf7f8]"}`}
                >
                  <span className="block text-xs font-bold sm:text-sm">
                    {measured ? number(count) : "—"}
                  </span>
                  <span
                    className="mx-auto mt-3 flex h-20 w-5 items-end sm:w-8"
                    aria-hidden="true"
                  >
                    <span
                      className="w-full rounded-t-md bg-[#ee8295]"
                      style={{ height: `${(count / max) * 100}%` }}
                    />
                  </span>
                  <span className="mt-2 block text-sm font-bold">
                    {weekdays[weekday]}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-5 text-[#78666d]">
            같은 방문자는 하루에 한 번 집계되지만 다른 날짜에 다시 방문하면 각
            날짜에 포함됩니다. 요일별·기간별 합계는 기간 전체의 고유 인원수가
            아닙니다. 기록 없는 날짜는 —로 표시합니다.
          </p>

          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
            <div className="min-w-0">
              <h4 className="font-bold">
                날짜별 방문 기록{" "}
                {selectedWeekday !== null &&
                  `· ${weekdays[selectedWeekday]}요일`}
              </h4>
              <div className="mt-3 max-h-[440px] overflow-auto rounded-xl border border-[#eadfe2]">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">
                    한국 시간 기준 날짜·요일별 방문자와 국가
                  </caption>
                  <thead className="sticky top-0 bg-[#f8f4f5]">
                    <tr>
                      <th scope="col" className="px-3 py-3">
                        날짜
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap px-3 py-3 text-right"
                      >
                        방문자
                      </th>
                      <th scope="col" className="px-3 py-3">
                        국가별 방문자
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...visibleDays].reverse().map(day => (
                      <tr
                        key={day.day}
                        className="border-t border-[#eee6e9] align-top"
                      >
                        <th
                          scope="row"
                          className="whitespace-nowrap px-3 py-3 font-medium"
                        >
                          {day.day.slice(5)} ({weekdays[day.weekday]})
                          {day.day === history.endDay && (
                            <span className="block text-xs text-[#8a747a]">
                              오늘 · 집계 중
                            </span>
                          )}
                        </th>
                        <td className="px-3 py-3 text-right font-bold">
                          {day.hasData ? `${number(day.visitors)}명` : "—"}
                        </td>
                        <td className="min-w-[160px] px-3 py-3 text-xs leading-6">
                          {day.hasData ? (
                            <>
                              {day.countries.map(country => (
                                <span
                                  key={country.label}
                                  className="mr-2 inline-block"
                                >
                                  {countryName(country.label)}{" "}
                                  {number(country.count)}명
                                </span>
                              ))}
                              {day.unknown > 0 && (
                                <span className="mr-2 inline-block">
                                  국가 미확인 {number(day.unknown)}명
                                </span>
                              )}
                              {day.historicalUnclassified > 0 && (
                                <span className="inline-block">
                                  과거 미분류{" "}
                                  {number(day.historicalUnclassified)}명
                                </span>
                              )}
                              {day.visitors === 0 && "집계된 방문자 없음"}
                            </>
                          ) : (
                            "수집된 기록 없음"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h4 className="font-bold">
                {selectedWeekday === null
                  ? "선택 기간"
                  : `${weekdays[selectedWeekday]}요일`}{" "}
                국가별 합계
              </h4>
              <p className="mt-1 text-xs text-[#78666d]">
                일별 방문자 합계 {number(total)}명 · 기록 {recordedDays}/
                {visibleDays.length}일
              </p>
              <ul className="mt-3 max-h-[380px] space-y-2 overflow-auto text-sm">
                {countries.map(country => (
                  <li
                    key={country.label}
                    className="flex items-center justify-between gap-3 rounded-lg bg-[#faf7f8] px-3 py-2"
                  >
                    <span>
                      {countryName(country.label)}{" "}
                      <span className="text-xs text-[#8a747a]">
                        {country.label}
                      </span>
                    </span>
                    <strong>{number(country.count)}명</strong>
                  </li>
                ))}
                {unknown > 0 && (
                  <li className="flex justify-between px-3 py-2">
                    <span>국가 미확인</span>
                    <strong>{number(unknown)}명</strong>
                  </li>
                )}
                {historical > 0 && (
                  <li className="flex justify-between px-3 py-2">
                    <span>과거 미분류</span>
                    <strong>{number(historical)}명</strong>
                  </li>
                )}
              </ul>
              {countries.length === 0 && (
                <p className="mt-3 text-sm text-[#78666d]">
                  확인된 국가 정보가 없습니다.
                </p>
              )}
            </div>
          </div>
          <p className="mt-5 border-t border-[#eee6e9] pt-4 text-xs leading-5 text-[#78666d]">
            분석 동의 후 발급된 익명 ID 기준입니다. 국가는 각 날짜의 첫 이벤트의 접속
            국가로 분류하며 국적을 의미하지 않습니다. VPN 등으로 실제 위치와
            다를 수 있습니다. 국가 수집 이전 기록은 과거 미분류로 표시합니다.
          </p>
        </>
      ) : null}
    </section>
  );
}
