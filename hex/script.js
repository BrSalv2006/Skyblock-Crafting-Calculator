let regularEnchantments = {};
let ultimateEnchantments = {};
let skyblockItems = [];
let bazaarPrices = {};
let auctionPrices = {};
let gemstoneSlotData = {};
let reforges = {};
let others = {};
let gemstones = {};
let rightClickAbilityCache = {};
let recombPrice = 0;
let artOfWarPrice = 0;
let artOfPeacePrice = 0;
let jalapenoBookPrice = 0;
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
let necronScrollPrices = {
    implosion: 0,
    witherShield: 0,
    shadowWarp: 0
};
let powerScrollPrices = {
    ruby: 0,
    sapphire: 0,
    jasper: 0,
    amethyst: 0,
    amber: 0,
    opal: 0
};
let enrichmentPrices = {
    critical_chance: 0,
    speed: 0,
    intelligence: 0,
    critical_damage: 0,
    strength: 0,
    defense: 0,
    health: 0,
    magic_find: 0,
    ferocity: 0,
    sea_creature_chance: 0,
    attack_speed: 0
};


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
        loadBazaarPrices(),
        loadAuctionPrices()
    ]).catch(error => {
        console.error("Initialization failed:", error);
        itemSelect.innerHTML = '<option value="">Failed to load data</option>';
    });

    // After loading all prices, update the static price displays
    updateStaticPrices();

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

    document.getElementById('power-scroll-select').addEventListener('change', updatePowerScrollPrice);
    document.getElementById('enrichment-select').addEventListener('change', updateEnrichmentPrice);
    document.getElementById('recomb-checkbox').addEventListener('change', updateEnrichmentSectionVisibility);


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

        skyblockItems.sort((a, b) => stripMinecraftFormat(a.name).localeCompare(stripMinecraftFormat(b.name)));

        itemSelect.innerHTML = '<option value="">Select an item...</option>';
        skyblockItems.forEach(item => {
            const option = new Option(stripMinecraftFormat(item.name), item.id);
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
    } catch (error) {
        console.error("Could not load bazaar prices:", error);
    }
}

async function loadAuctionPrices() {
    try {
        const auctionData = await fetchWithProxy('https://hysky.de/api/auctions');
        auctionData.forEach(item => {
            if (item.id && item.auction && item.auction.price) {
                auctionPrices[item.id] = item;
            }
        });
    } catch (error) {
        console.error("Could not load auction prices:", error);
    }
}

function getItemPrice(internalName) {
    if (bazaarPrices[internalName] && bazaarPrices[internalName].buyPrice != null) {
        return Math.round(bazaarPrices[internalName].buyPrice);
    }
    if (auctionPrices[internalName] && auctionPrices[internalName].auction && auctionPrices[internalName].auction.price != null) {
        return Math.round(auctionPrices[internalName].auction.price);
    }
    return 0;
}

