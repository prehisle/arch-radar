#!/bin/bash
# 获取项目根目录并切换到根目录
PROJECT_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$PROJECT_ROOT"

source "$PROJECT_ROOT/.env" 2>/dev/null
echo "✅ 已从 .env 读取数据库密码"
docker compose exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" zhineng_test_sys -e "SELECT COUNT(*) FROM question;" 2>&1 | grep -v "Using a password"
