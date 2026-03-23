# 通用查询日志与错误日志

MySQL 的日志体系不只是 Redo/Binlog，还有通用查询日志和错误日志——日常运维和问题排查的重要工具。

---

## 通用查询日志（General Query Log）

通用查询日志记录 MySQL 收到的**每一条 SQL 语句**。

### 配置

```sql
-- 查看配置
SHOW VARIABLES LIKE 'general_log%';

-- 开启通用查询日志
SET GLOBAL general_log = 'ON';

-- 设置日志输出方式（表或文件）
SET GLOBAL log_output = 'FILE';           -- 输出到文件（默认）
SET GLOBAL log_output = 'TABLE';          -- 输出到 mysql.general_log 表
SET GLOBAL log_output = 'FILE,TABLE';     -- 同时输出到文件和表

-- 设置日志文件路径
SET GLOBAL general_log_file = '/var/lib/mysql/query.log';
```

### my.cnf 永久配置

```ini
[mysqld]
general_log = 1
general_log_file = /var/lib/mysql/query.log
log_output = FILE
```

### 日志格式

```
2024-01-15T10:30:00.123456Z thread_id=5 command_type=Query
SELECT * FROM orders WHERE id = 100

2024-01-15T10:30:01.234567Z thread_id=5 command_type=Query
UPDATE orders SET status = 'paid' WHERE id = 100
```

### 何时使用

通用查询日志**记录所有 SQL**，开销极大，生产环境通常**关闭**。

适用场景：
- 开发/测试环境调试
- 审计需求（需要记录所有操作）
- 排查连接问题

> **警告**：开启 general_log 后，所有查询都会被记录。生产环境开启可能导致日志文件快速膨胀，影响性能和磁盘空间。

---

## 慢查询日志（Slow Query Log）

详见 [慢查询日志与 SHOW PROFILE](/database/mysql/optimize/tool/slow-log)。

这里补充一个实用的技巧——如何用慢查询日志找出最需要优化的 SQL：

```bash
# 用 pt-query-digest 分析慢查询日志
pt-query-digest slow-query.log

# 输出：
#   0.000s  某类查询的总体统计
#   +--------+--------+--------+--------+----------+----------+
#   | Ratio  | Calls  |  R/Call|   MS   |    Item  |
#   +--------+--------+--------+--------+----------+----------+
#   | 98.23% | 123456 |  0.001 | 12.34  | SELECT orders |
#   +--------+--------+--------+--------+----------+----------+
```

---

## 错误日志（Error Log）

错误日志记录 MySQL 的启动、运行、错误信息，是最重要的诊断日志。

### 查看错误日志位置

```sql
SHOW VARIABLES LIKE 'log_error';
-- /var/log/mysql/error.log（根据安装方式不同）
```

### 日志内容解读

```
# 启动日志
2024-01-15T00:00:00.123456Z 0 [Note] InnoDB: Initializing buffer pool
2024-01-15T00:00:00.234567Z 0 [Note] InnoDB: Database was not shutdown normally
2024-01-15T00:00:00.345678Z 0 [Note] InnoDB: Starting crash recovery...
2024-01-15T00:00:01.456789Z 0 [Note] InnoDB: Recovery from background threads

# 运行时错误
2024-01-15T10:30:00.123456Z 123 [ERROR] InnoDB: Tablespace 45, page 1024 was not found
2024-01-15T10:30:00.234567Z 123 [ERROR] InnoDB: Redo log fetching... (in recovery)
2024-01-15T10:30:01.345678Z 456 [Warning] InnoDB: Lock wait timeout exceeded

# 死锁信息
2024-01-15T10:30:02.123456Z 789 [Note] InnoDB: Transactions deadlock detected
---TRANSACTION 12345, not started
...
```

### 关键错误信息

