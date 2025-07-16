const itemNameInput = document.getElementById('itemName');
const itemQuantityInput = document.getElementById('itemQuantity');
const calculateBtn = document.getElementById('calculateBtn');
const resultsDiv = document.getElementById('results');
const loadingSpinner = document.getElementById('loadingSpinner');
const craftTreeDisplay = document.getElementById('craftTreeDisplay');
const craftTreeContent = document.getElementById('craftTreeContent');
const initialMessage = document.getElementById('initialMessage');
const autocompleteList = document.getElementById('autocomplete-list');

const saveStateBtn = document.getElementById('saveStateBtn');
const loadStateBtn = document.getElementById('loadStateBtn');
const loadFileInput = document.getElementById('loadFileInput');

const RECIPES_BASE_URL = 'https://raw.githubusercontent.com/NotEnoughUpdates/NotEnoughUpdates-REPO/master/items/';
const DISPLAY_NAME_LOOKUP_FILE = './skyblock_displayname_map.json';
const PACK_SIZE = 64;

let DISPLAY_NAME_LOOKUP = {};
let ORIGINAL_DISPLAY_NAMES_BY_INTERNAL_NAME = {};
let currentCraftTreeRoot = null;
let nodeMap = new Map();
let frozenNodeId = null;
let currentAutocompleteIndex = -1;

function normalizeInternalName(name) {
    return name.toUpperCase().trim();
}

function cleanDisplayName(name) {
    return name ? name.replace(/§[0-9a-fklmnor]/g, '').trim() : '';
}

async function loadDisplayNameLookup() {
    try {
        initialMessage.textContent = 'Fetching item name lookup data...';
        const response = await fetch(DISPLAY_NAME_LOOKUP_FILE);
        if (!response.ok) {
            throw new Error(`Failed to load display name lookup file: ${response.status} ${response.statusText}`);
        }
        const rawLookup = await response.json();

        for (const displayName in rawLookup) {
            const internalName = rawLookup[displayName];
            const cleanedLowerDisplayName = cleanDisplayName(displayName).toLowerCase();
            DISPLAY_NAME_LOOKUP[cleanedLowerDisplayName] = internalName;
            ORIGINAL_DISPLAY_NAMES_BY_INTERNAL_NAME[internalName] = cleanDisplayName(displayName);
        }

        initialMessage.textContent = 'Item data loaded. Enter an item to calculate.';
        calculateBtn.disabled = false;
    } catch (error) {
        console.error(`Error loading display name lookup: ${error.message}`);
        initialMessage.innerHTML = `<span class="error-message">Error loading item data: ${error.message}. Display name search may not work.</span>`;
        calculateBtn.disabled = false;
    }
}

loadDisplayNameLookup();

