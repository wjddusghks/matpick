import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import {
  createFavoriteTopicId,
  sanitizeFavoriteTopicName,
  type FavoriteTopic,
  type FavoriteTopicColorKey,
  type FavoriteTopicIconKey,
} from "@/lib/favoriteTopics";

type TopicAssignments = Record<string, string[]>;

interface FavoritesContextType {
  favorites: Set<string>;
  isFavorite: (restaurantId: string) => boolean;
  toggleFavorite: (restaurantId: string) => boolean;
  favoritesCount: number;
  topics: FavoriteTopic[];
  createTopic: (input: {
    name: string;
    iconKey: FavoriteTopicIconKey;
    colorKey: FavoriteTopicColorKey;
  }) => FavoriteTopic | null;
  deleteTopics: (topicIds: string[]) => number;
  getTopicRestaurantIds: (topicId: string) => string[];
  getTopicRestaurantCount: (topicId: string) => number;
  getTopicsForRestaurant: (restaurantId: string) => FavoriteTopic[];
  isRestaurantInTopic: (topicId: string, restaurantId: string) => boolean;
  toggleRestaurantInTopic: (topicId: string, restaurantId: string) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

function getFavoritesStorageKey(userId: string) {
  return `matpick_favorites_${userId}`;
}

function getTopicsStorageKey(userId: string) {
  return `matpick_favorite_topics_${userId}`;
}

function getTopicAssignmentsStorageKey(userId: string) {
  return `matpick_topic_assignments_${userId}`;
}

function readJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user, isLoggedIn } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [topics, setTopics] = useState<FavoriteTopic[]>([]);
  const [topicAssignments, setTopicAssignments] = useState<TopicAssignments>({});

  useEffect(() => {
    if (!isLoggedIn || !user) {
      setFavorites(new Set());
      setTopics([]);
      setTopicAssignments({});
      return;
    }

    const nextFavorites = readJsonStorage<string[]>(
      getFavoritesStorageKey(user.id),
      []
    );
    const nextTopics = readJsonStorage<FavoriteTopic[]>(
      getTopicsStorageKey(user.id),
      []
    );
    const nextAssignments = readJsonStorage<TopicAssignments>(
      getTopicAssignmentsStorageKey(user.id),
      {}
    );

    setFavorites(new Set(nextFavorites));
    setTopics(
      nextTopics
        .filter((topic) => sanitizeFavoriteTopicName(topic.name).length > 0)
        .sort((a, b) => a.createdAt - b.createdAt)
    );
    setTopicAssignments(nextAssignments);
  }, [isLoggedIn, user]);

  const persistFavorites = useCallback(
    (nextFavorites: Set<string>) => {
      if (!user || typeof window === "undefined") {
        return;
      }

      window.localStorage.setItem(
        getFavoritesStorageKey(user.id),
        JSON.stringify(Array.from(nextFavorites))
      );
    },
    [user]
  );

  const persistTopics = useCallback(
    (nextTopics: FavoriteTopic[]) => {
      if (!user || typeof window === "undefined") {
        return;
      }

      window.localStorage.setItem(
        getTopicsStorageKey(user.id),
        JSON.stringify(nextTopics)
      );
    },
    [user]
  );

  const persistAssignments = useCallback(
    (nextAssignments: TopicAssignments) => {
      if (!user || typeof window === "undefined") {
        return;
      }

      window.localStorage.setItem(
        getTopicAssignmentsStorageKey(user.id),
        JSON.stringify(nextAssignments)
      );
    },
    [user]
  );

  const isFavorite = useCallback(
    (restaurantId: string) => favorites.has(restaurantId),
    [favorites]
  );

  const toggleFavorite = useCallback(
    (restaurantId: string) => {
      const nextFavorites = new Set(favorites);
      const nextAssignments: TopicAssignments = { ...topicAssignments };
      let nextState = false;

      if (nextFavorites.has(restaurantId)) {
        nextFavorites.delete(restaurantId);
        Object.keys(nextAssignments).forEach((topicId) => {
          nextAssignments[topicId] = nextAssignments[topicId].filter(
            (candidateId) => candidateId !== restaurantId
          );
        });
      } else {
        nextFavorites.add(restaurantId);
        nextState = true;
      }

      setFavorites(nextFavorites);
      setTopicAssignments(nextAssignments);
      persistFavorites(nextFavorites);
      persistAssignments(nextAssignments);
      return nextState;
    },
    [favorites, persistAssignments, persistFavorites, topicAssignments]
  );

  const createTopic = useCallback(
    ({
      name,
      iconKey,
      colorKey,
    }: {
      name: string;
      iconKey: FavoriteTopicIconKey;
      colorKey: FavoriteTopicColorKey;
    }) => {
      const sanitizedName = sanitizeFavoriteTopicName(name);
      if (!sanitizedName) {
        return null;
      }

      const nextTopic: FavoriteTopic = {
        id: createFavoriteTopicId(),
        name: sanitizedName,
        iconKey,
        colorKey,
        createdAt: Date.now(),
      };

      const nextTopics = [...topics, nextTopic];
      setTopics(nextTopics);
      persistTopics(nextTopics);
      return nextTopic;
    },
    [persistTopics, topics]
  );

  const deleteTopics = useCallback(
    (topicIds: string[]) => {
      if (topicIds.length === 0) {
        return 0;
      }

      const topicIdSet = new Set(topicIds);
      const nextTopics = topics.filter((topic) => !topicIdSet.has(topic.id));
      const nextAssignments = Object.fromEntries(
        Object.entries(topicAssignments).filter(([topicId]) => !topicIdSet.has(topicId))
      );

      setTopics(nextTopics);
      setTopicAssignments(nextAssignments);
      persistTopics(nextTopics);
      persistAssignments(nextAssignments);
      return topicIdSet.size;
    },
    [persistAssignments, persistTopics, topicAssignments, topics]
  );

  const getTopicRestaurantIds = useCallback(
    (topicId: string) => topicAssignments[topicId] ?? [],
    [topicAssignments]
  );

  const getTopicRestaurantCount = useCallback(
    (topicId: string) => getTopicRestaurantIds(topicId).length,
    [getTopicRestaurantIds]
  );

  const getTopicsForRestaurant = useCallback(
    (restaurantId: string) =>
      topics.filter((topic) => (topicAssignments[topic.id] ?? []).includes(restaurantId)),
    [topicAssignments, topics]
  );

  const isRestaurantInTopic = useCallback(
    (topicId: string, restaurantId: string) =>
      (topicAssignments[topicId] ?? []).includes(restaurantId),
    [topicAssignments]
  );

  const toggleRestaurantInTopic = useCallback(
    (topicId: string, restaurantId: string) => {
      const currentRestaurantIds = topicAssignments[topicId] ?? [];
      const nextAssignments: TopicAssignments = { ...topicAssignments };
      const nextFavorites = new Set(favorites);
      let nextState = false;

      if (currentRestaurantIds.includes(restaurantId)) {
        nextAssignments[topicId] = currentRestaurantIds.filter(
          (candidateId) => candidateId !== restaurantId
        );
      } else {
        nextAssignments[topicId] = [...currentRestaurantIds, restaurantId];
        nextFavorites.add(restaurantId);
        nextState = true;
      }

      setTopicAssignments(nextAssignments);
      setFavorites(nextFavorites);
      persistAssignments(nextAssignments);
      persistFavorites(nextFavorites);
      return nextState;
    },
    [favorites, persistAssignments, persistFavorites, topicAssignments]
  );

  const value = useMemo<FavoritesContextType>(
    () => ({
      favorites,
      isFavorite,
      toggleFavorite,
      favoritesCount: favorites.size,
      topics,
      createTopic,
      deleteTopics,
      getTopicRestaurantIds,
      getTopicRestaurantCount,
      getTopicsForRestaurant,
      isRestaurantInTopic,
      toggleRestaurantInTopic,
    }),
    [
      createTopic,
      deleteTopics,
      favorites,
      getTopicRestaurantCount,
      getTopicRestaurantIds,
      getTopicsForRestaurant,
      isFavorite,
      isRestaurantInTopic,
      toggleFavorite,
      toggleRestaurantInTopic,
      topics,
    ]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }

  return context;
}
