# 数据库调优：硬件、参数、大表优化

SQL 优化到极致了，索引建到最优了，但系统还是慢——这时候就该从更高层面找原因了：硬件够不够、参数配置是否合理、大表是否需要特殊处理。

---

## 硬件层面的优化

### CPU

| 场景 | CPU 选择建议 |
|-----|------------|
| OLTP（高并发小查询） | 高主频，多核（MySQL 多连接并行有限） |
| OLAP（复杂查询） | 多核，高缓存（并行查询利用多核） |
| 混合负载 | 高主频 + 多核均衡 |

> MySQL 对多核的利用并不完美（单查询通常单核），高并发 OLTP 场景高主频更重要。

### 内存

**核心配置：Buffer Pool**

InnoDB 的 Buffer Pool 是最重要的内存区域，用于缓存数据页和索引页。

```sql
-- 查看 Buffer Pool 大小
SHOW VARIABLES LIKE 'innodb_buffer_pool_size';
-- 推荐：设置为可用内存的 60%~80%

-- 查看 Buffer Pool 使用状态
SHOW STATUS LIKE 'Innodb_buffer_pool%';
```

| 配置参数 | 建议值 | 说明 |
|---------|-------|------|
| `innodb_buffer_pool_size` | 物理内存的 60%~80% | Buffer Pool 大小 |
| `innodb_buffer_pool_instances` | CPU 核心数（最多 16） | 分成多个实例，减少锁竞争 |
| `innodb_buffer_pool_load_at_startup` | ON | 启动时预热加载热点数据 |
| `innodb_buffer_pool_dump_at_shutdown` | ON | 关机时保存热点数据列表 |

### 磁盘

| 磁盘类型 | 适用场景 | 性能 |
|---------|--------|-----|
| SATA SSD | 普通生产环境 | 好 |
| NVMe SSD | 高并发 OLTP | 极好 |
| RAID 10 | 需要高可靠性的写入场景 | 好（冗余+性能） |
| RAID 5/6 | 读多写少，追求容量 | 一般（写性能差） |

> **重点**：MySQL 的事务日志（redo log）和数据文件的 I/O 模式完全不同。数据文件随机读写为主，redo log 顺序写入为主。用 SSD 是必须的。

### 网络

- 使用千兆以上网络
- 批量插入时使用多值 INSERT，减少网络往返
- 分库分表时关注跨机房延迟

---

## 参数层面的优化

### 连接与线程

```sql
-- 最大连接数（根据实际并发需求调整）
SHOW VARIABLES LIKE 'max_connections';
-- 默认 151，通常调整为 500~2000

-- 连接超时
SHOW VARIABLES LIKE 'wait_timeout';        -- 交互式连接空闲断开时间
SHOW VARIABLES LIKE 'interactive_timeout';  -- 非交互式连接
-- 通常设置为 300~600 秒

-- 线程池大小（MySQL 8.0 Thread Pool）
-- 通常设置为 CPU 核心数的 2~4 倍
SHOW VARIABLES LIKE 'thread_pool_size';
```

### 内存参数

```sql
-- 临时表和排序缓冲区
SHOW VARIABLES LIKE 'tmp_table_size';       -- 内存临时表大小
SHOW VARIABLES LIKE 'max_heap_table_size';   -- MEMORY 表最大大小
SHOW VARIABLES LIKE 'sort_buffer_size';      -- 排序缓冲区（每个连接独占）

-- JOIN 缓冲区
SHOW VARIABLES LIKE 'join_buffer_size';

-- 推荐配置：
[mysqld]
tmp_table_size = 256M
max_heap_table_size = 256M
sort_buffer_size = 2M          # 不要太大，连接独占
join_buffer_size = 2M          # 同上
```

### InnoDB 核心参数

