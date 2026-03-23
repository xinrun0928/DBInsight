# Binlog 详解

Binlog（二进制日志）是 MySQL 最强大的日志之一——它记录了数据库中所有数据的变更，是主从复制的基石，也是数据恢复的利器。

---

## Binlog 是什么

**Binlog** 记录 MySQL 数据库的**所有变更操作**（DDL + DML），但不像 Redo Log 那样记录页级别的物理修改，而是记录**逻辑变更**。

```
Binlog 记录的内容：
- INSERT / UPDATE / DELETE
- CREATE / ALTER / DROP TABLE
- TRUNCATE / RENAME TABLE
- COMMIT / ROLLBACK

Binlog 不记录的内容：
- SELECT / SHOW（查询不改变数据）
- BEGIN（开启事务，但不改变数据）
```

### Binlog vs Redo Log

| 维度 | Redo Log | Binlog |
|-----|---------|--------|
| 所属层 | InnoDB 存储引擎 | MySQL Server 层 |
| 记录格式 | 物理（页修改） | 逻辑（SQL 操作） |
| 记录范围 | InnoDB 的 DML | 所有引擎的 DDL + DML |
| 用途 | 崩溃恢复 | 主从复制 + 数据恢复 |
| 循环覆盖 | 可以（已刷盘的） | 不能，自动增长或手动删除 |
| 崩溃恢复 | 可以恢复未刷盘的数据 | 不能，Binlog 不用于崩溃恢复 |

---

## Binlog 的开关与配置

### 基本配置

```ini
[mysqld]
# 开启 Binlog（必须指定 server_id）
log_bin = /var/lib/mysql/mysql-bin
server_id = 1

# Binlog 文件大小（超过后创建新文件）
max_binlog_size = 1G

# Binlog 保留天数（过期自动删除）
expire_logs_days = 7

# 强制刷盘策略（最重要参数）
sync_binlog = 1   # 每次事务提交都刷盘（最安全）
# sync_binlog = 0 # 由操作系统决定（最快，但不安全）
# sync_binlog = N # 每 N 次事务提交刷盘一次
```

### 查看 Binlog 状态

```sql
-- 查看是否开启
SHOW VARIABLES LIKE 'log_bin';

-- 查看 Binlog 列表
SHOW BINARY LOGS;
-- +---------------------+-----------+
-- | Log_name            | File_size |
-- +---------------------+-----------+
-- | mysql-bin.000001    |    1234567 |
-- | mysql-bin.000002    |    2345678 |
-- +---------------------+-----------+

-- 查看当前 Binlog 位置
SHOW MASTER STATUS;
-- +---------------------+----------+--------------+------------------+
-- | File                | Position | Binlog_Do_DB | Binlog_Ignore_DB |
-- +---------------------+----------+--------------+------------------+
-- | mysql-bin.000002    | 12345678 |              |                  |
-- +---------------------+----------+--------------+------------------+

-- 查看 Binlog 事件
SHOW BINLOG EVENTS IN 'mysql-bin.000001';
```

---

## Binlog 的三种格式

Binlog 支持三种记录格式，决定了"如何记录变更"。

### 格式一：STATEMENT（语句级，默认 5.7.7 之前）

```sql
-- Binlog 记录 SQL 语句本身
UPDATE orders SET amount = amount - 100 WHERE user_id = 10086;

-- 优点：日志量小，可读性强
-- 缺点：某些函数（NOW(), RAND()）在从库执行结果不同！
```

```sql
-- 设置 STATEMENT 格式
SET SESSION binlog_format = 'STATEMENT';
```

### 格式二：ROW（行级，MySQL 5.7.7+ 默认）

```sql
-- Binlog 记录每一行的变更细节
UPDATE orders SET amount = amount - 100 WHERE user_id = 10086;

-- 实际记录的 Binlog 内容（简化）：
Table: orders
  WHERE id=1: amount: 1000 → 900
  WHERE id=2: amount: 2000 → 1900
  WHERE id=3: amount: 500 → 400

-- 优点：精确，不会有函数不一致问题
-- 缺点：日志量大（大量 UPDATE 时）
```

