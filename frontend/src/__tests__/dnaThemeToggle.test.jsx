import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DnaThemeToggle from '../components/common/DnaThemeToggle.jsx';
import AppLayout from '../layouts/AppLayout.jsx';
import AuthLayout from '../layouts/AuthLayout.jsx';
import { useThemeStore } from '../store/useThemeStore.js';
import { useAuthStore } from '../store/useAuthStore.js';
import { mockResponse, stubFetchRoutes } from './testHelpers.js';

describe('DnaThemeToggle Interactive Helix & Pull-Cord Physics', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
    useThemeStore.setState({ theme: 'dark' });
  });

  it('renders DNA helix SVG strands, rungs, nodes, and switch handle', () => {
    const { container } = render(<DnaThemeToggle />);
    const toggleBtn = screen.getByRole('switch', {
      name: /Ganti mode terang atau gelap/i,
    });
    expect(toggleBtn).toBeInTheDocument();
    expect(container.querySelector('.dna-toggle svg')).toBeInTheDocument();
    expect(container.querySelectorAll('.dna-strand').length).toBe(2);
    expect(container.querySelectorAll('.dna-rung').length).toBe(9);
    expect(container.querySelectorAll('.dna-node').length).toBe(18);
  });

  it('toggles DOM data-theme, classList, localStorage, and aria-checked on click and keyboard', () => {
    localStorage.setItem('gwasena_theme', 'dark');
    render(<DnaThemeToggle />);
    const toggleBtn = screen.getByRole('switch');

    expect(toggleBtn).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Click -> Light mode
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-checked', 'false');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(localStorage.getItem('gwasena_theme')).toBe('light');

    // Keyboard Enter -> Dark mode
    fireEvent.keyDown(toggleBtn, { key: 'Enter' });
    expect(toggleBtn).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Keyboard Space -> Light mode
    fireEvent.keyDown(toggleBtn, { key: ' ' });
    expect(toggleBtn).toHaveAttribute('aria-checked', 'false');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('triggers toggle on pointer tap and pull-cord drag > 14px, but not on short tug <= 14px', () => {
    const onToggle = vi.fn();
    render(<DnaThemeToggle externalTheme="dark" onToggleTheme={onToggle} />);
    const toggleBtn = screen.getByRole('switch');

    // Short tug (dy = 7 >= CLICK_SLOP 5, <= PULL_THRESHOLD 14): should NOT toggle
    fireEvent.pointerDown(toggleBtn, { clientX: 32, clientY: 76, pointerId: 1 });
    fireEvent.pointerMove(toggleBtn, { clientX: 32, clientY: 83, pointerId: 1 });
    fireEvent.pointerUp(toggleBtn, { clientX: 32, clientY: 83, pointerId: 1 });
    expect(onToggle).toHaveBeenCalledTimes(0);

    // Deep pull (dy = 22 > PULL_THRESHOLD 14): MUST toggle once
    fireEvent.pointerDown(toggleBtn, { clientX: 32, clientY: 76, pointerId: 1 });
    fireEvent.pointerMove(toggleBtn, { clientX: 32, clientY: 98, pointerId: 1 });
    fireEvent.pointerUp(toggleBtn, { clientX: 32, clientY: 98, pointerId: 1 });
    expect(onToggle).toHaveBeenCalledTimes(1);

    // Short tap (moved = 0 < CLICK_SLOP 5): MUST toggle once (even if trailing click fires)
    fireEvent.pointerDown(toggleBtn, { clientX: 32, clientY: 76, pointerId: 1 });
    fireEvent.pointerUp(toggleBtn, { clientX: 32, clientY: 76, pointerId: 1 });
    fireEvent.click(toggleBtn);
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('cancels animation frame & timers on unmount without leaks', () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    const clearSpy = vi.spyOn(window, 'clearTimeout');
    const { unmount } = render(<DnaThemeToggle />);
    const toggleBtn = screen.getByRole('switch');
    // Trigger tap so pending clickResetTimer is queued before immediate unmount
    fireEvent.pointerDown(toggleBtn, { clientX: 32, clientY: 76, pointerId: 1 });
    fireEvent.pointerUp(toggleBtn, { clientX: 32, clientY: 76, pointerId: 1 });
    unmount();
    expect(cancelSpy).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
  });

  it('advances helix path smoothly via delta-time across dark and light transitions', () => {
    let nextFrame = null;
    let nowMs = 1000;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      nextFrame = cb;
      return 123;
    });
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);

    const { container } = render(<DnaThemeToggle />);
    const strandA = container.querySelector('.dna-strand.a');
    expect(strandA).toBeInTheDocument();

    // Advance several delta-time frames in dark mode
    nowMs += 50;
    nextFrame?.(nowMs);
    const dDark = strandA.getAttribute('d');

    // Toggle to light mode & keep stepping frames -> helix must keep animating cleanly
    fireEvent.click(screen.getByRole('switch'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    nowMs += 50;
    nextFrame?.(nowMs);
    const dLight1 = strandA.getAttribute('d');

    nowMs += 50;
    nextFrame?.(nowMs);
    const dLight2 = strandA.getAttribute('d');

    expect(dDark).toBeTruthy();
    expect(dLight1).not.toBe(dDark);
    expect(dLight2).not.toBe(dLight1);
  });

  it('integrates inside AppLayout and AuthLayout headers with overflow-visible & Zustand theme sync', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { user_id: 1, username: 'peneliti', role: 'pengguna_analisis' },
    });
    stubFetchRoutes(async () => mockResponse(200, { status: 'ok', postgres: 'ok' }));

    const { container, unmount } = render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    const appHeader = container.querySelector('header');
    expect(appHeader.className).toContain('overflow-visible');

    const switches = screen.getAllByRole('switch', {
      name: /Ganti mode terang atau gelap/i,
    });
    expect(switches.length).toBe(2); // Desktop & Mobile navbars
    expect(useThemeStore.getState().theme).toBe('dark');

    fireEvent.click(switches[0]);
    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    unmount();

    const { container: authContainer } = render(
      <MemoryRouter>
        <AuthLayout />
      </MemoryRouter>
    );
    const authHeader = authContainer.querySelector('header');
    expect(authHeader.className).toContain('overflow-visible');
    const authSwitch = screen.getByRole('switch');
    fireEvent.click(authSwitch);
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
