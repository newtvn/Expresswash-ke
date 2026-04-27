import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  Truck,
  Receipt,
  TrendingUp,
  Megaphone,
  Heart,
  Star,
  BarChart3,
  Boxes,
  MessageSquare,
  Settings,
  Shield,
  FileText,
  ChevronUp,
  DollarSign,
  Calendar,
  Tag,
  BookOpen,
  ScanLine,
  Wallet,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import Logo from '@/components/shared/Logo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/authStore';
import { signOut } from '@/services/authService';

const navGroups = [
  {
    label: 'Overview',
    items: [
      { title: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Management',
    items: [
      { title: 'Users', href: '/admin/users', icon: Users },
      { title: 'Orders', href: '/admin/orders', icon: Package },
      { title: 'Drivers', href: '/admin/drivers', icon: Truck },
    ],
  },
  {
    label: 'Accounts',
    items: [
      { title: 'Accounts', href: '/admin/accounts', icon: BookOpen },
      { title: 'Invoices', href: '/admin/invoices', icon: FileText },
      { title: 'Receipts', href: '/admin/receipts', icon: ScanLine },
      { title: 'Billing', href: '/admin/billing', icon: Receipt },
      { title: 'Profit & Expense', href: '/admin/profit-expense', icon: TrendingUp },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { title: 'Campaigns', href: '/admin/marketing', icon: Megaphone },
      { title: 'Promotions', href: '/admin/promotions', icon: Tag },
      { title: 'Loyalty', href: '/admin/loyalty', icon: Heart },
      { title: 'Reviews', href: '/admin/reviews', icon: Star },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { title: 'Reports', href: '/admin/reports', icon: BarChart3 },
      { title: 'Inventory', href: '/admin/inventory', icon: Boxes },
    ],
  },
  {
    label: 'Communications',
    items: [
      { title: 'Messages', href: '/admin/communications', icon: MessageSquare },
    ],
  },
  {
    label: 'System',
    items: [
      { title: 'Pricing', href: '/admin/pricing', icon: DollarSign },
      { title: 'Holiday Calendar', href: '/admin/holidays', icon: Calendar },
      { title: 'Configuration', href: '/admin/system-config', icon: Settings },
      { title: 'Settings', href: '/admin/settings', icon: Wallet },
      { title: 'Audit Logs', href: '/admin/audit-logs', icon: Shield },
      { title: 'System Logs', href: '/admin/system-logs', icon: FileText },
    ],
  },
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

  const handleLogout = async () => {
    await signOut();
    clearAuth();
    navigate('/auth/signin');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/admin">
                <img src="/logo.png" alt="Express Carpets" className="h-8 w-auto object-contain group-data-[collapsible=icon]:hidden" />
                <Logo size="sm" showText={false} className="hidden group-data-[collapsible=icon]:block" />
                <span className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Admin Portal</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group, idx) => (
          <SidebarGroup key={group.label} className={idx > 0 ? 'border-t border-sidebar-border pt-2' : ''}>
            <SidebarGroupLabel className="uppercase tracking-widest text-[0.65rem] font-semibold text-sidebar-foreground/50 px-3 mb-1">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    item.href === '/admin/dashboard'
                      ? location.pathname === '/admin/dashboard' || location.pathname === '/admin'
                      : location.pathname.startsWith(item.href);

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                        <Link to={item.href}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user?.avatarUrl} alt={user?.name} />
                    <AvatarFallback className="rounded-lg text-xs">
                      {user?.name ? getInitials(user.name) : 'AD'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user?.name ?? 'Admin'}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email ?? 'admin@expresscarpets.co.ke'}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="top"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <Link to="/portal/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/admin/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
