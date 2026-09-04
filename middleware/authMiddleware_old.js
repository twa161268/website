function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // Belum login

    // DEBUG sementara
    //console.log('SESSION USER :', req.session.user);
    //console.log('SESSION ROLE :', req.session.role);
    //console.log('ALLOWED ROLE :', allowedRoles);

    if (!req.session.user) {
      return res.redirect('/login');
    }

    // Cek role
    if (!allowedRoles.includes(req.session.role)) {
      return res.status(403).send('Anda tidak memiliki hak akses.');
    }

    next();
  };
}

module.exports = {
  requireLogin,
  requireRole,
};