```sql
-- 日志文件大小
SHOW VARIABLES LIKE 'innodb_log_file_size';
-- 推荐：每个日志文件 1GB，总大小 4GB~8GB

-- 双写缓冲区
SHOW VARIABLES LIKE 'innodb_doublewrite';
-- 建议：开启（ON），除非使用 Fusion-io 等支持原子写的硬件

-- 刷新策略（最影响写入性能）
SHOW VARIABLES LIKE 'innodb_flush_log_at_trx_commit';
-- 0: 每秒刷盘一次，事务提交不刷（最快，可能丢 1 秒数据）
-- 1: 每次事务提交都刷盘（最安全，默认值）
-- 2: 刷到操作系统缓存，不刷盘（折中，机器宕机可能丢数据）

-- 并行刷新
SHOW VARIABLES LIKE 'innodb_flush_neighbors';
-- 0: SSD 关闭（关闭邻近页刷新）
-- 1: 机械盘开启（刷新时顺带刷新相邻脏页）
```

### 推荐参数配置模板

```ini
[mysqld]
# 基础配置
server-id = 1
character-set-server = utf8mb4
default-storage-engine = InnoDB
max_connections = 2000

# Buffer Pool
innodb_buffer_pool_size = 64G          # 设为物理内存的 70%
innodb_buffer_pool_instances = 8       # 8 个实例
innodb_buffer_pool_load_at_startup = ON
innodb_buffer_pool_dump_at_shutdown = ON

# 日志
innodb_log_file_size = 1G
innodb_log_buffer_size = 64M
innodb_flush_log_at_trx_commit = 1   # 生产建议 1 或 2

# I/O
innodb_flush_method = O_DIRECT        # Linux 下避免双缓冲
innodb_file_per_table = ON
innodb_io_capacity = 4000            # SSD 用高值
innodb_io_capacity_max = 8000
innodb_flush_neighbors = 0            # SSD 必须关闭

# 查询优化
tmp_table_size = 256M
max_heap_table_size = 256M
sort_buffer_size = 2M
join_buffer_size = 2M
```

> **警告**：不要盲目抄参数配置。根据实际硬件、负载、数据量来调整。错误的 Buffer Pool 大小可能导致 OOM。

---

## 大表优化

### 大表的判断标准

| 表大小 | 级别 | 影响 |
|-------|-----|-----|
| < 1GB | 小表 | 正常优化即可 |
| 1~10GB | 中表 | 需要关注索引和查询 |
| 10~100GB | 大表 | 需要分区/归档 |
| > 100GB | 超大表 | 必须分区/分库 |

### 方案一：分区表

分区表将一个大表物理拆分成多个小表，对应用透明。

```sql
-- 按月份分区（适合订单表、日志表）
CREATE TABLE orders (
    id BIGINT AUTO_INCREMENT,
    customer_id BIGINT,
    amount DECIMAL(10,2),
    created_at DATETIME,
    PRIMARY KEY (id, created_at)      -- 注意：主键必须包含分区字段
) ENGINE=InnoDB
PARTITION BY RANGE (YEAR(created_at) * 100 + MONTH(created_at)) (
    PARTITION p202401 VALUES LESS THAN (202402),
    PARTITION p202402 VALUES LESS THAN (202403),
    PARTITION p202403 VALUES LESS THAN (202404),
    PARTITION p202404 VALUES LESS THAN (202405),
    PARTITION p202405 VALUES LESS THAN (202406),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- 查询特定分区的数据（MySQL 自动只扫描目标分区）
SELECT * FROM orders WHERE created_at BETWEEN '2024-01-01' AND '2024-01-31';
-- EXPLAIN 显示：partitions: p202401
```

**分区优势**：

| 优势 | 说明 |
|-----|------|
| 查询裁剪 | 只扫描目标分区，忽略其他分区 |
| 删除效率 | DROP PARTITION 比 DELETE 快 100 倍 |
| 归档清理 | 定期删除旧分区，释放空间 |
| 维护便利 | 单独 OPTIMIZE 每个分区 |

