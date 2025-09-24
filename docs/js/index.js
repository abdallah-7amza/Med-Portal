/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

// Key names for storing data in the browser's local storage
const versionKey = 'contentVersion';
const contentKey = 'contentData';

/**
 * Fetches the main version file from the server.
 * This file tells us which universities are available and their latest content hash.
 * @param {string} basePath - The correct base path of the website.
 */
async function fetchAndCacheVersion(basePath) {
  try {
    // Construct the correct, full URL to the version file
    const response = await fetch(`${basePath}/version.json`);
    if (!response.ok) throw new Error('Network response was not ok.');
    const versionData = await response.json();
    // Store the fetched version data in local storage for caching
    localStorage.setItem(versionKey, JSON.stringify(versionData));
    return versionData;
  } catch (error) {
    console.error('Failed to fetch version file:', error);
    // Try to get data from cache if fetching fails
    const cachedVersion = localStorage.getItem(versionKey);
    return cachedVersion ? JSON.parse(cachedVersion) : null;
  }
}

/**
 * Loads the content for a specific university (its meta.json file).
 * It will first check the cache to see if the content is already stored and up-to-date.
 * @param {string} basePath - The correct base path of the website.
 * @param {string} universityId - The ID of the university (e.g., 'nub').
 * @param {string} hash - The latest content hash from version.json.
 */
async function loadContent(basePath, universityId, hash) {
  const cachedContent = localStorage.getItem(contentKey);
  let contentData = cachedContent ? JSON.parse(cachedContent) : {};
  
  // The unique key for this university in our cache
  const cacheKey = `university-${universityId}`;
  const currentHash = contentData.hashes?.[cacheKey];

  // If the hash in the cache matches the latest hash, return the cached data
  if (currentHash === hash && contentData.data?.[cacheKey]) {
    console.log(`Loading ${universityId} from cache.`);
    return contentData.data[cacheKey];
  }

  // If not in cache or if the content is outdated, fetch the new meta.json
  console.log(`Fetching new content for ${universityId}.`);
  const contentUrl = `${basePath}/api/universities/${universityId}/meta.json`;
  try {
    const response = await fetch(contentUrl);
    if (!response.ok) throw new Error('Network response was not ok.');
    const newContent = await response.json();
    
    // Update the cache with the new data and the new hash
    contentData.hashes = contentData.hashes || {};
    contentData.data = contentData.data || {};
    contentData.hashes[cacheKey] = hash;
    contentData.data[cacheKey] = newContent;
    localStorage.setItem(contentKey, JSON.stringify(contentData));
    
    return newContent;
  } catch (error) {
    console.error(`Failed to fetch content for ${universityId}:`, error);
    return null;
  }
}

/**
 * The main function that starts the application.
 */
async function initializeApp() {
  // Dynamically determine the correct base path for API calls.
  // This is the crucial fix for GitHub Pages.
  const basePath = window.location.pathname.replace(/\/$/, '');
  const universitiesContainer = document.getElementById('universities-container'); // Corrected ID

  const versionData = await fetchAndCacheVersion(basePath);
  if (!versionData || !versionData.hashes) {
    universitiesContainer.innerHTML = '<p>Failed to load app data. Please try again later.</p>';
    return;
  }

  // Get all university IDs from the version data
  const universityIds = Object.keys(versionData.hashes);

  // Loop through each university ID and display its data
  for (const uniId of universityIds) {
    const universityHash = versionData.hashes[uniId];
    const universityContent = await loadContent(basePath, uniId, universityHash);

    if (universityContent) {
      // Create a card element for the university
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<h2>${universityContent.label}</h2>`;
      
      // Add a click event to navigate to the lessons page
      card.addEventListener('click', () => {
        window.location.href = `lessons-list.html?uni=${uniId}`;
      });

      universitiesContainer.appendChild(card);
    }
  }
}

// Start the app when the page is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
