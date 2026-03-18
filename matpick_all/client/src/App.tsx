import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import AuthOnboardingModal from "./components/AuthOnboardingModal";
import MonetizationScripts from "./components/monetization/MonetizationScripts";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import AuthCallback from "./pages/AuthCallback";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Privacy from "./pages/Privacy";
import SearchMap from "./pages/SearchMap";
import RestaurantDetail from "./pages/RestaurantDetail";
import Terms from "./pages/Terms";
import CreatorDetail from "./pages/CreatorDetail";
import MyFavorites from "./pages/MyFavorites";

function Router() {
  return (
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
      <Route path="/map" component={SearchMap} />
      <Route path="/about" component={About} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/contact" component={Contact} />
      <Route path="/restaurant/:id" component={RestaurantDetail} />
      <Route path="/creator/:id" component={CreatorDetail} />
      <Route path="/my/favorites" component={MyFavorites} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <FavoritesProvider>
            <TooltipProvider>
              <Toaster />
              <MonetizationScripts />
              <AuthOnboardingModal />
              <Router />
            </TooltipProvider>
          </FavoritesProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
