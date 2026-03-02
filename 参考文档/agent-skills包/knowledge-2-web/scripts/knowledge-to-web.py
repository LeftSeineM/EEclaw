#!/usr/bin/env python3
"""
Knowledge Article to Web Generator
知识文章网页生成器（含插图）

将知识文章内容转换为精美的HTML网页，并自动生成配图

Usage:
    python knowledge-to-web.py <content_json> [api_key] [--images N] [--style STYLE]

Arguments:
    content_json    文章内容的JSON文件路径
    api_key         Google API key (optional if GOOGLE_API_KEY env var is set)
    --images N      Number of images to generate (default: 5)
    --style STYLE   Image style: historical, scientific, cultural, nature (default: historical)
    --no-images     Skip image generation, use placeholders instead
"""

import os
import sys
import json
import time
import io
import argparse
from google import genai
from google.genai import types
from PIL import Image

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# --- Configuration ---
DEFAULT_MODEL = "gemini-2.5-flash-image"
DEFAULT_IMAGE_COUNT = 5
DEFAULT_STYLE = "historical"

# Get script directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(SCRIPT_DIR)

# Output directory
OUTPUT_DIR = os.path.join(os.getcwd(), "output", "knowledge-web")

# Style presets
STYLE_PRESETS = {
    "historical": "Traditional Chinese painting style, historical scene, elegant composition, soft lighting, muted colors",
    "scientific": "Scientific illustration style, clean and precise, educational diagram, modern design",
    "cultural": "Cultural art style, vibrant colors, traditional patterns, artistic expression",
    "nature": "Nature photography style, realistic, beautiful landscape, natural lighting"
}


def generate_image_with_gemini(client, prompt, filename, model):
    """Generate image using Gemini API."""
    print(f"  正在生成: {filename}...")
    try:
        response = client.models.generate_content(
            model=model,
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_modalities=['IMAGE'],
                image_config=types.ImageConfig(aspect_ratio="16:9")
            )
        )

        for part in response.candidates[0].content.parts:
            if part.inline_data:
                img = Image.open(io.BytesIO(part.inline_data.data))
                output_path = os.path.join(OUTPUT_DIR, filename)
                img.save(output_path)
                print(f"  ✓ 已保存: {filename}")
                return filename
        return None
    except Exception as e:
        print(f"  ✗ 生成失败: {e}")
        return None


def generate_illustrations(client, topic, sections, num_images, style, model):
    """Generate illustrations for the knowledge article."""
    print(f"\n生成 {num_images} 张插图...")

    style_desc = STYLE_PRESETS.get(style, STYLE_PRESETS["historical"])
    images = []

    # Header image
    prompt = f"A comprehensive visual representation of '{topic}', {style_desc}, wide composition, header image"
    filename = f"{topic.replace(' ', '_')}_header.png"
    result = generate_image_with_gemini(client, prompt, filename, model)
    if result:
        images.append({"filename": result, "caption": topic, "section": "header"})
    time.sleep(2)

    # Section images
    if num_images > 1 and sections:
        for i, section in enumerate(sections[:num_images-1]):
            section_title = section.get('title', f'Section {i+1}')
            section_desc = section.get('description', '')[:100]

            prompt = f"Illustration for '{topic}' - {section_title}: {section_desc}, {style_desc}"
            filename = f"{topic.replace(' ', '_')}_{i+1}.png"

            result = generate_image_with_gemini(client, prompt, filename, model)
            if result:
                images.append({"filename": result, "caption": section_title, "section": section_title})
            time.sleep(2)

    return images


def generate_html(data, images):
    """Generate HTML from knowledge article data and images."""

    title = data.get('title', '知识文章')
    subtitle = data.get('subtitle', '')
    core_thesis = data.get('coreThesis', '')
    causes = data.get('causes', [])
    timeline = data.get('timeline', [])
    impacts = data.get('impacts', [])
    perspectives = data.get('perspectives', [])
    misconceptions = data.get('misconceptions', [])
    primary_color = data.get('primaryColor', '#8B2B24')
    accent_color = data.get('accentColor', '#B58D59')

    # Get header image
    header_image = images[0]['filename'] if images else 'placeholder.png'

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - 知识卡片</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;700&family=Noto+Serif+SC:wght@700&display=swap" rel="stylesheet">
    <style>
        :root {{
            --primary-color: {primary_color};
            --bg-cream: #F9F5F1;
            --accent-color: {accent_color};
            --text-dark: #3A3530;
            --card-border: #E5DED4;
        }}

        body {{
            background-color: var(--bg-cream);
            font-family: 'Noto Sans SC', sans-serif;
            color: var(--text-dark);
            line-height: 1.6;
        }}

        h1, h2, .serif {{
            font-family: 'Noto Serif SC', serif;
        }}

        .card {{
            background: white;
            border: 1px solid var(--card-border);
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            transition: transform 0.2s ease;
        }}

        .card:hover {{
            transform: translateY(-2px);
        }}

        .header-line {{
            width: 40px;
            height: 3px;
            background-color: var(--primary-color);
            margin-bottom: 1rem;
        }}

        .icon-box {{
            background-color: var(--primary-color);
            color: white;
            padding: 8px;
            border-radius: 6px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }}

        .article-image {{
            margin: 2rem 0;
            text-align: center;
        }}

        .article-image img {{
            width: 100%;
            max-width: 800px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }}

        .image-caption {{
            display: block;
            margin-top: 0.5rem;
            font-size: 0.875rem;
            color: #666;
            font-style: italic;
        }}

        .scroll-container::-webkit-scrollbar {{
            height: 6px;
        }}
        .scroll-container::-webkit-scrollbar-thumb {{
            background: var(--accent-color);
            border-radius: 10px;
        }}
    </style>
