#!/usr/bin/env python3
"""
骨架文件格式转换工具
支持 PT (PyTorch) 格式与 JSON 格式之间的转换

用法:
    # PT -> JSON
    python3 convert_skeleton.py input.pt -o output.json
    
    # JSON -> PT
    python3 convert_skeleton.py input.json -o output.pt
"""

import torch
import json
import argparse
import os
from pathlib import Path


def extract_bone_name(full_name):
    """
    从完整骨骼名称中提取简洁的名称
    例如: "Object_10--Character1_Hips_00" -> "Hips"
    """
    parts = full_name.split('_')
    if len(parts) >= 2:
        bone_name = parts[-2] if parts[-1].isdigit() else parts[-1]
        return bone_name
    return full_name.split('--')[-1]


def pt_to_json(pt_file, json_file=None, simplify=False):
    """
    将 PyTorch PT 格式转换为 JSON 格式
    
    Args:
        pt_file: PT 文件路径
        json_file: 输出 JSON 文件路径（可选）
        simplify: 是否输出简化格式
    """
    print(f"加载 PT 文件: {pt_file}")
    
    # 加载 PT 文件
    data = torch.load(pt_file, map_location='cpu')
    
    skeleton = data['skeleton']
    bone_names = data['bone_names']
    parent_mapping = data['parent_mapping']
    
    print(f"骨骼数量: {len(bone_names)}")
    
    # 构建骨骼列表
    bones = []
    for i, name in enumerate(bone_names):
        parent_name = parent_mapping.get(name, None)
        
        # 获取位置
        if isinstance(skeleton, torch.Tensor):
            pos = skeleton[i].tolist()
        else:
            pos = list(skeleton[i])
        
        # 提取简洁的骨骼名称
        simple_name = extract_bone_name(name)
        
        # 构建骨骼对象
        bone = {
            "name": simple_name,
            "originalName": name,
            "position": {
                "x": float(pos[0]),
                "y": float(pos[1]),
                "z": float(pos[2])
            }
        }
        
        # 设置父骨骼名称
        if parent_name and parent_name != name:
            bone["parentName"] = extract_bone_name(parent_name)
        else:
            bone["parentName"] = None
        
        bones.append(bone)
    
    # 构建结果
    result = {
        "name": Path(pt_file).stem,
        "bones": bones
    }
    
    # 确定输出路径
    if json_file is None:
        json_file = str(Path(pt_file).with_suffix('.json'))
    
    # 保存 JSON 文件
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"已保存到: {json_file}")
    print(f"骨骼总数: {len(bones)}")
    
    # 统计根骨骼
    root_bones = [b for b in bones if b["parentName"] is None]
    print(f"根骨骼: {[b['name'] for b in root_bones]}")
    print(f"前10个骨骼: {[b['name'] for b in bones[:10]]}")
    
    return json_file


def json_to_pt(json_file, pt_file=None):
    """
    将 JSON 格式转换为 PyTorch PT 格式
    
    Args:
        json_file: JSON 文件路径
        pt_file: 输出 PT 文件路径（可选）
    """
    print(f"加载 JSON 文件: {json_file}")
    
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    bones = data.get('bones', [])
    print(f"骨骼数量: {len(bones)}")
    
    # 构建 PT 数据
    positions = []
    bone_names = []
    parent_mapping = {}
    
    name_to_simple_name = {}
    
    # 第一遍：创建骨骼
    for i, bone in enumerate(bones):
        name = bone.get('originalName', bone['name'])
        simple_name = bone['name']
        bone_names.append(name)
        name_to_simple_name[simple_name] = name
        
        pos = bone.get('position', {'x': 0, 'y': 0, 'z': 0})
        positions.append([pos['x'], pos['y'], pos['z']])
    
    # 第二遍：建立父子关系
    for i, bone in enumerate(bones):
        name = bone.get('originalName', bone['name'])
        parent_simple_name = bone.get('parentName', None)
        
        if parent_simple_name:
            parent_name = name_to_simple_name.get(parent_simple_name, None)
            if parent_name:
                parent_mapping[name] = parent_name
            else:
                parent_mapping[name] = name  # 根骨骼指向自己
        else:
            parent_mapping[name] = name  # 根骨骼指向自己
    
    # 构建结果
    result = {
        "skeleton": torch.tensor(positions, dtype=torch.float32),
        "bone_names": bone_names,
        "parent_mapping": parent_mapping
    }
    
    # 确定输出路径
    if pt_file is None:
        pt_file = str(Path(json_file).with_suffix('.pt'))
    
    # 保存 PT 文件
    torch.save(result, pt_file)
    
    print(f"已保存到: {pt_file}")
    return pt_file


def main():
    parser = argparse.ArgumentParser(description='骨架文件格式转换工具')
    parser.add_argument('input', help='输入文件路径 (支持 .pt 和 .json)')
    parser.add_argument('-o', '--output', help='输出文件路径')
    parser.add_argument('--simplify', action='store_true', 
                        help='简化输出（仅对 PT->JSON 有效）')
    
    args = parser.parse_args()
    
    input_path = Path(args.input)
    
    if not input_path.exists():
        print(f"错误: 文件不存在 - {input_path}")
        return 1
    
    input_ext = input_path.suffix.lower()
    
    try:
        if input_ext == '.pt':
            # PT -> JSON
            pt_to_json(input_path, args.output, args.simplify)
        elif input_ext == '.json':
            # JSON -> PT
            json_to_pt(input_path, args.output)
        else:
            print(f"错误: 不支持的文件格式 - {input_ext}")
            return 1
    except Exception as e:
        print(f"错误: {e}")
        return 1
    
    return 0


if __name__ == '__main__':
    exit(main())
