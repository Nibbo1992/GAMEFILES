const STORAGE_KEY = 'glimmeringDungeonSave';

// --- GAME DATA ---
let currentUpgradePrice = 50;
let currentZoneIndex = 0;
let currentDifficulty = 'Normal'; 

let player = {
    name: "Adventurer", 
    hp: 100,
    maxHp: 100,
    attack: 15,
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    gold: 0,
    inventory: { 'Healing Potion': 0 },
    status: { 
        poison: 0, 
        stun: 0    
    }
};

// NEW: DIFFICULTY SETTINGS
const difficultySettings = {
    'Normal': { attackMultiplier: 1.0, goldMultiplier: 1.0 },
    'Hard': { attackMultiplier: 1.5, goldMultiplier: 1.0 },
    'Brutal': { attackMultiplier: 2.0, goldMultiplier: 0.5 }
};

const zones = [ 
    { name: "Forest Glade", minLevel: 1, monsterMultiplier: 1.0 },
    { name: "Murky Swamp", minLevel: 5, monsterMultiplier: 1.5 },
    { name: "Volcanic Peak", minLevel: 10, monsterMultiplier: 2.0 }
];

// MODIFIED: Added 3 new monsters
const monsters = [
    { name: "Slime", hp: 30, attack: 5, xpDrop: 20, goldDrop: [1, 5], statusChance: { type: 'poison', chance: 0.1, duration: 2, damage: 3 } },
    { name: "Goblin", hp: 50, attack: 10, xpDrop: 40, goldDrop: [5, 12], statusChance: null },
    { name: "Ogre", hp: 80, attack: 15, xpDrop: 70, goldDrop: [10, 25], statusChance: { type: 'stun', chance: 0.2, duration: 1 } },
    
    // NEW MONSTERS START HERE
    { name: "Skeleton Archer", hp: 40, attack: 18, xpDrop: 50, goldDrop: [8, 18], statusChance: { type: 'poison', chance: 0.3, duration: 3, damage: 3 } },
    { name: "Stone Golem", hp: 150, attack: 8, xpDrop: 90, goldDrop: [15, 30], statusChance: { type: 'stun', chance: 0.15, duration: 1 } },
    // Regeneration will be handled in the combat loop (window.attack)
    { name: "Cave Troll", hp: 100, attack: 12, xpDrop: 120, goldDrop: [20, 40], statusChance: null, special: 'regenerate' }
    // NEW MONSTERS END HERE
];

let currentEnemy = null;
let isFighting = false;

// --- UI ELEMENTS REFERENCES ---
// Elements are guaranteed to exist because the script runs after DOMContentLoaded
const messageBox = document.getElementById('message-box');
const startBtn = document.getElementById('start-btn');
const loadBtn = document.getElementById('load-btn');
const saveBtn = document.getElementById('save-btn');
const exploreBtn = document.getElementById('explore-btn');
const attackBtn = document.getElementById('attack-btn');
const fleeBtn = document.getElementById('flee-btn');
const usePotionBtn = document.getElementById('use-potion-btn');
const inventoryItemsSpan = document.getElementById('inventory-items');
const upgradePriceSpan = document.getElementById('upgrade-price');
const playerStatusSpan = document.getElementById('player-status');
const playerHpBar = document.getElementById('player-hp-bar');
const hpBarContainer = document.getElementById('hp-bar-container');
const difficultySelect = document.getElementById('game-difficulty');


// --- UTILITY FUNCTIONS ---
function getRandomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// --- UI CORE FUNCTIONS ---
function log(message, type = 'system') {
    const msgElement = document.createElement('div');
    msgElement.classList.add('message', type);
    msgElement.textContent = message;
    messageBox.prepend(msgElement); 
    messageBox.scrollTop = 0; 
}

