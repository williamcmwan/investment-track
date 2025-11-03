import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../services/api';

interface User {
  id: number;
  email: string;
  name: string;
  baseCurrency: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; requiresTwoFactor?: boolean; userId?: number; error?: string }>;
  loginWithTwoFactor: (userId: number, token: string) => Promise<{ success: boolean; error?: string }>;
  register: (userData: {
    email: string;
    password: string;
    name: string;
    baseCurrency?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token and user data on app load
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');
    
    if (storedToken && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(userData);
        apiClient.setToken(storedToken);
        setIsLoading(false);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        // Clear invalid data
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; requiresTwoFactor?: boolean; userId?: number; error?: string }> => {
    try {
      const response = await apiClient.login(email, password);
      if (response.data) {
        // Check if 2FA is required
        if (response.data.requiresTwoFactor) {
          return {
            success: false,
            requiresTwoFactor: true,
            userId: response.data.userId
          };
        }
        
        // Normal login success
        setUser(response.data.user);
        setToken(response.data.token);
        apiClient.setToken(response.data.token);
        localStorage.setItem('auth_user', JSON.stringify(response.data.user));
        return { success: true };
      }
      return { 
        success: false, 
        error: response.error || 'Login failed' 
      };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: 'Network error occurred' 
      };
    }
  };

  const loginWithTwoFactor = async (userId: number, token: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('loginWithTwoFactor called with:', { userId, token });
      // Verify the 2FA token and get user info + JWT token
      const response = await apiClient.verifyTwoFactorLogin(userId, token);
      console.log('2FA verification response received');
      
      if (response.data && response.data.verified && response.data.user && response.data.token) {
        console.log('Setting user and token for:', response.data.user?.email || 'unknown user');
        // Set user and token from the response
        setUser(response.data.user);
        setToken(response.data.token);
        apiClient.setToken(response.data.token);
        localStorage.setItem('auth_token', response.data.token);
        localStorage.setItem('auth_user', JSON.stringify(response.data.user));
        return { success: true };
      }
      console.log('2FA verification failed:', response.error || 'unknown error');
      return { 
        success: false, 
        error: response.error || '2FA verification failed' 
      };
    } catch (error) {
      console.error('2FA login error:', error);
      return { 
        success: false, 
        error: 'Network error occurred' 
      };
    }
  };

  const register = async (userData: {
    email: string;
    password: string;
    name: string;
    baseCurrency?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await apiClient.register(userData);
      if (response.data) {
        setUser(response.data.user);
        setToken(response.data.token);
        apiClient.setToken(response.data.token);
        localStorage.setItem('auth_user', JSON.stringify(response.data.user));
        return { success: true };
      }
      return { 
        success: false, 
        error: response.error || 'Registration failed' 
      };
    } catch (error) {
      console.error('Registration error:', error);
      return { 
        success: false, 
        error: 'Network error occurred' 
      };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    apiClient.setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    loginWithTwoFactor,
    register,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
