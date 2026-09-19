import { type ReactNode } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AppProvider } from '@/lib/store';
import { NavigationShell } from '@/components/navigation-shell';
import MapScreen from '@/screens/map-screen';
import ReportScreen from '@/screens/report-screen';
import ProfileScreen from '@/screens/profile-screen';

function Router() {
  return (
    <NavigationShell>
      <Switch>
        <Route path="/" component={MapScreen} />
        <Route path="/report" component={ReportScreen} />
        <Route path="/profile" component={ProfileScreen} />
        <Route>
          <div className="flex h-full items-center justify-center font-bold text-muted-foreground">
            Page Not Found
          </div>
        </Route>
      </Switch>
    </NavigationShell>
  );
}

function App() {
  return (
    <AppProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>
    </AppProvider>
  );
}

export default App;