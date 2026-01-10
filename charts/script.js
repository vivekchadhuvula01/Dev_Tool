let parsedRows = [];
let columnNames = [];
let chart = null;

const $ = (id) => document.getElementById(id);

function resetState() {
  parsedRows = [];
  columnNames = [];
  if (chart) {
    chart.destroy();
    chart = null;
  }
  $("chart").innerHTML =
    '<p class="chart-placeholder">Load a CSV/Excel file and configure columns to see the chart.</p>';
  $("xColumn").innerHTML = '<option value="">Load a file first</option>';
  $("xColumn").disabled = true;
  $("yColumns").className = "y-columns-placeholder";
  $("yColumns").textContent = "Load a file to choose columns";
  $("generateBtn").disabled = true;
  $("summary").textContent = "";
  $("fileInfo").textContent = "No file selected";
}

function init() {
  const dropzone = $("dropzone");
  const fileInput = $("fileInput");

  resetState();

  dropzone.addEventListener("click", () => fileInput.click());

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("hover");
  });
  dropzone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropzone.classList.remove("hover");
  });
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("hover");
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  $("generateBtn").addEventListener("click", generateChart);
  $("resetBtn").addEventListener("click", resetState);
}

function handleFile(file) {
  resetState();
  $("fileInfo").textContent = file.name;

  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "csv") {
    readCSV(file);
  } else if (ext === "xlsx" || ext === "xls") {
    readExcel(file);
  } else {
    alert("Unsupported file type");
  }
}

// CSV with Papa Parse
function readCSV(file) {
  Papa.parse(file, {
    header: $("firstRowHeader").checked,
    dynamicTyping: false,
    skipEmptyLines: true,
    complete: (results) => {
      parsedRows = results.data;
      if (!parsedRows.length) {
        alert("No rows found in CSV");
        return;
      }
      columnNames = results.meta.fields || Object.keys(parsedRows[0]);
      populateConfig();
      updateSummary(file);
    },
    error: (err) => {
      alert("Error parsing CSV: " + err.message);
    },
  });
}

// Excel with SheetJS
function readExcel(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheet = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheet];
    const json = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
    });
    if (!json.length) {
      alert("No rows found in sheet");
      return;
    }

    const hasHeader = $("firstRowHeader").checked;
    const rows = [];
    if (hasHeader) {
      columnNames = json[0].map((h, i) => (h || `Col ${i + 1}`));
      for (let r = 1; r < json.length; r++) {
        const rowArr = json[r];
        const obj = {};
        columnNames.forEach((name, idx) => {
          obj[name] = rowArr[idx];
        });
        rows.push(obj);
      }
    } else {
      const maxLen = Math.max(...json.map((r) => r.length));
      columnNames = Array.from({ length: maxLen }, (_, i) => `Col ${i + 1}`);
      for (const rowArr of json) {
        const obj = {};
        columnNames.forEach((name, idx) => {
          obj[name] = rowArr[idx];
        });
        rows.push(obj);
      }
    }

    parsedRows = rows;
    populateConfig();
    updateSummary(file);
  };
  reader.readAsArrayBuffer(file);
}

function populateConfig() {
  if (!columnNames.length) return;

  // X-axis select
  const xSel = $("xColumn");
  xSel.innerHTML = "";
  columnNames.forEach((name, idx) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    if (idx === 0) opt.selected = true;
    xSel.appendChild(opt);
  });
  xSel.disabled = false;

  // Y columns checkboxes
  const yWrapper = $("yColumns");
  yWrapper.innerHTML = "";
  yWrapper.className = "y-columns-list";
  columnNames.forEach((name, idx) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = name;
    if (idx === 1) input.checked = true; // default second column
    label.appendChild(input);
    const span = document.createElement("span");
    span.textContent = name;
    label.appendChild(span);
    yWrapper.appendChild(label);
  });

  $("generateBtn").disabled = false;
}

