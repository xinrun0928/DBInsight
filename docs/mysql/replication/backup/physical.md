# 物理备份：xtrabackup

物理备份直接复制 MySQL 的数据文件，跳过 SQL 层，速度比 mysqldump 快 10 倍以上，是大型数据库备份的首选。

---

## 物理备份 vs 逻辑备份

| 维度 | 物理备份 | 逻辑备份 |
|-----|---------|---------|
| 备份方式 | 复制数据文件（ibd, frm） | 导出 SQL 语句 |
| 速度 | 快（直接复制文件） | 慢（需要解析/生成 SQL） |
| 恢复速度 | 快（直接替换文件） | 慢（需要执行 SQL） |
| 适用数据量 | GB~TB 级 | MB~GB 级 |
| 备份内容 | 完整数据文件 | 表结构 + 数据 |
| 兼容性 | 同版本，同引擎 | 跨版本可行 |
| 增量备份 | 支持 | 不支持 |

---

## xtrabackup 介绍

Percona XtraBackup（简称 xtrabackup）是 Percona 公司开源的 MySQL 物理备份工具，支持：

- 全量备份
- 增量备份
- 压缩备份
- 流式备份
- 备份加密
- 并行备份

### 安装

```bash
# CentOS/RHEL
yum install percona-xtrabackup-80

# Ubuntu/Debian
apt-get install percona-xtrabackup-80

# 验证安装
xtrabackup --version
```

---

## 全量备份

### 基本全量备份

```bash
# 创建备份目录
mkdir -p /backup/xtrabackup/full
chown mysql:mysql /backup/xtrabackup/full

# 执行全量备份
xtrabackup --backup \
    --target-dir=/backup/xtrabackup/full_$(date +%Y%m%d) \
    --user=root \
    --password=YourPassword \
    --parallel=4
```

### 备份过程

```
xtrabackup --backup 执行过程：
1. 启动 xtrabackup 进程
2. 连接到 MySQL
3. 读取 InnoDB 数据文件
4. 复制数据文件（并行，--parallel=4）
5. 在后台记录 Redo Log（保证备份一致性）
6. 复制 .frm 表结构文件（非 InnoDB 表）
7. 记录 Binlog 位置（--slave-info）
8. 完成备份
```

### 查看备份

```bash
ls -la /backup/xtrabackup/full_20240115/
# 包含：
# -ibdata1         -- 系统表空间
# -ib_logfile*     -- Redo Log（用于恢复一致性）
# -shop/            -- 业务数据库文件
# -xtrabackup_info  -- 备份元信息
# -xtrabackup_checkpoints  -- 检查点信息
```

---

## 增量备份

增量备份只备份**从上次备份以来变化的数据**，大幅节省空间和时间。

```bash
# 基于 1 月 15 日的全量备份，创建增量备份
xtrabackup --backup \
    --target-dir=/backup/xtrabackup/incr_20240116 \
    --incremental-basedir=/backup/xtrabackup/full_20240115 \
    --user=root \
    --password=YourPassword

# 1 月 17 日的增量备份
xtrabackup --backup \
    --target-dir=/backup/xtrabackup/incr_20240117 \
    --incremental-basedir=/backup/xtrabackup/incr_20240116 \
    --user=root \
    --password=YourPassword
```

### 增量备份原理

```
备份体系：
full_20240115  →  全量备份（100GB）
incr_20240116   →  基于全量的增量（+5GB）
incr_20240117   →  基于 incr_20240116 的增量（+3GB）

恢复时：
full_20240115 + incr_20240116 + incr_20240117 = 最新数据
```

---

## 恢复备份

### 第一步：准备（prepare）

**重要**：备份后必须先 prepare，才能用于恢复。

```bash
# 对全量备份执行 prepare
xtrabackup --prepare \
    --target-dir=/backup/xtrabackup/full_20240115

# 如果有增量备份，需要逐个 prepare：
xtrabackup --prepare \
    --target-dir=/backup/xtrabackup/full_20240115

xtrabackup --prepare \
    --target-dir=/backup/xtrabackup/full_20240115 \
    --incremental-dir=/backup/xtrabackup/incr_20240116

xtrabackup --prepare \
    --target-dir=/backup/xtrabackup/full_20240115 \
    --incremental-dir=/backup/xtrabackup/incr_20240117
```

### 第二步：恢复

```bash
# 停止 MySQL
systemctl stop mysql

# 备份原有的数据文件（安全起见）
mv /var/lib/mysql /var/lib/mysql.bak

# 恢复数据文件
xtrabackup --copy-back \
    --target-dir=/backup/xtrabackup/full_20240115 \
    --datadir=/var/lib/mysql

# 修改权限
chown -R mysql:mysql /var/lib/mysql

# 启动 MySQL
systemctl start mysql
```

---

## 压缩备份

```bash
# 备份时压缩（节省磁盘空间）
xtrabackup --backup \
    --compress \
    --compress-threads=4 \
    --target-dir=/backup/xtrabackup/compressed_20240115 \
    --user=root \
    --password=YourPassword

# 解压恢复
xtrabackup --decompress \
    --target-dir=/backup/xtrabackup/compressed_20240115
```

