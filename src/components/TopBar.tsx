export type AppRoute = 'leaderboard' | 'audit' | 'rubric' | 'cli' | 'receipt';

interface TopBarProps {
  activeRoute: AppRoute;
  onNavigate: (path: string) => void;
}

const NAV_ITEMS: { label: string; route: AppRoute; path: string }[] = [
  { label: 'Leaderboard', route: 'leaderboard', path: '/' },
  { label: 'Audit Lab', route: 'audit', path: '/audit' },
  { label: 'Rubric', route: 'rubric', path: '/rubric' },
  { label: 'CLI & CI', route: 'cli', path: '/cli' },
];

export function TopBar({ activeRoute, onNavigate }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#E2E8F0]">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/');
          }}
          className="text-lg font-bold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0"
        >
          ShipCheck
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive =
              activeRoute === item.route ||
              (activeRoute === 'receipt' && item.route === 'leaderboard');
            return (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.path);
                }}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'text-[#0F172A] border-[#0F172A]'
                    : 'text-[#64748B] border-transparent hover:text-[#0F172A] hover:border-[#CBD5E1]'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('/audit')}
            className="px-4 py-2 text-sm font-medium text-white bg-[#0F172A] rounded-md hover:bg-[#1E293B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Run Audit
          </button>
        </div>
      </div>

      {/* Compact single-row mobile nav */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden border-t border-[#F1F5F9] px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto"
      >
        {NAV_ITEMS.map((item) => {
          const isActive =
            activeRoute === item.route ||
            (activeRoute === 'receipt' && item.route === 'leaderboard');
          return (
            <a
              key={item.path}
              href={item.path}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(item.path);
              }}
              className={`px-2 py-1 text-xs font-medium whitespace-nowrap shrink-0 ${
                isActive ? 'text-[#0F172A] underline underline-offset-4' : 'text-[#64748B]'
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
    </header>
  );
}
