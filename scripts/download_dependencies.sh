#!/bin/bash

# 3D骨架编辑器 - 依赖下载脚本
# 在项目根目录运行此脚本

echo "📦 正在下载 Three.js 库文件..."

# 创建js目录
mkdir -p js

# 下载 Three.js 核心库
echo "下载 three.min.js..."
curl -L -o js/three.min.js "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"

# 下载 OrbitControls
echo "下载 OrbitControls.js..."
curl -L -o js/OrbitControls.js "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"

# 下载 TransformControls
echo "下载 TransformControls.js..."
curl -L -o js/TransformControls.js "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/TransformControls.js"

echo ""
echo "✅ 所有依赖文件下载完成！"
echo ""
echo "现在可以运行项目了："
echo "  - 使用本地服务器打开 index.html"
echo "  - 或者使用 python -m http.server 8000"
