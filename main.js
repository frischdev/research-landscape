let masterData = [];
let currentDataset = 'Both'; 
let currentMode = 'byMember'; 
let selectedTerms = new Set();
let currentMatches = [];
let zoomBehavior; 
let svgSelection;
let authorNodesMap = new Map();

function getDatasetState() {
    const aChecked = document.getElementById('check-a').checked;
    const bChecked = document.getElementById('check-b').checked;
    if (aChecked && bChecked) return 'Both';
    if (aChecked) return 'A';
    if (bChecked) return 'B';
    return 'None';
}

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loader').style.display = 'flex';
    fetch('data.json')
        .then(res => res.json())
        .then(data => {
            masterData = data;
            currentDataset = getDatasetState();
            updateViz();
        })
        .catch(e => {
            console.error("data.json not found.", e);
            document.getElementById('loader').style.display = 'none';
        });
});

document.querySelectorAll('.data-filter, .cat-filter').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        if (checkbox.classList.contains('data-filter')) currentDataset = getDatasetState();
        selectedTerms.clear();
        updateViz();
    });
});

document.getElementById('layout-toggle').addEventListener('change', updateViz);
document.getElementById('btn-group-member').addEventListener('click', () => setMode('byMember'));
document.getElementById('btn-group-category').addEventListener('click', () => setMode('byCategory'));

function setMode(mode) {
    if (currentMode === mode) return;
    currentMode = mode;
    
    document.getElementById('btn-group-member').classList.toggle('grouping-switch-active', mode === 'byMember');
    document.getElementById('btn-group-category').classList.toggle('grouping-switch-active', mode === 'byCategory');
	document.getElementById('select-top-btn-when-grouped-by-category').classList.toggle('top-btn-when-grouped-by-category', mode === 'byCategory');
    
    const layoutControl = document.getElementById('layout-control');
    const layoutHr = document.getElementById('layout-hr');
    const panelContainer = document.getElementById('panel-container');
    const domainFilter = document.getElementById('domain-filter-container');
    
    if (mode === 'byCategory') {
        layoutControl.style.display = 'none';
        layoutHr.style.display = 'none';
        panelContainer.style.display = 'none';
        domainFilter.style.display = 'none';
        selectedTerms.clear();
    } else {
        layoutControl.style.display = 'block';
        layoutHr.style.display = 'block';
        domainFilter.style.display = 'block';
    }
    updateViz();
}

document.getElementById('clear-btn').addEventListener('click', () => {
    selectedTerms.clear();
    applyHighlighting();
});

document.getElementById('copy-btn').addEventListener('click', () => {
    if (currentMatches.length === 0) return;
    const textToCopy = currentMatches.map(res => {
        const linkPart = res.url ? ` | Link: ${res.url}` : "";
        return `${res.name} (${res.terms.join(', ')})${linkPart}`;
    }).join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
        const btn = document.getElementById('copy-btn');
        const originalText = btn.innerText;
        btn.innerText = "Copied";
        setTimeout(() => btn.innerText = originalText, 2000);
    });
});

function updateViz() {
    let dataToRender = [];
    if (currentDataset === 'A') dataToRender = masterData.filter(d => d.member_group === 'associated');
    else if (currentDataset === 'B') dataToRender = masterData.filter(d => d.member_group === 'profs');
    else if (currentDataset === 'Both') dataToRender = masterData;

    if (dataToRender.length === 0) {
        document.getElementById('loader').style.display = 'none';
        d3.select("#viz").selectAll("*").remove(); 
        document.getElementById('panel-container').style.display = 'none';
        return;
    }

    const activeCats = Array.from(document.querySelectorAll('.cat-filter:checked')).map(cb => cb.value);
    const isUniform = document.getElementById('layout-toggle').checked;
    
    document.getElementById('loader').style.display = 'flex';
    setTimeout(() => {
        renderViz(dataToRender, activeCats, currentMode, isUniform, currentDataset);
        document.getElementById('loader').style.display = 'none';
    }, 50); 
}