function updateStaticPrices() {
    recombPrice = getItemPrice(others.recombobulator.internalName);
    document.getElementById('recomb-price-display').textContent = `${recombPrice.toLocaleString()} coins`;

    artOfWarPrice = getItemPrice(others.artOfWar.internalName);
    document.getElementById('art-of-war-price-display').textContent = `${artOfWarPrice.toLocaleString()} coins`;

    jalapenoBookPrice = getItemPrice(others.jalapenoBook.internalName);
    document.getElementById('jalapeno-book-price-display').textContent = `${jalapenoBookPrice.toLocaleString()} coins`;

    divanPowderCoatingPrice = getItemPrice(others.divanPowderCoating.internalName);
    document.getElementById('divan-powder-coating-price-display').textContent = `${divanPowderCoatingPrice.toLocaleString()} coins`;

    artOfPeacePrice = getItemPrice(others.artOfPeace.internalName);
    document.getElementById('art-of-peace-price-display').textContent = `${artOfPeacePrice.toLocaleString()} coins`;

    woodSingularityPrice = getItemPrice(others.woodSingularity.internalName);
    document.getElementById('wood-singularity-price-display').textContent = `${woodSingularityPrice.toLocaleString()} coins`;

    farmingForDummiesPrice = getItemPrice(others.farmingForDummies.internalName);
    bookwormFavoriteBookPrice = getItemPrice(others.bookwormBook.internalName);
    polarvoidBookPrice = getItemPrice(others.polarvoidBook.internalName);
    manaDisintegratorPrice = getItemPrice(others.manaDisintegrator.internalName);

    bookOfStatsPrice = getItemPrice(others.bookOfStats.internalName);
    document.getElementById('book-of-stats-price-display').textContent = `${bookOfStatsPrice.toLocaleString()} coins`;

    hotPotatoBookPrice = getItemPrice(others.potatoBooks.internalName.hotPotatoBook);
    fumingPotatoBookPrice = getItemPrice(others.potatoBooks.internalName.fumingPotatoBook);
    wetBookPrice = getItemPrice(others.wetBook.internalName);

    necronScrollPrices.implosion = getItemPrice(others.necronScrolls.internalNames.implosion);
    document.getElementById('implosion-scroll-price-display').textContent = `${necronScrollPrices.implosion.toLocaleString()} coins`;

    necronScrollPrices.witherShield = getItemPrice(others.necronScrolls.internalNames.witherShield);
    document.getElementById('wither-shield-scroll-price-display').textContent = `${necronScrollPrices.witherShield.toLocaleString()} coins`;

    necronScrollPrices.shadowWarp = getItemPrice(others.necronScrolls.internalNames.shadowWarp);
    document.getElementById('shadow-warp-scroll-price-display').textContent = `${necronScrollPrices.shadowWarp.toLocaleString()} coins`;

    for (const [scroll, internalName] of Object.entries(others.powerScrolls.internalNames)) {
        powerScrollPrices[scroll] = getItemPrice(internalName);
    }

    if (others.enrichments) {
        for (const [enrichment, internalName] of Object.entries(others.enrichments.internalNames)) {
            enrichmentPrices[enrichment] = getItemPrice(internalName);
        }
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
        const silexPrice = getItemPrice(others.silex.internalName);
        return silexPrice * (level - 5);
    }
    if (name === "Bane of Arthropods" && level == 7) {
        const snailPrice = getItemPrice(`ENSNARED_SNAIL`);
        const bookPrice = getItemPrice(`${details.id}6`);
        return bookPrice + snailPrice;
    }
    if (name === "Charm" && level == 6) {
        const chainPrice = getItemPrice(`CHAIN_END_TIMES`);
        const bookPrice = getItemPrice(`${details.id}5`);
        return bookPrice + chainPrice;
    }
    if (name === "Frail" && level == 7) {
        const pincerPrice = getItemPrice(`SEVERED_PINCER`);
        const bookPrice = getItemPrice(`${details.id}6`);
        return bookPrice + pincerPrice;
    }
    if (name === "Luck of the Sea" && level == 7) {
        const capPrice = getItemPrice(`GOLD_BOTTLE_CAP`);
        const bookPrice = getItemPrice(`${details.id}6`);
        return bookPrice + capPrice;
    }
    if (name === "Piscary" && level == 7) {
        const bubblePrice = getItemPrice(`TROUBLED_BUBBLE`);
        const bookPrice = getItemPrice(`${details.id}6`);
        return bookPrice + bubblePrice;
    }
    if (name === "Pesterminator" && level == 6) {
        const guidePrice = getItemPrice(`PESTHUNTING_GUIDE`);
        const bookPrice = getItemPrice(`${details.id}5`);
        return bookPrice + guidePrice;
    }
    if (name === "Scavenger" && level == 6) {
        const bountyPrice = getItemPrice(`GOLDEN_BOUNTY`);
        const bookPrice = getItemPrice(`${details.id}5`);
        return bookPrice + bountyPrice;
    }
    if (name === "Spiked Hook" && level == 7) {
        const tendrilPrice = getItemPrice(`OCTOPUS_TENDRIL`);
        const bookPrice = getItemPrice(`${details.id}6`);
        return bookPrice + tendrilPrice;
    }

    const price = getItemPrice(`${details.id}${level}`);
    return price !== 0 ? price : null;
}

