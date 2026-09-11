import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StarRating } from './Reviews';

describe('StarRating', () => {
  it('exposes interactive stars as a labeled radio group', () => {
    const onRate = vi.fn();

    render(<StarRating rating={3} onRate={onRate} interactive />);

    expect(screen.getByRole('radiogroup', { name: 'Rating' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3 stars' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }));
    expect(onRate).toHaveBeenCalledWith(5);
  });

  it('announces a read-only rating without exposing decorative stars', () => {
    render(<StarRating rating={4} />);

    expect(screen.getByRole('img', { name: '4 out of 5 stars' })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});
