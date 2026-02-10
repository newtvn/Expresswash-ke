import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Heart,
  MapPin,
  FileText,
  CreditCard,
  Award,
  Users,
  Star,
  UserCircle,
  Bell,
  Sparkles,
  ChevronUp,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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

const navItems = [
  { title: 'Dashboard', href: '/portal/dashboard', icon: LayoutDashboard },
  { title: 'My Orders', href: '/portal/orders', icon: Package },
  { title: 'Favorites', href: '/portal/favorites', icon: Heart },
  { title: 'Addresses', href: '/portal/addresses', icon: MapPin },
  { title: 'Invoices', href: '/portal/invoices', icon: FileText },
  { title: 'Payments', href: '/portal/payments', icon: CreditCard },
  { title: 'Loyalty & Rewards', href: '/portal/loyalty', icon: Award },
  { title: 'Referrals', href: '/portal/referrals', icon: Users },
  { title: 'Reviews', href: '/portal/reviews', icon: Star },
  { title: 'Profile', href: '/portal/profile', icon: UserCircle },
  { title: 'Notifications', href: '/portal/notifications', icon: Bell },
];

export function CustomerSidebar() {
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
              <Link to="/portal">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">ExpressWash</span>
                  <span className="truncate text-xs text-muted-foreground">My Account</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.href === '/portal/dashboard'
                    ? location.pathname === '/portal/dashboard' || location.pathname === '/portal'
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
                      {user?.name ? getInitials(user.name) : 'CU'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user?.name ?? 'Customer'}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email ?? 'customer@example.com'}
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
