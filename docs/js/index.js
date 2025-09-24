/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

const versionKey = 'contentVersion';
const contentKey = 'contentData';

async function fetchAndCacheVersion(basePath) {
  try {
    const response = await fetch(`${basePath}/version.json`);
    if (!response.ok) throw new Error('Network response was not ok.');
    const versionData = await response.json();
    localStorage.setItem(versionKey, JSON.stringify(versionData));
    return versionData;
  } catch (error) {
    console.error('Failed to fetch version file:', error);
    const cachedVersion = localStorage.getItem(versionKey);
    return cachedVersion ? JSON.parse(cachedVersion) : null;
  }
}

async function loadContent(basePath, universityId, hash) {
  const cachedContent = localStorage.getItem(contentKey);
  let contentData = cachedContent ? JSON.parse(cachedContent) : {};
  const cacheKey = `university-${universityId}`;
  const currentHash = contentData.hashes?.[cacheKey];

  if (currentHash === hash && contentData.data?.[cacheKey]) {
    console.log(`Loading ${universityId} from cache.`);
    return contentData.data[cacheKey];
  }

  console.log(`Fetching new content for ${universityId}.`);
  const contentUrl = `${basePath}/api/universities/${universityId}/meta.json`;
  try {
    const response = await fetch(contentUrl);
    if (!response.ok) throw new Error('Network response was not ok.');
    const newContent = await response.json();
    
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

async function initializeApp() {
  const basePath = window.location.pathname.replace(/\/$/, '');
  
  // *** هذا هو السطر المهم الذي يجب التأكد منه ***
  // يتأكد من أنه يبحث عن المعرّف الصحيح الموجود في ملف HTML
  const universitiesContainer = document.getElementById('universities-container');

  // التأكد من أننا وجدنا الحاوية قبل المتابعة
  if (!universitiesContainer) {
    console.error("Fatal Error: Could not find the element with ID 'universities-container' in the HTML.");
    return; // إيقاف تشغيل السكريبت إذا لم يتم العثور على الحاوية
  }

  const versionData = await fetchAndCacheVersion(basePath);
  if (!versionData || !versionData.hashes) {
    universitiesContainer.innerHTML = '<p>Failed to load app data. Please try again later.</p>';
    return;
  }

  const universityIds = Object.keys(versionData.hashes);

  for (const uniId of universityIds) {
    const universityHash = versionData.hashes[uniId];
    const universityContent = await loadContent(basePath, uniId, universityHash);

    if (universityContent) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<h2>${universityContent.label}</h2>`;
      
      card.addEventListener('click', () => {
        window.location.href = `lessons-list.html?uni=${uniId}`;
      });

      universitiesContainer.appendChild(card);
    }
  }
}

document.addEventListener('DOMContentLoaded', initializeApp);
