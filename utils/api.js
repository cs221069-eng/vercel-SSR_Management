function getBaseUrl(req) {
  const forwarded = req.headers["x-forwarded-proto"];
  const protocol = forwarded ? forwarded.split(",")[0].trim() : req.protocol;
  const host = req.get("host");
  if (process.env.NODE_ENV === "production" && protocol !== "https") {
    return `https://${host}`;
  }
  return `${protocol}://${host}`;
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
