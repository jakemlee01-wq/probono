import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Route, Router, Switch, useLocation } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { ErrorBoundary } from '@/components/error-boundary';
import Landing from '@/pages/landing';
import AppPage from '@/pages/app';
import NotFound from '@/pages/not-found';
import InfoPage from '@/pages/info';
import { LinkProblem, ResetPasswordPage, SignInPage } from '@/pages/auth';
import { JoinChooser, JoinNonprofit, JoinVolunteer } from '@/pages/join';
import { ToastProvider } from '@/lib/toast';
import { SessionProvider, useSession } from '@/lib/session';
import { configured } from '@/lib/supabase';

// Invite links carry ?code= inside the hash (#/join/volunteer?code=...). Routes match on the path only.
const useHashPath = (): ReturnType<typeof useHashLocation> => {
  const [loc, nav] = useHashLocation();
  return [loc.split('?')[0], nav];
};

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } });

function Home() {
  const { session, ready } = useSession();
  if (!ready) return <div className="min-h-[100dvh] bg-plum" />;
  // Signed-in members go to the app. Demo visitors see the landing page with Resume or Start over.
  return session ? <Redirect to="/app" /> : <Landing />;
}

function Routes() {
  const [location] = useLocation();
  const { recovering, linkError } = useSession();
  if (recovering && location !== '/reset') return <Redirect to="/reset" />;
  if (linkError && location !== '/link-error' && !location.startsWith('/about')) return <Redirect to="/link-error" />;
  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/sign-up"><Redirect to="/join" /></Route>
        <Route path="/join" component={JoinChooser} />
        <Route path="/join/volunteer" component={JoinVolunteer} />
        <Route path="/join/nonprofit" component={JoinNonprofit} />
        <Route path="/reset" component={ResetPasswordPage} />
        <Route path="/link-error">{() => <LinkProblem />}</Route>
        <Route path="/about/:page" component={InfoPage} />
        <Route path="/app" component={AppPage} />
        <Route path="/app/*" component={AppPage} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function NotConfigured() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-plum p-6 text-center text-cream">
      <div className="max-w-sm">
        <p className="font-serif text-3xl">probono</p>
        <p className="mt-4 text-cream/80">The site is up, but it isn't connected to its database yet. Add the Supabase settings to the GitHub repo and redeploy.</p>
      </div>
    </div>
  );
}

export default function App() {
  if (!configured) return <NotConfigured />;
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionProvider>
          <Router hook={useHashPath}>
            <Routes />
          </Router>
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
