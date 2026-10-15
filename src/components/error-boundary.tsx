import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode; resetKey?: unknown };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('probono error', error, info.componentStack);
  }
  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-plum p-6 text-center text-cream">
        <div className="max-w-sm">
          <h1 className="font-serif text-3xl">Something went wrong</h1>
          <p className="mt-2 text-sm text-cream/70">This part of the app hit an error.</p>
          <button onClick={() => this.setState({ error: null })} className="mt-5 min-h-11 rounded-full bg-cream px-5 text-sm font-semibold text-plum">Try again</button>
        </div>
      </div>
    );
  }
}
