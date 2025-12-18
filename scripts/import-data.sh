#!/bin/bash
# 导入数据脚本 - 适用于本地 Docker 环境

set -e

# 获取项目根目录并切换到根目录
PROJECT_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$PROJECT_ROOT"

SQL_FILE="${1:-$PROJECT_ROOT/data/sql/zhineng_test_sys.sql}"

if [ ! -f "$SQL_FILE" ]; then
    echo "❌ 错误: 找不到 SQL 文件: $SQL_FILE"
    echo "用法: ./scripts/import-data.sh [SQL文件路径]"
    exit 1
fi

# 从 .env 文件加载环境变量
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | grep MYSQL_ROOT_PASSWORD | xargs)
else
    echo "❌ 错误: 找不到 .env 文件"
    echo "请先创建 .env 文件或从 .env.production 复制"
    exit 1
fi

if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
    echo "❌ 错误: .env 文件中未找到 MYSQL_ROOT_PASSWORD"
    exit 1
fi

echo "📦 准备导入数据..."
echo "文件: $SQL_FILE"
echo "大小: $(du -h "$SQL_FILE" | cut -f1)"

# 检查 MySQL 容器是否运行
if ! docker compose ps mysql | grep -q "Up"; then
    echo "❌ MySQL 容器未运行，请先启动服务"
    echo "运行: docker compose up -d mysql"
    exit 1
fi

echo ""
echo "开始导入..."

# 通过 docker exec 导入
docker compose exec -T mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" zhineng_test_sys < "$SQL_FILE" 2>&1 | grep -v "Using a password" || true

# 检查导入是否成功（通过查询数据量）
QUESTION_COUNT=$(docker compose exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" zhineng_test_sys -N -e "SELECT COUNT(*) FROM question;" 2>/dev/null)

if [ "$QUESTION_COUNT" -gt 0 ]; then
    echo ""
    echo "✅ 数据导入成功！"
    echo ""
    echo "验证导入结果:"
    docker compose exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" zhineng_test_sys -e "
        SELECT
            (SELECT COUNT(*) FROM question) as questions,
            (SELECT COUNT(*) FROM knowledgepoint) as knowledge_points,
            (SELECT COUNT(*) FROM majorchapter) as chapters;
    " 2>&1 | grep -v "Using a password"
else
    echo "❌ 导入失败或数据为空"
    exit 1
fi