function update_ui() {
    // --- STATS UPDATE ---
    document.getElementById('player-name').textContent = player.name;
    document.getElementById('player-hp').textContent = `HP: ${player.hp}/${player.maxHp}`;
    document.getElementById('player-level').textContent = `Level: ${player.level}`;
    document.getElementById('player-xp').textContent = `XP: ${player.xp}/${player.xpToNextLevel}`;
    document.getElementById('player-gold').textContent = `Gold: ${player.gold} 💰`;

    // --- HP BAR VISUAL FEEDBACK FIX ---
    const hpPercent = (player.hp / player.maxHp) * 100;
    
    // Check if the HP bar element exists before trying to modify its style
    if (playerHpBar) {
        playerHpBar.style.width = `${hpPercent}%`;

        // Toggle 'low-hp' class for visual alert
        if (hpPercent < 25) {
            hpBarContainer.classList.add('low-hp');
        } else {
            hpBarContainer.classList.remove('low-hp');
        }
    }

    // --- STATUS DISPLAY ---
    let statusText = '';
    if (player.status.poison > 0) statusText += ` | 🧪 Poison (${player.status.poison}t)`;
    if (player.status.stun > 0) statusText += ` | 😵 Stunned (${player.status.stun}t)`;
    playerStatusSpan.textContent = statusText;

    // --- GENERAL UI UPDATE ---
    let inventoryText = '';
    for (const item in player.inventory) {
        if (player.inventory[item] > 0) inventoryText += `${item} (${player.inventory[item]}) `;
    }
    inventoryItemsSpan.textContent = inventoryText || 'Empty';
    upgradePriceSpan.textContent = currentUpgradePrice;
    
    // NEW: Update difficulty selector state
    if (difficultySelect) {
        difficultySelect.value = currentDifficulty;
        difficultySelect.disabled = isFighting;
    }

    const notFighting = !isFighting;
    startBtn.disabled = isFighting;
    loadBtn.disabled = isFighting;
    saveBtn.disabled = isFighting;
    exploreBtn.disabled = isFighting;
    attackBtn.disabled = notFighting;
    fleeBtn.disabled = notFighting;
    usePotionBtn.disabled = isFighting || player.inventory['Healing Potion'] <= 0;

    document.querySelectorAll('#zone-buttons button').forEach((btn, index) => {
        btn.style.backgroundColor = index === currentZoneIndex ? '#2ecc71' : '#e67e22';
    });
}

// --- PERSISTENCE ---

window.save_game = function() {
    try {
        const saveData = JSON.stringify({
            player: player,
            upgradePrice: currentUpgradePrice,
            zoneIndex: currentZoneIndex,
            // NEW: Save difficulty
            difficulty: currentDifficulty 
        });
        localStorage.setItem(STORAGE_KEY, saveData);
        log("Game saved successfully!", 'system');
    } catch (e) {
        log("Error saving game. Check browser settings.", 'combat');
    }
}

window.load_game = function() {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (!savedData) {
            log("No saved game found.", 'combat');
            return;
        }
        const data = JSON.parse(savedData);
        
        player = data.player; 
        currentUpgradePrice = data.upgradePrice;
        currentZoneIndex = data.zoneIndex;
        // NEW: Load difficulty, default to 'Normal' if missing (for old saves)
        currentDifficulty = data.difficulty || 'Normal'; 

        isFighting = false;
        currentEnemy = null;
        
        log(`Game loaded. Welcome back to the ${zones[currentZoneIndex].name}! Difficulty: ${currentDifficulty}`, 'system');
        update_ui();
    } catch (e) {
        log("Error loading game data.", 'combat');
    }
}

// --- GAME SETTINGS LOGIC ---

// NEW FUNCTION: Set Difficulty
window.set_difficulty = function(newDifficulty) {
    if (isFighting) {
        log("You cannot change difficulty during combat!", 'combat');
        return;
    }
    if (currentDifficulty !== newDifficulty) {
        currentDifficulty = newDifficulty;
        log(`Difficulty set to: ${currentDifficulty}. This will affect future encounters.`, 'info');
    }
    update_ui();
}

window.set_zone = function(index) {
    if (isFighting) {
        log("You cannot switch zones during combat!", 'combat');
        return;
    }
    if (player.level < zones[index].minLevel) {
        log(`Zone locked! Requires Level ${zones[index].minLevel}.`, 'combat');
        return;
    }
    currentZoneIndex = index;
    log(`You are now exploring the ${zones[currentZoneIndex].name}...`, 'system');
    update_ui();
}

// --- COMBAT LOGIC ---

