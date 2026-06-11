import { Layout } from "./components/layout";
import Dashboard from "./pages/dashboard";
import NewDream from "./pages/new-dream";
import DreamDetail from "./pages/dream-detail";
import AiChat from "./pages/ai-chat";
import ImageRecognition from "./pages/image-recognition";
import Settings from "./pages/settings";
import Characters from "./pages/characters";
import CharacterNew from "./pages/character-new";
import DreamsList from "./pages/dreams";
import NotFound from "./pages/not-found";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/new" component={NewDream} />
        <Route path="/dreams" component={DreamsList} />
        <Route path="/dream/:id" component={DreamDetail} />
        <Route path="/chat" component={AiChat} />
        <Route path="/image" component={ImageRecognition} />
        <Route path="/settings" component={Settings} />
        <Route path="/characters" component={Characters} />
        <Route path="/characters/new" component={CharacterNew} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  // Ensure dark mode is strictly enforced on document element
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