```sql
SET SESSION binlog_format = 'ROW';

-- 查看当前格式
SHOW VARIABLES LIKE 'binlog_format';
```

### 格式三：MIXED（混合模式）

```sql
-- MySQL 自动选择：
-- - 安全操作（如带主键的 UPDATE）→ 用 STATEMENT
-- - 不安全操作（如 NOW(), RAND()）→ 用 ROW

SET SESSION binlog_format = 'MIXED';
```

### 格式对比

| 格式 | 日志量 | 安全性 | 可读性 | 主从一致性 |
|-----|-------|-------|-------|-----------|
| STATEMENT | 小 | 差（函数可能不一致） | 好 | 可能不一致 |
| ROW | 大 | 好 | 差（不可读） | 完全一致 |
| MIXED | 中 | 好 | 中 | 通常一致 |

> **生产建议**：使用 ROW 格式。虽然日志量大，但主从一致性最重要。

---

## Binlog 事件类型

Binlog 由多个**事件（Event）**组成：

| 事件类型 | 说明 |
|--------|-----|
| `FORMAT_DESCRIPTION_EVENT` | Binlog 文件头信息 |
| `QUERY_EVENT` | SQL 语句（STATEMENT 格式） |
| `TABLE_MAP_EVENT` | 表结构信息（ROW 格式） |
| `WRITE_ROWS_EVENT` | INSERT（ROW 格式） |
| `UPDATE_ROWS_EVENT` | UPDATE（ROW 格式） |
| `DELETE_ROWS_EVENT` | DELETE（ROW 格式） |
| `XID_EVENT` | 事务提交标记 |
| `ROTATE_EVENT` | Binlog 切换文件 |

### 查看 Binlog 详细内容

```bash
# 用 mysqlbinlog 查看日志内容
mysqlbinlog /var/lib/mysql/mysql-bin.000001 | head -n 100

# 查看特定时间范围的日志
mysqlbinlog --start-datetime='2024-01-15 10:00:00' \
            --stop-datetime='2024-01-15 11:00:00' \
            /var/lib/mysql/mysql-bin.000001

# 查看特定位置范围
mysqlbinlog --start-position=1234 \
            --stop-position=5678 \
            /var/lib/mysql/mysql-bin.000001

# 以 ROW 格式可读方式查看
mysqlbinlog -v /var/lib/mysql/mysql-bin.000001 | grep -A5 'UPDATE'
```

---

## Binlog 在数据恢复中的应用

Binlog 可以恢复任意时间点的数据，是"增量恢复"的利器。

### 场景：恢复到某个时间点

```sql
-- 假设：2024-01-15 10:30 不小心执行了 DELETE，丢了大量数据
-- 目标：恢复到 10:29:59 的状态

-- Step 1: 全量恢复（用最近的备份）
mysql -uroot -p db_name < /backup/full_backup.sql

-- Step 2: 增量恢复（从备份时间到 10:29:59）
mysqlbinlog \
    --stop-datetime='2024-01-15 10:29:59' \
    /var/lib/mysql/mysql-bin.000001 \
    /var/lib/mysql/mysql-bin.000002 \
| mysql -uroot -p db_name

-- Step 3: 如果需要跳过错误操作
-- 可以用 mysqlbinlog 生成部分回滚 SQL
```

### 场景：恢复特定表

```bash
# 从 Binlog 中提取特定表的变更
mysqlbinlog /var/lib/mysql/mysql-bin.000001 \
    | grep -A5 'orders' \
    | mysqlbinlog -d db_name -
```

---

## Binlog 与主从复制

Binlog 是主从复制的核心。从架构上看：

