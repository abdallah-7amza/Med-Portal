import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

// تحديد المسارات الجديدة لإخراج المحتوى المُجزء (كلها بأحرف صغيرة)
const LESSON_CONTENT_DIR = 'docs/content/lessons';
const QUIZ_CONTENT_DIR = 'docs/content/quizzes';
const FLASHCARD_CONTENT_DIR = 'docs/content/flashcards';

// Helper to format names as a fallback
function formatLabel(name) {
    return name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Helper to ensure directory exists recursively
async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}

// Main recursive function to scan directories
async function scanDirectory(dirPath, isUniversity = false) {
    const node = { children: {}, resources: {} };

    // --- 1. Read metadata for the current folder ---
    if (isUniversity) {
        const metaPath = path.join(dirPath, 'meta.json');
        try {
            const metaContent = await fs.readFile(metaPath, 'utf8');
            const meta = JSON.parse(metaContent);
            node.name = meta.name || formatLabel(path.basename(dirPath));
        } catch {
            node.name = formatLabel(path.basename(dirPath));
        }
    }

    // تحويل المسار النسبي إلى أحرف صغيرة لضمان التوحيد
    const relativeContentPath = dirPath.substring('content/universities/'.length).toLowerCase();

    // --- 2. Process index.md (Lesson Content) ---
    const indexPath = path.join(dirPath, 'index.md');
    try {
        await fs.access(indexPath);
        node.hasIndex = true;
        const fileContent = await fs.readFile(indexPath, 'utf8');
        const { data, content } = matter(fileContent);
        node.label = data.title || formatLabel(path.basename(dirPath));
        node.summary = data.summary || '';

        // إنشاء ملف منفصل لمحتوى الدرس
        const lessonFilename = `${relativeContentPath.replace(/[/\\]/g, '__')}.json`;
        const lessonOutputPath = path.join(LESSON_CONTENT_DIR, lessonFilename);

        await ensureDir(LESSON_CONTENT_DIR);
        await fs.writeFile(lessonOutputPath, JSON.stringify({ markdownContent: content }, null, 2));

        // حذف محتوى الماركدون من العقدة الرئيسية وتخزين المسار فقط
        node.contentPath = lessonOutputPath.substring('docs/'.length);

    } catch {
        node.hasIndex = false;
        node.label = node.label || formatLabel(path.basename(dirPath));
    }

    // --- 3. Scan for ALL resources ---
    // Collection Quizzes
    const collectionQuizPath = path.join(dirPath, '_collection_quiz');
    const quizOutputBase = path.join(QUIZ_CONTENT_DIR, relativeContentPath);
    await ensureDir(quizOutputBase);
    try {
        await fs.access(collectionQuizPath);
        const files = await fs.readdir(collectionQuizPath);
        const collectionQuizzes = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const baseName = path.basename(file, '.json').toLowerCase();
                const jsonFilePath = path.join(collectionQuizPath, file);
                const quizContent = await fs.readFile(jsonFilePath, 'utf8');
                const quizObject = JSON.parse(quizContent);
                const title = quizObject.title || formatLabel(baseName);

                // كتابة محتوى الاختبار في ملف منفصل
                const quizOutputPath = path.join(quizOutputBase, file.toLowerCase());
                await fs.writeFile(quizOutputPath, quizContent);

                // إضافة البيانات الوصفية فقط إلى العقدة الرئيسية
                collectionQuizzes.push({ id: baseName, title: title });
            }
        }
        if (collectionQuizzes.length > 0) {
            node.resources.collectionQuizzes = collectionQuizzes;
        }
    } catch {}

    // Flashcard Decks
    const flashcardsPath = path.join(dirPath, '_flashcards');
    const flashcardOutputBase = path.join(FLASHCARD_CONTENT_DIR, relativeContentPath);
    await ensureDir(flashcardOutputBase);
    try {
        await fs.access(flashcardsPath);
        const files = await fs.readdir(flashcardsPath);
        const flashcardDecks = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const baseName = path.basename(file, '.json').toLowerCase();
                const jsonFilePath = path.join(flashcardsPath, file);
                const deckContent = await fs.readFile(jsonFilePath, 'utf8');
                const deckObject = JSON.parse(deckContent);
                const title = deckObject.title || formatLabel(baseName);

                // كتابة محتوى البطاقات في ملف منفصل
                const deckOutputPath = path.join(flashcardOutputBase, file.toLowerCase());
                await fs.writeFile(deckOutputPath, deckContent);

                // إضافة البيانات الوصفية فقط
                flashcardDecks.push({ id: baseName, title: title });
            }
        }
        if (flashcardDecks.length > 0) {
            node.resources.flashcardDecks = flashcardDecks;
        }
    } catch {}


    // --- 4. Recursively scan children directories ---
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')) {
            const childPath = path.join(dirPath, entry.name);
            // استخدام اسم المجلد الصغير كمفتاح في الشجرة
            node.children[entry.name.toLowerCase()] = await scanDirectory(childPath, false);
        }
    }

    // *** منطق تحديد "الفئة" يظل كما هو ***
    const hasChildren = Object.keys(node.children).length > 0;
    const hasBranchResources = node.resources && (node.resources.collectionQuizzes || node.resources.flashcardDecks);

    if (hasChildren || (!node.hasIndex && hasBranchResources)) {
        node.isBranch = true;
    }

    if (Object.keys(node.resources).length === 0) {
        delete node.resources;
    }

    return node;
}

// Main execution function
async function main() {
    await ensureDir('docs/content');
    const universitiesPath = 'content/universities';
    const outputPath = 'docs/database.json';

    const database = {
        generatedAt: new Date().toISOString(),
        tree: {}
    };

    try {
        const uniDirs = await fs.readdir(universitiesPath, { withFileTypes: true });
        for (const uniDir of uniDirs) {
            if (uniDir.isDirectory()) {
                const uniPath = path.join(universitiesPath, uniDir.name);
                // استخدام اسم مجلد الجامعة الصغير كمفتاح
                database.tree[uniDir.name.toLowerCase()] = await scanDirectory(uniPath, true);
            }
        }
        await fs.writeFile(outputPath, JSON.stringify(database, null, 2));
        console.log(`Database generated successfully at ${outputPath}`);
    } catch (error) {
        console.error("Error generating database:", error);
        process.exit(1);
    }
}

main();
