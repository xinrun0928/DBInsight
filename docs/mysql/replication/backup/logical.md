# 逻辑备份：mysqldump

mysqldump 是 MySQL 自带的逻辑备份工具——它把数据库的表结构和数据导出成 SQL 文件，适合中小型数据库的全量备份。

---

## mysqldump 的基本用法

### 全量备份单个数据库

```bash
mysqldump -uroot -p shop > /backup/shop_full_backup.sql
# 输入密码后，等待备份完成
```

### 全量备份所有数据库

```bash
mysqldump -uroot -p --all-databases > /backup/all_db_backup.sql
```

### 备份特定表

```bash
# 备份 orders 和 users 两张表
mysqldump -uroot -p shop orders users > /backup/shop_tables.sql
```

---

## mysqldump 的关键参数

| 参数 | 说明 | 推荐场景 |
|-----|------|---------|
| `--single-transaction` | 开启一致性快照读 | InnoDB 表备份 |
| `--master-data=2` | 记录 Binlog 位置 | 主从复制配置 |
| `--flush-logs` | 备份前刷新日志 | 配合 Binlog 做增量 |
| `--routines` | 备份存储过程 | 有存储过程时 |
| `--triggers` | 备份触发器 | 有触发器时 |
| `--events` | 备份事件 | 有事件调度器时 |
| `--hex-blob` | 备份 BLOB 字段为十六进制 | 有 BLOB 数据时 |
| `--max-allowed-packet` | 最大包大小 | 大字段表 |
| `--quick` | 不缓存整张表，逐行读取 | 大表备份 |

### 推荐备份命令

```bash
# 生产环境推荐：InnoDB 全库备份
mysqldump -uroot -p \
    --single-transaction \        # InnoDB 一致性快照
    --master-data=2 \             # 记录 Binlog 位置
    --flush-logs \               # 刷新日志
    --routines \                 # 存储过程
    --triggers \                 # 触发器
    --events \                   # 事件
    --hex-blob \                # BLOB 字段
    --max-allowed-packet=256M \  # 大字段
    shop > /backup/shop_backup_$(date +%Y%m%d).sql

# 压缩备份（节省空间）
mysqldump -uroot -p shop | gzip > /backup/shop_backup.sql.gz
```

### 备份大表

```bash
# 大表备份（逐行读取，不占用大量内存）
mysqldump -uroot -p \
    --single-transaction \
    --quick \
    --max-allowed-packet=512M \
    shop large_orders > /backup/large_orders.sql
```

---

## 恢复数据

### 完全恢复

```bash
# 恢复整个数据库
mysql -uroot -p shop < /backup/shop_backup.sql

# 从压缩备份恢复
gunzip < /backup/shop_backup.sql.gz | mysql -uroot -p shop

# 恢复所有数据库（备份时用 --all-databases）
mysql -uroot -p < /backup/all_db_backup.sql
```

### 恢复特定表

```bash
# 从备份文件中提取特定表的 SQL
grep "DROP TABLE.*orders" /backup/shop_backup.sql  # 先确认存在
grep "CREATE TABLE.*orders" /backup/shop_backup.sql
grep "INSERT INTO.*orders" /backup/shop_backup.sql

# 或者：用 mysqlimport
mysqlimport -uroot -p shop --replace /backup/orders.sql
```

### 基于时间点的恢复（PITR）

基于时间点恢复 = 全量备份 + Binlog 增量恢复。

```sql
-- 场景：2024-01-15 10:30 执行了 DELETE，丢了大量数据
-- 目标：恢复到 10:29:59

-- Step 1: 全量恢复（恢复到备份时间点）
mysql -uroot -p shop < /backup/shop_backup.sql

-- Step 2: 找出备份的 Binlog 位置
grep "CHANGE MASTER TO" /backup/shop_backup.sql
-- 输出：CHANGE MASTER TO MASTER_LOG_FILE='mysql-bin.000003', MASTER_LOG_POS=456;

-- Step 3: 应用 Binlog（从备份位置到 10:29:59）
mysqlbinlog \
    --stop-datetime='2024-01-15 10:29:59' \
    /var/lib/mysql/mysql-bin.000003 \
    /var/lib/mysql/mysql-bin.000004 \
| mysql -uroot -p shop

-- Step 4: 检查数据
SELECT COUNT(*) FROM orders WHERE created_at > '2024-01-15 10:29:59';
```

---

## 备份脚本

### 每日全量备份脚本

