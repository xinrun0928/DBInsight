# 存储引擎设置 / InnoDB vs MyISAM

## MySQL 的可插拔存储引擎架构

MySQL 的存储引擎是**可插拔**的——同一个 MySQL 实例，可以同时使用多种存储引擎，就像一个仓库里可以有不同的货架。

```sql
-- 查看支持的存储引擎
SHOW ENGINES;

-- 查看当前默认引擎
SHOW VARIABLES LIKE 'default_storage_engine';

-- 查看某张表使用的引擎
SHOW TABLE STATUS FROM school_db LIKE 'student';
```

## InnoDB 存储引擎（默认）

### InnoDB 的核心特性

InnoDB 是 MySQL 5.5+ 的默认存储引擎，也是目前使用最广泛的引擎。

| 特性 | 说明 |
|------|------|
| 事务支持 | ✅ 完整 ACID 事务 |
| 行级锁 | ✅ 并发写入性能好 |
| 外键约束 | ✅ 支持 |
| MVCC | ✅ 多版本并发控制 |
| 聚簇索引 | 主键和数据存在一起 |
| 崩溃恢复 | 自动崩溃恢复 |
| 热备份 | 支持在线备份 |

### InnoDB 的存储结构

InnoDB 使用**聚簇索引**（Clustered Index）：

```
表数据文件：student.ibd
├── 主键索引（聚簇索引）
│   └── 索引叶子节点：主键值 + 整行数据
└── 二级索引
    └── 索引叶子节点：索引值 + 主键值（回表查主键）
```

> **聚簇索引的优缺点**：查询主键范围时极快（数据连续），但主键过大时会影响其他索引大小。

### InnoDB 的关键参数

```ini
[mysqld]
# InnoDB 缓冲池大小（最重要的参数）
innodb_buffer_pool_size = 4G    -- 建议设为机器内存的 50%~70%
innodb_buffer_pool_instances = 4   -- 缓冲池分区数（并发用）

# 日志文件大小
innodb_log_file_size = 256M     -- 建议 256MB~1GB
innodb_log_files_in_group = 2     -- 日志组数量

# 并发控制
innodb_thread_concurrency = 0     -- 0=不限制（推荐）
innodb_write_io_threads = 8       -- 写入 IO 线程
innodb_read_io_threads = 8        -- 读取 IO 线程

# 表空间
innodb_file_per_table = ON        -- 独立表空间（8.0 默认 ON）
```

### InnoDB 的适用场景

- OLTP 系统（高并发读写）
- 需要事务和数据完整性
- 需要外键约束
- 需要行级锁
- 大多数生产环境

## MyISAM 存储引擎

### MyISAM 的核心特性

MyISAM 是 MySQL 5.5 之前的默认引擎，现在已不推荐使用。

| 特性 | 说明 |
|------|------|
| 事务支持 | ❌ 不支持 |
| 行级锁 | ❌ 只有表锁 |
| 外键约束 | ❌ 不支持 |
| MVCC | ❌ 不支持 |
| 全文索引 | ✅ 原生支持 |
| 地理空间 | ✅ 支持 |
| 存储限制 | 256TB（表大小） |
| 崩溃恢复 | 需要手动修复 |

### MyISAM 的存储结构

```
student 表文件：
├── student.MYD  -- 数据文件（MyData）
├── student.MYI  -- 索引文件（MyIndex）
└── student.frm  -- 表结构（5.7 有，8.0 已移除）
```

### MyISAM 的适用场景

| 场景 | 说明 |
|------|------|
| 只读报表 | 无事务需求，全表扫描 |
| 日志系统 | 写一次读多次 |
| 全文搜索 | 5.6 之前 InnoDB 不支持全文索引 |
| 空间函数 | GIS 应用（InnoDB 5.7+ 也支持了） |
| 过渡阶段 | 老系统迁移需要兼容 |

## InnoDB vs MyISAM 深度对比

### 索引结构对比

```
InnoDB（聚簇索引）:
  主键索引叶子节点：主键值 + 整行数据（数据在索引里）
  二级索引叶子节点：索引值 + 主键值（回表查询）

MyISAM（非聚簇索引）:
  索引叶子节点：索引值 + 行指针（指向 .MYD 文件中的物理位置）
```

### 锁机制对比

```sql
-- InnoDB 行锁示例
BEGIN;
UPDATE student SET score = 90 WHERE id = 1;  -- 只锁 id=1 这一行
-- 其他连接可以同时更新 id=2, 3, 4...

-- MyISAM 表锁示例
BEGIN;
UPDATE student SET score = 90 WHERE id = 1;  -- 锁住整张表
-- 其他连接全部阻塞，直到表锁释放
```

### 事务对比

```sql
-- InnoDB 事务（完整 ACID）
START TRANSACTION;
UPDATE account SET balance = balance - 1000 WHERE id = 1;
UPDATE account SET balance = balance + 1000 WHERE id = 2;
COMMIT;  -- 原子性，要么全成功，要么全失败
-- 或 ROLLBACK; -- 全部回滚
```

```sql
-- MyISAM 无事务支持
UPDATE account SET balance = balance - 1000 WHERE id = 1;  -- 执行了
UPDATE account SET balance = balance + 1000 WHERE id = 2;  -- 失败了
-- 第一条不会自动回滚，数据不一致
```

### 并发性能对比

| 操作 | InnoDB | MyISAM |
|------|--------|--------|
| 并发读 | 好 | 好 |
| 并发写 | 好（行锁） | 差（表锁） |
| 混合读写 | 好 | 差 |
| 写入速度 | 中等 | 快（无事务开销） |

## 引擎选择建议

```
需要事务和并发？→ InnoDB（99% 的场景）
只读/静态数据？→ MyISAM（特定场景）
全文搜索？→ InnoDB 5.6+ / MyISAM（老版本）
GIS 地理数据？→ InnoDB 5.7+ / MyISAM
高并发 OLTP？→ InnoDB（唯一选择）
归档/日志？→ MyISAM / Archive
```

## 修改表的存储引擎

```sql
-- 查看当前引擎
SHOW TABLE STATUS FROM school_db LIKE 'student';

-- 修改引擎
ALTER TABLE student ENGINE = InnoDB;
ALTER TABLE student ENGINE = MyISAM;

-- 批量转换
SELECT CONCAT('ALTER TABLE ', TABLE_NAME, ' ENGINE=InnoDB;')
FROM information_schema.tables
WHERE TABLE_SCHEMA = 'school_db' AND ENGINE = 'MyISAM';
```

## 下一步

存储引擎对比学完了，接下来看 [Archive / CSV / Memory 引擎](/database/mysql/advanced/engine/other)——其他存储引擎的使用场景。
