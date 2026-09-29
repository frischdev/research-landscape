function renderViz(rawData, activeCats, mode, isUniform, currentDataset) {
    d3.select("#viz").selectAll("*").remove();
    authorNodesMap.clear();

    const width = window.innerWidth;
    const height = window.innerHeight;

    svgSelection = d3.select("#viz").append("svg").attr("viewBox", `0 0 ${width} ${height}`);
    const mainG = svgSelection.append("g");

    zoomBehavior = d3.zoom().scaleExtent([0.02, 50]).on("zoom", (event) => mainG.attr("transform", event.transform));
    svgSelection.call(zoomBehavior);

    let rootData;
    
    if (mode === 'byMember') {
        const authors = processDataByMember(rawData, activeCats);
        if (authors.length === 0) return;

        if (currentDataset === 'Both') {
            const groupA = authors.filter(a => a.member_group === 'associated');
            const groupB = authors.filter(a => a.member_group === 'profs');
            rootData = {
                name: "Universe",
                children: [
                    { name: "Professors", isGroup: true, children: groupB },
                    { name: "Associated", isGroup: true, children: groupA }
                ]
            };
        } else {
            rootData = { name: "Universe", children: authors };
        }
    } else {
        const terms = processDataByCategory(rawData, activeCats);
        if (terms.length === 0) return;
        rootData = { name: "Universe", children: terms };
    }

    const root = d3.hierarchy(rootData);
    
    if (mode === 'byMember') {
        let hiddenChildren = new Map();
        const authorDepth = currentDataset === 'Both' ? 2 : 1;

        if (isUniform) {
            root.descendants().forEach(d => {
                if (d.depth === authorDepth && d.children) {
                    hiddenChildren.set(d, d.children);
                    d.children = null; 
                }
            });
            root.count(); 
        } else {
            root.sum(d => d.value);
        }

        root.sort((a, b) => {
            if (a.data.name === "Professors" && b.data.name === "Associated") return -1;
            if (a.data.name === "Associated" && b.data.name === "Professors") return 1;
            return b.value - a.value;
        });

        d3.pack().size([width * 5, height * 5]).padding(d => {
            if (currentDataset === 'Both') {
                if (d.depth === 0) return 50;      
                if (d.data.isGroup) return 30;     
                if (d.children) return 5;          
                return 0; 
            } else {
                if (d.depth === 0) return 30;      
                if (d.children) return 5;          
                return 0; 
            }
        })(root);

        if (isUniform) {
            hiddenChildren.forEach((children, authorNode) => {
                authorNode.children = children; 
                const miniRoot = d3.hierarchy(authorNode.data).sum(d => d.value);
                d3.pack().size([authorNode.r * 2, authorNode.r * 2]).padding(2)(miniRoot);
                authorNode.children.forEach((termNode, i) => {
                    const miniTerm = miniRoot.children[i];
                    termNode.r = miniTerm.r;
                    termNode.x = authorNode.x - authorNode.r + miniTerm.x;
                    termNode.y = authorNode.y - authorNode.r + miniTerm.y;
                });
            });
        }
    } else {
        root.sum(d => d.value).sort((a, b) => b.value - a.value);
        d3.pack().size([width * 5, height * 5]).padding(d => {
            if (d.depth === 0) return 90;      
            if (d.children) return 5;          
            return 0; 
        })(root);
    }

    if (mode === 'byMember') {
        root.descendants().forEach(d => {
            if (d.children && !d.data.isGroup && d.data.name !== "Universe") {
                authorNodesMap.set(d.data.name, d);
            }
        });
    }

    const initialScale = Math.min(width / (root.r * 2), height / (root.r * 2)) * 1.5;
    const initialX = width / 2 - root.x * initialScale;
    const initialY = height / 2 - root.y * initialScale;
    
    svgSelection.call(zoomBehavior.transform, d3.zoomIdentity.translate(initialX, initialY).scale(initialScale));

    const node = mainG.selectAll("g")
        .data(root.descendants().filter(d => d.depth > 0)) 
        .join("g")
        .attr("class", d => {
            if (mode === 'byMember') {
                if (d.data.isGroup) return "node node--group"; 
                if (d.children) return "node node--author";
                if (d.data.member_group === 'profs') return "node node--leaf group-p";
                return "node node--leaf";
            } else {
                if (d.children) return "node node--term";
                if (d.data.member_group === 'profs') return "node node--leaf group-p";
                return "node node--leaf";
            }
        })
        .attr("transform", d => `translate(${d.x},${d.y})`);

    node.append("circle")
        .attr("r", d => d.r)
        .on("click", (event, d) => {
            if (mode === 'byMember' && !d.children) { 
                event.stopPropagation();
                const termName = d.data.name;
                selectedTerms.has(termName) ? selectedTerms.delete(termName) : selectedTerms.add(termName);
                applyHighlighting();
            } else if (mode === 'byCategory' && !d.children) {
                event.stopPropagation();
                const clickedName = d.data.name;
                if (svgSelection.classed("has-highlight") && d3.select(event.currentTarget.parentNode).classed("is-highlighted")) {
                    svgSelection.classed("has-highlight", false);
                    node.classed("is-highlighted", false);
                } else {
                    svgSelection.classed("has-highlight", true);
                    node.classed("is-highlighted", nd => !nd.children && nd.data.name === clickedName);
                }
            }
        });

    if (mode === 'byCategory') {
        svgSelection.on("click", () => {
            svgSelection.classed("has-highlight", false);
            node.classed("is-highlighted", false);
        });
    }

    const containerNodes = mode === 'byMember' ? node.filter(d => d.children && !d.data.isGroup) : node.filter(d => d.children);
    containerNodes.each(function(d, i) {
        const g = d3.select(this);
        const arcRadius = d.r + 4; 
        const arcId = `arc-${i}`;
        
        g.append("path").attr("id", arcId).attr("class", "arc-path").attr("d", `M ${-arcRadius},0 A ${arcRadius},${arcRadius} 0 0,1 ${arcRadius},0`);
        const dynamicFontSize = Math.max(8, d.r * 0.13); 
        
        g.append("text").attr("class", mode === 'byMember' ? "author-arc-text" : "term-arc-text")
            .style("font-size", `${dynamicFontSize}px`).append("textPath").attr("href", `#${arcId}`)
            .attr("startOffset", "50%").attr("text-anchor", "middle").text(d.data.name);
    });

    if (mode === 'byMember') {
        const groupNodes = node.filter(d => d.data.isGroup);
        groupNodes.each(function(d, i) {
            const g = d3.select(this);
            const arcRadius = d.r + 15; 
            const arcId = `group-arc-${i}`; 
            g.append("path").attr("id", arcId).attr("class", "arc-path").attr("d", `M ${-arcRadius},0 A ${arcRadius},${arcRadius} 0 0,1 ${arcRadius},0`);
            g.append("text").attr("class", "group-text").style("font-size", "50px").style("font-weight", "bold").style("text-transform", "uppercase")
             .append("textPath").attr("href", `#${arcId}`).attr("startOffset", "50%").attr("text-anchor", "middle").text(d.data.name);
        });
    }

    const leafNodes = node.filter(d => !d.children).append("text").attr("class", mode === 'byMember' ? "term-text" : "author-text");
    leafNodes.call(wrapAndFitText);
    
    if (mode === 'byMember') applyHighlighting(); 
}

