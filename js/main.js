// Golcha Works - Main JavaScript
// スムーススクロール、アニメーション、インタラクティブ要素

document.addEventListener('DOMContentLoaded', function() {
    // スムーススクロール
    initSmoothScroll();
    
    // スクロールアニメーション
    initScrollAnimations();
    
    // ブログカテゴリーフィルター
    initBlogFilter();
    
    // プロジェクトカードのホバーエフェクト
    initProjectCards();
});

// スムーススクロール
function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // 空のハッシュやJavaScriptリンクは無視
            if (href === '#' || href.startsWith('#!')) {
                return;
            }
            
            const target = document.querySelector(href);
            
            if (target) {
                e.preventDefault();
                
                const headerHeight = document.querySelector('header').offsetHeight;
                const targetPosition = target.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// スクロールアニメーション
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // アニメーション対象要素を監視
    const animateElements = document.querySelectorAll(
        '.project-card, .blog-post-card, .skill-category, .info-card'
    );
    
    animateElements.forEach(el => {
        observer.observe(el);
    });
}

// ブログカテゴリーフィルター
function initBlogFilter() {
    const categoryButtons = document.querySelectorAll('.category-btn');
    const blogCards = document.querySelectorAll('.blog-post-card');
    
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            
            // アクティブ状態の更新
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // カードの表示/非表示
            blogCards.forEach(card => {
                const cardCategory = card.getAttribute('data-category');
                
                if (category === 'all' || cardCategory === category) {
                    card.style.display = 'block';
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    }, 10);
                } else {
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(20px)';
                    setTimeout(() => {
                        card.style.display = 'none';
                    }, 300);
                }
            });
        });
    });
}

// プロジェクトカードのホバーエフェクト
function initProjectCards() {
    const projectCards = document.querySelectorAll('.project-card');
    
    projectCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
}

// プロジェクトデータの読み込み（将来的にJSONファイルから読み込むことも可能）
function loadProjects() {
    // ここでプロジェクトデータを読み込む
    // 例: fetch('data/projects.json').then(...)
}

// ヘッダーのスクロール時のスタイル変更
let lastScroll = 0;
window.addEventListener('scroll', function() {
    const header = document.querySelector('header');
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        header.style.boxShadow = '0 5px 20px rgba(0, 0, 0, 0.5)';
    } else {
        header.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.3)';
    }
    
    lastScroll = currentScroll;
});

