document.addEventListener('DOMContentLoaded', async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const selectedUniId = localStorage.getItem('selectedUni');
    const path = urlParams.get('path') || `/${selectedUniId}`;
    const pathSegments = path.split('/').filter(Boolean);

    const pageTitleEl = document.getElementById('page-title');
    const cardContainer = document.getElementById('card-container');
    const siteTitleEl = document.getElementById('site-title');
    const toolbarContainer = document.getElementById('toolbar-container');
    const navContainer = document.getElementById('nav-container');

    navContainer.innerHTML = '<a href="javascript:history.back()" class="back-link">← Back</a>';

    if (!selectedUniId) {
        // This check is important, but there is no pageTitleEl in index.html
        if (pageTitleEl) pageTitleEl.textContent = 'No University Selected.';
        return;
    }

    try {
        const response = await fetch('./database.json');
        if (!response.ok) throw new Error("Database file not found.");
        const data = await response.json();
        const university = data.tree[selectedUniId];
        siteTitleEl.textContent = `${university.name} Med Portal`;

        let currentNode = university;
        for (const segment of pathSegments.slice(1)) {
            currentNode = currentNode.children[segment];
        }

        if (pageTitleEl) {
            if (pathSegments.length <= 1) {
                pageTitleEl.style.display = 'none';
            } else {
                pageTitleEl.style.display = 'block';
                pageTitleEl.textContent = currentNode.label || currentNode.name;
            }
        }

        cardContainer.innerHTML = '';
        toolbarContainer.innerHTML = '';

        // Logic now passes the correct 'type' to createResourceButton
        if (currentNode.resources) {
            if (currentNode.resources.collectionQuizzes) {
                currentNode.resources.collectionQuizzes.forEach(quiz => {
                    toolbarContainer.appendChild(createResourceButton(quiz.title, `quiz.html?collection=${quiz.id}&path=${path}`, 'quiz'));
                });
            }
            if (currentNode.resources.flashcardDecks) {
                currentNode.resources.flashcardDecks.forEach(deck => {
                    toolbarContainer.appendChild(createResourceButton(deck.title, `flashcards.html?collection=${deck.id}&path=${path}`, 'flashcards'));
                });
            }
        }

        if (currentNode.children) {
            for (const id in currentNode.children) {
                const childNode = currentNode.children[id];
                const newPath = `${path}/${id}`.replace(/\/\//g, '/');
                
                const targetUrl = childNode.isBranch
                    ? `lessons-list.html?path=${newPath}`
                    : `lesson.html?path=${newPath}`;
                
                const card = createCard(childNode.label, targetUrl, childNode.summary);
                cardContainer.appendChild(card);
            }
        }
    } catch (error) {
        console.error('Error:', error);
        if(pageTitleEl) pageTitleEl.textContent = `Error: ${error.message}`;
    }
});

// This function now assigns the correct class for lessons
function createCard(title, url, description) {
    const cardLink = document.createElement('a');
    cardLink.href = url;
    cardLink.className = 'card card--lesson'; // Assigns the lesson identity
    cardLink.innerHTML = `<div class="card-content"><h2>${title}</h2></div>`;
    return cardLink;
}

// This function now assigns a class based on the resource type
function createResourceButton(text, url, type) {
    const button = document.createElement('a');
    button.href = url;
    // Assigns a dynamic class like 'card--quiz' or 'card--flashcards'
    button.className = `card card--${type}`;
    button.innerHTML = `<h2>${text}</h2>`;
    return button;
}
