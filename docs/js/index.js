/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

// أسماء المفاتيح المستخدمة في التخزين المؤقت في المتصفح
const versionKey = 'contentVersion';
const contentKey = 'contentData';

/**
 * يقوم بطلب ملف النسخة الرئيسي من الخادم.
 * هذا الملف يخبرنا بالجامعات المتاحة وآخر تحديث لمحتواها.
 * @param {string} basePath - المسار الأساسي الصحيح للموقع.
 */
async function fetchAndCacheVersion(basePath) {
  try {
    // بناء الرابط الكامل والصحيح لملف النسخة
    const response = await fetch(`${basePath}/version.json`);
    if (!response.ok) throw new Error('Network response was not ok.');
    const versionData = await response.json();
    // تخزين بيانات النسخة في التخزين المؤقت للمتصفح
    localStorage.setItem(versionKey, JSON.stringify(versionData));
    return versionData;
  } catch (error) {
    console.error('Failed to fetch version file:', error);
    // في حال فشل الطلب، حاول الحصول على البيانات من التخزين المؤقت
    const cachedVersion = localStorage.getItem(versionKey);
    return cachedVersion ? JSON.parse(cachedVersion) : null;
  }
}

/**
 * يقوم بتحميل محتوى جامعة معينة (ملف meta.json الخاص بها).
 * سيتحقق أولاً من التخزين المؤقت لمعرفة ما إذا كان المحتوى موجودًا ومحدثًا.
 * @param {string} basePath - المسار الأساسي الصحيح للموقع.
 * @param {string} universityId - معرّف الجامعة (مثلاً 'nub').
 * @param {string} hash - آخر هاش للمحتوى من ملف version.json.
 */
async function loadContent(basePath, universityId, hash) {
  const cachedContent = localStorage.getItem(contentKey);
  let contentData = cachedContent ? JSON.parse(cachedContent) : {};
  
  // المفتاح الفريد لهذه الجامعة في التخزين المؤقت
  const cacheKey = `university-${universityId}`;
  const currentHash = contentData.hashes?.[cacheKey];

  // إذا كان الهاش في التخزين المؤقت يطابق آخر هاش، قم بإرجاع البيانات المخزنة
  if (currentHash === hash && contentData.data?.[cacheKey]) {
    console.log(`Loading ${universityId} from cache.`);
    return contentData.data[cacheKey];
  }

  // إذا لم يكن في التخزين المؤقت أو كان المحتوى قديمًا، قم بطلب ملف meta.json الجديد
  console.log(`Fetching new content for ${universityId}.`);
  const contentUrl = `${basePath}/api/universities/${universityId}/meta.json`;
  try {
    const response = await fetch(contentUrl);
    if (!response.ok) throw new Error('Network response was not ok.');
    const newContent = await response.json();
    
    // تحديث التخزين المؤقت بالبيانات الجديدة والهاش الجديد
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
 * الدالة الرئيسية التي تبدأ تشغيل التطبيق.
 */
async function initializeApp() {
  // تحديد المسار الأساسي ديناميكيًا لطلبات البيانات.
  // هذا هو الإصلاح الجوهري لمشكلة GitHub Pages.
  const basePath = window.location.pathname.replace(/\/$/, '');
  
  // استخدام المعرّف الصحيح للحاوية من ملف HTML
  const universitiesContainer = document.getElementById('universities-container');

  const versionData = await fetchAndCacheVersion(basePath);
  if (!versionData || !versionData.hashes) {
    universitiesContainer.innerHTML = '<p>Failed to load app data. Please try again later.</p>';
    return;
  }

  // الحصول على كل معرّفات الجامعات من بيانات النسخة
  const universityIds = Object.keys(versionData.hashes);

  // المرور على كل جامعة وعرض بياناتها
  for (const uniId of universityIds) {
    const universityHash = versionData.hashes[uniId];
    const universityContent = await loadContent(basePath, uniId, universityHash);

    if (universityContent) {
      // إنشاء عنصر "كارد" لكل جامعة
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<h2>${universityContent.label}</h2>`;
      
      // إضافة حدث النقر للانتقال إلى صفحة الدروس
      card.addEventListener('click', () => {
        window.location.href = `lessons-list.html?uni=${uniId}`;
      });

      universitiesContainer.appendChild(card);
    }
  }
}

// ابدأ تشغيل التطبيق عند تحميل الصفحة بالكامل
document.addEventListener('DOMContentLoaded', initializeApp);
