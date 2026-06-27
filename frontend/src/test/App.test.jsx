import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Hoist the Axios Mock Instance to resolve ES Module loading order issues
const mockAxiosInstance = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  interceptors: {
    request: { use: vi.fn(), eject: vi.fn() },
    response: { use: vi.fn(), eject: vi.fn() },
  },
  defaults: {
    headers: {
      common: {},
    },
  },
}));

// 2. Mock the axios library using the hoisted instance
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: {
      headers: {
        common: {},
      },
    },
  },
}));

// 3. Import App AFTER the mocks are registered and hoisted
import App from '../App.jsx';

describe('Frontend Authentication Integration (Module 2.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Ensure document root doesn't accumulate classes between tests
    document.documentElement.className = '';
  });

  it('boots to the Login screen by default when no active session is cached', async () => {
    // Mock silent session check to fail (no refresh cookie)
    mockAxiosInstance.post.mockRejectedValueOnce(new Error('Unauthorized'));

    render(<App />);

    // Verify it transitions to the Login page
    await waitFor(() => {
      expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('developer@devlens.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('displays client-side validation errors on empty fields', async () => {
    mockAxiosInstance.post.mockRejectedValueOnce(new Error('Unauthorized'));

    render(<App />);

    await screen.findByText('Welcome Back');

    const signInButton = screen.getByRole('button', { name: /Sign In/i });
    fireEvent.click(signInButton);

    // Verify client-side validations trigger without making API calls
    expect(screen.getByText('Email address is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1); // Only the initial checkAuth was called
  });

  it('handles a successful login flow and navigates to the secure Dashboard', async () => {
    // 1. Initial silent checkAuth fails
    mockAxiosInstance.post.mockRejectedValueOnce(new Error('Unauthorized'));

    render(<App />);

    // Wait for login screen to render
    await screen.findByText('Welcome Back');

    // Fill out the form
    const emailInput = screen.getByPlaceholderText('developer@devlens.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    
    fireEvent.change(emailInput, { target: { value: 'developer@devlens.com' } });
    fireEvent.change(passwordInput, { target: { value: 'StrongPassword123!' } });

    // Mock successful login call
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          accessToken: 'mock_access_token',
          user: {
            id: 1,
            email: 'developer@devlens.com',
            name: 'Alex Dev',
          },
        },
      },
    });

    // Mock profile fetch which runs right after login in checkAuth/routing
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          user: {
            id: 1,
            email: 'developer@devlens.com',
            name: 'Alex Dev',
          },
        },
      },
    });

    // Mock dashboard health check call
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        status: 'healthy',
        services: {
          database: 'connected',
          cache: 'connected',
        },
      },
    });

    // Click submit
    const signInButton = screen.getByRole('button', { name: /Sign In/i });
    fireEvent.click(signInButton);

    // Verify loading state triggers
    expect(screen.getByText(/Signing in/i)).toBeInTheDocument();

    // Verify it redirects to dashboard and displays the new premium dashboard welcome elements
    await waitFor(() => {
      expect(screen.getByText('No Active Analysis Loaded')).toBeInTheDocument();
      expect(screen.getByText('Analyze Developer')).toBeInTheDocument();
    });

    // Verify user information is displayed in the navigation header
    expect(await screen.findByText('Alex Dev')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument();
  });
});
