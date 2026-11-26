import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected rendering error occurred.',
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught application error:', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#E2E8F0] rounded-lg p-8">
            <h1 className="text-xl font-bold text-[#0F172A] mb-2">
              Something interrupted this view
            </h1>
            <p className="text-sm text-[#475569] mb-5 leading-relaxed">
              ShipCheck recovered cleanly from a client runtime exception. You can retry the view or
              return to the benchmark leaderboard.
            </p>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-3 mb-6 font-mono text-xs text-[#334155] break-all">
              {this.state.errorMessage.slice(0, 260)}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 text-sm font-medium bg-[#0F172A] text-white rounded-md hover:bg-[#1E293B] transition-colors whitespace-nowrap shrink-0"
              >
                Retry View
              </button>
              <a
                href="/"
                className="px-4 py-2 text-sm font-medium text-[#334155] border border-[#CBD5E1] rounded-md hover:bg-[#F1F5F9] transition-colors whitespace-nowrap shrink-0"
              >
                Back to Leaderboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
