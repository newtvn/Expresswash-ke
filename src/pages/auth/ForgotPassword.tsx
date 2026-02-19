import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '@/components/auth';
import { ROUTES } from '@/config/routes';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

/**
 * Forgot Password Page
 * Simple email form that shows success toast.
 */
export const ForgotPassword = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setIsLoading(true);
    try {
      // Send OTP via Supabase (uses email_otp for password recovery)
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}${ROUTES.OTP_VERIFICATION}`,
      });

      if (error) {
        toast.error(error.message || 'Failed to send reset code');
        return;
      }

      // Store email + timestamp in sessionStorage for OTP verification
      sessionStorage.setItem('reset_email', values.email);
      sessionStorage.setItem('reset_email_ts', Date.now().toString());

      setSubmitted(true);
      toast.success('Verification code sent', {
        description: `We sent a 6-digit code to ${values.email}`,
      });
    } catch (error) {
      console.error('Password reset error:', error);
      toast.error('Failed to send reset code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we will send you a reset link"
    >
      {submitted ? (
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Check your email
          </h3>
          <p className="text-muted-foreground text-sm mb-6">
            We have sent a password reset link to{' '}
            <span className="font-medium text-foreground">{form.getValues('email')}</span>.
            Check your inbox and follow the instructions.
          </p>
          <Link to={ROUTES.OTP_VERIFICATION}>
            <Button className="w-full h-11">Continue to Verification</Button>
          </Link>
          <button
            onClick={() => setSubmitted(false)}
            className="text-sm text-primary hover:text-primary/80 mt-4 block mx-auto transition-colors"
          >
            Didn't receive? Try again
          </button>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Email address</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        className="pl-10 h-11"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full h-11 text-base font-medium"
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
        </Form>
      )}

      <Link
        to={ROUTES.SIGN_IN}
        className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to sign in
      </Link>
    </AuthLayout>
  );
};

export default ForgotPassword;