```bash
#!/bin/bash
# backup_daily.sh

# 配置
MYSQL_USER="root"
MYSQL_PASSWORD="YourPassword"
BACKUP_DIR="/backup/mysql"
DATE=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${BACKUP_DIR}/backup.log"

# 数据库列表
DATABASES=("shop" "users" "logs")

# 创建备份目录
mkdir -p ${BACKUP_DIR}

# 记录日志
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a ${LOG_FILE}
}

# 备份函数
backup_db() {
    local db=$1
    local backup_file="${BACKUP_DIR}/${db}_${DATE}.sql.gz"
    
    log "Starting backup for ${db}..."
    
    mysqldump -u${MYSQL_USER} -p${MYSQL_PASSWORD} \
        --single-transaction \
        --master-data=2 \
        --flush-logs \
        --routines \
        --triggers \
        --events \
        --hex-blob \
        ${db} | gzip > ${backup_file}
    
    if [ $? -eq 0 ]; then
        log "Backup completed: ${backup_file}"
    else
        log "Backup FAILED for ${db}!"
        return 1
    fi
}

# 备份所有数据库
for db in "${DATABASES[@]}"; do
    backup_db ${db}
done

# 清理 7 天前的备份
find ${BACKUP_DIR} -name "*.sql.gz" -mtime +7 -delete
log "Old backups (7+ days) cleaned up"

log "All backups completed successfully"
```

### crontab 定时任务

```bash
# 每天凌晨 2 点执行备份
0 2 * * * /opt/scripts/backup_daily.sh >> /var/log/mysql_backup.log 2>&1

# 每周日凌晨 3 点执行全量备份
0 3 * * 0 /opt/scripts/backup_full.sh >> /var/log/mysql_backup.log 2>&1
```

---

## 备份策略

### 策略一：每日全量 + Binlog

```
每天凌晨 2:00：全量备份
     ↓
Binlog 实时记录
     ↓
灾难发生
     ↓
全量恢复 + Binlog 增量恢复到指定时间点
```

### 策略二：每周全量 + 每日增量

```
周日：全量备份
周一~周六：增量备份（只备份 Binlog 变化）
     ↓
灾难发生
     ↓
全量恢复 + 多个增量恢复
```

### 策略三：主从复制 + 备份

```
主库：正常业务
从库：作为实时备份，可以用来做备份操作（不锁主库）
     ↓
从库执行 mysqldump（从库是只读的，不影响主库）
     ↓
主从延迟作为备份窗口
```

---

## 备份验证

备份后必须验证，否则备份可能是一场虚假的安心。

```bash
# 1. 检查备份文件大小
ls -lh /backup/*.sql.gz
# 如果备份文件为 0 字节，说明备份失败

# 2. 检查备份文件完整性
gunzip -t /backup/shop_backup.sql.gz
# 无输出 = 文件完整

# 3. 恢复到测试库验证
mysql -uroot -p test_shop < <(gunzip -c /backup/shop_backup.sql.gz)
# 检查表结构和数据

# 4. 检查数据一致性
mysql -uroot -p test_shop -e "SELECT COUNT(*) FROM orders;"
# 对比生产库和测试库的数据行数
```

---

## mysqldump 的局限性

| 局限性 | 说明 | 解决方案 |
|-------|------|---------|
| 备份速度慢 | 逻辑导出，受 CPU 和 I/O 限制 | 大表用 xtrabackup |
| 恢复速度慢 | 需要逐行执行 SQL | 大表用物理备份 |
| 锁表问题 | MyISAM 表会锁表 | 用 --single-transaction + InnoDB |
| 大字段处理 | TEXT/BLOB 字段可能超时 | 用 --hex-blob |
| 无法增量备份 | 只能全量 | 配合 Binlog |

> **何时用 mysqldump**：
> - 数据量 < 100GB
> - 需要跨版本恢复
> - 需要恢复特定表
> - 日常每日备份

---

## 小结

mysqldump 备份的核心参数：

| 参数 | 作用 |
|-----|------|
| `--single-transaction` | InnoDB 一致性快照 |
| `--master-data=2` | 记录 Binlog 位置 |
| `--flush-logs` | 刷新日志，配合增量 |
| `--routines/triggers/events` | 备份数据库对象 |

> 记住：**备份不验证，等于没备份**。每次备份后都要检查文件完整性和数据可恢复性。

---

## 下一步

mysqldump 适合中小型数据库。对于大型数据库（TB 级），物理备份是唯一的选择。

从 [物理备份：xtrabackup](/database/mysql/replication/backup/physical) 继续。
