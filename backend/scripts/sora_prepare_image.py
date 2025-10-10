#!/usr/bin/env python3
"""Utility script to resize + center-crop an image to a target resolution.
Outputs a JSON payload with processing metadata to stdout."""
import json
import sys
import os
from PIL import Image


def parse_int(value, fallback=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def ensure_parent_dir(path):
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)


def smart_resize_crop(input_path, output_path, target_width, target_height):
    img = Image.open(input_path)
    orig_width, orig_height = img.size

    target_ratio = target_width / target_height
    orig_ratio = orig_width / orig_height

    if orig_ratio > target_ratio:
        new_height = target_height
        new_width = int(round(orig_width * (target_height / orig_height)))
    else:
        new_width = target_width
        new_height = int(round(orig_height * (target_width / orig_width)))

    resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

    left = max(0, (new_width - target_width) // 2)
    top = max(0, (new_height - target_height) // 2)
    right = left + target_width
    bottom = top + target_height

    cropped = resized.crop((left, top, right, bottom))
    ensure_parent_dir(output_path)
    cropped.save(output_path, format='PNG', optimize=True)

    return {
        "input_path": input_path,
        "output_path": output_path,
        "original_width": orig_width,
        "original_height": orig_height,
        "resized_width": new_width,
        "resized_height": new_height,
        "target_width": target_width,
        "target_height": target_height
    }


def main(argv):
    if len(argv) < 5:
        raise SystemExit(
            "Usage: sora_prepare_image.py <input_path> <output_path> <target_width> <target_height>"
        )

    input_path = argv[1]
    output_path = argv[2]
    target_width = parse_int(argv[3])
    target_height = parse_int(argv[4])

    if target_width is None or target_height is None or target_width <= 0 or target_height <= 0:
        raise SystemExit("target_width/target_height must be positive integers")

    if not os.path.exists(input_path):
        raise SystemExit(f"Input file not found: {input_path}")

    result = smart_resize_crop(input_path, output_path, target_width, target_height)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main(sys.argv)
