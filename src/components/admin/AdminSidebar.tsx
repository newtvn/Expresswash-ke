import { Link, useLocation } from 'react-router-dom';
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
  Sparkles,
  ChevronUp,
  DollarSign,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/authStore';

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
    label: 'Financial',
    items: [
      { title: 'Billing', href: '/admin/billing', icon: Receipt },
      { title: 'Profit & Expense', href: '/admin/profit-expense', icon: TrendingUp },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { title: 'Campaigns', href: '/admin/marketing', icon: Megaphone },
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
      { title: 'Configuration', href: '/admin/system-config', icon: Settings },
      { title: 'Audit Logs', href: '/admin/audit-logs', icon: Shield },
      { title: 'System Logs', href: '/admin/system-logs', icon: FileText },
    ],
  },
];

export function AdminSidebar() {
  const location = useLocation();
  const { user, clearAuth } = useAuthStore();

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
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">ExpressWash</span>
                  <span className="truncate text-xs text-muted-foreground">Admin Portal</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
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
                      {user?.email ?? 'admin@expresswash.co.ke'}
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
                <DropdownMenuItem onClick={clearAuth}>
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
