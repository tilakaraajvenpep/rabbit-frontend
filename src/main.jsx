import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/common/ErrorBoundary'
import './index.css'

// Intercept all avatar/human images to force fallback to default icon
(function() {
  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (name === 'src' && typeof value === 'string' && (
      value.includes('dicebear') || 
      value.includes('xsgames') || 
      value.includes('randomusers') || 
      value.includes('avatar') || 
      value.includes('pixel')
    )) {
      value = 'https://0.0.0.0/error.png';
    }
    return originalSetAttribute.call(this, name, value);
  };

  const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (descriptor && descriptor.set) {
    const originalSet = descriptor.set;
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      ...descriptor,
      set: function(value) {
        if (typeof value === 'string' && (
          value.includes('dicebear') || 
          value.includes('xsgames') || 
          value.includes('randomusers') || 
          value.includes('avatar') || 
          value.includes('pixel')
        )) {
          value = 'https://0.0.0.0/error.png';
        }
        originalSet.call(this, value);
      }
    });
  }
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

