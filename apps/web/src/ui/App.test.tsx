import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the game column', () => {
    render(<App />);
    expect(screen.getByRole('main')).toHaveClass('app-column');
  });
});
