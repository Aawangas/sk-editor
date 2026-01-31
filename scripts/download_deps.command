#!/bin/bash

# 下载Three.js依赖
echo "正在下载Three.js库文件..."

cd "$(dirname "$0")"

# 创建js目录
mkdir -p js

# 下载Three.js核心库
echo "下载 three.min.js..."
curl -sL "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" -o js/three.min.js

# 下载OrbitControls
echo "下载 OrbitControls.js..."
curl -sL "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js" -o js/OrbitControls.js

# 下载TransformControls
echo "下载 TransformControls.js..."
curl -sL "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/TransformControls.js" -o js/TransformControls.js

echo ""
echo "✅ Three.js 依赖下载完成！"
echo ""
echo "现在可以启动项目了："
echo ""
echo "方式1: 使用Python内置服务器"
echo "  python3 -m http.server 8000"
echo "  然后在浏览器打开 http://localhost:8000"
echo ""
echo "方式2: 使用Node.js (如果有安装)"
echo "  npx serve ."
echo ""
echo "方式3: 直接打开文件"
echo "  直接在浏览器中打开 index.html"
echo "  (注意: 某些功能可能需要本地服务器)"