function apply_status_effects() {
    if (player.status.poison > 0) {
        player.hp -= 3;
        player.status.poison--;
        log(`The poison gnaws at you, taking 3 HP! (${player.status.poison} turns left)`, 'status');
    }

    if (player.hp <= 0) {
        log("💀 Poison took your life! Game Over. 💀", 'combat");
        isFighting = false;
        update_ui(); 
        return false;
    }

    if (player.status.stun > 0) {
        player.status.stun--;
        log(`You are Stunned and cannot move this turn! (${player.status.stun} turns left)`, 'status');
        return true;
    }
    return false;
}

function monster_applies_status() {
    const statusEffect = currentEnemy.statusChance;
    if (statusEffect && Math.random() < statusEffect.chance) {
        if (statusEffect.type === 'poison') {
            player.status.poison = statusEffect.duration;
            log(`${currentEnemy.name} poisoned you!`, 'status');
        } else if (statusEffect.type === 'stun') {
            player.status.stun = statusEffect.duration;
            log(`${currentEnemy.name} stunned you! You might lose a turn.`, 'status');
        }
    }
}

function encounter_monster() {
    const monsterIndex = Math.floor(Math.random() * monsters.length);
    const baseMonster = monsters[monsterIndex];
    currentEnemy = JSON.parse(JSON.stringify(baseMonster));
    
    // Track max HP for regeneration
    currentEnemy.maxHp = currentEnemy.hp; 
    
    const levelFactor = player.level - 1;
    const zoneMultiplier = zones[currentZoneIndex].monsterMultiplier;
    
    // NEW: Apply difficulty attack multiplier
    const difficultyMultiplier = difficultySettings[currentDifficulty].attackMultiplier;

    // Apply scaling
    currentEnemy.hp = Math.round((currentEnemy.hp + levelFactor * 15) * zoneMultiplier);
    currentEnemy.attack = Math.round((currentEnemy.attack + levelFactor * 5) * zoneMultiplier * difficultyMultiplier);
    
    // Update max HP after scaling
    currentEnemy.maxHp = currentEnemy.hp; 

    isFighting = true;
    log(`A hostile ${currentEnemy.name} appears in the ${zones[currentZoneIndex].name}! (HP: ${currentEnemy.hp})`, 'combat');
    update_ui();
}

window.attack = function() {
    if (!isFighting) return;
    
    const isStunned = apply_status_effects();
    if (!isStunned) {
        // Player attacks
        const playerDamage = player.attack + getRandomInt(0, 5);
        currentEnemy.hp -= playerDamage;
        log(`You strike the ${currentEnemy.name} for ${playerDamage} damage.`, 'info');
    }

    if (currentEnemy.hp <= 0) {
        log(`The ${currentEnemy.name} is defeated!`, 'system');
        
        player.xp += currentEnemy.xpDrop;
        log(`You gained ${currentEnemy.xpDrop} XP!`, 'system');
        drop_loot(); 

        isFighting = false;
        check_xp();
        log("Fight ended. Visit the shop or Explore.", 'system');
        update_ui();
        return;
    }
    
    if (player.hp <= 0) return;

    // Enemy attacks
    const enemyDamage = currentEnemy.attack + getRandomInt(0, 3);
    player.hp -= enemyDamage;
    log(`The ${currentEnemy.name} hits you for ${enemyDamage} damage. (${currentEnemy.name} HP: ${currentEnemy.hp})`, 'combat');
    monster_applies_status(); 
    
    // NEW: Troll Regeneration Logic
    if (currentEnemy.special === 'regenerate') {
        const healAmount = Math.round(currentEnemy.maxHp * 0.05); // Heals 5% of max HP per turn
        currentEnemy.hp = Math.min(currentEnemy.maxHp, currentEnemy.hp + healAmount);
        log(`The ${currentEnemy.name} regenerates ${healAmount} HP!`, 'status');
    }
    
    update_ui();

    if (player.hp <= 0) {
        log("💀 You have been defeated! Game Over. 💀", 'combat');
        isFighting = false;
        update_ui();
        return;
    }
}

window.explore = function() {
    if (isFighting) return;
    log(`You wander deeper into the ${zones[currentZoneIndex].name}...`, 'system');
    update_ui();
    setTimeout(encounter_monster, 1000); 
}

window.flee = function() {
    if (!isFighting) return;
    
    if (Math.random() > 0.5) {
        log("You successfully escape the encounter!", 'system');
        isFighting = false;
        currentEnemy = null;
        log("You are safe for now.", 'system');
    } else {
        log("You failed to escape and are hit while trying to run!", 'combat');
        player.hp -= 10;
        log(`You take 10 damage! (Your HP: ${player.hp})`, 'combat');
        if (player.hp <= 0) {
            log("💀 You died while fleeing! Game Over. 💀", 'combat');
            isFighting = false;
        } else {
            log("The fight continues!", 'combat');
        }
    }
    update_ui();
}

// --- ECONOMY / INVENTORY ---

function drop_loot() {
    const [minGold, maxGold] = currentEnemy.goldDrop;
    const baseGoldFound = getRandomInt(minGold, maxGold);
    
    // NEW: Apply difficulty gold multiplier
    const goldMultiplier = difficultySettings[currentDifficulty].goldMultiplier;
    const finalGold = Math.round(baseGoldFound * goldMultiplier);
    
    player.gold += finalGold;
    log(`You find ${finalGold} gold pieces!`, 'system');

    if (Math.random() < 0.1) {
        player.inventory['Healing Potion']++;
        log(`You found a Healing Potion!`, 'info');
    }
}

window.use_potion = function() {
    if (isFighting) {
        log("You cannot focus enough to drink a potion during combat!", 'combat');
        return;
    }
    if (player.inventory['Healing Potion'] <= 0) {
        log("You have no Healing Potions!", 'info');
        return;
    }

    const healAmount = player.maxHp * 0.4;
    const oldHp = player.hp;
    
    if (player.hp === player.maxHp) {
        log("Your health is already full!", 'info');
        return;
    }
    
    player.hp = Math.min(player.maxHp, player.hp + healAmount);
    
    const actualHealed = player.hp - oldHp;
    player.inventory['Healing Potion']--;

    player.status.poison = 0;
    log("Poison status cleared by healing!", 'system');

    log(`You drink a potion, restoring ${Math.round(actualHealed)} HP!`, 'system');
    update_ui();
}

window.buy_item = function(item, price) {
    if (player.gold < price) {
        log(`You need ${price} gold to buy that!`, 'combat');
        return;
    }

    player.gold -= price;
    
    if (item === 'Healing Potion') {
        player.inventory['Healing Potion']++;
        log(`Purchased Healing Potion for ${price} gold.`, 'system');
    } else if (item === 'Sword Upgrade') {
        player.attack += 5;
        log(`Purchased Sword Upgrade! Attack is now ${player.attack}.`, 'system');
        currentUpgradePrice = Math.round(currentUpgradePrice * 1.5);
    }

    update_ui();
}


// --- INITIALIZATION ---

function level_up() {
    player.level++;
    player.maxHp += 20;
    player.hp = player.maxHp; 
    player.attack += 5;
    player.xpToNextLevel = player.level * 100 + 50;
    log(`🎉 You reached Level ${player.level}! Your power grows!`, 'system');
    update_ui();
}

function check_xp() {
    if (player.xp >= player.xpToNextLevel) {
        player.xp -= player.xpToNextLevel;
        level_up();
        check_xp(); 
    }
}

window.start_game = function() {
    // Reset all stats to starting values
    player.name = "Adventurer"; 
    player.hp = player.maxHp = 100;
    player.attack = 15;
    player.level = 1;
    player.xp = 0;
    player.xpToNextLevel = 100;
    player.gold = 0;
    player.inventory = { 'Healing Potion': 0 };
    player.status = { poison: 0, stun: 0 };
    currentUpgradePrice = 50;
    currentZoneIndex = 0;
    currentDifficulty = 'Normal'; // NEW: Reset difficulty on new game

    isFighting = false;
    currentEnemy = null;

    messageBox.innerHTML = ''; 

    log("A fresh adventure begins!", 'system');
    log(`Current Difficulty: ${currentDifficulty}. Press 'Explore' to find a monster!`, 'system');
    
    update_ui();
}

// Ensure initial UI update and check for saved game only after the entire page is loaded
document.addEventListener('DOMContentLoaded', () => {
    // NEW: Set initial difficulty state if the element exists
    if (difficultySelect) {
        currentDifficulty = difficultySelect.value;
    }
    
    update_ui();
    if (localStorage.getItem(STORAGE_KEY)) {
        log("A saved game exists. Press 'LOAD GAME' to continue.", 'info');
    }
});