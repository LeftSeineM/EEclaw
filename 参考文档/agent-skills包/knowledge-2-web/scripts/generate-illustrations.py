#!/usr/bin/env python3
"""
Knowledge Article Illustration Generator
知识文章插图生成器

为知识类文章（历史、科学、文化等）生成配图

Usage:
    python generate-illustrations.py <topic> <sections_json> [api_key] [--images N] [--style STYLE]

Arguments:
    topic           文章主题（如：安史之乱、工业革命）
    sections_json   章节信息的JSON文件路径
    api_key         Google API key (optional if GOOGLE_API_KEY env var is set)
    --images N      Number of images to generate (default: 5)
    --style STYLE   Image style: historical, scientific, cultural (default: historical)
    --ratio RATIO   Image aspect ratio (default: 16:9)
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
DEFAULT_ASPECT_RATIO = "16:9"
DEFAULT_STYLE = "historical"

# Get script directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(SCRIPT_DIR)

# Output directory
OUTPUT_DIR = os.path.join(os.getcwd(), "output", "knowledge-illustrations")

# Style presets for different knowledge types
STYLE_PRESETS = {
    "historical": {
        "base": "Traditional Chinese painting style, historical scene, elegant composition, soft lighting, muted colors, artistic interpretation",
        "atmosphere": "ancient, historical, solemn, cultural heritage"
    },
    "scientific": {
        "base": "Scientific illustration style, clean and precise, educational diagram, modern design, clear visualization",
        "atmosphere": "technical, precise, informative, modern"
    },
    "cultural": {
        "base": "Cultural art style, vibrant colors, traditional patterns, artistic expression, cultural symbols",
        "atmosphere": "cultural, artistic, traditional, symbolic"
    },
    "nature": {
        "base": "Nature photography style, realistic, beautiful landscape, natural lighting, serene atmosphere",
        "atmosphere": "natural, peaceful, scenic, organic"
    }
}


def generate_knowledge_prompts(topic, sections, num_images, style):
    """
    Generate image prompts for knowledge article sections.

    Args:
        topic: Main topic of the article
        sections: List of section dictionaries with 'title' and 'description'
        num_images: Number of images to generate
        style: Visual style (historical, scientific, cultural, nature)

    Returns:
        List of scene dictionaries with 'prompt', 'caption', 'filename'
    """
    print(f"\n正在为《{topic}》生成 {num_images} 个插图提示词...")

    style_preset = STYLE_PRESETS.get(style, STYLE_PRESETS["historical"])
    scenes = []

    # First image: Overall topic visualization (header/hero image)
    scenes.append({
        "prompt": f"A comprehensive visual representation of '{topic}', {style_preset['base']}, {style_preset['atmosphere']} atmosphere, wide composition, suitable as header image",
        "caption": f"《{topic}》",
        "section": "header"
    })

    # Distribute remaining images across sections
    if num_images > 1 and len(sections) > 0:
        # Calculate how many images per section
        images_per_section = max(1, (num_images - 1) // len(sections))
        remaining_images = (num_images - 1) % len(sections)

        image_count = 0
        for section_idx, section in enumerate(sections):
            # Determine how many images for this section
            section_images = images_per_section
            if section_idx < remaining_images:
                section_images += 1

            if image_count >= num_images - 1:
                break

            section_title = section.get('title', f'Section {section_idx + 1}')
            section_desc = section.get('description', '')

            for i in range(section_images):
                if image_count >= num_images - 1:
                    break

                # Create contextual prompt based on section content
                prompt = f"Illustration for '{topic}' - {section_title}: {section_desc[:150]}... {style_preset['base']}, {style_preset['atmosphere']}, detailed and informative"

                scenes.append({
                    "prompt": prompt,
                    "caption": f"{section_title}",
                    "section": section_title
                })

                image_count += 1

    print(f"✓ 已生成 {len(scenes)} 个插图提示词")
    return scenes


def generate_image(client, prompt, filename, aspect_ratio, model):
    """
    Generates an image using Gemini API and saves it to filename.
    """
    print(f"正在生成图片: {filename}...")
    try:
        response = client.models.generate_content(
            model=model,
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_modalities=['IMAGE'],
                image_config=types.ImageConfig(
                    aspect_ratio=aspect_ratio
                )
            )
        )

        for part in response.candidates[0].content.parts:
            if part.inline_data:
                img = Image.open(io.BytesIO(part.inline_data.data))
                output_path = os.path.join(OUTPUT_DIR, filename)
                img.save(output_path)
                print(f"✓ 已保存到 {output_path}")
                return True
        return False
    except Exception as e:
        print(f"✗ 生成 {filename} 时出错: {e}")
        return False


def load_sections(sections_file):
    """Load section information from JSON file."""
    if not os.path.exists(sections_file):
        print(f"警告: 章节文件不存在: {sections_file}")
        return []

    try:
        with open(sections_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('sections', [])
    except Exception as e:
        print(f"警告: 读取章节文件失败: {e}")
        return []


def save_image_manifest(topic, generated_images):
    """Save a manifest file with image information for HTML generation."""
    manifest = {
        "topic": topic,
        "images": generated_images,
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    manifest_file = os.path.join(OUTPUT_DIR, f"{topic}_manifest.json")
    with open(manifest_file, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"✓ 图片清单已保存: {manifest_file}")
    return manifest_file


def main():
    """Main processing function."""

    parser = argparse.ArgumentParser(
        description='Generate illustrations for knowledge articles',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('topic', help='Article topic (e.g., 安史之乱, 工业革命)')
    parser.add_argument('sections_json', nargs='?', default='',
                        help='Path to sections JSON file (optional)')
    parser.add_argument('api_key', nargs='?',
                        help='Google API key (optional if GOOGLE_API_KEY env var is set)')
    parser.add_argument('--images', type=int, default=DEFAULT_IMAGE_COUNT,
                        help=f'Number of images to generate (default: {DEFAULT_IMAGE_COUNT})')
    parser.add_argument('--style', default=DEFAULT_STYLE,
                        choices=['historical', 'scientific', 'cultural', 'nature'],
                        help=f'Visual style (default: {DEFAULT_STYLE})')
    parser.add_argument('--model', default=DEFAULT_MODEL,
                        help=f'Gemini model to use (default: {DEFAULT_MODEL})')
    parser.add_argument('--ratio', default=DEFAULT_ASPECT_RATIO,
                        help=f'Image aspect ratio (default: {DEFAULT_ASPECT_RATIO})')

    args = parser.parse_args()

    # Get API key
    api_key = args.api_key or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("错误: 请提供 Google API key")
        print("方法1: python generate-illustrations.py <topic> <sections_json> <api_key>")
        print("方法2: 设置环境变量 GOOGLE_API_KEY")
        return 1

    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 60)
    print("知识文章插图生成器 (Knowledge Illustration Generator)")
    print("=" * 60)
    print(f"\n主题: {args.topic}")
    print(f"风格: {args.style}")
    print(f"图片数量: {args.images}")

    # Load sections if provided
    sections = []
    if args.sections_json:
        print(f"\n1. 读取章节信息: {args.sections_json}")
        sections = load_sections(args.sections_json)
        print(f"   ✓ 已加载 {len(sections)} 个章节")
    else:
        print("\n1. 未提供章节信息，将生成通用插图")

    # Initialize Gemini client
    print("\n2. 初始化 Gemini API 客户端...")
    try:
        client = genai.Client(api_key=api_key)
        print("   ✓ 客户端初始化成功")
    except Exception as e:
        print(f"错误: 初始化客户端失败: {e}")
        return 1

    # Generate scene prompts
    scenes = generate_knowledge_prompts(args.topic, sections, args.images, args.style)

    # Prepare filenames
    safe_topic = "".join(c for c in args.topic if c.isalnum() or c in (' ', '-', '_')).strip()
    safe_topic = safe_topic.replace(' ', '_')

    for i, scene in enumerate(scenes):
        if i == 0:
            scene['filename'] = f"{safe_topic}_header.png"
        else:
            scene['filename'] = f"{safe_topic}_{i}.png"

    # Generate images
    print(f"\n3. 生成 {len(scenes)} 张插图...")
    print(f"   模型: {args.model}")
    print(f"   比例: {args.ratio}")

    generated_images = []
    for i, scene in enumerate(scenes, 1):
        print(f"\n   [{i}/{len(scenes)}] {scene['caption']}")
        success = generate_image(
            client,
            scene["prompt"],
            scene["filename"],
            args.ratio,
            args.model
        )
        if success:
            generated_images.append({
                "filename": scene["filename"],
                "caption": scene["caption"],
                "section": scene["section"],
                "prompt": scene["prompt"]
            })
        time.sleep(2)  # Rate limiting

    if not generated_images:
        print("\n错误: 没有成功生成任何图片")
        return 1

    print(f"\n   ✓ 成功生成 {len(generated_images)}/{len(scenes)} 张图片")

    # Save manifest
    print("\n4. 保存图片清单...")
    manifest_file = save_image_manifest(args.topic, generated_images)

    print("\n" + "=" * 60)
    print("✓ 处理完成!")
    print(f"输出目录: {OUTPUT_DIR}/")
    print(f"图片数量: {len(generated_images)} 张")
    print(f"清单文件: {manifest_file}")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    sys.exit(main())
