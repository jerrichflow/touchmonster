const DATA_PATH = "data/";

const PROPERTY_NAMES = {
  0: "전체",
  1: "풀",
  2: "불",
  3: "물",
  4: "빛",
  5: "어둠",
};

const PROPERTY_ICONS = {
  0: "🌈",
  1: "🌿",
  2: "🔥",
  3: "💧",
  4: "☀️",
  5: "🌑",
};

const RANK_NAMES = {
  1: "1등급",
  2: "2등급",
  3: "3등급",
  4: "4등급",
  5: "5등급",
};

let eggs = [];
let monsters = [];
let itemNames = [];
let monsterNames = [];
let currentRows = [];
let selectedTargetItem = null;

const eggButtonsEl = document.getElementById("eggButtons");
const tableBodyEl = document.getElementById("rateTableBody");
const selectedEggNameEl = document.getElementById("selectedEggName");
const monsterCountEl = document.getElementById("monsterCount");
const searchInputEl = document.getElementById("searchInput");

async function loadText(fileName) {
  const response = await fetch(DATA_PATH + fileName);
  if (!response.ok) {
    throw new Error(`${fileName} 파일을 불러오지 못했습니다.`);
  }
  return await response.text();
}

function parseCsvLines(text) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith("#"));
}

function parseEggs(text) {
  return parseCsvLines(text).map(line => {
    const [targetItem, rank, property, volume] = line.split(",").map(Number);
    return { targetItem, rank, property, volume };
  });
}

function parseMonsters(text) {
  return parseCsvLines(text).map((line, i) => {
    const [property, evolutionLevel, evolutionTarget, evolutionStage, base, rank] = line.split(",").map(Number);
    return {
      index: i + 1,
      property,
      evolutionLevel,
      evolutionTarget,
      evolutionStage,
      base,
      rank,
    };
  });
}

function parseNameLines(text) {
  return parseCsvLines(text);
}

function getItemName(targetItem) {
  return itemNames[targetItem - 1] || `아이템 ${targetItem}`;
}

function getMonsterName(index) {
  return monsterNames[index - 1] || `몬스터 ${index}`;
}

function getUniqueTargetItems() {
  return [...new Set(eggs.map(e => e.targetItem))].sort((a, b) => a - b);
}

function renderEggButtons() {
  eggButtonsEl.innerHTML = "";

  getUniqueTargetItems().forEach(targetItem => {
    const button = document.createElement("button");
    button.className = "egg-button";
    button.textContent = getItemName(targetItem);
    button.dataset.targetItem = targetItem;
    button.addEventListener("click", () => selectEgg(targetItem));
    eggButtonsEl.appendChild(button);
  });
}

function selectEgg(targetItem) {
  selectedTargetItem = targetItem;

  document.querySelectorAll(".egg-button").forEach(button => {
    button.classList.toggle("active", Number(button.dataset.targetItem) === targetItem);
  });

  currentRows = calculateRates(targetItem);
  searchInputEl.value = "";
  renderSummary(targetItem, currentRows);
  renderTable(currentRows);
}

function calculateRates(targetItem) {
  const eggRules = eggs.filter(e => e.targetItem === targetItem);
  const weightMap = new Map();

  eggRules.forEach(rule => {
    const matchedMonsters = monsters.filter(monster => {
      // 알에서 나오는 대상은 진화단계 0만 사용
      if (monster.evolutionStage !== 0) return false;
      if (monster.rank !== rule.rank) return false;
      if (rule.property !== 0 && monster.property !== rule.property) return false;
      return true;
    });

    if (matchedMonsters.length === 0) return;

    const weightPerMonster = rule.volume / matchedMonsters.length;

    matchedMonsters.forEach(monster => {
      const prev = weightMap.get(monster.index) || 0;
      weightMap.set(monster.index, prev + weightPerMonster);
    });
  });

  const totalWeight = [...weightMap.values()].reduce((sum, weight) => sum + weight, 0);

  return [...weightMap.entries()]
    .map(([index, weight]) => {
      const monster = monsters[index - 1];
      return {
        index,
        name: getMonsterName(index),
        rank: monster.rank,
        property: monster.property,
        weight,
        rate: totalWeight > 0 ? (weight / totalWeight) * 100 : 0,
      };
    })
    .sort((a, b) => {
      if (a.rate !== b.rate) return a.rate - b.rate; // 낮은 확률 먼저 표시
      if (a.rank !== b.rank) return b.rank - a.rank; // 확률이 같으면 높은 등급 먼저
      if (a.property !== b.property) return a.property - b.property;
      return a.index - b.index;
    });
}

function renderSummary(targetItem, rows) {
  selectedEggNameEl.textContent = getItemName(targetItem);
  monsterCountEl.textContent = `${rows.length}마리`;
}

function renderTable(rows) {
  if (rows.length === 0) {
    tableBodyEl.innerHTML = `<tr><td colspan="5" class="empty">표시할 몬스터가 없습니다.</td></tr>`;
    return;
  }

  tableBodyEl.innerHTML = rows.map(row => `
    <tr>
      <td class="index-cell">${row.index}</td>
      <td>
        <span class="rank-text rank-${row.rank}-text">${escapeHtml(row.name)}</span>
      </td>
      <td>
        <span class="rank-text rank-${row.rank}-text">${RANK_NAMES[row.rank] || row.rank}</span>
      </td>
      <td>
        <span class="property-icon" title="${PROPERTY_NAMES[row.property] || row.property}">
          ${PROPERTY_ICONS[row.property] || "?"}
        </span>
      </td>
      <td class="rate-cell">${formatRate(row.rate)}</td>
    </tr>
  `).join("");
}

function formatRate(value) {
  if (value === 0) return "0%";
  if (value < 0.0001) return `${value.toFixed(6)}%`;
  return `${value.toFixed(4)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

searchInputEl.addEventListener("input", () => {
  const keyword = searchInputEl.value.trim().toLowerCase();

  if (!selectedTargetItem) return;

  if (!keyword) {
    renderTable(currentRows);
    return;
  }

  const filtered = currentRows.filter(row => {
    return String(row.index).includes(keyword) || row.name.toLowerCase().includes(keyword);
  });

  renderTable(filtered);
});

async function init() {
  try {
    const [eggText, monsterText, itemText, monsterNameText] = await Promise.all([
      loadText("Egg.txt"),
      loadText("Monster.txt"),
      loadText("strItem_Ko.txt"),
      loadText("strMonsterName_Ko.txt"),
    ]);

    eggs = parseEggs(eggText);
    monsters = parseMonsters(monsterText);
    itemNames = parseNameLines(itemText);
    monsterNames = parseNameLines(monsterNameText);

    renderEggButtons();

    const firstTargetItem = getUniqueTargetItems()[0];
    if (firstTargetItem !== undefined) {
      selectEgg(firstTargetItem);
    }
  } catch (error) {
    tableBodyEl.innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(error.message)}</td></tr>`;
    console.error(error);
  }
}

init();
