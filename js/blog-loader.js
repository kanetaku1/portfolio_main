// Blog Loader - Markdownファイルからブログ記事を読み込む

const BLOG_POSTS_DIR = 'blog/posts/';

// ブログ記事のメタデータ（将来的にJSONファイルやAPIから取得）
const blogPosts = [
    {
        filename: '2023_4_cherry-blossom.md',
        category: 'travel',
        title: '私のお気に入り、春色の散歩道',
        date: '2023/04',
        thumbnail: 'img/DSC_0313.JPG',
        description: '地元の川辺で見つけた、心やすらぐ桜景色について書きました。',
        link: 'blog/2023_4_cherry-blossom.html'
    }
];

// Markdownファイルを読み込んでHTMLに変換
async function loadBlogPost(filename) {
    try {
        const response = await fetch(`${BLOG_POSTS_DIR}${filename}`);
        if (!response.ok) {
            throw new Error(`Failed to load ${filename}`);
        }
        const markdown = await response.text();
        return marked.parse(markdown);
    } catch (error) {
        console.error('Error loading blog post:', error);
        return null;
    }
}

// ブログ一覧を生成
function renderBlogPosts() {
    const blogPreview = document.getElementById('blog-preview');
    
    if (!blogPreview) return;
    
    // 既存のHTMLブログ記事はHTMLに直接記述されているため、
    // Markdownベースの記事のみ追加
    // 将来的にすべてのブログをMarkdown化する場合は、既存のHTMLカードを削除してから使用
    blogPosts.forEach(post => {
        // 既に存在する記事はスキップ（重複を避ける）
        const existingLink = blogPreview.querySelector(`a[href="${post.link}"]`);
        if (!existingLink) {
            const blogCard = createBlogCard(post);
            blogPreview.appendChild(blogCard);
        }
    });
}

// ブログカードを作成
function createBlogCard(post) {
    const card = document.createElement('div');
    card.className = 'blog-post-card';
    card.setAttribute('data-category', post.category);
    
    const categoryLabels = {
        'travel': '旅日記',
        'dev': '開発日記',
        'other': 'その他'
    };
    
    card.innerHTML = `
        <div class="blog-thumbnail">
            <img src="${post.thumbnail}" alt="${post.title}">
        </div>
        <div class="blog-content">
            <span class="blog-category">${categoryLabels[post.category] || 'その他'}</span>
            <h3>
                <a href="${post.link}">${post.title}</a>
            </h3>
            <p>${post.description}</p>
            <div class="blog-meta">
                <span class="date"><i class="far fa-calendar"></i> ${post.date}</span>
            </div>
        </div>
    `;
    
    return card;
}

// ページ読み込み時にブログ一覧を表示
document.addEventListener('DOMContentLoaded', function() {
    renderBlogPosts();
    
    // ブログカテゴリーフィルターを再初期化（main.jsの関数を使用）
    if (typeof initBlogFilter === 'function') {
        setTimeout(initBlogFilter, 100);
    }
});

// Markdownファイルのフロントマターをパース（YAML形式）
function parseFrontMatter(markdown) {
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = markdown.match(frontMatterRegex);
    
    if (!match) {
        return { metadata: {}, content: markdown };
    }
    
    const metadataText = match[1];
    const content = match[2];
    const metadata = {};
    
    // シンプルなYAMLパーサー（基本的なkey: value形式のみ対応）
    metadataText.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
            metadata[key] = value;
        }
    });
    
    return { metadata, content };
}

