const DATA_PATH = "data/";

const PROPERTY_NAMES_BY_LANG = {
  Ko: {
    0: "전체",
    1: "풀",
    2: "불",
    3: "물",
    4: "빛",
    5: "어둠",
  },
  En: {
    0: "All",
    1: "Grass",
    2: "Fire",
    3: "Water",
    4: "Light",
    5: "Dark",
  },
  Ja: {
    0: "全体",
    1: "草",
    2: "火",
    3: "水",
    4: "光",
    5: "闇",
  },
  Zh: {
    0: "全部",
    1: "草",
    2: "火",
    3: "水",
    4: "光",
    5: "暗",
  },
};

const RANK_NAMES_BY_LANG = {
  Ko: {
    1: "1등급",
    2: "2등급",
    3: "3등급",
    4: "4등급",
    5: "5등급",
  },
  En: {
    1: "Grade 1",
    2: "Grade 2",
    3: "Grade 3",
    4: "Grade 4",
    5: "Grade 5",
  },
  Ja: {
    1: "1等級",
    2: "2等級",
    3: "3等級",
    4: "4等級",
    5: "5等級",
  },
  Zh: {
    1: "1等级",
    2: "2等级",
    3: "3等级",
    4: "4等级",
    5: "5等级",
  },
};

const TEXT_BY_LANG = {
  Ko: {
    monsterCountSuffix: "마리",
    noMonster: "표시할 몬스터가 없습니다.",
    loadErrorSuffix: "파일을 불러오지 못했습니다.",
  },
  En: {
    monsterCountSuffix: "",
    noMonster: "No monsters to display.",
    loadErrorSuffix: "could not be loaded.",
  },
  Ja: {
    monsterCountSuffix: "体",
    noMonster: "表示するモンスターがありません。",
    loadErrorSuffix: "ファイルを読み込めませんでした。",
  },
  Zh: {
    monsterCountSuffix: "只",
    noMonster: "没有可显示的怪物。",
    loadErrorSuffix: "文件加载失败。",
  },
};

const ALLOWED_LANGS = ["Ko", "En", "Ja", "Zh"];

let currentLang = "Ko";
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
const langSelectEl = document.getElementById("langSelect");

function normalizeLang(value) {
  if (!value) return "Ko";
  const normalized = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  return ALLOWED_LANGS.includes(normalized) ? normalized : "Ko";
}

function getLangFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return normalizeLang(urlParams.get("lang"));
}

async function loadText(fileName) {
  const response = await fetch(DATA_PATH + fileName);
  if (!response.ok) {
    const text = TEXT_BY_LANG[currentLang] || TEXT_BY_LANG.Ko;
    throw new Error(`${fileName} ${text.loadErrorSuffix}`);
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
  return itemNames[targetItem] || `Item ${targetItem}`;
}

function getMonsterName(index) {
  return monsterNames[index - 1] || `Monster ${index}`;
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
      if (a.rank !== b.rank) return b.rank - a.rank; // 높은 등급 먼저 표시
      if (a.property !== b.property) return a.property - b.property;
      return a.index - b.index;
    });
}

function renderSummary(targetItem, rows) {
  const text = TEXT_BY_LANG[currentLang] || TEXT_BY_LANG.Ko;
  selectedEggNameEl.textContent = getItemName(targetItem);
  monsterCountEl.textContent = `${rows.length}${text.monsterCountSuffix}`;
}

function renderTable(rows) {
  const text = TEXT_BY_LANG[currentLang] || TEXT_BY_LANG.Ko;
  const rankNames = RANK_NAMES_BY_LANG[currentLang] || RANK_NAMES_BY_LANG.Ko;
  const propertyNames = PROPERTY_NAMES_BY_LANG[currentLang] || PROPERTY_NAMES_BY_LANG.Ko;

  if (rows.length === 0) {
    tableBodyEl.innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(text.noMonster)}</td></tr>`;
    return;
  }

  tableBodyEl.innerHTML = rows.map(row => `
    <tr class="rank-${row.rank}">
      <td>${row.index}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${rankNames[row.rank] || row.rank}</td>
      <td>${propertyNames[row.property] || row.property}</td>
      <td>${formatRate(row.rate)}</td>
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

if (langSelectEl) {
  langSelectEl.addEventListener("change", e => {
    const nextLang = normalizeLang(e.target.value);
    const url = new URL(window.location.href);
    if (nextLang === "Ko") {
      url.searchParams.delete("lang");
    } else {
      url.searchParams.set("lang", nextLang);
    }
    window.location.href = url.toString();
  });
}

async function init() {
  try {
    currentLang = getLangFromUrl();

    if (langSelectEl) {
      langSelectEl.value = currentLang;
    }

    const [eggText, monsterText, itemText, monsterNameText] = await Promise.all([
      loadText("Egg.txt"),
      loadText("Monster.txt"),
      loadText(`strItem_${currentLang}.txt`),
      loadText(`strMonsterName_${currentLang}.txt`),
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
