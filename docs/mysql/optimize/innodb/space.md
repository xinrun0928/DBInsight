# InnoDB 表空间结构

从页、区、段到表空间——理解这四个层次的组织关系，才能理解为什么大表需要特殊处理，以及 OPTIMIZE TABLE 到底在做什么。

---

## 表空间的全貌

InnoDB 的存储空间组织如下：

```
表空间（Tablespace）
├── 系统表空间（System Tablespace）
│   ├── InnoDB 数据字典（Data Dictionary）
│   ├── 双写缓冲区（Doublewrite Buffer）
│   ├── 回滚段（Rollback Segments）
│   └── 变更缓冲区（Change Buffer）
│
├── 独立表空间（File-Per-Table Tablespace）
│   ├── 用户表（如 orders.ibd）
│   └── 每个表一个独立的 .ibd 文件
│
├── 通用表空间（General Tablespace）
│   └── 多个表共享一个表空间
│
├── 临时表空间（Temporary Tablespace）
│
└── redo 日志文件（系统表空间外单独管理）
```

MySQL 5.6+ 默认使用**独立表空间**（`innodb_file_per_table = ON`），每个表一个 `.ibd` 文件。

---

## 页（Page）

**页**是 InnoDB 磁盘 I/O 的最小单位，大小默认 16KB。

```
页大小可以调整：
SET GLOBAL innodb_page_size = 4KB;  -- 仅在初始化时有效
```

| 页类型 | 用途 |
|-------|------|
| FIL_PAGE_INDEX | 数据页/索引页（B+ 树节点） |
| FIL_PAGE_UNDO_LOG | Undo Log 页 |
| FIL_PAGE_INODE | 段信息页 |
| FIL_PAGE_IBUF_FREE_LIST | Insert Buffer 的空闲列表 |
| FIL_PAGE_TYPE_BLOB | BLOB 溢出页 |
| FIL_PAGE_TYPE_SYS | 系统页 |
| FIL_PAGE_TYPE_TRX_SYS | 事务系统页 |

> 所有页都有相同的 File Header（前 38 字节）和 File Trailer（后 8 字节），保证页的完整性和链表连接。

---

## 区（Extent）

**区**是页的上一级组织单位，**一个区 = 64 个连续的页 = 1MB**。

```
一个区：
┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐
│P1│P2│P3│...│P64│ ← 64 个页 = 1MB
└──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
```

### 为什么需要区？

- **顺序 I/O 优化**：区内的页是物理连续的，顺序读取时磁盘磁头移动最少
- **减少随机 I/O**：随机读取一个区等于顺序读 1MB，性能接近顺序读

### 区与碎片

区有两种状态：

| 区类型 | 说明 |
|-------|------|
| FREE | 完全空闲，可分配 |
| FREE_FRAG | 部分页已使用（有碎片） |
| FULL_FRAG | 页全部用完 |
| FSEG | 属于某个段（非叶子节点段或叶子节点段） |

---

## 段（Segment）

**段**是区的上一层组织单位，一个段由多个区组成。

InnoDB 索引会产生**两个段**：

| 段 | 包含的区 |
|---|--------|
| 聚簇索引根节点段 | 非叶子节点所在的区 |
| 叶子节点段 | 所有叶子节点所在的区 |

```
表 orders 的聚簇索引结构：
┌─────────────────────┐
│    根节点（单个页）    │ ← 非叶子节点段
├─────────────────────┤
│  [区1][区2][...][区N] │ ← 非叶子节点区（FSEG）
│  [区1][区2][...][区N] │ ← 叶子节点区（FSEG）
│  (B+ 树的非叶子节点)    │
│  (B+ 树的叶子节点，    │
│   包含完整行数据)      │
└─────────────────────┘
```

> **为什么区是连续的，但段可以有多个不连续的区？**
> 区是物理连续的单位（保证顺序 I/O），但段是逻辑单位——段需要扩展时，InnoDB 优先从 FREE 区中分配（连续），如果 FREE 区不够，再分配碎片区。

### 段的扩展策略

InnoDB 为段分配区的策略：

1. 初始：段分配 32 个碎片页（零散页，不属于任何区）
2. 碎片页用完后，再按 EXTENT_SIZE（64页 = 1MB）分配整区
3. 大表段：随着数据增长，区数量线性增长

