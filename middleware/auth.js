function requireLogin(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect('/login');
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) return res.redirect('/login');
    if (roles.length === 0 || roles.includes(req.session.role)) return next();
    return res.status(403).render('error', { status: 403, message: 'Anda tidak memiliki hak akses ke halaman ini.' });
  };
}

module.exports = { requireLogin, requireRole };
