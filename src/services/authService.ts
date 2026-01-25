import { AuthResponse, SignInFormData, SignUpFormData } from "@/types";

/**
 * Service for authentication operations
 * Currently uses mock responses, but structured for real API integration
 */

const SIMULATED_DELAY = 1500;

/**
 * Sign in a user
 */
export const signIn = async (
  formData: SignInFormData
): Promise<AuthResponse> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_DELAY));

  // Mock successful authentication
  return {
    success: true,
    user: {
      id: "user-123",
      email: formData.email,
      name: "John Doe",
    },
    token: "mock-jwt-token",
  };
};

/**
 * Sign up a new user
 */
export const signUp = async (
  formData: SignUpFormData
): Promise<AuthResponse> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_DELAY));

  // Mock successful registration
  return {
    success: true,
    user: {
      id: "user-new",
      email: formData.email,
      name: formData.fullName,
    },
    token: "mock-jwt-token",
  };
};

/**
 * Future: Add more auth-related APIs
 * - forgotPassword()
 * - resetPassword()
 * - verifyEmail()
 * - refreshToken()
 */
