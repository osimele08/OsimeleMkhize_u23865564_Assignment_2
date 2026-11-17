// global state variables
let allRecords = [];
let yearsList = [];
let countriesList = [];

let trendChartInstance = null;
let rankBarChartInstance = null;
let radarChartInstance = null;

// color palette for the 10 brics countries
const countryColors = [
  "#38bdf8", "#f59e0b", "#10b981", "#f43f5e", "#a855f7",
  "#ec4899", "#eab308", "#14b8a6", "#6366f1", "#fb923c"
];

// switch between project overview and data explorer views
function showPage(pageName) {
  const homeView = document.getElementById("page-home");
  const dashView = document.getElementById("page-dashboard");
  const navHome = document.getElementById("nav-home");
  const navDash = document.getElementById("nav-dashboard");

  if (pageName === "home") {
    homeView.classList.remove("hidden");
    homeView.classList.add("active");
    dashView.classList.remove("active");
    dashView.classList.add("hidden");
    navHome.classList.add("active");
    navDash.classList.remove("active");
  } else {
    dashView.classList.remove("hidden");
    dashView.classList.add("active");
    homeView.classList.remove("active");
    homeView.classList.add("hidden");
    navDash.classList.add("active");
    navHome.classList.remove("active");
  }
}

// attach click listeners for navigation buttons
document.getElementById("nav-home").addEventListener("click", function () {
  showPage("home");
});

document.getElementById("nav-dashboard").addEventListener("click", function () {
  showPage("dashboard");
});

document.getElementById("open-dashboard-btn").addEventListener("click", function () {
  showPage("dashboard");
});

// populate dropdowns once data is loaded
function setupFilters() {
  const countrySelect = document.getElementById("select-country");
  const yearSelect = document.getElementById("select-year");
  const indicatorSelect = document.getElementById("select-indicator");
  const resetBtn = document.getElementById("reset-filters-btn");

  // add each brics country to the dropdown
  countriesList.forEach(function (country) {
    const option = document.createElement("option");
    option.value = country;
    option.textContent = country;
    countrySelect.appendChild(option);
  });

  // add years from newest (2024) to oldest (2010)
  for (let i = yearsList.length - 1; i >= 0; i--) {
    const option = document.createElement("option");
    option.value = yearsList[i];
    option.textContent = yearsList[i];
    yearSelect.appendChild(option);
  }

  // listen for filter changes
  countrySelect.addEventListener("change", refreshDashboard);
  yearSelect.addEventListener("change", refreshDashboard);
  indicatorSelect.addEventListener("change", refreshDashboard);

  // reset filters back to defaults
  resetBtn.addEventListener("click", function () {
    countrySelect.value = "ALL";
    yearSelect.value = yearsList[yearsList.length - 1];
    indicatorSelect.value = "NY.GDP.PCAP.CD";
    refreshDashboard();
  });
}