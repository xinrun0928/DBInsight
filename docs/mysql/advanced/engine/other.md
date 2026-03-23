# Archive / CSV / Memory 引擎

## Archive 引擎

Archive 是 MySQL 的「归档引擎」，专门用于存储**大量历史数据**，写入速度极快，存储空间极小。

### 特点

| 特性 | 说明 |
|------|------|
| 压缩存储 | Zlib 压缩，比 InnoDB 小 5~10 倍 |
| 只支持 INSERT / SELECT | 不能 UPDATE / DELETE |
| 无索引（除自增主键） | 全表扫描 |
| 行级锁 | INSERT 支持并发 |
| 事务支持 | ❌ 不支持 |

### 使用场景

```sql
-- 存储日志、审计记录、历史数据
CREATE TABLE audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(100),
    user_id BIGINT,
    created_at DATETIME
) ENGINE=Archive;

-- 批量导入日志（写入速度极快）
LOAD DATA INFILE '/data/audit_2024.csv' INTO TABLE audit_log;
```

### Archive vs 普通表的性能对比

| 操作 | Archive | InnoDB |
|------|---------|--------|
| 批量 INSERT | 极快（压缩） | 快 |
| SELECT（全表） | 慢（解压） | 快 |
| 存储空间 | 极小 | 中等 |
| UPDATE/DELETE | ❌ 不支持 | ✅ 支持 |

## CSV 引擎

CSV 引擎以 CSV 格式存储数据，可以直接用 Excel 打开。

### 特点

| 特性 | 说明 |
|------|------|
| 文本格式 | 数据以逗号分隔存储 |
| 直接编辑 | 可用 Excel / 文本编辑器打开 |
| 无索引 | 全表扫描 |
| 事务支持 | ❌ 不支持 |
| 文件共享 | 多个 MySQL 实例可同时读 |

### 使用场景

```sql
CREATE TABLE report_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    month VARCHAR(7),
    revenue DECIMAL(12,2),
    cost DECIMAL(12,2)
) ENGINE=CSV;

-- 文件格式（可直接用 Excel 打开）
-- /var/lib/mysql/app_db/report_data.CSV
-- id,month,revenue,cost
-- 1,2024-01,100000.00,60000.00
```

### 注意事项

- CSV 文件**不能有空值**（`NULL` 要用 `\N` 表示）
- CSV 文件**不能包含中文逗号**（需要转义）
- 多个 MySQL 实例同时写入会导致文件损坏

## Memory 引擎

Memory 引擎把数据存储在**内存**中，读写速度极快，但断电后数据丢失。

### 特点

| 特性 | 说明 |
|------|------|
| 存储位置 | 内存（tmpfs 或 RAM） |
| 读写速度 | 极快（微秒级） |
| 数据持久化 | ❌ 断电丢失 |
| 索引类型 | HASH（默认）或 BTREE |
| 固定长度 | 所有列用固定长度存储 |
| 大小限制 | `max_heap_table_size` 控制 |

### 使用场景

```sql
-- 临时表（MySQL 内部自动使用）
-- 用于 GROUP BY、ORDER BY 的临时排序
CREATE TEMPORARY TABLE temp_session (
    session_id VARCHAR(64),
    user_id BIGINT,
    last_active DATETIME
) ENGINE=Memory;

-- 热点数据缓存
CREATE TABLE hot_users (
    user_id BIGINT PRIMARY KEY,
    nickname VARCHAR(50),
    last_login DATETIME
) ENGINE=Memory;

-- 等值查询性能极好（HASH 索引）
SELECT * FROM hot_users WHERE user_id = 12345;
```

### Memory 引擎的坑

```sql
-- 坑一：VARCHAR 被当作固定长度存储
-- 实际占用 255 字节，不是实际字符串长度
CREATE TABLE t (
    name VARCHAR(255)  -- 实际占 255 字节
) ENGINE=Memory;

-- 坑二：断电数据全丢
-- Memory 表不会写入磁盘

-- 坑三：最大行数受 max_heap_table_size 限制
SHOW VARIABLES LIKE 'max_heap_table_size';  -- 默认 16MB

-- 坑四：HASH 索引不支持范围查询
-- SELECT * FROM t WHERE id > 100; -- 无法使用索引，全表扫描
```

## 其他引擎

### NDB Cluster 引擎

MySQL Cluster 专用引擎，支持分布式存储和高可用：

```sql
CREATE TABLE t (
    id INT PRIMARY KEY
) ENGINE=ndbcluster;
```

### Federated 引擎

跨服务器查询，类似 Linked Server（SQL Server）或 DBLink（Oracle）：

```sql
-- 启用 Federated 引擎
INSTALL PLUGIN federated SONAME 'ha_federatedx.so';

CREATE TABLE remote_table (
    id INT PRIMARY KEY,
    name VARCHAR(50)
) ENGINE=Federated
CONNECTION='mysql://user:pass@host:3306/db/remote_table';
```

> **不推荐在生产环境使用** Federated，延迟高且不稳定。

## 引擎选择总表

| 场景 | 推荐引擎 | 原因 |
|------|---------|------|
| 通用业务表 | InnoDB | 事务、并发、可靠性 |
| 只读报表 | MyISAM / InnoDB | 按需选择 |
| 历史归档 | Archive | 压缩存储 |
| 临时计算 | Memory | 内存速度 |
| 日志导入 | Archive | 写入速度 |
| 数据共享（Excel） | CSV | 文件格式 |
| 高可用集群 | NDB | 分布式 |
| 跨服务器查询 | Federated | 不推荐 |

## 下一步

MySQL 高级特性（基础）部分全部完成。接下来进入 [索引与性能优化](/database/mysql/optimize/index/basic)——这是 MySQL 最核心的技能之一。