---

## 流式备份

流式备份把备份数据直接通过网络流传输，适合远程备份：

```bash
# 流式备份到远程服务器
xtrabackup --backup \
    --stream=xbstream \
    --target-dir=/backup/xtrabackup/stream \
    --user=root \
    --password=YourPassword \
    | ssh user@backup-server "xbstream -x -C /backup/mysql"

# 压缩 + 流式备份
xtrabackup --backup \
    --stream=tar \
    --compress \
    --target-dir=/tmp \
    --user=root \
    --password=YourPassword \
    | ssh user@backup-server "tar -xf - -C /backup/mysql"
```

---

## 主从环境备份

在从库上做备份，不影响主库业务：

```bash
# 在从库执行备份（记录从库的复制位置）
xtrabackup --backup \
    --slave-info \
    --safe-slave-backup \
    --target-dir=/backup/xtrabackup/slave_backup \
    --user=root \
    --password=YourPassword

# 恢复时，从库的 CHANGE MASTER 信息自动记录在 xtrabackup_slave_info
cat /backup/xtrabackup/slave_backup/xtrabackup_slave_info
-- CHANGE MASTER TO MASTER_LOG_FILE='mysql-bin.000003', MASTER_LOG_POS=1234567;
```

---

## 备份脚本

```bash
#!/bin/bash
# xtrabackup_backup.sh - Percona XtraBackup 全量 + 增量备份

BACKUP_DIR="/backup/xtrabackup"
MYSQL_USER="root"
MYSQL_PASSWORD="YourPassword"
DATE=$(date +%Y%m%d)
KEEP_DAYS=14

# 全量备份函数
full_backup() {
    local target="${BACKUP_DIR}/full_${DATE}"
    echo "[$(date)] Starting FULL backup to ${target}"
    xtrabackup --backup \
        --target-dir=${target} \
        --user=${MYSQL_USER} \
        --password=${MYSQL_PASSWORD} \
        --parallel=4 \
        --compress \
        --compress-threads=4
    echo "[$(date)] FULL backup completed"
}

# 增量备份函数
incr_backup() {
    local basedir=$1
    local target="${BACKUP_DIR}/incr_${DATE}"
    echo "[$(date)] Starting INCR backup to ${target}"
    xtrabackup --backup \
        --target-dir=${target} \
        --incremental-basedir=${basedir} \
        --user=${MYSQL_USER} \
        --password=${MYSQL_PASSWORD} \
        --parallel=4 \
        --compress \
        --compress-threads=4
    echo "[$(date)] INCR backup completed"
}

# 执行备份
if [ $(date +%u) -eq 7 ]; then
    # 周日：全量备份
    full_backup
    BASE_DIR="${BACKUP_DIR}/full_${DATE}"
else
    # 平日：增量备份
    # 找到最近的全量备份
    LATEST_FULL=$(ls -td ${BACKUP_DIR}/full_* | head -1)
    incr_backup ${LATEST_FULL}
    BASE_DIR="${BACKUP_DIR}/incr_${DATE}"
fi

# 清理过期备份
find ${BACKUP_DIR} -type d -mtime +${KEEP_DAYS} -exec rm -rf {} \;
echo "[$(date)] Old backups (>${KEEP_DAYS} days) cleaned up"
```

---

## 备份验证

```bash
# 查看备份元信息
cat /backup/xtrabackup/full_20240115/xtrabackup_info
# binlog_pos = Filename 'mysql-bin.000003', Position '1234567'
# innodb_from_lsn = 0  -- 起始 LSN
# innodb_to_lsn = 1234567890  -- 结束 LSN

# 检查完整性
xtrabackup --check-dir --target-dir=/backup/xtrabackup/full_20240115
# 无输出 = 备份完整
```

---

## 小结

xtrabackup 的核心优势：

| 功能 | 说明 |
|-----|------|
| 全量备份 | 复制所有数据文件 |
| 增量备份 | 只备份变化的部分（节省空间和时间） |
| 并行备份 | `--parallel=4` 多线程复制 |
| 压缩备份 | `--compress` 节省空间 |
| 流式备份 | 备份数据直接传输到远程 |

xtrabackup 备份流程：

```
备份：xtrabackup --backup
       ↓
prepare：xtrabackup --prepare（必须！）
       ↓
恢复：xtrabackup --copy-back
```

> 记住：**物理备份的核心是 LSN（Log Sequence Number）**。LSN 是 InnoDB 的逻辑序列号，决定了备份的一致性和恢复点。

---

## 下一步

MySQL 数据库的全部文档到这里就结束了。从基础的数据库概念，到 SQL 语法，到表结构设计，到性能优化，到事务锁机制，再到主从复制和备份恢复——你已经掌握了 MySQL 的完整知识体系。

回到 [MySQL 模块主页](/database/mysql/index)，查看完整的知识地图。
