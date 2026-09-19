import { Link, useLocation } from 'wouter';
import { Map, Camera, User } from 'lucide-react';

export function NavigationShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const links = [
    { href: '/', label: 'Map', icon: Map },
    { href: '/report', label: 'Report', icon: Camera },
    { href: '/profile', label: 'Profile', icon: User }
  ];

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-background overflow-hidden selection:bg-primary/20">
      
      {/* Desktop Sidebar */}
      <nav className="hidden md:flex flex-col w-20 lg:w-64 bg-card border-r shrink-0 z-30 shadow-sm relative">
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 font-extrabold text-xl text-primary border-b bg-card">
          <span className="hidden lg:inline">Stepwise</span>
          <span className="lg:hidden text-2xl tracking-tighter">SW</span>
        </div>
        <div className="flex-1 py-4 flex flex-col gap-2 px-3">
          {links.map(l => {
            const active = location === l.href;
            return (
              <Link key={l.href} href={l.href} className={`flex items-center gap-3 p-3 lg:px-4 rounded-xl transition-all duration-200 font-bold min-h-[48px] ${active ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                <l.icon size={24} />
                <span className="hidden lg:inline">{l.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <main className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <header className="md:hidden h-14 bg-card border-b flex items-center px-4 shrink-0 font-extrabold tracking-tight text-xl text-primary shadow-sm z-20">
          Stepwise
        </header>
        
        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>

        {/* Mobile Bottom Nav - Safe Area Aware */}
        <nav className="md:hidden flex flex-col bg-card border-t shrink-0 h-auto pb-[env(safe-area-inset-bottom)] z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="flex w-full h-[64px]">
            {links.map(l => {
              const active = location === l.href;
              return (
                <Link key={l.href} href={l.href} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-200 min-h-[64px] ${active ? 'text-primary scale-105' : 'text-muted-foreground hover:text-foreground'}`}>
                  <l.icon size={22} strokeWidth={active ? 2.5 : 2} />
                  <span className="text-[11px] font-bold">{l.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </main>
    </div>
  )
}