</head>
<body class="p-4 md:p-8">

    <!-- Header Section -->
    <header class="max-w-6xl mx-auto mb-12">
        <div class="article-image mb-8">
            <img src="{header_image}" alt="{title}">
        </div>
        <div class="text-center">
            <p class="text-gray-500 tracking-widest uppercase text-sm mb-2">KNOWLEDGE</p>
            <h1 class="text-4xl md:text-5xl text-[var(--primary-color)] mb-4">{title}</h1>
            <div class="flex justify-center items-center gap-4">
                <div class="h-[1px] w-12 bg-gray-300"></div>
                <p class="text-lg italic font-medium">{subtitle}</p>
                <div class="h-[1px] w-12 bg-gray-300"></div>
            </div>
"""

    if core_thesis:
        html += f"""
            <div class="mt-8 bg-white p-6 rounded-lg border border-dashed border-[var(--accent-color)] max-w-3xl mx-auto">
                <h3 class="text-[var(--accent-color)] font-bold mb-2">核心命题</h3>
                <p class="text-xl">{core_thesis}</p>
            </div>
"""

    html += """
        </div>
    </header>

    <main class="max-w-6xl mx-auto space-y-12">
"""

    # Causes section
    if causes:
        html += """
        <section>
            <div class="flex items-center gap-2 mb-6">
                <div class="header-line"></div>
                <h2 class="text-2xl font-bold text-[var(--primary-color)]">深层原因</h2>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
"""
        for cause in causes:
            html += f"""
                <div class="card p-5">
                    <div class="flex items-start gap-4">
                        <div class="icon-box shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </div>
                        <div>
                            <h4 class="font-bold text-lg mb-1">{cause.get('title', '')}</h4>
                            <p class="text-sm text-gray-600">{cause.get('description', '')}</p>
                        </div>
                    </div>
                </div>
"""
        html += """
            </div>
        </section>
"""

    # Add section image if available
    if len(images) > 1:
        html += f"""
        <div class="article-image">
            <img src="{images[1]['filename']}" alt="{images[1]['caption']}">
            <span class="image-caption">{images[1]['caption']}</span>
        </div>
"""

    # Timeline section
    if timeline:
        html += """
        <section>
            <div class="flex items-center gap-2 mb-6">
                <div class="header-line"></div>
                <h2 class="text-2xl font-bold text-[var(--primary-color)]">发展历程</h2>
            </div>
            <div class="relative overflow-x-auto scroll-container pb-4">
                <div class="flex gap-6 min-w-[1200px]">
"""
        for i, item in enumerate(timeline):
            border_class = 'border-t-4 border-t-[var(--primary-color)]' if i == 0 else ''
            html += f"""
                    <div class="flex-1">
                        <div class="text-[var(--primary-color)] font-bold mb-2">{item.get('time', '')}</div>
                        <div class="card p-4 text-sm {border_class}">
                            <p class="font-bold">{item.get('title', '')}</p>
                            {item.get('description', '')}
                        </div>
                    </div>
"""
        html += """
                </div>
            </div>
        </section>
"""

    # Add another section image if available
    if len(images) > 2:
        html += f"""
        <div class="article-image">
            <img src="{images[2]['filename']}" alt="{images[2]['caption']}">
            <span class="image-caption">{images[2]['caption']}</span>
        </div>
"""

    # Impacts section
    if impacts:
        html += """
        <section>
            <div class="flex items-center gap-2 mb-6">
                <div class="header-line"></div>
                <h2 class="text-2xl font-bold text-[var(--primary-color)]">深远影响</h2>
            </div>
            <ul class="space-y-4">
"""
        for i, impact in enumerate(impacts, 1):
            html += f"""
                <li class="flex gap-4 items-start">
                    <span class="w-6 h-6 rounded-full bg-[var(--accent-color)] flex items-center justify-center text-white text-xs shrink-0 mt-1">{i}</span>
                    <div>
                        <span class="font-bold">{impact.get('title', '')}：</span>
                        <span class="text-gray-600">{impact.get('description', '')}</span>
                    </div>
                </li>
