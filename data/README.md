# 数据目录说明

本目录用于存放项目的私有数据文件，这些文件**不会被提交到 Git 仓库**。

## 📁 目录结构

```
data/
└── sql/
    └── zhineng_test_sys.sql    # 完整数据库导出（私有，不提交）
```

## 🔐 数据文件说明

### `sql/zhineng_test_sys.sql`

- **内容**: 完整的系统架构师考试题库数据
- **大小**: 约 2.5 MB
- **包含表**:
  - `question` - 2,342+ 道考试题目
  - `knowledgepoint` - 314+ 个知识点
  - `majorchapter` - 19 个主要章节
  - 其他相关表

## 📥 如何获取数据文件

### 本地开发

如果您是项目成员，请通过以下方式获取数据文件：

1. **从团队内部渠道获取**（联系项目管理员）
2. **从私有存储下载**（如有配置）
3. **从生产环境导出**（如有权限）

### 数据导入

获取 SQL 文件后，将其放置在 `data/sql/` 目录下，然后使用导入脚本：

```bash
# 使用导入脚本（推荐）
./scripts/import-data.sh

# 或手动导入
docker compose exec -T mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" \
  zhineng_test_sys < data/sql/zhineng_test_sys.sql
```

详细的导入步骤和管理方案请参考：[../docs/data-management.md](../docs/data-management.md)

## ⚠️ 重要提醒

1. ✅ 该目录已添加到 `.gitignore`，文件不会被提交
2. ❌ 请勿将私有数据文件提交到公开仓库
3. 🔒 数据文件包含敏感内容，请妥善保管
4. 📋 如需导出新数据，请参考数据管理文档

## 🔄 数据导出

如需从当前环境导出数据：

```bash
# 从本地 Docker 导出
docker compose exec mysql mysqldump -uroot -p"${MYSQL_ROOT_PASSWORD}" \
  zhineng_test_sys > data/sql/zhineng_test_sys_$(date +%Y%m%d).sql

# 从 Sealos/生产环境导出
kubectl exec <mysql-pod> -- mysqldump -uroot -p"${MYSQL_ROOT_PASSWORD}" \
  zhineng_test_sys > data/sql/zhineng_test_sys_production_$(date +%Y%m%d).sql
```

---

**更新日期**: 2025-12-17
