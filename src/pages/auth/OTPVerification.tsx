import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { AuthLayout } from '@/components/auth';
import { ROUTES } from '@/config/routes';
import { toast } from 'sonner';

/**
 * OTP Verification Page
 * 6-digit OTP input with individual boxes.
 * Resend OTP button with 60s countdown timer.
 * Any 6-digit code works (mock).
 */
export const OTPVerification = () => {
  const navigate = useNavigate();
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const startCountdown = useCallback(() => {
    setCountdown(60);
    setCanResend(false);
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join('');

    if (otpString.length !== 6) {
      toast.error('Please enter all 6 digits');
      return;
    }

    setIsLoading(true);
    try {
      // Mock: any 6-digit code works
      await new Promise((resolve) => setTimeout(resolve, 800));
      toast.success('Verified successfully!', {
        description: 'Your identity has been confirmed.',
      });
      navigate(ROUTES.SIGN_IN);
    } catch {
      toast.error('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = () => {
    if (!canResend) return;
    startCountdown();
    toast.success('Code resent', {
      description: 'A new verification code has been sent to your email.',
    });
  };

  return (
    <AuthLayout
      title="Verify your identity"
      subtitle="Enter the 6-digit code sent to your email"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
        </div>

        <div className="flex justify-center gap-3">
          {otp.map((digit, index) => (
            <Input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-14 text-center text-xl font-bold"
            />
          ))}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Demo: any 6-digit code works
        </p>

        <Button
          type="submit"
          className="w-full h-11 text-base font-medium"
          disabled={isLoading}
        >
          {isLoading ? 'Verifying...' : 'Verify Code'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-4">
        Didn't receive the code?{' '}
        {canResend ? (
          <button
            onClick={handleResend}
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Resend
          </button>
        ) : (
          <span className="font-medium text-muted-foreground">
            Resend in {countdown}s
          </span>
        )}
      </p>

      <Link
        to={ROUTES.SIGN_IN}
        className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to sign in
      </Link>
    </AuthLayout>
  );
};

export default OTPVerification;
