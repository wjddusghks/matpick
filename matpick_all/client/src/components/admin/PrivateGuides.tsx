import { ArrowUpRight, LockKeyhole, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { usePrivateGuides } from "@/contexts/PrivateGuidesContext";

export default function PrivateGuides({ compact = false }: { compact?: boolean }) {
  const { catalog: guide, allowed, error, retry } = usePrivateGuides();
  if (!allowed) return null;
  return (
    <section data-private-content aria-label="관리자 전용 지역 가이드" className={`${compact ? "mt-6 p-5" : "p-6 sm:p-8"} rounded-3xl border border-[#f0cbd0] bg-gradient-to-br from-white to-[#fff1f2] text-left`}>
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
            <Link key={region.id} href={`/map?type=private-guide&value=${encodeURIComponent(region.id)}`} className={`group flex flex-col items-center ${compact ? "" : "rounded-2xl border border-white bg-white/75 p-5 shadow-sm"} focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b7233b]`} aria-label={`${guide.title} ${region.name} · 맛픽 지도`}>
              <span aria-hidden="true" className={`${compact ? "h-16 w-16" : "h-24 w-24"} relative flex items-center justify-center rounded-full border-4 border-white bg-[#b7233b] shadow-[0_0_0_1px_#e7b4bd,0_6px_15px_#b7233b18] transition group-hover:-translate-y-1`}>
                <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full fill-none stroke-white/20" strokeWidth="1"><circle cx="50" cy="50" r="42"/><path d="M20 72 38 30 50 48 62 30 80 72M20 72h60"/></svg>
                <span className={`${compact ? "text-[11px]" : "text-sm"} relative text-center font-black leading-tight tracking-wide text-white`}>RED<br/>RIBBON</span>
              </span>
              <span className="mt-3 text-center text-sm font-bold text-[#422e35]">{region.name}</span>
              {!compact && <span className="mt-1 inline-flex items-center gap-1 text-xs text-[#99717b]">맛픽 지도 · {guide.restaurants.filter(r => r.privateGuideIds.includes(region.id)).length}곳 <ArrowUpRight size={13}/></span>}
            </Link>
          ))}
        </div>
        <p className="mt-5 text-xs leading-5 text-[#936975]">등록된 식당은 맛픽 검색·내 주변 지도에 함께 표시되며, 레드리본 표시와 전용 식당은 관리자에게만 보입니다.</p>
        {!compact && <div className="mt-6 rounded-xl border border-[#f0d9de] bg-white/80 p-4 text-sm leading-6 text-[#72565f]">
          <p>{guide.restaurants.length ? `${guide.restaurants.length}곳이 등록되어 있습니다. 같은 식당은 기존 결과와 합쳐서 표시합니다.` : "아직 등록된 레드리본 식당이 없습니다. 이용 허가가 확인된 데이터를 등록하면 검색에 반영됩니다."}</p>
          <Link href="/map?type=nearby" className="mt-3 inline-flex min-h-11 items-center gap-1 font-bold text-[#a23b4d] underline underline-offset-4">내 주변 맛집에서 함께 보기 <ArrowUpRight size={13}/></Link>
        </div>}
      </> : <div className="mt-5 text-sm text-[#85636d]" role="status">
        {error || "관리자 권한과 가이드를 확인하고 있어요."}
        {error && <button type="button" onClick={retry} className="ml-3 inline-flex min-h-11 items-center gap-1 font-bold"><RefreshCw size={14}/> 다시 시도</button>}
      </div>}
    </section>
  );
}
