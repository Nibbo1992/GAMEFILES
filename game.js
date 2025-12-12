const STORAGE_KEY = 'glimmeringDungeonSave';

// --- GAME DATA ---
let currentUpgradePrice = 50;
let currentZoneIndex = 0;
        
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

const zones = [ 
    { name: "Forest Glade", minLevel: 1, monsterMultiplier: 1.0 },
    { name: "Murky Swamp", minLevel: 5, monsterMultiplier: 1.5 },
    { name: "Volcanic Peak", minLevel: 10, monsterMultiplier: 2.0 }
];

const monsters = [
    { name: "Slime", hp: 30, attack: 5, xpDrop: 20, goldDrop: [1, 5], statusChance: { type: 'poison', chance: 0.1, duration: 2, damage: 3 } },
    { name: "Goblin", hp: 50, attack: 10, xpDrop: 40, goldDrop: [5, 12], statusChance: null },
    { name: "Ogre", hp: 80, attack: 15, xpDrop: 70, goldDrop: [10, 25], statusChance: { type: 'stun', chance: 0.2, duration: 1 } }
];

let currentEnemy = null;
let isFighting = false;

// --- UI ELEMENTS ---
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
    document.getElementById('player-name').textContent = player.name;
    document.getElementById('player-hp').textContent = `HP: ${player.hp}/${player.maxHp}`;
    document.getElementById('player-level').textContent = `Level: ${player.level}`;
    document.getElementById('player-xp').textContent = `XP: ${player.xp}/${player.xpToNextLevel}`;
    document.getElementById('player-gold').textContent = `Gold: ${player.gold} 💰`;

    let statusText = '';
    if (player.status.poison > 0) statusText += ` | 🧪 Poison (${player.status.poison}t)`;
    if (player.status.stun > 0) statusText += ` | 😵 Stunned (${player.status.stun}t)`;
    playerStatusSpan.textContent = statusText;

    let inventoryText = '';
    for (const item in player.inventory) {
        if (player.inventory[item] > 0) inventoryText += `${item} (${player.inventory[item]}) `;
    }
    inventoryItemsSpan.textContent = inventoryText || 'Empty';
    upgradePriceSpan.textContent = currentUpgradePrice;

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
            zoneIndex: currentZoneIndex
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
        
        // This is necessary to re-assign the entire complex object
        player = data.player; 
        currentUpgradePrice = data.upgradePrice;
        currentZoneIndex = data.zoneIndex;

        isFighting = false;
        currentEnemy = null;
        
        log(`Game loaded. Welcome back to the ${zones[currentZoneIndex].name}!`, 'system');
        update_ui();
    } catch (e) {
        log("Error loading game data.", 'combat');
    }
}

// --- ZONE LOGIC ---

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
    log(`You are now exploring the ${zones[currentZoneIndex].name}.`, 'system');
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
        log("💀 Poison took your life! Game Over. 💀", 'combat');
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
    
    const levelFactor = player.level - 1;
    const zoneMultiplier = zones[currentZoneIndex].monsterMultiplier;

    currentEnemy.hp = Math.round((currentEnemy.hp + levelFactor * 15) * zoneMultiplier);
    currentEnemy.attack = Math.round((currentEnemy.attack + levelFactor * 5) * zoneMultiplier);

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
    
    // Check if player died from status before monster attacks
    if (player.hp <= 0) return;

    // Enemy attacks
    const enemyDamage = currentEnemy.attack + getRandomInt(0, 3);
    player.hp -= enemyDamage;
    log(`The ${currentEnemy.name} hits you for ${enemyDamage} damage. (${currentEnemy.name} HP: ${currentEnemy.hp})`, 'combat');
    monster_applies_status(); 
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
    const goldFound = getRandomInt(minGold, maxGold);
    player.gold += goldFound;
    log(`You find ${goldFound} gold pieces!`, 'system');

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
    player.hp = Math.min(player.maxHp, player.hp + healAmount);
    
    const actualHealed = player.hp - oldHp;
    player.inventory['Healing Potion']--;

    // Clear status effects on heal
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

    isFighting = false;
    currentEnemy = null;

    messageBox.innerHTML = ''; 

    log("A fresh adventure begins!", 'system');
    log("You are in the Forest Glade. Check out the zones and press 'Explore'!", 'system');
    
    update_ui();
}

// Logic to run when the game.js file is loaded
document.addEventListener('DOMContentLoaded', () => {
    update_ui();
    if (localStorage.getItem(STORAGE_KEY)) {
        log("A saved game exists. Press 'LOAD GAME' to continue.", 'info');
    }
});
