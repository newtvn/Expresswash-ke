import { render, screen } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

class ThrowOnRender extends Component<{ shouldThrow: boolean; children: ReactNode }> {
  render() {
    if (this.props.shouldThrow) throw new Error('route render failed');
    return this.props.children;
  }
}

describe('ErrorBoundary', () => {
  it('recovers when a reset key changes after a routed child throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rerender } = render(
      <ErrorBoundary fallbackTitle="Admin Page Error" resetKeys={['/admin/invoices']}>
        <ThrowOnRender shouldThrow={true}>Invoices</ThrowOnRender>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Admin Page Error')).toBeInTheDocument();

    rerender(
      <ErrorBoundary fallbackTitle="Admin Page Error" resetKeys={['/admin/accounts']}>
        <ThrowOnRender shouldThrow={false}>Accounts</ThrowOnRender>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Accounts')).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
