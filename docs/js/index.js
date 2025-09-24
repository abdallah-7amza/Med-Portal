// This is the corrected browser-compatible script for docs/js/index.js

document.addEventListener('DOMContentLoaded', () => {
    const universitiesContainer = document.getElementById('universities-container');
    
    // Dynamically determine the base path for the API calls.
    // This makes sure it works correctly on GitHub Pages.
    const basePath = window.location.pathname.replace(/\/$/, ''); // Remove trailing slash if it exists

    // Fetch the version.json file using the correct path.
    fetch(`${basePath}/version.json`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Could not fetch version.json, status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const universityIds = Object.keys(data.hashes);

            universityIds.forEach(uniId => {
                // Fetch the specific meta.json file for this university using the correct path.
                fetch(`${basePath}/api/universities/${uniId}/meta.json`)
                    .then(res => {
                        if (!res.ok) {
                            throw new Error(`Could not fetch meta.json for ${uniId}, status: ${res.status}`);
                        }
                        return res.json();
                    })
                    .then(uniData => {
                        const card = document.createElement('div');
                        card.className = 'card';
                        card.innerHTML = `<h2>${uniData.label}</h2>`;
                        
                        card.addEventListener('click', () => {
                            // Construct the URL for the lessons page correctly.
                            // The path to lessons-list.html is relative from the root of the site.
                            window.location.href = `lessons-list.html?uni=${uniId}`;
                        });

                        universitiesContainer.appendChild(card);
                    })
                    .catch(error => {
                        console.error("Failed to load university details:", error);
                    });
            });
        })
        .catch(error => {
            console.error("Failed to load university data:", error);
            universitiesContainer.innerHTML = '<p class="error-message">Error loading content. Please check the console for details.</p>';
        });
});
