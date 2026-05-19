import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#F0F4F2",
        padding: "32px 16px",
        fontFamily: "monospace",
      }}>
        <div style={{
          maxWidth: 480,
          width: "100%",
          background: "#fff",
          border: "1px solid rgba(11,107,75,0.16)",
          borderRadius: 20,
          padding: "36px 28px",
          textAlign: "center",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}>
          <div style={{
            fontSize: 40, marginBottom: 16,
          }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1B1F1D", marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 13, color: "#51605A", marginBottom: 20, lineHeight: 1.6 }}>
            Shadow OTC hit an unexpected error. Try refreshing the page — your wallet and deals are safe on-chain.
          </p>
          {this.state.error && (
            <pre style={{
              fontSize: 11, color: "#7B8A84",
              background: "#F3F6F4", borderRadius: 10,
              padding: "10px 14px", overflowX: "auto",
              textAlign: "left", marginBottom: 20,
              border: "1px solid rgba(11,107,75,0.12)",
            }}>
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#0B6B4B", color: "#fff",
              border: "none", borderRadius: 10,
              padding: "10px 24px", fontSize: 13, fontWeight: 600,
              cursor: "pointer",
            }}>
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
}
