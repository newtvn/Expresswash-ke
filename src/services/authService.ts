import { supabase } from '@/lib/supabase';
import { AuthResponse, SignInFormData, SignUpFormData, User, UserRole } from '@/types';

function mapProfile(profile: Record<string, unknown>): User {
  return {
    id: profile.id as string,
    email: profile.email as string,
    name: profile.name as string,
    phone: (profile.phone as string) ?? undefined,
    role: profile.role as UserRole,
    zone: (profile.zone as string) ?? undefined,
    avatarUrl: (profile.avatar_url as string) ?? undefined,
    isActive: profile.is_active as boolean,
    createdAt: profile.created_at as string,
    lastLoginAt: (profile.last_login_at as string) ?? undefined,
  };
}

export const signIn = async (formData: SignInFormData): Promise<AuthResponse> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  });

  if (error || !data.user) {
    return { success: false, error: error?.message || 'Login failed' };
  }

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    return { success: false, error: 'Profile not found' };
  }

  // Update last login
  await supabase
    .from('profiles')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', data.user.id);

  return {
    success: true,
    user: mapProfile(profile),
    tokens: {
      accessToken: data.session?.access_token ?? '',
      refreshToken: data.session?.refresh_token ?? '',
    },
  };
};

export const signUp = async (formData: SignUpFormData): Promise<AuthResponse> => {
  const { data, error } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        name: formData.fullName,
        phone: formData.phone,
        role: 'customer',
        zone: formData.zone,
      },
    },
  });

  if (error || !data.user) {
    return { success: false, error: error?.message || 'Registration failed' };
  }

  // Wait briefly for trigger to create profile, then fetch
  await new Promise((r) => setTimeout(r, 500));

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  const user: User = profile
    ? mapProfile(profile)
    : {
        id: data.user.id,
        email: formData.email,
        name: formData.fullName,
        phone: formData.phone,
        role: UserRole.CUSTOMER,
        zone: formData.zone,
        createdAt: new Date().toISOString(),
      };

  return {
    success: true,
    user,
    tokens: {
      accessToken: data.session?.access_token ?? '',
      refreshToken: data.session?.refresh_token ?? '',
    },
  };
};

export const forgotPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    return { success: false, message: error.message };
  }
  return { success: true, message: 'Password reset link sent to your email address' };
};

export const verifyOTP = async (email: string, otp: string): Promise<{ success: boolean }> => {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: 'email',
  });
  return { success: !error };
};

/**
 * Reset user password (requires authenticated session)
 * Email and OTP are verified via session, not parameters
 */
export const resetPassword = async (newPassword: string): Promise<{ success: boolean }> => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { success: !error };
};

export const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/portal/dashboard`,
    },
  });
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
};

export const signInWithGithub = async (): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/portal/dashboard`,
    },
  });
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
};

export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
};
