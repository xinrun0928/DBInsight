# 一主一从搭建

搭建主从复制分两步：先配置主库，再配置从库，最后验证数据一致性。

---

## 环境准备

```
两台服务器：
- 主库：192.168.1.100（已有数据）
- 从库：192.168.1.101（全新 MySQL）

目标：从库实时同步主库的数据
```

---

## 第一步：配置主库

### 1.1 开启 Binlog

```ini
[mysqld]
server-id = 1                      # 必填，每个实例唯一
log_bin = /var/lib/mysql/mysql-bin  # 开启 Binlog
expire_logs_days = 7              # Binlog 保留 7 天
max_binlog_size = 1G               # 单个 Binlog 文件最大 1G
```

### 1.2 创建复制账号

```sql
-- 创建一个专门用于复制的账号
CREATE USER 'repl_user'@'192.168.1.%' IDENTIFIED BY 'Repl@Pass123';
GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'repl_user'@'192.168.1.%';
FLUSH PRIVILEGES;
```

### 1.3 全量备份主库数据

在配置从库之前，需要把主库的现有数据导出来，导入到从库。

```bash
# 方法一：mysqldump 全量备份
mysqldump -uroot -p \
    --single-transaction \    # 开启一致性快照读
    --master-data=2 \         # 记录 Binlog 位置
    --all-databases \         # 备份所有库
    --routines \              # 备份存储过程
    --triggers \              # 备份触发器
    --events \                # 备份事件
    > /backup/full_backup.sql

# 方法二：只备份业务库
mysqldump -uroot -p \
    --single-transaction \
    --master-data=2 \
    shop orders users products \
    > /backup/shop_backup.sql
```

### 1.4 查看备份信息

```bash
# 查看备份中包含的 Binlog 位置
grep "CHANGE MASTER TO" /backup/full_backup.sql
# 输出：CHANGE MASTER TO MASTER_LOG_FILE='mysql-bin.000003', MASTER_LOG_POS=1234567;
```

### 1.5 记录 Binlog 位置（备选方案）

如果已经有数据迁移到从库，只需要记录当前位置：

```sql
-- 主库执行：加读锁（全局只读）
FLUSH TABLES WITH READ LOCK;

-- 查看当前 Binlog 位置
SHOW MASTER STATUS;
-- +---------------------+----------+--------------+------------------+
-- | File                | Position | Binlog_Do_DB | Binlog_Ignore_DB |
-- +---------------------+----------+--------------+------------------+
-- | mysql-bin.000003    |     456  |              |                  |
-- +---------------------+----------+--------------+------------------+

-- 记录后，记得解锁
UNLOCK TABLES;
```

---

## 第二步：配置从库

### 2.1 安装 MySQL

从库机器上安装 MySQL（版本最好与主库一致或更高）。

### 2.2 配置 server-id

```ini
[mysqld]
server-id = 2                      # 必填，必须与主库不同
relay_log = /var/lib/mysql/slave-relay-bin  # Relay Log 路径
log_slave_updates = ON            # 从库也要记录 Binlog（级联复制需要）
read_only = ON                    # 从库只读（但 SUPER 用户不受限制）
super_read_only = ON              # 连 SUPER 用户也只读（MySQL 8.0+）
```

### 2.3 导入数据

```bash
# 把主库的备份导入从库
mysql -uroot -p < /backup/full_backup.sql
```

### 2.4 配置主从连接

```sql
-- 方式一：从备份中自动获取 Binlog 位置（推荐，备份时用了 --master-data=2）
CHANGE MASTER TO
    MASTER_HOST='192.168.1.100',
    MASTER_USER='repl_user',
    MASTER_PASSWORD='Repl@Pass123',
    MASTER_AUTO_POSITION=1;  -- 使用 GTID 复制

-- 方式二：手动指定 Binlog 位置
CHANGE MASTER TO
    MASTER_HOST='192.168.1.100',
    MASTER_USER='repl_user',
    MASTER_PASSWORD='Repl@Pass123',
    MASTER_LOG_FILE='mysql-bin.000003',
    MASTER_LOG_POS=456;
```

### 2.5 启动复制

```sql
-- 启动从库复制
START SLAVE;

-- 查看复制状态
SHOW SLAVE STATUS\G
```

---

## 第三步：验证主从同步

### 3.1 查看复制状态

```sql
SHOW SLAVE STATUS\G

-- 关键指标：
-- Slave_IO_Running: Yes           -- IO 线程运行中
-- Slave_SQL_Running: Yes         -- SQL 线程运行中
-- Seconds_Behind_Master: 0        -- 延迟秒数（0=无延迟）
-- Last_Error:                    -- 错误信息（空=正常）
-- Master_Log_File: mysql-bin.000003   -- 主库 Binlog 文件
-- Read_Master_Log_Pos: 4567890        -- IO 线程已读取位置
-- Relay_Log_File: slave-relay-bin.000003  -- Relay Log 文件
-- Exec_Master_Log_Pos: 4567800        -- SQL 线程已回放位置
```

### 3.2 验证数据一致性

```sql
-- 方法一：主库插入测试数据
INSERT INTO orders (customer_id, amount) VALUES (99999, 0.01);
COMMIT;

-- 从库查询（等待几秒确认同步）
SELECT * FROM orders WHERE customer_id = 99999;
-- 如果能查到，说明同步正常

-- 验证后删除测试数据
DELETE FROM orders WHERE customer_id = 99999;
```