function updateSummary(file) {
  const rowCount = parsedRows.length;
  const colCount = columnNames.length;
  $("summary").textContent =
    `File: ${file.name}\n` +
    `Rows: ${rowCount}\n` +
    `Columns: ${colCount}`;
}

function generateChart() {
  if (!parsedRows.length) return;

  const xCol = $("xColumn").value;
  if (!xCol) {
    alert("Select X-axis column");
    return;
  }

  const yInputs = $("yColumns").querySelectorAll("input[type=checkbox]");
  const yCols = Array.from(yInputs)
    .filter((i) => i.checked)
    .map((i) => i.value);

  if (!yCols.length) {
    alert("Select at least one Y column");
    return;
  }

  const type = $("chartType").value;
  const treatAsNumber = $("treatAsNumber").checked;

  // Build X values
  const xValues = [];
  const seriesMap = {};
  yCols.forEach((c) => (seriesMap[c] = []));

  for (const row of parsedRows) {
    const xRaw = row[xCol];
    if (xRaw === undefined || xRaw === null || xRaw === "") continue;

    const xVal = treatAsNumber ? Number(xRaw) : String(xRaw);
    if (treatAsNumber && Number.isNaN(xVal)) continue;

    xValues.push(xVal);

    yCols.forEach((c) => {
      const yRaw = row[c];
      const yVal = treatAsNumber ? Number(yRaw) : Number(yRaw);
      if (Number.isNaN(yVal)) {
        seriesMap[c].push(null);
      } else {
        seriesMap[c].push(yVal);
      }
    });
  }

  // FIXED: Single series definition with shortened names
  const shortYCols = yCols.map(name => {
    if (name.length > 15) {
      return name.length > 25 ? name.substring(0, 12) + "..." : name.substring(0, 15);
    }
    return name;
  });

  const series = yCols.map((col, idx) => ({
    name: shortYCols[idx],  // Shortened name
    data: seriesMap[col],
  }));

  if (!series.length || !xValues.length) {
    alert("No valid numeric data for selected columns");
    return;
  }

  const options = {
    chart: {
      type,
      height: 450,  // Increased for legend space
      toolbar: {
        show: true,
        position: "right",
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true,
        },
      },
      foreColor: "#e5e7eb",
      background: "transparent",
      fontFamily: "Inter, sans-serif",
    },
    theme: {
      mode: "dark",
      palette: "palette2",
    },
    colors: ["#22d3ee", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#f97316", "#14b8a6"],
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
      floating: false,
      offsetY: -10,
      fontSize: "12px",
      labels: {
        colors: "#e5e7eb",
      },
      markers: {
        width: 10,
        height: 10,
        radius: 2,
      },
      itemMargin: {
        horizontal: 12,
        vertical: 2,
      },
      fontFamily: "Inter, sans-serif",
    },
    grid: {
      padding: {
        top: 50,    // Reserve space for legend
        right: 10,
        bottom: 20,
        left: 10,
      },
    },
    xaxis: {
      type: treatAsNumber ? "numeric" : "category",
      categories: xValues,
      labels: {
        style: {
          colors: "#9ca3af",
          fontSize: "11px",
          fontFamily: "Inter, sans-serif",
        },
      },
      title: {
        text: xCol,
        style: {
          color: "#d1d5db",
          fontSize: "13px",
          fontWeight: 600,
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: "#9ca3af",
          fontSize: "11px",
          fontFamily: "Inter, sans-serif",
        },
      },
    },
    stroke: {
      curve: type === "line" || type === "area" ? "smooth" : "straight",
      width: 2,
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      theme: "dark",
      shared: true,
      intersect: false,
      style: {
        fontFamily: "Inter, sans-serif",
      },
    },
    series,
  };

  // Destroy and recreate chart to avoid state issues
  if (chart) {
    chart.destroy();
  }
  $("chart").innerHTML = "";
  chart = new ApexCharts($("chart"), options);
  chart.render();
}

window.addEventListener("DOMContentLoaded", init);