"""
        html += """
            </ul>
        </section>
"""

    # Perspectives section
    if perspectives:
        html += """
        <section class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div class="bg-[var(--primary-color)] p-4 text-white">
                <h3 class="font-bold">多元视角</h3>
            </div>
            <div class="p-6 space-y-6">
"""
        for p in perspectives:
            html += f"""
                <div class="relative pl-6 border-l-2 border-gray-100">
                    <div class="absolute -left-2 top-0 w-4 h-4 rounded-full bg-gray-200"></div>
                    <p class="font-bold text-[var(--primary-color)] mb-1">{p.get('title', '')}</p>
                    <p class="text-sm italic text-gray-500">"{p.get('quote', '')}"</p>
                </div>
"""
        html += """
            </div>
        </section>
"""

    # Misconceptions section
    if misconceptions:
        html += """
        <section class="card p-8 bg-zinc-900 text-white">
            <h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
                <span class="text-yellow-500">⚠</span> 易错点纠偏
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
"""
        for m in misconceptions:
            html += f"""
                <div class="space-y-2">
                    <p class="text-zinc-400">误区：{m.get('misconception', '')}</p>
                    <p class="text-white">事实：{m.get('fact', '')}</p>
                </div>
"""
        html += """
            </div>
        </section>
"""

    html += f"""
    </main>

    <footer class="max-w-6xl mx-auto mt-16 pt-8 border-t border-gray-200 text-center text-gray-400 text-sm pb-12">
        <p>《{title}》知识卡片 | 生成时间：{time.strftime('%Y-%m-%d')}</p>
    </footer>

</body>
</html>
"""

    return html


def main():
    parser = argparse.ArgumentParser(
        description='Generate knowledge article web page with illustrations',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('content_json', help='Path to content JSON file')
    parser.add_argument('api_key', nargs='?',
                        help='Google API key (optional if GOOGLE_API_KEY env var is set)')
    parser.add_argument('--images', type=int, default=DEFAULT_IMAGE_COUNT,
                        help=f'Number of images to generate (default: {DEFAULT_IMAGE_COUNT})')
    parser.add_argument('--style', default=DEFAULT_STYLE,
                        choices=['historical', 'scientific', 'cultural', 'nature'],
                        help=f'Visual style (default: {DEFAULT_STYLE})')
    parser.add_argument('--model', default=DEFAULT_MODEL,
                        help=f'Gemini model (default: {DEFAULT_MODEL})')
    parser.add_argument('--no-images', action='store_true',
                        help='Skip image generation')

    args = parser.parse_args()

    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 60)
    print("知识文章网页生成器 (Knowledge to Web Generator)")
    print("=" * 60)

    # Load content
    print(f"\n1. 读取文章内容: {args.content_json}")
    try:
        with open(args.content_json, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"   ✓ 标题: {data.get('title', 'N/A')}")
    except Exception as e:
        print(f"错误: 读取内容失败: {e}")
        return 1

    # Generate images
    images = []
    if not args.no_images:
        api_key = args.api_key or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            print("\n警告: 未提供 API key，跳过图片生成")
        else:
            print("\n2. 初始化 Gemini API...")
            try:
                client = genai.Client(api_key=api_key)
                print("   ✓ 客户端初始化成功")

                # Extract sections for image generation
                sections = []
                if data.get('causes'):
                    sections.extend([{'title': c.get('title', ''), 'description': c.get('description', '')}
                                     for c in data['causes']])
                if data.get('timeline'):
                    sections.extend([{'title': t.get('title', ''), 'description': t.get('description', '')}
                                     for t in data['timeline']])

                images = generate_illustrations(
                    client,
                    data.get('title', 'Knowledge'),
                    sections,
                    args.images,
                    args.style,
                    args.model
                )
                print(f"\n   ✓ 成功生成 {len(images)} 张图片")
            except Exception as e:
                print(f"   ✗ 图片生成失败: {e}")

    # Generate HTML
    print(f"\n3. 生成 HTML 文件...")
    try:
        html_content = generate_html(data, images)
        safe_title = "".join(c for c in data.get('title', 'knowledge') if c.isalnum() or c in (' ', '-', '_')).strip()
        output_file = os.path.join(OUTPUT_DIR, f"{safe_title}.html")

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html_content)

        print(f"   ✓ HTML已生成: {output_file}")
    except Exception as e:
        print(f"错误: 生成HTML失败: {e}")
        return 1

    print("\n" + "=" * 60)
    print("✓ 处理完成!")
    print(f"输出目录: {OUTPUT_DIR}/")
    print(f"HTML文件: {output_file}")
    if images:
        print(f"图片数量: {len(images)} 张")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    sys.exit(main())
