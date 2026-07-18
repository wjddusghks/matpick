import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import AnalyticsTracker from "./components/AnalyticsTracker";
import MarketingScripts from "./components/marketing/MarketingScripts";
import AuthOnboardingModal from "./components/AuthOnboardingModal";
import MonetizationScripts from "./components/monetization/MonetizationScripts";
import MediaProtection from "./components/MediaProtection";
import PrivacyConsentBanner from "./components/PrivacyConsentBanner";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import { LocaleProvider } from "./contexts/LocaleContext";

const Home = lazy(() => import("./pages/Home"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Explore = lazy(() => import("./pages/Explore"));
const Privacy = lazy(() => import("./pages/Privacy"));
const ReviewFeed = lazy(() => import("./pages/ReviewFeed"));
const SearchMap = lazy(() => import("./pages/SearchMap"));
const RestaurantDetail = lazy(() => import("./pages/RestaurantDetail"));
const Terms = lazy(() => import("./pages/Terms"));
const CreatorDetail = lazy(() => import("./pages/CreatorDetail"));
const MyFavorites = lazy(() => import("./pages/MyFavorites"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Community = lazy(() => import("./pages/Community"));
const CommunityComposer = lazy(() => import("./pages/CommunityComposer"));
const CommunityPost = lazy(() => import("./pages/CommunityPost"));
const RestaurantSuggestion = lazy(() => import("./pages/RestaurantSuggestion"));
const NotFound = lazy(() => import("./pages/NotFound"));

function PageLoader() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f6f6f5] text-sm font-semibold text-[#7a7174]">
      Matpick
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/auth/callback/:provider">
          {(params) => <AuthCallback provider={params.provider} />}
        </Route>
        <Route path="/auth/callback/:provider/">
          {(params) => <AuthCallback provider={params.provider} />}
        </Route>
        <Route path="/explore">{() => <Explore />}</Route>
        <Route path="/explore/topic/:topicSlug">
          {(params) => <Explore topicSlug={params.topicSlug} />}
        </Route>
        <Route path="/explore/topic/:topicSlug/">
          {(params) => <Explore topicSlug={params.topicSlug} />}
        </Route>
        <Route path="/explore/topic/:topicSlug/episode/:episodeSlug">
          {(params) => (
            <Explore topicSlug={params.topicSlug} episodeSlug={params.episodeSlug} />
          )}
        </Route>
        <Route path="/explore/topic/:topicSlug/episode/:episodeSlug/">
          {(params) => (
            <Explore topicSlug={params.topicSlug} episodeSlug={params.episodeSlug} />
          )}
        </Route>
        <Route path="/map" component={SearchMap} />
        <Route path="/about" component={About} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/contact" component={Contact} />
        <Route path="/restaurant/:id" component={RestaurantDetail} />
        <Route path="/reviews" component={ReviewFeed} />
        <Route path="/community/new" component={CommunityComposer} />
        <Route path="/community/post/:postId">
          {(params) => <CommunityPost postId={params.postId} />}
        </Route>
        <Route path="/community" component={Community} />
        <Route path="/suggest" component={RestaurantSuggestion} />
        <Route path="/creator/:id" component={CreatorDetail} />
        <Route path="/my/favorites" component={MyFavorites} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <LocaleProvider>
          <AuthProvider>
            <FavoritesProvider>
              <TooltipProvider>
                <Toaster />
                <MonetizationScripts />
                <MediaProtection />
                <MarketingScripts />
                <AnalyticsTracker />
                <AuthOnboardingModal />
                <PrivacyConsentBanner />
                <Router />
              </TooltipProvider>
            </FavoritesProvider>
          </AuthProvider>
        </LocaleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
