import { Component, type ErrorInfo, type ReactNode } from "react";
import { downloadArchive } from "../lib/archive";

interface Props {
  children: ReactNode;
  /** Shown so the person can tell you where it broke. */
  where?: string;
}

interface State {
  error: Error | null;
  componentStack: string;
  copied: boolean;
  exported: "idle" | "working" | "done" | "failed";
}

/**
 * A crash must never trap someone's records inside the app. Alongside the usual apology this
 * offers a direct export, reading the database rather than the (possibly broken) React tree.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: "", copied: false, exported: "idle" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Local only — nothing is reported anywhere.
    console.error("Afterlight crashed:", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? "" });
  }

  private details(): string {
    const { error, componentStack } = this.state;
    return [
      `Afterlight error report`,
      `Where: ${this.props.where ?? "unknown"}`,
      `When: ${new Date().toISOString()}`,
      `Message: ${error?.message ?? "unknown"}`,
      ``,
      error?.stack ?? "",
      ``,
      componentStack,
    ].join("\n");
  }

  private copy = async () => {
    try {
      await navigator.clipboard.writeText(this.details());
      this.setState({ copied: true });
    } catch {
      this.setState({ copied: false });
    }
  };

  private exportRecords = async () => {
    this.setState({ exported: "working" });
    try {
      await downloadArchive();
      this.setState({ exported: "done" });
    } catch {
      this.setState({ exported: "failed" });
    }
  };

  render() {
    const { error, copied, exported } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="card" role="alert" style={{ maxWidth: 640, margin: "40px auto" }}>
        <div className="card-title">This screen stopped working</div>
        <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>
          Something in Afterlight failed while showing{" "}
          {this.props.where ? <strong>{this.props.where}</strong> : "this page"}. Your records are
          untouched — this is a fault in the app, not in your data.
        </p>
        <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>
          You can export everything right now, before doing anything else. The export reads your
          records straight from this device's storage and does not depend on the part that broke.
        </p>

        <div className="btn-row" style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={this.exportRecords} disabled={exported === "working"}>
            {exported === "working" ? "Exporting…" : "⭳ Export my records"}
          </button>
          <button className="btn" onClick={() => window.location.reload()}>
            Reload the app
          </button>
          <button className="btn subtle" onClick={this.copy}>
            {copied ? "✓ Details copied" : "Copy error details"}
          </button>
        </div>

        {exported === "done" && (
          <p className="muted" style={{ marginTop: 10 }}>
            Export downloaded. Keep it somewhere safe — it contains sensitive health information.
          </p>
        )}
        {exported === "failed" && (
          <p className="muted" style={{ marginTop: 10 }}>
            The export could not be created. Try reloading, then export from Settings.
          </p>
        )}

        <details style={{ marginTop: 16 }}>
          <summary className="muted" style={{ cursor: "pointer" }}>
            Technical details
          </summary>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: "0.75rem",
              color: "var(--text-3)",
              marginTop: 8,
            }}
          >
            {this.details()}
          </pre>
        </details>

        <p className="muted" style={{ fontSize: "0.78rem", marginTop: 14 }}>
          Nothing about this error is sent anywhere. Copying the details is for you to paste into a
          bug report if you choose to.
        </p>
      </div>
    );
  }
}
