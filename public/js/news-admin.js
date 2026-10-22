(function () {
    "use strict";

    var loginPanel = document.getElementById("login-panel");
    var loginSecret = document.getElementById("login-secret");
    var loginBtn = document.getElementById("login-btn");
    var loginStatus = document.getElementById("login-status");
    var adminPanel = document.getElementById("admin-panel");

    var postListEl = document.getElementById("post-list");
    var newPostBtn = document.getElementById("new-post");
    var savePostBtn = document.getElementById("save-post");
    var deletePostBtn = document.getElementById("delete-post");
    var editorStatus = document.getElementById("editor-status");

    var titleInput = document.getElementById("post-title");
    var slugInput = document.getElementById("post-slug");
    var coverInput = document.getElementById("post-cover");
    var publishedInput = document.getElementById("post-published");
    var summaryInput = document.getElementById("post-summary");
    var contentInput = document.getElementById("post-content");
    var previewEl = document.getElementById("post-preview");
    var layoutEl = document.getElementById("editor-layout");

    var modeSplit = document.getElementById("mode-split");
    var modeCode = document.getElementById("mode-code");
    var modePreview = document.getElementById("mode-preview");

    var authenticated = "";
    var posts = [];
    var currentId = null;
    var previewTimer = null;

    function setLoginStatus(message) {
        loginStatus.textContent = message || "";
    }

    function setEditorStatus(message) {
        editorStatus.textContent = message || "";
    }

    function showAdmin() {
        loginPanel.classList.add("hidden");
        adminPanel.classList.remove("hidden");
    }

    function formatDate(value) {
        if (!value) return "Chưa xuất bản";
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Chưa xuất bản";
        return date.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    }

    function toInputDate(value) {
        if (!value) return "";
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        var pad = function (num) {
            return String(num).padStart(2, "0");
        };
        return (
            date.getFullYear() +
            "-" +
            pad(date.getMonth() + 1) +
            "-" +
            pad(date.getDate()) +
            "T" +
            pad(date.getHours()) +
            ":" +
            pad(date.getMinutes())
        );
    }

    async function renderPreview() {
        if (!previewEl) return;
        if (!authenticated) return;
        var value = contentInput.value;
        try {
            var response = await fetch('/api/news', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'preview', contentHtml: value }) });
            var data = await response.json();
            if (response.ok && value === contentInput.value) previewEl.srcdoc = data.contentHtml || '';
        } catch { previewEl.srcdoc = ''; }
    }

    function schedulePreview() {
        if (previewTimer) {
            clearTimeout(previewTimer);
        }
        previewTimer = setTimeout(renderPreview, 300);
    }

    function setMode(mode) {
        layoutEl.classList.remove("single");
        var panes = layoutEl.querySelectorAll(".editor-pane");
        panes.forEach(function (pane) {
            pane.classList.remove("hidden");
        });

        if (mode === "code") {
            layoutEl.classList.add("single");
            panes[1].classList.add("hidden");
        } else if (mode === "preview") {
            layoutEl.classList.add("single");
            panes[0].classList.add("hidden");
        }
    }

    function clearForm() {
        currentId = null;
        titleInput.value = "";
        slugInput.value = "";
        coverInput.value = "";
        publishedInput.value = "";
        summaryInput.value = "";
        contentInput.value = "";
        renderPreview();
        highlightActive(null);
    }

    function highlightActive(id) {
        var items = postListEl.querySelectorAll(".post-item");
        items.forEach(function (item) {
            item.classList.toggle("active", Number(item.dataset.id) === id);
        });
    }

    function renderList() {
        postListEl.replaceChildren();
        posts.forEach(function (post) {
            var item = document.createElement("div");
            item.className = "post-item";
            item.dataset.id = post.id;
            var heading = document.createElement('h6');
            heading.textContent = post.title || 'Bài viết';
            var date = document.createElement('span');
            date.textContent = formatDate(post.publishedAt);
            item.append(heading, date);
            item.addEventListener("click", function () {
                loadPost(post.id);
            });
            postListEl.appendChild(item);
        });
    }

    async function fetchList() {
        setEditorStatus("Đang tải danh sách...");
        try {
            var response = await fetch("/api/news?limit=50&offset=0", {});
            var data = await response.json();
            posts = Array.isArray(data.posts) ? data.posts : [];
            renderList();
            setEditorStatus("Đã tải " + posts.length + " bài.");
        } catch (err) {
            setEditorStatus("Không thể tải danh sách bài viết.");
        }
    }

    async function loadPost(id) {
        setEditorStatus("Đang tải bài viết...");
        try {
            var response = await fetch("/api/news-post?id=" + encodeURIComponent(id), {});
            var data = await response.json();
            if (!data.post) {
                setEditorStatus("Không tìm thấy bài viết.");
                return;
            }
            var post = data.post;
            currentId = post.id;
            titleInput.value = post.title || "";
            slugInput.value = post.slug || "";
            coverInput.value = post.coverUrl || "";
            publishedInput.value = toInputDate(post.publishedAt);
            summaryInput.value = post.summary || "";
            contentInput.value = post.contentHtml || "";
            renderPreview();
            highlightActive(post.id);
            setEditorStatus("Đã tải bài viết.");
        } catch (err) {
            setEditorStatus("Không thể tải bài viết.");
        }
    }

    function getPayload() {
        return {
            id: currentId,
            title: titleInput.value.trim(),
            summary: summaryInput.value.trim(),
            coverUrl: coverInput.value.trim(),
            slug: slugInput.value.trim(),
            publishedAt: publishedInput.value ? new Date(publishedInput.value).toISOString() : null,
            contentHtml: contentInput.value
        };
    }

    async function savePost() {
        if (!authenticated) {
            setEditorStatus("Bạn chưa đăng nhập.");
            return;
        }
        var payload = getPayload();
        if (!payload.title || !payload.contentHtml.trim()) {
            setEditorStatus("Tiêu đề và nội dung là bắt buộc.");
            return;
        }
        setEditorStatus("Đang lưu...");
        try {
            var method = currentId ? "PUT" : "POST";
            var response = await fetch("/api/news", {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            var data = await response.json();
            if (!response.ok) {
                setEditorStatus(data.error || "Không thể lưu bài viết.");
                return;
            }
            currentId = data.post.id;
            await fetchList();
            highlightActive(currentId);
            setEditorStatus("Đã lưu.");
        } catch (err) {
            setEditorStatus("Không thể lưu bài viết.");
        }
    }

    async function deletePost() {
        if (!currentId) {
            setEditorStatus("Chọn bài viết cần xóa.");
            return;
        }
        if (!authenticated) {
            setEditorStatus("Bạn chưa đăng nhập.");
            return;
        }
        var confirmDelete = window.confirm("Xóa bài viết này?");
        if (!confirmDelete) return;

        setEditorStatus("Đang xóa...");
        try {
            var response = await fetch("/api/news", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({  id: currentId })
            });
            var data = await response.json();
            if (!response.ok) {
                setEditorStatus(data.error || "Không thể xóa bài viết.");
                return;
            }
            clearForm();
            await fetchList();
            setEditorStatus("Đã xóa bài viết.");
        } catch (err) {
            setEditorStatus("Không thể xóa bài viết.");
        }
    }

    async function login() {
        var secret = loginSecret.value;
        loginBtn.disabled = true;
        try {
            var response = await fetch('/api/admin-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: document.getElementById('admin-username').value, password: secret }) });
            if (!response.ok) throw new Error();
            authenticated = true;
            loginSecret.value = '';
            setLoginStatus('');
            showAdmin();
            fetchList();
        } catch { setLoginStatus('Không thể xác thực.'); }
        finally { loginBtn.disabled = false; }
    }
    function restoreSession() {
        sessionStorage.removeItem('newsAdminSecret');
    }

    document.getElementById('admin-logout').addEventListener('click', async () => {
        const response = await fetch('/api/admin-auth', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'logout'})});
        if (response.ok) location.reload();
    });
    loginBtn.addEventListener("click", login);
    loginSecret.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            login();
        }
    });

    newPostBtn.addEventListener("click", function () {
        clearForm();
        setEditorStatus("Soạn bài mới.");
    });
    savePostBtn.addEventListener("click", savePost);
    deletePostBtn.addEventListener("click", deletePost);

    contentInput.addEventListener("input", schedulePreview);
    modeSplit.addEventListener("click", function () {
        setMode("split");
    });
    modeCode.addEventListener("click", function () {
        setMode("code");
    });
    modePreview.addEventListener("click", function () {
        setMode("preview");
    });

    renderPreview();
    setMode("split");
    restoreSession();
})();
