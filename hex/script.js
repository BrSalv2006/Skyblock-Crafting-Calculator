let regularEnchantments = {};
let ultimateEnchantments = {};
let skyblockItems = [];
let bazaarPrices = {};
let gemstoneSlotData = {};
let reforges = {};
let others = {};
let gemstones = {};
let recombPrice = 0;
let artOfWarPrice = 0;
let artOfPeacePrice = 0;
let woodSingularityPrice = 0;
let divanPowderCoatingPrice = 0;
let farmingForDummiesPrice = 0;
let bookwormFavoriteBookPrice = 0;
let polarvoidBookPrice = 0;
let manaDisintegratorPrice = 0;
let bookOfStatsPrice = 0;
let hotPotatoBookPrice = 0;
let fumingPotatoBookPrice = 0;
let wetBookPrice = 0;

async function fetchWithProxy(url) {
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error(`API error! status: ${response.status} for URL: ${url}`);
    }
    return response.json();
}

document.addEventListener('DOMContentLoaded', async () => {
    const itemSelect = document.getElementById('item-select');
    itemSelect.disabled = true;

    await Promise.all([
        loadOthers(),
        loadEnchantments(),
        loadGemstoneData(),
        loadReforges(),
        loadSkyblockItems(),
        loadBazaarPrices()
    ]).catch(error => {
        console.error("Initialization failed:", error);
        itemSelect.innerHTML = '<option value="">Failed to load data</option>';
    });

    itemSelect.disabled = false;
    itemSelect.addEventListener('change', updateItemDetails);

    document.getElementById('ultimate-enchant-select').addEventListener('change', () => {
        addOrUpdateUltimateEnchantment();
        const selectedItem = skyblockItems.find(item => item.id === document.getElementById('item-select').value);
        if (selectedItem) {
            updateEnchantmentDropdown(selectedItem);
        }
    });

    document.getElementById('reforge-select').addEventListener('change', () => {
        const selectedItem = skyblockItems.find(item => item.id === document.getElementById('item-select').value);
        if (selectedItem) {
            updateReforgePrice(selectedItem);
        }
    });

    const mainElement = document.querySelector('main');
    mainElement.addEventListener('click', handleSpinnerClick);
});

function handleSpinnerClick(event) {
    const spinnerButton = event.target.closest('.spinner-btn');
    if (!spinnerButton) return;

    const wrapper = spinnerButton.closest('.number-input-wrapper');
    const input = wrapper.querySelector('input[type="number"]');
    const action = spinnerButton.dataset.action;

    if (!input) return;

    const min = parseInt(input.min);
    const max = parseInt(input.max);
    let value = parseInt(input.value) || 0;

    if (action === 'increment') {
        value = Math.min(max, value + 1);
    } else if (action === 'decrement') {
        value = Math.max(min, value - 1);
    }

    input.value = value;

    const changeEvent = new Event('change', {
        bubbles: true
    });
    input.dispatchEvent(changeEvent);
}

async function loadOthers() {
    try {
        const response = await fetch('others.json');
        others = await response.json();
    } catch (error) {
        console.error("Could not load others:", error);
    }
}

async function loadGemstoneData() {
    try {
        const response = await fetch('gemstones.json');
        gemstones = await response.json();
        gemstones.gemstoneSlots.forEach(slot => {
            gemstoneSlotData[slot.name] = {
                valid: slot.valid_gemstone ? [slot.valid_gemstone] : slot.valid_gemstones
            };
        });
    } catch (error) {
        console.error("Could not load gemstone data:", error);
    }
}

async function loadEnchantments() {
    try {
        const response = await fetch('enchantments.json');
        const data = await response.json();

        regularEnchantments = {};
        ultimateEnchantments = {};

        const idToNameMap = {};
        Object.entries(data.enchantments).forEach(([id, details]) => {
            idToNameMap[id] = details.name;
        });
        Object.entries(data.ultimate_enchantments).forEach(([id, details]) => {
            idToNameMap[id] = details.name;
        });

        const processEnchantments = (enchants, isUltimate) => {
            const targetDict = isUltimate ? ultimateEnchantments : regularEnchantments;
            Object.entries(enchants).forEach(([id, details]) => {
                const validLevels = [];
                for (let i = details.min_level; i <= details.max_level; i++) {
                    validLevels.push(i);
                }

                const incompatibleNames = (details.incompatibilities || []).map(incompatId => idToNameMap[incompatId]).filter(Boolean);

                targetDict[details.name] = {
                    name: details.name,
                    id: `ENCHANTMENT_${id}_`,
                    incompatible: incompatibleNames,
                    maxLevel: details.max_level,
                    minLevel: details.min_level,
                    validLevels: validLevels,
                    categories: details.categories,
                    items: details.items || [],
                    ultimate: isUltimate,
                };
            });
        };

        processEnchantments(data.enchantments, false);
        processEnchantments(data.ultimate_enchantments, true);

    } catch (error) {
        console.error("Could not load and process enchantments from enchantments.json:", error);
    }
}


