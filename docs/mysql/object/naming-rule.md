# 阿里命名规范 / MySQL8 DDL 原子化

## 阿里巴巴 Java 开发手册——数据库规范摘要

这套规范是阿里内部实践总结的精华，被业界广泛采用。

### 命名规范

```sql
-- 表名、字段名：小写下划线，禁用拼音和 MySQL 保留字
CREATE TABLE user_order (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,           -- ✅ user_id
    order_no VARCHAR(32) NOT NULL,     -- ✅ order_no
    total_amount DECIMAL(12,2),        -- ✅ total_amount
    gmt_create DATETIME,               -- ✅ gmt_create
    gmt_modified DATETIME,              -- ✅ gmt_modified
    shijian    DATETIME,               -- ❌ 拼音
    Name       VARCHAR(50),             -- ❌ 大写
    OrderNo    VARCHAR(32),            -- ❌ 驼峰
    order-desc VARCHAR(50),            -- ❌ 减号
    SELECT     INT,                     -- ❌ 保留字
    INDEX      INT                     -- ❌ 保留字
);
```

| 对象 | 命名规则 | 例子 |
|------|---------|------|
| 表名 | 业务名称_表作用 | `user_account` `order_detail` |
| 字段名 | 简写_字段含义 | `user_id` `order_no` |
| 主键 | `id`（无业务含义） | `BIGINT PRIMARY KEY` |
| 外键 | `表名_id` | `user_id` |
| 创建时间 | `gmt_create` | `DATETIME` |
| 修改时间 | `gmt_modified` | `DATETIME` |
| 布尔字段 | `is_xxx` | `is_deleted` `is_active` |
| 索引 | `idx_字段` | `idx_user_id` |
| 唯一索引 | `uk_字段` | `uk_user_name` |
| 外键索引 | `fk_表_字段` | `fk_order_user` |

### SQL 语句规范

```sql
-- ❌ 不要用 SELECT *，明确列出需要的列
SELECT * FROM user;

-- ✅ 指定需要的列
SELECT id, username, email FROM user;

-- ❌ 不要用 LEFT JOIN 产生笛卡尔积
-- ❌ 不要在 WHERE 中用函数或运算
SELECT * FROM user WHERE YEAR(create_time) = 2024;

-- ✅ 改成范围查询
SELECT * FROM user WHERE create_time >= '2024-01-01' AND create_time < '2025-01-01';

-- ❌ 不要用存储过程、触发器（移植性差，难维护）
-- ✅ 业务逻辑在应用层处理

-- ❌ COUNT(*) vs COUNT(列名) 混用
-- ✅ COUNT(*) 用于判断是否存在（只返回0或1）
SELECT COUNT(*) FROM user;        -- ✅ 查总行数
SELECT COUNT(id) FROM user;       -- ✅ 查非NULL的id个数
SELECT COUNT(1) FROM user;       -- ✅ 性能最好（等价于COUNT(*)）
```

### 数据库设计规范

```sql
-- ❌ 不要用外键（高并发下性能差）
-- ✅ 应用层控制数据完整性
ALTER TABLE order_item ADD FOREIGN KEY (order_id) REFERENCES `order`(id);  -- 不推荐

-- ❌ 不要用物理删除（数据无法恢复）
DELETE FROM user WHERE id = 1;  -- 危险

-- ✅ 改用逻辑删除
ALTER TABLE user ADD COLUMN is_deleted TINYINT(1) DEFAULT 0;
UPDATE user SET is_deleted = 1 WHERE id = 1;
```

### 字段设计规范

```sql
-- ❌ 金额字段不要用 FLOAT/DOUBLE（精度丢失）
ALTER TABLE account ADD COLUMN balance DOUBLE; -- ❌

-- ✅ 金额必须用 DECIMAL
ALTER TABLE account ADD COLUMN balance DECIMAL(12,2); -- ✅

-- ❌ 不要用 VARCHAR 存大文本
ALTER TABLE article ADD COLUMN content VARCHAR(2000); -- ❌

-- ✅ 超过255字符用 TEXT
ALTER TABLE article ADD COLUMN content TEXT; -- ✅

-- ❌ 不要用字符串存日期时间（无法计算）
ALTER TABLE order_info ADD COLUMN create_time VARCHAR(20); -- ❌

-- ✅ 必须用 DATE/DATETIME
ALTER TABLE order_info ADD COLUMN create_time DATETIME; -- ✅
```

## MySQL 8.0 DDL 原子化

MySQL 8.0 引入了一个重要特性：**DDL 语句原子化**。

### 什么是 DDL 原子化

在 MySQL 8.0 之前，`DROP TABLE t1, t2` 如果 t2 不存在，t1 会被删除但 t2 报错，数据库进入不一致状态：

```sql
-- MySQL 5.7
DROP TABLE non_existing_table, student;
-- ERROR 1051 (42S02): Unknown table 'non_existing_table'
-- 结果：non_existing_table 报错，但 student 表已被删除！危险！
```

MySQL 8.0 解决了这个问题——要么全部成功，要么全部回滚：

```sql
-- MySQL 8.0
DROP TABLE non_existing_table, student;
-- ERROR 1051 (42S02): Unknown table 'non_existing_table'
-- 结果：student 表没有被删除（原子化保护）
```

### 原子 DDL 支持的操作

| 操作类型 | 是否支持原子化 |
|---------|-------------|
| `DROP TABLE` | ✅ |
| `CREATE TABLE` | ✅ |
| `ALTER TABLE` | ❌ 部分支持 |
| `TRUNCATE TABLE` | ❌ |
| `DROP INDEX` | ✅ |
| `DROP DATABASE` | ✅ |

### 原子 DROP TABLE 示例

```sql
-- 批量删除表
DROP TABLE IF EXISTS t1, t2, t3;
-- 如果 t2 不存在，t1 和 t3 也不会被删除

-- 查看原子 DDL 状态
SHOW VARIABLES LIKE 'gtid_next';
```

### 对开发者的影响

DDL 原子化让批量操作更安全，但需要注意：
- `ALTER TABLE` 在 MySQL 8.0 中仍然不是原子的
- 生产环境执行 DDL 前仍建议做好备份
- 使用 `pt-online-schema-change` 等工具进行大表变更

## 综合规范检查清单

写 CREATE TABLE 语句前，检查以下各项：

- [ ] 表名用小写下划线，无拼音
- [ ] 字段名用小写下划线，无拼音
- [ ] 主键命名为 `id`，类型为 `BIGINT`
- [ ] 有 `gmt_create` 和 `gmt_modified` 两个时间字段
- [ ] 金额字段用 `DECIMAL`，不用 `FLOAT/DOUBLE`
- [ ] 超过 255 字符的文本用 `TEXT`
- [ ] 日期时间字段用 `DATETIME/TIMESTAMP`
- [ ] 用逻辑删除代替物理删除（`is_deleted` 字段）
- [ ] 有意义的枚举值用 `TINYINT` 或 `ENUM`
- [ ] 每个表都有中文注释（`COMMENT '...'`)
- [ ] 指定存储引擎和字符集

## 下一步

建表规范学完了，接下来学习 [数据操作（DML）](/database/mysql/object/dml/insert)——怎么往表里添加、修改、删除数据。
