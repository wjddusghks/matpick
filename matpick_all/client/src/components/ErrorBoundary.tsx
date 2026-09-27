import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";
import { getBrowserFallbackLocale } from "@/lib/locale";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      const isEnglish = getBrowserFallbackLocale() === "en";
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">{isEnglish ? "We couldn't load this page." : "화면을 불러오지 못했어요."}</h2>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <p role="alert" className="text-sm text-muted-foreground">
                {isEnglish ? "Please check your connection and try again shortly. If you've opened many results, wait a little before retrying." : "연결 상태를 확인하고 잠시 후 다시 시도해 주세요. 여러 결과를 연속으로 조회했다면 조금 기다린 후 재시도해 주세요."}
              </p>
            </div>

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              {isEnglish ? "Try again" : "다시 시도"}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
