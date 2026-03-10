async function sendJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return response.json();
}

function normalizeUrl(url) {
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function toRedirectUrl(url) {
  const normalized = normalizeUrl(url);
  return normalized ? `/go?url=${encodeURIComponent(normalized)}` : "#";
}

function syncTeacherProjectBadges() {
  const updates = Array.isArray(window.__teacherStudentUpdates) ? window.__teacherStudentUpdates : [];
  const teacherId = window.__teacherId || "";
  if (!teacherId || updates.length === 0) return;

  const updateMap = updates.reduce((acc, item) => {
    acc[item.studentId] = item;
    return acc;
  }, {});

  document.querySelectorAll("[data-load-workspace]").forEach((button) => {
    const studentId = button.dataset.loadWorkspace || "";
    const projectId = button.dataset.projectId || "";
    const badge = button.querySelector("[data-project-badge]");
    if (!badge || !studentId || !projectId) return;

    const summary = updateMap[studentId];
    const count = Number(summary?.studentUpdateCount || 0);
    const lastAt = summary?.lastStudentUpdateAt || "";
    const seenKey = `teacher_project_seen_${teacherId}_${projectId}`;
    const seenAt = localStorage.getItem(seenKey);

    let unread = count;
    if (seenAt && lastAt) {
      const seenTime = new Date(seenAt).getTime();
      const lastTime = new Date(lastAt).getTime();
      if (!Number.isNaN(seenTime) && !Number.isNaN(lastTime) && seenTime >= lastTime) {
        unread = 0;
      }
    }

    if (unread > 0) {
      badge.textContent = unread > 9 ? "9+" : String(unread);
      badge.classList.remove("hidden");
      badge.classList.add("inline-flex");
    } else {
      badge.textContent = "";
      badge.classList.add("hidden");
      badge.classList.remove("inline-flex");
    }
  });
}

function reloadOnSuccess(result) {
  if (result?.success) {
    window.location.reload();
    return;
  }
  window.alert(result?.message || "Action failed");
}

document.addEventListener("click", async (event) => {
  const taskToggle = event.target.closest("[data-task-toggle]");
  if (taskToggle) {
    const taskId = taskToggle.dataset.taskToggle;
    const details = document.querySelector(`#task-details-${taskId}`);
    const icon = taskToggle.querySelector(".material-symbols-outlined");
    if (details) {
      details.classList.toggle("hidden");
      if (icon) {
        icon.textContent = details.classList.contains("hidden") ? "expand_more" : "expand_less";
      }
    }
  }

  const committeeButton = event.target.closest("[data-committee-action]");
  if (committeeButton) {
    const result = await sendJson(`/admin/projects/${committeeButton.dataset.projectId}/committee`, {
      action: committeeButton.dataset.committeeAction
    });
    reloadOnSuccess(result);
  }

  const deleteButton = event.target.closest("[data-delete-user]");
  if (deleteButton) {
    if (!window.confirm("Delete this user?")) return;
    const result = await sendJson(`/admin/users/${deleteButton.dataset.userId}/delete`, {});
    reloadOnSuccess(result);
  }

  const editButton = event.target.closest("[data-edit-user]");
  if (editButton) {
    const user = JSON.parse(editButton.dataset.user);
    const dialog = document.querySelector("#edit-user-dialog");
    if (!dialog) return;
    dialog.querySelector("[name='id']").value = user._id;
    dialog.querySelector("[name='name']").value = user.name || "";
    dialog.querySelector("[name='email']").value = user.email || "";
    dialog.querySelector("[name='role']").value = user.role || "student";
    dialog.querySelector("[name='department']").value = user.department || "";
    dialog.querySelector("[name='status']").value = user.status || "active";
    dialog.showModal();
  }

  const closeDialog = event.target.closest("[data-close-dialog]");
  if (closeDialog) {
    document.querySelector(closeDialog.dataset.closeDialog)?.close();
  }

  const taskStatusButton = event.target.closest("[data-task-status]");
  if (taskStatusButton) {
    const result = await sendJson(`/student/task/${taskStatusButton.dataset.taskStatus}/status`, {
      status: taskStatusButton.dataset.status
    });
    reloadOnSuccess(result);
  }

  const reviewButton = event.target.closest("[data-review-project]");
  if (reviewButton) {
    const result = await sendJson(`/teacher/projects/${reviewButton.dataset.reviewProject}/review`, {
      action: reviewButton.dataset.action
    });
    reloadOnSuccess(result);
  }

  const workspaceButton = event.target.closest("[data-load-workspace]");
  if (workspaceButton) {
    const project = workspaceButton.dataset.project ? JSON.parse(workspaceButton.dataset.project) : null;
    const teacherId = window.__teacherId || "";
    const projectId = workspaceButton.dataset.projectId || "";
    if (teacherId && projectId) {
      localStorage.setItem(`teacher_project_seen_${teacherId}_${projectId}`, new Date().toISOString());
      syncTeacherProjectBadges();
    }

    const response = await fetch(`/teacher/workspace/${workspaceButton.dataset.loadWorkspace}`);
    const result = await response.json();
    const panel = document.querySelector("#teacher-workspace-panel");
    const content = document.querySelector("#teacher-workspace-content");
    const form = document.querySelector("#teacher-message-form");
    if (!panel || !content || !form) return;
    panel.classList.remove("hidden");
    panel.classList.add("flex");
    form.querySelector("[name='studentId']").value = workspaceButton.dataset.loadWorkspace;

    if (!result?.success) {
      content.innerHTML = `<div class="alert error">${result?.message || "Failed to load workspace"}</div>`;
      return;
    }

    const data = result.data || {};
    const proposalFiles = (project?.documents || []).map((doc) => `
      <a href="${toRedirectUrl(doc.downloadUrl || doc.url)}" target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">
        <span class="material-symbols-outlined !text-[16px]">download</span>
        ${doc.originalName || "Download"}
      </a>
    `).join("");

    const submissions = (data.submissions || []).map((submission) => `
      <div class="rounded-lg border border-slate-200 p-3">
        <p class="text-sm font-semibold">${submission.title || "Submission"}</p>
        <p class="mb-2 text-xs text-slate-500">${submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : ""}</p>
        <p class="mb-2 text-sm text-slate-600 whitespace-pre-wrap">${submission.description || ""}</p>
        <div class="flex flex-wrap gap-2">
          ${((submission.documents || []).map((doc) => `
            <a href="${toRedirectUrl(doc.downloadUrl || doc.url)}" target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">
              <span class="material-symbols-outlined !text-[16px]">download</span>
              ${doc.originalName || "Download"}
            </a>
          `).join("")) || '<span class="text-xs text-slate-500">No files</span>'}
        </div>
      </div>
    `).join("");

    const resources = (data.resources || []).map((resource) => `
      <a href="${toRedirectUrl(resource.url)}" target="_blank" rel="noreferrer" class="block rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
        <p class="text-sm font-semibold">${resource.title}</p>
        <p class="text-xs text-slate-500">${resource.category || "general"}</p>
        <p class="mt-1 break-all text-xs text-blue-600">${normalizeUrl(resource.url)}</p>
      </a>
    `).join("");

    const messages = (data.messages || []).map((item) => `
      <div class="rounded-lg border ${item.senderRole === "student" ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-blue-50"} p-3">
        <p class="text-xs font-semibold capitalize">${item.senderRole}</p>
        <p class="text-sm whitespace-pre-wrap">${item.text}</p>
        <p class="mt-1 text-[11px] text-slate-500">${item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</p>
      </div>
    `).join("");

    content.innerHTML = `
      <div class="space-y-4">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="rounded-lg bg-slate-50 p-3">
            <p class="text-xs text-slate-500">Student Email</p>
            <p class="text-sm font-semibold">${project?.students?.email || data.student?.email || "No email"}</p>
          </div>
          <div class="rounded-lg bg-slate-50 p-3">
            <p class="text-xs text-slate-500">Domain</p>
            <p class="text-sm font-semibold">${project?.Domain || data.project?.Domain || "-"}</p>
          </div>
          <div class="rounded-lg bg-slate-50 p-3">
            <p class="text-xs text-slate-500">Supervisor</p>
            <p class="text-sm font-semibold">${project?.supervisor || data.project?.supervisor || "-"}</p>
          </div>
          <div class="rounded-lg bg-slate-50 p-3">
            <p class="text-xs text-slate-500">Submitted On</p>
            <p class="text-sm font-semibold">${project?.createdAt ? new Date(project.createdAt).toLocaleString() : "-"}</p>
          </div>
        </div>

        <div>
          <h3 class="mb-2 text-sm font-bold">Proposal Description</h3>
          <p class="whitespace-pre-wrap text-sm text-slate-700">${project?.description || "No description provided."}</p>
        </div>

        <div>
          <h3 class="mb-2 text-sm font-bold">Proposal Files</h3>
          <div class="flex flex-wrap gap-2">${proposalFiles || '<p class="text-sm text-slate-500">No file uploaded.</p>'}</div>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="rounded-lg bg-slate-50 p-3">
            <p class="mb-2 text-xs text-slate-500">Pending Tasks</p>
            ${(data.pendingTasks || []).length ? (data.pendingTasks || []).map((task) => `<div class="mb-2 rounded-lg border border-slate-200 bg-white p-2"><p class="text-sm font-semibold">${task.title}</p><p class="text-xs text-slate-500 whitespace-pre-wrap">${task.description || "No description provided."}</p></div>`).join("") : '<p class="text-sm text-slate-500">No pending task.</p>'}
          </div>
          <div class="rounded-lg bg-slate-50 p-3">
            <p class="mb-2 text-xs text-slate-500">Completed Tasks</p>
            ${(data.completedTasks || []).length ? (data.completedTasks || []).map((task) => `<div class="mb-2 rounded-lg border border-slate-200 bg-white p-2"><p class="text-sm font-semibold">${task.title}</p><p class="text-xs text-slate-500 whitespace-pre-wrap">${task.description || "No description provided."}</p></div>`).join("") : '<p class="text-sm text-slate-500">No completed task.</p>'}
          </div>
        </div>

        <div>
          <h3 class="mb-2 text-sm font-bold">Submitted Work</h3>
          <div class="space-y-2">${submissions || '<p class="text-sm text-slate-500">No submission yet.</p>'}</div>
        </div>

        <div>
          <h3 class="mb-2 text-sm font-bold">Resources</h3>
          <div class="space-y-2">${resources || '<p class="text-sm text-slate-500">No resources added.</p>'}</div>
        </div>

        <div>
          <h3 class="mb-2 text-sm font-bold">Messages</h3>
          <div class="space-y-2">${messages || '<p class="text-sm text-slate-500">No messages.</p>'}</div>
        </div>
      </div>
    `;
  }

  const closeWorkspace = event.target.closest("[data-close-workspace]");
  if (closeWorkspace) {
    const panel = document.querySelector("#teacher-workspace-panel");
    if (panel) {
      panel.classList.add("hidden");
      panel.classList.remove("flex");
    }
  }
});

document.addEventListener("submit", async (event) => {
  const editForm = event.target.closest("#edit-user-form");
  if (editForm) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(editForm).entries());
    const result = await sendJson(`/admin/users/${payload.id}/edit`, payload);
    reloadOnSuccess(result);
    return;
  }

  const taskForm = event.target.closest("#student-task-form");
  if (taskForm) {
    event.preventDefault();
    const result = await sendJson("/student/task", Object.fromEntries(new FormData(taskForm).entries()));
    reloadOnSuccess(result);
    return;
  }

  const resourceForm = event.target.closest("#student-resource-form");
  if (resourceForm) {
    event.preventDefault();
    const result = await sendJson("/student/resource", Object.fromEntries(new FormData(resourceForm).entries()));
    reloadOnSuccess(result);
    return;
  }

  const messageForm = event.target.closest("#student-message-form");
  if (messageForm) {
    event.preventDefault();
    const result = await sendJson("/student/message", Object.fromEntries(new FormData(messageForm).entries()));
    reloadOnSuccess(result);
    return;
  }

  const teacherMessageForm = event.target.closest("#teacher-message-form");
  if (teacherMessageForm) {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(teacherMessageForm).entries());
    const result = await sendJson(`/teacher/message/${formData.studentId}`, { message: formData.message });
    reloadOnSuccess(result);
    return;
  }

  const proposalForm = event.target.closest("#student-proposal-form");
  if (proposalForm) {
    event.preventDefault();
    const response = await fetch("/student/proposal", {
      method: "POST",
      body: new FormData(proposalForm)
    });
    reloadOnSuccess(await response.json());
    return;
  }

  const workForm = event.target.closest("#student-work-form");
  if (workForm) {
    event.preventDefault();
    const response = await fetch("/student/work", {
      method: "POST",
      body: new FormData(workForm)
    });
    reloadOnSuccess(await response.json());
  }
});

