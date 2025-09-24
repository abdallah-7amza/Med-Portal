import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import crypto from 'crypto';

// --- المسارات الأساسية ---
const contentBasePath = 'content';
const docsPath = 'docs';
const publicContentPath = path.join(docsPath, 'content-public'); // المسار النهائي الذي سيتم النشر منه

// --- دوال مساعدة ---
function formatLabel(name) {
    return name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function calculateHash(data) {
    return crypto.createHash('sha1').update(data, 'utf8').digest('hex');
}

// دالة جديدة لنسخ الملفات الضرورية (JSON, MD) إلى المجلد العام
async function copyEssentialFiles(sourceDir, destDir) {
    try {
        await fs.mkdir(destDir, { recursive: true });
        const files = await fs.readdir(sourceDir);
        for (const file of files) {
            if (file.endsWith('.json') || file.endsWith('.md')) {
                const sourceFilePath = path.join(sourceDir, file);
                const destFilePath = path.join(destDir, file);
                await fs.copyFile(sourceFilePath, destFilePath);
            }
        }
    } catch (error) {
        // نتجاهل الخطأ إذا كان المجلد غير موجود (مثل عدم وجود _flashcards)
    }
}


// --- دالة المسح والتحليل الرئيسية (مدمجة ومعدلة) ---
async function scanDirectory(dirPath) {
    const dirName = path.basename(dirPath);
    const node = { label: formatLabel(dirName), hasIndex: false, isBranch: false };
    const allHashes = [];

    // --- 1. معالجة index.md ---
    const indexPath = path.join(dirPath, 'index.md');
    try {
        const fileContent = await fs.readFile(indexPath, 'utf8');
        const { data } = matter(fileContent);
        node.hasIndex = true;
        node.label = data.title || node.label;
        node.summary = data.summary || '';
        allHashes.push(calculateHash(fileContent));
    } catch {
        node.hasIndex = false;
    }

    // --- 2. معالجة الموارد (الاختبارات والبطاقات التعليمية) ---
    node.resources = {};
    const collectionQuizPath = path.join(dirPath, '_collection_quiz');
    try {
        const files = await fs.readdir(collectionQuizPath);
        node.resources.collectionQuizzes = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const baseName = path.basename(file, '.json');
                const fileContent = await fs.readFile(path.join(collectionQuizPath, file), 'utf8');
                const quizData = JSON.parse(fileContent);
                node.resources.collectionQuizzes.push({ id: baseName, title: quizData.title || formatLabel(baseName) });
                allHashes.push(calculateHash(fileContent));
            }
        }
    } catch {}

    const flashcardsPath = path.join(dirPath, '_flashcards');
    try {
        const files = await fs.readdir(flashcardsPath);
        node.resources.flashcardDecks = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const baseName = path.basename(file, '.json');
                const fileContent = await fs.readFile(path.join(flashcardsPath, file), 'utf8');
                const deckData = JSON.parse(fileContent);
                node.resources.flashcardDecks.push({ id: baseName, title: deckData.title || formatLabel(baseName) });
                allHashes.push(calculateHash(fileContent));
            }
        }
    } catch {}

    // --- 3. المسح المتكرر للمجلدات الفرعية ---
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')) {
            const childPath = path.join(dirPath, entry.name);
            const childNode = await scanDirectory(childPath);
            node.children = node.children || {};
            node.children[entry.name] = childNode;
            allHashes.push(childNode.hash);
        }
    }

    // --- 4. حساب الـ Hash النهائي وكتابة الملفات ---
    node.hash = calculateHash(allHashes.sort().join(''));
    node.isBranch = !!node.children || (Object.keys(node.resources).length > 0 && !node.hasIndex);
    if (Object.keys(node.resources).length === 0) delete node.resources;

    // **التعديل الجوهري**: تحديد مسار الحفظ داخل المجلد العام
    const relativePath = path.relative(contentBasePath, dirPath);
    const publicMetaPath = path.join(publicContentPath, relativePath, 'meta.json');
    const publicDirPath = path.dirname(publicMetaPath);

    // كتابة meta.json ونسخ الملفات الضرورية إلى المجلد العام
    await fs.mkdir(publicDirPath, { recursive: true });
    await fs.writeFile(publicMetaPath, JSON.stringify(node, null, 2));
    await copyEssentialFiles(dirPath, publicDirPath);
    await copyEssentialFiles(collectionQuizPath, path.join(publicDirPath, '_collection_quiz'));
    await copyEssentialFiles(flashcardsPath, path.join(publicDirPath, '_flashcards'));

    return node;
}


// --- الدالة التنفيذية الرئيسية ---
async function main() {
    console.log("Starting build process...");

    // 1. مسح المجلد العام القديم
    await fs.rm(publicContentPath, { recursive: true, force: true });
    console.log(`Cleaned public content directory: ${publicContentPath}`);

    const universitiesPath = path.join(contentBasePath, 'universities');
    const versionFilePath = path.join(docsPath, 'version.json');
    const versionData = { generatedAt: new Date().toISOString(), hashes: {} };

    try {
        // 2. مسح وتحليل المحتوى، وبناء المجلد العام
        const uniDirs = await fs.readdir(universitiesPath, { withFileTypes: true });
        for (const uniDir of uniDirs) {
            if (uniDir.isDirectory()) {
                console.log(`Processing university: ${uniDir.name}...`);
                const uniPath = path.join(universitiesPath, uniDir.name);
                const uniNode = await scanDirectory(uniPath);
                versionData.hashes[uniDir.name] = uniNode.hash;
            }
        }

        // 3. كتابة ملف version.json النهائي
        await fs.writeFile(versionFilePath, JSON.stringify(versionData, null, 2));
        console.log(`Build process completed. Version index generated at ${versionFilePath}`);

    } catch (error) {
        console.error("Error generating index:", error);
        process.exit(1);
    }
}
 
main();