async function loadSkyblockItems() {
    const itemSelect = document.getElementById('item-select');
    try {
        const data = await fetchWithProxy('https://api.hypixel.net/v2/resources/skyblock/items');
        if (!data.success) throw new Error('API returned success: false');

        skyblockItems = data.items.filter(item => {
            if (!item.name || !item.category) return false;
            const canBeEnchanted = !!getEnchantmentCategoryFromItem(item);
            const hasGemstoneSlots = item.gemstone_slots && item.gemstone_slots.length > 0;
            const canBeReforged = !!getReforgeCategoryFromItem(item);

            return (others.validTypes.categories.includes(item.category) && (canBeEnchanted || hasGemstoneSlots || canBeReforged));
        });

        skyblockItems.sort((a, b) => a.name.localeCompare(b.name));

        itemSelect.innerHTML = '<option value="">Select an item...</option>';
        skyblockItems.forEach(item => {
            const option = new Option(item.name, item.id);
            itemSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Could not load Skyblock items:", error);
        itemSelect.innerHTML = '<option value="">Error loading items</option>';
    }
}

async function loadBazaarPrices() {
    try {
        bazaarPrices = await fetchWithProxy('https://hysky.de/api/bazaar');
        const recombPriceData = bazaarPrices[others.recombobulator.internalName];
        if (recombPriceData && recombPriceData.buyPrice != null) {
            recombPrice = Math.round(recombPriceData.buyPrice);
            document.getElementById('recomb-price-display').textContent = `${recombPrice.toLocaleString()} coins`;
        }

        const artOfWarPriceData = bazaarPrices[others.artOfWar.internalName];
        if (artOfWarPriceData && artOfWarPriceData.buyPrice != null) {
            artOfWarPrice = Math.round(artOfWarPriceData.buyPrice);
            document.getElementById('art-of-war-price-display').textContent = `${artOfWarPrice.toLocaleString()} coins`;
        }

        const divanPowderCoatingPriceData = bazaarPrices[others.divanPowderCoating.internalName];
        if (divanPowderCoatingPriceData && divanPowderCoatingPriceData.buyPrice != null) {
            divanPowderCoatingPrice = Math.round(divanPowderCoatingPriceData.buyPrice);
            document.getElementById('divan-powder-coating-price-display').textContent = `${divanPowderCoatingPrice.toLocaleString()} coins`;
        }

        const artOfPeacePriceData = bazaarPrices[others.artOfPeace.internalName];
        if (artOfPeacePriceData && artOfPeacePriceData.buyPrice != null) {
            artOfPeacePrice = Math.round(artOfPeacePriceData.buyPrice);
            document.getElementById('art-of-peace-price-display').textContent = `${artOfPeacePrice.toLocaleString()} coins`;
        } else {
            artOfPeacePrice = 0;
        }

        const woodSingularityPriceData = bazaarPrices[others.woodSingularity.internalName];
        if (woodSingularityPriceData && woodSingularityPriceData.buyPrice != null) {
            woodSingularityPrice = Math.round(woodSingularityPriceData.buyPrice);
            document.getElementById('wood-singularity-price-display').textContent = `${woodSingularityPrice.toLocaleString()} coins`;
        } else {
            woodSingularityPrice = 0;
        }

        const farmingForDummiesPriceData = bazaarPrices[others.farmingForDummies.internalName];
        if (farmingForDummiesPriceData && farmingForDummiesPriceData.buyPrice != null) {
            farmingForDummiesPrice = Math.round(farmingForDummiesPriceData.buyPrice);
        }

        const bookwormFavoriteBookPriceData = bazaarPrices[others.bookwormBook.internalName];
        if (bookwormFavoriteBookPriceData && bookwormFavoriteBookPriceData.buyPrice != null) {
            bookwormFavoriteBookPrice = Math.round(bookwormFavoriteBookPriceData.buyPrice);
        }

        const polarvoidBookPriceData = bazaarPrices[others.polarvoidBook.internalName];
        if (polarvoidBookPriceData && polarvoidBookPriceData.buyPrice != null) {
            polarvoidBookPrice = Math.round(polarvoidBookPriceData.buyPrice);
        }

        const manaDisintegratorPriceData = bazaarPrices[others.manaDisintegrator.internalName];
        if (manaDisintegratorPriceData && manaDisintegratorPriceData.buyPrice != null) {
            manaDisintegratorPrice = Math.round(manaDisintegratorPriceData.buyPrice);
        }

        const bookOfStatsPriceData = bazaarPrices[others.bookOfStats.internalName];
        if (bookOfStatsPriceData && bookOfStatsPriceData.buyPrice != null) {
            bookOfStatsPrice = Math.round(bookOfStatsPriceData.buyPrice);
            document.getElementById('book-of-stats-price-display').textContent = `${bookOfStatsPrice.toLocaleString()} coins`;
        }

        const hotPotatoPriceData = bazaarPrices[others.potatoBooks.internalName.hotPotatoBook];
        if (hotPotatoPriceData && hotPotatoPriceData.buyPrice != null) {
            hotPotatoBookPrice = Math.round(hotPotatoPriceData.buyPrice);
        }

        const fumingPotatoPriceData = bazaarPrices[others.potatoBooks.internalName.fumingPotatoBook];
        if (fumingPotatoPriceData && fumingPotatoPriceData.buyPrice != null) {
            fumingPotatoBookPrice = Math.round(fumingPotatoPriceData.buyPrice);
        }

        const wetBookPriceData = bazaarPrices[others.wetBook.internalName];
        if (wetBookPriceData && wetBookPriceData.buyPrice != null) {
            wetBookPrice = Math.round(wetBookPriceData.buyPrice);
        }

    } catch (error) {
        console.error("Could not load bazaar prices:", error);
    }
}

async function loadReforges() {
    try {
        const response = await fetch('reforges.json');
        reforges = await response.json();
    } catch (error) {
        console.error("Could not load reforges:", error);
    }
}

function getEnchantmentPrice(name, level) {
    const details = regularEnchantments[name] || ultimateEnchantments[name];
    if (!details) return null;
    if (name === "Efficiency" && level > 5) {
        const silexPriceData = bazaarPrices[others.silex.internalName];
        return (silexPriceData?.buyPrice * (level - 5)) ?? null;
    }
    if (name === "Bane of Arthropods" && level == 7) {
        const ensnaredSnailPriceData = bazaarPrices[`ENSNARED_SNAIL`];
        const priceData = bazaarPrices[`${details.id}6`];
        return (priceData?.buyPrice + ensnaredSnailPriceData?.buyPrice) ?? null;
    }
    if (name === "Charm" && level == 6) {
        const chainEndTimesPriceData = bazaarPrices[`CHAIN_END_TIMES`];
        const priceData = bazaarPrices[`${details.id}5`];
        return (priceData?.buyPrice + chainEndTimesPriceData?.buyPrice) ?? null;
    }
    if (name === "Frail" && level == 7) {
        const severedPincerPriceData = bazaarPrices[`SEVERED_PINCER`];
        const priceData = bazaarPrices[`${details.id}6`];
        return (priceData?.buyPrice + severedPincerPriceData?.buyPrice) ?? null;
    }
    if (name === "Luck of the Sea" && level == 7) {
        const goldBottleCapPriceData = bazaarPrices[`GOLD_BOTTLE_CAP`];
        const priceData = bazaarPrices[`${details.id}6`];
        return (priceData?.buyPrice + goldBottleCapPriceData?.buyPrice) ?? null;
    }
    if (name === "Piscary" && level == 7) {
        const troubledBubblePriceData = bazaarPrices[`TROUBLED_BUBBLE`];
        const priceData = bazaarPrices[`${details.id}6`];
        return (priceData?.buyPrice + troubledBubblePriceData?.buyPrice) ?? null;
    }
    if (name === "Pesterminator" && level == 6) {
        const pesthuntingGuidePriceData = bazaarPrices[`PESTHUNTING_GUIDE`];
        const priceData = bazaarPrices[`${details.id}5`];
        return (priceData?.buyPrice + pesthuntingGuidePriceData?.buyPrice) ?? null;
    }
    if (name === "Scavenger" && level == 6) {
        const goldenBountyPriceData = bazaarPrices[`GOLDEN_BOUNTY`];
        const priceData = bazaarPrices[`${details.id}5`];
        return (priceData?.buyPrice + goldenBountyPriceData?.buyPrice) ?? null;
    }
    if (name === "Spiked Hook" && level == 7) {
        const octopusTendrilPriceData = bazaarPrices[`OCTOPUS_TENDRIL`];
        const priceData = bazaarPrices[`${details.id}6`];
        return (priceData?.buyPrice + octopusTendrilPriceData?.buyPrice) ?? null;
    }
    const priceData = bazaarPrices[`${details.id}${level}`];
    return priceData?.buyPrice ?? null;
}

function getGemstonePrice(tier, gemstoneName) {
    const priceData = bazaarPrices[`${tier}_${gemstoneName}_GEM`];
    return priceData?.buyPrice ?? null;
}

function getEnchantmentCategoryFromItem(item) {
    if (!item?.category) return null;
    return item.category;
}

function getReforgeCategoryFromItem(item) {
    if (!item?.category) return null;
    if (others.reforge.categories.equipment.includes(item.category)) return "EQUIPMENT";
    if (others.reforge.categories.armor.includes(item.category)) return "ARMOR";
    if (others.reforge.categories.drill.includes(item.category)) return "PICKAXE";
    return item.category;
}

function toggleUpgradeSection(config) {
    const section = document.getElementById(config.sectionId);
    if (!section) return;

    const input = document.getElementById(config.inputId);
    const upgradeData = others[config.upgradeKey];

    const isApplicable = (upgradeData.categories && upgradeData.categories.includes(config.itemCategory)) ||
        (upgradeData.items && upgradeData.items.includes(config.itemId)) ||
        (upgradeData.materials && upgradeData.materials.includes(config.itemMaterial));

    if (isApplicable) {
        section.style.display = 'block';
    } else {
        section.style.display = 'none';
        if (input) {
            if (input.type === 'checkbox') {
                input.checked = false;
            } else if (input.type === 'number') {
                input.value = 0;
            }
        }
    }
}

function updateItemDetails() {
    const calculatorBody = document.getElementById('calculator-body');
    const selectedItemId = document.getElementById('item-select').value;
    const selectedItem = skyblockItems.find(item => item.id === selectedItemId);

    document.getElementById('enchantments-container').innerHTML = '';
    document.getElementById('ultimate-enchantment-container').innerHTML = '';
    document.getElementById('results-container').classList.add('hidden');

    if (selectedItem) {
        calculatorBody.classList.remove('hidden');
        calculatorBody.classList.add('fade-in');

        updateEnchantmentDropdown(selectedItem);
        updateUltimateEnchantmentDropdown(selectedItem);
        updateGemstoneSlots(selectedItem);
        updateReforgeDropdown(selectedItem);

        const itemCategory = getEnchantmentCategoryFromItem(selectedItem);
        const itemId = selectedItem.id;
        const itemMaterial = selectedItem.material;

        const upgradeConfigs = [{
            sectionId: 'recomb-section',
            inputId: 'recomb-checkbox',
            upgradeKey: 'recombobulator'
        }, {
            sectionId: 'art-of-war-section',
            inputId: 'art-of-war-checkbox',
            upgradeKey: 'artOfWar'
        }, {
            sectionId: 'art-of-peace-section',
            inputId: 'art-of-peace-checkbox',
            upgradeKey: 'artOfPeace'
        }, {
            sectionId: 'wood-singularity-section',
            inputId: 'wood-singularity-checkbox',
            upgradeKey: 'woodSingularity'
        }, {
            sectionId: 'divan-powder-coating-section',
            inputId: 'divan-powder-coating-checkbox',
            upgradeKey: 'divanPowderCoating'
        }, {
            sectionId: 'farming-for-dummies-section',
            inputId: 'farming-for-dummies',
            upgradeKey: 'farmingForDummies'
        }, {
            sectionId: 'bookworm-favorite-book-section',
            inputId: 'bookworm-favorite-book',
            upgradeKey: 'bookwormBook'
        }, {
            sectionId: 'polarvoid-book-section',
            inputId: 'polarvoid-book',
            upgradeKey: 'polarvoidBook'
        }, {
            sectionId: 'mana-disintegrator-section',
            inputId: 'mana-disintegrator',
            upgradeKey: 'manaDisintegrator'
        }, {
            sectionId: 'book-of-stats-section',
            inputId: 'book-of-stats-checkbox',
            upgradeKey: 'bookOfStats'
        }, {
            sectionId: 'potato-books-section',
            inputId: 'potato-books',
            upgradeKey: 'potatoBooks'
        }, {
            sectionId: 'wet-book-section',
            inputId: 'wet-book',
            upgradeKey: 'wetBook'
        }];

        upgradeConfigs.forEach(config => {
            toggleUpgradeSection({
                ...config,
                itemCategory,
                itemId,
                itemMaterial
            });
        });

    } else {
        calculatorBody.classList.add('hidden');
    }
}

function updateReforgeDropdown(selectedItem) {
    const reforgeSelect = document.getElementById('reforge-select');
    const reforgeSection = document.getElementById('reforge-section');
    reforgeSelect.innerHTML = '<option value="">None</option>';

    const specificItemCategory = selectedItem.category;
    const generalItemCategory = getReforgeCategoryFromItem(selectedItem);
    const itemId = selectedItem.id;
    let applicableReforgesCount = 0;

    const addReforges = (reforgeCategory) => {
        for (const reforgeKey in reforgeCategory) {
            const reforge = reforgeCategory[reforgeKey];
            let isApplicable = false;

            if (reforge.categories.includes(specificItemCategory) || reforge.categories.includes(generalItemCategory) || reforge.items.includes(itemId)) {
                isApplicable = true;
            }

            if (isApplicable) {
                const option = new Option(reforge.name, reforge.name);
                reforgeSelect.appendChild(option);
                applicableReforgesCount++;
            }
        }
    };

    if (reforges.basic_reforges) {
        addReforges(reforges.basic_reforges);
    }
    if (reforges.stone_reforges) {
        addReforges(reforges.stone_reforges);
    }


    if (applicableReforgesCount === 0) {
        reforgeSection.style.display = 'none';
    } else {
        reforgeSection.style.display = 'block';
    }

    updateReforgePrice(selectedItem);
}

function updateReforgePrice(selectedItem) {
    const reforgeSelect = document.getElementById('reforge-select');
    const reforgePriceLabel = document.getElementById('reforge-price');
    const selectedReforgeName = reforgeSelect.value;

    if (selectedReforgeName && selectedReforgeName !== "") {
        const allReforges = {
            ...reforges.basic_reforges,
            ...reforges.stone_reforges
        };
        const reforge = Object.values(allReforges).find(r => r.name === selectedReforgeName);
        const reforgePrice = bazaarPrices[reforge.internalName] ? bazaarPrices[reforge.internalName].buyPrice : 0;
        const rarity = selectedItem.tier || 'COMMON';
        const reforgeCost = reforge.reforgeCosts[rarity] ? reforge.reforgeCosts[rarity] : 0;

        reforgePriceLabel.textContent = (reforgeCost + reforgePrice).toLocaleString();
        reforgePriceLabel.classList.remove('text-gray-400');
    } else {
        reforgePriceLabel.textContent = 'Price';
        reforgePriceLabel.classList.add('text-gray-400');
    }
}

function updateEnchantmentDropdown(selectedItem) {
    const enchantmentSelect = document.getElementById('enchantment-select');
    const addEnchantBtn = document.getElementById('add-enchant-btn');
    const enchantmentsSection = document.getElementById('enchantments-section');
    enchantmentSelect.innerHTML = '';

    const itemCategory = getEnchantmentCategoryFromItem(selectedItem);
    const itemId = selectedItem.id;
    const currentEnchantNames = Array.from(document.querySelectorAll('#enchantments-container .enchant-name, #ultimate-enchantment-container .enchant-name')).map(el => el.textContent);

    const incompatibleSet = new Set();
    currentEnchantNames.forEach(name => {
        const details = regularEnchantments[name] || ultimateEnchantments[name];
        if (details?.incompatible) {
            details.incompatible.forEach(incompatName => incompatibleSet.add(incompatName));
        }
        incompatibleSet.add(name);
    });

    const applicableEnchantments = Object.values(regularEnchantments)
        .filter(enchant => {
            const categoryMatch = enchant.categories.includes(itemCategory);
            const itemMatch = enchant.items.includes(itemId);

            return itemMatch ? itemMatch : categoryMatch;
        })
        .map(enchant => enchant.name)
        .sort();

    if (applicableEnchantments.length === 0) {
        enchantmentsSection.style.display = 'none';
    } else {
        enchantmentSelect.disabled = false;
        addEnchantBtn.disabled = false;
        enchantmentsSection.style.display = 'block';
        applicableEnchantments.forEach(name => {
            const option = new Option(name, name);
            option.disabled = incompatibleSet.has(name);
            enchantmentSelect.appendChild(option);
        });
    }
}

function updateUltimateEnchantmentDropdown(selectedItem) {
    const ultimateSection = document.getElementById('ultimate-enchant-section');
    const ultimateSelect = document.getElementById('ultimate-enchant-select');
    ultimateSelect.innerHTML = '<option value="">None</option>';

    const itemCategory = getEnchantmentCategoryFromItem(selectedItem);
    const itemId = selectedItem.id;

    const applicableUltimates = Object.values(ultimateEnchantments)
        .filter(enchant => {
            const categoryMatch = enchant.categories.includes(itemCategory);
            const itemMatch = enchant.items.includes(itemId);

            return itemMatch ? itemMatch : categoryMatch;
        })
        .map(enchant => enchant.name)
        .sort();

    if (applicableUltimates.length > 0) {
        ultimateSection.style.display = 'block';
        applicableUltimates.forEach(name => {
            ultimateSelect.appendChild(new Option(name, name));
        });
    } else {
        ultimateSection.style.display = 'none';
    }
    document.getElementById('ultimate-enchantment-container').innerHTML = '';
}


function addSelectedEnchantment() {
    const selectElement = document.getElementById('enchantment-select');
    const enchantmentName = selectElement.value;
    const container = document.getElementById('enchantments-container');
    const details = regularEnchantments[enchantmentName];
    if (!details) return;

    const silexSelectedItem = skyblockItems.find(item => item.id === document.getElementById('item-select').value);
    const minLevel = details.minLevel;
    const maxLevel = (!others.silex.categories.includes(silexSelectedItem.category) && enchantmentName === "Efficiency") ? 5 : details.maxLevel;

    const row = document.createElement('div');
    row.className = 'enchant-row flex items-center gap-2 bg-gray-800 p-2 rounded-lg fade-in';
    row.innerHTML = `
        <span class="enchant-name flex-grow font-medium text-gray-300">${enchantmentName}</span>
        <div class="number-input-wrapper">
            <input type="number" class="level-input w-20 p-2 bg-gray-700 border border-gray-600 rounded-md focus-ring text-center" value="${maxLevel}" min="${minLevel}" max="${maxLevel}" title="Level">
            <div class="number-input-buttons">
                <div class="spinner-btn" data-action="increment">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                </div>
                <div class="spinner-btn" data-action="decrement">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                </div>
            </div>
        </div>
        <span class="price-label w-32 p-2 bg-gray-700 border border-gray-600 rounded-md text-center text-gray-400">N/A</span>
        <button class="remove-btn w-8 h-8 flex items-center justify-center bg-red-600 text-white font-bold rounded-md hover:bg-red-700 transition-colors">&times;</button>
    `;
    container.appendChild(row);

    const removeBtn = row.querySelector('.remove-btn');
    removeBtn.onclick = () => {
        row.remove();
        const selectedItem = skyblockItems.find(item => item.id === document.getElementById('item-select').value);
        if (selectedItem) updateEnchantmentDropdown(selectedItem);
    };

    const levelInput = row.querySelector('.level-input');
    const priceLabel = row.querySelector('.price-label');
    const updatePrice = () => {
        const price = getEnchantmentPrice(enchantmentName, levelInput.value);
        if (price !== null) {
            priceLabel.textContent = Math.round(price).toLocaleString();
            priceLabel.classList.remove('text-gray-400');
        } else {
            priceLabel.textContent = 'N/A';
            priceLabel.classList.add('text-gray-400');
        }
    };
    levelInput.addEventListener('change', updatePrice);
    updatePrice();

    const selectedItem = skyblockItems.find(item => item.id === document.getElementById('item-select').value);
    if (selectedItem) updateEnchantmentDropdown(selectedItem);
}

function addOrUpdateUltimateEnchantment() {
    const selectElement = document.getElementById('ultimate-enchant-select');
    const enchantmentName = selectElement.value;
    const container = document.getElementById('ultimate-enchantment-container');

    container.innerHTML = '';

    if (!enchantmentName) {
        const selectedItem = skyblockItems.find(item => item.id === document.getElementById('item-select').value);
        if (selectedItem) updateEnchantmentDropdown(selectedItem);
        return;
    }

    const details = ultimateEnchantments[enchantmentName];
    if (!details) return;

    if (details.incompatible && details.incompatible.length > 0) {
        const incompatibleNames = new Set(details.incompatible);
        const regularEnchantRows = document.querySelectorAll('#enchantments-container .enchant-row');
        regularEnchantRows.forEach(row => {
            const regularEnchantName = row.querySelector('.enchant-name').textContent;
            if (incompatibleNames.has(regularEnchantName)) {
                row.remove();
            }
        });
    }

    const minLevel = details.minLevel;
    const maxLevel = details.maxLevel;

    const row = document.createElement('div');
    row.className = 'enchant-row flex items-center gap-2 bg-gray-800 p-2 rounded-lg fade-in';
    row.innerHTML = `
        <span class="enchant-name flex-grow font-medium text-gray-300">${enchantmentName}</span>
        <div class="number-input-wrapper">
            <input type="number" class="level-input w-20 p-2 bg-gray-700 border border-gray-600 rounded-md focus-ring text-center" value="${maxLevel}" min="${minLevel}" max="${maxLevel}" title="Level">
            <div class="number-input-buttons">
                <div class="spinner-btn" data-action="increment">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                </div>
                <div class="spinner-btn" data-action="decrement">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                </div>
            </div>
        </div>
        <span class="price-label w-32 p-2 bg-gray-700 border border-gray-600 rounded-md text-center text-gray-400">N/A</span>
        <button class="remove-btn w-8 h-8 flex items-center justify-center bg-red-600 text-white font-bold rounded-md hover:bg-red-700 transition-colors">&times;</button>
    `;
    container.appendChild(row);

    const removeBtn = row.querySelector('.remove-btn');
    removeBtn.onclick = () => {
        row.remove();
        selectElement.value = '';
        const selectedItem = skyblockItems.find(item => item.id === document.getElementById('item-select').value);
        if (selectedItem) updateEnchantmentDropdown(selectedItem);
    };

    const levelInput = row.querySelector('.level-input');
    const priceLabel = row.querySelector('.price-label');

    const updatePrice = () => {
        const price = getEnchantmentPrice(enchantmentName, levelInput.value);
        if (price !== null) {
            priceLabel.textContent = Math.round(price).toLocaleString();
            priceLabel.classList.remove('text-gray-400');
        } else {
            priceLabel.textContent = 'N/A';
            priceLabel.classList.add('text-gray-400');
        }
    };

    levelInput.addEventListener('change', updatePrice);
    updatePrice();

    const selectedItem = skyblockItems.find(item => item.id === document.getElementById('item-select').value);
    if (selectedItem) updateEnchantmentDropdown(selectedItem);
}

function updateGemstoneSlots(selectedItem) {
    const container = document.getElementById('gemstones-container');
    const gemstonesSection = document.getElementById('gemstones-section');
    container.innerHTML = '';

    if (selectedItem?.gemstone_slots?.length > 0) {
        gemstonesSection.style.display = 'block';
        selectedItem.gemstone_slots.forEach((slot) => {
            const slotTypeName = slot.slot_type.charAt(0) + slot.slot_type.slice(1).toLowerCase();
            const slotName = `${slotTypeName} Slot`;

            const slotInfo = gemstoneSlotData[slotName];
            if (!slotInfo) return;

            const validGemstones = slotInfo.valid;

            const row = document.createElement('div');
            row.className = 'gemstone-row flex flex-col gap-2 bg-gray-800 p-3 rounded-lg fade-in';

            let gemOptions = '<option value="">None</option>' + validGemstones.map(gem => `<option value="${gem.toUpperCase()}">${gem}</option>`).join('');
            let tierOptions = gemstones.gemstoneTiers.map(tier => `<option value="${tier}">${tier.charAt(0) + tier.slice(1).toLowerCase()}</option>`).join('');

            row.innerHTML = `
                <span class="font-medium text-gray-300">${slotName}</span>
                <div class="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                    <select class="gemstone-type-select sm:col-span-2 w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus-ring">${gemOptions}</select>
                    <select class="gemstone-tier-select sm:col-span-2 w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus-ring" disabled>${tierOptions}</select>
                    <span class="price-label w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-center text-gray-400 truncate">Price</span>
                </div>
            `;
            container.appendChild(row);

            const gemTypeSelect = row.querySelector('.gemstone-type-select');
            const gemTierSelect = row.querySelector('.gemstone-tier-select');
            const priceLabel = row.querySelector('.price-label');

            const updatePrice = () => {
                const isGemSelected = gemTypeSelect.value !== "";
                gemTierSelect.disabled = !isGemSelected;

                if (isGemSelected) {
                    const price = getGemstonePrice(gemTierSelect.value, gemTypeSelect.value);
                    if (price !== null) {
                        priceLabel.textContent = Math.round(price).toLocaleString();
                        priceLabel.classList.remove('text-gray-400');
                    } else {
                        priceLabel.textContent = 'N/A';
                        priceLabel.classList.add('text-gray-400');
                    }
                } else {
                    priceLabel.textContent = 'Price';
                    priceLabel.classList.add('text-gray-400');
                }
            };

            gemTypeSelect.addEventListener('change', updatePrice);
            gemTierSelect.addEventListener('change', updatePrice);
        });
    } else {
        gemstonesSection.style.display = 'none';
    }
}

function calculateTotal() {
    const sumLabels = (selector) => Array.from(document.querySelectorAll(selector)).reduce((sum, label) => {
        const value = parseFloat(label.textContent.replace(/\s/g, '')) || 0;
        return sum + value;
    }, 0);

    const potatoBooksCount = parseFloat(document.getElementById('potato-books').value) || 0;
    const wetBookCount = parseFloat(document.getElementById('wet-book').value) || 0;
    const hotBooksCount = Math.min(potatoBooksCount, 10);
    const fumingBooksCount = Math.max(0, potatoBooksCount - 10);
    const farmingForDummiesCount = parseFloat(document.getElementById('farming-for-dummies').value) || 0;
    const bookwormFavoriteBookCount = parseFloat(document.getElementById('bookworm-favorite-book').value) || 0;
    const polarvoidBookCount = parseFloat(document.getElementById('polarvoid-book').value) || 0;
    const manaDisintegratorCount = parseFloat(document.getElementById('mana-disintegrator').value) || 0;

    const costs = {
        enchantments: sumLabels('#enchantments-container .price-label'),
        ultimate: sumLabels('#ultimate-enchantment-container .price-label'),
        gemstones: sumLabels('#gemstones-container .price-label'),
        reforge: parseFloat(document.getElementById('reforge-price').textContent.replace(/\s/g, '')) || 0,
        recomb: document.getElementById('recomb-checkbox').checked ? recombPrice : 0,
        artOfWar: document.getElementById('art-of-war-checkbox').checked ? artOfWarPrice : 0,
        divanPowderCoating: document.getElementById('divan-powder-coating-checkbox').checked ? divanPowderCoatingPrice : 0,
        artOfPeace: document.getElementById('art-of-peace-checkbox').checked ? artOfPeacePrice : 0,
        woodSingularity: document.getElementById('wood-singularity-checkbox').checked ? woodSingularityPrice : 0,
        farmingForDummies: (farmingForDummiesCount * farmingForDummiesPrice),
        bookwormFavoriteBook: (bookwormFavoriteBookCount * bookwormFavoriteBookPrice),
        polarvoidBook: (polarvoidBookCount * polarvoidBookPrice),
        manaDisintegrator: (manaDisintegratorCount * manaDisintegratorPrice),
        bookOfStats: document.getElementById('book-of-stats-checkbox').checked ? bookOfStatsPrice : 0,
        potatoBooks: (hotBooksCount * hotPotatoBookPrice) + (fumingBooksCount * fumingPotatoBookPrice),
        wetBook: (wetBookCount * wetBookPrice),
    };

    costs.total = Object.values(costs).reduce((sum, cost) => sum + cost, 0);

    displayResults(costs);
}

function displayResults(costs) {
    const resultsDiv = document.getElementById('results-container');
    const itemSelect = document.getElementById('item-select');
    const itemName = itemSelect.options[itemSelect.selectedIndex].textContent;

    const format = (n) => n.toLocaleString('en-US');

    const costCategories = [{
        key: 'enchantments',
        label: 'Enchantments',
        color: 'text-purple-300'
    }, {
        key: 'ultimate',
        label: 'Ultimate Enchantment',
        color: 'text-purple-300'
    }, {
        key: 'gemstones',
        label: 'Gemstones',
        color: 'text-teal-300'
    }, {
        key: 'reforge',
        label: 'Reforge',
        color: 'text-yellow-300'
    }, {
        key: 'recomb',
        label: 'Recombobulator',
        color: 'text-yellow-300'
    }, {
        key: 'artOfWar',
        label: 'The Art of War',
        color: 'text-yellow-300'
    }, {
        key: 'artOfPeace',
        label: 'The Art of Peace',
        color: 'text-yellow-300'
    }, {
        key: 'woodSingularity',
        label: 'Wood Singularity',
        color: 'text-yellow-300'
    }, {
        key: 'divanPowderCoating',
        label: "Divan's Powder Coating",
        color: 'text-yellow-300'
    }, {
        key: 'farmingForDummies',
        label: 'Farming for Dummies',
        color: 'text-yellow-300'
    }, {
        key: 'bookwormFavoriteBook',
        label: "Bookworm's Favorite Book",
        color: 'text-yellow-300'
    }, {
        key: 'polarvoidBook',
        label: 'Polarvoid Book',
        color: 'text-yellow-300'
    }, {
        key: 'manaDisintegrator',
        label: 'Mana Disintegrator',
        color: 'text-yellow-300'
    }, {
        key: 'bookOfStats',
        label: 'Book of Stats',
        color: 'text-yellow-300'
    }, {
        key: 'potatoBooks',
        label: 'Potato Books',
        color: 'text-yellow-300'
    }, {
        key: 'wetBook',
        label: 'Wet Books',
        color: 'text-yellow-300'
    }];

    let costDetailsHTML = costCategories
        .map(cat => {
            if (costs[cat.key] > 0) {
                return `<div class="flex justify-between items-center"><span class="${cat.color}">${cat.label}:</span><span class="font-semibold">${format(costs[cat.key])} coins</span></div>`;
            }
            return '';
        })
        .join('');


    if (costDetailsHTML.trim() === '') {
        costDetailsHTML = costs.total > 0 ?
            `<p class="text-center text-gray-400">No specific upgrade costs were entered, but a total was calculated.</p>` :
            '<p class="text-center text-gray-400">No upgrade costs were entered.</p>';
    }

    resultsDiv.innerHTML = `
        <div class="bg-gray-800/70 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 fade-in">
            <h3 class="text-2xl font-bold text-center mb-6">Cost Summary for <span class="text-blue-400">${itemName}</span></h3>
            <div class="space-y-3 text-lg">
                ${costDetailsHTML}
            </div>
            <hr class="border-gray-600 my-6">
            <div class="text-center">
                <p class="text-gray-400 text-xl">Total Added Cost</p>
                <p class="text-4xl font-bold text-green-400 mt-1">${format(costs.total)} coins</p>
            </div>
        </div>
    `;
    resultsDiv.classList.remove('hidden');
    resultsDiv.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });
}