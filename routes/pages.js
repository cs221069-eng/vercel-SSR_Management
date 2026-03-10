const express = require("express");
const multer = require("multer");
const { getAuth, requirePageAuth } = require("../middleware/auth");
const { apiRequest } = require("../utils/api");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function getHomePath(role) {
  if (role === "admin") return "/admin-dashboard-1";
  if (role === "teacher") return "/teacher-dashboard-1";
  return "/student-dashboard-1";
}

function normalizeExternalUrl(url = "") {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  const withProtocol = /^(https?:)?\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.toString();
  } catch (error) {
    return "";
  }
}

function render(res, view, page = {}) {
  return res.render(view, {
    title: page.title || "FYP SSR",
    auth: page.auth || null,
    error: page.error || "",
    success: page.success || "",
    data: page.data || {}
  });
}

router.use((req, res, next) => {
  res.locals.currentUser = getAuth(req);
  next();
});

router.get("/", (req, res) => {
  const auth = getAuth(req);
  if (!auth) return res.redirect("/login");
  return res.redirect(getHomePath(auth.role));
});

router.get("/go", (req, res) => {
  const normalized = normalizeExternalUrl(req.query.url);
  if (!normalized) {
    return res.status(400).render("error", {
      title: "Invalid Link",
      message: "This link is missing or invalid."
    });
  }

  return res.redirect(normalized);
});

router.get("/login", (req, res) => {
  const auth = getAuth(req);
  if (auth) return res.redirect(getHomePath(auth.role));
  return render(res, "login", {
    title: "Login",
    error: req.query.error || "",
    success: req.query.success || ""
  });
});

router.post("/login", async (req, res) => {
  console.log("Login attempt for email:", req.body.email);
  const result = await apiRequest(req, "/api/auth/login/9165", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: req.body.email,
      password: req.body.password
    })
  });
  console.log("Login response:", { status: result.status, ok: result.ok, message: result.data?.message });

  if (!result.ok) {
    const message = result.data?.message || "Login failed";
    return res.redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  const token = result.data?.token || "";
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000
  });

  return res.redirect(result.data?.redirect || "/");
});

router.post("/logout", (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax"
  });
  return res.redirect("/login?success=Logged out successfully");
});

router.get("/admin-dashboard-1", requirePageAuth(["admin"]), async (req, res) => {
  const result = await apiRequest(req, "/api/admin/admin/dashboard/9165");
  return render(res, "admin/dashboard", {
    title: "Admin Dashboard",
    auth: req.auth,
    error: result.ok ? "" : result.data?.message || "Failed to load dashboard",
    data: result.ok ? result.data?.data || {} : {}
  });
});

router.get("/admin-dashboard-2", requirePageAuth(["admin"]), async (req, res) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const result = await apiRequest(req, `/api/user/all/9165?page=${page}&limit=20`);
  return render(res, "admin/users", {
    title: "User Management",
    auth: req.auth,
    error: result.ok ? "" : result.data?.message || "Failed to load users",
    data: result.ok ? result.data : { data: [], pagination: {} }
  });
});

router.get("/admin-dashboard-3", requirePageAuth(["admin"]), async (req, res) => {
  const result = await apiRequest(req, "/api/admin/admins/9165");
  return render(res, "admin/create-user", {
    title: "Create User",
    auth: req.auth,
    error: req.query.error || (result.ok ? "" : result.data?.message || "Failed to load admins"),
    success: req.query.success || "",
    data: {
      admins: result.ok ? result.data?.data || [] : []
    }
  });
});

router.get("/student-dashboard-1", requirePageAuth(["student"]), async (req, res) => {
  const studentId = req.auth.accountId;
  const result = await apiRequest(req, `/api/user/student/dashboard/${studentId}/9165`);
  return render(res, "student/dashboard", {
    title: "Student Dashboard",
    auth: req.auth,
    error: result.ok ? "" : result.data?.message || "Failed to load student dashboard",
    data: result.ok ? result.data?.data || {} : {}
  });
});

router.get("/student-dashboard-2", requirePageAuth(["student"]), async (req, res) => {
  const studentId = req.auth.accountId;
  const [teachersResult, proposalResult] = await Promise.all([
    apiRequest(req, "/api/user/teacher/all/9165"),
    apiRequest(req, `/api/user/project/student/${studentId}/latest/9165`)
  ]);

  return render(res, "student/project", {
    title: "Student Project",
    auth: req.auth,
    error: req.query.error || "",
    success: req.query.success || "",
    data: {
      teachers: teachersResult.ok ? teachersResult.data?.data || [] : [],
      proposalPayload: proposalResult.ok ? proposalResult.data || {} : {}
    }
  });
});

router.get("/teacher-dashboard-1", requirePageAuth(["teacher"]), async (req, res) => {
  const teacherId = req.auth.accountId;
  const result = await apiRequest(req, `/api/user/teacher/dashboard/${teacherId}/9165`);
  return render(res, "teacher/dashboard", {
    title: "Teacher Dashboard",
    auth: req.auth,
    error: result.ok ? "" : result.data?.message || "Failed to load teacher dashboard",
    data: result.ok ? result.data?.data || {} : {}
  });
});

router.get("/teacher-dashboard-2", requirePageAuth(["teacher"]), async (req, res) => {
  const teacherId = req.auth.accountId;
  const result = await apiRequest(req, `/api/user/teacher/dashboard/${teacherId}/9165`);
  return render(res, "teacher/students", {
    title: "Teacher Students",
    auth: req.auth,
    error: result.ok ? "" : result.data?.message || "Failed to load assigned students",
    data: result.ok ? result.data?.data || {} : {}
  });
});

