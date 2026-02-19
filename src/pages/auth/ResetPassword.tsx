import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';
import { AuthLayout } from '@/components/auth';
import { ROUTES } from '@/config/routes';
import { toast } from 'sonner';
import { resetPassword } from '@/services/authService';

interface ResetPasswordForm {
  password: string;
  confirmPassword: string;
}

export const ResetPassword = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ResetPasswordForm>({
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: ResetPasswordForm) => {
    if (values.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (values.password !== values.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const result = await resetPassword(values.password);
      if (result.success) {
        toast.success('Password updated!', {
          description: 'You can now sign in with your new password.',
        });
        navigate(ROUTES.SIGN_IN);
      } else {
        toast.error('Failed to reset password. Please try again.');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Set new password"
      subtitle="Enter your new password below"
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="At least 8 characters"
            {...form.register('password', { required: true, minLength: 8 })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Re-enter your password"
            {...form.register('confirmPassword', { required: true })}
          />
        </div>

        <Button
          type="submit"
          className="w-full h-11 text-base font-medium"
          disabled={isLoading}
        >
          {isLoading ? 'Updating...' : 'Update Password'}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ResetPassword;