function getGemstonePrice(tier, gemstoneName) {
    const price = getItemPrice(`${tier}_${gemstoneName}_GEM`);
    return price !== 0 ? price : null;
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

async function itemHasRightClickAbility(itemInternalName) {
    if (rightClickAbilityCache[itemInternalName] !== undefined) {
        return rightClickAbilityCache[itemInternalName];
    }

    try {
        const url = `https://raw.githubusercontent.com/NotEnoughUpdates/NotEnoughUpdates-REPO/refs/heads/master/items/${itemInternalName}.json`;
        const data = await fetchWithProxy(url);

        if (data && data.lore) {
            const hasAbility = data.lore.some(line => line.includes("RIGHT CLICK"));
            rightClickAbilityCache[itemInternalName] = hasAbility;
            return hasAbility;
        }

        rightClickAbilityCache[itemInternalName] = false;
        return false;
    } catch (error) {
        rightClickAbilityCache[itemInternalName] = false;
        return false;
    }
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
            } else if (input.tagName === 'SELECT') {
                input.value = '';
            }
        }
    }
}

async function updateItemDetails() {
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
            sectionId: 'jalapeno-book-section',
            inputId: 'jalapeno-book-checkbox',
            upgradeKey: 'jalapenoBook'
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
        }, {
            sectionId: 'necron-scrolls-section',
            inputId: null,
            upgradeKey: 'necronScrolls'
        }];

        upgradeConfigs.forEach(config => {
            toggleUpgradeSection({
                ...config,
                itemCategory,
                itemId,
                itemMaterial
            });
        });

        const hasAbility = await itemHasRightClickAbility(itemId);
        const powerScrollSection = document.getElementById('power-scroll-section');
        const powerScrollsData = others.powerScrolls;
        const isEligibleByCategory = powerScrollsData.categories.includes(itemCategory);
        const isEligibleByItem = powerScrollsData.items.includes(itemId);

        if (hasAbility || isEligibleByCategory || isEligibleByItem) {
            powerScrollSection.style.display = 'block';
        } else {
            powerScrollSection.style.display = 'none';
            document.getElementById('power-scroll-select').value = '';
        }

        updatePowerScrollPrice();
        updateEnrichmentSectionVisibility();


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
        const reforgePrice = getItemPrice(reforge.internalName);
        const rarity = selectedItem.tier || 'COMMON';
        const reforgeCost = reforge.reforgeCosts[rarity] ? reforge.reforgeCosts[rarity] : 0;

        reforgePriceLabel.textContent = (reforgeCost + reforgePrice).toLocaleString();
        reforgePriceLabel.classList.remove('text-gray-400');
    } else {
        reforgePriceLabel.textContent = 'Price';
        reforgePriceLabel.classList.add('text-gray-400');
    }
}

function updatePowerScrollPrice() {
    const select = document.getElementById('power-scroll-select');
    const priceLabel = document.getElementById('power-scroll-price');
    const selectedScroll = select.value;

    if (selectedScroll && powerScrollPrices[selectedScroll]) {
        priceLabel.textContent = powerScrollPrices[selectedScroll].toLocaleString() + ' coins';
        priceLabel.classList.remove('text-gray-400');
    } else {
        priceLabel.textContent = 'Price';
        priceLabel.classList.add('text-gray-400');
    }
}