async function fetchRecipe(internalName) {
    if (normalizeInternalName(internalName) === "SKYBLOCK_COIN") {
        return {
            output: "Skyblock Coins",
            ingredients: [],
            internalname: "SKYBLOCK_COIN",
            count: 1,
            isVanilla: true
        };
    }

    const url = `${RECIPES_BASE_URL}${normalizeInternalName(internalName)}.json`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            const displayOutput = ORIGINAL_DISPLAY_NAMES_BY_INTERNAL_NAME[normalizeInternalName(internalName)] || cleanDisplayName(internalName);
            return { output: displayOutput, ingredients: [], internalname: normalizeInternalName(internalName), count: 1, isVanilla: false };
        }

        const recipeRecord = await response.json();

        if (!recipeRecord || typeof recipeRecord.internalname !== 'string') {
            throw new Error(`Invalid recipe data for ${internalName}`);
        }

        const isVanillaItem = recipeRecord.vanilla === true;

        if (isVanillaItem) {
            const displayOutput = ORIGINAL_DISPLAY_NAMES_BY_INTERNAL_NAME[recipeRecord.internalname] || cleanDisplayName(recipeRecord.displayname || internalName);
            return {
                output: displayOutput,
                ingredients: [],
                internalname: recipeRecord.internalname,
                count: 1,
                isVanilla: true
            };
        }

        const ingredientsMap = {};
        let outputCount = 1;

        if (recipeRecord.recipes && Array.isArray(recipeRecord.recipes) && recipeRecord.recipes.length > 0) {
            for (const primaryRecipe of recipeRecord.recipes) {
                if (primaryRecipe) {
                    if (primaryRecipe.inputs && Array.isArray(primaryRecipe.inputs)) {
                        primaryRecipe.inputs.forEach(inputString => {
                            const [ingInternalName, quantityStr] = inputString.split(':');
                            const quantity = parseInt(quantityStr, 10);
                            if (ingInternalName && !isNaN(quantity) && quantity > 0) {
                                ingredientsMap[ingInternalName] = (ingredientsMap[ingInternalName] || 0) + quantity;
                            }
                        });
                        outputCount = primaryRecipe.count || 1;
                        break;
                    } else if (primaryRecipe.A1 !== undefined || primaryRecipe.A2 !== undefined || primaryRecipe.A3 !== undefined ||
                        primaryRecipe.B1 !== undefined || primaryRecipe.B2 !== undefined || primaryRecipe.B3 !== undefined ||
                        primaryRecipe.C1 !== undefined || primaryRecipe.C2 !== undefined || primaryRecipe.C3 !== undefined) {
                        const gridSlots = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];
                        gridSlots.forEach(slot => {
                            const ingredientString = primaryRecipe[slot];
                            if (ingredientString) {
                                const [ingInternalName, quantityStr] = ingredientString.split(':');
                                const quantity = parseInt(quantityStr, 10);
                                if (ingInternalName && !isNaN(quantity) && quantity > 0) {
                                    ingredientsMap[ingInternalName] = (ingredientsMap[ingInternalName] || 0) + quantity;
                                }
                            }
                        });
                        outputCount = primaryRecipe.count || 1;
                        break;
                    }
                }
            }
        } else if (recipeRecord.recipe && Object.keys(recipeRecord.recipe).length > 0) {
            for (const slot in recipeRecord.recipe) {
                const ingredientString = recipeRecord.recipe[slot];
                if (ingredientString) {
                    const [ingInternalName, quantityStr] = ingredientString.split(':');
                    const quantity = parseInt(quantityStr, 10);
                    if (ingInternalName && !isNaN(quantity) && quantity > 0) {
                        ingredientsMap[ingInternalName] = (ingredientsMap[ingInternalName] || 0) + quantity;
                    }
                }
            }
            outputCount = 1;
        }

        const ingredientsArray = Object.entries(ingredientsMap).map(([ingInternalName, quantity]) => {
            const display = ORIGINAL_DISPLAY_NAMES_BY_INTERNAL_NAME[normalizeInternalName(ingInternalName)] || cleanDisplayName(ingInternalName);
            return { name: display, internalName: ingInternalName, quantity: quantity };
        });

        const displayOutput = ORIGINAL_DISPLAY_NAMES_BY_INTERNAL_NAME[recipeRecord.internalname] || cleanDisplayName(recipeRecord.displayname || internalName);

        return {
            output: displayOutput,
            ingredients: ingredientsArray,
            internalname: recipeRecord.internalname,
            count: outputCount,
            isVanilla: false
        };

    } catch (error) {
        console.error(`Error fetching recipe for ${internalName}:`, error);
        const displayOutput = ORIGINAL_DISPLAY_NAMES_BY_INTERNAL_NAME[normalizeInternalName(internalName)] || cleanDisplayName(internalName);
        return { output: displayOutput, ingredients: [], internalname: internalName, count: 1, isVanilla: false };
    }
}

async function buildCraftTree(itemInternalName, quantityNeeded, parentId = null) {
    const recipeInfo = await fetchRecipe(itemInternalName);
    const nodeId = crypto.randomUUID();
    const node = {
        name: recipeInfo.output,
        internalName: recipeInfo.internalname,
        quantityNeeded: quantityNeeded,
        quantityProducedPerCraft: 1,
        numCraftsRequired: quantityNeeded,
        ingredients: [],
        children: [],
        nodeId: nodeId,
        parentId: parentId,
        completed: false,
        isCollapsed: false,
        currentQuantity: 0,
        packsQuantity: 0
    };
    nodeMap.set(nodeId, node);

    if (recipeInfo.ingredients.length === 0) {
        return node;
    }

    const numCrafts = Math.ceil(quantityNeeded / recipeInfo.count);
    node.quantityProducedPerCraft = recipeInfo.count;
    node.numCraftsRequired = numCrafts;
    node.ingredients = recipeInfo.ingredients;

    for (const ingredient of recipeInfo.ingredients) {
        const childNode = await buildCraftTree(ingredient.internalName, ingredient.quantity * numCrafts, node.nodeId);
        node.children.push(childNode);
    }

    return node;
}

