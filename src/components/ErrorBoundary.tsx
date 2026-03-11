import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "40px",
          background: "#fff3f3",
          border: "2px solid red",
          borderRadius: "8px",
          margin: "20px",
          fontFamily: "monospace",
        }}>
          <h2 style={{ color: "red", marginBottom: "16px" }}>
            Something went wrong
          </h2>
          <pre style={{
            background: "#1e1e1e",
            color: "#f8f8f8",
            padding: "16px",
            borderRadius: "4px",
            overflow: "auto",
            maxHeight: "400px",
            whiteSpace: "pre-wrap",
          }}>
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: "16px",
              padding: "8px 16px",
              background: "#4a90d9",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