```
主库（Master）：
┌──────────────┐    Binlog    ┌──────────────┐
│  应用写入     │ ─────────→   │  Dump Thread  │
│              │              │  (发送Binlog) │
└──────────────┘              └──────────────┘

从库（Slave）：
┌──────────────┐   Relay Log  ┌──────────────┐
│  IO Thread   │ ←───────────  │  Slave I/O   │
│  (接收Binlog) │              │  (拉取Binlog)│
└──────────────┘              └──────────────┘
┌──────────────┐   回放Relay   ┌──────────────┐
│  SQL Thread  │ ←───────────  │  Slave SQL   │
│  (执行SQL)   │              │  (回放日志)  │
└──────────────┘              └──────────────┘
```

### 主从复制原理

```sql
-- 1. 主库：开启 Binlog
SHOW MASTER STATUS;  -- 记录当前 Binlog 位置

-- 2. 从库：配置主库连接
CHANGE MASTER TO
    MASTER_HOST='192.168.1.100',
    MASTER_USER='repl_user',
    MASTER_PASSWORD='repl_password',
    MASTER_LOG_FILE='mysql-bin.000001',
    MASTER_LOG_POS=12345678;

-- 3. 从库：启动复制
START SLAVE;

-- 4. 查看复制状态
SHOW SLAVE STATUS\G
-- 关键字段：
-- Slave_IO_Running: Yes（IO线程运行中）
-- Slave_SQL_Running: Yes（SQL线程运行中）
-- Seconds_Behind_Master: 0（无延迟）
-- Last_Error: (空，无错误）
```

### 主从复制的延迟问题

```sql
-- 查看延迟原因
SHOW SLAVE STATUS\G
-- Last_Errno: 错误码
-- Last_Error: 错误信息
-- Skip_Counter: 已跳过的语句数

-- 查看从库落后多少
SHOW STATUS LIKE 'Slave%';

-- 常见延迟原因：
-- 1. 从库机器性能差（解决方案：升级硬件）
-- 2. 大事务（从库单线程回放太慢）
--    → 解决方案：启用并行复制（MySQL 5.7+）
-- 3. 从库有其他查询在跑（解决方案：隔离查询）
```

### 并行复制（MySQL 5.7+）

```sql
-- 查看并行复制配置
SHOW VARIABLES LIKE 'slave_parallel_type';
-- DATABASE：按数据库并行
-- LOGICAL_CLOCK：按逻辑时钟并行（更细粒度）

-- 开启并行复制
STOP SLAVE;
SET GLOBAL slave_parallel_workers = 4;  -- 4 个 Worker 线程
START SLAVE;
```

---

## Binlog 维护

### 清理 Binlog

```sql
-- 方式一：按时间删除（删除 N 天前的）
PURGE BINARY LOGS BEFORE '2024-01-15 00:00:00';

-- 方式二：删除到某个文件之前
PURGE BINARY LOGS TO 'mysql-bin.000010';

-- 方式三：设置过期自动删除
SET GLOBAL expire_logs_days = 7;
```

### 查看 Binlog 磁盘占用

```bash
# 查看 Binlog 文件大小
ls -lh /var/lib/mysql/mysql-bin.*

# 查看总占用
du -sh /var/lib/mysql/mysql-bin.*
```

---

## 小结

Binlog 是 MySQL 的核心日志：

| 属性 | 说明 |
|-----|------|
| 位置 | MySQL Server 层，所有引擎共享 |
| 格式 | STATEMENT / ROW / MIXED |
| 用途 | 主从复制、增量恢复 |
| 关键参数 | `sync_binlog`（刷盘策略） |

> **记住**：Redo Log 是 InnoDB 的"崩溃恢复日志"，Binlog 是 MySQL 的"业务日志"。两者配合，一个管持久性，一个管复制。

---

## 下一步

主从复制的完整原理是什么？一主一从怎么搭建？如何保证主从数据一致性？

从 [主从复制原理](/database/mysql/replication/basic) 继续。
