// Centralized route map for local hosting, Netlify, Vercel, and mobile browsers.
// Use ResumeForgeRoutes.go('dashboard') instead of hardcoding paths in new code.
const ResumeForgeRoutes = (() => {
  const routes = {
    dashboard: 'dashboard.html',
    home: 'index.html',
    login: 'index.html',
    nonTechnical: 'non-technical.html',
    signup: 'signup.html',
    technical: 'technical.html',
  };

  function to(page) {
    return routes[page] || page || routes.home;
  }

  function go(page) {
    window.location.href = to(page);
  }

  return {
    go,
    to,
  };
})();
