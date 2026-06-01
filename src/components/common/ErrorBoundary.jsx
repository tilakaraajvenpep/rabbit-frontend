import React from 'react';
import { Result, Button, Typography } from 'antd';

const { Paragraph, Text } = Typography;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    try {
      sessionStorage.removeItem('chunk-reload-occurred');
    } catch (e) {}
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error('ErrorBoundary caught an error', error, errorInfo);

    const errorText = error ? error.toString() : '';
    const isChunkLoadFailed = 
      errorText.includes('Failed to fetch dynamically imported module') ||
      errorText.includes('Failed to load module script') ||
      errorText.includes('loading chunk') ||
      errorText.includes('ChunkLoadError');

    if (isChunkLoadFailed) {
      try {
        const hasReloaded = sessionStorage.getItem('chunk-reload-occurred');
        if (!hasReloaded) {
          sessionStorage.setItem('chunk-reload-occurred', 'true');
          window.location.reload();
        }
      } catch (e) {
        console.error('Failed to trigger chunk reload', e);
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
          <Result
            status="error"
            title="Something went wrong"
            subTitle="The application encountered an unexpected error. Please try reloading the page."
            extra={[
              <Button type="primary" key="reload" onClick={() => window.location.reload()}>
                Reload Page
              </Button>,
              <Button key="home" onClick={() => window.location.href = '/'}>
                Go to Home
              </Button>
            ]}
          >
            {process.env.NODE_ENV === 'development' && (
              <div style={{ textAlign: 'left', marginTop: 24 }}>
                <Paragraph>
                  <Text strong>Error Details:</Text>
                </Paragraph>
                <Paragraph type="danger">
                  {this.state.error && this.state.error.toString()}
                </Paragraph>
                <pre style={{ maxHeight: '200px', overflow: 'auto', background: '#fff', padding: 12, border: '1px solid #d9d9d9' }}>
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </div>
            )}
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
