# 主从复制原理

主从复制是 MySQL 实现高可用和数据分发的核心技术。它用最简单的方式解决了：数据备份、读写分离、异地多活。

---

## 主从复制的架构

```
┌─────────────────┐           Binlog            ┌─────────────────┐
│      主库        │ ───────────────────────→  │      从库        │
│   (Master)      │                            │   (Slave)       │
│                 │                            │                 │
│  ┌───────────┐  │                            │  ┌───────────┐  │
│  │  应用写入   │  │                            │  │  只读查询  │  │
│  └───────────┘  │                            │  └───────────┘  │
│       ↓        │                            │       ↑        │
│  记录 Binlog   │                            │  读取 Relay Log │
│       ↓        │                            │  回放 SQL       │
│  事务提交      │                            │  存储数据       │
└─────────────────┘                            └─────────────────┘
```

### 核心原理

主从复制的本质是：**把主库产生的 Binlog 传输到从库，从库回放这些日志，达到数据一致**。

---

## 主从复制的三个线程

MySQL 主从复制依赖三个线程：

| 线程 | 位置 | 作用 |
|-----|------|-----|
| Dump Thread | 主库 | 读取 Binlog，发送给从库 |
| IO Thread | 从库 | 接收 Binlog，写入 Relay Log |
| SQL Thread | 从库 | 读取 Relay Log，回放 SQL |

```
主库：
┌─────────────────────────────────┐
│         Dump Thread              │
│  监听从库请求                   │
│  读取 Binlog 并发送             │
│  (一个从库一个 Dump Thread)     │
└─────────────────────────────────┘
         ↓ Binlog
┌─────────────────────────────────┐
│         IO Thread                │
│  接收 Binlog，写入 Relay Log    │
└─────────────────────────────────┘
         ↓ Relay Log
┌─────────────────────────────────┐
│         SQL Thread               │
│  读取 Relay Log                 │
│  回放 SQL（执行数据变更）         │
└─────────────────────────────────┘
```

### 三个线程的协作

```sql
-- Step 1: 从库 IO Thread 连接主库
CHANGE MASTER TO
    MASTER_HOST='192.168.1.100',
    MASTER_USER='repl_user',
    MASTER_PASSWORD='password',
    MASTER_LOG_FILE='mysql-bin.000001',
    MASTER_LOG_POS=4;  -- 从这个位置开始读取

START SLAVE;  -- 启动 IO Thread 和 SQL Thread

-- Step 2: IO Thread 从主库 Dump Thread 获取 Binlog
-- 从库记录接收到的位置到 Relay Log

-- Step 3: SQL Thread 回放 Relay Log
-- 读取 → 解析 → 执行
```

---

## Binlog 怎么变成 Relay Log

Binlog 和 Relay Log 的格式几乎相同，但内容有区别。

### Binlog 到 Relay Log 的转换

```
主库 Binlog 内容：
#240115 10:30:00 server id 1  Query  thread_id=5  BEGIN
#240115 10:30:00 server id 1  Table_map  orders  ...
#240115 10:30:00 server id 1  Update_rows  id=1  amount=900
#240115 10:30:00 server id 1  Xid  ...

从库 Relay Log 内容：
#240115 10:30:05 server id 1  Relay_log_name='mysql-bin.000001'  Exec_pos=xxx
#240115 10:30:00 server id 1  Query  thread_id=5  BEGIN
...
```

Relay Log 多了两行元信息：
- `Relay_log_name`：这条 Relay Log 对应主库的哪个 Binlog 文件
- `Exec_pos`：这条日志在主库 Binlog 中的位置

### Relay Log 的文件名

```
从库的 Relay Log 文件：
slave-relay-bin.000001
slave-relay-bin.000002
slave-relay-bin.index（索引文件）
```

---

## 主从复制延迟

复制延迟 = SQL Thread 回放 Relay Log 跟不上 IO Thread 接收 Binlog 的速度。

### 延迟的典型原因

| 原因 | 说明 | 解决方案 |
|-----|------|---------|
| 大事务 | 从库单线程回放一个大事务很慢 | 拆分为小事务 |
| 从库负载高 | 从库 CPU/磁盘瓶颈 | 升级硬件 |
| 网络延迟 | Binlog 传输慢 | 升级网络 |
| 缺少索引 | 回放 SQL 时全表扫描 | 优化从库索引 |
| 并行复制未开启 | 单 SQL Thread 回放 | 启用并行复制 |

### 查看延迟

```sql
SHOW SLAVE STATUS\G

-- 关键字段：
-- Seconds_Behind_Master: 0  -- 延迟秒数（0=无延迟）
-- Relay_Log_Pos: 12345678  -- Relay Log 位置
-- Relay_Master_Log_File: mysql-bin.000001  -- 当前读取的 Binlog
-- Exec_Master_Log_Pos: 12345600  -- 已回放的位置

-- 延迟 = 两个位置之间的差距
```

### 大事务的延迟问题

```sql
-- 主库执行（快）：
BEGIN;
-- 假设有 10 万行更新
UPDATE orders SET status = 'completed' WHERE created_at < '2023-01-01';
COMMIT;
-- 主库：1.2 秒完成

-- 从库回放（慢）：
-- 单 SQL Thread 必须逐条回放这 10 万行
-- 从库：可能需要 2 分钟！
```

**解决方案**：大事务拆成小事务。

