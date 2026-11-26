import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw, ShieldAlert } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Portal ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let displayDetail = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; operationType?: string; path?: string };
        if (parsed && parsed.error) {
          displayDetail = `${parsed.error} (${parsed.operationType || 'op'} ${parsed.path || ''})`.trim();
        }
      } catch {
        // Not a JSON FirestoreErrorInfo string
      }

      return (
        <div className="min-h-screen w-full bg-[#0d0b14] text-[#f4efe6] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161124] border-2 border-rose-500/80 p-6 pixel-frame text-center">
            <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto mb-3" />
            <h1 className="font-pixel text-lg text-amber-300">Portal Recovery</h1>
            <p className="mt-2 text-xs text-[#cbbfe0] break-words">{displayDetail}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 h-10 px-5 border-2 border-amber-300 bg-[#d9483b] hover:bg-[#eb594b] text-white font-bold text-xs inline-flex items-center gap-2 pixel-frame cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Portal</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
