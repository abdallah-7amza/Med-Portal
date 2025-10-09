document.addEventListener('DOMContentLoaded', async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const path = urlParams.get('path') || '';
    const selectedUniId = localStorage.getItem('selectedUni');

    const pageTitleEl = document.getElementById('page-title');
    const contentContainer = document.getElementById('content-container');
    const siteTitleEl = document.getElementById('site-title');
    const toolbarContainer = document.getElementById('toolbar-container');

    if (!selectedUniId || !path) {
        pageTitleEl.textContent = 'Invalid parameters.';
        return;
    }

    try {
        // 💡 الخطوة 1: جلب ملف الفهرس الصغير فقط
        const response = await fetch('./database.json');
        if (!response.ok) throw new Error("Database file not found.");
        const data = await response.json();

        // التنقل في الشجرة للحصول على العقدة المطلوبة (باستخدام المسارات المحولة لأحرف صغيرة)
        let topicNode = data.tree[selectedUniId.toLowerCase()];
        siteTitleEl.textContent = `${topicNode.name} Med Portal`;

        const pathSegments = path.split('/').filter(Boolean).slice(1);
        for (const segment of pathSegments) {
            topicNode = topicNode.children[segment.toLowerCase()];
        }

        if (!topicNode) throw new Error("Topic not found in database.");

        pageTitleEl.textContent = topicNode.label;
        toolbarContainer.innerHTML = '';

        // بناء أزرار الموارد (هذا الجزء لا يتغير لأنه يعتمد على البيانات الوصفية الموجودة في الفهرس)
        if (topicNode.resources) {
            if (topicNode.resources.collectionQuizzes) {
                topicNode.resources.collectionQuizzes.forEach(quiz => {
                    toolbarContainer.appendChild(createResourceButton(quiz.title, `quiz.html?collection=${quiz.id}&path=${path}`, 'quiz'));
                });
            }
            if (topicNode.resources.flashcardDecks) {
                topicNode.resources.flashcardDecks.forEach(deck => {
                    toolbarContainer.appendChild(createResourceButton(deck.title, `flashcards.html?collection=${deck.id}&path=${path}`, 'flashcards'));
                });
            }
        }

        // 💡 الخطوة 2: التحقق من وجود مسار المحتوى وجلبه عند الطلب
        if (topicNode.hasIndex && topicNode.contentPath) {
            const contentResponse = await fetch(topicNode.contentPath);
            if (!contentResponse.ok) throw new Error(`Lesson content file not found at ${topicNode.contentPath}.`);
            
            const contentData = await contentResponse.json();
            const markdown = contentData.markdownContent;

            // استخدام مكتبة marked لعرض المحتوى
            contentContainer.innerHTML = marked.parse(markdown);
        } else {
            contentContainer.innerHTML = "<p>No detailed lesson is available for this topic, but you can use the resources above.</p>";
        }

    } catch (error) {
        console.error('Error:', error);
        pageTitleEl.textContent = `Error: ${error.message}`;
    }
});

// هذه الدالة لا تحتاج إلى تعديل
function createResourceButton(text, url, type) {
    const button = document.createElement('a');
    button.href = url;
    button.className = `card card--${type}`;
    button.innerHTML = `<h2>${text}</h2>`;
    return button;
}
