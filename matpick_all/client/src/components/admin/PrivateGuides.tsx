import { useEffect, useState } from "react";
import { ArrowUpRight, LockKeyhole, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { getAdminRegistrationKey, isAdminUser } from "@/lib/admin";

type Guide = {
  title: string;
  edition: string;
  sourceUrl: string;
  checkedAt: string;
  regions: { id: string; name: string; url: string }[];
};

export default function PrivateGuides({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const allowed = isAdminUser(user);
  const adminKey = user ? getAdminRegistrationKey(user) : "";
  const token = user?.syncToken || "";
  const identity = `${adminKey}:${token}`;
  const [loaded, setLoaded] = useState<{ identity: string; guide: Guide } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setLoaded(null);
    setError("");
    if (!allowed || !token) return;
    const controller = new AbortController();
    fetch("/api/restaurants?scope=private-guides", {
      cache: "no-store",
      signal: controller.signal,
      headers: { "x-matpick-admin-key": adminKey, "x-matpick-admin-token": token },
    }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (!controller.signal.aborted) setLoaded({ identity, guide: body });
    }).catch(e => {
      if (!controller.signal.aborted) setError(e.message || "가이드를 불러오지 못했습니다.");
    });
    return () => controller.abort();
  }, [allowed, adminKey, token, identity, retry]);
  if (!allowed) return null;
  const guide = loaded?.identity === identity ? loaded.guide : null;
  return (
    <section aria-label="관리자 전용 지역 가이드" className={`${compact ? "mt-6 p-5" : "p-6 sm:p-8"} rounded-3xl border border-[#f0cbd0] bg-gradient-to-br from-white to-[#fff1f2] text-left`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-[#a23b4d]"><LockKeyhole size={13} /> 관리자 전용</p>
          <h2 className={`${compact ? "text-lg" : "text-2xl"} mt-2 font-black text-[#352a2e]`}>{guide?.title || "지역별 비공개 가이드"}</h2>
        </div>
        {compact && <Link href="/admin/private-guides" className="text-xs font-bold text-[#9c4353] underline underline-offset-4">가이드 관리</Link>}
      </div>
      {guide ? <>
        <div className={compact ? "mt-5 grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-6" : "mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3"}>
          {guide.regions.map(region => (
            <a key={region.id} href={region.url} target="_blank" rel="noopener noreferrer" className={`group flex flex-col items-center ${compact ? "" : "rounded-2xl border border-white bg-white/75 p-5 shadow-sm"} focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b7233b]`} aria-label={`${guide.title} ${region.name} · 공식 네이버지도 새 창`}>
              <span aria-hidden="true" className={`${compact ? "h-16 w-16" : "h-24 w-24"} relative flex items-center justify-center rounded-full border-4 border-white bg-[#b7233b] shadow-[0_0_0_1px_#e7b4bd,0_6px_15px_#b7233b18] transition group-hover:-translate-y-1`}>
                <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full fill-none stroke-white/20" strokeWidth="1"><circle cx="50" cy="50" r="42"/><path d="M20 72 38 30 50 48 62 30 80 72M20 72h60"/></svg>
                <span className={`${compact ? "text-[11px]" : "text-sm"} relative text-center font-black leading-tight tracking-wide text-white`}>RED<br/>RIBBON</span>
              </span>
              <span className="mt-3 text-center text-sm font-bold text-[#422e35]">{region.name}</span>
              {!compact && <span className="mt-1 inline-flex items-center gap-1 text-xs text-[#99717b]">공식 목록 보기 <ArrowUpRight size={13}/></span>}
            </a>
          ))}
        </div>
        <p className="mt-5 text-xs leading-5 text-[#936975]">{guide.edition} 공식 네이버지도 목록으로 연결됩니다. 일반 이용자에게는 표시되지 않습니다.</p>
        {!compact && <div className="mt-6 rounded-xl border border-[#f0d9de] bg-white/80 p-4 text-sm leading-6 text-[#72565f]">
          <p>공식 가이드를 확인하기 위한 참고 공간입니다. 식당 목록을 맛픽 데이터베이스에 복제한 상태는 아닙니다.</p>
          <p className="mt-1">목록 수집·재게시 범위를 확인한 뒤 별도로 등록할 수 있습니다.</p>
          <a href={guide.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 font-bold text-[#a23b4d] underline underline-offset-4">공식 지역 안내 <ArrowUpRight size={13}/></a>
        </div>}
      </> : <div className="mt-5 text-sm text-[#85636d]" role="status">
        {error || (!token ? "다시 로그인해 관리자 권한을 확인해 주세요." : "관리자 권한과 가이드를 확인하고 있어요.")}
        {error && <button type="button" onClick={() => setRetry(v => v + 1)} className="ml-3 inline-flex min-h-11 items-center gap-1 font-bold"><RefreshCw size={14}/> 다시 시도</button>}
      </div>}
    </section>
  );
}
