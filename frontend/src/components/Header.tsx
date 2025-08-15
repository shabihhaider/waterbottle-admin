'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sun, Moon, Menu, X, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

const routes = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/customers', label: 'Customers' },
  { href: '/products',  label: 'Inventory' },
  { href: '/orders',    label: 'Orders' },
  { href: '/invoices',  label: 'Invoices' },
  { href: '/settings',  label: 'Settings' },
];

export default function Header({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const pathname = usePathname();
  const { toggle, theme, setTheme } = useTheme();
  const [openUser, setOpenUser] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-background/70 backdrop-blur border-b">
      <div className="mx-auto max-w-7xl px-3 md:px-6 h-14 flex items-center gap-2">
        {/* Mobile: hamburger */}
        <button onClick={onOpenMobileNav} className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border hover:bg-accent" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>

        {/* Brand */}
        <Link href="/dashboard" className="hidden md:inline font-semibold tracking-tight">HydroPak</Link>

        {/* Search */}
        <div className="flex-1 flex items-center">
          <div className="relative w-full max-w-md ml-0 md:ml-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search customers, orders, invoices… (Ctrl+/)"
              className="w-full pl-9 pr-3 py-2 rounded-xl border bg-background"
              onKeyDown={(e) => {
                if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  (e.currentTarget as HTMLInputElement).focus();
                }
              }}
            />
          </div>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border hover:bg-accent"
          aria-label="Toggle theme"
        >
          <Sun className="h-5 w-5 block dark:hidden" />
          <Moon className="h-5 w-5 hidden dark:block" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setOpenUser(o => !o)}
            className="ml-1 inline-flex items-center gap-2 rounded-xl border px-2.5 h-9 hover:bg-accent"
            aria-haspopup="menu"
            aria-expanded={openUser}
          >
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/70 to-primary" />
            <span className="hidden sm:inline text-sm">Admin</span>
            <ChevronDown className="h-4 w-4" />
          </button>
          <AnimatePresence>
            {openUser && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-48 rounded-xl border bg-background shadow-md overflow-hidden"
                role="menu"
              >
                <Link href="/settings" className="block px-3 py-2 text-sm hover:bg-accent">Settings</Link>
                <button onClick={() => { localStorage.removeItem('token'); window.location.href = '/login'; }} className="w-full text-left px-3 py-2 text-sm hover:bg-accent">Sign out</button>
                <div className="border-t" />
                <div className="px-3 py-2 text-xs text-muted-foreground">Theme</div>
                <div className="px-2 pb-2 flex gap-1">
                  {(['light','dark','system'] as const).map(t => (
                    <button key={t} onClick={() => setTheme(t)} className={`flex-1 rounded-lg border px-2 py-1 text-xs capitalize hover:bg-accent ${theme===t? 'ring-1 ring-ring' : ''}`}>{t}</button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}