function wrapAndFitText(textSelection) {
    textSelection.each(function(d) {
        const textElement = d3.select(this);
        const r = d.r;
        const maxSquareSide = r * Math.sqrt(2) * 1; 
        const textStr = d.data.name;
        const words = textStr.split(/\s+/).reverse();
        
        textElement.style("font-size", "14px"); 
        let tspan = textElement.text(null).append("tspan").attr("x", 0).attr("y", 0).attr("dy", 0);

        tspan.text(textStr);
        const totalWidth = tspan.node().getComputedTextLength();
        const idealWrapWidth = Math.max(Math.sqrt(totalWidth * 14 * 1.2), 14); 

        tspan.text(null);
        let word;
        let line = [];
        let lineNumber = 0;
        const lineHeight = 1.1; 
        
        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            
            if (tspan.node().getComputedTextLength() > idealWrapWidth && line.length > 1) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = textElement.append("tspan").attr("x", 0).attr("y", 0).attr("dy", ++lineNumber * lineHeight + "em").text(word);
            }
        }

        const bbox = textElement.node().getBBox();
        const scale = Math.min(maxSquareSide / bbox.width, maxSquareSide / bbox.height);
        const yOffset = -(bbox.height * scale) / 2 - (bbox.y * scale);
        textElement.attr("transform", `translate(0, ${yOffset}) scale(${scale})`);
    });
}

function applyHighlighting() {
    if (currentMode !== 'byMember') return;

    d3.selectAll(".node--leaf").classed("selected", d => selectedTerms.has(d.data.name));

    const container = document.getElementById('panel-container');
    const list = document.getElementById('author-list');
    list.innerHTML = ''; 
    currentMatches = [];

    if (selectedTerms.size > 0) {
        d3.selectAll(".node--author").each(function(d) {
            const matches = d.data.children.filter(child => selectedTerms.has(child.name)).map(child => child.name);
            if (matches.length > 0) {
                currentMatches.push({ 
                    name: d.data.name, url: d.data.external_link, terms: Array.from(new Set(matches)) 
                });
            }
        });

        if (currentMatches.length > 0) {
            container.style.display = 'block';
            currentMatches.sort((a, b) => a.name.localeCompare(b.name)).forEach(res => {
                const li = document.createElement('li');
                let linkHtml = res.url ? ` <span>(<a href="${res.url}" target="_blank" class="author-link">Link</a>)</span>` : "";
                li.innerHTML = `
                    <div>
                        <span class="focus-btn" onclick="flyToAuthor('${res.name.replace(/'/g, "\\'")}')">→ </span>
                        <strong>${res.name}: </strong><span class="matched-terms">${res.terms.join(', ')}</span>
                    </div>
                    
                `;
                list.appendChild(li);
            });
        } else { container.style.display = 'none'; }
    } else { container.style.display = 'none'; }
}

window.flyToAuthor = function(authorName) {
    const targetNode = authorNodesMap.get(authorName);
    if (!targetNode || !svgSelection || !zoomBehavior) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    
    const targetScale = Math.min(10, Math.min(width, height) / (targetNode.r * 2.5));
    const targetX = width / 2 - targetNode.x * targetScale;
    const targetY = height / 2 - targetNode.y * targetScale;

    svgSelection.transition().duration(1200).ease(d3.easeCubicInOut)
        .call(zoomBehavior.transform, d3.zoomIdentity.translate(targetX, targetY).scale(targetScale));
};