```sql
-- 拆分前：1 个大事务
UPDATE orders SET status = 'completed' 
WHERE created_at < '2023-01-01';  -- 10万行

-- 拆分后：多个小事务
DELIMITER $$
CREATE PROCEDURE batch_update()
BEGIN
    DECLARE v_limit INT DEFAULT 1000;
    DECLARE v_offset INT DEFAULT 0;
    DECLARE v_affected INT DEFAULT 1;
    
    WHILE v_affected > 0 DO
        UPDATE orders SET status = 'completed' 
        WHERE created_at < '2023-01-01'
        ORDER BY id LIMIT v_limit OFFSET v_offset;
        
        SET v_affected = ROW_COUNT();
        SET v_offset = v_offset + v_limit;
        
        -- 每批次提交一次
        COMMIT;
    END WHILE;
END$$
DELIMITER ;
```

---

## 主从复制的数据一致性

### 主从不一致的原因

| 原因 | 说明 |
|-----|------|
| 异步复制 | 主库提交后，Binlog 发送有延迟 |
| 事务顺序 | 从库回放顺序可能与主库不同 |
| 过滤复制 | 主库某些操作不复制 |
| 错误回放 | 从库回放出错 |

### 半同步复制（Semi-Sync Replication）

异步复制的问题是：主库提交后立即返回，从库可能还没收到。

半同步复制：**主库等从库确认收到 Binlog 后再返回成功**。

```
普通异步复制：
主库提交 → 立即返回（不等从库）

半同步复制：
主库提交 → 等待至少一个从库确认 → 返回成功
                ↓
        从库收到 Binlog 后返回 ACK
```

```sql
-- 安装半同步插件（主库和从库都要装）
INSTALL PLUGIN rpl_semi_sync_master SONAME 'semisync_master.so';
INSTALL PLUGIN rpl_semi_sync_slave SONAME 'semisync_slave.so';

-- 主库开启
SET GLOBAL rpl_semi_sync_master_enabled = ON;

-- 从库开启
SET GLOBAL rpl_semi_sync_slave_enabled = ON;
STOP SLAVE;
START SLAVE;

-- 查看状态
SHOW STATUS LIKE 'rpl_semi%';
-- Rpl_semi_sync_master_clients: 1  -- 已连接的半同步从库数
-- Rpl_semi_sync_master_status: ON   -- 半同步是否启用
```

### 主从复制的过滤规则

```sql
-- 主库：binlog-do-db / binlog-ignore-db
[mysqld]
binlog-do-db = shop      -- 只记录 shop 数据库的变更
binlog-ignore-db = test  -- 忽略 test 数据库

-- 从库：replicate-do-db / replicate-ignore-db
[mysqld]
replicate-do-db = shop      -- 只回放 shop 数据库
replicate-ignore-db = test  -- 忽略 test 数据库
```

---

## GTID 复制

传统复制的痛点是：当从库断开重连时，需要手动指定 BINLOG_FILE 和 BINLOG_POS，运维复杂。

GTID（Global Transaction Identifier）解决了这个问题。

### GTID 是什么

GTID = 每一个事务的唯一标识符。

```
格式：server_uuid:transaction_id
示例：3E11FA47-71CA-11E1-9E33-C80AA9429562:12345
      ↑ 服务器 UUID                 ↑ 事务序号
```

### GTID 复制的优势

```sql
-- 传统复制：需要指定 Binlog 位置
CHANGE MASTER TO
    MASTER_LOG_FILE='mysql-bin.000001',
    MASTER_LOG_POS=12345678;

-- GTID 复制：自动追踪位置
CHANGE MASTER TO
    MASTER_HOST='192.168.1.100',
    MASTER_USER='repl_user',
    MASTER_PASSWORD='password',
    MASTER_AUTO_POSITION=1;  -- 自动从上次中断的位置继续
```

### 开启 GTID 复制

```ini
[mysqld]
gtid_mode = ON                    # 开启 GTID
enforce_gtid_consistency = ON    # 强制 GTID 一致性
log_slave_updates = ON           # 从库记录主库的 GTID
```

```sql
-- 查看 GTID 执行状态
SHOW MASTER STATUS;
-- +---------------------+----------+--------------+------------------+
-- | File                | Position | Binlog_Do_DB | Executed_Gtid_Set|
-- +---------------------+----------+--------------+------------------+
-- | mysql-bin.000001    |     1234 |              | 3E11...:1-100    |
-- +---------------------+----------+--------------+------------------+

SHOW SLAVE STATUS\G
-- Executed_Gtid_Set: 3E11...:1-100  -- 从库已执行的 GTID
```

---

## 小结

主从复制的核心是三个线程和两种日志：

| 线程 | 作用 |
|-----|------|
| Dump Thread（主库） | 读取 Binlog 发送给从库 |
| IO Thread（从库） | 接收 Binlog，写入 Relay Log |
| SQL Thread（从库） | 回放 Relay Log，执行变更 |

主从复制的关键问题：

- **延迟**：大事务、单线程回放是主要原因
- **一致性**：半同步复制可以保证至少一个从库收到数据
- **运维**：GTID 复制简化了运维复杂度

> 记住：**Binlog 是源，Relay Log 是镜像，SQL Thread 是执行器**。三个组件配合，构成了完整的主从复制体系。

---

## 下一步

怎么搭建一个一主一从的主从复制环境？配置、验证、同步一致性怎么保证？

从 [一主一从搭建](/database/mysql/replication/master-slave) 继续。