---

## 碎片区（Fragment Page）

在段刚创建时，InnoDB 不会立即分配完整的区，而是先使用**碎片区（碎片页）**。

```
段创建初期：
┌───┬───┬───┬───┬───┐
│ P │ P │ P │ P │ P │ ← 碎片页（来自不同区，零散）
└───┴───┴───┴───┴───┘

段扩展后：
┌───────────────────────────────────┐
│  [ 区1 ][ 区2 ][ 区3 ][ 碎片页 ]   │ ← 整区 + 碎片页
└───────────────────────────────────┘
```

这样做是为了**减少空间浪费**——小表如果一开始分配 1MB（64个页），大部分空间是空的。

---

## 表空间（Tablespace）

### 独立表空间（File-Per-Table）

MySQL 5.6.6+ 默认开启：

```sql
SHOW VARIABLES LIKE 'innodb_file_per_table';
-- ON：每个表一个 .ibd 文件
-- OFF：所有表在系统表空间（ibdata1）
```

| 优点 | 缺点 |
|-----|------|
| DROP/TRUNCATE 表时立即释放空间 | 文件数量多，文件系统压力大 |
| 每个表独立备份和恢复 | 所有表共享系统表空间时，空间管理更简单 |
| 支持在线 ALTER TABLE | 小表文件太小，碎片化 |
| 可使用移动表（transportable tablespaces） | |

### 系统表空间

`ibdata1`（可配置多个文件）包含：

```
ibdata1 结构：
┌──────────────┬───────────────┬──────────────────┐
│  数据字典     │   双写缓冲区   │    回滚段         │
│  (Data Dict) │ (Doublewrite) │ (Rollback Segs)  │
└──────────────┴───────────────┴──────────────────┘
```

| 组成部分 | 作用 |
|-------|------|
| 数据字典 | 存储表结构、列、索引等元信息 |
| 双写缓冲区 | 保证数据页写入的原子性（后文详述） |
| 回滚段 | 存储 Undo Log，支持 MVCC 和回滚 |

> **配置**：`innodb_data_file_path = ibdata1:12M:autoextend`
> 系统表空间可自动扩展，但如果频繁增长，需要预估大小或迁移到独立表空间。

### 通用表空间

类似系统表空间，但可以容纳多个表：

```sql
CREATE TABLESPACE ts_general ADD DATAFILE 'ts_general.ibd';

CREATE TABLE t1 (id INT) TABLESPACE ts_general;
CREATE TABLE t2 (id INT) TABLESPACE ts_general;
```

### 临时表空间

存储临时表和内部排序结果，MySQL 8.0+ 使用独立临时表空间：

```sql
SHOW VARIABLES LIKE 'innodb_temp_data_file_path';
-- ibtmp1:12M:autoextend
```

---

## 实战：查看表空间使用

```sql
-- 查看所有表的大小和行数（按大小排序）
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    ROUND(DATA_LENGTH / 1024 / 1024, 2) AS '数据大小(MB)',
    ROUND(INDEX_LENGTH / 1024 / 1024, 2) AS '索引大小(MB)',
    ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS '总大小(MB)'
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'shop'
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;

-- 查看表空间文件大小（物理文件）
SELECT 
    NAME,
    FILE_SIZE,
    ALLOCATED_SIZE
FROM information_schema.FILES
WHERE FILE_TYPE = 'DATAFILE';

-- 查看 innodb 状态（包括表空间 I/O）
SHOW ENGINE INNODB STATUS\G
-- 找 "Tablespace" 部分
```

---

## 小结

表空间体系的核心关系：

```
页（16KB）→ 区（64页 = 1MB）→ 段（多区组成）→ 表空间（.ibd 文件）
```

理解这四层关系，就能明白：

- 为什么大表的索引要精心设计（B+ 树高一层意味着多一次 I/O）
- 为什么 OPTIMIZE TABLE 能回收空间（合并碎片页，重新组织区分配）
- 为什么 DROP TABLE 比 DELETE FROM 快（DROP 直接删除表空间，DELETE 要逐行）

---

## 下一步

理解了底层存储结构后，开始学习如何发现和定位性能问题。

从 [慢查询日志与 SHOW PROFILE](/database/mysql/optimize/tool/slow-log) 开始。
