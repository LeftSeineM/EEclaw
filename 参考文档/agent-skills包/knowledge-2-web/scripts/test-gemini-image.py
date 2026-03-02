#!/usr/bin/env python3
"""
Simple test script for Gemini Image API
测试Gemini图片生成API
"""

from google import genai
from google.genai import types
from PIL import Image
import os
import sys

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

def test_image_generation(api_key=None):
    """Test basic image generation with Gemini API."""

    # Get API key
    api_key = api_key or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("错误: 请提供 Google API key")
        print("用法: python test-gemini-image.py [api_key]")
        print("或设置环境变量: GOOGLE_API_KEY")
        return 1

    print("=" * 60)
    print("Gemini Image API 测试")
    print("=" * 60)

    # Initialize client
    print("\n1. 初始化客户端...")
    try:
        client = genai.Client(api_key=api_key)
        print("   ✓ 客户端初始化成功")
    except Exception as e:
        print(f"   ✗ 初始化失败: {e}")
        return 1

    # Test prompt
    prompt = "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme"
    print(f"\n2. 生成图片...")
    print(f"   提示词: {prompt}")

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[prompt],
        )

        print("   ✓ API调用成功")

        # Save image
        for part in response.parts:
            if part.text is not None:
                print(f"   文本响应: {part.text}")
            elif part.inline_data is not None:
                image = part.as_image()
                output_file = "generated_image.png"
                image.save(output_file)
                print(f"   ✓ 图片已保存: {output_file}")

                # Show image info
                print(f"   图片尺寸: {image.size}")
                print(f"   图片格式: {image.format}")

        print("\n" + "=" * 60)
        print("✓ 测试完成!")
        print("=" * 60)
        return 0

    except Exception as e:
        print(f"   ✗ 生成失败: {e}")
        return 1

if __name__ == "__main__":
    api_key = sys.argv[1] if len(sys.argv) > 1 else None
    sys.exit(test_image_generation(api_key))
