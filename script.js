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

// render chart 1: multi-year line chart (2010 to 2024)
function renderLineChart(selectedCountry, selectedIndicator) {
  const indicatorRows = allRecords.filter(function (row) {
    return row.seriesCode === selectedIndicator;
  });

  const indicatorLabel = indicatorRows.length > 0 ? indicatorRows[0].seriesName : "";
  document.getElementById("chart-line-heading").textContent =
    indicatorLabel + " Trajectory (2010 \u2013 2024)";

  const datasets = indicatorRows.map(function (row, idx) {
    const isHighlighted = selectedCountry === "ALL" || row.country === selectedCountry;
    const baseColor = countryColors[idx % countryColors.length];

    return {
      label: row.country,
      data: yearsList.map(function (yr) { return row.values[yr]; }),
      borderColor: isHighlighted ? baseColor : "rgba(148, 163, 184, 0.18)",
      backgroundColor: baseColor,
      borderWidth: row.country === selectedCountry ? 3.5 : 2,
      pointRadius: isHighlighted ? 3 : 0,
      tension: 0.25
    };
  });

  if (trendChartInstance) {
    trendChartInstance.destroy();
  }

  const ctx = document.getElementById("lineChart").getContext("2d");
  trendChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: yearsList,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#cbd5e1", boxWidth: 12, font: { size: 11 } }
        }
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(51, 65, 85, 0.4)" }
        },
        y: {
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(51, 65, 85, 0.4)" }
        }
      }
    }
  });
}

// render chart 2: horizontal bar chart ranking all 10 countries for selected year
function renderHorizontalBarChart(selectedCountry, selectedYear, selectedIndicator) {
  const indicatorRows = allRecords.filter(function (row) {
    return row.seriesCode === selectedIndicator;
  });

  const indicatorLabel = indicatorRows.length > 0 ? indicatorRows[0].seriesName : "";
  document.getElementById("chart-bar-heading").textContent =
    "Country Ranking: " + indicatorLabel + " (" + selectedYear + ")";

  // sort countries from highest to lowest value in the chosen year
  const ranked = indicatorRows
    .map(function (row) {
      return {
        country: row.country,
        value: row.values[selectedYear]
      };
    })
    .sort(function (a, b) {
      return b.value - a.value;
    });

  const labels = ranked.map(function (item) { return item.country; });
  const values = ranked.map(function (item) { return item.value; });
  const barColors = ranked.map(function (item) {
    if (selectedCountry === "ALL" || item.country === selectedCountry) {
      return "#38bdf8";
    }
    return "rgba(56, 189, 248, 0.25)";
  });

  if (rankBarChartInstance) {
    rankBarChartInstance.destroy();
  }

  const ctx = document.getElementById("barChart").getContext("2d");
  rankBarChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: selectedYear,
          data: values,
          backgroundColor: barColors,
          borderRadius: 4
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(51, 65, 85, 0.4)" }
        },
        y: {
          ticks: { color: "#e2e8f0", font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  });
}

// render chart 3: radar chart comparing normalized multi-indicator profile (0 to 100 scale)
function renderRadarChart(selectedCountry, selectedYear) {
  const targetCountry = selectedCountry === "ALL" ? "South Africa" : selectedCountry;
  document.getElementById("chart-radar-heading").textContent =
    targetCountry + " vs. BRICS Average (" + selectedYear + ", Normalized)";

  const codes = ["NY.GDP.PCAP.CD", "NY.GDP.MKTP.KD.ZG", "SL.UEM.TOTL.ZS", "EG.ELC.ACCS.ZS"];
  const axisLabels = ["GDP per Capita", "GDP Growth", "Unemployment", "Electricity Access"];

  // normalize each indicator relative to the maximum value in that year so all 4 fit on 0-100
  const targetScores = [];
  const blocAvgScores = [];

  codes.forEach(function (code) {
    const rows = allRecords.filter(function (r) { return r.seriesCode === code; });
    const vals = rows.map(function (r) { return r.values[selectedYear]; }).filter(function (v) { return v !== null; });

    const maxVal = Math.max.apply(null, vals);
    const minVal = Math.min.apply(null, vals);
    const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;

    const avgVal = vals.reduce(function (sum, v) { return sum + v; }, 0) / vals.length;
    const countryRow = rows.find(function (r) { return r.country === targetCountry; });
    const countryVal = countryRow ? countryRow.values[selectedYear] : avgVal;

    targetScores.push(Number((((countryVal - minVal) / range) * 100).toFixed(1)));
    blocAvgScores.push(Number((((avgVal - minVal) / range) * 100).toFixed(1)));
  });

  if (radarChartInstance) {
    radarChartInstance.destroy();
  }

  const ctx = document.getElementById("radarChart").getContext("2d");
  radarChartInstance = new Chart(ctx, {
    type: "radar",
    data: {
      labels: axisLabels,
      datasets: [
        {
          label: targetCountry,
          data: targetScores,
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.25)",
          pointBackgroundColor: "#38bdf8"
        },
        {
          label: "BRICS Mean",
          data: blocAvgScores,
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.18)",
          pointBackgroundColor: "#f59e0b"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#cbd5e1", font: { size: 11 } }
        }
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false },
          grid: { color: "rgba(148, 163, 184, 0.25)" },
          angleLines: { color: "rgba(148, 163, 184, 0.25)" },
          pointLabels: { color: "#e2e8f0", font: { size: 11 } }
        }
      }
    }
  });
}

// master function triggered whenever a filter changes
function refreshDashboard() {
  const selectedCountry = document.getElementById("select-country").value;
  const selectedYear = document.getElementById("select-year").value;
  const selectedIndicator = document.getElementById("select-indicator").value;

  updateSummaryIndicators(selectedCountry, selectedYear, selectedIndicator);
  renderLineChart(selectedCountry, selectedIndicator);
  renderHorizontalBarChart(selectedCountry, selectedYear, selectedIndicator);
  renderRadarChart(selectedCountry, selectedYear);
}

// start loading the csv when the page opens
loadDataset();