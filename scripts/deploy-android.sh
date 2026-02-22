#!/bin/bash

# 部署到 Android 的快速脚本

echo "🏗️  构建 Web 应用..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
fi

echo "📱 同步到 Android..."
npx cap sync android

if [ $? -ne 0 ]; then
    echo "❌ 同步失败"
    exit 1
fi

echo "✅ 部署完成！"
echo ""
echo "下一步："
echo "1. 运行: npx cap open android"
echo "2. 在 Android Studio 中点击运行按钮"
echo "3. 测试导出功能"
