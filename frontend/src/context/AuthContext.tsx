"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

interface AuthContextType {
  token: string | null;
  email: string | null;
  userId: string | null;
  isLoading: boolean;
  login: (token: string, email: string, userId : string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedEmail = localStorage.getItem("email");
    const storedUserId = localStorage.getItem("userId");
    if (storedToken) {
      setToken(storedToken);
      setEmail(storedEmail);
      setUserId(storedUserId);
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newEmail: string, userId: string) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("email", newEmail);
    localStorage.setItem("userId", userId);
    setToken(newToken);
    setEmail(newEmail);
    setUserId(userId);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    localStorage.removeItem("userId");
    setToken(null);
    setEmail(null);
    setUserId(null);
  };

  return (
    <AuthContext.Provider value={{ token, email, userId, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
