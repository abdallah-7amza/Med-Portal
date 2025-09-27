document.addEventListener('DOMContentLoaded', async function() {
    const cardContainer = document.getElementById('universities-container');
    if (!cardContainer) return; // Only run on the homepage

    cardContainer.innerHTML = '<div>Loading universities...</div>';

    try {
        const response = await fetch('database.json');
        if (!response.ok) throw new Error('Failed to load database.');
        const data = await response.json();

        cardContainer.innerHTML = ''; // Clear loading message

        if (!data.tree || Object.keys(data.tree).length === 0) {
            cardContainer.innerHTML = '<div>No universities found.</div>';
            return;
        }

        for (const uniId in data.tree) {
            const university = data.tree[uniId];

            const card = document.createElement('a');
            card.href = `lessons-list.html?path=/${uniId}`;
            card.className = 'card';
            card.innerHTML = `<h2>${university.name}</h2>`;

            card.addEventListener('click', function(event) {
                event.preventDefault(); 
                localStorage.setItem('selectedUni', uniId);
                window.location.href = card.href;
            });

            cardContainer.appendChild(card);
        }
    } catch (error) {
        console.error('Error:', error);
        cardContainer.innerHTML = '<div>Error loading universities. Please try again later.</div>';
    }
});
