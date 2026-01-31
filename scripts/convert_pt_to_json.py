#!/usr/bin/env python3
"""
将用户的 PT 骨架文件转换为编辑器可导入的 JSON 格式
"""

import torch
import json
import argparse
from pathlib import Path


def extract_bone_name(full_name):
    """
    从完整骨骼名称中提取简洁的名称
    例如: "Object_10--Character1_Hips_00" -> "Hips"
    """
    # 分割并取最后一部分（通常是 BoneName + 索引）
    parts = full_name.split('_')
    if len(parts) >= 2:
        # 取 BoneName 部分（去掉数字索引）
        bone_name = parts[-2] if parts[-1].isdigit() else parts[-1]
        return bone_name
    return full_name.split('--')[-1]


def convert_pt_to_json(pt_file, json_file=None, simplify=False):
    """
    将 PyTorch PT 格式转换为编辑器可用的 JSON 格式
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
        
        # 设置父骨骼名称（使用简化后的名称）
        if parent_name and parent_name != name:
            # 使用简化后的名称
            bone["parentName"] = extract_bone_name(parent_name)
        else:
            # 根骨骼
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
    
    # 显示前10个骨骼名称
    print(f"前10个骨骼: {[b['name'] for b in bones[:10]]}")
    
    return json_file


def main():
    parser = argparse.ArgumentParser(description='将 PT 骨架转换为 JSON 格式')
    parser.add_argument('input', help='输入 PT 文件路径')
    parser.add_argument('-o', '--output', help='输出 JSON 文件路径')
    parser.add_argument('--simplify', action='store_true', 
                        help='使用简化后的骨骼名称作为 parentName')
    
    args = parser.parse_args()
    
    input_path = Path(args.input)
    
    if not input_path.exists():
        print(f"错误: 文件不存在 - {input_path}")
        return 1
    
    if input_path.suffix.lower() != '.pt':
        print(f"错误: 输入文件必须是 .pt 格式")
        return 1
    
    convert_pt_to_json(input_path, args.output, args.simplify)
    return 0


if __name__ == '__main__':
    exit(main())
