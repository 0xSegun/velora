"use client";

import React from "react";
import { AlertCircle } from "lucide-react";
import { logError } from "@/lib/errorHandler";
import { MESSAGES } from "@/lib/feedback";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError("Unhandled UI error", { error, info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <div className="max-w-md glass-panel rounded-2xl p-8 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-[#DC2626]" />
            <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {MESSAGES.network.generic}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="mt-6 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}