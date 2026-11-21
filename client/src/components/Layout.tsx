import { useEffect } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { Clapperboard, Dices, FolderOpen, LayoutDashboard, Library, Plus } from 'lucide-react';
import { cx } from '../lib/format';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/library', label: 'Library', icon: Library, end: false },
  { to: '/sections', label: 'Sections', icon: FolderOpen, end: false },
  { to: '/roulette', label: 'Roulette', icon: Dices, end: false },
];

export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-6 sm:px-6">
          <Link to="/" className="group flex shrink-0 items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950 shadow-lg shadow-gold-500/20 transition-transform group-hover:rotate-[-8deg]">
              <Clapperboard className="size-5" strokeWidth={2.4} />
            </span>
            <span className="hidden font-display text-xl font-semibold tracking-tight text-white sm:block">Reelbook</span>
          </Link>

          <nav className="flex flex-1 items-center gap-1" aria-label="Main">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cx(
                    'relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'text-white' : 'text-ink-400 hover:text-ink-100',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="size-4" />
                    <span className="hidden md:inline">{label}</span>
                    {isActive && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-gold-500" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <Link to="/movies/new" className="btn-primary px-3 sm:px-4">
            <Plus className="size-4" strokeWidth={2.6} />
            <span className="hidden sm:inline">Add movie</span>
          </Link>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Reelbook · your personal film diary</p>
          <p>Movie data and images from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  );
}

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10', className)}>{children}</div>;
}
