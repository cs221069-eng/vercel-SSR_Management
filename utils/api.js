function getBaseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

async function apiRequest(req, path, options = {}) {
  const response = await fetch(`${getBaseUrl(req)}${path}`, {
    method: options.method || "GET",
    headers: {
      cookie: req.headers.cookie || "",
      ...(options.headers || {})
    },
    body: options.body
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

module.exports = {
  apiRequest
};