### 3.3 对比表行数

```sql
-- 主库：从库分别执行，对比结果
SELECT COUNT(*) FROM orders;

-- 在主库：
SELECT COUNT(*) FROM orders;  -- 返回 1234567

-- 在从库：
SELECT COUNT(*) FROM orders;  -- 应该也是 1234567
```

### 3.4 使用 pt-table-checksum 校验

```bash
# 安装 Percona Toolkit 后
pt-table-checksum h=192.168.1.100,u=root,p=password \
    --replicate=checksums \
    --tables=orders,users,products

# 结果：
-- TS ERROR DIFFS  ROWS  CHUNKS
-- 1  0  1234567  10
```

---

## GTID 复制配置

如果使用 GTID 复制，配置更简单：

### 主库 GTID 配置

```ini
[mysqld]
gtid_mode = ON
enforce_gtid_consistency = ON
log_bin = /var/lib/mysql/mysql-bin
server-id = 1
```

### 从库 GTID 配置

```ini
[mysqld]
gtid_mode = ON
enforce_gtid_consistency = ON
server-id = 2
relay_log = /var/lib/mysql/slave-relay-bin
log_slave_updates = ON
read_only = ON
super_read_only = ON
```

### GTID 复制时 CHANGE MASTER

```sql
-- 使用 AUTO_POSITION 自动定位
CHANGE MASTER TO
    MASTER_HOST='192.168.1.100',
    MASTER_USER='repl_user',
    MASTER_PASSWORD='Repl@Pass123',
    MASTER_AUTO_POSITION=1;

START SLAVE;
```

### GTID 常见问题

```sql
-- 跳过错误的事务
SET GTID_NEXT='3E11FA47-71CA-11E1-9E33-C80AA9429562:12345';
BEGIN;
COMMIT;
SET GTID_NEXT='AUTOMATIC';

-- 查看从库已执行的 GTID
SHOW SLAVE STATUS\G
-- Executed_Gtid_Set: 3E11FA47-71CA-11E1-9E33-C80AA9429562:1-12345
```

---

## 常见问题排查

### 问题一：Slave_IO_Running = No

```sql
-- 查看错误日志
SHOW SLAVE STATUS\G
-- Last_IO_Error: error connecting to master 'repl_user@192.168.1.100:3306'

-- 常见原因：
-- 1. 网络不通
ping 192.168.1.100

-- 2. 端口不通
telnet 192.168.1.100 3306

-- 3. 账号密码错误
-- 重新创建账号
CREATE USER 'repl_user'@'192.168.1.101' IDENTIFIED BY 'Repl@Pass123';
GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'repl_user'@'192.168.1.101';

-- 4. server-id 冲突
SHOW VARIABLES LIKE 'server_id';  -- 两台机器必须不同
```

### 问题二：Slave_SQL_Running = No

```sql
-- 查看错误
SHOW SLAVE STATUS\G
-- Last_SQL_Error: Error 'Duplicate entry' on key 'PRIMARY'

-- 原因：从库有主库没有的数据（之前手动插入的）
-- 解决方案：
-- 方案一：跳过错误的事务（不推荐，只适合临时处理）
SET GLOBAL sql_slave_skip_counter = 1;
START SLAVE;

-- 方案二：从主库重新全量同步（推荐）
STOP SLAVE;
RESET SLAVE ALL;
-- 重新做全量备份和恢复
```

### 问题三：复制延迟大

```sql
-- 查看延迟原因
SHOW SLAVE STATUS\G
-- Seconds_Behind_Master: 3600  -- 延迟 1 小时！

-- 检查是否有大事务
SHOW PROCESSLIST;
-- SQL Thread 执行大量行更新

-- 检查从库负载
SHOW STATUS LIKE 'Threads_running';

-- 优化方向：
-- 1. 开启并行复制
SET GLOBAL slave_parallel_workers = 4;
SET GLOBAL slave_parallel_type = 'LOGICAL_CLOCK';

-- 2. 优化从库查询
-- 3. 减少大事务
```

---

## 生产环境建议

| 建议 | 说明 |
|-----|------|
| 使用 GTID | 简化运维，自动定位 |
| 开启半同步复制 | 保证至少一个从库收到数据 |
| 从库关闭自动优化 | `innodb_stats_auto_update = OFF` |
| 主从库版本一致 | 避免兼容性问题 |
| 监控复制延迟 | 配置告警阈值（如 > 10 秒） |
| 定期校验一致性 | 用 pt-table-checksum |

---

## 小结

一主一从搭建的核心步骤：

```
1. 主库：开启 Binlog，创建复制账号，全量备份
2. 从库：安装 MySQL，配置 server-id，导入数据
3. 从库：CHANGE MASTER TO，START SLAVE
4. 验证：SHOW SLAVE STATUS，确认 Slave_IO/SQL_Running = Yes
```

> 记住：**主从复制的核心是 Binlog 传输**。理解 Binlog 的格式、刷盘时机、GTID 机制，主从复制就不难排查了。

---

## 下一步

数据备份是数据库安全的基本保障。mysqldump 和物理备份怎么用？恢复流程是什么？

从 [逻辑备份：mysqldump](/database/mysql/replication/backup/logical) 继续。
