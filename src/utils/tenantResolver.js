export const resolveTenant = () => {
  // Check query parameter first (useful for testing)
  const params = new URLSearchParams(window.location.search);
  const tenantParam = params.get('tenant');
  if (tenantParam) return tenantParam;

  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'dev';
  }

  const parts = hostname.split('.');
  if (parts.length > 2) {
    return parts[0];
  }
  
  return 'dev';
};