document.addEventListener("input", (event) => {
  const search = document.querySelector("#teacher-project-search");
  const filter = document.querySelector("#teacher-project-student-filter");

  if (event.target === search || event.target === filter) {
    const query = (search?.value || "").trim().toLowerCase();
    const studentId = filter?.value || "all";

    document.querySelectorAll("[data-project-row]").forEach((row) => {
      const rowQuery = row.dataset.search || "";
      const rowStudentId = row.dataset.studentId || "";
      const matchesQuery = !query || rowQuery.includes(query);
      const matchesStudent = studentId === "all" || studentId === rowStudentId;
      row.style.display = matchesQuery && matchesStudent ? "" : "none";
    });
  }

  const reportSearch = document.querySelector("#teacher-reports-search");
  const reportProposal = document.querySelector("#teacher-reports-proposal");
  const reportCommittee = document.querySelector("#teacher-reports-committee");

  if (event.target === reportSearch || event.target === reportProposal || event.target === reportCommittee) {
    const query = (reportSearch?.value || "").trim().toLowerCase();
    const proposal = reportProposal?.value || "all";
    const committee = reportCommittee?.value || "all";
    let visible = 0;

    document.querySelectorAll("[data-report-row]").forEach((row) => {
      const rowQuery = row.dataset.search || "";
      const rowProposal = row.dataset.proposal || "";
      const rowCommittee = row.dataset.committee || "";
      const matchesQuery = !query || rowQuery.includes(query);
      const matchesProposal = proposal === "all" || proposal === rowProposal;
      const matchesCommittee = committee === "all" || committee === rowCommittee;
      const show = matchesQuery && matchesProposal && matchesCommittee;
      row.style.display = show ? "" : "none";
      if (show) visible += 1;
    });

    const count = document.querySelector("#teacher-reports-count");
    if (count) count.textContent = String(visible);
  }

  const teacherStudentsSearch = document.querySelector("#teacher-students-search");
  if (event.target === teacherStudentsSearch) {
    const query = (teacherStudentsSearch.value || "").trim().toLowerCase();
    document.querySelectorAll("[data-teacher-student-row]").forEach((row) => {
      const haystack = row.dataset.search || "";
      row.style.display = !query || haystack.includes(query) ? "" : "none";
    });
  }
});

