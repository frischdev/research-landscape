function processDataByMember(authors, activeCats) {
    return authors.map(author => {
        const termCounts = {};
        author.publications.forEach(pub => {
            activeCats.forEach(key => {
                let term = getTerm(pub, key);
                if (term) termCounts[term] = (termCounts[term] || 0) + 1;
            });
        });
        return { 
            name: author.author_full_name, 
            external_link: author.external_link, 
            member_group: author.member_group, 
            children: Object.entries(termCounts).map(([name, count]) => ({ 
                name: name, value: count, member_group: author.member_group 
            })) 
        };
    }).filter(a => a.children.length > 0);
}

function processDataByCategory(authors, activeCats) {
    const termMap = new Map();
    authors.forEach(author => {
        author.publications.forEach(pub => {
            activeCats.forEach(key => {
                let term = getTerm(pub, key);
                if (term) {
                    if (!termMap.has(term)) termMap.set(term, new Map());
                    const authorCounts = termMap.get(term);
                    authorCounts.set(author.author_full_name, (authorCounts.get(author.author_full_name) || 0) + 1);
                }
            });
        });
    });

    return Array.from(termMap.entries()).map(([termName, authorsMap]) => {
        return {
            name: termName,
            children: Array.from(authorsMap.entries()).map(([authorName, count]) => {
                const originalAuthor = authors.find(a => a.author_full_name === authorName);
                return {
                    name: authorName, value: count, member_group: originalAuthor ? originalAuthor.member_group : 'unknown'
                };
            })
        };
    }).filter(t => t.children.length > 0);
}

function getTerm(pub, key) {
    if (key === 'topic') return pub.taxonomy && pub.taxonomy.topic;
    if (pub.taxonomy_rev && pub.taxonomy_rev[key]) return pub.taxonomy_rev[key];
    if (pub.taxonomy && pub.taxonomy[key]) return pub.taxonomy[key];
    return null;
}
