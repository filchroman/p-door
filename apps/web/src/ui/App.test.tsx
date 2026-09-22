import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ru } from '../i18n/ru';
import { App } from './App';

describe('App', () => {
  it('renders the game column with the script title', () => {
    render(<App />);
    expect(screen.getByRole('main')).toHaveClass('app-column');
    expect(screen.getByRole('heading', { name: ru.appTitle })).toHaveClass('script-title');
  });
});