router.get("/teacher-projects", requirePageAuth(["teacher"]), async (req, res) => {
  const teacherId = req.auth.accountId;
  const [projectsResult, dashboardResult] = await Promise.all([
    apiRequest(req, `/api/user/project/teacher/${teacherId}/9165`),
    apiRequest(req, `/api/user/teacher/dashboard/${teacherId}/9165`)
  ]);

  return render(res, "teacher/projects", {
    title: "Teacher Projects",
    auth: req.auth,
    error: projectsResult.ok && dashboardResult.ok ? "" : "Failed to load teacher projects",
    data: {
      projects: projectsResult.ok ? projectsResult.data?.data || [] : [],
      dashboard: dashboardResult.ok ? dashboardResult.data?.data || {} : {}
    }
  });
});

router.get("/teacher-reports", requirePageAuth(["teacher"]), async (req, res) => {
  const teacherId = req.auth.accountId;
  const result = await apiRequest(req, `/api/user/teacher/reports/${teacherId}/9165`);
  return render(res, "teacher/reports", {
    title: "Teacher Reports",
    auth: req.auth,
    error: result.ok ? "" : result.data?.message || "Failed to load reports",
    data: result.ok ? result.data?.data || {} : {}
  });
});

router.post("/admin/users/create", requirePageAuth(["admin"]), async (req, res) => {
  const result = await apiRequest(req, "/api/user/create/9165", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req.body)
  });

  if (!result.ok) {
    return res.redirect(`/admin-dashboard-3?error=${encodeURIComponent(result.data?.message || "Failed to create user")}`);
  }

  return res.redirect("/admin-dashboard-3?success=User created successfully");
});

router.post("/admin/users/:id/edit", requirePageAuth(["admin"]), async (req, res) => {
  const result = await apiRequest(req, `/api/user/edit/${req.params.id}/9165`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req.body)
  });
  return res.json(result.data);
});

router.post("/admin/users/:id/delete", requirePageAuth(["admin"]), async (req, res) => {
  const result = await apiRequest(req, `/api/user/delete/${req.params.id}/9165`, {
    method: "DELETE"
  });
  return res.json(result.data);
});

router.post("/admin/projects/:id/committee", requirePageAuth(["admin"]), async (req, res) => {
  const result = await apiRequest(req, `/api/user/project/${req.params.id}/committee/9165`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: req.body.action })
  });
  return res.json(result.data);
});

router.post("/student/task", requirePageAuth(["student"]), async (req, res) => {
  const result = await apiRequest(req, `/api/user/student/dashboard/task/${req.auth.accountId}/9165`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req.body)
  });
  return res.json(result.data);
});

router.post("/student/task/:taskId/status", requirePageAuth(["student"]), async (req, res) => {
  const result = await apiRequest(req, `/api/user/student/dashboard/task/${req.auth.accountId}/${req.params.taskId}/9165`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: req.body.status })
  });
  return res.json(result.data);
});

router.post("/student/resource", requirePageAuth(["student"]), async (req, res) => {
  const result = await apiRequest(req, `/api/user/student/dashboard/resource/${req.auth.accountId}/9165`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req.body)
  });
  return res.json(result.data);
});

router.post("/student/message", requirePageAuth(["student"]), async (req, res) => {
  const result = await apiRequest(req, `/api/user/student/dashboard/message/${req.auth.accountId}/9165`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req.body)
  });
  return res.json(result.data);
});

router.post("/student/proposal", requirePageAuth(["student"]), upload.array("documents", 5), async (req, res) => {
  const form = new FormData();
  form.append("title", req.body.title || "");
  form.append("description", req.body.description || "");
  form.append("Domain", req.body.Domain || "");
  form.append("supervisor", req.body.supervisor || "");

  (req.files || []).forEach((file) => {
    const blob = new Blob([file.buffer], { type: file.mimetype });
    form.append("documents", blob, file.originalname);
  });

  const result = await apiRequest(req, `/api/user/project/${req.auth.accountId}/9165`, {
    method: "POST",
    body: form
  });
  return res.json(result.data);
});

router.post("/student/work", requirePageAuth(["student"]), upload.array("documents", 5), async (req, res) => {
  const form = new FormData();
  form.append("title", req.body.title || "");
  form.append("description", req.body.description || "");

  (req.files || []).forEach((file) => {
    const blob = new Blob([file.buffer], { type: file.mimetype });
    form.append("documents", blob, file.originalname);
  });

  const result = await apiRequest(req, `/api/user/student/dashboard/work/${req.auth.accountId}/9165`, {
    method: "POST",
    body: form
  });
  return res.json(result.data);
});

router.post("/teacher/projects/:id/review", requirePageAuth(["teacher"]), async (req, res) => {
  const result = await apiRequest(req, `/api/user/project/${req.params.id}/review/${req.auth.accountId}/9165`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: req.body.action })
  });
  return res.json(result.data);
});

router.get("/teacher/workspace/:studentId", requirePageAuth(["teacher"]), async (req, res) => {
  const result = await apiRequest(req, `/api/user/teacher/workspace/${req.auth.accountId}/student/${req.params.studentId}/9165`);
  return res.json(result.data);
});

router.post("/teacher/message/:studentId", requirePageAuth(["teacher"]), async (req, res) => {
  const result = await apiRequest(req, `/api/user/teacher/message/${req.auth.accountId}/student/${req.params.studentId}/9165`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req.body)
  });
  return res.json(result.data);
});

module.exports = router;
