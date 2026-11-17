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

// split a csv line safely while respecting commas inside double quotes
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// load the dataset from the csv file
async function loadDataset() {
  try {
    const response = await fetch("wdi_brics_data.csv");
    const csvText = await response.text();
    const lines = csvText.split(/\r?\n/).filter(function (row) {
      return row.trim() !== "";
    });

    // read header row and extract clean year strings (2010 to 2024)
    const headers = parseCSVLine(lines[0]);
    const yearColumns = [];

    for (let i = 4; i < headers.length; i++) {
      const yearText = headers[i].split(" ")[0];
      yearsList.push(yearText);
      yearColumns.push({ index: i, year: yearText });
    }

    // parse each data row and skip world bank footer notes at the bottom
    const countrySet = new Set();

    for (let r = 1; r < lines.length; r++) {
      const cols = parseCSVLine(lines[r]);
      const countryName = cols[0];
      const countryCode = cols[1];
      const seriesName = cols[2];
      const seriesCode = cols[3];

      if (!seriesCode || seriesCode === "") {
        continue;
      }

      const valuesByYear = {};
      yearColumns.forEach(function (colInfo) {
        const rawVal = cols[colInfo.index];
        valuesByYear[colInfo.year] = rawVal === ".." || rawVal === "" ? null : parseFloat(rawVal);
      });

      countrySet.add(countryName);
      allRecords.push({
        country: countryName,
        code: countryCode,
        seriesName: seriesName,
        seriesCode: seriesCode,
        values: valuesByYear
      });
    }

    countriesList = Array.from(countrySet);
    setupFilters();
    refreshDashboard();
  } catch (error) {
    console.error("Failed to load CSV dataset:", error);
  }
}

// format numbers cleanly depending on the selected indicator
function formatMetricValue(value, indicatorCode) {
  if (value === null || isNaN(value)) {
    return "--";
  }
  if (indicatorCode === "NY.GDP.PCAP.CD") {
    return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return value.toFixed(2) + "%";
}

// calculate median from an array of numbers
function calculateMedian(numbers) {
  if (numbers.length === 0) {
    return null;
  }
  const sorted = numbers.slice().sort(function (a, b) {
    return a - b;
  });
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

// compute summary statistics and update the two kpi cards
function updateSummaryIndicators(selectedCountry, selectedYear, selectedIndicator) {
  const matchingRows = allRecords.filter(function (row) {
    const matchesIndicator = row.seriesCode === selectedIndicator;
    const matchesCountry = selectedCountry === "ALL" || row.country === selectedCountry;
    return matchesIndicator && matchesCountry;
  });

  // collect values for the selected year
  let highestVal = -Infinity;
  let highestCountry = "";
  const yearValues = [];

  matchingRows.forEach(function (row) {
    const val = row.values[selectedYear];
    if (val !== null && !isNaN(val)) {
      yearValues.push(val);
      if (val > highestVal) {
        highestVal = val;
        highestCountry = row.country;
      }
    }
  });

  // stat 1: peak value in selection (or peak year if single country selected)
  const statOneTitle = document.getElementById("stat-one-title");
  const statOneValue = document.getElementById("stat-one-value");
  const statOneDesc = document.getElementById("stat-one-desc");

  if (selectedCountry === "ALL") {
    statOneTitle.textContent = "HIGHEST VALUE IN BLOC (" + selectedYear + ")";
    statOneValue.textContent = formatMetricValue(highestVal, selectedIndicator);
    statOneDesc.textContent = "Leading economy: " + highestCountry;
  } else {
    // find the country's highest year across 2010-2024
    const singleRow = matchingRows[0];
    let peakYear = selectedYear;
    let peakYearVal = -Infinity;

    yearsList.forEach(function (yr) {
      const v = singleRow.values[yr];
      if (v !== null && v > peakYearVal) {
        peakYearVal = v;
        peakYear = yr;
      }
    });

    statOneTitle.textContent = selectedCountry.toUpperCase() + " PEAK (2010\u20132024)";
    statOneValue.textContent = formatMetricValue(peakYearVal, selectedIndicator);
    statOneDesc.textContent = "Highest recorded in " + peakYear;
  }

  // stat 2: median benchmark across active selection
  const statTwoTitle = document.getElementById("stat-two-title");
  const statTwoValue = document.getElementById("stat-two-value");
  const statTwoDesc = document.getElementById("stat-two-desc");

  if (selectedCountry === "ALL") {
    const medianVal = calculateMedian(yearValues);
    statTwoTitle.textContent = "BRICS MEDIAN BENCHMARK (" + selectedYear + ")";
    statTwoValue.textContent = formatMetricValue(medianVal, selectedIndicator);
    statTwoDesc.textContent = "Middle value across all 10 member states";
  } else {
    // compute 15-year median for the selected country
    const singleRow = matchingRows[0];
    const allYearsVals = yearsList
      .map(function (yr) { return singleRow.values[yr]; })
      .filter(function (v) { return v !== null; });

    const countryMedian = calculateMedian(allYearsVals);
    statTwoTitle.textContent = selectedCountry.toUpperCase() + " 15-YEAR MEDIAN";
    statTwoValue.textContent = formatMetricValue(countryMedian, selectedIndicator);
    statTwoDesc.textContent = "Median across 2010\u20132024 observations";
  }
}