const collectDataBtn = document.getElementById('collectDataBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const statusDiv = document.getElementById('status');
const downloadLink = document.getElementById('downloadLink');

const GITHUB_REPO_OWNER = 'NotEnoughUpdates';
const GITHUB_REPO_NAME = 'NotEnoughUpdates-REPO';
const GITHUB_BRANCH = 'master';
const ITEMS_FOLDER_PATH = 'items/';

const GITHUB_BRANCH_API_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/branches/${GITHUB_BRANCH}`;
const GITHUB_TREE_API_BASE_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/git/trees/`;
const GITHUB_RAW_CONTENT_URL = `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/${GITHUB_BRANCH}/${ITEMS_FOLDER_PATH}`;

function cleanAndNormalizeDisplayName(name) {
    return name ? name.replace(/\[Lvl {LVL}\] /g, '').replace(/§[0-9a-fklmnor]/g, '').trim() : '';
}

async function fetchItemInternalNames() {
    console.log('Fetching item internal names...');
    try {
        statusDiv.innerHTML = 'Fetching branch SHA from GitHub API...';
        console.log('Fetching branch SHA from:', GITHUB_BRANCH_API_URL);
        const branchResponse = await fetch(GITHUB_BRANCH_API_URL);
        if (!branchResponse.ok) {
            const errorText = await branchResponse.text();
            console.error(`Failed to fetch branch SHA: ${branchResponse.status} ${branchResponse.statusText}`, errorText);
            throw new Error(`Failed to fetch branch SHA. Status: ${branchResponse.status}. Check console for details (e.g., rate limits, CORS).`);
        }
        const branchData = await branchResponse.json();
        const treeSha = branchData.commit.sha;
        console.log('Successfully fetched branch SHA:', treeSha);


        statusDiv.innerHTML = `Fetching Git Tree for SHA: ${treeSha}... (This might be a large request)`;
        console.log('Fetching Git Tree from:', `${GITHUB_TREE_API_BASE_URL}${treeSha}?recursive=1`);
        const treeResponse = await fetch(`${GITHUB_TREE_API_BASE_URL}${treeSha}?recursive=1`);
        if (!treeResponse.ok) {
            const errorText = await treeResponse.text();
            console.error(`Failed to fetch Git Tree: ${treeResponse.status} ${treeResponse.statusText}`, errorText);
            throw new Error(`Failed to fetch Git Tree. Status: ${treeResponse.status}. Check console for details (e.g., rate limits, CORS).`);
        }
        const treeData = await treeResponse.json();
        console.log('Successfully fetched Git Tree.');


        if (!treeData.tree || !Array.isArray(treeData.tree)) {
            throw new Error("Invalid Git Tree response structure.");
        }

        const internalNames = treeData.tree
            .filter(entry => entry.type === 'blob' && entry.path.startsWith(ITEMS_FOLDER_PATH) && entry.path.endsWith('.json'))
            .map(entry => entry.path.substring(ITEMS_FOLDER_PATH.length).replace('.json', ''));

        console.log(`Found ${internalNames.length} item files.`);
        return internalNames;

    } catch (error) {
        console.error('Error fetching item internal names:', error);
        statusDiv.innerHTML = `<span class="text-red-400">Error fetching item list: ${error.message}. Please try again later or check console.</span>`;
        throw error;
    }
}

async function fetchItemData(internalName, retries = 3, delay = 1000) {
    const url = `${GITHUB_RAW_CONTENT_URL}${internalName}.json`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
            if (response.status === 404) {
                console.warn(`404 Not Found for item: ${internalName}`);
                return { success: false, data: null, error: `404 Not Found` };
            }
            if (retries > 0) {
                console.log(`Retrying fetch for ${internalName} in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
                return fetchItemData(internalName, retries - 1, delay * 2);
            }
            console.error(`Failed to fetch item data for ${internalName}:`, errorMsg);
            return { success: false, data: null, error: errorMsg };
        }
        return { success: true, data: await response.json(), error: null };
    } catch (error) {
        const errorMsg = `Network error: ${error.message}`;
        if (retries > 0) {
            console.log(`Retrying fetch for ${internalName} due to network error in ${delay}ms...`);
            await new Promise(res => setTimeout(res, delay));
            return fetchItemData(internalName, retries - 1, delay * 2);
        }
        console.error(`Failed to fetch item data for ${internalName} after multiple retries:`, errorMsg);
        return { success: false, data: null, error: errorMsg };
    }
}

collectDataBtn.addEventListener('click', async () => {
    console.log('"Generate Display Name Map" button clicked.');
    collectDataBtn.disabled = true;
    loadingSpinner.style.display = 'block';
    statusDiv.innerHTML = 'Starting data collection...';
    downloadLink.style.display = 'none';

    try {
        const itemInternalNamesToFetch = await fetchItemInternalNames();
        if (itemInternalNamesToFetch.length === 0) {
            statusDiv.innerHTML = '<span class="text-red-400">No item files found or an error occurred fetching the list.</span>';
            loadingSpinner.style.display = 'none';
            collectDataBtn.disabled = false;
            return;
        }

        const displayNameMap = {};
        let addedCount = 0;
        let processedCount = 0;
        const totalItems = itemInternalNamesToFetch.length;
        const failedItems = [];
        let skippedCount = 0;


        statusDiv.innerHTML = `Found <span class="font-bold text-blue-300">${totalItems}</span> item files. Now fetching individual item data...`;
        statusDiv.innerHTML += `<br><span class="text-yellow-300 text-sm">If fetching stalls, consider temporarily disabling your ad blocker or whitelisting 'raw.githubusercontent.com'.</span>`;
        console.log(`Starting to fetch data for ${totalItems} items.`);


        for (const internalName of itemInternalNamesToFetch) {
            const result = await fetchItemData(internalName);
            processedCount++;

            if (result.success && result.data && result.data.displayname && result.data.internalname) {
                const recipeRecord = result.data;
                const isVanilla = recipeRecord.vanilla === true;

                if (isVanilla) {
                    skippedCount++;
                    console.log(`[SKIPPED] Item is vanilla: ${cleanAndNormalizeDisplayName(recipeRecord.displayname)} (${internalName})`);
                    continue;
                }

                let hasIngredients = false;

                if (recipeRecord.recipes && Array.isArray(recipeRecord.recipes) && recipeRecord.recipes.length > 0) {
                    for (const primaryRecipe of recipeRecord.recipes) {
                        if (primaryRecipe) {
                            const hasGridRecipe = primaryRecipe.A1 !== undefined || primaryRecipe.A2 !== undefined || primaryRecipe.A3 !== undefined ||
                                primaryRecipe.B1 !== undefined || primaryRecipe.B2 !== undefined || primaryRecipe.B3 !== undefined ||
                                primaryRecipe.C1 !== undefined || primaryRecipe.C2 !== undefined || primaryRecipe.C3 !== undefined;
                            const hasInputList = primaryRecipe.inputs && Array.isArray(primaryRecipe.inputs) && primaryRecipe.inputs.length > 0;

                            if (hasGridRecipe || hasInputList) {
                                hasIngredients = true;
                                break;
                            }
                        }
                    }
                } else if (recipeRecord.recipe && typeof recipeRecord.recipe === 'object' && Object.keys(recipeRecord.recipe).length > 0) {
                    hasIngredients = true;
                }

                if (hasIngredients) {
                    const cleanedDisplayName = cleanAndNormalizeDisplayName(recipeRecord.displayname);
                    displayNameMap[cleanedDisplayName] = recipeRecord.internalname;
                    addedCount++;
                    console.log(`[ADDED] Item: ${cleanedDisplayName} (${internalName}) - Has Ingredients: ${hasIngredients}, Vanilla: ${isVanilla}`);
                } else {
                    skippedCount++;
                    console.log(`[SKIPPED] No ingredients: ${cleanAndNormalizeDisplayName(recipeRecord.displayname)} (${internalName})`);
                }
            } else if (!result.success) {
                failedItems.push(`${internalName} (${result.error || 'Unknown Error'})`);
                console.error(`[FAILED] Could not process item: ${internalName}. Reason: ${result.error || 'Unknown Error'}`);
            }


            statusDiv.innerHTML = `Processed <span class="font-bold text-blue-300">${processedCount}</span> of <span class="font-bold text-blue-300">${totalItems}</span> items. ` +
                `Added <span class="font-bold text-green-300">${addedCount}</span> craftable items. ` +
                `Skipped <span class="font-bold text-yellow-300">${skippedCount}</span> items.`;


            if (failedItems.length > 0) {
                statusDiv.innerHTML += `<br><span class="text-red-400 text-sm">Failed to fetch ${failedItems.length} items.</span>`;
            }
        }

        console.log('Finished processing all items.');

        if (addedCount > 0) {
            const jsonString = JSON.stringify(displayNameMap, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            downloadLink.href = url;
            downloadLink.style.display = 'block';
            statusDiv.innerHTML = `Successfully generated map for <span class="font-bold text-green-300">${addedCount}</span> craftable items. Ready for download.`;
            console.log(`Successfully generated map for ${addedCount} items. Download link is now available.`);
        } else {
            statusDiv.innerHTML = '<span class="text-red-400">No items were collected successfully. This might be due to ad blockers, rate limits, network issues, or invalid JSON.</span>';
            console.warn('No items were collected successfully.');
        }

        if (failedItems.length > 0) {
            statusDiv.innerHTML += `<br><br><span class="text-red-400 font-bold">Failed Items:</span><br>`;
            statusDiv.innerHTML += `<span class="text-red-300 text-sm">${failedItems.join('<br>')}</span>`;
            console.error('Failed to fetch the following items:', failedItems);
        }

    } catch (error) {
        console.error("Overall collection error:", error);
        statusDiv.innerHTML = `<span class="text-red-400">An unexpected error occurred during collection: ${error.message}. This could be due to ad blockers or GitHub rate limits. Check console for details.</span>`;
    } finally {
        loadingSpinner.style.display = 'none';
        collectDataBtn.disabled = false;
        console.log('Data collection process finished.');
    }
});