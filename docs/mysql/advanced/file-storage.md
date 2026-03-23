# MySQL 目录结构 / 表的文件存储

## MySQL 的数据存储层次

```
MySQL Server
  └── Database（库）        → /var/lib/mysql/school_db/
      └── Table（表）         → student.ibd（InnoDB）
      └── Index（索引）       → 和表数据一起存在 .ibd 文件中
      └── View（视图）        → 不存数据
      └── Stored Procedure    → 存在 mysql.proc 表中
```

MySQL 的数据最终存在磁盘上。了解文件结构，是排查问题和性能调优的基础。

## InnoDB 表的物理存储

### MySQL 8.0 的独立表空间

MySQL 8.0 默认开启独立表空间，每个 InnoDB 表对应一个 `.ibd` 文件：

```
school_db/
├── student.ibd          -- 独立表空间（表数据 + 索引）
├── class.ibd
├── course.ibd
└── db.opt               -- 数据库默认字符集和比较规则
```

> 5.7 及之前默认是共享表空间（所有表存在 `ibdata1` 里）。

### 系统表空间（ibdata）

系统表空间存放 InnoDB 的系统数据：

```
/var/lib/mysql/
├── ibdata1              -- 系统表空间（可以配置多个）
├── ibdata2
├── ib_logfile0          -- redo log 文件（两个一组）
├── ib_logfile1          -- redo log 文件
└── school_db/
    └── student.ibd      -- 独立表空间
```

| 文件 | 作用 |
|------|------|
| `ibdata*` | 系统表空间（表元数据、undo log、双写缓冲） |
| `ib_logfile*` | redo log（事务日志，物理恢复用） |
| `*.ibd` | 独立表空间（8.0 默认每个表一个） |
| `*.MYD` / `*.MYI` / `*.frm` | MyISAM 表文件（5.7 中 .frm 存表结构，8.0 中已移除） |

## 查看 InnoDB 表空间信息

```sql
-- 查看 InnoDB 状态
SHOW ENGINE INNODB STATUS\G

-- 查看表空间使用
SELECT
    TABLE_NAME,
    TABLE_ROWS,
    DATA_LENGTH,
    INDEX_LENGTH
FROM information_schema.tables
WHERE table_schema = 'school_db'
ORDER BY DATA_LENGTH DESC;
```

## 表的存储参数

### InnoDB 表的行格式

InnoDB 有四种行格式（影响存储效率和索引性能）：

```sql
-- 查看表的行格式
SHOW TABLE STATUS FROM school_db LIKE 'student';

-- 修改行格式
ALTER TABLE student ROW_FORMAT = COMPRESSED;
```

| 行格式 | 说明 | 适用场景 |
|--------|------|---------|
| `COMPACT` | 默认，节省空间 | 通用 |
| `DYNAMIC` | MySQL 8.0 默认，溢出列存溢出页 | 通用 |
| `COMPRESSED` | 压缩存储 | 大表、只读表 |
| `REDUNDANT` | 老格式，不推荐 | 兼容性 |

### 表的存储参数

```sql
CREATE TABLE student (
    ...
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  ROW_FORMAT=DYNAMIC
  KEY_BLOCK_SIZE=8
  AUTOEXTEND_SIZE=134217728;  -- 自动扩展大小
```

## 临时表和排序文件

MySQL 在处理大查询时，会用到临时文件：

```sql
-- 查看临时目录
SHOW VARIABLES LIKE 'tmpdir';
-- /tmp（Linux/macOS）
-- Windows: C:\Windows\Temp
```

- 排序操作超过 `sort_buffer_size` 时，写临时文件到磁盘
- UNION 查询的中间结果存在临时表
- 大表 JOIN 超出 `join_buffer_size` 时写临时文件

```ini
[mysqld]
tmpdir = /data/mysql/tmp
sort_buffer_size = 2M
join_buffer_size = 2M
```

## 表的碎片与优化

### 查看表的碎片

```sql
SELECT
    TABLE_NAME,
    DATA_LENGTH,
    INDEX_LENGTH,
    DATA_LENGTH + INDEX_LENGTH AS total,
    ROUND((DATA_FREE) / 1024 / 1024, 2) AS free_mb
FROM information_schema.tables
WHERE table_schema = 'school_db';
```

### 清理碎片

```sql
-- OPTIMIZE TABLE 会重建表，收回碎片空间
OPTIMIZE TABLE student;
-- 等价于：
-- ALTER TABLE student ENGINE = InnoDB;

-- 动态页面检查
ANALYZE TABLE student;
```

> `OPTIMIZE TABLE` 在执行期间会锁表，大表要谨慎。

## 表的迁移

### 迁移表到另一个数据库

```sql
-- 方式一：RENAME
RENAME TABLE school_db.student TO new_school_db.student;

-- 方式二：ALTER（移动）
ALTER TABLE school_db.student RENAME new_school_db.student;

-- 方式三：直接移动 .ibd 文件（需要先 detach）
ALTER TABLE student DISCARD TABLESPACE;
-- 复制 .ibd 文件到目标目录
ALTER TABLE student IMPORT TABLESPACE;
```

## 查看目录结构

```sql
-- 查看数据目录
SHOW VARIABLES LIKE 'datadir';

-- 查看临时目录
SHOW VARIABLES LIKE 'tmpdir';

-- 查看日志目录
SHOW VARIABLES LIKE 'log_error';
```

## 磁盘空间规划建议

| 目录 | 建议大小 | 说明 |
|------|---------|------|
| 数据目录（datadir） | 业务预估 × 1.5 | 留足增长空间 |
| 日志目录 | datadir 的 20% | redo log、binlog、error log |
| 临时目录 | datadir 的 10% | 大查询临时文件 |
| 系统表空间 | 初始 100MB~500MB | 监控增长 |

## 下一步

目录结构学完了，接下来看 [用户与权限](/database/mysql/advanced/user)——怎么创建用户、分配权限。