function calculateNetRequiredResources(node, quantityRequiredForNode) {
    const netNeededMap = new Map();

    function traverseAndCalculate(currentNode, currentQuantityRequired) {
        if (currentNode.completed) {
            return;
        }

        const totalHave = currentNode.currentQuantity + (currentNode.packsQuantity * PACK_SIZE);
        const netOutputNeeded = Math.max(0, currentQuantityRequired - totalHave);

        if (netOutputNeeded <= 0) {
            return;
        }

        if (currentNode.ingredients.length === 0) {
            netNeededMap.set(currentNode.name, (netNeededMap.get(currentNode.name) || 0) + netOutputNeeded);
            return;
        }

        const numCraftsRequired = Math.ceil(netOutputNeeded / currentNode.quantityProducedPerCraft);

        for (const ingredient of currentNode.ingredients) {
            const quantityForChild = ingredient.quantity * numCraftsRequired;
            const childNode = currentNode.children.find(child => child.internalName === ingredient.internalName);
            if (childNode) {
                traverseAndCalculate(childNode, quantityForChild);
            } else {
                netNeededMap.set(ingredient.name, (netNeededMap.get(ingredient.name) || 0) + quantityForChild);
            }
        }
    }

    traverseAndCalculate(node, quantityRequiredForNode);
    return netNeededMap;
}

function renderCraftTree(node, level = 0) {
    let html = `<li data-node-id="${node.nodeId}">`;
    let uniqueId = `tree-node-${node.nodeId}`;
    const isCompletedClass = node.completed ? 'completed-item' : '';

    html += `<div class="craft-step-header ${isCompletedClass}">`;
    html += `<input type="checkbox" class="craft-checkbox" data-node-id="${node.nodeId}" ${node.completed ? 'checked' : ''}>`;
    if (node.children && node.children.length > 0) {
        html += `<span class="toggle-arrow" data-target-id="${uniqueId}">${node.isCollapsed ? '►' : '▼'}</span> `;
    } else {
        html += `<span class="toggle-arrow" style="visibility: hidden;">►</span> `;
    }
    html += `<div class="main-content-flex">`;
    html += `<div class="item-text-content">`;
    html += `<span class="craft-step">${node.name}</span>`;
    html += `<span class="craft-step-details"> (Need: ${node.quantityNeeded.toLocaleString()}`;

    if (node.ingredients.length > 0) {
        html += `, Crafts: ${node.numCraftsRequired.toLocaleString()}`;
        html += `, Yield: ${node.quantityProducedPerCraft.toLocaleString()} per craft)`;
    } else {
        html += `)`;
    }
    html += `</span>`;
    html += `</div>`;
    html += `<div class="quantity-inputs-row">`;
    html += `<input type="number" class="current-quantity-input" id="have-${node.nodeId}" min="0" value="${node.currentQuantity}" data-node-id="${node.nodeId}" ${node.completed ? 'disabled' : ''}>`;
    html += `<input type="number" class="packs-quantity-input" id="packs-${node.nodeId}" min="0" value="${node.packsQuantity}" data-node-id="${node.nodeId}" ${node.completed ? 'disabled' : ''}>`;
    html += `</div>`;
    html += `</div>`;
    html += `</div>`;

    if (node.children && node.children.length > 0) {
        html += `<ul id="${uniqueId}" style="display: ${node.isCollapsed ? 'none' : 'block'};">`;
        for (const child of node.children) {
            html += renderCraftTree(child, level + 1);
        }
        html += `</ul>`;
    }
    html += `</li>`;

    return html;
}

