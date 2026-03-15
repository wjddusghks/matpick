export default function DemoNotice() {
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[70] rounded-2xl border border-[#FFCDC9] bg-white/95 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur-sm md:left-auto md:max-w-[280px]">
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded-full bg-[#FD7979] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
          Demo
        </span>
        <p className="text-sm font-semibold text-[#1a1a1a]">샘플 데이터 미리보기</p>
      </div>
      <p className="text-xs leading-relaxed text-[#666]">
        현재 맛집 데이터와 로그인, 찜 기능은 데모용입니다. 로그인 정보와 찜 목록은 이 브라우저에만 저장됩니다.
      </p>
    </div>
  );
}
