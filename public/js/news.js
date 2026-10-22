(function () {
    "use strict";

    var listEl = document.getElementById("news-list");
    var loadMoreBtn = document.getElementById("news-load-more");
    var statusEl = document.getElementById("news-status");
    var countEl = document.getElementById("news-count");
    var detailEl = document.getElementById("news-detail");
    var detailTitleEl = document.getElementById("news-detail-title");
    var detailMetaEl = document.getElementById("news-detail-meta");
    var detailContentEl = document.getElementById("news-detail-content");
    var detailBackEl = document.getElementById("news-detail-back");

    if (!listEl || !loadMoreBtn) {
        return;
    }

    var offset = 0;
    var limit = 5;
    var loading = false;
    var done = false;
    var totalLoaded = 0;

    function formatDate(value) {
        if (!value) return "Cập nhật mới nhất";
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Cập nhật mới nhất";
        return date.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    }

    function setStatus(message) {
        if (statusEl) {
            statusEl.textContent = message || "";
        }
    }

    function setCount() {
        if (countEl) {
            countEl.textContent = totalLoaded ? "Đã tải " + totalLoaded + " bài" : "Chưa có bài";
        }
    }

    function updateUrl(id) {
        var url = new URL(window.location.href);
        if (id) {
            url.searchParams.set("id", id);
        } else {
            url.searchParams.delete("id");
        }
        window.history.pushState({ id: id || null }, "", url.toString());
    }

    function createCard(post) {
        var card = document.createElement("article");
        card.className = "news-card";

        var media = document.createElement("div");
        media.className = "news-card__media";
        if (post.coverUrl) {
            media.classList.add("has-image");
            media.style.backgroundImage = "url('" + post.coverUrl + "')";
            media.textContent = "";
        } else {
            media.textContent = "HL News";
        }

        var body = document.createElement("div");

        var meta = document.createElement("div");
        meta.className = "news-card__meta";
        meta.textContent = formatDate(post.publishedAt);

        var title = document.createElement("a");
        title.className = "news-card__title";
        title.href = "?id=" + encodeURIComponent(post.id);
        title.textContent = post.title || "Bài viết mới";
        title.addEventListener("click", function (event) {
            event.preventDefault();
            loadPost(post.id);
        });

        var summary = document.createElement("p");
        summary.className = "news-card__summary";
        summary.textContent = post.summary || "Bấm để xem chi tiết bài viết.";

        body.appendChild(meta);
        body.appendChild(title);
        body.appendChild(summary);

        card.appendChild(media);
        card.appendChild(body);
        return card;
    }

    function showDetail(post) {
        if (!detailEl || !detailTitleEl || !detailContentEl) return;
        detailTitleEl.textContent = post.title || "Bài viết";
        detailMetaEl.textContent = formatDate(post.publishedAt);
        detailContentEl.innerHTML = post.contentHtml || "";
        detailEl.classList.remove("is-hidden");
        detailEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function hideDetail() {
        if (!detailEl) return;
        detailEl.classList.add("is-hidden");
    }

    async function fetchList() {
        if (loading || done) return;
        loading = true;
        loadMoreBtn.disabled = true;
        setStatus("Đang tải...");

        try {
            var response = await fetch("/api/news?limit=" + limit + "&offset=" + offset);
            var payload = await response.json();
            var posts = Array.isArray(payload.posts) ? payload.posts : [];

            posts.forEach(function (post) {
                listEl.appendChild(createCard(post));
            });

            totalLoaded += posts.length;
            setCount();
            offset = payload.nextOffset || offset + posts.length;
            done = !payload.hasMore;

            if (!posts.length && totalLoaded === 0) {
                setStatus("Chưa có bài viết nào.");
            } else {
                setStatus(done ? "Đã tải tất cả bài viết." : "");
            }

            loadMoreBtn.classList.toggle("d-none", done);
        } catch (err) {
            setStatus("Không thể tải bài viết. Vui lòng thử lại.");
        } finally {
            loading = false;
            loadMoreBtn.disabled = false;
        }
    }

    async function loadPost(id) {
        if (!id) return;
        setStatus("Đang tải nội dung...");
        try {
            var response = await fetch("/api/news-post?id=" + encodeURIComponent(id));
            if (!response.ok) {
                setStatus("Không tìm thấy bài viết.");
                return;
            }
            var payload = await response.json();
            if (!payload.post) {
                setStatus("Không tìm thấy bài viết.");
                return;
            }
            updateUrl(payload.post.id);
            showDetail(payload.post);
            setStatus("");
        } catch (err) {
            setStatus("Không thể tải nội dung bài viết.");
        }
    }

    function handlePopState() {
        var params = new URLSearchParams(window.location.search);
        var id = params.get("id");
        if (id) {
            loadPost(id);
        } else {
            hideDetail();
        }
    }

    loadMoreBtn.addEventListener("click", fetchList);
    if (detailBackEl) {
        detailBackEl.addEventListener("click", function () {
            hideDetail();
            updateUrl(null);
        });
    }
    window.addEventListener("popstate", handlePopState);

    fetchList();
    handlePopState();
})();
