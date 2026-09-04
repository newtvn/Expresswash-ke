import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Bell, User, LogOut } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { signOut } from '@/services/authService';

function getTopBarRoutes(role?: string) {
  switch (role) {
    case 'admin':
    case 'super_admin':
      return { notifications: '/admin/notifications', profile: null }; // null = use user detail page
    case 'driver':
      return { notifications: '/driver/notifications', profile: '/driver/dashboard' };
    case 'warehouse_staff':
      return { notifications: '/warehouse/intake', profile: '/warehouse/intake' };
    default: // customer
      return { notifications: '/portal/notifications', profile: '/portal/profile' };
  }
}

export function AdminTopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const routes = getTopBarRoutes(user?.role);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    await signOut();
    clearAuth();
    navigate('/auth/signin');
  };

  // Build breadcrumbs from the path
  const pathSegments = location.pathname
    .split('/')
    .filter(Boolean);

  const breadcrumbs = pathSegments.map((segment, index) => {
    const href = '/' + pathSegments.slice(0, index + 1).join('/');
    const label = segment
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return { label, href };
  });

  return (
    <header className="sticky top-0 z-30 flex h-14 min-w-0 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4">
      <SidebarTrigger className="-ml-1 h-10 w-10 shrink-0 md:h-8 md:w-8" />
      <Separator orientation="vertical" className="mr-1 hidden h-4 sm:block md:mr-2" />

      {/* Breadcrumbs */}
      <Breadcrumb className="min-w-0 flex-1 overflow-hidden">
        <BreadcrumbList className="min-w-0 flex-nowrap [&>li]:hidden [&>li:last-child]:inline-flex sm:[&>li]:inline-flex">
          {breadcrumbs.flatMap((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const items = [];
            if (index > 0) {
              items.push(<BreadcrumbSeparator key={`sep-${index}`} />);
            }
            items.push(
              <BreadcrumbItem key={crumb.href}>
                {isLast ? (
                  <BreadcrumbPage className="max-w-[45vw] truncate sm:max-w-none">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            );
            return items;
          })}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Right side actions */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <Button variant="ghost" size="icon" className="relative h-10 w-10" onClick={() => navigate(routes.notifications)}>
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
          <span className="sr-only">Notifications</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full p-1">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl} alt={user?.name} />
                <AvatarFallback className="text-xs">
                  {user?.name ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <div className="flex items-center justify-start gap-2 p-2">
              <div className="flex flex-col space-y-1 leading-none">
                <p className="text-sm font-medium">{user?.name ?? 'User'}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="focus:bg-primary/10 focus:text-primary">
              <Link to={routes.profile ?? `/admin/users/${user?.id}`} className="flex items-center">
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="flex items-center focus:bg-primary/10 focus:text-primary">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
