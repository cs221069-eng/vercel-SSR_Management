const jwt = require("jsonwebtoken");

function getToken(req) {
  return req.cookies?.token || "";
}

function getAuth(req) {
  const token = getToken(req);
  if (!token) return null;

  try {
    return jwt.verify(token, process.env.JWT_SECRET || "secret");
  } catch (error) {
    return null;
  }
}

function requirePageAuth(roles = []) {
  return (req, res, next) => {
    const auth = getAuth(req);

    if (!auth) {
      return res.redirect("/login");
    }

    if (roles.length > 0 && !roles.includes(auth.role)) {
      if (auth.role === "admin") return res.redirect("/admin-dashboard-1");
      if (auth.role === "teacher") return res.redirect("/teacher-dashboard-1");
      return res.redirect("/student-dashboard-1");
    }

    req.auth = auth;
    return next();
  };
}

module.exports = {
  getAuth,
  requirePageAuth
};
