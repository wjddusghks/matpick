import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { usePrivateGuides } from "@/contexts/PrivateGuidesContext";
import { mergePrivateRestaurants } from "@/lib/privateGuideCatalog";
import { restaurants, getRestaurantMenuItems } from "@/data";
import { useSeo } from "@/lib/seo";
import NaverMap from "@/components/NaverMap";
import { getRestaurantDirectionsUrl } from "@/lib/restaurantDirections";

export default function AdminGuideRestaurant() {
  const { id } = useParams<{ id: string }>();
  const {
    restaurants: privateRestaurants,
    allowed,
    catalog,
    error,
  } = usePrivateGuides();
  const restaurant = useMemo(
    () =>
      mergePrivateRestaurants(restaurants, privateRestaurants).find(
        r => r.id === id && r.privateGuideIds?.length
      ),
    [id, privateRestaurants]
  );
  useSeo({
    title: "관리자 전용 식당",
    description: "맛픽 비공개 가이드",
    path: "/admin/private-guides",
    robots: "noindex,nofollow",
  });
  return (
    <main
      data-private-content
      className="min-h-screen bg-[#fff8f9] px-4 py-8 text-[#45313a]"
    >
      <div className="mx-auto max-w-2xl">
        <Link
          href="/map?type=nearby"
          className="inline-flex min-h-11 items-center underline"
        >
          내 주변 지도로
        </Link>
        {!restaurant ? (
          <p role="status" className="mt-8 rounded-2xl bg-white p-6">
            {!allowed
              ? "관리자 로그인이 필요합니다."
              : error ||
                (!catalog
                  ? "관리자 권한과 데이터를 확인하고 있어요."
                  : "등록된 식당을 찾지 못했습니다.")}
          </p>
        ) : (
          <>
            <header className="my-6">
              <p className="text-xs font-bold text-[#a9324d]">
                레드리본 · 관리자 전용
              </p>
              <h1 className="mt-2 text-3xl font-bold">{restaurant.name}</h1>
              <p className="mt-2 text-sm">
                {restaurant.category} · {restaurant.address}
              </p>
            </header>
            <section className="rounded-3xl border border-[#efdde2] bg-white p-6">
              <h2 className="text-lg font-bold">메뉴와 가격</h2>
              {getRestaurantMenuItems(restaurant).length ? (
                <ul className="mt-3 divide-y divide-[#f1e7eb]">
                  {getRestaurantMenuItems(restaurant).map(menu => (
                    <li
                      key={menu.id}
                      className="flex justify-between gap-4 py-3 text-sm"
                    >
                      <span>{menu.name}</span>
                      <span className="shrink-0 font-semibold">
                        {menu.price || "가격 확인 필요"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[#8a727b]">
                  확인된 메뉴가 아직 없습니다.
                </p>
              )}
            </section>
            <section className="mt-5 overflow-hidden rounded-3xl border border-[#efdde2] bg-white">
              <h2 className="px-6 pt-5 text-lg font-bold">위치와 길찾기</h2>
              <p className="px-6 py-3 text-sm">{restaurant.address}</p>
              <div className="h-64">
                <NaverMap
                  restaurants={[restaurant]}
                  selectedId={restaurant.id}
                  currentLocation={null}
                  nearestRestaurantId={null}
                  focusCurrentLocation={false}
                  locationFocusRequest={0}
                  onMarkerClick={() => {}}
                />
              </div>
              <a
                className="m-5 flex min-h-11 items-center justify-center rounded-xl bg-[#b7233b] text-sm font-bold text-white"
                href={getRestaurantDirectionsUrl(restaurant, null)}
                target="_blank"
                rel="noopener noreferrer"
              >
                네이버 길찾기
              </a>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
