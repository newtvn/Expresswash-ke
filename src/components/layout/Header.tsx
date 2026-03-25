import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/authStore";
import { getDefaultRouteForRole } from "@/config/permissions";
import { ROUTES } from "@/config/routes";
import Logo from "@/components/shared/Logo";

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, isAuthenticated } = useAuthStore();

  const navLinks = [
    { name: "Services", href: "/#services" },
    { name: "How It Works", href: "/#process" },
    { name: "Pricing", href: "/#pricing" },
    { name: "Track Order", href: "/track" },
  ];

  // Track scroll position for header background
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Close menu on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mobileMenuOpen]);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  const getDashboardPath = () => {
    if (!user) return ROUTES.SIGN_IN;
    return getDefaultRouteForRole(user.role);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled || mobileMenuOpen
            ? "bg-background/80 backdrop-blur-xl shadow-apple-sm border-b border-border/50"
            : "bg-transparent"
        }`}
      >
        <div className="container mx-auto">
          <nav className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center relative z-50">
              <Logo size="md" />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[2px] after:bg-primary after:transition-all after:duration-300 hover:after:w-full"
                >
                  {link.name}
                </Link>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated && user ? (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={getDashboardPath()} className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Link>
                  </Button>
                  <Link to={getDashboardPath()} className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                      <AvatarFallback className="text-xs">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground">
                      {user.name}
                    </span>
                  </Link>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={ROUTES.SIGN_IN}>Sign In</Link>
                  </Button>
                  <Button variant="default" size="sm" asChild>
                    <Link to={ROUTES.SIGN_UP}>Get Started</Link>
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle - Animated Hamburger */}
            <button
              className="md:hidden relative z-50 w-11 h-11 flex items-center justify-center rounded-xl transition-colors duration-200 active:bg-primary/10 touch-manipulation"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              <div className="w-6 h-5 relative flex flex-col justify-between">
                <span
                  className={`block h-[2px] w-6 bg-foreground rounded-full transition-all duration-300 origin-center ${
                    mobileMenuOpen ? "rotate-45 translate-y-[9px]" : ""
                  }`}
                />
                <span
                  className={`block h-[2px] w-6 bg-foreground rounded-full transition-all duration-300 ${
                    mobileMenuOpen ? "opacity-0 scale-x-0" : ""
                  }`}
                />
                <span
                  className={`block h-[2px] w-6 bg-foreground rounded-full transition-all duration-300 origin-center ${
                    mobileMenuOpen ? "-rotate-45 -translate-y-[9px]" : ""
                  }`}
                />
              </div>
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-all duration-300 ${
          mobileMenuOpen ? "visible" : "invisible pointer-events-none"
        }`}
      >
        {/* Backdrop with blur */}
        <div
          className={`absolute inset-0 bg-background/60 backdrop-blur-md transition-opacity duration-300 ${
            mobileMenuOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={closeMobileMenu}
          aria-hidden="true"
        />

        {/* Menu Panel */}
        <div
          className={`absolute inset-x-0 top-0 bg-background/95 backdrop-blur-xl border-b border-border/50 shadow-apple-xl pt-20 pb-8 px-6 transition-all duration-400 ${
            mobileMenuOpen
              ? "translate-y-0 opacity-100"
              : "-translate-y-4 opacity-0"
          }`}
        >
          <div className="flex flex-col gap-1">
            {navLinks.map((link, index) => (
              <Link
                key={link.name}
                to={link.href}
                className={`mobile-menu-link flex items-center text-lg font-medium text-muted-foreground hover:text-foreground active:text-primary py-3 px-4 rounded-xl transition-all duration-200 hover:bg-secondary/80 active:bg-primary/10 active:scale-[0.98] touch-manipulation ${
                  mobileMenuOpen ? "animate-menu-stagger" : ""
                }`}
                style={{ animationDelay: `${index * 50 + 100}ms` }}
                onClick={closeMobileMenu}
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div
            className={`flex flex-col gap-3 pt-6 mt-4 border-t border-border/50 ${
              mobileMenuOpen ? "animate-menu-stagger" : ""
            }`}
            style={{ animationDelay: `${navLinks.length * 50 + 150}ms` }}
          >
            {isAuthenticated && user ? (
              <>
                <div className="flex items-center gap-3 py-3 px-4">
                  <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                    <AvatarFallback className="text-sm font-semibold">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-base font-semibold text-foreground">
                      {user.name}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {user.role?.replace("_", " ")}
                    </span>
                  </div>
                </div>
                <Button variant="default" size="lg" className="w-full" asChild>
                  <Link
                    to={getDashboardPath()}
                    onClick={closeMobileMenu}
                    className="flex items-center justify-center gap-2"
                  >
                    <LayoutDashboard className="h-5 w-5" />
                    Go to Dashboard
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="lg" className="w-full" asChild>
                  <Link to="/signin" onClick={closeMobileMenu}>
                    Sign In
                  </Link>
                </Button>
                <Button variant="default" size="lg" className="w-full" asChild>
                  <Link to="/signup" onClick={closeMobileMenu}>
                    Get Started
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Header;
