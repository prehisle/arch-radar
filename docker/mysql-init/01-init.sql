-- 确保数据库存在
CREATE DATABASE IF NOT EXISTS zhineng_test_sys
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 授权用户
GRANT ALL PRIVILEGES ON zhineng_test_sys.* TO 'archradar'@'%';
FLUSH PRIVILEGES;

-- 注意：表结构由 SQLModel 自动创建（backend/main.py 中的 create_db_and_tables()）