function updateEnrichmentSectionVisibility() {
    const selectedItemId = document.getElementById('item-select').value;
    if (!selectedItemId) return;
    const selectedItem = skyblockItems.find(item => item.id === selectedItemId);
    if (!selectedItem) return;

    const enrichmentSection = document.getElementById('enrichment-section');
    if (!enrichmentSection || !others.enrichments) return;

    const itemCategory = getEnchantmentCategoryFromItem(selectedItem);
    const itemRarity = selectedItem.tier;
    const itemId = selectedItem.id;
    const isRecombed = document.getElementById('recomb-checkbox').checked;
    const enrichmentData = others.enrichments;

    const isNativelyApplicable = enrichmentData.rarities.includes(itemRarity);
    const isEpicAndRecombed = itemRarity === 'EPIC' && isRecombed;

    const isApplicableForEnrichment =
        enrichmentData.categories.includes(itemCategory) &&
        (isNativelyApplicable || isEpicAndRecombed) &&
        itemId !== 'HOCUS_POCUS_CIPHER';

    if (isApplicableForEnrichment) {
        enrichmentSection.style.display = 'block';
    } else {
        enrichmentSection.style.display = 'none';
        document.getElementById('enrichment-select').value = '';
    }
    updateEnrichmentPrice();
}

function updateEnrichmentPrice() {
    const select = document.getElementById('enrichment-select');
    const priceLabel = document.getElementById('enrichment-price');
    const selectedEnrichment = select.value;

    if (selectedEnrichment && enrichmentPrices[selectedEnrichment]) {
        priceLabel.textContent = enrichmentPrices[selectedEnrichment].toLocaleString() + ' coins';
        priceLabel.classList.remove('text-gray-400');
    } else {
        priceLabel.textContent = 'Price';
        priceLabel.classList.add('text-gray-400');
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

function preprocessCustomFormats(text) {
    if (!text) return text;
    const customFormatMap = {
        'black': '0', 'dark_blue': '1', 'dark_green': '2', 'dark_aqua': '3',
        'dark_red': '4', 'dark_purple': '5', 'gold': '6', 'gray': '7',
        'dark_gray': '8', 'blue': '9', 'green': 'a', 'aqua': 'b',
        'red': 'c', 'light_purple': 'd', 'yellow': 'e', 'white': 'f',
        'obfuscated': 'k', 'bold': 'l', 'strikethrough': 'm', 'underline': 'n',
        'italic': 'o', 'reset': 'r'
    };

    return text.replace(/%%([a-z_]+)%%/g, (match, formatName) => {
        const code = customFormatMap[formatName.toLowerCase()];
        return code ? `§${code}` : '';
    });
}

function stripMinecraftFormat(text) {
    if (!text) return '';
    const preprocessedText = preprocessCustomFormats(text);
    return preprocessedText.replace(/§[0-9a-fk-or]/g, '');
}

function minecraftColorToHtml(text) {
    if (!text) return '';

    const preprocessedText = preprocessCustomFormats(text);

    const colorMap = {
        '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
        '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
        '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
        'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF'
    };

    let html = '';
    const sections = preprocessedText.split('§');

    let remainingText = sections.shift() || '';

    const activeFormats = {
        color: null,
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false
    };

    function applyFormatting() {
        if (remainingText.length === 0) return;

        const styles = [];
        if (activeFormats.color) styles.push(`color: ${activeFormats.color}`);
        if (activeFormats.bold) styles.push('font-weight: bold');
        if (activeFormats.italic) styles.push('font-style: italic');

        let textDecoration = [];
        if (activeFormats.underline) textDecoration.push('underline');
        if (activeFormats.strikethrough) textDecoration.push('line-through');
        if (textDecoration.length > 0) styles.push(`text-decoration: ${textDecoration.join(' ')}`);

        if (styles.length > 0) {
            html += `<span style="${styles.join('; ')}">${remainingText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
        } else {
            html += remainingText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
    }

    for (const section of sections) {
        if (section.length === 0) continue;

        applyFormatting();

        const formatCode = section[0];
        remainingText = section.substring(1);

        if (colorMap[formatCode]) {
            activeFormats.color = colorMap[formatCode];
            activeFormats.bold = false;
            activeFormats.italic = false;
            activeFormats.underline = false;
            activeFormats.strikethrough = false;
        } else {
            switch (formatCode) {
                case 'l': activeFormats.bold = true; break;
                case 'o': activeFormats.italic = true; break;
                case 'n': activeFormats.underline = true; break;
                case 'm': activeFormats.strikethrough = true; break;
                case 'r':
                    activeFormats.color = null;
                    activeFormats.bold = false;
                    activeFormats.italic = false;
                    activeFormats.underline = false;
                    activeFormats.strikethrough = false;
                    break;
            }
        }
    }

    applyFormatting();

    return html;
}

function calculateTotal() {
    const sumLabels = (selector) => Array.from(document.querySelectorAll(selector)).reduce((sum, label) => {
        const value = parseFloat(label.textContent.replace(/,/g, '')) || 0;
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
    const selectedScroll = document.getElementById('power-scroll-select').value;
    const selectedEnrichment = document.getElementById('enrichment-select').value;


    const costs = {
        enchantments: sumLabels('#enchantments-container .price-label'),
        ultimate: sumLabels('#ultimate-enchantment-container .price-label'),
        gemstones: sumLabels('#gemstones-container .price-label'),
        reforge: parseFloat(document.getElementById('reforge-price').textContent.replace(/,/g, '')) || 0,
        recomb: document.getElementById('recomb-checkbox').checked ? recombPrice : 0,
        artOfWar: document.getElementById('art-of-war-checkbox').checked ? artOfWarPrice : 0,
        jalapenoBook: document.getElementById('jalapeno-book-checkbox').checked ? jalapenoBookPrice : 0,
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
        necronScrolls: 0,
        powerScroll: selectedScroll ? (powerScrollPrices[selectedScroll] || 0) : 0,
        enrichment: selectedEnrichment ? (enrichmentPrices[selectedEnrichment] || 0) : 0,
    };

    if (document.getElementById('implosion-scroll-checkbox').checked) {
        costs.necronScrolls += necronScrollPrices.implosion;
    }
    if (document.getElementById('wither-shield-scroll-checkbox').checked) {
        costs.necronScrolls += necronScrollPrices.witherShield;
    }
    if (document.getElementById('shadow-warp-scroll-checkbox').checked) {
        costs.necronScrolls += necronScrollPrices.shadowWarp;
    }

    costs.total = Object.values(costs).reduce((sum, cost) => sum + cost, 0);

    const selectedItemId = document.getElementById('item-select').value;
    const selectedItem = skyblockItems.find(item => item.id === selectedItemId);
    const rawItemName = selectedItem ? selectedItem.name : 'Selected Item';

    displayResults(costs, rawItemName);
}

function displayResults(costs, rawItemName) {
    const resultsDiv = document.getElementById('results-container');
    const itemNameHtml = minecraftColorToHtml(rawItemName);

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
        key: 'necronScrolls',
        label: "Necron's Blade Scrolls",
        color: 'text-yellow-300'
    }, {
        key: 'gemstones',
        label: 'Gemstones',
        color: 'text-teal-300'
    }, {
        key: 'reforge',
        label: 'Reforge',
        color: 'text-yellow-300'
    }, {
        key: 'powerScroll',
        label: 'Power Scroll',
        color: 'text-yellow-300'
    }, {
        key: 'enrichment',
        label: 'Enrichment',
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
        key: 'jalapenoBook',
        label: 'Jalapeno Book',
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
                return `<div class="flex justify-between items-center"><span class="${cat.color}">${cat.label}:</span><span class="font-semibold">${format(Math.round(costs[cat.key]))} coins</span></div>`;
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
            <h3 class="text-2xl font-bold text-center mb-6">Cost Summary for <span class="text-blue-400">${itemNameHtml}</span></h3>
            <div class="space-y-3 text-lg">
                ${costDetailsHTML}
            </div>
            <hr class="border-gray-600 my-6">
            <div class="text-center">
                <p class="text-gray-400 text-xl">Total Added Cost</p>
                <p class="text-4xl font-bold text-green-400 mt-1">${format(Math.round(costs.total))} coins</p>
            </div>
        </div>
    `;
    resultsDiv.classList.remove('hidden');
    resultsDiv.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });
}