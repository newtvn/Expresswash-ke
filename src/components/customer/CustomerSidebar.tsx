import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
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
  ChevronUp,
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
      { title: 'Dashboard', href: '/portal/dashboard', icon: LayoutDashboard },
      { title: 'Request Pickup', href: '/portal/request-pickup', icon: Truck },
    ],
  },
  {
    label: 'Orders',
    items: [
      { title: 'My Orders', href: '/portal/orders', icon: Package },
      { title: 'Favorites', href: '/portal/favorites', icon: Heart },
    ],
  },
  {
    label: 'Billing',
    items: [
      { title: 'Invoices', href: '/portal/invoices', icon: FileText },
      { title: 'Payments', href: '/portal/payments', icon: CreditCard },
    ],
  },
  {
    label: 'Rewards',
    items: [
      { title: 'Loyalty & Rewards', href: '/portal/loyalty', icon: Award },
      { title: 'Referrals', href: '/portal/referrals', icon: Users },
      { title: 'Reviews', href: '/portal/reviews', icon: Star },
    ],
  },
  {
    label: 'Account',
    items: [
      { title: 'Addresses', href: '/portal/addresses', icon: MapPin },
      { title: 'Profile', href: '/portal/profile', icon: UserCircle },
      { title: 'Notifications', href: '/portal/notifications', icon: Bell },
    ],
  },
];

export function CustomerSidebar() {
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
              <Link to="/portal">
                <img src="/logo.png" alt="Express Carpets" className="h-8 w-auto object-contain group-data-[collapsible=icon]:hidden" />
                <Logo size="sm" showText={false} className="hidden group-data-[collapsible=icon]:block" />
                <span className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">My Account</span>
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
                <DropdownMenuItem asChild className="focus:bg-primary/10 focus:text-primary">
                  <Link to="/portal/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="focus:bg-primary/10 focus:text-primary">
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