| 关键词 | 含义 | 严重程度 |
|-------|------|--------|
| `[ERROR]` | 错误，需要处理 | 🔴 高 |
| `[Warning]` | 警告，可能有问题 | 🟡 中 |
| `[Note]` | 提示，一般信息 | 🟢 低 |
| `InnoDB: Tablespace` | 表空间问题 | 🔴 高 |
| `Lock wait timeout` | 锁等待超时 | 🟡 中 |
| `Transactions deadlock` | 死锁发生 | 🟡 中 |
| `crash recovery` | 崩溃恢复中 | 🟡 中 |

### 开启死锁信息记录

```sql
SET GLOBAL innodb_print_all_deadlocks = ON;
-- 所有死锁详情都会写入错误日志
```

### 日常检查项

```bash
# 查看最近 100 行错误日志
tail -n 100 /var/log/mysql/error.log

# 查找 ERROR 行
grep '\[ERROR\]' /var/log/mysql/error.log | tail -n 50

# 查找 InnoDB 相关错误
grep 'InnoDB' /var/log/mysql/error.log | tail -n 50

# 查看启动时间（判断服务是否重启过）
grep 'startup' /var/log/mysql/error.log
```

---

## Binlog 相关基础

Binlog 是 MySQL 日志体系中最复杂的部分，这里先铺垫，后续详解。

### Binlog 的基本概念

| 属性 | 说明 |
|-----|------|
| 开关 | `log_bin` |
| 文件名 | `hostname-bin.000001`, `hostname-bin.000002`... |
| 索引文件 | `hostname-bin.index`（记录所有 binlog 文件） |
| 格式 | STATEMENT / ROW / MIXED |
| 刷盘 | `sync_binlog` 参数 |
| 内容 | 记录数据变更（INSERT/UPDATE/DELETE） |

```sql
-- 查看 Binlog 是否开启
SHOW VARIABLES LIKE 'log_bin';

-- 查看 Binlog 列表
SHOW BINARY LOGS;

-- 查看当前 Binlog 位置
SHOW MASTER STATUS;
```

---

## 日志实战：问题排查

### 场景一：连接失败

```bash
# 查看错误日志
grep 'Access denied' /var/log/mysql/error.log
# 或
grep 'connect' /var/log/mysql/error.log | tail -n 20
```

### 场景二：崩溃后恢复

```bash
# 查看恢复日志
grep 'crash recovery' /var/log/mysql/error.log
grep 'InnoDB: Database was not shutdown normally' /var/log/mysql/error.log
# 说明上次是非正常关闭，正在恢复
```

### 场景三：慢查询定位

```bash
# 分析慢查询
pt-query-digest --type=genlog /var/lib/mysql/query.log | head -n 100
```

---

## 日志配置建议

```ini
[mysqld]
# 错误日志（必须开启）
log_error = /var/log/mysql/error.log

# 慢查询日志（建议开启）
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 1
log_queries_not_using_indexes = 1

# Binlog（建议开启，主从复制必需）
log_bin = /var/lib/mysql/mysql-bin
expire_logs_days = 7
max_binlog_size = 1G
sync_binlog = 1

# 通用查询日志（生产环境关闭）
general_log = 0
```

---

## 小结

MySQL 日志体系的核心：

| 日志 | 生产环境 | 用途 |
|-----|---------|-----|
| Error Log | 必须开启 | 错误诊断 |
| Slow Query Log | 建议开启 | 性能优化 |
| General Query Log | **关闭** | 仅开发调试 |
| Binlog | 建议开启 | 主从复制 |
| Relay Log | 主从环境开启 | 从库中继 |

> 记住：**错误日志是 MySQL 的"黑匣子"**。任何 MySQL 问题，第一步永远是查看错误日志。

---

## 下一步

Redo Log 和 Undo Log 是 InnoDB 事务机制的两大支柱。Redo Log 怎么保证持久性？Undo Log 怎么实现回滚和 MVCC？两阶段提交又是怎么回事？

从 [Redo Log 与 Undo Log](/database/mysql/transaction/log/redo-undo) 继续。
