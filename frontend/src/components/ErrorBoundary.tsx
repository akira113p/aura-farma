import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clientLog } from '../lib/clientLog';
import { Button } from './Button';
import { Empty } from './Empty';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Captura erros lançados durante o render da árvore de filhos e mostra um
 * fallback amigável em pt-BR. Precisa ser um componente de classe: hooks não
 * capturam erros de render (não existe `useErrorBoundary` no React).
 *
 * Ao capturar, loga via `clientLog.error` com a stack do erro e o
 * `componentStack` (qual componente quebrou) — JSON estruturado (regra 2).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    clientLog.error('erro de render capturado pelo ErrorBoundary', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <Empty
            icon="alert"
            title="Algo deu errado."
            sub="Tente recarregar a página. Se o problema continuar, atualize mais tarde."
            action={
              <Button kind="primary" onClick={this.handleReload}>
                Recarregar
              </Button>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}
