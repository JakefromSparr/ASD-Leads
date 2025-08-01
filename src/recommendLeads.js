const fs = require('fs');
const path = require('path');

const performancePath = path.join(__dirname, '..', 'data', 'weeklyPerformance.json');
const splitPath = path.join(__dirname, '..', 'data', 'productSplit.json');
const outputPath = path.join(__dirname, '..', 'output', 'recommendations.json');

const PLATINUM_BENCHMARK = 100000; // dollars
const CAPACITY = {
  'Chris Knighton': 25,
  'Jason Laird': 20
};

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function collectEmployeeData(weeklyData) {
  const employees = {};
  for (const week of weeklyData) {
    for (const rec of week.data) {
      if (!employees[rec.name]) {
        employees[rec.name] = [];
      }
      employees[rec.name].push({
        cnvPct: rec.cnvPct,
        avgSale: rec.avgSale,
        leads: rec.leads,
        quotePct: rec.quotePct
      });
    }
  }
  return employees;
}

function average(arr, field) {
  const sum = arr.reduce((acc, item) => acc + item[field], 0);
  return sum / arr.length;
}

function analyzeEmployee(name, records, split) {
  const cnvAvg = average(records, 'cnvPct') * 100; // to percentage
  const avgSale = average(records, 'avgSale');

  const trend = records[records.length - 1].cnvPct >= records[0].cnvPct ? 'positive' : 'negative';

  const gvpl = (cnvAvg / 100) * avgSale;
  const capacity = CAPACITY[name] || 0;
  let neededLeads = Math.ceil(PLATINUM_BENCHMARK / gvpl) - capacity;
  if (neededLeads < 0) neededLeads = 0;

  const shedGVPL = split.shedOnly.cnvPct * split.shedOnly.avgSale;
  const steelGVPL = split.steelOnly.cnvPct * split.steelOnly.avgSale;
  const ratio = steelGVPL === 0 ? 1 : shedGVPL / steelGVPL;
  const shedLeads = Math.round(neededLeads * ratio / (1 + ratio));
  const steelLeads = neededLeads - shedLeads;

  return {
    name,
    neededLeads,
    recommendedSplit: { shed: shedLeads, steel: steelLeads },
    trend,
    cnvAvg: Number(cnvAvg.toFixed(2)),
    avgSale: Number(avgSale.toFixed(2))
  };
}

function main() {
  const weeklyData = loadJSON(performancePath);
  const splitData = loadJSON(splitPath);

  const employees = collectEmployeeData(weeklyData);
  const results = [];
  for (const [name, records] of Object.entries(employees)) {
    const split = splitData[name];
    if (!split) continue;
    results.push(analyzeEmployee(name, records, split));
  }
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
}

main();
