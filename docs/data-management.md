# 数据管理指南

本项目代码开源，但题目数据**不开源**。本文档说明如何在不同环境中管理私有数据。

## 📋 数据文件说明

- **zhineng_test_sys.sql** - 完整数据库导出（包含题目、知识点、章节等）
- 该文件已添加到 `.gitignore`，不会被提交到 Git

## 🔧 本地开发环境

### 方式 1：使用导入脚本（推荐）

```bash
# 1. 确保服务已启动
docker compose up -d

# 2. 运行导入脚本
./scripts/import-data.sh data/sql/zhineng_test_sys.sql

# 3. 验证数据
docker compose exec mysql mysql -uroot -p zhineng_test_sys -e "SELECT COUNT(*) FROM question;"
```

### 方式 2：手动导入

```bash
# 直接通过 docker compose 导入
docker compose exec -T mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" zhineng_test_sys < data/sql/zhineng_test_sys.sql
```

### 方式 3：初始化时自动导入

如果希望每次重建容器时自动导入数据：

```bash
# 1. 复制 SQL 文件到初始化目录（使用 99 前缀确保最后执行）
cp data/sql/zhineng_test_sys.sql docker/mysql-init/99-data.sql

# 2. 重建 MySQL 容器（会清空所有数据！）
docker compose down -v
docker compose up -d
```

**注意**：这会在每次重建时导入，适合开发环境。

## 🚀 生产环境（Sealos）

### 方式 1：通过 kubectl 导入（推荐）

```bash
# 1. 找到 MySQL Pod 名称
kubectl get pods | grep mysql

# 2. 导入数据
kubectl exec -i <mysql-pod-name> -- mysql -uroot -p"$MYSQL_ROOT_PASSWORD" zhineng_test_sys < data/sql/zhineng_test_sys.sql

# 3. 验证
kubectl exec <mysql-pod-name> -- mysql -uroot -p"$MYSQL_ROOT_PASSWORD" zhineng_test_sys -e "SELECT COUNT(*) FROM question;"
```

### 方式 2：通过 Sealos 终端

1. 进入 Sealos 控制台
2. 打开 MySQL 应用的终端
3. 上传 SQL 文件（或使用 curl 从私有存储下载）
4. 执行导入：
   ```bash
   mysql -uroot -p"$MYSQL_ROOT_PASSWORD" zhineng_test_sys < /tmp/zhineng_test_sys.sql
   ```

### 方式 3：通过私有对象存储

```bash
# 1. 上传到私有 OSS（如阿里云 OSS 私有桶）
# 使用 Web 界面或 CLI 上传

# 2. 在 Sealos 中下载并导入
kubectl exec <mysql-pod> -- sh -c '
  wget -O /tmp/data.sql "https://your-private-oss-url-with-signature"
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" zhineng_test_sys < /tmp/data.sql
  rm /tmp/data.sql
'
```

## 🔐 数据安全建议

### 1. 版本控制
```bash
# ✅ 好的做法
.gitignore 中排除:
- *.sql
- docker/mysql-init/99-data.sql
- data/

# ❌ 不要做
- 不要提交真实数据到公开仓库
- 不要在代码中硬编码数据
```

### 2. 私有存储方案

**选项 A：Git LFS + 私有仓库**
```bash
# 使用 Git LFS 管理大文件
git lfs track "*.sql"
git lfs track "data/**"
```

**选项 B：加密存储**
```bash
# 加密数据文件
gpg -c zhineng_test_sys.sql  # 生成 .gpg 文件

# 解密使用
gpg -d zhineng_test_sys.sql.gpg > zhineng_test_sys.sql
./scripts/import-data.sh data/sql/zhineng_test_sys.sql
```

**选项 C：私有对象存储**
- 阿里云 OSS（私有桶）
- AWS S3（私有桶）
- 自建 MinIO

### 3. 团队协作

**方案 1：共享加密文件**
```bash
# 团队成员共享密码，加密文件可以放在公共位置
gpg --symmetric --cipher-algo AES256 zhineng_test_sys.sql
```

**方案 2：私有文档/Wiki**
在团队内部文档中记录：
- 数据获取方式
- 导入步骤
- 访问权限申请流程

## 📊 数据导出

### 导出完整数据
```bash
# 从本地 Docker 导出
docker compose exec mysql mysqldump -uroot -p"${MYSQL_ROOT_PASSWORD}" \
  zhineng_test_sys > zhineng_test_sys_backup_$(date +%Y%m%d).sql

# 从 Sealos 导出
kubectl exec <mysql-pod> -- mysqldump -uroot -p"${MYSQL_ROOT_PASSWORD}" \
  zhineng_test_sys > zhineng_test_sys_production_$(date +%Y%m%d).sql
```

### 仅导出表结构（可公开）
```bash
docker compose exec mysql mysqldump -uroot -p"${MYSQL_ROOT_PASSWORD}" \
  --no-data zhineng_test_sys > schema.sql

# 这个文件可以提交到 Git
```

## 🔄 CI/CD 集成

### GitHub Actions 示例

```yaml
# .github/workflows/deploy.yml
- name: Import data from secrets
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  run: |
    echo "${{ secrets.DATABASE_SQL }}" | base64 -d > data.sql
    kubectl exec <mysql-pod> -- mysql -uroot -p"$MYSQL_ROOT_PASSWORD" zhineng_test_sys < data.sql
```

**设置方法**：
1. 将 SQL 文件 Base64 编码：`cat zhineng_test_sys.sql | base64 > data.b64`
2. 复制内容到 GitHub Secrets（`DATABASE_SQL`）
3. Workflow 中解码使用

## ❓ 常见问题

### Q1: 如何只导入新增的题目？
```bash
# 使用 INSERT IGNORE 或检查主键冲突
# 修改 SQL 文件中的 INSERT 为 INSERT IGNORE
sed 's/INSERT INTO/INSERT IGNORE INTO/g' zhineng_test_sys.sql > new_questions.sql
```

### Q2: 如何清空数据重新导入？
```bash
# 方式1: 重建容器（最干净）
docker compose down -v
docker compose up -d
./scripts/import-data.sh

# 方式2: 清空表（保留结构）
docker compose exec mysql mysql -uroot -p zhineng_test_sys -e "
  TRUNCATE TABLE question;
  TRUNCATE TABLE knowledgepoint;
  TRUNCATE TABLE majorchapter;
"
```

### Q3: 数据太大怎么办？
```bash
# 压缩 SQL 文件
gzip zhineng_test_sys.sql  # 生成 .sql.gz

# 导入压缩文件
gunzip < zhineng_test_sys.sql.gz | docker compose exec -T mysql mysql -uroot -p zhineng_test_sys
```

## 📝 最佳实践总结

✅ **推荐做法**：
1. SQL 文件加入 `.gitignore`
2. 使用加密存储或私有存储
3. 本地开发用脚本自动化导入
4. 生产环境用 kubectl 或 Sealos 终端
5. 定期备份数据

❌ **避免做法**：
1. 提交真实数据到公开仓库
2. 在代码中硬编码数据
3. 使用明文传输敏感数据
4. 不做备份直接操作生产数据

---

**更新日期**: 2025-12-17
