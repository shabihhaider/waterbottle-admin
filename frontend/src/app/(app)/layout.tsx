'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LogOut, LayoutDashboard, Users, Package, ShoppingCart, FileText, Settings, 
  X, Menu, Bell, Search, Droplets, TrendingUp, AlertTriangle 
} from 'lucide-react';
import clsx from 'clsx';
import Header from '@/components/Header';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-600' },
  { href: '/customers', label: 'Customers', icon: Users, color: 'text-green-600' },
  { href: '/products', label: 'Inventory', icon: Package, color: 'text-purple-600' },
  { href: '/orders', label: 'Orders', icon: ShoppingCart, color: 'text-orange-600' },
  { href: '/invoices', label: 'Invoices', icon: FileText, color: 'text-indigo-600' },
  { href: '/delivery', label: 'Delivery', icon: Droplets, color: 'text-cyan-600' },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp, color: 'text-emerald-600' },
  { href: '/settings', label: 'Settings', icon: Settings, color: 'text-gray-600' },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState(3);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) router.replace('/login'); else setOk(true);
  }, [router]);

  useEffect(() => { 
    setMobileOpen(false); 
    // Simulate loading new page
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      document.body.style.overflow = 'auto';
    }, 200);
  }, [pathname]);

  if (!ok) return (
    <div className="min-h-screen flex items-center justify-center" suppressHydrationWarning>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        suppressHydrationWarning
      />
    </div>
  );

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.replace('/login');
  };

  const Sidebar = (
    <motion.aside
      initial={{ x: -280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className={clsx(
        'h-full bg-sidebar/95 backdrop-blur-xl text-sidebar-foreground border-r border-sidebar-border/50',
        'flex flex-col transition-all duration-300 ease-in-out relative overflow-hidden',
        'before:absolute before:inset-0 before:bg-gradient-to-b before:from-primary/5 before:to-transparent before:pointer-events-none'
      )}
      style={{ width: collapsed ? 80 : 280 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border/30">
        <motion.div
          initial={false}
          animate={{ opacity: collapsed ? 0 : 1, x: collapsed ? -20 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-3"
        >
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
            <Droplets className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-bold text-lg bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                HydroPak
              </h1>
              <p className="text-xs text-muted-foreground">Water Delivery System</p>
            </div>
          )}
        </motion.div>
        
        <button
          onClick={() => setCollapsed(v => !v)}
          className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-sidebar-accent/50 transition-colors"
          aria-label="Toggle sidebar"
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Menu className="h-4 w-4" />
          </motion.div>
        </button>
        
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-sidebar-accent/50 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <AnimatePresence>
          {nav.map((item, index) => {
            const Icon = item.icon;
            const active = pathname?.startsWith(item.href);
            
            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  href={item.href}
                  className={clsx(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200',
                    'hover:bg-sidebar-accent/70 hover:shadow-sm hover:scale-[1.02]',
                    active 
                      ? 'bg-gradient-to-r from-primary/20 to-primary/10 text-primary shadow-sm ring-1 ring-primary/20' 
                      : 'text-sidebar-foreground/80 hover:text-sidebar-foreground'
                  )}
                >
                  <Icon className={clsx('h-5 w-5 transition-colors', active ? item.color : 'text-current')} />
                  
                  <motion.span
                    initial={false}
                    animate={{ opacity: collapsed ? 0 : 1, x: collapsed ? -10 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="font-medium"
                  >
                    {item.label}
                  </motion.span>
                  
                  {active && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute right-2 w-2 h-2 bg-primary rounded-full"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  
                  {/* Tooltip for collapsed state */}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                      {item.label}
                    </div>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </nav>

      {/* Quick Stats (when expanded) */}
      {!collapsed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 border-t border-sidebar-border/30"
        >
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span>Today's Summary</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Orders</div>
                <div className="font-semibold text-primary">24</div>
              </div>
              <div>
                <div className="text-muted-foreground">Revenue</div>
                <div className="font-semibold text-primary">₹12.4k</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Logout */}
      <div className="p-4 border-t border-sidebar-border/30">
        <motion.button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-3 text-sm text-muted-foreground hover:text-destructive rounded-xl hover:bg-destructive/10 transition-all duration-200"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <LogOut className="h-5 w-5" />
          <motion.span
            initial={false}
            animate={{ opacity: collapsed ? 0 : 1, x: collapsed ? -10 : 0 }}
            transition={{ duration: 0.2 }}
          >
            Sign out
          </motion.span>
        </motion.button>
      </div>
    </motion.aside>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Enhanced Header */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            
            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              <span>Welcome back,</span>
              <span className="font-medium text-foreground">Admin</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="hidden sm:flex items-center gap-2 bg-accent/50 rounded-lg px-3 py-2 text-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent border-none outline-none placeholder:text-muted-foreground w-32 lg:w-48"
              />
            </div>

            {/* Notifications */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent transition-colors"
            >
              <Bell className="h-5 w-5" />
              {notifications > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-medium rounded-full flex items-center justify-center"
                >
                  {notifications}
                </motion.span>
              )}
            </motion.button>
          </div>
        </div>
      </motion.header>

      <div className="flex">
        {/* Desktop sidebar */}
        <div className="hidden md:block sticky top-[73px] h-[calc(100vh-73px)]">
          {Sidebar}
        </div>

        {/* Content */}
        <main className="flex-1 relative">
          <div className="absolute inset-0 -z-10 app-gradient opacity-30" />
          
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ 
                duration: 0.3, 
                ease: [0.25, 0.25, 0, 1],
                scale: { duration: 0.2 }
              }}
              className="p-4 md:p-8 space-y-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -280, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] z-50 md:hidden"
            >
              {Sidebar}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}