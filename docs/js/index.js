import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import crypto from 'crypto';

const contentBasePath = 'content';
const outputBasePath = 'docs/api';

function formatLabel(name) {
    return name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function calculateHash(data) {
    return crypto.createHash('sha1').update(data, 'utf8').digest('hex');
}

async function scanDirectory(dirPath) {
    const dirName = path.basename(dirPath);
    const node = { label: formatLabel(dirName), hasIndex: false, isBranch: false };
    const allHashes = [];

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
    
    node.resources = {};
    const collectionQuizPath = path.join(dirPath, '_collection_quiz');
    try {
        const files = await fs.readdir(collectionQuizPath);
        node.resources.collectionQuizzes = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const baseName = path.basename(file, '.json');
                const jsonFilePath = path.join(collectionQuizPath, file);
                const fileContent = await fs.readFile(jsonFilePath, 'utf8');
                const quizData = JSON.parse(fileContent);
                const title = quizData.title || formatLabel(baseName);
                node.resources.collectionQuizzes.push({ id: baseName, title: title });
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
                const jsonFilePath = path.join(flashcardsPath, file);
                const fileContent = await fs.readFile(jsonFilePath, 'utf8');
                const deckData = JSON.parse(fileContent);
                const title = deckData.title || formatLabel(baseName);
                node.resources.flashcardDecks.push({ id: baseName, title: title });
                allHashes.push(calculateHash(fileContent));
            }
        }
    } catch {}

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

    node.hash = calculateHash(allHashes.sort().join(''));
    node.isBranch = Object.keys(node.children || {}).length > 0 || (Object.keys(node.resources).length > 0 && !node.hasIndex);
    
    if (Object.keys(node.resources).length === 0) {
        delete node.resources;
    }
    
    const relativePath = path.relative(contentBasePath, dirPath);
    const metaOutputPath = path.join(outputBasePath, relativePath, 'meta.json');
    
    await fs.mkdir(path.dirname(metaOutputPath), { recursive: true });
    await fs.writeFile(metaOutputPath, JSON.stringify(node, null, 2));

    return node;
}

async function main() {
    const universitiesPath = path.join(contentBasePath, 'universities');
    const docsPath = 'docs';
    const versionFilePath = path.join(docsPath, 'version.json');

    await fs.rm(outputBasePath, { recursive: true, force: true });

    const versionData = {
        generatedAt: new Date().toISOString(),
        hashes: {}
    };

    try {
        const uniDirs = await fs.readdir(universitiesPath, { withFileTypes: true });
        for (const uniDir of uniDirs) {
            if (uniDir.isDirectory()) {
                const uniPath = path.join(universitiesPath, uniDir.name);
                const uniNode = await scanDirectory(uniPath);
                versionData.hashes[uniDir.name] = uniNode.hash;
            }
        }
        await fs.writeFile(versionFilePath, JSON.stringify(versionData, null, 2));
        console.log(`Version index generated successfully at ${versionFilePath}`);
    } catch (error) {
        console.error("Error generating index:", error);
        process.exit(1);
    }
}
 
main();