**分区注意事项**：

- 主键必须包含分区字段
- 跨分区查询性能可能下降
- 分区数量不要太多（建议 < 100）
- 全局索引跨分区，代价高

### 方案二：分表（逻辑分表）

应用层将大表按某个字段拆分成多张逻辑表：

```sql
-- 订单表按 user_id 末位数字分 10 张表
orders_0, orders_1, ... orders_9

-- 查询时根据 user_id 路由到对应表
$table = 'orders_' . ($user_id % 10);
```

| 优点 | 缺点 |
|-----|------|
| 应用可控 | 需要改应用代码 |
| 无 MySQL 限制 | 无法跨表 JOIN |
| 灵活 | 分片键选择困难 |

### 方案三：分库分表

分库分表是解决超大表的最终方案：

```
┌─────────────────────────┐
│      应用层              │
└────────────┬────────────┘
             │
    ┌────────┴────────┐
    │     分片中间件    │
    │ ShardingSphere  │
    │   / MyCAT       │
    └────────┬────────┘
      ┌─────┼─────┐
      ↓     ↓     ↓
  db_0   db_1   db_2
  ┌───┐ ┌───┐ ┌───┐
  │t1 │ │t1 │ │t1 │
  └───┘ └───┘ └───┘
```

- **分片键选择**：选择查询中最常用的过滤条件
- **分片策略**：哈希分片（均匀）、范围分片（按时间）
- **跨分片查询**：在应用层聚合，或使用 ES

### 方案四：归档清理

对于历史数据，不需要实时查询：

```sql
-- 归档三个月前的订单到历史表
INSERT INTO orders_history SELECT * FROM orders 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);

DELETE FROM orders 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);

-- 用 pt-archiver（Percona Toolkit）在线归档
pt-archiver --source h=localhost,D=shop,t=orders \
            --dest h=localhost,D=shop,t=orders_history \
            --where "created_at < DATE_SUB(NOW(), INTERVAL 3 MONTH)" \
            --limit 1000 \
            --txn-size 1000
```

### 方案五：读写分离

主库写，从库读，分担负载：

```sql
-- 主库配置
[mysqld]
server-id = 1
log-bin = mysql-bin
binlog_format = ROW

-- 从库配置
[mysqld]
server-id = 2
relay-log = relay-bin
read_only = ON
super_read_only = ON
```

应用层根据读/写类型路由到不同节点。

---

## 大表优化检查清单

```
□ 单表数据量超过 10GB？
  ├── 是 → 考虑分区
  └── 否 → 继续 SQL + 索引优化

□ 写入压力大？
  ├── 是 → 检查是否自增主键、关闭不必要的索引
  │        考虑批量写入、异步写入
  └── 否 → 继续

□ 查询慢？
  ├── 是 → 检查是否只扫描热点分区
  │        历史数据归档
  └── 否 → 继续

□ 并发高？
  ├── 是 → 读写分离
  │        Connection Pool 调优
  └── 否 → 继续

□ 数据量继续增长？
  ├── 是 → 分库分表
  └── 否 → 定期归档即可
```

---

## 小结

MySQL 性能优化是一个从 SQL 到架构的逐层递进过程：

```
第一层：SQL 优化（改写 SQL、加索引）
     ↓
第二层：表结构优化（主键设计、范式/反范式）
     ↓
第三层：参数调优（Buffer Pool、缓冲区大小）
     ↓
第四层：架构优化（读写分离、分区、分库分表）
```

记住：每一层的优化空间都比上一层大，但代价也越大。先从 SQL 和索引优化入手，逐层深入。

---

## 下一步

从 [索引与性能优化](/database/mysql/optimize/index) 模块学到了 MySQL 性能优化的精髓。接下来进入更深层的领域——事务、锁与 MVCC，这是 MySQL 保证数据一致性的核心机制。

从 [事务基础](/database/mysql/transaction/basic) 继续。
