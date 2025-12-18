#!/bin/bash

# Sealos 快速部署脚本
# 使用方法: ./deploy-sealos.sh

set -e

echo "======================================"
echo "   arch-radar Sealos 部署脚本"
echo "======================================"
echo ""

# 检查 kubectl 是否已安装
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl 未安装，请先安装 kubectl"
    exit 1
fi

# 检查当前 namespace
CURRENT_NS=$(kubectl config view --minify --output 'jsonpath={..namespace}')
echo "📦 当前 Namespace: ${CURRENT_NS:-default}"
echo ""

# 确认部署
read -p "确认要部署到当前 namespace 吗? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 部署已取消"
    exit 1
fi

echo ""
echo "🔧 开始部署..."
echo ""

# 1. 部署 ConfigMap 和 Secret
echo "1️⃣  部署 ConfigMap 和 Secret..."
kubectl apply -f sealos/base/config.yaml
echo "✅ ConfigMap 和 Secret 部署完成"
echo ""

# 2. 部署 PVC
echo "2️⃣  部署持久化卷声明 (PVC)..."
kubectl apply -f sealos/base/pvc.yaml
echo "✅ PVC 部署完成"
echo ""

# 等待 PVC 就绪
echo "⏳ 等待 PVC 就绪..."
kubectl wait --for=condition=Bound pvc/arch-radar-images-pvc --timeout=60s || true
echo ""

# 3. 部署后端服务
echo "3️⃣  部署后端服务..."
kubectl apply -f sealos/base/backend-deployment.yaml
echo "✅ 后端服务部署完成"
echo ""

# 4. 部署前端服务
echo "4️⃣  部署前端服务..."
kubectl apply -f sealos/base/frontend-deployment.yaml
echo "✅ 前端服务部署完成"
echo ""

# 5. 部署 Ingress（可选）
read -p "是否部署 Ingress? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "5️⃣  部署 Ingress..."
    kubectl apply -f sealos/base/ingress.yaml
    echo "✅ Ingress 部署完成"
else
    echo "⏭️  跳过 Ingress 部署"
fi
echo ""

# 6. 查看部署状态
echo "======================================"
echo "   部署状态"
echo "======================================"
echo ""

echo "📋 Pods 状态:"
kubectl get pods -l 'app in (arch-radar-backend,arch-radar-frontend)'
echo ""

echo "📋 Services 状态:"
kubectl get svc -l 'app in (arch-radar-backend,arch-radar-frontend)'
echo ""

echo "📋 PVC 状态:"
kubectl get pvc arch-radar-images-pvc
echo ""

if kubectl get ingress arch-radar-ingress &> /dev/null; then
    echo "📋 Ingress 状态:"
    kubectl get ingress arch-radar-ingress
    echo ""
fi

echo "======================================"
echo "   部署完成！"
echo "======================================"
echo ""
echo "📝 后续步骤:"
echo "1. 上传静态图片资源到 PVC"
echo "   kubectl cp ziliao/images/ <backend-pod-name>:/app/ziliao/images/"
echo ""
echo "2. 查看日志:"
echo "   kubectl logs -f deployment/arch-radar-backend"
echo "   kubectl logs -f deployment/arch-radar-frontend"
echo ""
echo "3. 访问应用（如果已配置 Ingress）:"
echo "   https://your-domain.com/"
echo ""
echo "详细文档请参考: sealos/DEPLOY.md"
echo ""