function recalculateAndRenderResources() {
    resultsDiv.innerHTML = '';
    const totalResources = {};
    let targetNode = currentCraftTreeRoot;
    let targetQuantity = currentCraftTreeRoot ? currentCraftTreeRoot.quantityNeeded : 0;

    if (frozenNodeId && nodeMap.has(frozenNodeId)) {
        targetNode = nodeMap.get(frozenNodeId);
        targetQuantity = targetNode.quantityNeeded;
    }

    if (targetNode) {
        const netNeededMap = calculateNetRequiredResources(targetNode, targetQuantity);
        netNeededMap.forEach((quantity, resourceName) => {
            totalResources[resourceName] = quantity;
        });
    }

    if (Object.keys(totalResources).length === 0) {
        resultsDiv.innerHTML = '<p class="text-gray-400">No base resources found (all items might be marked as completed or you have enough).</p>';
    } else {
        const header = document.createElement('div');
        header.classList.add('results-header');
        header.innerHTML = `
            <span class="item-name-header">Resource</span>
            <div class="quantity-headers">
                <span class="item-quantity-header">Quantity</span>
                <span class="complete-buy-order-header">Complete Buy Orders</span>
                <span class="rest-buy-order-header">Rest Buy Order</span>
            </div>
        `;
        resultsDiv.appendChild(header);

        const ul = document.createElement('ul');
        const BUY_ORDER_MAX = 71680;

        Object.entries(totalResources).sort(([nameA], [nameB]) => nameA.localeCompare(nameB)).forEach(([resourceName, quantity]) => {
            const completeBuyOrders = Math.floor(quantity / BUY_ORDER_MAX);
            const restBuyOrders = Math.floor(quantity % BUY_ORDER_MAX);
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="item-name">${resourceName}</span>
                <div class="quantity-values">
                    <span class="item-quantity">${quantity.toLocaleString()}</span>
                    <span class="complete-buy-order-quantity">${completeBuyOrders.toLocaleString()}</span>
                    <span class="rest-buy-order-quantity">${restBuyOrders.toLocaleString()}</span>
                </div>`;
            ul.appendChild(li);
        });
        resultsDiv.appendChild(ul);
    }
}

function setNodeAndChildrenCompletion(node, completedStatus) {
    node.completed = completedStatus;
    const listItem = document.querySelector(`li[data-node-id="${node.nodeId}"]`);
    if (listItem) {
        const headerDiv = listItem.querySelector('.craft-step-header');
        const checkbox = listItem.querySelector('.craft-checkbox');
        const quantityInput = listItem.querySelector('.current-quantity-input');
        const packsInput = listItem.querySelector('.packs-quantity-input');
        if (headerDiv) {
            if (completedStatus) {
                headerDiv.classList.add('completed-item');
            } else {
                headerDiv.classList.remove('completed-item');
            }
        }
        if (checkbox) {
            checkbox.checked = completedStatus;
        }
        if (quantityInput) {
            quantityInput.disabled = completedStatus;
            if (completedStatus) {
                node.currentQuantity = node.quantityNeeded;
                quantityInput.value = node.quantityNeeded;
            } else {
                node.currentQuantity = 0;
                quantityInput.value = 0;
            }
        }
        if (packsInput) {
            packsInput.disabled = completedStatus;
            node.packsQuantity = 0;
            packsInput.value = 0;
        }
    }
    for (const child of node.children) {
        setNodeAndChildrenCompletion(child, completedStatus);
    }
}

function longestCommonPrefix(strs) {
    if (strs.length === 0) return "";
    if (strs.length === 1) return strs[0];

    let prefix = strs[0];
    for (let i = 1; i < strs.length; i++) {
        while (strs[i].indexOf(prefix) !== 0) {
            prefix = prefix.substring(0, prefix.length - 1);
            if (prefix === "") return "";
        }
    }
    return prefix;
}

function selectAutocompleteItem(index) {
    const items = autocompleteList.querySelectorAll('div');
    if (items.length === 0) return;

    if (currentAutocompleteIndex > -1 && items[currentAutocompleteIndex]) {
        items[currentAutocompleteIndex].classList.remove('selected');
    }

    currentAutocompleteIndex = (index + items.length) % items.length;
    items[currentAutocompleteIndex].classList.add('selected');

    items[currentAutocompleteIndex].scrollIntoView({ block: 'nearest' });
}

function applyTemporaryHoverHighlight(startNodeId, add) {
    const node = nodeMap.get(startNodeId);
    if (!node) return;

    const listItem = document.querySelector(`li[data-node-id="${node.nodeId}"]`);
    if (listItem) {
        if (add) {
            listItem.classList.add('hover-temp-highlight');
        } else {
            listItem.classList.remove('hover-temp-highlight');
        }
    }
    for (const child of node.children) {
        applyTemporaryHoverHighlight(child.nodeId, add);
    }
}

function clearAllFrozenPathHighlights() {
    document.querySelectorAll('#craftTreeDisplay li.frozen-path-highlight').forEach(li => {
        li.classList.remove('frozen-path-highlight');
    });
}

function clearAllHoverTempHighlights() {
    document.querySelectorAll('#craftTreeDisplay li.hover-temp-highlight').forEach(li => {
        li.classList.remove('hover-temp-highlight');
    });
}

function toggleFrozenAndChildrenHighlight(startNodeId, add) {
    const node = nodeMap.get(startNodeId);
    if (!node) return;

    const listItem = document.querySelector(`li[data-node-id="${node.nodeId}"]`);
    if (listItem) {
        if (add) {
            listItem.classList.add('frozen-path-highlight');
            listItem.classList.remove('hover-temp-highlight');
        } else {
            listItem.classList.remove('frozen-path-highlight');
        }
    }
    for (const child of node.children) {
        toggleFrozenAndChildrenHighlight(child.nodeId, add);
    }
}

function rebuildNodeMapFromTree(node) {
    if (!node) return;
    nodeMap.set(node.nodeId, node);
    if (node.children) {
        for (const child of node.children) {
            rebuildNodeMapFromTree(child);
        }
    }
}

function saveStateToJson() {
    if (!currentCraftTreeRoot) {
        resultsDiv.innerHTML = '<p class="error-message">No crafting tree to save. Please calculate an item first.</p>';
        return;
    }

    const state = {
        itemName: itemNameInput.value.trim(),
        itemQuantity: parseInt(itemQuantityInput.value, 10),
        craftTree: currentCraftTreeRoot
    };

    const jsonString = JSON.stringify(state, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `skyblock_crafting_state_${state.itemName.replace(/\s/g, '_').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function loadStateFromJson(jsonContent) {
    try {
        const state = JSON.parse(jsonContent);

        if (!state.itemName || isNaN(state.itemQuantity) || !state.craftTree) {
            throw new Error("Invalid state file format. Missing item name, quantity, or craft tree data.");
        }

        itemNameInput.value = state.itemName;
        itemQuantityInput.value = state.itemQuantity;

        currentCraftTreeRoot = state.craftTree;
        nodeMap.clear();
        rebuildNodeMapFromTree(currentCraftTreeRoot);

        craftTreeContent.innerHTML = `<ul>${renderCraftTree(currentCraftTreeRoot)}</ul>`;
        craftTreeDisplay.classList.remove('hidden');
        frozenNodeId = null;
        recalculateAndRenderResources();
        attachCraftTreeListeners();
    } catch (error) {
        console.error("Error loading state:", error);
        resultsDiv.innerHTML = `<p class="error-message">Error loading state: ${error.message}. Please ensure you selected a valid JSON state file.</p>`;
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

itemNameInput.addEventListener('input', function () {
    const inputValue = this.value.toLowerCase().trim();
    autocompleteList.innerHTML = '';
    autocompleteList.classList.add('hidden');
    currentAutocompleteIndex = -1;

    if (inputValue.length === 0) {
        return;
    }

    const matchingDisplayNames = [];
    for (const internalName in ORIGINAL_DISPLAY_NAMES_BY_INTERNAL_NAME) {
        const originalDisplayName = ORIGINAL_DISPLAY_NAMES_BY_INTERNAL_NAME[internalName];
        if (originalDisplayName.toLowerCase().includes(inputValue)) {
            matchingDisplayNames.push(originalDisplayName);
        }
    }

    matchingDisplayNames.sort();

    if (matchingDisplayNames.length > 0) {
        matchingDisplayNames.slice(0, 100).forEach(displayName => {
            const div = document.createElement('div');
            div.textContent = displayName;
            div.addEventListener('click', function () {
                itemNameInput.value = this.textContent;
                autocompleteList.classList.add('hidden');
                itemNameInput.focus();
            });
            autocompleteList.appendChild(div);
        });
        autocompleteList.classList.remove('hidden');
    }
});

itemNameInput.addEventListener('keydown', function (e) {
    const items = autocompleteList.querySelectorAll('div');

    if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectAutocompleteItem(currentAutocompleteIndex - 1);
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectAutocompleteItem(currentAutocompleteIndex + 1);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentAutocompleteIndex > -1 && items[currentAutocompleteIndex]) {
            itemNameInput.value = items[currentAutocompleteIndex].textContent;
            autocompleteList.classList.add('hidden');
            currentAutocompleteIndex = -1;
            itemNameInput.focus();
        } else {
            autocompleteList.classList.add('hidden');
            calculateBtn.click();
        }
    } else if (e.key === 'Tab') {
        if (!autocompleteList.classList.contains('hidden') || currentAutocompleteIndex > -1) {
            e.preventDefault();
        }

        if (currentAutocompleteIndex > -1 && items[currentAutocompleteIndex]) {
            itemNameInput.value = items[currentAutocompleteIndex].textContent;
            autocompleteList.classList.add('hidden');
            currentAutocompleteIndex = -1;
            itemNameInput.focus();
        } else {
            const inputValue = this.value.toLowerCase().trim();
            const matchingDisplayNames = [];
            for (const internalName in ORIGINAL_DISPLAY_NAMES_BY_INTERNAL_NAME) {
                const originalDisplayName = ORIGINAL_DISPLAY_NAMES_BY_INTERNAL_NAME[internalName];
                if (originalDisplayName.toLowerCase().startsWith(inputValue)) {
                    matchingDisplayNames.push(originalDisplayName);
                }
            }

            matchingDisplayNames.sort();

            if (matchingDisplayNames.length > 0) {
                const commonPrefix = longestCommonPrefix(matchingDisplayNames);
                if (commonPrefix.toLowerCase().startsWith(inputValue)) {
                    itemNameInput.value = commonPrefix;
                }
            }
            autocompleteList.classList.add('hidden');
            currentAutocompleteIndex = -1;
        }
    }
});

itemNameInput.addEventListener('focus', function () {
    const inputValue = this.value.toLowerCase().trim();
    if (inputValue.length > 0) {
        itemNameInput.dispatchEvent(new Event('input'));
    }
});

document.addEventListener('click', function (e) {
    if (e.target !== itemNameInput && e.target.parentNode !== autocompleteList) {
        autocompleteList.classList.add('hidden');
        currentAutocompleteIndex = -1;
    }
});

calculateBtn.addEventListener('click', async () => {
    const itemNameInputVal = itemNameInput.value.trim();
    const itemQuantity = parseInt(itemQuantityInput.value, 10);

    resultsDiv.innerHTML = '';
    craftTreeContent.innerHTML = '';
    craftTreeDisplay.classList.add('hidden');
    loadingSpinner.style.display = 'block';
    autocompleteList.classList.add('hidden');

    nodeMap.clear();
    frozenNodeId = null;
    currentCraftTreeRoot = null;

    if (!itemNameInputVal) {
        resultsDiv.innerHTML = '<p class="error-message">Please enter an item name.</p>';
        loadingSpinner.style.display = 'none';
        return;
    }

    if (isNaN(itemQuantity) || itemQuantity <= 0) {
        resultsDiv.innerHTML = '<p class="error-message">Please enter a valid quantity (a positive number).</p>';
        loadingSpinner.style.display = 'none';
        return;
    }

    try {
        let initialInternalName = normalizeInternalName(itemNameInputVal);
        const cleanedInput = cleanDisplayName(itemNameInputVal).toLowerCase();
        if (DISPLAY_NAME_LOOKUP[cleanedInput]) {
            initialInternalName = DISPLAY_NAME_LOOKUP[cleanedInput];
        }

        const initialRecipeInfo = await fetchRecipe(initialInternalName);
        if (normalizeInternalName(initialRecipeInfo.internalname) !== normalizeInternalName(initialInternalName)) {
            resultsDiv.innerHTML = `<p class="error-message">
                        Recipe for "${itemNameInputVal}" not found.
                        Please ensure you've entered a recognized display name or a correct internal name.
                        <br>
                        <b>Check your browser's console (F12 -> Network/Console tabs) for specific errors (e.g., 404 Not Found).</b>
                     </p>`;
            loadingSpinner.style.display = 'none';
            craftTreeDisplay.classList.add('hidden');
            return;
        }

        if (initialRecipeInfo.ingredients.length === 0 && initialRecipeInfo.isVanilla === false) {
            resultsDiv.innerHTML = `<p class="error-message">
                        The item "${cleanDisplayName(initialRecipeInfo.output)}" is not craftable or its recipe is unknown.
                    </p>`;
            loadingSpinner.style.display = 'none';
            craftTreeDisplay.classList.add('hidden');
            return;
        }

        currentCraftTreeRoot = await buildCraftTree(initialInternalName, itemQuantity);
        recalculateAndRenderResources();

        if (currentCraftTreeRoot) {
            craftTreeContent.innerHTML = `<ul>${renderCraftTree(currentCraftTreeRoot)}</ul>`;
            craftTreeDisplay.classList.remove('hidden');

            attachCraftTreeListeners();
        }

    } catch (error) {
        console.error(`Error calculating resources: ${error.message}`);
        resultsDiv.innerHTML = `<p class="error-message">An unexpected error occurred: ${error.message}. Please check your browser's console for details.`;
    } finally {
        loadingSpinner.style.display = 'none';
    }
});

saveStateBtn.addEventListener('click', saveStateToJson);

loadStateBtn.addEventListener('click', () => {
    loadFileInput.click();
});

loadFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        loadingSpinner.style.display = 'block';
        const reader = new FileReader();

        reader.onload = (e) => {
            loadStateFromJson(e.target.result);
        };

        reader.onerror = (e) => {
            console.error("File reading error:", e);
            resultsDiv.innerHTML = '<p class="error-message">Failed to read file.</p>';
            loadingSpinner.style.display = 'none';
        };

        reader.readAsText(file);
    }
});

function attachCraftTreeListeners() {
    craftTreeContent.querySelectorAll('.toggle-arrow').forEach(arrow => {
        arrow.addEventListener('click', function (event) {
            event.stopPropagation();
            const targetId = this.dataset.targetId;
            const targetUl = document.getElementById(targetId);
            if (targetUl) {
                const nodeId = targetId.replace('tree-node-', '');
                const node = nodeMap.get(nodeId);
                if (node) {
                    node.isCollapsed = !node.isCollapsed;
                    targetUl.style.display = node.isCollapsed ? 'none' : 'block';
                    this.textContent = node.isCollapsed ? '►' : '▼';
                }
            }
        });
    });

    craftTreeContent.querySelectorAll('.craft-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            const nodeId = this.dataset.nodeId;
            const node = nodeMap.get(nodeId);
            if (node) {
                setNodeAndChildrenCompletion(node, this.checked);
                recalculateAndRenderResources();
            }
        });
    });

    craftTreeContent.querySelectorAll('.current-quantity-input').forEach(input => {
        input.addEventListener('input', function () {
            const nodeId = this.dataset.nodeId;
            const node = nodeMap.get(nodeId);
            if (node) {
                node.currentQuantity = Math.max(0, parseInt(this.value, 10) || 0);
                recalculateAndRenderResources();
            }
        });
    });

    craftTreeContent.querySelectorAll('.packs-quantity-input').forEach(input => {
        input.addEventListener('input', function () {
            const nodeId = this.dataset.nodeId;
            const node = nodeMap.get(nodeId);
            if (node) {
                node.packsQuantity = Math.max(0, parseInt(this.value, 10) || 0);
                recalculateAndRenderResources();
            }
        });
    });

    craftTreeContent.addEventListener('mouseover', function (event) {
        if (event.target.classList.contains('current-quantity-input') || event.target.classList.contains('packs-quantity-input')) {
            return;
        }
        const listItem = event.target.closest('li[data-node-id]');
        if (listItem) {
            const nodeId = listItem.dataset.nodeId;
            if (nodeId !== frozenNodeId) {
                applyTemporaryHoverHighlight(nodeId, true);
            }
        }
    });
    craftTreeContent.addEventListener('mouseout', function (event) {
        if (event.target.classList.contains('current-quantity-input') || event.target.classList.contains('packs-quantity-input')) {
            return;
        }
        const listItem = event.target.closest('li[data-node-id]');
        if (listItem) {
            const nodeId = listItem.dataset.nodeId;
            if (nodeId !== frozenNodeId) {
                applyTemporaryHoverHighlight(nodeId, false);
            }
        }
    });

    craftTreeContent.addEventListener('click', function (event) {
        if (event.target.classList.contains('craft-checkbox') ||
            event.target.classList.contains('current-quantity-input') ||
            event.target.classList.contains('packs-quantity-input')) {
            event.stopPropagation();
            return;
        }

        const listItem = event.target.closest('li[data-node-id]');
        if (!listItem) return;

        const clickedNodeId = listItem.dataset.nodeId;
        const clickedNode = nodeMap.get(clickedNodeId);

        if (!clickedNode) return;

        clearAllFrozenPathHighlights();
        clearAllHoverTempHighlights();

        if (frozenNodeId === clickedNodeId) {
            frozenNodeId = null;
        } else {
            toggleFrozenAndChildrenHighlight(clickedNodeId, true);
            frozenNodeId = clickedNodeId;
        }
        recalculateAndRenderResources();
    });
}