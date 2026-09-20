import {
  getCreatorsByRestaurant,
  getCreatorDisplayName,
  getSourcesByRestaurant,
  getSourceDisplayName,
} from "@/data";
import type { Source } from "@/data/types";

export function describeRestaurantSource(
  source: Source,
  restaurantName: string,
  english = false
) {
  const name = getSourceDisplayName(source);
  const provider =
    source.provider && !["raw-source", "Matpick"].includes(source.provider)
      ? source.provider
      : "";
  const kind =
    source.type === "tv_show"
      ? "tv"
      : source.type === "creator"
        ? "video"
        : "guide";
  const badge = english
    ? kind === "tv"
      ? "TV feature"
      : kind === "video"
        ? "Video feature"
        : "Guide listing"
    : kind === "tv"
      ? "방송 소개"
      : kind === "video"
        ? "영상 소개"
        : "가이드 수록";
  let description = english
    ? `${name} is a ${kind === "tv" ? "food TV program" : kind === "video" ? "food video series" : "restaurant guide"}${provider ? ` (${provider})` : ""}. ${restaurantName} appears in its records collected by Matpick.`
    : `${provider ? `${provider}의 ` : ""}${kind === "tv" ? "음식과 식당을 소개하는 TV 프로그램" : kind === "video" ? "식당을 찾아가 음식을 소개하는 영상 콘텐츠" : "식당을 모아 소개하는 가이드"}입니다. ${restaurantName}의 소개 이력이 맛픽에 수록되어 있어요.`;
  if (source.id === "sikgaek-baekban-trip")
    description = english
      ? description
      : `허영만이 각 지역의 식당과 밥상을 찾아가는 TV CHOSUN의 음식 기행 프로그램입니다. ${restaurantName}이 이 프로그램에 소개되었어요.`;
  if (source.id === "popular-restaurants")
    description = english
      ? `Matpick's collection of restaurants by area and food. ${restaurantName} is included in this collection.`
      : `맛픽이 지역과 음식 주제별로 모은 식당 목록입니다. ${restaurantName}이 이 목록에 포함되어 있어요.`;
  if (source.id === "old-korean-100")
    description = english
      ? `A collection of 100 long-established Korean restaurants. ${restaurantName} is included in the collection.`
      : `오래된 한식당 100곳을 모은 「한국인이 사랑하는 오래된 한식당 100선」에 ${restaurantName}이 수록되어 있어요.`;
  if (source.id === "michelin")
    description = english
      ? `${restaurantName} appears in Matpick's MICHELIN Guide records. A guide listing does not by itself mean a Michelin star; categories and years can differ.`
      : `세계 여러 나라의 식당을 선정하는 미쉐린 가이드의 수록 이력이 있는 식당이에요. 가이드 수록과 스타 획득은 다르며, 선정 연도와 등급은 달라질 수 있어요.`;
  return { id: source.id, name, kind, badge, description };
}

export function getRestaurantSourceBadges(
  id: string,
  restaurantName: string,
  english = false
) {
  const sources = getSourcesByRestaurant(id);
  const entries = sources.map(source =>
    describeRestaurantSource(source, restaurantName, english)
  );
  for (const creator of getCreatorsByRestaurant(id)) {
    const name = getCreatorDisplayName(creator);
    if (
      sources.some(source => source.creatorId === creator.id) ||
      entries.some(entry => entry.name === name)
    )
      continue;
    entries.push({
      id: creator.id,
      name,
      kind: "video",
      badge: english ? "Video feature" : "영상 소개",
      description: english
        ? `${restaurantName} was featured in ${name}'s food videos.`
        : `${name}의 음식·식당 영상에서 ${restaurantName}이 소개되었어요.`,
    });
  }
  return entries;
}
