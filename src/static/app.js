document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupContainer = document.getElementById("signup-container");
  const messageDiv = document.getElementById("message");

  // Auth UI elements
  const userIconBtn = document.getElementById("user-icon-btn");
  const authDropdown = document.getElementById("auth-dropdown");
  const authStatusText = document.getElementById("auth-status-text");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const cancelLoginBtn = document.getElementById("cancel-login");
  const loginMessage = document.getElementById("login-message");

  // Auth state
  let authToken = localStorage.getItem("teacherToken") || null;

  // --- Auth helpers ---

  function getAuthHeaders() {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }

  function updateAuthUI(authenticated) {
    if (authenticated) {
      authStatusText.textContent = "Logged in as teacher";
      loginBtn.classList.add("hidden");
      logoutBtn.classList.remove("hidden");
      signupContainer.classList.remove("hidden");
    } else {
      authStatusText.textContent = "Not logged in";
      loginBtn.classList.remove("hidden");
      logoutBtn.classList.add("hidden");
      signupContainer.classList.add("hidden");
    }
    // Re-render to show/hide delete buttons
    fetchActivities();
  }

  async function checkAuthStatus() {
    if (!authToken) {
      updateAuthUI(false);
      return;
    }
    try {
      const response = await fetch("/auth/status", {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.authenticated) {
        authToken = null;
        localStorage.removeItem("teacherToken");
      }
      updateAuthUI(data.authenticated);
    } catch {
      updateAuthUI(false);
    }
  }

  // --- User icon / dropdown toggle ---

  userIconBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    authDropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", () => {
    authDropdown.classList.add("hidden");
  });

  authDropdown.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  // --- Login modal ---

  loginBtn.addEventListener("click", () => {
    authDropdown.classList.add("hidden");
    loginModal.classList.remove("hidden");
    loginMessage.classList.add("hidden");
    loginForm.reset();
  });

  cancelLoginBtn.addEventListener("click", () => {
    loginModal.classList.add("hidden");
  });

  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.classList.add("hidden");
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (response.ok) {
        authToken = result.token;
        localStorage.setItem("teacherToken", authToken);
        loginModal.classList.add("hidden");
        updateAuthUI(true);
      } else {
        loginMessage.textContent = result.detail || "Login failed";
        loginMessage.className = "error";
        loginMessage.classList.remove("hidden");
      }
    } catch {
      loginMessage.textContent = "Failed to login. Please try again.";
      loginMessage.className = "error";
      loginMessage.classList.remove("hidden");
    }
  });

  // --- Logout ---

  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/logout", {
        method: "POST",
        headers: getAuthHeaders(),
      });
    } finally {
      authToken = null;
      localStorage.removeItem("teacherToken");
      authDropdown.classList.add("hidden");
      updateAuthUI(false);
    }
  });

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      // Preserve existing select options (only clear non-default)
      while (activitySelect.options.length > 1) {
        activitySelect.remove(1);
      }

      const isTeacher = authToken !== null;

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML — show delete buttons only for teachers
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        isTeacher
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  checkAuthStatus();
});
