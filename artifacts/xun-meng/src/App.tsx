import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";

import { Layout } from "./components/layout";
import DreamSpace from "./pages/dream-space";
import DreamArchive from "./pages/dream-archive";
import DreamArchiveList from "./pages/dream-archive-list";
import DreamLocalDetail from "./pages/dream-local-detail";
import DreamMap from "./pages/dream-map";
import Settings from "./pages/settings";
import CharacterNew from "./pages/character-new";
import ChatParticle from "./pages/chat-particle";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={DreamSpace} />
        <Route path="/archive" component={DreamArchive} />
        <Route path="/archive/list" component={DreamArchiveList} />
        <Route path="/dream-map" component={DreamMap} />
        <Route path="/archive/:id" component={DreamLocalDetail} />
        <Route path="/settings" component={Settings} />
        <Route path="/characters/new" component={CharacterNew} />
        <Route path="/chat/particle" component={ChatParticle} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