document.addEventListener("click", (event) => {
  const exportButton = event.target.closest("#export-teacher-report");
  if (!exportButton) return;

  const rows = Array.isArray(window.__teacherReportRows) ? window.__teacherReportRows : [];
  const visibleRows = rows.filter((row) => {
    const query = (document.querySelector("#teacher-reports-search")?.value || "").trim().toLowerCase();
    const proposal = document.querySelector("#teacher-reports-proposal")?.value || "all";
    const committee = document.querySelector("#teacher-reports-committee")?.value || "all";
    const haystack = `${row.name || ""} ${row.email || ""} ${row.projectTitle || ""} ${row.department || ""}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesProposal = proposal === "all" || proposal === row.proposalStatus;
    const matchesCommittee = committee === "all" || committee === row.committeeStatus;
    return matchesQuery && matchesProposal && matchesCommittee;
  });

  const headers = [
    "Student",
    "Email",
    "Department",
    "Project",
    "Proposal Status",
    "Committee Status",
    "Pending Tasks",
    "Completed Tasks",
    "Completion Rate",
    "Submissions",
    "Last Submission",
    "Last Student Message"
  ];

  const csvContent = [headers, ...visibleRows.map((row) => ([
    row.name || "",
    row.email || "",
    row.department || "",
    row.projectTitle || "",
    row.proposalStatus || "",
    row.committeeStatus || "",
    row.pendingTaskCount || 0,
    row.completedTaskCount || 0,
    `${row.completionRate || 0}%`,
    row.submissionCount || 0,
    row.lastSubmissionAt || "",
    row.lastStudentMessageAt || ""
  ]))]
    .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "teacher_reports.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

document.addEventListener("DOMContentLoaded", () => {
  syncTeacherProjectBadges();
});
