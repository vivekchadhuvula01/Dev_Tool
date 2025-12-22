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

  const series = yCols.map((c) => ({
    name: c,
    data: seriesMap[c],
  }));

  if (!series.length || !xValues.length) {
    alert("No valid numeric data for selected columns");
    return;
  }

  const options = {
    chart: {
      type,
      height: 380,
      toolbar: {
        show: true,
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
    },
    theme: {
      mode: "dark",
      palette: "palette1",
    },
    xaxis: {
      type: treatAsNumber ? "numeric" : "category",
      categories: xValues,
      labels: {
        style: {
          colors: "#9ca3af",
        },
      },
      title: {
        text: xCol,
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: "#9ca3af",
        },
      },
    },
    legend: {
      labels: {
        colors: "#e5e7eb",
      },
    },
    stroke: {
      curve: type === "line" || type === "area" ? "smooth" : "straight",
      width: 2,
    },
    dataLabels: {
      enabled: false,
    },
    series,
  };

  if (chart) {
    chart.updateOptions(options, true, true);
  } else {
    $("chart").innerHTML = "";
    chart = new ApexCharts($("chart"), options);
    chart.render();
  }
}

window.addEventListener("DOMContentLoaded", init);
