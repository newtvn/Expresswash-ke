import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock } from 'lucide-react';

export const SessionTimeoutWarning = () => {
  const { showWarning, remainingTime, dismissWarning, handleLogout } = useSessionTimeout();

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AlertDialog open={showWarning} onOpenChange={(open) => !open && dismissWarning()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-full">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <AlertDialogTitle>Session Timeout Warning</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-4">
            You will be logged out in{' '}
            <span className="font-bold text-yellow-600">{formatTime(remainingTime)}</span> due to
            inactivity.
          </AlertDialogDescription>
          <AlertDialogDescription>
            Click "Stay Logged In" to continue your session, or "Logout Now" to logout
            immediately.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleLogout}>Logout Now</AlertDialogCancel>
          <AlertDialogAction onClick={dismissWarning}>Stay Logged In</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
