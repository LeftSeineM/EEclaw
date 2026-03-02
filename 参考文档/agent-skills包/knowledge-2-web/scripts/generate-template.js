/**
 * Knowledge to Web Template Generator
 * 知识文章网页模板生成器
 */

function generateKnowledgeHTML(data) {
  const {
    title,
    subtitle,
    coreThesis,
    causes = [],
    timeline = [],
    impacts = [],
    perspectives = [],
    misconceptions = [],
    primaryColor = '#8B2B24',
    accentColor = '#B58D59',
    category = 'KNOWLEDGE'
  } = data;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - 知识卡片</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;700&family=Noto+Serif+SC:wght@700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-color: ${primaryColor};
            --bg-cream: #F9F5F1;
            --accent-color: ${accentColor};
            --text-dark: #3A3530;
            --card-border: #E5DED4;
        }

        body {
            background-color: var(--bg-cream);
            font-family: 'Noto Sans SC', sans-serif;
            color: var(--text-dark);
            line-height: 1.6;
        }

        h1, h2, .serif {
            font-family: 'Noto Serif SC', serif;
        }

        .card {
            background: white;
            border: 1px solid var(--card-border);
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            transition: transform 0.2s ease;
        }

        .card:hover {
            transform: translateY(-2px);
        }

        .header-line {
            width: 40px;
            height: 3px;
            background-color: var(--primary-color);
            margin-bottom: 1rem;
        }

        .icon-box {
            background-color: var(--primary-color);
            color: white;
            padding: 8px;
            border-radius: 6px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }

        .scroll-container::-webkit-scrollbar {
            height: 6px;
        }
        .scroll-container::-webkit-scrollbar-thumb {
            background: var(--accent-color);
            border-radius: 10px;
        }
    </style>
</head>
<body class="p-4 md:p-8">

    <!-- Header Section -->
    <header class="max-w-6xl mx-auto mb-12 text-center">
        <p class="text-gray-500 tracking-widest uppercase text-sm mb-2">${category}</p>
        <h1 class="text-4xl md:text-5xl text-[var(--primary-color)] mb-4">${title}</h1>
        <div class="flex justify-center items-center gap-4">
            <div class="h-[1px] w-12 bg-gray-300"></div>
            <p class="text-lg italic font-medium">${subtitle}</p>
            <div class="h-[1px] w-12 bg-gray-300"></div>
        </div>
        ${coreThesis ? `
        <div class="mt-8 bg-white p-6 rounded-lg border border-dashed border-[var(--accent-color)] max-w-3xl mx-auto">
            <h3 class="text-[var(--accent-color)] font-bold mb-2">核心命题</h3>
            <p class="text-xl">${coreThesis}</p>
        </div>
        ` : ''}
    </header>

    <main class="max-w-6xl mx-auto space-y-12">

        ${causes.length > 0 ? `
        <!-- Section 1: Causes/Background -->
        <section>
            <div class="flex items-center gap-2 mb-6">
                <div class="header-line"></div>
                <h2 class="text-2xl font-bold text-[var(--primary-color)]">${causes[0].sectionTitle || '深层原因'}</h2>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${causes.map(cause => `
                <div class="card p-5">
                    <div class="flex items-start gap-4">
                        <div class="icon-box shrink-0">
                            ${cause.icon || getDefaultIcon()}
                        </div>
                        <div>
                            <h4 class="font-bold text-lg mb-1">${cause.title}</h4>
                            <p class="text-sm text-gray-600">${cause.description}</p>
                        </div>
                    </div>
                </div>
                `).join('')}
            </div>
        </section>
        ` : ''}

        ${timeline.length > 0 ? `
        <!-- Section 2: Timeline -->
        <section>
            <div class="flex items-center gap-2 mb-6">
                <div class="header-line"></div>
                <h2 class="text-2xl font-bold text-[var(--primary-color)]">${timeline[0].sectionTitle || '发展历程'}</h2>
            </div>
            <div class="relative overflow-x-auto scroll-container pb-4">
                <div class="flex gap-6 min-w-[1200px]">
                    ${timeline.map((item, index) => `
                    <div class="flex-1">
                        <div class="text-[var(--primary-color)] font-bold mb-2">${item.time}</div>
                        <div class="card p-4 text-sm ${index === 0 || item.highlight ? 'border-t-4 border-t-[var(--primary-color)]' : ''}">
                            <p class="font-bold">${item.title}</p>
                            ${item.description}
                        </div>
                    </div>
                    `).join('')}
                </div>
            </div>
        </section>
        ` : ''}

        ${impacts.length > 0 ? `
        <!-- Section 3: Impact -->
        <section>
            <div class="flex items-center gap-2 mb-6">
                <div class="header-line"></div>
                <h2 class="text-2xl font-bold text-[var(--primary-color)]">深远影响</h2>
            </div>
            <ul class="space-y-4">
                ${impacts.map((impact, index) => `
                <li class="flex gap-4 items-start">
                    <span class="w-6 h-6 rounded-full bg-[var(--accent-color)] flex items-center justify-center text-white text-xs shrink-0 mt-1">${index + 1}</span>
                    <div>
                        <span class="font-bold">${impact.title}：</span>
                        <span class="text-gray-600">${impact.description}</span>
                    </div>
                </li>
                `).join('')}
            </ul>
        </section>
        ` : ''}

        ${perspectives.length > 0 ? `
        <!-- Section 4: Perspectives -->
        <section class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div class="bg-[var(--primary-color)] p-4 text-white">
                <h3 class="font-bold">多元视角</h3>
            </div>
            <div class="p-6 space-y-6">
                ${perspectives.map(p => `
                <div class="relative pl-6 border-l-2 border-gray-100">
                    <div class="absolute -left-2 top-0 w-4 h-4 rounded-full bg-gray-200"></div>
                    <p class="font-bold text-[var(--primary-color)] mb-1">${p.title}</p>
                    <p class="text-sm italic text-gray-500">"${p.quote}"</p>
                </div>
                `).join('')}
            </div>
        </section>
        ` : ''}

        ${misconceptions.length > 0 ? `
        <!-- Section 5: Misconceptions -->
        <section class="card p-8 bg-zinc-900 text-white">
            <h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
                <span class="text-yellow-500">⚠</span> 易错点纠偏
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                ${misconceptions.map(m => `
                <div class="space-y-2">
                    <p class="text-zinc-400">误区：${m.misconception}</p>
                    <p class="text-white">事实：${m.fact}</p>
                </div>
                `).join('')}
            </div>
        </section>
        ` : ''}
    </main>

    <footer class="max-w-6xl mx-auto mt-16 pt-8 border-t border-gray-200 text-center text-gray-400 text-sm pb-12">
        <p>《${title}》知识卡片 | 生成时间：${new Date().toLocaleDateString('zh-CN')}</p>
    </footer>

</body>
</html>`;
}

function getDefaultIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateKnowledgeHTML };
}
