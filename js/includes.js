(function () {
    "use strict";

    function setActiveNav(navRoot) {
        var current = window.location.pathname.split("/").pop();
        if (!current) {
            current = "index.html";
        }

        var links = navRoot.querySelectorAll("a.nav-link, a.dropdown-item");
        links.forEach(function (link) {
            if (link.getAttribute("href") === current) {
                link.classList.add("active");
                if (link.classList.contains("dropdown-item")) {
                    var dropdown = link.closest(".dropdown");
                    if (dropdown) {
                        var toggle = dropdown.querySelector(".dropdown-toggle");
                        if (toggle) {
                            toggle.classList.add("active");
                        }
                    }
                }
            }
        });
    }

    function loadNavbar() {
        var target = document.getElementById("navbar");
        if (!target) {
            return;
        }

        fetch("partials/navbar.html")
            .then(function (response) {
                return response.text();
            })
            .then(function (html) {
                target.innerHTML = html;
                setActiveNav(target);
                if (window.initNavbarInteractions) {
                    window.initNavbarInteractions();
                }
            })
            .catch(function (error) {
                console.error("Failed to load navbar:", error);
            });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", loadNavbar);
    } else {
        loadNavbar();
    }
})();
